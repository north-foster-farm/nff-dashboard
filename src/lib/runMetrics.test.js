// Performance sub-tab metrics (chore-run timing accountability).
// The domain rule these helpers embody: accountability is about TIME —
// late starts and overruns against the block's nominal window — never
// per-person comparison. Sun-event blocks resolve against each run's
// own run_date, so old runs are judged by THAT day's sunrise/sunset.
import { describe, it, expect } from "vitest";
import {
  runStartMinutes, runEndMinutes, runDurationMinutes,
  nominalStartMinutes, nominalEndMinutes, runIsLate,
  runOverrunMinutes, runOverran, summarizeRuns, histogramBins,
  median, quantile, formatHourLabel, formatMinutesShort,
  formatDurationMinutes, formatRate,
} from "./runMetrics.js";
import { sunMinutesOfDay } from "./sunTimes.js";

// camelCase run shape from useRunHistory / useChoreRuns.
function run(over = {}) {
  return {
    state: "done",
    runDate: "2026-06-20",
    startedAt: new Date(2026, 5, 20, 6, 0),
    endedAt: new Date(2026, 5, 20, 6, 45),
    ...over,
  };
}

// camelCase block shape from useChoreBlocks. Fixed 6:00 AM, one hour.
const FIXED_BLOCK = {
  id: "morning",
  startKind: "fixed",
  startMinutes: 360,
  durationMinutes: 60,
};

const SUNRISE_BLOCK = {
  id: "dawn",
  startKind: "sunrise",
  startMinutes: null,
  durationMinutes: 90,
};

describe("runStartMinutes / runEndMinutes", () => {
  it("converts the started stamp to minutes-of-day", () => {
    expect(runStartMinutes(run())).toBe(6 * 60);
    expect(runEndMinutes(run())).toBe(6 * 60 + 45);
  });

  it("wraps a past-midnight end back to minutes-of-day (0..1439)", () => {
    const r = run({ endedAt: new Date(2026, 5, 21, 0, 20) });
    expect(runEndMinutes(r)).toBe(20);
  });

  it("returns null for a missing, non-Date, or invalid stamp", () => {
    expect(runStartMinutes(run({ startedAt: null }))).toBeNull();
    expect(runStartMinutes(run({ startedAt: "2026-06-20T06:00" })))
      .toBeNull();
    expect(runStartMinutes(run({ startedAt: new Date(NaN) }))).toBeNull();
    expect(runEndMinutes(run({ endedAt: null }))).toBeNull();
    expect(runStartMinutes(null)).toBeNull();
  });
});

describe("runDurationMinutes", () => {
  it("is the wall-clock length in whole minutes (floored)", () => {
    const r = run({
      startedAt: new Date(2026, 5, 20, 6, 0, 0),
      endedAt: new Date(2026, 5, 20, 6, 45, 30),
    });
    expect(runDurationMinutes(r)).toBe(45);
  });

  it("crosses midnight correctly (ms math, not minutes-of-day)", () => {
    const r = run({
      startedAt: new Date(2026, 5, 20, 23, 50),
      endedAt: new Date(2026, 5, 21, 0, 20),
    });
    expect(runDurationMinutes(r)).toBe(30);
  });

  it("is 0 for an instant run, null when end precedes start", () => {
    const t = new Date(2026, 5, 20, 6, 0);
    expect(runDurationMinutes(run({ startedAt: t, endedAt: t }))).toBe(0);
    expect(runDurationMinutes(run({
      startedAt: new Date(2026, 5, 20, 7, 0),
      endedAt: new Date(2026, 5, 20, 6, 0),
    }))).toBeNull();
  });

  it("is null when either stamp is missing", () => {
    expect(runDurationMinutes(run({ endedAt: null }))).toBeNull();
    expect(runDurationMinutes(run({ startedAt: null }))).toBeNull();
  });
});

