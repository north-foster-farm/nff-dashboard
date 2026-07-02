// Availability engine (batch 42 slices 6-7, F50/F51). Availability =
// working hours ∩ not-time-off ∩ not-break. This is what makes
// "needs cover" and "who's free" real, powers the everyone-available
// default assignment (X3), and derives the project band that retires
// the magic 8a-6p PROJECT_DEFAULT_START/END.
//
// Row fixtures mirror the camelCase shapes the hooks produce from
// migration 0044's tables (time_off / working_hours / breaks).
import { describe, it, expect } from "vitest";
import {
  workingWindow,
  timeOffWindows,
  availableWindows,
  availableDuring,
  defaultAssignees,
  availabilitySegments,
  projectBand,
  outAllDay,
} from "./availability.js";

const d = (y, m, day) => new Date(y, m - 1, day);

// 2026-07-01 is a Wednesday (weekday 3).
const A_WEDNESDAY = d(2026, 7, 1);

const NINE_AM = 9 * 60;
const FIVE_PM = 17 * 60;

const SIX_AM = 6 * 60;
const SIX_PM = 18 * 60;

// Rows as the working_hours hook shapes them: a weekday default has
// `weekday` set (Sun=0); a per-date exception has `onDate` (ISO) set.
function weekdayDefault(person, weekday, startMin, endMin) {
  return {
    id: `wh-${person}-${weekday}`, person, weekday, onDate: null,
    startMin, endMin,
  };
}
function dateException(person, onDate, startMin, endMin) {
  return {
    id: `wh-${person}-${onDate}`, person, weekday: null, onDate,
    startMin, endMin,
  };
}

