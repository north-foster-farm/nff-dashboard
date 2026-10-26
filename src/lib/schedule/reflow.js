// reflow.js — the ranked project queue (PURE).
//
// The forced-ranked project list, flattened to the step queue the
// Schedule's manual "add next task" quick-add and the Now surface read.
// Framework-free + side-effect-free, mirroring projects.js / chores.js.
//
// "Ranked" is the queue model — queue_state === 'ranked', not completed,
// not archived — ordered by sort_order. Dates are light-touch metadata,
// never scheduled on; only the rank orders work.
//
// (Round 5 — NO-LEGACY) The auto-seeding reflow PLANNER that used to fill
// the day's project gaps from this queue is retired — see the note above
// nextRankedStep.

import { isQueuedProject } from "../projects.js";

// ── The ranked project queue (new model) ──────────────────────────────
// Ranked, actionable projects in priority order. Dates are intentionally
// ignored (scheduling on them would defeat the forced ranking).
export function rankedActiveProjects(projects) {
  return (projects ?? [])
    .filter(isQueuedProject)
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

// (Round 5 — NO-LEGACY) The reflow PLANNER is retired: auto-seeding the
// day's gaps was dropped in favor of the manual "add next task" quick-add,
// which reads the same ranked queue above. reflowPlan / placementKey /
// planSignature / isStale / reconcilePlan and the useScheduleReflow hook
// + reflowBridge were deleted with it.

// The next highest-priority incomplete step across the ranked projects —
// what the quick-add grabs (round 5). `excludeStepIds` = steps already
// placed on the day.
export function nextRankedStep(projects, excludeStepIds = new Set()) {
  return rankedStepQueue(
    rankedActiveProjects(projects), excludeStepIds)[0] ?? null;
}
