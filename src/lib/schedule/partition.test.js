// The ribbon partitioner — Project blocks + Overnight (P-B1, O-B1/2/3).
// partition.js derives the day's NEGATIVE space: the gaps between chore
// blocks become Project segments (clamped to the farm-wide default band,
// trimmed by buffers, annotated with who's free), and the after-last-block
// window belongs to Overnight, never a Project block. Complements the
// 4,000-run property test in scripts/test-schedule-partition.mjs — this
// suite pins exact hand-traced values and edge cases (touching intervals,
// sub-MIN_PROJECT_GAP gaps, band clamping) rather than invariants.
import { describe, it, expect } from "vitest";
import {
  subtractIntervals,
  occurringBlockWindows,
  mergeWindows,
  whoFree,
  overnightWindow,
  inOvernight,
  projectGaps,
  PROJECT_DEFAULT_START,
  PROJECT_DEFAULT_END,
  MIN_PROJECT_GAP,
  PARTITION_ADMINS,
  OVERNIGHT_LEAD,
  OVERNIGHT_TRAIL,
} from "./partition.js";
import { sunMinutesOfDay } from "../sunTimes.js";

const d = (y, m, day) => new Date(y, m - 1, day);
const DATE = d(2026, 6, 26);
const NEXT = d(2026, 6, 27);

// Fixed-kind blocks resolve startMinutes verbatim (no SunCalc), keeping
// every expectation deterministic.
function fixedBlock(id, startMinutes, durationMinutes = 60) {
  return { id, startKind: "fixed", startMinutes, durationMinutes,
    isActive: true };
}
const MORNING = fixedBlock("morning", 360); // 6:00-7:00
const EVENING = fixedBlock("evening", 1020, 90); // 17:00-18:30
const BLOCKS = [MORNING, EVENING];

describe("farm-wide defaults", () => {
  it("pins the v1 band, minimum gap, and admin roster", () => {
    expect(PROJECT_DEFAULT_START).toBe(8 * 60);
    expect(PROJECT_DEFAULT_END).toBe(18 * 60);
    expect(MIN_PROJECT_GAP).toBe(30);
    expect(PARTITION_ADMINS).toEqual(["James", "Jim"]);
  });

  it("pins the stable overnight bucket ids (both day pages address one shift)",
    () => {
      expect(OVERNIGHT_LEAD).toBe("overnight:lead");
      expect(OVERNIGHT_TRAIL).toBe("overnight:trail");
    });
});

describe("subtractIntervals — [s,e) hole subtraction", () => {
  it("returns the base untouched when there are no holes", () => {
    expect(subtractIntervals({ s: 100, e: 200 }, [])).toEqual(
      [{ s: 100, e: 200 }]);
  });

  it("tolerates a null holes array", () => {
    expect(subtractIntervals({ s: 100, e: 200 }, null)).toEqual(
      [{ s: 100, e: 200 }]);
  });

  it("a hole covering the whole base leaves nothing", () => {
    expect(subtractIntervals({ s: 10, e: 50 }, [{ s: 0, e: 100 }]))
      .toEqual([]);
  });

  it("a hole TOUCHING an edge (half-open) does not cut the base", () => {
    const base = { s: 100, e: 200 };
    // hole ends exactly at base start / starts exactly at base end.
    expect(subtractIntervals(base, [{ s: 50, e: 100 }])).toEqual(
      [{ s: 100, e: 200 }]);
    expect(subtractIntervals(base, [{ s: 200, e: 250 }])).toEqual(
      [{ s: 100, e: 200 }]);
  });

  it("a mid-base hole splits it into two segments", () => {
    expect(subtractIntervals({ s: 0, e: 100 }, [{ s: 40, e: 60 }]))
      .toEqual([{ s: 0, e: 40 }, { s: 60, e: 100 }]);
  });

  it("a hole overhanging one edge trims that side only", () => {
    expect(subtractIntervals({ s: 100, e: 200 }, [{ s: 50, e: 150 }]))
      .toEqual([{ s: 150, e: 200 }]);
    expect(subtractIntervals({ s: 100, e: 200 }, [{ s: 150, e: 250 }]))
      .toEqual([{ s: 100, e: 150 }]);
  });

  it("overlapping, unsorted holes subtract as their union", () => {
    const out = subtractIntervals(
      { s: 0, e: 100 },
      [{ s: 50, e: 80 }, { s: 20, e: 60 }]);
    expect(out).toEqual([{ s: 0, e: 20 }, { s: 80, e: 100 }]);
  });

  it("skips inverted/empty holes (e <= s) without effect", () => {
    expect(subtractIntervals({ s: 0, e: 100 },
      [{ s: 50, e: 50 }, { s: 60, e: 40 }]))
      .toEqual([{ s: 0, e: 100 }]);
  });
});

