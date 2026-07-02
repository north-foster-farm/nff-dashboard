// reflow.js — the Projects-rework scheduling engine core (PURE).
//
// The forced-ranked project list drives what fills the day's PROJECT
// GAPS — the negative space left by chores (non-negotiable) and events
// (external), already computed by projectGaps() in partition.js. This
// module is the pure planner + the staleness signal; the wiring that
// writes a plan as `commitments` deltas and the stale-indicator UI live
// elsewhere (see the engine design doc).
//
// Framework-free + side-effect-free, mirroring projects.js / chores.js.
//
// Two divergences from the older nextProjectStep() auto-pull, both
// deliberate under the rework model:
//   1. "Ranked" is the NEW queue model — queue_state === 'ranked', not
//      completed, not archived — ordered by sort_order. NOT the old
//      status/[startedAt,targetDate] window (`isActiveProject`).
//   2. Dates are light-touch metadata, NEVER scheduled on. Only the rank
//      places work; `locked_date` is the sole date-driven escape hatch
//      (pins an item to a day; the plan flows around it — see LOCKS on
//      reflowPlan).
//
// STALENESS IS DERIVED, NOT STORED. The live-derived schedule never
// persists (only deltas do), so we never store a "reflowed_at". The
// schedule is STALE when the committed project placements differ from
// what reflowPlan() would produce from the CURRENT ranking. Reordering
// the list makes the plan diverge from what's committed → surfaces as
// stale until the user (or the debounced auto-fallback) reflows. That is
// the roadmap's "never silently rearrange; the user deliberately syncs"
// rule, expressed without any new schema.

