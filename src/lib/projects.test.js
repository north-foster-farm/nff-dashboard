// Projects subsystem pure helpers (Batch 22; forced-ranked-priority
// rework context in ROADMAP.md "Projects rework"). Covers the one
// activity model (0.6: queue membership + day membership), the
// completeness rule (phases>1 -> milestones; phases==1 -> steps), and
// the dependency date-shuffle.
import { describe, it, expect } from "vitest";
import {
  projectRunsOnDay, stepDone, phaseDone,
  progressOf, dayDelta, shiftISODate, transitiveDependents,
  computeDependentShifts, formatDateRange, checklistRollup,
} from "./projects.js";

describe("projectRunsOnDay", () => {
  const today = "2026-06-01";
  const queued = (over = {}) => ({
    queueState: "ranked", completedAt: null, archivedAt: null, ...over,
  });

  it("keeps undated and not-yet-started projects off the day (F16)", () => {
    const undatedProject = queued();
    const startsNextMonth = queued({ startedAt: "2026-07-01" });
    expect(projectRunsOnDay(undatedProject, today)).toBe(false);
    expect(projectRunsOnDay(startsNextMonth, today)).toBe(false);
  });

  it("runs from its startedAt until its targetDate, both inclusive", () => {
    const runsThisWeek = queued({
      startedAt: "2026-05-30", targetDate: "2026-06-02",
    });
    const endedYesterday = queued({
      startedAt: "2026-05-01", targetDate: "2026-05-31",
    });
    expect(projectRunsOnDay(runsThisWeek, today)).toBe(true);
    expect(projectRunsOnDay(endedYesterday, today)).toBe(false);
  });

  it("takes activity from the queue, not from the legacy status column", () => {
    const runningToday = { startedAt: "2026-05-30", targetDate: "2026-06-02" };
    const stillInTheQueue = queued(runningToday);
    const unprioritized = queued({ ...runningToday, queueState: "unprioritized" });
    const finished = queued({ ...runningToday, completedAt: "2026-05-31" });
    const archived = queued({ ...runningToday, archivedAt: "2026-05-31" });
    const legacyStatusOnly = { ...runningToday, status: "planned" };
    expect(projectRunsOnDay(stillInTheQueue, today)).toBe(true);
    expect(projectRunsOnDay(unprioritized, today)).toBe(false);
    expect(projectRunsOnDay(finished, today)).toBe(false);
    expect(projectRunsOnDay(archived, today)).toBe(false);
    expect(projectRunsOnDay(legacyStatusOnly, today)).toBe(false);
  });
});

function step(over = {}) {
  return { id: "s1", title: "Frame the walls", sortOrder: 0, completedAt: null, ...over };
}

describe("stepDone / phaseDone", () => {
  it("stepDone reflects completedAt presence", () => {
    expect(stepDone(step({ completedAt: "2026-06-01" }))).toBe(true);
    expect(stepDone(step({ completedAt: null }))).toBe(false);
  });

  it("phaseDone is true when explicitly checked off, regardless of its steps", () => {
    expect(phaseDone({ id: "ph1", completedAt: "2026-06-01" }, [])).toBe(true);
  });

  it("phaseDone is true when it HAS steps and every one is complete", () => {
    const steps = [
      step({ id: "s1", phaseId: "ph1", completedAt: "x" }),
      step({ id: "s2", phaseId: "ph1", completedAt: "x" }),
    ];
    expect(phaseDone({ id: "ph1", completedAt: null }, steps)).toBe(true);
  });

  it("phaseDone is false when it has steps but at least one is incomplete", () => {
    const steps = [
      step({ id: "s1", phaseId: "ph1", completedAt: "x" }),
      step({ id: "s2", phaseId: "ph1", completedAt: null }),
    ];
    expect(phaseDone({ id: "ph1" }, steps)).toBe(false);
  });

  it("phaseDone is FALSE for an empty phase (no own steps, not explicitly checked) — an empty phase is never 'reached'", () => {
    expect(phaseDone({ id: "ph1", completedAt: null }, [])).toBe(false);
  });
});

