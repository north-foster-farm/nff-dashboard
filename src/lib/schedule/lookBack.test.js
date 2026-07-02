// Looking-back / routine-drift engine (S11 / Epic L — S116/S117/S119/S120).
// S120 is load-bearing here: "History is for learning the routine, not
// grading a person — no per-person scorecards." Every test below asserts
// the OUTPUT SHAPE never carries a per-person field, not just the values.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { blockStartDrift, dayReviews } from "./lookBack.js";

// Freeze "now" so blockStartDrift's internal `new Date()` cutoff is
// deterministic — 2026-06-20, splitDays=14 -> cutoff = 2026-06-06.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

function run(over = {}) {
  return { blockId: "morning", runDate: "2026-06-20", startedAt: new Date(2026, 5, 20, 6, 30), ...over };
}

const MORNING_BLOCK = { id: "morning", name: "Morning" };
const EVENING_BLOCK = { id: "evening", name: "Evening" };

describe("blockStartDrift", () => {
  it("splits runs into recent (>= cutoff) vs prior (< cutoff) buckets", () => {
    const runs = [
      run({ runDate: "2026-06-19", startedAt: new Date(2026, 5, 19, 6, 30) }), // recent (>= Jun6)
      run({ runDate: "2026-06-01", startedAt: new Date(2026, 5, 1, 7, 0) }),   // prior (< Jun6)
    ];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].samples).toBe(2);
    expect(out[0].recentAvg).toBe(6 * 60 + 30);
    expect(out[0].priorAvg).toBe(7 * 60);
  });

  it("a run dated EXACTLY on the cutoff day counts as recent (inclusive)", () => {
    const runs = [run({ runDate: "2026-06-06", startedAt: new Date(2026, 5, 6, 8, 0) })];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].recentAvg).toBe(8 * 60);
    expect(out[0].priorAvg).toBeNull();
  });

  it("deltaMin is positive when the recent average is LATER than the prior (the drift we're spotting)", () => {
    const runs = [
      run({ runDate: "2026-06-19", startedAt: new Date(2026, 5, 19, 7, 0) }), // recent: 7:00
      run({ runDate: "2026-06-01", startedAt: new Date(2026, 5, 1, 6, 0) }),  // prior: 6:00
    ];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].deltaMin).toBe(60); // an hour later -> positive drift
  });

  it("deltaMin is negative when the block is trending EARLIER (improving)", () => {
    const runs = [
      run({ runDate: "2026-06-19", startedAt: new Date(2026, 5, 19, 6, 0) }),
      run({ runDate: "2026-06-01", startedAt: new Date(2026, 5, 1, 7, 0) }),
    ];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].deltaMin).toBe(-60);
  });

  it("deltaMin is null when only ONE bucket has samples (nothing to compare against yet)", () => {
    const runs = [run({ runDate: "2026-06-19", startedAt: new Date(2026, 5, 19, 6, 0) })];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].deltaMin).toBeNull();
  });

  it("ignores runs with no startedAt (never started)", () => {
    const runs = [run({ startedAt: null })];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out).toEqual([]);
  });

  it("a block with zero started runs anywhere in range is omitted from the output", () => {
    const out = blockStartDrift([], [MORNING_BLOCK, EVENING_BLOCK], 14);
    expect(out).toEqual([]);
  });

  it("output order + labels follow the `blocks` list, not the runs' arrival order", () => {
    const runs = [
      run({ blockId: "evening", startedAt: new Date(2026, 5, 19, 20, 0) }),
      run({ blockId: "morning", startedAt: new Date(2026, 5, 19, 6, 0) }),
    ];
    const out = blockStartDrift(runs, [MORNING_BLOCK, EVENING_BLOCK], 14);
    expect(out.map((b) => b.name)).toEqual(["Morning", "Evening"]);
  });

  it("averages multiple same-bucket runs (not just the last one)", () => {
    const runs = [
      run({ runDate: "2026-06-19", startedAt: new Date(2026, 5, 19, 6, 0) }),
      run({ runDate: "2026-06-18", startedAt: new Date(2026, 5, 18, 7, 0) }),
    ];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    expect(out[0].recentAvg).toBe((6 * 60 + 7 * 60) / 2);
  });

  it("respects a custom splitDays window", () => {
    // splitDays=1 -> cutoff = 2026-06-19; a run dated 2026-06-18 is now "prior".
    const runs = [run({ runDate: "2026-06-18", startedAt: new Date(2026, 5, 18, 6, 0) })];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 1);
    expect(out[0].priorAvg).not.toBeNull();
    expect(out[0].recentAvg).toBeNull();
  });

  it("S120 pinned: the output never carries a per-person/assignee field of any kind", () => {
    const runs = [run()];
    const out = blockStartDrift(runs, [MORNING_BLOCK], 14);
    const keys = Object.keys(out[0]);
    expect(keys).not.toContain("assignee");
    expect(keys).not.toContain("person");
    expect(keys.sort()).toEqual(
      ["blockId", "deltaMin", "name", "priorAvg", "recentAvg", "samples"].sort());
  });

  it("handles an empty blocks list and an empty runs list without throwing", () => {
    expect(() => blockStartDrift([], [], 14)).not.toThrow();
    expect(blockStartDrift([], [], 14)).toEqual([]);
    expect(blockStartDrift([run()], undefined, 14)).toEqual([]);
  });
});