describe("nominalStartMinutes / nominalEndMinutes", () => {
  it("a fixed block resolves to its startMinutes regardless of date", () => {
    expect(nominalStartMinutes(FIXED_BLOCK, run())).toBe(360);
    expect(nominalStartMinutes(FIXED_BLOCK, run({
      runDate: "2026-12-20",
    }))).toBe(360);
  });

  it("end = start + durationMinutes (missing duration counts as 0)", () => {
    expect(nominalEndMinutes(FIXED_BLOCK, run())).toBe(420);
    const noDur = { ...FIXED_BLOCK, durationMinutes: undefined };
    expect(nominalEndMinutes(noDur, run())).toBe(360);
  });

  it("a block that ends past midnight keeps an unwrapped end (>1440)", () => {
    const late = { ...FIXED_BLOCK, startMinutes: 1430, durationMinutes: 60 };
    expect(nominalEndMinutes(late, run())).toBe(1490);
  });

  it("a sunrise block resolves against the RUN's date, not today", () => {
    const r = run();
    const thatNoon = new Date(2026, 5, 20, 12, 0, 0, 0);
    expect(nominalStartMinutes(SUNRISE_BLOCK, r))
      .toBe(sunMinutesOfDay(thatNoon, "sunrise"));
  });

  it("the same sunrise block lands differently in June vs December", () => {
    const june = nominalStartMinutes(SUNRISE_BLOCK, run());
    const dec = nominalStartMinutes(SUNRISE_BLOCK, run({
      runDate: "2026-12-20",
    }));
    expect(june).not.toBeNull();
    expect(dec).not.toBeNull();
    expect(june).not.toBe(dec);
  });

  it("returns null for a missing block, missing or garbled runDate", () => {
    expect(nominalStartMinutes(null, run())).toBeNull();
    expect(nominalStartMinutes(FIXED_BLOCK, run({ runDate: null })))
      .toBeNull();
    expect(nominalStartMinutes(FIXED_BLOCK, run({ runDate: "garbage" })))
      .toBeNull();
    expect(nominalEndMinutes(FIXED_BLOCK, run({ runDate: null })))
      .toBeNull();
  });

  it("a fixed block with no startMinutes resolves to null", () => {
    const bare = { startKind: "fixed", startMinutes: null };
    expect(nominalStartMinutes(bare, run())).toBeNull();
  });
});

describe("runIsLate", () => {
  it("is true only for a start strictly AFTER nominal — on the dot " +
     "is on time", () => {
    expect(runIsLate(run({
      startedAt: new Date(2026, 5, 20, 6, 1),
    }), FIXED_BLOCK)).toBe(true);
    expect(runIsLate(run(), FIXED_BLOCK)).toBe(false); // exactly 6:00
    expect(runIsLate(run({
      startedAt: new Date(2026, 5, 20, 5, 45),
    }), FIXED_BLOCK)).toBe(false);
  });

  it("is null when the start stamp or the nominal is unknowable", () => {
    expect(runIsLate(run({ startedAt: null }), FIXED_BLOCK)).toBeNull();
    expect(runIsLate(run({ runDate: null }), FIXED_BLOCK)).toBeNull();
    expect(runIsLate(run(), null)).toBeNull();
  });
});

describe("runOverrunMinutes / runOverran", () => {
  it("counts minutes past the nominal end, 0 when inside the window", () => {
    const over = run({ endedAt: new Date(2026, 5, 20, 7, 30) });
    expect(runOverrunMinutes(over, FIXED_BLOCK)).toBe(30);
    expect(runOverran(over, FIXED_BLOCK)).toBe(true);
    expect(runOverrunMinutes(run(), FIXED_BLOCK)).toBe(0); // ends 6:45
    expect(runOverran(run(), FIXED_BLOCK)).toBe(false);
  });

  it("ending exactly at the nominal end is 0 overrun", () => {
    const onDot = run({ endedAt: new Date(2026, 5, 20, 7, 0) });
    expect(runOverrunMinutes(onDot, FIXED_BLOCK)).toBe(0);
  });

  it("pinned: a run ending after midnight reads 0 overrun against a " +
     "past-midnight block end (end wraps, nominal doesn't)", () => {
    const lateBlock = {
      ...FIXED_BLOCK, startMinutes: 1430, durationMinutes: 60,
    };
    const r = run({
      startedAt: new Date(2026, 5, 20, 23, 50),
      endedAt: new Date(2026, 5, 21, 0, 20),
    });
    // endedAt wraps to 20 min-of-day; nominal end is 1490 unwrapped.
    expect(runOverrunMinutes(r, lateBlock)).toBe(0);
  });

  it("is null when the end stamp or the nominal is unknowable", () => {
    expect(runOverrunMinutes(run({ endedAt: null }), FIXED_BLOCK))
      .toBeNull();
    expect(runOverrunMinutes(run({ runDate: null }), FIXED_BLOCK))
      .toBeNull();
    expect(runOverran(run(), null)).toBeNull();
  });
});