// ── The ranked project queue (new model) ──────────────────────────────
// Ranked, actionable projects in priority order. Dates are intentionally
// ignored (scheduling on them would defeat the forced ranking).
export function rankedActiveProjects(projects) {
  return (projects ?? [])
    .filter((p) =>
      p.queueState === "ranked" && !p.completedAt && !p.archivedAt)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

// ── The flattened step queue ──────────────────────────────────────────
// Every incomplete step of the ranked projects, in project-rank then
// step-sort order: all of #1's remaining steps, then all of #2's, and so
// on. This is the "top is THE focus" happy path — the top project fills
// the gaps until it runs dry, then the next one. (Tandem work is the
// accommodated exception, handled by manual placement, not here.)
// Requires each project to carry its `steps` (id, title, sortOrder,
// completedAt, lockedDate); the loader hydrates them. Each node carries its
// effective `lockedDate` — the step's own lock, else the project's (a
// phase-level lock would slot between; deferred until phases are hydrated
// + a phase lock UI exists). reflowPlan uses it to pin/skip.
export function rankedStepQueue(rankedProjects, excludeStepIds = new Set()) {
  const queue = [];
  for (const p of rankedProjects ?? []) {
    const steps = (p.steps ?? [])
      .filter((s) => !s.completedAt && !excludeStepIds.has(s.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const s of steps) {
      queue.push({
        projectId: p.id,
        projectTitle: p.title,
        stepId: s.id,
        title: s.title,
        lockedDate: s.lockedDate ?? p.lockedDate ?? null,
      });
    }
  }
  return queue;
}

// ── The reflow plan ───────────────────────────────────────────────────
//
//   reflowPlan({ rankedProjects, gapsByDate, excludeStepIds })
//     → [{ dateISO, gapStartMin, gapEndMin, projectId, projectTitle,
//          stepId, title }]
//
// One step fills one gap: projects carry no duration (durations are
// unknowable under constant context-switching — the rework's premise), so
// a gap is one work session = the next queued step. Gaps are consumed in
// horizon order (day, then time-sorted within a day — the shape
// projectGaps() already returns), and the queue is drained in rank order.
// Runs out cleanly when either the queue or the gaps are exhausted.
//
// `gapsByDate`: ordered [{ dateISO, gaps: [{ startMin, endMin }] }] — the
// caller derives each day's project gaps (projectGaps()) across the
// horizon and hands them in date order.
//
// `excludeStepIds`: steps already spoken for (completed elsewhere today,
// or manually placed/swapped — those overrides win over the auto-plan).
//
// `excludeGapStarts`: gap start-minutes the plan must leave EMPTY — the
// gaps a user removed a placed step from (the removal tombstone keeps the
// gap's clock_time). Removing a step means "leave this window free," not
// "backfill it with the next queued step."
//
// LOCKS (the escape hatch): a step whose effective `lockedDate` falls on a
// horizon day is PINNED to that day — it jumps that day's queue, ahead of
// rank. A step locked to a day OUTSIDE the horizon is spoken for elsewhere
// (dropped here). Unlocked steps flow around the pins in rank order,
// sharing one cursor across the horizon. (If a day has more pins than gaps,
// the overflow pins are dropped for that day — a rare over-lock.)
export function reflowPlan({
  rankedProjects, gapsByDate, excludeStepIds = new Set(),
  excludeGapStarts = new Set(),
}) {
  const queue = rankedStepQueue(rankedProjects, excludeStepIds);
  const horizonDates = new Set((gapsByDate ?? []).map((d) => d.dateISO));

  const pinnedByDate = new Map();
  const unlocked = [];
  for (const node of queue) {
    if (node.lockedDate) {
      if (!horizonDates.has(node.lockedDate)) continue; // another day
      const list = pinnedByDate.get(node.lockedDate) ?? [];
      list.push(node);
      pinnedByDate.set(node.lockedDate, list);
    } else {
      unlocked.push(node);
    }
  }

  const placements = [];
  let ui = 0; // shared cursor into the unlocked queue, across days
  for (const day of gapsByDate ?? []) {
    const dayPins = [...(pinnedByDate.get(day.dateISO) ?? [])];
    for (const gap of day.gaps ?? []) {
      // Conflict-awareness (Slice 7): flow around a gap where NOBODY is
      // free (both admins reserved) — don't schedule project work into a
      // window no one can work it. `who.freeCount` is projectGaps()'s
      // availability read; a missing `who` is treated as available.
      if (gap.who && gap.who.freeCount === 0) continue;
      // A gap the user cleared (removal tombstone) stays free today.
      if (excludeGapStarts.has(gap.startMin)) continue;
      let node = dayPins.shift();
      if (!node && ui < unlocked.length) { node = unlocked[ui]; ui += 1; }
      if (!node) continue; // no step for this gap — leave it free
      placements.push({
        dateISO: day.dateISO,
        gapStartMin: gap.startMin,
        gapEndMin: gap.endMin,
        ...node,
      });
    }
  }
  return placements;
}

// ── Staleness (derived) ───────────────────────────────────────────────
// A placement's identity: which step sits in which gap (date + start).
// Normalizing to this key lets us compare the would-be plan against the
// currently-committed placements regardless of list order.
export function placementKey(p) {
  return `${p.dateISO}|${p.gapStartMin}|${p.stepId}`;
}

export function planSignature(placements) {
  return (placements ?? []).map(placementKey).sort().join("\n");
}

// The schedule is stale when the freshly-planned placements differ from
// what's currently committed (extracted from the schedule deltas into the
// same {dateISO, gapStartMin, stepId} shape). Equal signatures → in sync.
export function isStale(plannedPlacements, committedPlacements) {
  return planSignature(plannedPlacements)
    !== planSignature(committedPlacements);
}

// ── Reconciliation (pure) ─────────────────────────────────────────────
// The idempotent diff that turns a fresh plan into a MINIMAL set of
// writes. `committedAuto` = the currently-committed AUTO placements (the
// reflow-managed ones). Manual placements + completed steps are excluded
// from BOTH the plan (via reflowPlan's excludeStepIds) and from
// committedAuto, so this never touches them — reflow flows around manual
// work, it doesn't clobber it. Anything present in both plan and committed
// is left as-is, so reflowing an unchanged schedule writes nothing.
//
//   reconcilePlan({ planned, committedAuto }) → { toPlace, toRemove }
//
// `toPlace`: planned placements not yet committed (insert these deltas).
// `toRemove`: committed auto placements no longer in the plan (delete) —
// including DUPLICATE copies of a placement that IS in the plan. Two
// devices can race the same auto-sync (their debounce timers reset on the
// same realtime events, so they fire in the same instant) and insert the
// same (step, gap) twice under different ids; without the dedupe the pair
// reads as permanently stale ("key" vs "key\nkey" signatures) while both
// toPlace and toRemove stay empty — the duplicate never heals. Keeping
// the LOWEST id is deliberate: every device computes the same survivor,
// so concurrent healers delete the same extra row, never both copies.
export function reconcilePlan({ planned = [], committedAuto = [] }) {
  const plannedKeys = new Set(planned.map(placementKey));
  const keepByKey = new Map(); // placementKey -> the surviving committed row
  const toRemove = [];
  for (const p of committedAuto) {
    const k = placementKey(p);
    const kept = keepByKey.get(k);
    if (!kept) { keepByKey.set(k, p); continue; }
    // Duplicate key — keep the lexically-smallest id, drop the other.
    if (String(p.id) < String(kept.id)) {
      keepByKey.set(k, p);
      toRemove.push(kept);
    } else {
      toRemove.push(p);
    }
  }
  for (const [k, p] of keepByKey) {
    if (!plannedKeys.has(k)) toRemove.push(p);
  }
  return {
    toPlace: planned.filter((p) => !keepByKey.has(placementKey(p))),
    toRemove,
  };
}