describe("dayReviews", () => {
  function capture(over = {}) {
    return {
      subject_id: "2026-06-19",
      doc: { blocks: [1, 2, 3], entries: [1, 2, 3, 4, 5], confirmed_at: "2026-06-19T06:00:00Z" },
      ...over,
    };
  }

  it("returns one review per confirmed day with planned counts from the capture doc", () => {
    const out = dayReviews([capture()], []);
    expect(out[0]).toMatchObject({ date: "2026-06-19", plannedBlocks: 3, plannedEntries: 5 });
  });

  it("counts ranBlocks as only the runs whose state is 'done' that date", () => {
    const runs = [
      { runDate: "2026-06-19", state: "done" },
      { runDate: "2026-06-19", state: "done" },
      { runDate: "2026-06-19", state: "canceled" },
      { runDate: "2026-06-18", state: "done" }, // a different day, must not count
    ];
    const out = dayReviews([capture()], runs);
    expect(out[0].ranBlocks).toBe(2);
  });

  it("dedupes multiple captures for the same day, keeping the FIRST (newest, per readCaptures order)", () => {
    const captures = [
      capture({ doc: { blocks: [1, 2], entries: [1], confirmed_at: "2026-06-19T10:00:00Z" } }), // newest, listed first
      capture({ doc: { blocks: [1], entries: [1], confirmed_at: "2026-06-19T06:00:00Z" } }), // older duplicate
    ];
    const out = dayReviews(captures, []);
    expect(out).toHaveLength(1);
    expect(out[0].plannedBlocks).toBe(2);
    expect(out[0].confirmedAt).toBe("2026-06-19T10:00:00Z");
  });

  it("falls back to doc.date when subject_id is missing", () => {
    const out = dayReviews([capture({ subject_id: null, doc: { date: "2026-06-19", blocks: [], entries: [] } })], []);
    expect(out[0].date).toBe("2026-06-19");
  });

  it("skips a capture with no resolvable date at all", () => {
    const out = dayReviews([capture({ subject_id: null, doc: {} })], []);
    expect(out).toEqual([]);
  });

  it("a day with no runs at all still produces a review (ranBlocks: 0, not omitted)", () => {
    const out = dayReviews([capture()], []);
    expect(out[0].ranBlocks).toBe(0);
  });

  it("handles missing/empty captures and empty runs without throwing", () => {
    // `runs` is always an array in practice (useRunHistory shapes
    // `rows ?? []`), so only captures needs the null tolerance.
    expect(dayReviews([], [])).toEqual([]);
    expect(dayReviews(null, [])).toEqual([]);
    expect(() => dayReviews([capture()], [])).not.toThrow();
  });

  it("S120 pinned: the output never carries a per-person/assignee field of any kind", () => {
    const out = dayReviews([capture()], []);
    const keys = Object.keys(out[0]);
    expect(keys).not.toContain("assignee");
    expect(keys).not.toContain("person");
    expect(keys.sort()).toEqual(
      ["confirmedAt", "date", "plannedBlocks", "plannedEntries", "ranBlocks"].sort());
  });
});
