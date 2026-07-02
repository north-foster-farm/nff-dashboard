// Metrics & analytics engine tests (lib/metrics.js). Every expected
// number is hand-derived from the fixtures — e.g. stdDev([2,4,6]) uses
// the SAMPLE (n-1) denominator the code implements: variance =
// (4+0+4)/2 = 4, sd = 2. Time-dependent functions (todayISO,
// weeksTimeline, layingRate) run under fake timers pinned to
// 2026-07-02. Fixture shapes mirror useWeightSamples /
// useEggCollections / BatchMetrics ctx = { feedSchedules, feeds }.
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from "vitest";
import {
  CHICK_WEIGHT_LB,
  DEFAULT_EGG_WEIGHT_OZ,
  BATCH_STATES,
  mean,
  stdDev,
  coefficientOfVariation,
  todayISO,
  summarizeSample,
  summarizeSamples,
  averageDailyGain,
  uniformity,
  mortalityStats,
  feedConsumedForGroup,
  feedConversionRatio,
  weeksTimeline,
  henHousedProduction,
  layerFeedEfficiency,
  layingRate,
  bodyWeightTrend,
  fmtMetric,
  isLayerSpecies,
  isMeatSpecies,
  batchLifecycle,
} from "./metrics.js";

// ── fixtures ─────────────────────────────────────────────────────────

const GROUP = {
  id: "g1",
  label: "Batch 1",
  arrivalDate: "2026-06-01",
  count: 50,
};

function sample(sampledOn, weights) {
  return { id: `s-${sampledOn}`, sampledOn, weights };
}

function collection(collectedOn, count, avgEggWeightOz = null) {
  return { collectedOn, count, avgEggWeightOz };
}

function meteredStage(over = {}) {
  return {
    name: "Stage",
    startDay: 0,
    endDay: null,
    feedTypeId: "feed-a",
    consumption: { type: "metered", basis: "flock", amount: 10 },
    ...over,
  };
}

function scheduleFor(groupId, stages) {
  return { id: "sched-1", assignedGroupIds: [groupId], stages };
}

const FEED_A = {
  id: "feed-a", name: "Feed A", costPerUnit: { amount: 0.5 },
};

function pinTime(dateArgs = [2026, 6, 2, 10, 30]) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(...dateArgs)); // 2026-07-02 local
}

// ── constants ────────────────────────────────────────────────────────

describe("constants", () => {
  it("exports the chick-weight and default-egg-weight anchors", () => {
    expect(CHICK_WEIGHT_LB).toBe(0.09);
    expect(DEFAULT_EGG_WEIGHT_OZ).toBe(2.0);
  });
});

// ── stats helpers ────────────────────────────────────────────────────

