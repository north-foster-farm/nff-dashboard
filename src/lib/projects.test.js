// Projects subsystem pure helpers (Batch 22; forced-ranked-priority
// rework context in ROADMAP.md "Projects rework"). Covers the
// completeness rule (phases>1 -> milestones; phases==1 -> steps), the
// Schedule auto-pull (nextProjectStep — BD11: never changes global
// sort_order, display-only), and the dependency date-shuffle.
import { describe, it, expect } from "vitest";
import {
  isActiveProject, nextProjectStep, nextProjectStepFor, stepDone, phaseDone,
  progressOf, dayDelta, shiftISODate, transitiveDependents,
  computeDependentShifts, formatDateRange, checklistRollup, newProjectFields,
} from "./projects.js";

describe("isActiveProject", () => {
  it("is false once status is 'completed', regardless of dates", () => {
    expect(isActiveProject({ status: "completed" }, "2026-06-01")).toBe(false);
  });

  it("is true with no startedAt/targetDate bounds at all (open on both sides)", () => {
    expect(isActiveProject({ status: "planned" }, "2026-06-01")).toBe(true);
  });

  it("excludes a project that hasn't started yet (startedAt is in the future)", () => {
    expect(isActiveProject({ status: "planned", startedAt: "2026-07-01" }, "2026-06-01")).toBe(false);
  });

  it("includes a project starting exactly today (inclusive boundary)", () => {
    expect(isActiveProject({ status: "planned", startedAt: "2026-06-01" }, "2026-06-01")).toBe(true);
  });

  it("excludes a project whose targetDate has already passed", () => {
    expect(isActiveProject({ status: "planned", targetDate: "2026-05-01" }, "2026-06-01")).toBe(false);
  });

  it("includes a project targeting exactly today (inclusive boundary)", () => {
    expect(isActiveProject({ status: "planned", targetDate: "2026-06-01" }, "2026-06-01")).toBe(true);
  });
});

function project(over = {}) {
  return { id: "p1", title: "Build the coop", status: "planned", sortOrder: 0, steps: [], ...over };
}
function step(over = {}) {
  return { id: "s1", title: "Frame the walls", sortOrder: 0, completedAt: null, ...over };
}

describe("nextProjectStep — the Schedule auto-pull default occupant", () => {
  it("picks the LOWEST-sortOrder active project's next incomplete step", () => {
    const projects = [
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s2" })] }),
      project({ id: "p1", sortOrder: 0, steps: [step({ id: "s1" })] }),
    ];
    const node = nextProjectStep(projects, "2026-06-01");
    expect(node).toEqual({ projectId: "p1", projectTitle: "Build the coop", stepId: "s1", title: "Frame the walls" });
  });

  it("skips a completed project's steps and falls to the next active one", () => {
    const projects = [
      project({ id: "p1", sortOrder: 0, status: "completed", steps: [step({ id: "s1" })] }),
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s2" })] }),
    ];
    expect(nextProjectStep(projects, "2026-06-01").projectId).toBe("p2");
  });

  it("skips a top project with ZERO incomplete steps and falls to the next one", () => {
    const projects = [
      project({ id: "p1", sortOrder: 0, steps: [step({ id: "s1", completedAt: "2026-05-01" })] }),
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s2" })] }),
    ];
    expect(nextProjectStep(projects, "2026-06-01").projectId).toBe("p2");
  });

  it("returns null when no active project has any incomplete step", () => {
    expect(nextProjectStep([], "2026-06-01")).toBeNull();
    const allDone = [project({ steps: [step({ completedAt: "2026-05-01" })] })];
    expect(nextProjectStep(allDone, "2026-06-01")).toBeNull();
  });

  it("never touches sortOrder — it's purely a read (BD11: display-only, no schedule-driven priority change)", () => {
    const projects = [
      project({ id: "p1", sortOrder: 5, steps: [step()] }),
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s2" })] }),
    ];
    nextProjectStep(projects, "2026-06-01");
    expect(projects[0].sortOrder).toBe(5);
    expect(projects[1].sortOrder).toBe(1);
  });
});

describe("nextProjectStepFor — one project's next step (the 'Continue project' substrate)", () => {
  it("returns the lowest-sortOrder incomplete step", () => {
    const p = project({
      steps: [step({ id: "s2", sortOrder: 1 }), step({ id: "s1", sortOrder: 0 })],
    });
    expect(nextProjectStepFor(p).stepId).toBe("s1");
  });

  it("excludes steps already placed today via excludeStepIds", () => {
    const p = project({ steps: [step({ id: "s1" }), step({ id: "s2", sortOrder: 1 })] });
    expect(nextProjectStepFor(p, new Set(["s1"])).stepId).toBe("s2");
  });

  it("returns null for a null project or a project with no remaining steps", () => {
    expect(nextProjectStepFor(null)).toBeNull();
    expect(nextProjectStepFor(project({ steps: [] }))).toBeNull();
  });
});

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

// The create invariants (0.7): every new project row — whether typed
// on the Projects page or promoted from an inbox thought — gets a
// unique slug, an explicit bucket, and a queue position that never
// claims the top of the ranked list by surprise.
describe("newProjectFields", () => {
  const existingProjects = [
    { slug: "build-the-coop", queueState: "ranked", sortOrder: 4 },
    { slug: "fence-the-pasture", queueState: "ranked", sortOrder: 9 },
  ];

  it("slugs the title, suffixing past a slug already taken", () => {
    const titleOfAnExistingProject = "Build the coop";
    const fields = newProjectFields({
      title: titleOfAnExistingProject, projects: existingProjects,
    });
    expect(fields.slug).toBe("build-the-coop-2");
  });

  it("joins the ranked queue at the tail, never the top", () => {
    const lastRankedSortOrder = 9;
    const fields = newProjectFields({
      title: "Rebuild the farm stand",
      queueState: "ranked",
      projects: existingProjects,
    });
    expect(fields.sortOrder).toBe(lastRankedSortOrder + 1);
  });

  it("ignores archived, completed and unranked rows when finding the tail", () => {
    const projectsWithHighSortOrdersThatDoNotCount = [
      ...existingProjects,
      { slug: "old-barn", queueState: "ranked", sortOrder: 50,
        archivedAt: "2026-01-01" },
      { slug: "sold-birds", queueState: "ranked", sortOrder: 60,
        completedAt: "2026-02-01" },
      { slug: "someday-orchard", queueState: "unprioritized", sortOrder: 70 },
    ];
    const fields = newProjectFields({
      title: "Rebuild the farm stand",
      queueState: "ranked",
      projects: projectsWithHighSortOrdersThatDoNotCount,
    });
    expect(fields.sortOrder).toBe(10);
  });

  it("keeps an unprioritized project out of the ranked ordering", () => {
    const fields = newProjectFields({
      title: "Rebuild the farm stand",
      queueState: "unprioritized",
      projects: existingProjects,
    });
    expect(fields.queueState).toBe("unprioritized");
    expect(fields.sortOrder).toBe(0);
  });

  it("trims the title and empties a blank description to null", () => {
    const fields = newProjectFields({
      title: "  Rebuild the farm stand  ",
      description: "   ",
      projects: [],
    });
    expect(fields.title).toBe("Rebuild the farm stand");
    expect(fields.description).toBeNull();
  });

  it("refuses a title that is blank once trimmed", () => {
    expect(() => newProjectFields({ title: "   ", projects: [] }))
      .toThrow(/title required/i);
  });
});
