// The Schedule's one day-assembler (S3): rollupChoresForDay, deriveDay,
// and the delta-folding seam (S6). See story-set.md Epic A/B/I and BD17-20
// (the draft is regenerable reference data, never authored content; a
// delta that points at a source no longer emitted must be skipped, never
// throw — "the derive-and-fold merge is the feature's richest bug surface").
import { describe, it, expect } from "vitest";
import {
  rollupChoresForDay, todaysMorningCutoff, getRollupAssignee, deriveDay,
} from "./deriveDay.js";

const d = (y, m, day, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

function fixedBlock(id, name, startMinutes, durationMinutes = 60) {
  return { id, name, startKind: "fixed", startMinutes, durationMinutes, isActive: true };
}
const MORNING = fixedBlock("morning", "Morning", 6 * 60);
const EVENING = fixedBlock("evening", "Evening", 18 * 60);
const BLOCKS = [MORNING, EVENING];

function dailyChore(id, over = {}) {
  return {
    id, title: id,
    frequency: { type: "daily" },
    deadline: { kind: "midnight" },
    ...over,
  };
}

describe("rollupChoresForDay", () => {
  it("buckets chore instances by blockId and attaches the resolved block + startMin", () => {
    const defs = [
      dailyChore("m1", { blockId: "morning" }),
      dailyChore("m2", { blockId: "morning" }),
      dailyChore("e1", { blockId: "evening" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = rollupChoresForDay(data, d(2026, 6, 1), { blocks: BLOCKS });
    const byBucket = Object.fromEntries(out.map((r) => [r.bucket, r]));
    expect(byBucket.morning.items).toHaveLength(2);
    expect(byBucket.morning.block).toBe(MORNING);
    expect(byBucket.morning.startMin).toBe(6 * 60);
    expect(byBucket.evening.items).toHaveLength(1);
  });

  it("chores with no blockId fall into the 'anytime' bucket with a null block/startMin", () => {
    const defs = [dailyChore("free", { blockId: undefined })];
    const data = { chores: { definitions: defs } };
    const out = rollupChoresForDay(data, d(2026, 6, 1), { blocks: BLOCKS });
    const anytime = out.find((r) => r.bucket === "anytime");
    expect(anytime.items).toHaveLength(1);
    expect(anytime.block).toBeNull();
    expect(anytime.startMin).toBeNull();
  });

  it("a chore whose blockId doesn't match any real block still buckets by that raw id (block=null)", () => {
    const defs = [dailyChore("orphan", { blockId: "deleted-block" })];
    const data = { chores: { definitions: defs } };
    const out = rollupChoresForDay(data, d(2026, 6, 1), { blocks: BLOCKS });
    const orphan = out.find((r) => r.bucket === "deleted-block");
    expect(orphan).toBeDefined();
    expect(orphan.block).toBeNull();
  });

  it("a day with nothing due returns an empty array, not an error", () => {
    const defs = [dailyChore("mon-only", { frequency: { type: "weekly", days: [1] } })];
    const data = { chores: { definitions: defs } };
    // Pick a Tuesday.
    const out = rollupChoresForDay(data, d(2026, 6, 2), { blocks: BLOCKS });
    expect(out).toEqual([]);
  });

  it("degrades gracefully with no blocks in ruleOpts (empty blocks array)", () => {
    const defs = [dailyChore("free", { blockId: undefined })];
    const data = { chores: { definitions: defs } };
    expect(() => rollupChoresForDay(data, d(2026, 6, 1), {})).not.toThrow();
  });
});

describe("todaysMorningCutoff", () => {
  it("returns the morning block's resolved start minutes when morning chores exist", () => {
    const defs = [dailyChore("m1", { blockId: "morning", startTime: "06:00" })];
    const data = { chores: { definitions: defs } };
    // getBlockStartMinutesForPeriod looks up a block literally named
    // "morning" (case-insensitive) in the blocks list first.
    const cutoff = todaysMorningCutoff(data, d(2026, 6, 1), BLOCKS, { blocks: BLOCKS });
    expect(cutoff).toBe(6 * 60);
  });
});

describe("getRollupAssignee", () => {
  it("returns the shared name when every assigned chore resolves to the same single person", () => {
    const rollup = {
      bucket: "morning",
      items: [
        { chore: { id: "a", assignment: { default: "James" } } },
        { chore: { id: "b", assignment: { default: "James" } } },
      ],
    };
    expect(getRollupAssignee(rollup, d(2026, 6, 1), {})).toBe("James");
  });

  it("returns null when assignees differ across the block's chores", () => {
    const rollup = {
      bucket: "morning",
      items: [
        { chore: { id: "a", assignment: { default: "James" } } },
        { chore: { id: "b", assignment: { default: "Jim" } } },
      ],
    };
    expect(getRollupAssignee(rollup, d(2026, 6, 1), {})).toBeNull();
  });

  it("ignores unassigned chores when checking for a shared single assignee", () => {
    const rollup = {
      bucket: "morning",
      items: [
        { chore: { id: "a", assignment: { default: "James" } } },
        { chore: { id: "b" } }, // unassigned
      ],
    };
    expect(getRollupAssignee(rollup, d(2026, 6, 1), {})).toBe("James");
  });

  it("returns null when the block is entirely unassigned (S90 — a valid state, not an error)", () => {
    const rollup = { bucket: "morning", items: [{ chore: { id: "a" } }] };
    expect(getRollupAssignee(rollup, d(2026, 6, 1), {})).toBeNull();
  });
});

describe("deriveDay — event folding (S17, round-5 zero-width-range regression pin)", () => {
  it("surfaces an event whose start time is NOT midnight (the fixed dayUTC..dayEnd window)", () => {
    const dayISO = "2026-06-06";
    const dayUTC = new Date(Date.UTC(2026, 5, 6));
    const data = {
      chores: { definitions: [] },
      events: {
        kinds: [{
          id: "market", label: "Markets",
          instances: [{
            id: "s1", label: "Scituate Rotary Farmers Market",
            rrule: null, dtstart: null,
            occurrences: [{ id: "o1", occursOn: dayISO, startTime: "13:15", endTime: "16:15" }],
          }],
        }],
      },
      projects: [],
    };
    const out = deriveDay({
      data, dayDate: d(2026, 6, 6), dayUTC, dayISO, ruleOpts: { blocks: [] },
    });
    expect(out.events).toHaveLength(1);
    expect(out.events[0].startTime).toBe("13:15");
  });

  it("excludes an event that lands on a different day even though it's in the same series", () => {
    const dayISO = "2026-06-06";
    const dayUTC = new Date(Date.UTC(2026, 5, 6));
    const data = {
      chores: { definitions: [] },
      events: {
        kinds: [{
          id: "market", label: "Markets",
          instances: [{
            id: "s1", label: "Market",
            rrule: "FREQ=WEEKLY;BYDAY=SA", dtstart: "2026-06-06T13:15:00Z",
            durationMinutes: 180, occurrences: [],
          }],
        }],
      },
      projects: [],
    };
    const out = deriveDay({
      data, dayDate: d(2026, 6, 13), dayUTC: new Date(Date.UTC(2026, 5, 13)),
      dayISO: "2026-06-13", ruleOpts: { blocks: [] },
    });
    // Asking for June 13 (also a Saturday, also a real occurrence) should
    // show ONLY that day's occurrence, not June 6's.
    expect(out.events.every((e) => e.date === "2026-06-13")).toBe(true);
  });
});

describe("deriveDay — active project folding", () => {
  it("includes a project active on the day and excludes a completed one", () => {
    const dayISO = "2026-06-06";
    const data = {
      chores: { definitions: [] },
      events: { kinds: [] },
      projects: [
        { id: "p1", status: "planned" },
        { id: "p2", status: "completed" },
      ],
    };
    const out = deriveDay({
      data, dayDate: d(2026, 6, 6), dayUTC: new Date(Date.UTC(2026, 5, 6)),
      dayISO, ruleOpts: { blocks: [] },
    });
    expect(out.projects.map((p) => p.id)).toEqual(["p1"]);
  });

  it("excludes a project whose startedAt is still in the future", () => {
    const dayISO = "2026-06-06";
    const data = {
      chores: { definitions: [] },
      events: { kinds: [] },
      projects: [{ id: "p1", status: "planned", startedAt: "2026-07-01" }],
    };
    const out = deriveDay({
      data, dayDate: d(2026, 6, 6), dayUTC: new Date(Date.UTC(2026, 5, 6)),
      dayISO, ruleOpts: { blocks: [] },
    });
    expect(out.projects).toEqual([]);
  });
});

describe("deriveDay -> foldDeltas — the delta-folding seam (S6, BD17-20)", () => {
  const baseData = () => ({
    chores: { definitions: [dailyChore("m1", { blockId: "morning" })] },
    events: { kinds: [] },
    projects: [],
  });
  const call = (deltas) => deriveDay({
    data: baseData(),
    dayDate: d(2026, 6, 1),
    dayUTC: new Date(Date.UTC(2026, 5, 1)),
    dayISO: "2026-06-01",
    ruleOpts: { blocks: BLOCKS },
    deltas,
  });

  it("with no deltas, every rollup still gets an empty extras array (never undefined)", () => {
    const out = call([]);
    expect(out.choreRollups.every((r) => Array.isArray(r.extras))).toBe(true);
    expect(out.choreRollups.find((r) => r.bucket === "morning").extras).toEqual([]);
  });

  it("an ad-hoc delta targeting an existing block's bucket folds into that block's extras", () => {
    const delta = { id: "d1", source_type: "ad_hoc", block_id: "morning" };
    const out = call([delta]);
    const morning = out.choreRollups.find((r) => r.bucket === "morning");
    expect(morning.extras).toEqual([delta]);
  });

  it("a delta targeting a block with NO chores today still creates a rollup for it (round-trip visibility)", () => {
    const delta = { id: "d1", source_type: "ad_hoc", block_id: "evening" };
    const out = call([delta]);
    const evening = out.choreRollups.find((r) => r.bucket === "evening");
    expect(evening).toBeDefined();
    expect(evening.items).toEqual([]);
    expect(evening.extras).toEqual([delta]);
    expect(evening.block).toBe(EVENING);
  });

  it("a delta whose block_id doesn't match any real block routes to 'anytime' (orphan-tolerant, BD contract)", () => {
    const delta = { id: "d1", source_type: "ad_hoc", block_id: "long-deleted-block" };
    expect(() => call([delta])).not.toThrow();
    const out = call([delta]);
    const anytime = out.choreRollups.find((r) => r.bucket === "anytime");
    expect(anytime.extras).toEqual([delta]);
  });

  it("a delta with no block_id at all defaults to 'anytime'", () => {
    const delta = { id: "d1", source_type: "note" };
    const out = call([delta]);
    const anytime = out.choreRollups.find((r) => r.bucket === "anytime");
    expect(anytime.extras).toEqual([delta]);
  });

  it("source_ref.block_id is honored when block_id itself is null (the chore_run placement path)", () => {
    const delta = { id: "d1", source_type: "ad_hoc", block_id: null, source_ref: { block_id: "evening" } };
    const out = call([delta]);
    const evening = out.choreRollups.find((r) => r.bucket === "evening");
    expect(evening.extras).toEqual([delta]);
  });

  it("'override' deltas are excluded from extras entirely (applied at the row level elsewhere)", () => {
    const delta = { id: "d1", source_type: "override", block_id: "morning" };
    const out = call([delta]);
    const morning = out.choreRollups.find((r) => r.bucket === "morning");
    expect(morning.extras).toEqual([]);
  });

  it("'reservation' deltas never fold as extras (non-work time, never a phantom '(task)' row)", () => {
    const delta = { id: "d1", source_type: "reservation", block_id: "morning" };
    const out = call([delta]);
    expect(out.choreRollups.every((r) => r.extras.length === 0)).toBe(true);
  });

  it("'buffer' deltas never fold as extras", () => {
    const delta = { id: "d1", source_type: "buffer", block_id: "morning" };
    const out = call([delta]);
    expect(out.choreRollups.every((r) => r.extras.length === 0)).toBe(true);
  });

  it("multiple deltas in the same bucket all fold in, in the order given", () => {
    const deltas = [
      { id: "d1", source_type: "ad_hoc", block_id: "morning" },
      { id: "d2", source_type: "note", block_id: "morning" },
    ];
    const out = call(deltas);
    const morning = out.choreRollups.find((r) => r.bucket === "morning");
    expect(morning.extras.map((x) => x.id)).toEqual(["d1", "d2"]);
  });
});