describe("mean", () => {
  it("averages a list of numbers", () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it("returns null for an empty list", () => {
    expect(mean([])).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(mean(undefined)).toBeNull();
  });
});

describe("stdDev", () => {
  it("uses the sample (n-1) denominator", () => {
    // [2,4,6]: mean 4, variance (4+0+4)/2 = 4, sd 2. A population
    // (n) denominator would give sqrt(8/3) ≈ 1.633 instead.
    expect(stdDev([2, 4, 6])).toBeCloseTo(2, 10);
  });

  it("returns null with fewer than two values", () => {
    expect(stdDev([5])).toBeNull();
    expect(stdDev([])).toBeNull();
    expect(stdDev(undefined)).toBeNull();
  });

  it("is zero when every value is identical", () => {
    expect(stdDev([5, 5, 5])).toBe(0);
  });
});

describe("coefficientOfVariation", () => {
  it("returns sd/mean as a percentage", () => {
    // [4,5,6]: mean 5, sd 1 -> 20%.
    expect(coefficientOfVariation([4, 5, 6])).toBeCloseTo(20, 10);
  });

  it("returns null when the mean is zero (division guard)", () => {
    expect(coefficientOfVariation([-1, 1])).toBeNull();
  });

  it("returns null when sd is undefined (single value)", () => {
    expect(coefficientOfVariation([3])).toBeNull();
  });
});

// ── todayISO ─────────────────────────────────────────────────────────

describe("todayISO", () => {
  afterEach(() => vi.useRealTimers());

  it("formats the current local date as YYYY-MM-DD", () => {
    pinTime();
    expect(todayISO()).toBe("2026-07-02");
  });

  it("zero-pads single-digit months and days", () => {
    pinTime([2026, 0, 5, 8, 0]);
    expect(todayISO()).toBe("2026-01-05");
  });
});

// ── weight samples ───────────────────────────────────────────────────

describe("summarizeSample", () => {
  it("computes n, avg and cv from the weights array", () => {
    const out = summarizeSample(sample("2026-06-10", [4, 5, 6]));
    expect(out.n).toBe(3);
    expect(out.avg).toBeCloseTo(5, 10);
    expect(out.cv).toBeCloseTo(20, 10);
    expect(out.dateISO).toBe("2026-06-10");
    expect(out.id).toBe("s-2026-06-10");
  });

  it("drops non-numeric entries and coerces numeric strings", () => {
    const out = summarizeSample(sample("2026-06-10", [4, "5", "x", 6]));
    expect(out.weights).toEqual([4, 5, 6]);
    expect(out.n).toBe(3);
  });

  it("tolerates a non-array weights payload as an empty sample", () => {
    const out = summarizeSample(sample("2026-06-10", "garbage"));
    expect(out.n).toBe(0);
    expect(out.avg).toBeNull();
    expect(out.cv).toBeNull();
  });

  it("defaults unit to lb and notes to null", () => {
    const out = summarizeSample(sample("2026-06-10", [1]));
    expect(out.unit).toBe("lb");
    expect(out.notes).toBeNull();
    const oz = summarizeSample(
      { ...sample("2026-06-10", [16]), unit: "oz", notes: "hi" });
    expect(oz.unit).toBe("oz");
    expect(oz.notes).toBe("hi");
  });
});

describe("summarizeSamples", () => {
  it("sorts summaries oldest to newest by date", () => {
    const out = summarizeSamples([
      sample("2026-06-20", [2]),
      sample("2026-06-01", [1]),
      sample("2026-06-10", [1.5]),
    ]);
    expect(out.map(s => s.dateISO))
      .toEqual(["2026-06-01", "2026-06-10", "2026-06-20"]);
  });

  it("drops samples with no usable weights", () => {
    const out = summarizeSamples([
      sample("2026-06-01", []),
      sample("2026-06-10", [2]),
      sample("2026-06-15", ["junk"]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].dateISO).toBe("2026-06-10");
  });

  it("returns an empty array for null input", () => {
    expect(summarizeSamples(null)).toEqual([]);
  });
});

describe("averageDailyGain", () => {
  it("returns a caveat when there are no weigh-ins", () => {
    const out = averageDailyGain([], GROUP);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No weigh-ins/);
  });

  it("slopes first-to-latest averages across two samples", () => {
    // (2.0 - 1.0) / 10 days = 0.1 lb/day.
    const out = averageDailyGain([
      sample("2026-06-01", [1.0]),
      sample("2026-06-11", [2.0]),
    ], GROUP);
    expect(out.value).toBeCloseTo(0.1, 10);
    expect(out.basis).toBe("samples");
    expect(out.fromISO).toBe("2026-06-01");
    expect(out.toISO).toBe("2026-06-11");
    expect(out.caveats).toEqual([]);
  });

  it("refuses two samples taken on the same day", () => {
    const out = averageDailyGain([
      sample("2026-06-05", [1]),
      sample("2026-06-05", [2]),
    ], GROUP);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/same day/);
  });

  it("anchors a single sample to chick weight at arrival", () => {
    // (1.09 - 0.09) / 20 days = 0.05 lb/day.
    const out = averageDailyGain(
      [sample("2026-06-21", [1.09])],
      { arrivalDate: "2026-06-01" });
    expect(out.value).toBeCloseTo(0.05, 10);
    expect(out.basis).toBe("arrival_anchor");
    expect(out.fromISO).toBe("2026-06-01");
    expect(out.toISO).toBe("2026-06-21");
  });

  it("can't anchor one sample without an arrival date", () => {
    const out = averageDailyGain([sample("2026-06-21", [1])], {});
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/no arrival date/);
  });

  it("rejects a weigh-in on or before the arrival date", () => {
    const out = averageDailyGain(
      [sample("2026-06-01", [1])],
      { arrivalDate: "2026-06-01" });
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/on or before the arrival/);
  });
});