describe("occurringBlockWindows — active definitions resolved + sorted", () => {
  it("resolves fixed blocks verbatim and sorts by start", () => {
    // Deliberately pass evening first — output must be start-ascending.
    const out = occurringBlockWindows(DATE, [EVENING, MORNING]);
    expect(out).toEqual([
      { start: 360, end: 420 },
      { start: 1020, end: 1110 },
    ]);
  });

  it("excludes inactive blocks", () => {
    const off = { ...MORNING, isActive: false };
    expect(occurringBlockWindows(DATE, [off, EVENING])).toEqual(
      [{ start: 1020, end: 1110 }]);
  });

  it("drops a fixed block with no startMinutes (unresolvable start)", () => {
    const bad = { ...MORNING, startMinutes: null };
    expect(occurringBlockWindows(DATE, [bad])).toEqual([]);
  });

  it("drops a block whose startKind is not fixed/sunrise/sunset", () => {
    const bogus = { ...MORNING, startKind: "noon-ish" };
    expect(occurringBlockWindows(DATE, [bogus])).toEqual([]);
  });

  it("a missing durationMinutes yields a zero-width (still finite) window",
    () => {
      const flat = { id: "f", startKind: "fixed", startMinutes: 600,
        isActive: true };
      expect(occurringBlockWindows(DATE, [flat])).toEqual(
        [{ start: 600, end: 600 }]);
    });

  it("tolerates a null blocks list", () => {
    expect(occurringBlockWindows(DATE, null)).toEqual([]);
  });
});

describe("mergeWindows — union of sorted windows", () => {
  it("returns [] for empty or null input", () => {
    expect(mergeWindows([])).toEqual([]);
    expect(mergeWindows(null)).toEqual([]);
  });

  it("merges an overlapping pair, keeping the LATEST end", () => {
    // The contained window must not shrink the union's end.
    expect(mergeWindows([{ start: 0, end: 100 }, { start: 50, end: 80 }]))
      .toEqual([{ start: 0, end: 100 }]);
  });

  it("merges TOUCHING windows (start === previous end) into one", () => {
    expect(mergeWindows([{ start: 0, end: 60 }, { start: 60, end: 120 }]))
      .toEqual([{ start: 0, end: 120 }]);
  });

  it("keeps disjoint windows separate and does not mutate the input", () => {
    const wins = [{ start: 0, end: 60 }, { start: 90, end: 120 }];
    expect(mergeWindows(wins)).toEqual(wins);
    expect(wins[0]).toEqual({ start: 0, end: 60 }); // copies, not aliases
  });
});

describe("whoFree — per-person availability inside a segment", () => {
  const SEG = { s: 480, e: 1020 };

  it("with no reservations both admins are free, in roster order", () => {
    expect(whoFree(SEG, [])).toEqual(
      { freeCount: 2, who: ["James", "Jim"] });
  });

  it("tolerates a null reservation-window list", () => {
    expect(whoFree(SEG, null).freeCount).toBe(2);
  });

  it("a person fully covered by their reservation is not free", () => {
    const res = [{ assignee: "James", startMin: 0, endMin: 1440 }];
    expect(whoFree(SEG, res)).toEqual({ freeCount: 1, who: ["Jim"] });
  });

  it("a PARTIAL reservation leaves the person free (any uncovered minute)",
    () => {
      const res = [{ assignee: "James", startMin: 480, endMin: 1000 }];
      expect(whoFree(SEG, res)).toEqual(
        { freeCount: 2, who: ["James", "Jim"] });
    });

  it("reservations for non-admin names never affect the roster", () => {
    const res = [{ assignee: "Visitor", startMin: 0, endMin: 1440 }];
    expect(whoFree(SEG, res).freeCount).toBe(2);
  });

  it("both admins covered means nobody is free", () => {
    const res = [
      { assignee: "James", startMin: 0, endMin: 1440 },
      { assignee: "Jim", startMin: 0, endMin: 1440 },
    ];
    expect(whoFree(SEG, res)).toEqual({ freeCount: 0, who: [] });
  });
});

