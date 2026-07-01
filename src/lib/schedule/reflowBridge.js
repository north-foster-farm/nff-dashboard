// reflowBridge.js — translate between the `commitments` delta world and
// the pure reflow planner's placement shape (reflow.js). PURE + testable;
// no hooks, no I/O. The engine hook composes this with reflow.js + the
// data hooks.
//
// A placed project step is a commitment: source_type 'project_node',
// run_date = the day, clock_time = the gap's start "HH:MM", and
// source_ref = { project_id, step_id, ..., origin }. We place AT the gap's
// startMin, so gapStartMin === hmToMin(clock_time) — the committed shape
// maps straight back to the planner's { dateISO, gapStartMin, stepId }
// without needing segmentForStart.

const PROJECT = "project_node";

// "HH:MM" ⇄ minutes-of-day. Kept local so the bridge carries no import
// weight; matches the clock_time text the delta layer stores.
export function hmToMin(hm) {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

export function minToHM(min) {
  if (min == null || !Number.isFinite(min)) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// The reflow-managed (auto) placed steps on `dateISO`, in the planner's
// placement shape (+ the commitment `id`, needed to delete a stale one).
// Manual placements (origin absent/≠ 'auto') are intentionally excluded —
// reflow only owns what it wrote.
export function committedAutoPlacements(deltas, dateISO) {
  return (deltas ?? [])
    .filter((d) =>
      d.source_type === PROJECT
      && d.run_date === dateISO
      && d.source_ref?.origin === "auto")
    .map((d) => ({
      dateISO: d.run_date,
      gapStartMin: hmToMin(d.clock_time),
      stepId: d.source_ref?.step_id ?? null,
      projectId: d.source_ref?.project_id ?? null,
      id: d.id,
    }));
}

// Step ids the user placed BY HAND today (a project_node delta whose
// origin isn't 'auto'). The planner excludes these so reflow flows around
// deliberate/tandem placements instead of double-scheduling them.
export function manualPlacedStepIds(deltas, dateISO) {
  const out = new Set();
  for (const d of deltas ?? []) {
    if (d.source_type !== PROJECT || d.run_date !== dateISO) continue;
    if (d.source_ref?.origin === "auto") continue;
    if (d.source_ref?.step_id) out.add(d.source_ref.step_id);
  }
  return out;
}

// Turn a planner placement into the addProject(node, blockId, dates,
// clockTime) argument tuple — tagged origin:'auto' so reflow can reclaim
// it later. (The hook spreads this into the call.)
export function placementToAddArgs(p) {
  return [
    {
      projectId: p.projectId,
      stepId: p.stepId,
      title: p.title,
      projectTitle: p.projectTitle,
      origin: "auto",
    },
    null,            // blockId — project gaps ride clock_time, not a block
    [p.dateISO],     // dates
    minToHM(p.gapStartMin),
  ];
}