describe("uniformity", () => {
  it("returns a caveat when there are no weigh-ins", () => {
    const out = uniformity([]);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No weigh-ins/);
  });

  it("reads the CV of the latest sample with 5+ birds", () => {
    // [4,4,5,6,6]: mean 5, variance (1+1+0+1+1)/4 = 1, cv 20%.
    const out = uniformity([
      sample("2026-06-01", [1, 1, 1, 1, 1]),
      sample("2026-06-10", [4, 4, 5, 6, 6]),
    ]);
    expect(out.value).toBeCloseTo(20, 10);
    expect(out.dateISO).toBe("2026-06-10");
    expect(out.n).toBe(5);
    expect(out.caveats).toEqual([]);
  });

  it("still reports CV under 5 birds but caveats the sample size", () => {
    const out = uniformity([sample("2026-06-10", [4, 5, 6])]);
    expect(out.value).toBeCloseTo(20, 10);
    expect(out.caveats[0]).toMatch(/only 3 birds/);
  });

  it("uses singular 'bird' for a one-bird sample", () => {
    const out = uniformity([sample("2026-06-10", [4])]);
    expect(out.value).toBeNull(); // CV needs 2+ weights
    expect(out.caveats[0]).toMatch(/only 1 bird —/);
  });
});

// ── mortality ────────────────────────────────────────────────────────

describe("mortalityStats", () => {
  it("computes rate from placedCount and summed losses", () => {
    const out = mortalityStats(
      { placedCount: 100 },
      [{ count: 3 }, { count: 2 }]);
    expect(out.placed).toBe(100);
    expect(out.lost).toBe(5);
    expect(out.ratePct).toBeCloseTo(5, 10);
    expect(out.caveats).toEqual([]);
  });

  it("reconstructs placed = live + lost when placedCount is absent",
    () => {
      const out = mortalityStats({ count: 95 }, [{ count: 5 }]);
      expect(out.placed).toBe(100);
      expect(out.ratePct).toBeCloseTo(5, 10);
      expect(out.caveats[0]).toMatch(/No placed count/);
    });

  it("returns a null rate when there is nothing to divide by", () => {
    const out = mortalityStats({}, [{ count: 2 }]);
    expect(out.placed).toBeNull();
    expect(out.ratePct).toBeNull();
  });

  it("treats non-numeric event counts as zero", () => {
    const out = mortalityStats(
      { placedCount: 10 },
      [{ count: "oops" }, { count: 1 }]);
    expect(out.lost).toBe(1);
  });

  it("reports a 0% rate for a loss-free batch", () => {
    const out = mortalityStats({ placedCount: 10 }, []);
    expect(out.lost).toBe(0);
    expect(out.ratePct).toBe(0);
  });
});

// ── feed consumed ────────────────────────────────────────────────────