describe("summarizeRuns", () => {
  // Three done runs against the 6:00–7:00 fixed block:
  //   r1 6:00→6:45  dur 45, on time,  overrun 0,  delta   0
  //   r2 6:20→7:30  dur 70, late,     overrun 30, delta +20
  //   r3 5:50→7:10  dur 80, early,    overrun 10, delta -10
  const SCENARIO = [
    run(),
    run({
      startedAt: new Date(2026, 5, 20, 6, 20),
      endedAt: new Date(2026, 5, 20, 7, 30),
    }),
    run({
      startedAt: new Date(2026, 5, 20, 5, 50),
      endedAt: new Date(2026, 5, 20, 7, 10),
    }),
  ];

  it("aggregates rates and quantiles across the usable runs", () => {
    const s = summarizeRuns(SCENARIO, FIXED_BLOCK);
    expect(s.count).toBe(3);
    expect(s.lateRate).toBeCloseTo(1 / 3);
    expect(s.overrunRate).toBeCloseTo(2 / 3);
    expect(s.medianDuration).toBe(70);
    expect(s.p25Duration).toBe(57.5); // interp between 45 and 70
    expect(s.p75Duration).toBe(75);   // interp between 70 and 80
    expect(s.medianOverrun).toBe(10);
    expect(s.medianStartDelta).toBe(0);
  });

  it("only 'done' runs with both stamps participate", () => {
    const s = summarizeRuns([
      ...SCENARIO,
      run({ state: "skipped" }),
      run({ endedAt: null }),
      run({ startedAt: null }),
    ], FIXED_BLOCK);
    expect(s.count).toBe(3);
  });

  it("a run with no runDate still counts toward durations but drops " +
     "out of the late/overrun rates", () => {
    const s = summarizeRuns([
      run({ // late + overrun, but nominal is unknowable
        runDate: null,
        startedAt: new Date(2026, 5, 20, 9, 0),
        endedAt: new Date(2026, 5, 20, 9, 30),
      }),
      run(), // on time, no overrun
    ], FIXED_BLOCK);
    expect(s.count).toBe(2);
    expect(s.lateRate).toBe(0);    // over 1 usable, not 2
    expect(s.overrunRate).toBe(0);
    expect(s.medianDuration).toBe((30 + 45) / 2);
  });

  it("no usable runs (or no block) yields the all-null zero shape", () => {
    const empty = {
      count: 0, lateRate: null, overrunRate: null,
      medianDuration: null, p25Duration: null, p75Duration: null,
      medianOverrun: null, medianStartDelta: null,
    };
    expect(summarizeRuns([], FIXED_BLOCK)).toEqual(empty);
    expect(summarizeRuns(null, FIXED_BLOCK)).toEqual(empty);
    expect(summarizeRuns(SCENARIO, null)).toEqual(empty);
  });

  it("time-not-people pinned: the summary carries no per-person or " +
     "assignee field", () => {
    const keys = Object.keys(summarizeRuns(SCENARIO, FIXED_BLOCK));
    expect(keys).not.toContain("assignee");
    expect(keys).not.toContain("person");
    expect(keys.sort()).toEqual([
      "count", "lateRate", "medianDuration", "medianOverrun",
      "medianStartDelta", "overrunRate", "p25Duration", "p75Duration",
    ].sort());
  });
});