describe("overnightWindow — last block tonight to first block tomorrow", () => {
  it("spans last-block end (evening edge) to first-block start (dawn edge)",
    () => {
      const w = overnightWindow(DATE, NEXT, BLOCKS);
      expect(w).toEqual({ startMin: 1110, endMin: 360 });
    });

  it("returns null on a down day (no occurring frame on either side)", () => {
    expect(overnightWindow(DATE, NEXT, [])).toBeNull();
    const off = BLOCKS.map((b) => ({ ...b, isActive: false }));
    expect(overnightWindow(DATE, NEXT, off)).toBeNull();
  });

  it("a single occurring block still anchors both edges", () => {
    const w = overnightWindow(DATE, NEXT, [MORNING]);
    expect(w).toEqual({ startMin: 420, endMin: 360 });
  });
});

describe("inOvernight — side-of-midnight membership (O-B3)", () => {
  const WIN = { startMin: 1110, endMin: 360 };

  it("evening side is INCLUSIVE at the last-block-end edge", () => {
    expect(inOvernight(WIN, 1110, "evening")).toBe(true);
    expect(inOvernight(WIN, 1109, "evening")).toBe(false);
  });

  it("dawn side is HALF-OPEN: the first block's start is NOT overnight",
    () => {
      expect(inOvernight(WIN, 360, "dawn")).toBe(false);
      expect(inOvernight(WIN, 359, "dawn")).toBe(true);
    });

  it("null window, null minutes, or NaN minutes are never inside", () => {
    expect(inOvernight(null, 1200, "evening")).toBe(false);
    expect(inOvernight(WIN, null, "evening")).toBe(false);
    expect(inOvernight(WIN, NaN, "dawn")).toBe(false);
  });
});

describe("projectGaps — the day's project segments", () => {
  it("a standard two-block day yields one mid-day segment, clamped to " +
    "the band and excluding the after-last-block (Overnight) window", () => {
    const out = projectGaps({ date: DATE, blocks: BLOCKS });
    // Before-first candidate [480, 360) inverts under the clamp and is
    // dropped; the 420-1020 gap clamps its start up to the 8:00 band edge.
    expect(out).toEqual([{
      kind: "project",
      startMin: 480,
      endMin: 1020,
      durationMin: 540,
      who: { freeCount: 2, who: ["James", "Jim"] },
    }]);
  });

  it("no occurring blocks means no chore frame, so no project time", () => {
    expect(projectGaps({ date: DATE, blocks: [] })).toEqual([]);
    expect(projectGaps({ date: DATE, blocks: null })).toEqual([]);
  });

  it("a late-starting single block yields only the before-first gap — " +
    "never a segment after the last block", () => {
    const out = projectGaps({
      date: DATE, blocks: [fixedBlock("mid", 600)], // 10:00-11:00
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMin: 480, endMin: 600 });
  });

  it("a gap shorter than MIN_PROJECT_GAP yields no segment", () => {
    const out = projectGaps({
      date: DATE,
      blocks: [fixedBlock("a", 480, 120), fixedBlock("b", 620)],
    }); // between-gap 600-620 = 20 min < 30
    expect(out).toEqual([]);
  });

  it("a gap of exactly MIN_PROJECT_GAP survives (>= boundary)", () => {
    const out = projectGaps({
      date: DATE,
      blocks: [fixedBlock("a", 480, 120), fixedBlock("b", 630)],
    }); // between-gap 600-630 = exactly 30
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject(
      { startMin: 600, endMin: 630, durationMin: 30 });
  });

  it("windows outside the default band clamp away: a pre-band block and " +
    "a post-band block leave exactly the band itself", () => {
    const out = projectGaps({
      date: DATE,
      blocks: [fixedBlock("dawn", 300), fixedBlock("late", 1140)],
    }); // 5:00-6:00 and 19:00-20:00 — both outside 8:00-18:00
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMin: 480, endMin: 1080 });
  });

  it("honors a caller-supplied band override", () => {
    const out = projectGaps({
      date: DATE, blocks: BLOCKS, defaultStart: 300, defaultEnd: 1200,
    });
    expect(out.map((s) => [s.startMin, s.endMin])).toEqual(
      [[300, 360], [420, 1020]]);
  });

  it("merges overlapping block windows first, so no phantom gap runs " +
    "through a block that ends late", () => {
    const out = projectGaps({
      date: DATE,
      blocks: [
        fixedBlock("long", 480, 240), // 8:00-12:00
        fixedBlock("inner", 600),     // 10:00-11:00, inside "long"
        fixedBlock("later", 780),     // 13:00-14:00
      ],
    });
    // A naive consecutive-window walk would carve 660-780, straight
    // through "long"'s tail. The union walk yields only 720-780.
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMin: 720, endMin: 780 });
  });

  it("a mid-gap buffer SPLITS project time into two segments", () => {
    const buffers = [{
      id: "buf", clock_time: "12:00", source_ref: { end: "13:00" },
    }];
    const out = projectGaps({ date: DATE, blocks: BLOCKS, buffers });
    expect(out.map((s) => [s.startMin, s.endMin])).toEqual(
      [[480, 720], [780, 1020]]);
  });

  it("a buffer leaving only a sub-MIN_PROJECT_GAP sliver drops it", () => {
    const buffers = [{
      id: "buf", clock_time: "08:00", source_ref: { end: "16:45" },
    }]; // leaves 16:45-17:00 = 15 min
    expect(projectGaps({ date: DATE, blocks: BLOCKS, buffers }))
      .toEqual([]);
  });

  it("a buffer with unresolvable times is ignored, never thrown", () => {
    const buffers = [{ id: "buf", clock_time: null, source_ref: {} }];
    const out = projectGaps({ date: DATE, blocks: BLOCKS, buffers });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ startMin: 480, endMin: 1020 });
  });

  it("one admin's day-off reservation leaves the other free (freeCount 1)",
    () => {
      const reservations = [{
        id: "r1", assignee: "James", source_ref: { kind: "day_off" },
      }];
      const out = projectGaps({ date: DATE, blocks: BLOCKS, reservations });
      expect(out).toHaveLength(1);
      expect(out[0].who).toEqual({ freeCount: 1, who: ["Jim"] });
    });

  it("nobody free (both admins off) yields no segment at all", () => {
    const reservations = [
      { id: "r1", assignee: "James", source_ref: { kind: "day_off" } },
      { id: "r2", assignee: "Jim", source_ref: { kind: "day_off" } },
    ];
    expect(projectGaps({ date: DATE, blocks: BLOCKS, reservations }))
      .toEqual([]);
  });

  it("a partial off-site reservation keeps its person free in the segment",
    () => {
      const reservations = [{
        id: "r1", assignee: "James", clock_time: "09:00",
        source_ref: { end: "11:00" },
      }];
      const out = projectGaps({ date: DATE, blocks: BLOCKS, reservations });
      expect(out[0].who).toEqual({ freeCount: 2, who: ["James", "Jim"] });
    });
});