describe("feedConsumedForGroup", () => {
  it("returns zeros for a missing or inverted date window", () => {
    const ctx = { feedSchedules: [], feeds: [] };
    for (const [from, to] of [
      [null, "2026-06-10"],
      ["2026-06-10", "2026-06-10"],
      ["2026-06-11", "2026-06-10"],
    ]) {
      const out = feedConsumedForGroup(GROUP, from, to, ctx);
      expect(out.totalLb).toBe(0);
      expect(out.totalCost).toBeNull();
      expect(out.byFeed.size).toBe(0);
    }
  });

  it("integrates an ongoing flock-metered stage over the window", () => {
    // 10 lb/day x 10 days = 100 lb; 100 x $0.50 = $50.
    const ctx = {
      feedSchedules: [scheduleFor("g1", [meteredStage()])],
      feeds: [FEED_A],
    };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBeCloseTo(100, 10);
    expect(out.totalCost).toBeCloseTo(50, 10);
    expect(out.byFeed.get("feed-a")).toBeCloseTo(100, 10);
    expect(out.caveats).toEqual([]);
  });

  it("multiplies per-bird amounts by the live count", () => {
    // 0.3 lb/bird x 50 birds x 10 days = 150 lb.
    const stage = meteredStage({
      consumption: { type: "metered", basis: "bird", amount: 0.3 },
    });
    const ctx = { feedSchedules: [scheduleFor("g1", [stage])], feeds: [] };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBeCloseTo(150, 10);
  });

  it("clips day-ranged stages to the window and to each other", () => {
    // Arrival 06-01, window 06-01 -> 06-15 (14 days).
    // Starter [day 0, day 10): 10 days x 5 lb = 50 lb.
    // Grower [day 10, open): clipped to window end, 4 days x 8 = 32.
    const starter = meteredStage({
      name: "Starter", startDay: 0, endDay: 10, feedTypeId: "feed-a",
      consumption: { type: "metered", basis: "flock", amount: 5 },
    });
    const grower = meteredStage({
      name: "Grower", startDay: 10, endDay: null, feedTypeId: "feed-b",
      consumption: { type: "metered", basis: "flock", amount: 8 },
    });
    const ctx = {
      feedSchedules: [scheduleFor("g1", [starter, grower])],
      feeds: [
        FEED_A,
        { id: "feed-b", name: "Feed B", costPerUnit: { amount: 1 } },
      ],
    };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-15", ctx);
    expect(out.totalLb).toBeCloseTo(82, 10);
    expect(out.byFeed.get("feed-a")).toBeCloseTo(50, 10);
    expect(out.byFeed.get("feed-b")).toBeCloseTo(32, 10);
    // 50 x 0.5 + 32 x 1 = 57.
    expect(out.totalCost).toBeCloseTo(57, 10);
  });

  it("caveats day-ranged stages when the group has no arrival", () => {
    const stage = meteredStage({ name: "Starter", endDay: 10 });
    const ctx = { feedSchedules: [scheduleFor("g1", [stage])], feeds: [] };
    const group = { ...GROUP, arrivalDate: null };
    const out =
      feedConsumedForGroup(group, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBe(0);
    expect(out.caveats[0]).toMatch(/no arrival date/);
  });

  it("caveats tbd and free-choice stages instead of guessing", () => {
    const tbd = meteredStage({
      name: "Mystery", consumption: { type: "tbd" },
    });
    const free = meteredStage({
      name: "Oyster", consumption: { type: "free_choice" },
    });
    const ctx =
      { feedSchedules: [scheduleFor("g1", [tbd, free])], feeds: [] };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBe(0);
    expect(out.caveats).toHaveLength(2);
    expect(out.caveats[0]).toMatch(/Mystery: amounts aren't captured/);
    expect(out.caveats[1]).toMatch(/Oyster: free-choice/);
  });

  it("skips a stage entirely outside the window without caveats", () => {
    // Days [20, 30) vs a 14-day window: zero overlap, and the
    // stageDays === 0 short-circuit fires before the tbd caveat.
    const stage = meteredStage({
      name: "Later", startDay: 20, endDay: 30,
      consumption: { type: "tbd" },
    });
    const ctx = { feedSchedules: [scheduleFor("g1", [stage])], feeds: [] };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-15", ctx);
    expect(out.totalLb).toBe(0);
    expect(out.caveats).toEqual([]);
  });

  it("ignores schedules not assigned to the group", () => {
    const ctx = {
      feedSchedules: [scheduleFor("other-group", [meteredStage()])],
      feeds: [FEED_A],
    };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBe(0);
  });

  it("nulls the cost and caveats when a consumed feed is unpriced",
    () => {
      const ctx = {
        feedSchedules: [scheduleFor("g1", [meteredStage()])],
        feeds: [{ id: "feed-a", name: "Feed A", costPerUnit: null }],
      };
      const out =
        feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
      expect(out.totalLb).toBeCloseTo(100, 10);
      expect(out.totalCost).toBeNull();
      expect(out.caveats[0]).toMatch(/Feed A: no cost per unit/);
    });

  it("nulls the cost when no stage carries a feedTypeId", () => {
    const stage = meteredStage({ feedTypeId: null });
    const ctx = {
      feedSchedules: [scheduleFor("g1", [stage])], feeds: [FEED_A],
    };
    const out =
      feedConsumedForGroup(GROUP, "2026-06-01", "2026-06-11", ctx);
    expect(out.totalLb).toBeCloseTo(100, 10);
    expect(out.totalCost).toBeNull();
  });
});

// ── broiler metrics ──────────────────────────────────────────────────

describe("feedConversionRatio", () => {
  // Ongoing per-bird stage: 0.2 lb/bird/day x 50 birds = 10 lb/day.
  const perBird = meteredStage({
    consumption: { type: "metered", basis: "bird", amount: 0.2 },
  });
  const ctx = {
    feedSchedules: [scheduleFor("g1", [perBird])],
    feeds: [FEED_A],
  };

  it("divides projected feed by projected liveweight gain", () => {
    // Feed 06-01 -> 06-11: 10 x 10 = 100 lb. Gain: 50 birds x
    // (1.09 - 0.09) = 50 lb. FCR = 2. Cost 100 x 0.5 = $50.
    const out = feedConversionRatio(
      GROUP, [sample("2026-06-11", [1.09])], ctx);
    expect(out.value).toBeCloseTo(2, 10);
    expect(out.feedLb).toBeCloseTo(100, 10);
    expect(out.gainLb).toBeCloseTo(50, 10);
    expect(out.feedCost).toBeCloseTo(50, 10);
    expect(out.asOfISO).toBe("2026-06-11");
    expect(out.caveats).toEqual([]);
  });

  it("extends the feed window when asOfISO is passed", () => {
    // 20 days of feed (200 lb) over the same 50 lb gain -> FCR 4.
    const out = feedConversionRatio(
      GROUP, [sample("2026-06-11", [1.09])], ctx, "2026-06-21");
    expect(out.value).toBeCloseTo(4, 10);
    expect(out.asOfISO).toBe("2026-06-21");
  });

  it("returns a caveat with no weigh-ins", () => {
    const out = feedConversionRatio(GROUP, [], ctx);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No weigh-ins/);
  });

  it("returns a caveat with no arrival date", () => {
    const group = { ...GROUP, arrivalDate: null };
    const out =
      feedConversionRatio(group, [sample("2026-06-11", [1])], ctx);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No arrival date/);
  });

  it("nulls out when no metered feed can be projected", () => {
    const out = feedConversionRatio(
      GROUP, [sample("2026-06-11", [1.09])],
      { feedSchedules: [], feeds: [] });
    expect(out.value).toBeNull();
    expect(out.feedLb).toBe(0);
    expect(out.caveats[0]).toMatch(/No metered feed/);
  });

  it("nulls out when the group has no live count", () => {
    // Flock-metered feed so consumption survives the missing count
    // (a per-bird stage would zero out first and caveat differently).
    const flockCtx = {
      feedSchedules: [scheduleFor("g1", [meteredStage()])],
      feeds: [FEED_A],
    };
    const group = { ...GROUP, count: null };
    const out = feedConversionRatio(
      group, [sample("2026-06-11", [1.09])], flockCtx);
    expect(out.value).toBeNull();
    expect(out.feedLb).toBeCloseTo(100, 10);
    expect(out.caveats).toContain("No live count on the batch.");
  });

  it("refuses a latest average at or below chick weight", () => {
    const out = feedConversionRatio(
      GROUP, [sample("2026-06-11", [0.05])], ctx);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/at or below chick weight/);
  });
});