describe("histogramBins", () => {
  it("pads the nominal window, snaps the domain to the bin grid, and " +
     "bins each run's start minute", () => {
    // One run at 360; nominals 360/420; pads 60 -> [300, 480] on a
    // 10-minute grid = 18 bins; 360 lands in bin (360-300)/10 = 6.
    const out = histogramBins([run()], FIXED_BLOCK);
    expect(out.domainStart).toBe(300);
    expect(out.domainEnd).toBe(480);
    expect(out.binMinutes).toBe(10);
    expect(out.bins).toHaveLength(18);
    expect(out.bins[6]).toBe(1);
    expect(out.bins.reduce((a, n) => a + n, 0)).toBe(1);
    expect(out.maxCount).toBe(1);
    expect(out.nominalStartMedian).toBe(360);
    expect(out.nominalEndMedian).toBe(420);
  });

  it("respects custom binMinutes and padding", () => {
    const out = histogramBins([run()], FIXED_BLOCK, {
      binMinutes: 30, padBefore: 0, padAfter: 0,
    });
    expect(out.domainStart).toBe(360);
    expect(out.domainEnd).toBe(420);
    expect(out.bins).toEqual([1, 0]);
  });

  it("a done run needs only a start stamp to participate (no end " +
     "required)", () => {
    const out = histogramBins([run({ endedAt: null })], FIXED_BLOCK);
    expect(out.bins.reduce((a, n) => a + n, 0)).toBe(1);
  });

  it("a run with no runDate still bins by start minute; the nominal " +
     "medians go null", () => {
    const out = histogramBins([run({ runDate: null })], FIXED_BLOCK);
    expect(out.bins.reduce((a, n) => a + n, 0)).toBe(1);
    expect(out.nominalStartMedian).toBeNull();
    expect(out.nominalEndMedian).toBeNull();
  });

  it("returns null with no block or no usable runs", () => {
    expect(histogramBins([run()], null)).toBeNull();
    expect(histogramBins([], FIXED_BLOCK)).toBeNull();
    expect(histogramBins(null, FIXED_BLOCK)).toBeNull();
    expect(histogramBins([run({ state: "skipped" })], FIXED_BLOCK))
      .toBeNull();
  });
});

describe("median / quantile", () => {
  it("median sorts first and interpolates an even count", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([10, 30])).toBe(20);
    expect(median([5])).toBe(5);
  });

  it("quantile interpolates between neighbors", () => {
    expect(quantile([45, 70, 80], 0.25)).toBe(57.5);
    expect(quantile([45, 70, 80], 0.75)).toBe(75);
    expect(quantile([45, 70, 80], 0)).toBe(45);
    expect(quantile([45, 70, 80], 1)).toBe(80);
  });

  it("empty or missing input is null", () => {
    expect(median([])).toBeNull();
    expect(median(null)).toBeNull();
    expect(quantile(undefined, 0.5)).toBeNull();
  });
});

describe("format helpers", () => {
  it("formatHourLabel: hour-only clock, wrapping out-of-range minutes", () => {
    expect(formatHourLabel(360)).toBe("6AM");
    expect(formatHourLabel(0)).toBe("12AM");
    expect(formatHourLabel(720)).toBe("12PM");
    expect(formatHourLabel(780)).toBe("1PM");
    expect(formatHourLabel(1440)).toBe("12AM"); // wraps
    expect(formatHourLabel(-60)).toBe("11PM");  // wraps backward
    expect(formatHourLabel(375)).toBe("6AM");   // minutes dropped
    expect(formatHourLabel(null)).toBe("");
    expect(formatHourLabel(NaN)).toBe("");
  });

  it("formatMinutesShort: shows minutes only when nonzero", () => {
    expect(formatMinutesShort(360)).toBe("6 AM");
    expect(formatMinutesShort(810)).toBe("1:30 PM");
    expect(formatMinutesShort(5)).toBe("12:05 AM");
    expect(formatMinutesShort(Infinity)).toBe("");
  });

  it("formatDurationMinutes: m / h / h+m forms, dash for junk", () => {
    expect(formatDurationMinutes(47)).toBe("47m");
    expect(formatDurationMinutes(120)).toBe("2h");
    expect(formatDurationMinutes(72)).toBe("1h 12m");
    expect(formatDurationMinutes(0)).toBe("0m");
    expect(formatDurationMinutes(59.6)).toBe("1h"); // rounds up
    expect(formatDurationMinutes(-1)).toBe("—");
    expect(formatDurationMinutes(null)).toBe("—");
  });

  it("formatRate: 0..1 as a whole percent, dash for null", () => {
    expect(formatRate(0.37)).toBe("37%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(1 / 3)).toBe("33%");
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
    expect(formatRate(NaN)).toBe("—");
  });
});