describe("progressOf — the completeness rule (phases>1 -> milestones; phases==1 -> steps)", () => {
  it("returns null with zero phases (nothing to measure yet)", () => {
    expect(progressOf([], [])).toBeNull();
    expect(progressOf(null, [])).toBeNull();
  });

  it("multiple phases: percentage + label are driven by MILESTONES (phases reached), not steps", () => {
    const phases = [
      { id: "ph1", completedAt: "x" },
      { id: "ph2", completedAt: null },
    ];
    const steps = []; // irrelevant when phases > 1
    const r = progressOf(phases, steps);
    expect(r).toEqual({ pct: 50, done: 1, total: 2, label: "1/2 milestones reached" });
  });

  it("a single phase: percentage + label are driven by that phase's STEPS, not milestone status", () => {
    const phases = [{ id: "ph1", completedAt: null }]; // not explicitly checked off
    const steps = [
      step({ id: "s1", phaseId: "ph1", completedAt: "x" }),
      step({ id: "s2", phaseId: "ph1", completedAt: null }),
    ];
    const r = progressOf(phases, steps);
    expect(r).toEqual({ pct: 50, done: 1, total: 2, label: "1/2 steps complete" });
  });

  it("a single phase with ZERO own steps returns null (nothing to measure, even though phases.length===1)", () => {
    expect(progressOf([{ id: "ph1" }], [])).toBeNull();
  });

  it("rounds the percentage to the nearest whole number", () => {
    const phases = [{ id: "ph1", completedAt: "x" }, { id: "ph2" }, { id: "ph3" }];
    const r = progressOf(phases, []);
    expect(r.pct).toBe(Math.round((1 / 3) * 100)); // 33
  });

  it("a single phase's steps only count steps belonging to THAT phase (filters by phaseId)", () => {
    const phases = [{ id: "ph1" }];
    const steps = [
      step({ id: "s1", phaseId: "ph1", completedAt: "x" }),
      step({ id: "s2", phaseId: "OTHER-PHASE", completedAt: null }), // must not count
    ];
    const r = progressOf(phases, steps);
    expect(r).toEqual({ pct: 100, done: 1, total: 1, label: "1/1 steps complete" });
  });
});

describe("dayDelta / shiftISODate", () => {
  it("dayDelta computes whole days between two ISO dates (positive = forward)", () => {
    expect(dayDelta("2026-06-01", "2026-06-05")).toBe(4);
    expect(dayDelta("2026-06-05", "2026-06-01")).toBe(-4);
    expect(dayDelta("2026-06-01", "2026-06-01")).toBe(0);
  });

  it("dayDelta returns 0 for unparseable input rather than NaN", () => {
    expect(dayDelta(null, "2026-06-01")).toBe(0);
    expect(dayDelta("garbage", "2026-06-01")).toBe(0);
  });

  it("shiftISODate moves a date forward/backward by whole days", () => {
    expect(shiftISODate("2026-06-01", 4)).toBe("2026-06-05");
    expect(shiftISODate("2026-06-05", -4)).toBe("2026-06-01");
  });

  it("shiftISODate rolls over a month boundary correctly", () => {
    expect(shiftISODate("2026-06-28", 5)).toBe("2026-07-03");
  });

  it("shiftISODate with deltaDays 0 (or falsy) returns the original string unchanged", () => {
    expect(shiftISODate("2026-06-01", 0)).toBe("2026-06-01");
  });
});

describe("transitiveDependents", () => {
  it("follows a chain of shift_dependents edges (predecessor -> dependent)", () => {
    const deps = [
      { predecessorStepId: "a", dependentStepId: "b", shiftDependents: true },
      { predecessorStepId: "b", dependentStepId: "c", shiftDependents: true },
    ];
    expect(transitiveDependents("a", deps)).toEqual(new Set(["b", "c"]));
  });

  it("stops at an edge whose shiftDependents flag is false", () => {
    const deps = [{ predecessorStepId: "a", dependentStepId: "b", shiftDependents: false }];
    expect(transitiveDependents("a", deps)).toEqual(new Set());
  });

  it("excludes the starting step even if a cycle routes back to it", () => {
    const deps = [
      { predecessorStepId: "a", dependentStepId: "b", shiftDependents: true },
      { predecessorStepId: "b", dependentStepId: "a", shiftDependents: true }, // cycle back
    ];
    const out = transitiveDependents("a", deps);
    expect(out.has("a")).toBe(false);
    expect(out.has("b")).toBe(true);
  });

  it("is cycle-safe (never infinite-loops on a longer cycle)", () => {
    const deps = [
      { predecessorStepId: "a", dependentStepId: "b", shiftDependents: true },
      { predecessorStepId: "b", dependentStepId: "c", shiftDependents: true },
      { predecessorStepId: "c", dependentStepId: "a", shiftDependents: true },
    ];
    expect(() => transitiveDependents("a", deps)).not.toThrow();
    expect(transitiveDependents("a", deps)).toEqual(new Set(["b", "c"]));
  });

  it("returns an empty set for a step with no dependents", () => {
    expect(transitiveDependents("lonely", [])).toEqual(new Set());
  });
});