describe("weeksTimeline", () => {
  beforeEach(() => pinTime()); // today = 2026-07-02
  afterEach(() => vi.useRealTimers());

  it("returns caveated nulls without an arrival date", () => {
    const out = weeksTimeline({}, {}, null);
    expect(out.weeksOnFarm).toBeNull();
    expect(out.weeksRemaining).toBeNull();
    expect(out.caveats[0]).toMatch(/No arrival date/);
  });

  it("prefers a scheduled processing event as the end date", () => {
    // Arrival 06-11 -> 21 days on farm = 3 weeks; processing 07-16
    // is 14 days out = 2 weeks remaining.
    const out = weeksTimeline(
      { arrivalDate: "2026-06-11" },
      { targetProcessWeeks: 8 },
      "2026-07-16");
    expect(out.weeksOnFarm).toBeCloseTo(3, 10);
    expect(out.weeksRemaining).toBeCloseTo(2, 10);
    expect(out.endISO).toBe("2026-07-16");
    expect(out.basis).toBe("processing_event");
  });

  it("falls back to arrival + species target weeks", () => {
    // 06-11 + 8 weeks (56 days) = 08-06; 07-02 -> 08-06 is 35 days.
    const out = weeksTimeline(
      { arrivalDate: "2026-06-11" },
      { targetProcessWeeks: 8 },
      null);
    expect(out.endISO).toBe("2026-08-06");
    expect(out.basis).toBe("species_target");
    expect(out.weeksRemaining).toBeCloseTo(5, 10);
  });

  it("caveats when neither an event nor a target exists", () => {
    const out = weeksTimeline({ arrivalDate: "2026-06-11" }, {}, null);
    expect(out.weeksOnFarm).toBeCloseTo(3, 10);
    expect(out.weeksRemaining).toBeNull();
    expect(out.caveats[0]).toMatch(/No processing event/);
  });
});