// ── Availability-aware partition (batch 42 slice 6, F51) ────────────────
// When the caller passes the availability ctx ({ hours, timeOff,
// breaks } from useAvailability), the band derives from working hours
// (retiring the magic 8a-6p), breaks carve holes like buffers, and
// who's-free respects time off + working hours, not just reservations.
// DATE (2026-06-26) is a Friday, weekday 5.

function weekdayHours(person, weekday, startMin, endMin) {
  return {
    id: `wh-${person}-${weekday}`, person, weekday, onDate: null,
    startMin, endMin,
  };
}
function allDayOff(person, dateISO) {
  return {
    id: `to-${person}`, person, startDate: dateISO, endDate: dateISO,
    startMin: null, endMin: null, note: null,
  };
}

describe("projectGaps — availability-derived band + breaks (F51)", () => {
  it("derives the band from working hours, not the magic 8a-6p", () => {
    // Both admins work 10:00-16:00 on Fridays; the mid-day gap
    // (7:00-17:00 between the two blocks) clamps to that band.
    const availability = {
      hours: [
        weekdayHours("James", 5, 600, 960),
        weekdayHours("Jim", 5, 600, 960),
      ],
      timeOff: [], breaks: [],
    };
    const out = projectGaps({ date: DATE, blocks: BLOCKS, availability });
    expect(out).toHaveLength(1);
    expect(out[0].startMin).toBe(600);
    expect(out[0].endMin).toBe(960);
  });

  it("carves active breaks out of the gap like buffers", () => {
    const lunch = {
      id: "br-lunch", name: "Lunch", startMin: 720, endMin: 750,
      isActive: true,
    };
    const availability = { hours: [], timeOff: [], breaks: [lunch] };
    const out = projectGaps({ date: DATE, blocks: BLOCKS, availability });
    // Default 9-5 working hours band the gap to 540-1020, lunch
    // splits it in two.
    expect(out.map((g) => [g.startMin, g.endMin]))
      .toEqual([[540, 720], [750, 1020]]);
  });

  it("nobody scheduled to work means no project segments at all", () => {
    const availability = {
      hours: [
        { id: "x1", person: "James", weekday: null,
          onDate: "2026-06-26", startMin: null, endMin: null },
        { id: "x2", person: "Jim", weekday: null,
          onDate: "2026-06-26", startMin: null, endMin: null },
      ],
      timeOff: [], breaks: [],
    };
    expect(projectGaps({ date: DATE, blocks: BLOCKS, availability }))
      .toEqual([]);
  });

  it("a person on all-day time off drops out of who's-free", () => {
    const availability = {
      hours: [], timeOff: [allDayOff("Jim", "2026-06-26")], breaks: [],
    };
    const out = projectGaps({ date: DATE, blocks: BLOCKS, availability });
    expect(out[0].who).toEqual({ freeCount: 1, who: ["James"] });
  });
});