describe("computeDependentShifts", () => {
  it("shifts every transitive dependent's dates by deltaDays", () => {
    const steps = [
      { id: "b", startDate: "2026-06-10", targetDate: "2026-06-15" },
      { id: "c", startDate: "2026-06-20", targetDate: null },
    ];
    const deps = [
      { predecessorStepId: "a", dependentStepId: "b", shiftDependents: true },
      { predecessorStepId: "b", dependentStepId: "c", shiftDependents: true },
    ];
    const plan = computeDependentShifts({ steps, dependencies: deps, stepId: "a", deltaDays: 3 });
    expect(plan).toEqual(expect.arrayContaining([
      { stepId: "b", startDate: "2026-06-13", targetDate: "2026-06-18" },
      { stepId: "c", startDate: "2026-06-23", targetDate: null },
    ]));
    expect(plan).toHaveLength(2);
  });

  it("never includes the moved step itself in the plan", () => {
    const steps = [{ id: "a", startDate: "2026-06-01", targetDate: null }];
    const deps = [{ predecessorStepId: "x", dependentStepId: "a", shiftDependents: true }];
    // "a" is the moved step; even if some OTHER edge points at it, the
    // caller already knows its own new dates.
    const plan = computeDependentShifts({ steps, dependencies: deps, stepId: "a", deltaDays: 3 });
    expect(plan.find((p) => p.stepId === "a")).toBeUndefined();
  });

  it("skips a dependent step with NEITHER startDate nor targetDate (nothing to shift)", () => {
    const steps = [{ id: "b", startDate: null, targetDate: null }];
    const deps = [{ predecessorStepId: "a", dependentStepId: "b", shiftDependents: true }];
    const plan = computeDependentShifts({ steps, dependencies: deps, stepId: "a", deltaDays: 3 });
    expect(plan).toEqual([]);
  });

  it("returns [] immediately when deltaDays is 0/falsy (no move happened)", () => {
    const steps = [{ id: "b", startDate: "2026-06-10", targetDate: "2026-06-15" }];
    const deps = [{ predecessorStepId: "a", dependentStepId: "b", shiftDependents: true }];
    expect(computeDependentShifts({ steps, dependencies: deps, stepId: "a", deltaDays: 0 })).toEqual([]);
  });

  it("a step reachable but NOT actually present in `steps` is silently skipped (no throw)", () => {
    const deps = [{ predecessorStepId: "a", dependentStepId: "ghost", shiftDependents: true }];
    expect(() => computeDependentShifts({ steps: [], dependencies: deps, stepId: "a", deltaDays: 3 }))
      .not.toThrow();
  });
});

describe("formatDateRange", () => {
  it("renders 'Start – Target' when both are set", () => {
    expect(formatDateRange("2026-05-04", "2026-06-12")).toBe("May 4 – Jun 12");
  });

  it("renders 'by Target' when only targetISO is set", () => {
    expect(formatDateRange(null, "2026-06-12")).toBe("by Jun 12");
  });

  it("renders 'from Start' when only startISO is set", () => {
    expect(formatDateRange("2026-05-04", null)).toBe("from May 4");
  });

  it("returns null when neither date is set", () => {
    expect(formatDateRange(null, null)).toBeNull();
  });
});

describe("checklistRollup", () => {
  it("sums done/total across every checklist on the step", () => {
    const s = {
      checklists: [
        { items: [{ doneAt: "x" }, { doneAt: null }] },
        { items: [{ doneAt: "x" }] },
      ],
    };
    expect(checklistRollup(s)).toEqual({ done: 2, total: 3 });
  });

  it("returns null when the step has no checklist items at all (not {done:0,total:0})", () => {
    expect(checklistRollup({ checklists: [] })).toBeNull();
    expect(checklistRollup({})).toBeNull();
    expect(checklistRollup({ checklists: [{ items: [] }] })).toBeNull();
  });
});