// ── layer metrics ────────────────────────────────────────────────────

describe("henHousedProduction", () => {
  it("returns caveated null with no collections", () => {
    const out = henHousedProduction({ placedCount: 10 }, []);
    expect(out.value).toBeNull();
    expect(out.eggs).toBe(0);
    expect(out.caveats[0]).toMatch(/No egg collections/);
  });

  it("divides cumulative eggs by the placed count", () => {
    const out = henHousedProduction({ placedCount: 10 }, [
      collection("2026-06-01", 6),
      collection("2026-06-02", 8),
    ]);
    expect(out.value).toBeCloseTo(1.4, 10);
    expect(out.eggs).toBe(14);
    expect(out.placed).toBe(10);
    expect(out.caveats).toEqual([]);
  });

  it("falls back to the live count with an understating caveat", () => {
    const out = henHousedProduction({ count: 10 }, [
      collection("2026-06-01", 14),
    ]);
    expect(out.value).toBeCloseTo(1.4, 10);
    expect(out.caveats[0]).toMatch(/understates the denominator/);
  });

  it("nulls out when there is no placed or live count", () => {
    const out =
      henHousedProduction({}, [collection("2026-06-01", 5)]);
    expect(out.value).toBeNull();
    expect(out.eggs).toBe(5);
    expect(out.caveats[0]).toMatch(/No placed count/);
  });
});

describe("layerFeedEfficiency", () => {
  // Ongoing flock stage: 3 lb/day.
  const ctx = {
    feedSchedules: [scheduleFor("g1", [meteredStage({
      consumption: { type: "metered", basis: "flock", amount: 3 },
    })])],
    feeds: [FEED_A],
  };

  it("returns caveated nulls with no collections", () => {
    const out = layerFeedEfficiency(GROUP, [], ctx);
    expect(out.perDozen).toBeNull();
    expect(out.perLbEggMass).toBeNull();
    expect(out.caveats[0]).toMatch(/No egg collections/);
  });

  it("needs collections on more than one day", () => {
    const out = layerFeedEfficiency(GROUP, [
      collection("2026-06-01", 10),
      collection("2026-06-01", 12),
    ], ctx);
    expect(out.perDozen).toBeNull();
    expect(out.caveats[0]).toMatch(/one day/);
  });

  it("computes feed per dozen and per lb of egg mass", () => {
    // Window 06-01 -> 06-11 (10 days) x 3 lb/day = 30 lb feed.
    // 24 eggs: perDozen = 30 / 2 = 15. Mass: 12 x 2.5 oz + 12 x
    // 2.0 oz (default) = 54 oz = 3.375 lb -> 30 / 3.375 = 80/9.
    const out = layerFeedEfficiency(GROUP, [
      collection("2026-06-01", 12, 2.5),
      collection("2026-06-11", 12),
    ], ctx);
    expect(out.perDozen).toBeCloseTo(15, 10);
    expect(out.perLbEggMass).toBeCloseTo(80 / 9, 10);
    expect(out.feedLb).toBeCloseTo(30, 10);
    expect(out.eggs).toBe(24);
    expect(out.fromISO).toBe("2026-06-01");
    expect(out.toISO).toBe("2026-06-11");
  });

  it("caveats a schedule with no metered amounts", () => {
    const out = layerFeedEfficiency(GROUP, [
      collection("2026-06-01", 12),
      collection("2026-06-11", 12),
    ], { feedSchedules: [], feeds: [] });
    expect(out.perDozen).toBeNull();
    expect(out.caveats[0]).toMatch(/Manage feed/);
  });

  it("caveats zero eggs in the window but reports the feed", () => {
    const out = layerFeedEfficiency(GROUP, [
      collection("2026-06-01", 0),
      collection("2026-06-11", 0),
    ], ctx);
    expect(out.perDozen).toBeNull();
    expect(out.feedLb).toBeCloseTo(30, 10);
    expect(out.caveats).toContain("Zero eggs in the window.");
  });
});