describe("whoFree — availability-aware (opts form)", () => {
  it("time off makes a person not-free even with zero reservations", () => {
    const availability = {
      hours: [], timeOff: [allDayOff("James", "2026-06-26")], breaks: [],
    };
    const midDay = { s: 600, e: 660 };
    expect(whoFree(midDay, [], { date: DATE, availability }))
      .toEqual({ freeCount: 1, who: ["Jim"] });
  });

  it("a segment outside someone's working hours excludes them", () => {
    const availability = {
      hours: [weekdayHours("Jim", 5, 600, 840)], // Jim: 10:00-14:00
      timeOff: [], breaks: [],
    };
    const lateAfternoon = { s: 900, e: 960 };
    expect(whoFree(lateAfternoon, [], { date: DATE, availability }))
      .toEqual({ freeCount: 1, who: ["James"] });
  });

  it("without the opts arg, behaves exactly as before (reservations only)",
    () => {
      expect(whoFree({ s: 600, e: 660 }, []))
        .toEqual({ freeCount: 2, who: ["James", "Jim"] });
    });
});

// ── Sun-anchored breaks (0.9) ───────────────────────────────────────────
// F15 lets a break anchor either side to sunrise/sunset instead of fixed
// minutes, and `createBreak` stores such a row with null minutes. The
// availability engine resolves those anchors (availability.js), so a
// dusk break shrinks a person's availability — but the partitioner read
// the raw minutes, so the project block stayed drawn over an evening
// nobody was available for. A December date keeps the resolved sunset
// mid-day under any plausible test timezone, so these expectations need
// no TZ pin.
const WINTER_DATE = d(2026, 12, 21);
const WINTER_DATE_ISO = "2026-12-21";
const WINTER_SUNSET = sunMinutesOfDay(WINTER_DATE, "sunset");

function onDateHours(person, dateISO, startMin, endMin) {
  return {
    id: `wh-${person}-${dateISO}`, person, weekday: null, onDate: dateISO,
    startMin, endMin,
  };
}

describe("projectGaps — sun-anchored breaks (0.9)", () => {
  const workdayStart = WINTER_SUNSET - 240;
  const workdayEnd = WINTER_SUNSET + 120;
  // One block ending exactly at the workday start and one opening at its
  // end, so the whole workday is a single project gap bracketing sunset.
  const blocksBracketingTheWorkday = [
    fixedBlock("winter-morning", workdayStart - 60),
    fixedBlock("winter-evening", workdayEnd),
  ];
  const duskBreak = {
    id: "br-dusk", name: "Dusk feeding", startMin: null, endMin: workdayEnd,
    startSun: "sunset", endSun: null, isActive: true,
  };
  const bothAdminsWorkThroughDusk = {
    hours: [
      onDateHours("James", WINTER_DATE_ISO, workdayStart, workdayEnd),
      onDateHours("Jim", WINTER_DATE_ISO, workdayStart, workdayEnd),
    ],
    timeOff: [],
    breaks: [duskBreak],
  };

  it("trims the evening project gap at that date's sunset", () => {
    const gaps = projectGaps({
      date: WINTER_DATE,
      blocks: blocksBracketingTheWorkday,
      availability: bothAdminsWorkThroughDusk,
    });
    expect(gaps.map((gap) => [gap.startMin, gap.endMin]))
      .toEqual([[workdayStart, WINTER_SUNSET]]);
  });
});