describe("workingWindow — one person's working span for a date", () => {
  it("defaults to 9:00-17:00 when the person has no rows at all", () => {
    const window = workingWindow("James", A_WEDNESDAY, []);
    expect(window).toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("uses the person's weekday default when one matches", () => {
    const wednesdayRow = weekdayDefault("James", 3, SIX_AM, SIX_PM);
    const window = workingWindow("James", A_WEDNESDAY, [wednesdayRow]);
    expect(window).toEqual({ startMin: SIX_AM, endMin: SIX_PM });
  });

  it("ignores weekday defaults for OTHER weekdays", () => {
    const mondayRow = weekdayDefault("James", 1, SIX_AM, SIX_PM);
    const window = workingWindow("James", A_WEDNESDAY, [mondayRow]);
    expect(window).toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("ignores rows belonging to a different person", () => {
    const jimsRow = weekdayDefault("Jim", 3, SIX_AM, SIX_PM);
    const window = workingWindow("James", A_WEDNESDAY, [jimsRow]);
    expect(window).toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("a per-date exception WINS over the weekday default", () => {
    const usualWednesday = weekdayDefault("James", 3, NINE_AM, FIVE_PM);
    const thisWednesdayEarly = dateException(
      "James", "2026-07-01", SIX_AM, SIX_PM
    );
    const window = workingWindow(
      "James", A_WEDNESDAY, [usualWednesday, thisWednesdayEarly]
    );
    expect(window).toEqual({ startMin: SIX_AM, endMin: SIX_PM });
  });

  it("an exception for a DIFFERENT date changes nothing", () => {
    const nextWeek = dateException("James", "2026-07-08", SIX_AM, SIX_PM);
    const window = workingWindow("James", A_WEDNESDAY, [nextWeek]);
    expect(window).toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("null minutes mean a scheduled day OFF — window is null", () => {
    const dayOff = dateException("James", "2026-07-01", null, null);
    expect(workingWindow("James", A_WEDNESDAY, [dayOff])).toBeNull();
  });

  it("a weekday default can also mark a standing day off", () => {
    const sundaysOff = weekdayDefault("James", 0, null, null);
    const aSunday = d(2026, 7, 5);
    expect(workingWindow("James", aSunday, [sundaysOff])).toBeNull();
  });
});

// time_off rows as the hook shapes them: inclusive ISO date span;
// null minutes = all-day; set minutes = a partial-day window.
function timeOff(person, startDate, endDate, over = {}) {
  return {
    id: `to-${person}-${startDate}`, person, startDate, endDate,
    startMin: null, endMin: null, note: null, ...over,
  };
}

const ALL_DAY = { startMin: 0, endMin: 1440 };

describe("timeOffWindows — a person's absence holes on a date", () => {
  it("an all-day absence covers the whole day", () => {
    const countyFair = timeOff("Jim", "2026-06-30", "2026-07-02");
    expect(timeOffWindows("Jim", A_WEDNESDAY, [countyFair]))
      .toEqual([ALL_DAY]);
  });

  it("a date outside the span yields no holes", () => {
    const lastWeek = timeOff("Jim", "2026-06-22", "2026-06-24");
    expect(timeOffWindows("Jim", A_WEDNESDAY, [lastWeek])).toEqual([]);
  });

  it("a single-day span covers exactly that day (inclusive ends)", () => {
    const justToday = timeOff("Jim", "2026-07-01", "2026-07-01");
    expect(timeOffWindows("Jim", A_WEDNESDAY, [justToday]))
      .toEqual([ALL_DAY]);
    expect(timeOffWindows("Jim", d(2026, 7, 2), [justToday]))
      .toEqual([]);
  });

  it("a partial-day absence yields just that window", () => {
    const dentist = timeOff("Jim", "2026-07-01", "2026-07-01", {
      startMin: 10 * 60, endMin: 14 * 60,
    });
    expect(timeOffWindows("Jim", A_WEDNESDAY, [dentist]))
      .toEqual([{ startMin: 10 * 60, endMin: 14 * 60 }]);
  });

  it("someone else's time off is not my hole", () => {
    const jamesAway = timeOff("James", "2026-07-01", "2026-07-01");
    expect(timeOffWindows("Jim", A_WEDNESDAY, [jamesAway])).toEqual([]);
  });
});

// breaks rows as the hook shapes them (farm-wide daily windows).
function breakWindow(name, startMin, endMin, isActive = true) {
  return { id: `br-${name}`, name, startMin, endMin, isActive };
}

const NOON = 12 * 60;
const HALF_PAST_NOON = 12 * 60 + 30;

describe("availableWindows — working hours ∩ ¬time-off ∩ ¬break", () => {
  const ctx = (over = {}) =>
    ({ hours: [], timeOff: [], breaks: [], ...over });

  it("with nothing scheduled, availability IS the working window", () => {
    expect(availableWindows("James", A_WEDNESDAY, ctx()))
      .toEqual([{ startMin: NINE_AM, endMin: FIVE_PM }]);
  });

  it("a scheduled day off means no availability at all", () => {
    const dayOff = dateException("James", "2026-07-01", null, null);
    expect(availableWindows("James", A_WEDNESDAY, ctx({ hours: [dayOff] })))
      .toEqual([]);
  });

  it("an all-day absence means no availability at all", () => {
    const away = timeOff("James", "2026-07-01", "2026-07-01");
    expect(availableWindows("James", A_WEDNESDAY, ctx({ timeOff: [away] })))
      .toEqual([]);
  });

  it("a partial-day absence splits the working window in two", () => {
    const dentist = timeOff("James", "2026-07-01", "2026-07-01", {
      startMin: 10 * 60, endMin: 14 * 60,
    });
    expect(availableWindows("James", A_WEDNESDAY, ctx({ timeOff: [dentist] })))
      .toEqual([
        { startMin: NINE_AM, endMin: 10 * 60 },
        { startMin: 14 * 60, endMin: FIVE_PM },
      ]);
  });

  it("an active break carves its window out for everyone", () => {
    const lunch = breakWindow("Lunch", NOON, HALF_PAST_NOON);
    expect(availableWindows("James", A_WEDNESDAY, ctx({ breaks: [lunch] })))
      .toEqual([
        { startMin: NINE_AM, endMin: NOON },
        { startMin: HALF_PAST_NOON, endMin: FIVE_PM },
      ]);
  });

  it("an inactive break carves nothing", () => {
    const offSeason = breakWindow("Lunch", NOON, HALF_PAST_NOON, false);
    expect(
      availableWindows("James", A_WEDNESDAY, ctx({ breaks: [offSeason] }))
    ).toEqual([{ startMin: NINE_AM, endMin: FIVE_PM }]);
  });

  it("an absence entirely outside working hours changes nothing", () => {
    const earlyErrand = timeOff("James", "2026-07-01", "2026-07-01", {
      startMin: 6 * 60, endMin: 8 * 60,
    });
    expect(
      availableWindows("James", A_WEDNESDAY, ctx({ timeOff: [earlyErrand] }))
    ).toEqual([{ startMin: NINE_AM, endMin: FIVE_PM }]);
  });
});

const ROSTER = ["James", "Jim"];
const emptyCtx = { hours: [], timeOff: [], breaks: [] };

describe("availableDuring — does a window overlap any availability?", () => {
  it("true when the asked window overlaps working time", () => {
    const morningChoreBlock = { startMin: 10 * 60, endMin: 11 * 60 };
    expect(
      availableDuring("James", A_WEDNESDAY, morningChoreBlock, emptyCtx)
    ).toBe(true);
  });

  it("false when the asked window sits outside working hours", () => {
    const beforeDawn = { startMin: 4 * 60, endMin: 5 * 60 };
    expect(availableDuring("James", A_WEDNESDAY, beforeDawn, emptyCtx))
      .toBe(false);
  });

  it("false for a merely TOUCHING window (5pm meeting after 9-5)", () => {
    const rightAtClose = { startMin: FIVE_PM, endMin: FIVE_PM + 60 };
    expect(availableDuring("James", A_WEDNESDAY, rightAtClose, emptyCtx))
      .toBe(false);
  });
});

describe("defaultAssignees — X3: unassigned = everyone available", () => {
  it("with everyone on default hours, the whole roster is on it", () => {
    const midMorning = { startMin: 10 * 60, endMin: 11 * 60 };
    expect(defaultAssignees(A_WEDNESDAY, midMorning, emptyCtx, ROSTER))
      .toEqual(["James", "Jim"]);
  });

  it("a person on all-day time off drops out", () => {
    const jimAway = timeOff("Jim", "2026-07-01", "2026-07-01");
    const midMorning = { startMin: 10 * 60, endMin: 11 * 60 };
    const withJimGone = { ...emptyCtx, timeOff: [jimAway] };
    expect(defaultAssignees(A_WEDNESDAY, midMorning, withJimGone, ROSTER))
      .toEqual(["James"]);
  });

  it("nobody available yields [] (the needs-cover case, not a crash)", () => {
    const everyoneGone = {
      ...emptyCtx,
      timeOff: [
        timeOff("James", "2026-07-01", "2026-07-01"),
        timeOff("Jim", "2026-07-01", "2026-07-01"),
      ],
    };
    const midMorning = { startMin: 10 * 60, endMin: 11 * 60 };
    expect(defaultAssignees(A_WEDNESDAY, midMorning, everyoneGone, ROSTER))
      .toEqual([]);
  });
});

describe("availabilitySegments — F48 who's-here across the day", () => {
  it("both on the same 9-5 makes one two-person segment", () => {
    expect(availabilitySegments(A_WEDNESDAY, emptyCtx, ROSTER)).toEqual([
      { startMin: NINE_AM, endMin: FIVE_PM, people: ["James", "Jim"] },
    ]);
  });

  it("staggered hours read 1 → 2 → 1 across the day", () => {
    const jamesEarly = weekdayDefault("James", 3, SIX_AM, 15 * 60);
    const staggered = { ...emptyCtx, hours: [jamesEarly] };
    expect(availabilitySegments(A_WEDNESDAY, staggered, ROSTER)).toEqual([
      { startMin: SIX_AM, endMin: NINE_AM, people: ["James"] },
      { startMin: NINE_AM, endMin: 15 * 60, people: ["James", "Jim"] },
      { startMin: 15 * 60, endMin: FIVE_PM, people: ["Jim"] },
    ]);
  });

  it("a mid-day everyone-out hole shows as a zero-person segment", () => {
    const lunch = breakWindow("Lunch", NOON, HALF_PAST_NOON);
    const withLunch = { ...emptyCtx, breaks: [lunch] };
    expect(availabilitySegments(A_WEDNESDAY, withLunch, ROSTER)).toEqual([
      { startMin: NINE_AM, endMin: NOON, people: ["James", "Jim"] },
      { startMin: NOON, endMin: HALF_PAST_NOON, people: [] },
      {
        startMin: HALF_PAST_NOON, endMin: FIVE_PM,
        people: ["James", "Jim"],
      },
    ]);
  });

  it("nobody working at all yields no segments", () => {
    const bothOff = {
      ...emptyCtx,
      hours: [
        dateException("James", "2026-07-01", null, null),
        dateException("Jim", "2026-07-01", null, null),
      ],
    };
    expect(availabilitySegments(A_WEDNESDAY, bothOff, ROSTER)).toEqual([]);
  });
});

describe("projectBand — working hours derive it (no magic 6pm)", () => {
  it("defaults to the union of everyone's 9-5", () => {
    expect(projectBand(A_WEDNESDAY, emptyCtx, ROSTER))
      .toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("one early riser + one late finisher widen the band", () => {
    const staggered = {
      ...emptyCtx,
      hours: [
        weekdayDefault("James", 3, SIX_AM, 15 * 60),
        weekdayDefault("Jim", 3, NINE_AM, SIX_PM),
      ],
    };
    expect(projectBand(A_WEDNESDAY, staggered, ROSTER))
      .toEqual({ startMin: SIX_AM, endMin: SIX_PM });
  });

  it("time off does NOT shrink the band — working hours gate it", () => {
    const jamesAway = timeOff("James", "2026-07-01", "2026-07-01");
    const away = { ...emptyCtx, timeOff: [jamesAway] };
    expect(projectBand(A_WEDNESDAY, away, ROSTER))
      .toEqual({ startMin: NINE_AM, endMin: FIVE_PM });
  });

  it("nobody scheduled to work yields null (no project time)", () => {
    const bothOff = {
      ...emptyCtx,
      hours: [
        dateException("James", "2026-07-01", null, null),
        dateException("Jim", "2026-07-01", null, null),
      ],
    };
    expect(projectBand(A_WEDNESDAY, bothOff, ROSTER)).toBeNull();
  });
});

describe("outAllDay — no availability at all on the date (F46)", () => {
  it("false on a plain default working day", () => {
    expect(outAllDay("James", A_WEDNESDAY, emptyCtx)).toBe(false);
  });

  it("true on a scheduled day off (null-minutes hours row)", () => {
    const dayOff = {
      ...emptyCtx,
      hours: [dateException("James", "2026-07-01", null, null)],
    };
    expect(outAllDay("James", A_WEDNESDAY, dayOff)).toBe(true);
  });

  it("true under an all-day time off", () => {
    const away = {
      ...emptyCtx,
      timeOff: [timeOff("James", "2026-07-01", "2026-07-01")],
    };
    expect(outAllDay("James", A_WEDNESDAY, away)).toBe(true);
  });

  it("true when a partial time off swallows the working window", () => {
    const swallow = {
      ...emptyCtx,
      timeOff: [timeOff("James", "2026-07-01", "2026-07-01", {
        startMin: 8 * 60, endMin: SIX_PM,
      })],
    };
    expect(outAllDay("James", A_WEDNESDAY, swallow)).toBe(true);
  });

  it("false when a partial time off leaves some of the day", () => {
    const partial = {
      ...emptyCtx,
      timeOff: [timeOff("James", "2026-07-01", "2026-07-01", {
        startMin: 10 * 60, endMin: 14 * 60,
      })],
    };
    expect(outAllDay("James", A_WEDNESDAY, partial)).toBe(false);
  });

  it("only the named person is out", () => {
    const away = {
      ...emptyCtx,
      timeOff: [timeOff("James", "2026-07-01", "2026-07-01")],
    };
    expect(outAllDay("Jim", A_WEDNESDAY, away)).toBe(false);
  });
});