describe("layingRate", () => {
  beforeEach(() => pinTime()); // today = 2026-07-02
  afterEach(() => vi.useRealTimers());

  it("returns caveated null with no collections", () => {
    const out = layingRate({ count: 10 }, []);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No egg collections/);
  });

  it("returns caveated null with no live count", () => {
    const out = layingRate({}, [collection("2026-07-01", 5)]);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/No live count/);
  });

  it("averages eggs per hen per day over the trailing window", () => {
    // Window = 06-18 -> 07-02. 14 eggs / 10 hens / 14 days = 0.1.
    const out = layingRate({ count: 10 }, [
      collection("2026-06-20", 7),
      collection("2026-06-25", 7),
    ]);
    expect(out.value).toBeCloseTo(0.1, 10);
    expect(out.eggs).toBe(14);
    expect(out.windowDays).toBe(14);
  });

  it("excludes collections before the window; the boundary day counts",
    () => {
      const out = layingRate({ count: 10 }, [
        collection("2026-06-01", 100), // before 06-18: excluded
        collection("2026-06-18", 7),   // boundary day: included
        collection("2026-06-25", 7),
      ]);
      expect(out.eggs).toBe(14);
      expect(out.value).toBeCloseTo(0.1, 10);
    });

  it("caveats when no eggs land inside the window", () => {
    const out = layingRate({ count: 10 }, [
      collection("2026-01-01", 40),
    ]);
    expect(out.value).toBeNull();
    expect(out.caveats[0]).toMatch(/last 14 days/);
  });
});

describe("bodyWeightTrend", () => {
  it("returns a caveated null trend with no weigh-ins", () => {
    const out = bodyWeightTrend([]);
    expect(out.trend).toBeNull();
    expect(out.flag).toBeNull();
    expect(out.caveats[0]).toMatch(/No weigh-ins/);
  });

  it("reports a baseline from a single weigh-in", () => {
    const out = bodyWeightTrend([sample("2026-06-01", [5])]);
    expect(out.trend).toBe("baseline");
    expect(out.latestAvg).toBe(5);
    expect(out.caveats[0]).toMatch(/Only one weigh-in/);
  });

  it("is stable at exactly zero change", () => {
    const out = bodyWeightTrend([
      sample("2026-06-01", [5]),
      sample("2026-06-10", [5]),
    ]);
    expect(out.trend).toBe("stable");
    expect(out.flag).toBeNull();
    expect(out.pctChange).toBe(0);
  });

  it("flags getting_fat at a +5% gain", () => {
    // 20 -> 21 is exactly +5%.
    const out = bodyWeightTrend([
      sample("2026-06-01", [20]),
      sample("2026-06-10", [21]),
    ]);
    expect(out.trend).toBe("gaining");
    expect(out.flag).toBe("getting_fat");
    expect(out.pctChange).toBeCloseTo(5, 10);
  });

  it("flags burning_reserves at a -2% loss", () => {
    // 50 -> 49 is exactly -2%.
    const out = bodyWeightTrend([
      sample("2026-06-01", [50]),
      sample("2026-06-10", [49]),
    ]);
    expect(out.trend).toBe("losing");
    expect(out.flag).toBe("burning_reserves");
    expect(out.pctChange).toBeCloseTo(-2, 10);
  });

  it("leaves small moves unflagged in either direction", () => {
    // 100 -> 101 (+1%) and 100 -> 99 (-1%).
    const up = bodyWeightTrend([
      sample("2026-06-01", [100]),
      sample("2026-06-10", [101]),
    ]);
    expect(up.trend).toBe("gaining");
    expect(up.flag).toBeNull();
    const down = bodyWeightTrend([
      sample("2026-06-01", [100]),
      sample("2026-06-10", [99]),
    ]);
    expect(down.trend).toBe("losing");
    expect(down.flag).toBeNull();
  });

  it("compares only the two most recent samples", () => {
    const out = bodyWeightTrend([
      sample("2026-06-01", [1]),
      sample("2026-06-10", [50]),
      sample("2026-06-20", [49]),
    ]);
    expect(out.prevAvg).toBe(50);
    expect(out.latestAvg).toBe(49);
    expect(out.fromISO).toBe("2026-06-10");
    expect(out.toISO).toBe("2026-06-20");
    expect(out.flag).toBe("burning_reserves");
  });
});

