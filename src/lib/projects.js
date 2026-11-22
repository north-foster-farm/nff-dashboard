import { parseISODate, formatISODate } from "./dates.js";

// projects.js — pure helpers for the Projects subsystem (Batch 22).
//
// Framework-free and side-effect-free, mirroring lib/chores.js and
// lib/placeStatus.js. Operates on the camelCase shapes the hooks
// expose (useProjects / useProject).
//
// Two responsibilities:
//   1. The completeness rule + its verbatim copy:
//        phases > 1  → milestones drive % ("x/y milestones reached")
//        phases == 1 → steps drive %      ("x/y steps complete")
//   2. The dependency date-shuffle: when a step's dates move and its
//      outgoing edges have shift_dependents, every transitive
//      dependent shifts by the same number of days.

// ── Queue membership ──────────────────────────────────────────────────
// The one activity model (0.6): a project is live work when it sits in
// the ranked queue and has neither been completed nor archived. The
// `status` column plays no part — it is vestigial, written by nothing
// since the 0041 rework, and two notions of status disagreeing on
// screen is F96 (06-04 audit).
export function isQueuedProject(project) {
  return project.queueState === "ranked"
    && !project.completedAt
    && !project.archivedAt;
}

// ── Day membership ────────────────────────────────────────────────────
// Whether a project belongs on ONE day's timeline. F16 (06-04 audit):
// an undated project, and one whose dates sit in the future, both
// rendered "All day · today" — because the old predicate treated a
// missing `startedAt` as "open on that side", i.e. started forever ago.
// A project earns a place on a day only by actually running on it.
export function projectRunsOnDay(project, dayISO) {
  return isQueuedProject(project)
    && !!project.startedAt
    && project.startedAt <= dayISO
    && (!project.targetDate || project.targetDate >= dayISO);
}

// ── Completion predicates ─────────────────────────────────────────────

export function stepDone(step) {
  return !!step.completedAt;
}

// A phase counts as a "milestone reached" when it's explicitly checked
// off, or when it has steps and every one of them is complete.
export function phaseDone(phase, steps) {
  if (phase.completedAt) return true;
  const own = steps.filter(s => s.phaseId === phase.id);
  return own.length > 0 && own.every(stepDone);
}

// ── The completeness rule ─────────────────────────────────────────────
//
// progressOf(phases, steps) → { pct, done, total, label } | null
//
//   phases > 1  → milestones drive the percentage.
//   phases == 1 → that phase's steps drive the percentage.
//   phases == 0 → null (nothing to measure yet).
//
// `pct` is 0..100 (integer). `label` is the verbatim roadmap copy.
export function progressOf(phases, steps) {
  if (!phases || phases.length === 0) return null;
  if (phases.length > 1) {
    const done = phases.filter(p => phaseDone(p, steps)).length;
    const total = phases.length;
    return {
      pct: Math.round((done / total) * 100),
      done,
      total,
      label: `${done}/${total} milestones reached`,
    };
  }
  // Single phase → steps drive the percentage.
  const own = steps.filter(s => s.phaseId === phases[0].id);
  if (own.length === 0) return null;
  const done = own.filter(stepDone).length;
  return {
    pct: Math.round((done / own.length) * 100),
    done,
    total: own.length,
    label: `${done}/${own.length} steps complete`,
  };
}

// ── Dependency date-shuffle ───────────────────────────────────────────

export function dayDelta(fromISO, toISO) {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function shiftISODate(iso, deltaDays) {
  const d = parseISODate(iso);
  if (!d || !deltaDays) return iso;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatISODate(d);
}

// Every step reachable from `stepId` by following shift_dependents
// edges (predecessor → dependent), excluding the starting step.
// Cycle-safe: a visited set guards traversal.
export function transitiveDependents(stepId, dependencies) {
  const out = new Set();
  const queue = [stepId];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const dep of dependencies) {
      if (dep.predecessorStepId !== cur || !dep.shiftDependents) continue;
      if (out.has(dep.dependentStepId) || dep.dependentStepId === stepId) {
        continue;
      }
      out.add(dep.dependentStepId);
      queue.push(dep.dependentStepId);
    }
  }
  return out;
}

// The date-shuffle plan for moving one step's dates.
//
//   computeDependentShifts({ steps, dependencies, stepId, deltaDays })
//     → [{ stepId, startDate, targetDate }]
//
// Each transitive dependent (over shift_dependents edges) gets both of
// its dates shifted by the same delta. Steps with no dates are left
// alone. The moved step itself is NOT in the result — the caller
// already knows its new dates.
export function computeDependentShifts({
  steps, dependencies, stepId, deltaDays,
}) {
  if (!deltaDays) return [];
  const targets = transitiveDependents(stepId, dependencies);
  const plan = [];
  for (const step of steps) {
    if (!targets.has(step.id)) continue;
    if (!step.startDate && !step.targetDate) continue;
    plan.push({
      stepId: step.id,
      startDate: step.startDate
        ? shiftISODate(step.startDate, deltaDays)
        : null,
      targetDate: step.targetDate
        ? shiftISODate(step.targetDate, deltaDays)
        : null,
    });
  }
  return plan;
}

// ── Small display helpers ─────────────────────────────────────────────

// "May 4" / "May 4 – Jun 12" / "by Jun 12" — how a step/phase/project
// date or range reads in a row.
export function formatDateRange(startISO, targetISO) {
  const fmt = (iso) => {
    const d = parseISODate(iso);
    return d
      ? d.toLocaleDateString("en-US", {
          month: "short", day: "numeric", timeZone: "UTC",
        })
      : null;
  };
  const start = startISO ? fmt(startISO) : null;
  const target = targetISO ? fmt(targetISO) : null;
  if (start && target) return `${start} – ${target}`;
  if (target) return `by ${target}`;
  if (start) return `from ${start}`;
  return null;
}

// Checklist rollup for a step: { done, total } across every checklist
// on the step. null when the step has no checklist items.
export function checklistRollup(step) {
  let done = 0;
  let total = 0;
  for (const cl of step.checklists ?? []) {
    for (const item of cl.items ?? []) {
      total += 1;
      if (item.doneAt) done += 1;
    }
  }
  return total === 0 ? null : { done, total };
}
