// reflow.js — the ranked project queue (round 5 model; the auto-seeding
// PLANNER was retired in batch 42.4 — see the NO-LEGACY note in the
// source file. Only the pure queue-derivation functions remain, and
// they're what the Schedule's "Add next task" quick-add and the Now
// surface read, so a silent regression here is a silent regression in
// two live UI affordances.)
import { describe, it, expect } from "vitest";
import {
  rankedActiveProjects, rankedStepQueue, nextRankedStep,
} from "./reflow.js";

function project(over = {}) {
  return {
    id: "p1",
    title: "Build the coop",
    queueState: "ranked",
    completedAt: null,
    archivedAt: null,
    sortOrder: 0,
    steps: [],
    ...over,
  };
}

function step(over = {}) {
  return {
    id: "s1",
    title: "Frame the walls",
    sortOrder: 0,
    completedAt: null,
    lockedDate: null,
    ...over,
  };
}

describe("rankedActiveProjects", () => {
  it("keeps only queueState:ranked, not completed, not archived", () => {
    const projects = [
      project({ id: "a", queueState: "ranked" }),
      project({ id: "b", queueState: "unprioritized" }),
      project({ id: "c", queueState: "ranked", completedAt: "2026-01-01" }),
      project({ id: "d", queueState: "ranked", archivedAt: "2026-01-01" }),
    ];
    const out = rankedActiveProjects(projects);
    expect(out.map((p) => p.id)).toEqual(["a"]);
  });

  it("sorts by sortOrder ascending", () => {
    const projects = [
      project({ id: "second", sortOrder: 5 }),
      project({ id: "first", sortOrder: 1 }),
      project({ id: "third", sortOrder: 9 }),
    ];
    const out = rankedActiveProjects(projects);
    expect(out.map((p) => p.id)).toEqual(["first", "second", "third"]);
  });

  it("treats a missing sortOrder as 0 (stable-ish, no crash)", () => {
    const projects = [
      project({ id: "a", sortOrder: undefined }),
      project({ id: "b", sortOrder: -1 }),
    ];
    const out = rankedActiveProjects(projects);
    expect(out.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("handles null/undefined input without throwing", () => {
    expect(rankedActiveProjects(null)).toEqual([]);
    expect(rankedActiveProjects(undefined)).toEqual([]);
    expect(rankedActiveProjects([])).toEqual([]);
  });
});

describe("rankedStepQueue", () => {
  it("flattens in project-rank then step-sort order (P1's steps, then P2's)", () => {
    const projects = rankedActiveProjects([
      project({
        id: "p1", sortOrder: 0,
        steps: [
          step({ id: "p1s2", sortOrder: 2 }),
          step({ id: "p1s1", sortOrder: 1 }),
        ],
      }),
      project({
        id: "p2", sortOrder: 1,
        steps: [step({ id: "p2s1", sortOrder: 0 })],
      }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q.map((s) => s.stepId)).toEqual(["p1s1", "p1s2", "p2s1"]);
  });

  it("excludes completed steps", () => {
    const projects = rankedActiveProjects([
      project({
        steps: [
          step({ id: "done", completedAt: "2026-01-01" }),
          step({ id: "todo" }),
        ],
      }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q.map((s) => s.stepId)).toEqual(["todo"]);
  });

  it("excludes stepIds passed in excludeStepIds (already placed on the day)", () => {
    const projects = rankedActiveProjects([
      project({
        steps: [step({ id: "s1" }), step({ id: "s2" })],
      }),
    ]);
    const q = rankedStepQueue(projects, new Set(["s1"]));
    expect(q.map((s) => s.stepId)).toEqual(["s2"]);
  });

  it("a project with zero steps contributes nothing (no crash on missing steps)", () => {
    const projects = rankedActiveProjects([
      project({ id: "empty", steps: undefined }),
      project({ id: "full", sortOrder: 1, steps: [step()] }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q).toHaveLength(1);
    expect(q[0].projectId).toBe("full");
  });

  it("each queue entry carries projectId/projectTitle/stepId/title", () => {
    const projects = rankedActiveProjects([
      project({ id: "p1", title: "Coop", steps: [step({ id: "s1", title: "Frame" })] }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q[0]).toEqual({
      projectId: "p1", projectTitle: "Coop",
      stepId: "s1", title: "Frame", lockedDate: null,
    });
  });

  it("effective lockedDate: step's own lock wins over the project's", () => {
    const projects = rankedActiveProjects([
      project({
        lockedDate: "2026-09-01",
        steps: [step({ id: "s1", lockedDate: "2026-08-01" })],
      }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q[0].lockedDate).toBe("2026-08-01");
  });

  it("effective lockedDate falls back to the project's lock when the step has none", () => {
    const projects = rankedActiveProjects([
      project({
        lockedDate: "2026-09-01",
        steps: [step({ id: "s1", lockedDate: null })],
      }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q[0].lockedDate).toBe("2026-09-01");
  });

  it("effective lockedDate is null when neither step nor project is locked", () => {
    const projects = rankedActiveProjects([
      project({ lockedDate: null, steps: [step({ lockedDate: null })] }),
    ]);
    const q = rankedStepQueue(projects);
    expect(q[0].lockedDate).toBeNull();
  });
});

describe("nextRankedStep", () => {
  it("returns the single highest-priority incomplete step across all ranked projects", () => {
    const projects = [
      project({
        id: "p1", sortOrder: 0,
        steps: [step({ id: "s1", sortOrder: 0 }), step({ id: "s2", sortOrder: 1 })],
      }),
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s3" })] }),
    ];
    const next = nextRankedStep(projects);
    expect(next.stepId).toBe("s1");
  });

  it("skips a fully-placed top project and grabs the next project's step", () => {
    const projects = [
      project({ id: "p1", sortOrder: 0, steps: [step({ id: "s1" })] }),
      project({ id: "p2", sortOrder: 1, steps: [step({ id: "s2" })] }),
    ];
    const next = nextRankedStep(projects, new Set(["s1"]));
    expect(next.stepId).toBe("s2");
  });

  it("returns null when every ranked project's steps are exhausted", () => {
    const projects = [
      project({ steps: [step({ id: "s1", completedAt: "2026-01-01" })] }),
    ];
    expect(nextRankedStep(projects)).toBeNull();
  });

  it("returns null when there are no ranked projects at all", () => {
    expect(nextRankedStep([])).toBeNull();
    expect(nextRankedStep(null)).toBeNull();
  });

  it("never returns a step from an Unprioritized-bucket project (queueState !== ranked)", () => {
    const projects = [
      project({ id: "backlog", queueState: "unprioritized", sortOrder: -999, steps: [step({ id: "s1" })] }),
    ];
    expect(nextRankedStep(projects)).toBeNull();
  });

  it("never returns a step from a completed or archived project even if ranked", () => {
    const projects = [
      project({ id: "done", completedAt: "2026-01-01", steps: [step({ id: "s1" })] }),
      project({ id: "archived", archivedAt: "2026-01-01", steps: [step({ id: "s2" })] }),
    ];
    expect(nextRankedStep(projects)).toBeNull();
  });
});