// ── display helpers ──────────────────────────────────────────────────

describe("fmtMetric", () => {
  it("renders an em dash for null and non-finite values", () => {
    expect(fmtMetric(null)).toBe("—");
    expect(fmtMetric(undefined)).toBe("—");
    expect(fmtMetric(NaN)).toBe("—");
    expect(fmtMetric(Infinity)).toBe("—");
  });

  it("rounds to two digits by default", () => {
    expect(fmtMetric(2.406)).toBe("2.41");
    expect(fmtMetric(2)).toBe("2.00");
  });

  it("renders zero as a number, not a dash", () => {
    expect(fmtMetric(0)).toBe("0.00");
  });

  it("appends the suffix and honors custom digits", () => {
    expect(fmtMetric(6.34, { digits: 1, suffix: "%" })).toBe("6.3%");
    expect(fmtMetric(0.144, { suffix: " lb/day" })).toBe("0.14 lb/day");
  });
});

describe("isLayerSpecies / isMeatSpecies", () => {
  it("matches on the purpose text, case-insensitively", () => {
    expect(isLayerSpecies({ purpose: "Eggs" })).toBe(true);
    expect(isMeatSpecies({ purpose: "MEAT birds" })).toBe(true);
    expect(isLayerSpecies({ purpose: "Meat" })).toBe(false);
    expect(isMeatSpecies({ purpose: "Eggs" })).toBe(false);
  });

  it("a dual-purpose species reads as both", () => {
    const dual = { purpose: "Eggs + meat" };
    expect(isLayerSpecies(dual)).toBe(true);
    expect(isMeatSpecies(dual)).toBe(true);
  });

  it("a missing species or purpose is neither", () => {
    expect(isLayerSpecies(undefined)).toBe(false);
    expect(isMeatSpecies({})).toBe(false);
  });
});

// ── batch lifecycle ──────────────────────────────────────────────────

describe("batchLifecycle", () => {
  const TODAY = "2026-07-02";

  it("exposes display config for all four states", () => {
    expect(Object.keys(BATCH_STATES).sort())
      .toEqual(["active", "arriving", "processed", "unknown"]);
    expect(BATCH_STATES.processed.label).toBe("Processed");
  });

  it("a past processing date wins even over a future arrival", () => {
    const out = batchLifecycle(
      { arrivalDate: "2026-07-10" }, "2026-06-30", TODAY);
    expect(out.state).toBe("processed");
    expect(out.processingISO).toBe("2026-06-30");
    expect(out.arrivalISO).toBe("2026-07-10");
  });

  it("processing day itself still counts as active", () => {
    const out = batchLifecycle(
      { arrivalDate: "2026-06-01" }, TODAY, TODAY);
    expect(out.state).toBe("active");
  });

  it("a future arrival with no processing reads as arriving", () => {
    const out = batchLifecycle(
      { arrivalDate: "2026-07-10" }, null, TODAY);
    expect(out.state).toBe("arriving");
    expect(out.arrivalISO).toBe("2026-07-10");
  });

  it("arrival day itself reads as active", () => {
    const out = batchLifecycle({ arrivalDate: TODAY }, null, TODAY);
    expect(out.state).toBe("active");
  });

  it("no arrival and no processing is unknown", () => {
    const out = batchLifecycle({}, null, TODAY);
    expect(out.state).toBe("unknown");
    expect(out.arrivalISO).toBeNull();
  });
});
