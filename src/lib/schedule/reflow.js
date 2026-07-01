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
//      (pins an item to a day; the plan flows around it — layered on in a
//      later slice, see LOCKS below).
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
// completedAt); the loader hydrates them.
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
// LOCKS (deferred to a later slice): a project/phase/step with a
// `locked_date` should pin to that day and jump the queue, with the plan
// flowing around it. The signature below is lock-ready (excludeStepIds +
// pre-seeded placements), but this first cut is pure rank-fill.
export function reflowPlan({
  rankedProjects, gapsByDate, excludeStepIds = new Set(),
}) {
  const queue = rankedStepQueue(rankedProjects, excludeStepIds);
  const placements = [];
  let qi = 0;
  for (const day of gapsByDate ?? []) {
    for (const gap of day.gaps ?? []) {
      if (qi >= queue.length) return placements;
      const node = queue[qi];
      qi += 1;
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
// `toRemove`: committed auto placements no longer in the plan (delete).
export function reconcilePlan({ planned = [], committedAuto = [] }) {
  const plannedKeys = new Set(planned.map(placementKey));
  const committedKeys = new Set(committedAuto.map(placementKey));
  return {
    toPlace: planned.filter((p) => !committedKeys.has(placementKey(p))),
    toRemove: committedAuto.filter((p) => !plannedKeys.has(placementKey(p))),
  };
}
