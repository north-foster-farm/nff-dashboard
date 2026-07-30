// The chore engine (src/lib/chores.js) — deadline resolution, recurrence
// matching, assignment precedence, the days-remaining countdown, and the
// per-place obligation/anchor system. This is the single richest pure
// module in the app and backs BOTH the Chores feature (CH# requirements
// in docs/specs/nff-chores-spec.md) and the Schedule feature's
// must/should escalation (S13-S15 in
// docs/workshops/scope-workshop/examples/schedule/2-story-set.md) — a
// regression here silently breaks two features at once.
//
// Dates use LOCAL time throughout (matches the source's own convention:
// dayOfWeek/isChoreActiveOn/computeDeadline all read local getDay/getHours).
// All-fixed blocks are used almost everywhere below to keep expected
// values deterministic; sunrise/sunset block resolution is exercised
// separately (see sunTimes.test.js, task list item #30) since SunCalc
// output varies by day-of-year.
import { describe, it, expect } from "vitest";
import {
  isInLastWeekOfMonth,
  isChoreActiveOn,
  computeDeadline,
  compareChoreOrder,
  resolveAssignees,
  resolveAssignee,
  expandChoreForDay,
  getChoresForDay,
  choresRemainingToday,
  describeFrequency,
  choreDaysRemaining,
  displayDeadlineDateShort,
  obligationPlaceIds,
  describeChoreAnchor,
  firstBlockOfDay,
  blockTimeLabel,
  displayDeadline,
  choresReferencingBlock,
} from "./chores.js";

// Local-time date constructors so tests read as calendar dates, not
// UTC-shifted ones (a common footgun this module's own helpers avoid
// by using new Date(y,m,d) rather than parsing ISO strings as UTC).
const d = (y, m, day, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

// A fixed 30-minute block starting at `startMinutes` (local clock).
function fixedBlock(id, startMinutes, durationMinutes = 60, isActive = true) {
  return { id, startKind: "fixed", startMinutes, durationMinutes, isActive };
}

// The five real chore blocks, roughly per docs/specs/nff-chores-spec.md
// §2.1. Block identity is the row uuid and NOTHING else — deadlines
// store `block: <uuid>` (migration 0052) and every resolution matches
// on id (F5). BID.<key> is just a readable alias for each fixture uuid;
// the keys are for the test's eyes only.
const BID = {
  morning: "uuid-morning-block",
  midmorning: "uuid-midmorning-block",
  late_afternoon: "uuid-late-afternoon-block",
  end_of_day: "uuid-end-of-day-block",
};
const FIVE_BLOCKS = [
  fixedBlock(BID.morning, 6 * 60),        // 6:00 AM
  fixedBlock(BID.midmorning, 10 * 60),    // 10:00 AM
  fixedBlock("uuid-early-afternoon-block", 13 * 60), // 1:00 PM
  fixedBlock(BID.late_afternoon, 16 * 60),  // 4:00 PM
  fixedBlock(BID.end_of_day, 20 * 60),      // 8:00 PM, 60 min -> ends 9 PM
];

function chore(over = {}) {
  return {
    id: "c1",
    title: "Fill waterer",
    frequency: { type: "daily" },
    deadline: { kind: "midnight" },
    ...over,
  };
}

describe("isInLastWeekOfMonth", () => {
  it("is true for the final Sunday-Saturday week of a 31-day month (Jan 2026)", () => {
    // Jan 2026: Jan 31 is a Saturday; the last Sun-Sat week is Jan 25-31.
    expect(isInLastWeekOfMonth(d(2026, 1, 25))).toBe(true); // Sunday
    expect(isInLastWeekOfMonth(d(2026, 1, 31))).toBe(true); // Saturday
    expect(isInLastWeekOfMonth(d(2026, 1, 24))).toBe(false); // the week before
  });

  it("handles a month whose last day is a Sunday (the week is one day)", () => {
    // May 2026: May 31 is a Sunday -> the last week is just May 31 itself
    // (Sun-Sat week containing May 31 starts May 31).
    expect(isInLastWeekOfMonth(d(2026, 5, 31))).toBe(true);
    expect(isInLastWeekOfMonth(d(2026, 5, 30))).toBe(false);
  });

  it("handles February in a non-leap year (2026)", () => {
    // Feb 2026: 28 days, Feb 28 is a Saturday -> last week Feb 22-28.
    expect(isInLastWeekOfMonth(d(2026, 2, 22))).toBe(true);
    expect(isInLastWeekOfMonth(d(2026, 2, 28))).toBe(true);
    expect(isInLastWeekOfMonth(d(2026, 2, 21))).toBe(false);
  });

  it("is exclusive of the following month's start-of-week bleed", () => {
    expect(isInLastWeekOfMonth(d(2026, 2, 1))).toBe(false);
  });
});

describe("isChoreActiveOn — daily / specific_days / event / once", () => {
  it("daily fires every day of the week", () => {
    const c = chore({ frequency: { type: "daily" } });
    for (let i = 0; i < 7; i++) {
      expect(isChoreActiveOn(c, d(2026, 6, 1 + i))).toBe(true);
    }
  });

  it("specific_days fires only on the listed weekdays", () => {
    // Mon/Wed/Fri = 1/3/5 (Sun=0)
    const c = chore({ frequency: { type: "specific_days", days: [1, 3, 5] } });
    // 2026-06-01 is a Monday.
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true); // Mon
    expect(isChoreActiveOn(c, d(2026, 6, 2))).toBe(false); // Tue
    expect(isChoreActiveOn(c, d(2026, 6, 3))).toBe(true); // Wed
    expect(isChoreActiveOn(c, d(2026, 6, 5))).toBe(true); // Fri
    expect(isChoreActiveOn(c, d(2026, 6, 6))).toBe(false); // Sat
  });

  it("specific_days with an empty/missing days list never fires", () => {
    expect(isChoreActiveOn(chore({ frequency: { type: "specific_days" } }), d(2026, 6, 1)))
      .toBe(false);
  });

  it("event-triggered chores never self-fire (materialized by automation, not recurrence)", () => {
    const c = chore({ frequency: { type: "event" } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(false);
    expect(isChoreActiveOn(c, d(2026, 12, 25))).toBe(false);
  });

  it("once fires on its date and every day after, until the row is retired", () => {
    const c = chore({ frequency: { type: "once", date: "2026-06-15" } });
    expect(isChoreActiveOn(c, d(2026, 6, 14))).toBe(false); // before
    expect(isChoreActiveOn(c, d(2026, 6, 15))).toBe(true); // on
    expect(isChoreActiveOn(c, d(2026, 6, 20))).toBe(true); // after (nags until done)
  });

  it("once with no date never fires", () => {
    expect(isChoreActiveOn(chore({ frequency: { type: "once" } }), d(2026, 6, 15)))
      .toBe(false);
  });

  it("an unknown/missing frequency type is inert (never fires, never throws)", () => {
    expect(isChoreActiveOn(chore({ frequency: undefined }), d(2026, 6, 1))).toBe(false);
    expect(isChoreActiveOn(chore({ frequency: { type: "bogus" } }), d(2026, 6, 1))).toBe(false);
  });
});

describe("isChoreActiveOn — weekly_window / monthly_last_week_window (legacy 'should' windows)", () => {
  it("weekly_window fires on every day from preferredDay through latestDay inclusive", () => {
    // Mon(1) preferred, Fri(5) latest — the classic "should" window.
    const c = chore({ frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true); // Mon
    expect(isChoreActiveOn(c, d(2026, 6, 3))).toBe(true); // Wed (mid-window)
    expect(isChoreActiveOn(c, d(2026, 6, 5))).toBe(true); // Fri (latest)
    expect(isChoreActiveOn(c, d(2026, 6, 6))).toBe(false); // Sat (past window)
    expect(isChoreActiveOn(c, d(2026, 5, 31))).toBe(false); // Sun (before window)
  });

  it("weekly_window defaults to Mon-Fri when preferredDay/latestDay are omitted", () => {
    const c = chore({ frequency: { type: "weekly_window" } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true); // Mon
    expect(isChoreActiveOn(c, d(2026, 6, 6))).toBe(false); // Sat
  });

  it("monthly_last_week_window requires BOTH the last-week gate and the day range", () => {
    const c = chore({
      frequency: { type: "monthly_last_week_window", preferredDay: 1, latestDay: 5 },
    });
    // Jan 2026 last week = Jan 25-31 (Sun-Sat).
    expect(isChoreActiveOn(c, d(2026, 1, 26))).toBe(true); // Mon of last week
    expect(isChoreActiveOn(c, d(2026, 1, 18))).toBe(false); // Mon, but NOT last week
    expect(isChoreActiveOn(c, d(2026, 1, 31))).toBe(false); // last week, but Saturday (past latestDay)
  });
});

describe("isChoreActiveOn — weekly / monthly_last_week (new block-model recurrence)", () => {
  it("weekly fires only on the listed days (single day)", () => {
    const c = chore({ frequency: { type: "weekly", days: [1] } }); // Monday only
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true);
    expect(isChoreActiveOn(c, d(2026, 6, 8))).toBe(true); // next Monday too
    expect(isChoreActiveOn(c, d(2026, 6, 2))).toBe(false);
  });

  it("weekly fires on multiple listed days (Mon/Wed/Fri, per mm-compost-eggs)", () => {
    const c = chore({ frequency: { type: "weekly", days: [1, 3, 5] } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true); // Mon
    expect(isChoreActiveOn(c, d(2026, 6, 3))).toBe(true); // Wed
    expect(isChoreActiveOn(c, d(2026, 6, 5))).toBe(true); // Fri
    expect(isChoreActiveOn(c, d(2026, 6, 4))).toBe(false); // Thu
  });

  it("monthly_last_week fires only on the given weekday of the month's last week", () => {
    const c = chore({ frequency: { type: "monthly_last_week", day: 1 } }); // last Monday
    expect(isChoreActiveOn(c, d(2026, 1, 26))).toBe(true); // last Monday of Jan 2026
    expect(isChoreActiveOn(c, d(2026, 1, 19))).toBe(false); // a Monday, but not last week
    expect(isChoreActiveOn(c, d(2026, 1, 27))).toBe(false); // last week, but Tuesday
  });

  it("monthly_last_week defaults to Monday when day is omitted", () => {
    const c = chore({ frequency: { type: "monthly_last_week" } });
    expect(isChoreActiveOn(c, d(2026, 1, 26))).toBe(true);
  });
});

describe("isChoreActiveOn — every_n (days/weeks/months/years)", () => {
  it("every_n days=1 fires every day (n clamps to >=1)", () => {
    const c = chore({ frequency: { type: "every_n", unit: "days", n: 1 } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(true);
    expect(isChoreActiveOn(c, d(2026, 6, 2))).toBe(true);
  });

  it("every_n days=2 fires every other day, deterministically off the epoch", () => {
    const c = chore({ frequency: { type: "every_n", unit: "days", n: 2 } });
    const jun1 = isChoreActiveOn(c, d(2026, 6, 1, 0, 0));
    const jun2 = isChoreActiveOn(c, d(2026, 6, 2, 0, 0));
    // Exactly one of two consecutive days fires (epoch-day parity).
    expect(jun1).not.toBe(jun2);
    // Two days later must match the first day (period-2 repeats).
    expect(isChoreActiveOn(c, d(2026, 6, 3, 0, 0))).toBe(jun1);
  });

  it("every_n(unit:'months', n:3, day:Mon) matches the spec's egg-washer-clean cadence", () => {
    // mm-egg-washer-clean: every 3 months on a Monday, scheduled at midmorning.
    // absMonth % 3 === 0 gates the month; day===Monday(1) AND date<=7 gates
    // "first Monday of the qualifying month".
    const c = chore({ frequency: { type: "every_n", unit: "months", n: 3, day: 1 } });
    // Some month with absMonth % 3 === 0: 2026-01 -> absMonth = 2026*12+0 = 24312,
    // 24312 % 3 === 0 -> January qualifies. First Monday of Jan 2026 = Jan 5.
    expect(isChoreActiveOn(c, d(2026, 1, 5))).toBe(true);
    expect(isChoreActiveOn(c, d(2026, 1, 12))).toBe(false); // a Monday, but not the first
    // February (absMonth % 3 !== 0) never fires regardless of weekday.
    expect(isChoreActiveOn(c, d(2026, 2, 2))).toBe(false);
  });

  it("every_n(unit:'months') with no day fires on the 1st of a qualifying month", () => {
    const c = chore({ frequency: { type: "every_n", unit: "months", n: 3 } });
    expect(isChoreActiveOn(c, d(2026, 1, 1))).toBe(true);
    expect(isChoreActiveOn(c, d(2026, 1, 2))).toBe(false);
  });

  it("every_n(unit:'years') fires only in January, first matching weekday in days 1-7", () => {
    const c = chore({ frequency: { type: "every_n", unit: "years", n: 1, day: 1 } });
    expect(isChoreActiveOn(c, d(2026, 1, 5))).toBe(true); // first Monday of Jan 2026
    expect(isChoreActiveOn(c, d(2026, 2, 2))).toBe(false); // not January at all
  });

  it("every_n with an unrecognized unit never fires", () => {
    const c = chore({ frequency: { type: "every_n", unit: "fortnights", n: 1 } });
    expect(isChoreActiveOn(c, d(2026, 6, 1))).toBe(false);
  });
});

describe("firstBlockOfDay — the day's first block is derived, never identified", () => {
  // Blocks are user data: name and slug are presentation the user can
  // freely change (the live rows are named Sunrise/Sunset, not
  // Morning). Code that needs "the day's first block" derives it from
  // the resolved start order — it never matches a name (F5 remedy).
  it("returns the earliest-starting active block no matter what it is named", () => {
    const sunset = { ...fixedBlock("b-sunset", 19 * 60), name: "Sunset" };
    const sunrise = { ...fixedBlock("b-sunrise", 6 * 60), name: "Sunrise" };
    const first = firstBlockOfDay([sunset, sunrise], d(2026, 6, 1));
    expect(first).toBe(sunrise);
  });

  it("skips inactive blocks even when they start earliest", () => {
    const retired = { ...fixedBlock("b-old", 5 * 60, 60, false), name: "Dawn" };
    const live = { ...fixedBlock("b-live", 8 * 60), name: "Late Start" };
    expect(firstBlockOfDay([retired, live], d(2026, 6, 1))).toBe(live);
  });

  it("returns null when there are no blocks to derive from", () => {
    expect(firstBlockOfDay([], d(2026, 6, 1))).toBeNull();
    expect(firstBlockOfDay(undefined, d(2026, 6, 1))).toBeNull();
  });
});

describe("blockTimeLabel — a block's own start label, no lookup involved", () => {
  it("labels a fixed block with its clock time", () => {
    expect(blockTimeLabel(fixedBlock("b1", 6 * 60))).toBe("6 AM");
    expect(blockTimeLabel(fixedBlock("b2", 16 * 60 + 30))).toBe("4:30 PM");
  });

  it("labels sun-anchored blocks by their event, not a clock time", () => {
    expect(blockTimeLabel({ id: "b3", startKind: "sunrise" })).toBe("sunrise");
    expect(blockTimeLabel({ id: "b4", startKind: "sunset" })).toBe("sunset");
  });

  it("returns an empty label for a missing block", () => {
    expect(blockTimeLabel(null)).toBe("");
  });
});

describe("computeDeadline — new block-model deadlines ({ kind })", () => {
  it("midnight/none resolve to 23:59:59.999 the same day", () => {
    const c = chore({ deadline: { kind: "midnight" } });
    const dl = computeDeadline(c, d(2026, 6, 1, 9), FIVE_BLOCKS);
    expect(dl.getHours()).toBe(23);
    expect(dl.getMinutes()).toBe(59);
    expect(dl.getDate()).toBe(1);
  });

  it("following_block resolves to the start of the NEXT ordered block", () => {
    const c = chore({ blockId: BID.morning, deadline: { kind: "following_block" } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    // midmorning starts at 10:00 AM.
    expect(dl.getHours()).toBe(10);
    expect(dl.getMinutes()).toBe(0);
  });

  it("following_block on the LAST block falls back to end-of-day (no next block)", () => {
    const c = chore({ blockId: BID.end_of_day, deadline: { kind: "following_block" } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    expect(dl.getHours()).toBe(23);
    expect(dl.getMinutes()).toBe(59);
  });

  it("following_block with an unknown blockId falls back to end-of-day", () => {
    const c = chore({ blockId: "nonexistent", deadline: { kind: "following_block" } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    expect(dl.getHours()).toBe(23);
  });

  it("block resolves to the END of the referenced block (start + duration)", () => {
    const c = chore({ deadline: { kind: "block", block: BID.morning } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    // morning = 6:00 AM start, 60 min duration -> ends 7:00 AM.
    expect(dl.getHours()).toBe(7);
    expect(dl.getMinutes()).toBe(0);
  });

  it("block_on_weekday resolves against the next occurrence of that weekday", () => {
    // proc-pickup-style: deadline = late afternoon, Friday of the same week.
    const c = chore({ deadline: { kind: "block_on_weekday", block: BID.late_afternoon, weekday: 5 } });
    // 2026-06-01 is a Monday; the next Friday is 2026-06-05.
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    expect(dl.getDate()).toBe(5);
    expect(dl.getHours()).toBe(17); // late_afternoon 4 PM + 60 min = 5 PM
  });

  it("block_on_weekday on the target weekday itself resolves to TODAY (not next week)", () => {
    const c = chore({ deadline: { kind: "block_on_weekday", block: BID.late_afternoon, weekday: 5 } });
    const dl = computeDeadline(c, d(2026, 6, 5), FIVE_BLOCKS); // already Friday
    expect(dl.getDate()).toBe(5);
  });

  it("block_at_offset resolves the named block on date+offset_days", () => {
    // proc-stage-crates-trailer style: offset -1 (day before), late_afternoon.
    const c = chore({ deadline: { kind: "block_at_offset", block: BID.late_afternoon, offset_days: -1 } });
    const dl = computeDeadline(c, d(2026, 6, 5), FIVE_BLOCKS);
    expect(dl.getDate()).toBe(4);
    expect(dl.getHours()).toBe(17);
  });

  it("block_at_offset with offset 0 resolves to the same day", () => {
    const c = chore({ deadline: { kind: "block_at_offset", block: BID.morning, offset_days: 0 } });
    const dl = computeDeadline(c, d(2026, 6, 5), FIVE_BLOCKS);
    expect(dl.getDate()).toBe(5);
  });

  it("an unrecognized kind falls back to end-of-day rather than throwing", () => {
    const c = chore({ deadline: { kind: "bogus" } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    expect(dl.getHours()).toBe(23);
  });

  it("resolving without a blocks array degrades to end-of-day, never throws", () => {
    const c = chore({ blockId: BID.morning, deadline: { kind: "following_block" } });
    expect(() => computeDeadline(c, d(2026, 6, 1), undefined)).not.toThrow();
    const dl = computeDeadline(c, d(2026, 6, 1), undefined);
    expect(dl.getHours()).toBe(23);
  });

  it("a block ref resolves by id ONLY — a slug string is a dangling ref, not an alias", () => {
    // Pre-0052 rows stored slugs and the client carried a slug->uuid
    // map of hardcoded prod keys. That map is gone: anything that
    // isn't a live block id degrades to end-of-day.
    const c = chore({ deadline: { kind: "block", block: "morning" } });
    const dl = computeDeadline(c, d(2026, 6, 1), FIVE_BLOCKS);
    expect(dl.getHours()).toBe(23);
  });
});

describe("displayDeadline — block names come from the live rows, loudly when broken", () => {
  // The user calls these blocks Sunrise and Sunset; the deadline text
  // must say what the blocks admin says, not a bundled label map (F5:
  // the old copy said "by end of Morning" for the block named Sunrise).
  const named = (id, name, min) => ({ ...fixedBlock(id, min), name });
  const LIVE = [
    named(BID.morning, "Sunrise", 6 * 60),
    named(BID.late_afternoon, "Late Afternoon", 16 * 60),
    named(BID.end_of_day, "Sunset", 20 * 60),
  ];

  it("names the block exactly as the blocks admin does today", () => {
    const c = chore({ deadline: { kind: "block", block: BID.end_of_day } });
    expect(displayDeadline(c, LIVE)).toBe("by end of Sunset");
  });

  it("weekday deadlines carry the live name too", () => {
    const c = chore({
      deadline: { kind: "block_on_weekday", block: BID.late_afternoon, weekday: 5 },
    });
    expect(displayDeadline(c, LIVE)).toBe("by Fri Late Afternoon");
  });

  it("a dangling block ref reads as broken — never silently blank", () => {
    const c = chore({ deadline: { kind: "block", block: "uuid-of-deleted-block" } });
    expect(displayDeadline(c, LIVE)).toBe("by end of a deleted block");
  });
});

describe("computeDeadline — legacy type-based deadlines", () => {
  it("offset_hours adds hours to the chore's startTime", () => {
    const c = chore({ startTime: "08:00", deadline: { type: "offset_hours", hours: 2 } });
    const dl = computeDeadline(c, d(2026, 6, 1), null);
    expect(dl.getHours()).toBe(10);
  });

  it("end_of_day resolves to 23:59:59", () => {
    const c = chore({ deadline: { type: "end_of_day" } });
    const dl = computeDeadline(c, d(2026, 6, 1), null);
    expect(dl.getHours()).toBe(23);
    expect(dl.getMinutes()).toBe(59);
  });

  it("end_of_week_friday resolves to Friday 23:59:59 of the same Sun-Sat week", () => {
    const c = chore({ deadline: { type: "end_of_week_friday" } });
    const dl = computeDeadline(c, d(2026, 6, 1), null); // Monday
    expect(dl.getDay()).toBe(5);
    expect(dl.getDate()).toBe(5);
  });

  it("end_of_month_week_friday resolves to the Friday of the month's last week", () => {
    const c = chore({ deadline: { type: "end_of_month_week_friday" } });
    const dl = computeDeadline(c, d(2026, 1, 1), null);
    // Last week of Jan 2026 = Jan 25-31 -> Friday = Jan 30.
    expect(dl.getDate()).toBe(30);
    expect(dl.getDay()).toBe(5);
  });

  it("a chore with neither .kind nor a recognized .type defaults to end-of-day", () => {
    expect(computeDeadline(chore({ deadline: {} }), d(2026, 6, 1), null).getHours()).toBe(23);
    expect(computeDeadline(chore({ deadline: undefined }), d(2026, 6, 1), null).getHours()).toBe(23);
  });
});

describe("compareChoreOrder", () => {
  it("sorts ascending by a positive sortOrder", () => {
    const a = { sortOrder: 2, title: "B" };
    const b = { sortOrder: 1, title: "A" };
    expect(compareChoreOrder(a, b)).toBeGreaterThan(0);
    expect(compareChoreOrder(b, a)).toBeLessThan(0);
  });

  it("an unranked chore (sortOrder 0 or null) SINKS below every ranked chore", () => {
    const ranked = { sortOrder: 5, title: "Zzz ranked" };
    const unranked = { sortOrder: 0, title: "Aaa unranked" };
    // Even though "Aaa" alphabetically precedes "Zzz", the ranked one wins.
    expect(compareChoreOrder(ranked, unranked)).toBeLessThan(0);
    expect(compareChoreOrder(null, undefined)).toBe(0);
  });

  it("two unranked chores tie-break alphabetically by title", () => {
    const a = { sortOrder: null, title: "Banana" };
    const b = { sortOrder: null, title: "Apple" };
    expect(compareChoreOrder(a, b)).toBeGreaterThan(0);
    expect(compareChoreOrder(b, a)).toBeLessThan(0);
  });

  it("handles null/undefined chores without throwing", () => {
    expect(() => compareChoreOrder(null, { title: "x" })).not.toThrow();
    expect(() => compareChoreOrder(undefined, undefined)).not.toThrow();
  });
});

describe("resolveAssignees — precedence (chore rule > block rule > legacy byDayOfWeek > legacy default > [])", () => {
  it("an active chore-scoped rule wins outright", () => {
    const c = chore({ id: "c1", blockId: BID.morning });
    const rulesByChoreId = new Map([
      ["c1", [{ daysOfWeek: [1], assignees: ["James"], priority: 1 }]],
    ]);
    // Monday.
    expect(resolveAssignees(c, d(2026, 6, 1), { rulesByChoreId })).toEqual(["James"]);
  });

  it("multiple candidate chore rules: highest priority (pre-sorted by caller) wins", () => {
    const c = chore({ id: "c1" });
    // The hook delivers rules pre-sorted priority desc; pickRule takes the first match.
    const rulesByChoreId = new Map([
      ["c1", [
        { daysOfWeek: [3], assignees: ["James", "Jim"], priority: 10 }, // Wed
        { daysOfWeek: [1, 3, 5], assignees: ["James"], priority: 1 },
      ]],
    ]);
    expect(resolveAssignees(c, d(2026, 6, 3), { rulesByChoreId })).toEqual(["James", "Jim"]);
  });

  it("falls through to a block-scoped rule when no chore rule matches that weekday", () => {
    const c = chore({ id: "c1", blockId: BID.morning });
    const rulesByChoreId = new Map([
      ["c1", [{ daysOfWeek: [3], assignees: ["James"], priority: 1 }]], // Wed only
    ]);
    const rulesByBlockId = new Map([
      [BID.morning, [{ daysOfWeek: [1], assignees: ["Jim"], priority: 1 }]], // Mon
    ]);
    expect(resolveAssignees(c, d(2026, 6, 1), { rulesByChoreId, rulesByBlockId }))
      .toEqual(["Jim"]);
  });

  it("block-scoped rules are ignored when the chore has no blockId", () => {
    const c = chore({ id: "c1", blockId: undefined });
    const rulesByBlockId = new Map([
      [BID.morning, [{ daysOfWeek: [1], assignees: ["Jim"], priority: 1 }]],
    ]);
    expect(resolveAssignees(c, d(2026, 6, 1), { rulesByBlockId })).toEqual([]);
  });

  it("falls back to legacy assignment.byDayOfWeek when no rules match", () => {
    const c = chore({ assignment: { byDayOfWeek: { 1: "James" } } });
    expect(resolveAssignees(c, d(2026, 6, 1))).toEqual(["James"]);
    expect(resolveAssignees(c, d(2026, 6, 2))).toEqual([]); // Tue not in the map, no default
  });

  it("falls back to legacy assignment.default when byDayOfWeek doesn't match", () => {
    const c = chore({ assignment: { byDayOfWeek: { 1: "James" }, default: "Jim" } });
    expect(resolveAssignees(c, d(2026, 6, 2))).toEqual(["Jim"]); // Tue -> default
  });

  it("returns [] (unassigned) when nothing matches anywhere — a valid state (S90)", () => {
    expect(resolveAssignees(chore(), d(2026, 6, 1))).toEqual([]);
  });

  it("returns [] for a null chore rather than throwing", () => {
    expect(resolveAssignees(null, d(2026, 6, 1))).toEqual([]);
  });

  it("a rule's daysOfWeek must be an array — a malformed rule is skipped, not crashed on", () => {
    const c = chore({ id: "c1" });
    const rulesByChoreId = new Map([
      ["c1", [{ daysOfWeek: "not-an-array", assignees: ["James"], priority: 1 }]],
    ]);
    expect(resolveAssignees(c, d(2026, 6, 1), { rulesByChoreId })).toEqual([]);
  });
});

describe("resolveAssignee (single-name shim)", () => {
  it("joins multiple resolved assignees with ' · ' (Wed/Sat/Sun both rule)", () => {
    const c = chore({ id: "c1" });
    const rulesByChoreId = new Map([
      ["c1", [{ daysOfWeek: [3], assignees: ["James", "Jim"], priority: 1 }]],
    ]);
    expect(resolveAssignee(c, d(2026, 6, 3), { rulesByChoreId })).toBe("James · Jim");
  });

  it("returns null (not '' or undefined) when unassigned", () => {
    expect(resolveAssignee(chore(), d(2026, 6, 1))).toBeNull();
  });
});

describe("expandChoreForDay / getChoresForDay", () => {
  it("returns null when the chore doesn't fire that day", () => {
    const c = chore({ frequency: { type: "weekly", days: [1] } });
    expect(expandChoreForDay(c, d(2026, 6, 2))).toBeNull(); // Tuesday
  });

  it("returns a populated instance (choreId/chore/date/startAt/deadlineAt/assignees) when it fires", () => {
    const c = chore({ id: "c1", frequency: { type: "daily" }, startTime: "07:00" });
    const inst = expandChoreForDay(c, d(2026, 6, 1));
    expect(inst.choreId).toBe("c1");
    expect(inst.chore).toBe(c);
    expect(inst.startAt).toBeInstanceOf(Date);
    expect(inst.deadlineAt).toBeInstanceOf(Date);
    expect(inst.assignees).toEqual([]);
    expect(inst.assignee).toBeNull();
  });

  it("getChoresForDay filters the definition set down to what fires, preserving seed order", () => {
    const defs = [
      chore({ id: "mon-only", frequency: { type: "weekly", days: [1] } }),
      chore({ id: "daily", frequency: { type: "daily" } }),
      chore({ id: "wed-only", frequency: { type: "weekly", days: [3] } }),
    ];
    const out = getChoresForDay({ chores: { definitions: defs } }, d(2026, 6, 1)); // Monday
    expect(out.map((i) => i.choreId)).toEqual(["mon-only", "daily"]);
  });

  it("getChoresForDay with no data falls back to the built-in CHORE_SEEDS (never throws)", () => {
    expect(() => getChoresForDay({}, d(2026, 6, 1))).not.toThrow();
    expect(Array.isArray(getChoresForDay({}, d(2026, 6, 1)))).toBe(true);
  });
});

describe("choresRemainingToday (the Chores sidebar badge)", () => {
  const monday = d(2026, 6, 1);
  const farmData = { chores: { definitions: [
    chore({ id: "feed-layers", frequency: { type: "daily" } }),
    chore({ id: "move-tractors", frequency: { type: "daily" } }),
    chore({ id: "wed-only", frequency: { type: "weekly", days: [3] } }),
  ] } };

  it("counts every due chore while nothing is completed", () => {
    const dueOnMonday = 2; // wed-only doesn't fire
    expect(choresRemainingToday(farmData, monday, new Set()))
      .toBe(dueOnMonday);
  });

  it("drops a chore once any completion is logged for it today", () => {
    const completed = new Set(["feed-layers"]);
    expect(choresRemainingToday(farmData, monday, completed)).toBe(1);
  });

  it("treats a missing completed set (completions still loading) as none", () => {
    expect(choresRemainingToday(farmData, monday)).toBe(2);
  });
});

describe("describeFrequency", () => {
  it("labels every frequency type distinctly and legibly", () => {
    expect(describeFrequency(chore({ frequency: { type: "daily" } }))).toBe("Every day");
    expect(describeFrequency(chore({ frequency: { type: "weekly", days: [1, 3, 5] } })))
      .toBe("Mon / Wed / Fri");
    expect(describeFrequency(chore({ frequency: { type: "weekly" } }))).toBe("Weekly");
    expect(describeFrequency(chore({ frequency: { type: "monthly_last_week", day: 1 } })))
      .toBe("Monthly (last week) — Mon");
    expect(describeFrequency(chore({ frequency: { type: "every_n", unit: "months", n: 3, day: 1 } })))
      .toBe("Every 3 months — Mon");
    expect(describeFrequency(chore({ frequency: { type: "every_n", unit: "months", n: 1 } })))
      .toBe("Every 1 month"); // singular unit when n===1
    expect(describeFrequency(chore({ frequency: { type: "event" } }))).toBe("Event-triggered");
    expect(describeFrequency(chore({ frequency: { type: "once", date: "2026-03-15" } })))
      .toBe("One-time — Mar 15");
    expect(describeFrequency(chore({ frequency: undefined }))).toBe("—");
  });
});

describe("choreDaysRemaining — block_on_weekday deadline chores", () => {
  it("returns { kind:'days', days:N } when the target weekday is still ahead", () => {
    const c = chore({ deadline: { kind: "block_on_weekday", block: "late_afternoon", weekday: 5 } });
    // Monday -> Friday is 4 days out.
    const r = choreDaysRemaining(c, d(2026, 6, 1, 9), FIVE_BLOCKS);
    expect(r).toEqual({ kind: "days", days: 4 });
  });

  it("returns { kind:'today' } when the target weekday IS today", () => {
    const c = chore({ deadline: { kind: "block_on_weekday", block: "late_afternoon", weekday: 5 } });
    const r = choreDaysRemaining(c, d(2026, 6, 5, 9), FIVE_BLOCKS); // Friday
    expect(r).toEqual({ kind: "today" });
  });

  it("non-block_on_weekday .kind deadlines never get a countdown pill", () => {
    expect(choreDaysRemaining(chore({ deadline: { kind: "following_block" } }), d(2026, 6, 1)))
      .toBeNull();
    expect(choreDaysRemaining(chore({ deadline: { kind: "midnight" } }), d(2026, 6, 1)))
      .toBeNull();
  });
});

describe("choreDaysRemaining — legacy window chores (weekly_window / monthly_last_week_window)", () => {
  it("counts down whole days to the window's latestDay", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    });
    const r = choreDaysRemaining(c, d(2026, 6, 1, 9), []); // Monday, latest = Friday
    expect(r).toEqual({ kind: "days", days: 4 });
  });

  it("reads 'today' once the window's last day arrives, if there's no last-chance block", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    });
    const r = choreDaysRemaining(c, d(2026, 6, 5, 9), []); // Friday itself, no lastChanceBlockId
    expect(r).toEqual({ kind: "today" });
  });

  it("flips to 'overran' once the last-chance block's window has passed on the deadline day", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
      lastChanceBlockId: BID.end_of_day,
    });
    // end_of_day = 8-9 PM; ask at 9:30 PM Friday -> the window has closed.
    const r = choreDaysRemaining(c, d(2026, 6, 5, 21, 30), FIVE_BLOCKS);
    expect(r).toEqual({ kind: "overran" });
  });

  it("stays 'today' while still inside the last-chance block's window", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
      lastChanceBlockId: BID.end_of_day,
    });
    // end_of_day = 8-9 PM; ask at 8:30 PM Friday -> still open.
    const r = choreDaysRemaining(c, d(2026, 6, 5, 20, 30), FIVE_BLOCKS);
    expect(r).toEqual({ kind: "today" });
  });

  it("returns null once today is past the window entirely (next week hasn't opened yet)", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    });
    // Saturday is past this week's Fri deadline; windowDeadlineDate returns
    // null (dow > latest), so the pill doesn't apply until next week opens.
    expect(choreDaysRemaining(c, d(2026, 6, 6, 9), [])).toBeNull();
  });

  it("gates monthly_last_week_window on BOTH being in the last week AND the day range", () => {
    const c = chore({
      deadline: {},
      frequency: { type: "monthly_last_week_window", preferredDay: 1, latestDay: 5 },
    });
    // Jan 2026 last week = Jan 25-31; today = Jan 26 (Mon), latest = Jan 30 (Fri).
    expect(choreDaysRemaining(c, d(2026, 1, 26, 9), [])).toEqual({ kind: "days", days: 4 });
    // Outside the last week entirely -> no pill.
    expect(choreDaysRemaining(c, d(2026, 1, 12, 9), [])).toBeNull();
  });
});

describe("choreDaysRemaining — once (one-time) chores", () => {
  it("counts down to the chore's own date", () => {
    const c = chore({ deadline: {}, frequency: { type: "once", date: "2026-06-05" } });
    expect(choreDaysRemaining(c, d(2026, 6, 1, 9), [])).toEqual({ kind: "days", days: 4 });
  });

  it("reads 'today' on the date itself (no last-chance block set)", () => {
    const c = chore({ deadline: {}, frequency: { type: "once", date: "2026-06-05" } });
    expect(choreDaysRemaining(c, d(2026, 6, 5, 9), [])).toEqual({ kind: "today" });
  });

  it("reads 'overran' once the date has fully passed", () => {
    const c = chore({ deadline: {}, frequency: { type: "once", date: "2026-06-01" } });
    expect(choreDaysRemaining(c, d(2026, 6, 5, 9), [])).toEqual({ kind: "overran" });
  });

  it("returns null when the once chore has no date", () => {
    expect(choreDaysRemaining(chore({ deadline: {}, frequency: { type: "once" } }), d(2026, 6, 1)))
      .toBeNull();
  });
});

describe("choreDaysRemaining — 'anytime' chores (no blockId) and single-block daily chores", () => {
  it("an anytime daily chore (no blockId) always reads 'today' (S38 — every block is valid)", () => {
    const c = chore({
      deadline: {}, blockId: undefined, frequency: { type: "daily" },
    });
    expect(choreDaysRemaining(c, d(2026, 6, 1, 9), [])).toEqual({ kind: "today" });
  });

  it("a single-block daily chore with a fixed blockId gets NO pill (not windowy, not anytime)", () => {
    const c = chore({
      deadline: {}, blockId: BID.morning, frequency: { type: "daily" },
    });
    expect(choreDaysRemaining(c, d(2026, 6, 1, 9), FIVE_BLOCKS)).toBeNull();
  });

  it("a single-block specific_days chore with a fixed blockId also gets no pill", () => {
    const c = chore({
      deadline: {}, blockId: BID.morning, frequency: { type: "specific_days", days: [1] },
    });
    expect(choreDaysRemaining(c, d(2026, 6, 1, 9), FIVE_BLOCKS)).toBeNull();
  });
});

describe("choreDaysRemaining — misc guards", () => {
  it("returns null for a null/undefined chore", () => {
    expect(choreDaysRemaining(null)).toBeNull();
    expect(choreDaysRemaining(undefined)).toBeNull();
  });
});

describe("displayDeadlineDateShort", () => {
  it("formats the resolved deadline date as 'Dow Mon D' only for multi-day countdowns", () => {
    // The formatted date comes from computeDeadline, so the chore needs
    // a real deadline alongside its window (as live window chores carry).
    const c = chore({
      deadline: { type: "end_of_week_friday" },
      frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    });
    // Monday 2026-06-01, deadline Friday 2026-06-05.
    expect(displayDeadlineDateShort(c, d(2026, 6, 1, 9), [])).toBe("Fri Jun 5");
  });

  it("returns '' for a same-day (today/overran) or non-applicable chore", () => {
    const todayChore = chore({ blockId: undefined, deadline: {}, frequency: { type: "daily" } });
    expect(displayDeadlineDateShort(todayChore, d(2026, 6, 1, 9), [])).toBe("");
    const noPill = chore({ blockId: BID.morning, deadline: {}, frequency: { type: "daily" } });
    expect(displayDeadlineDateShort(noPill, d(2026, 6, 1, 9), FIVE_BLOCKS)).toBe("");
  });
});

// ── obligationPlaceIds — the anchor system ──────────────────────────────
// ctx = { placesById, childrenByParent, placementsByPlaceId, groupsById,
//         placementsByOccupant, speciesById }.
function makeCtx(over = {}) {
  const placesById = new Map([
    ["farm", { id: "farm", name: "Farm", parentId: null, isActive: true }],
    ["pastureA", { id: "pastureA", name: "Pasture A", parentId: "farm", isActive: true, kindTag: "pasture" }],
    ["pastureB", { id: "pastureB", name: "Pasture B", parentId: "farm", isActive: true, kindTag: "pasture" }],
    ["coop1", { id: "coop1", name: "Coop 1", parentId: "pastureA", isActive: true, kindTag: "coop" }],
    ["coop2", { id: "coop2", name: "Coop 2", parentId: "pastureB", isActive: true, kindTag: "coop" }],
    ["house", { id: "house", name: "House", parentId: "farm", isActive: true, kindTag: "house" }],
    ["brooder1", { id: "brooder1", name: "Brooder 1", parentId: "farm", isActive: true }],
    ["retired", { id: "retired", name: "Retired shed", parentId: "farm", isActive: false }],
  ]);
  // childrenByParent maps parentId -> array of place OBJECTS (matches
  // buildPlaceTree's shape; descendantIds walks child.id).
  const childrenByParent = new Map([
    ["farm", ["pastureA", "pastureB", "house", "brooder1", "retired"]
      .map((id) => placesById.get(id))],
    ["pastureA", [placesById.get("coop1")]],
    ["pastureB", [placesById.get("coop2")]],
  ]);
  const placementsByPlaceId = new Map([
    ["coop1", [{ occupantType: "batch", occupantId: "layerFlockA" }]],
    ["brooder1", [{ occupantType: "batch", occupantId: "broilerBatch1" }]],
  ]);
  const groupsById = new Map([
    ["layerFlockA", { id: "layerFlockA", label: "Layer Flock A", speciesId: "layer" }],
    ["broilerBatch1", { id: "broilerBatch1", label: "Batch 1", speciesId: "broiler" }],
  ]);
  const speciesById = new Map([
    ["layer", { id: "layer", name: "Layers" }],
    ["broiler", { id: "broiler", name: "Broilers" }],
  ]);
  return {
    placesById, childrenByParent, placementsByPlaceId, groupsById, speciesById,
    placementsByOccupant: new Map(),
    ...over,
  };
}

describe("obligationPlaceIds — anchorType:'none' (whole farm)", () => {
  it("resolves to a single [null] entry (one whole-farm obligation)", () => {
    expect(obligationPlaceIds(chore({ anchorType: "none" }), makeCtx())).toEqual([null]);
  });

  it("legacy chores with neither anchorType nor placeId default to 'none'", () => {
    expect(obligationPlaceIds(chore({}), makeCtx())).toEqual([null]);
  });
});

describe("obligationPlaceIds — anchorType:'place' (fixed place, occupied or not)", () => {
  it("resolves to exactly the anchored place (mowing the lawn — always due, occupied or not)", () => {
    expect(obligationPlaceIds(chore({ anchorType: "place", placeId: "house" }), makeCtx()))
      .toEqual(["house"]);
  });

  it("resolves to [] when placeId is missing (dangling anchor)", () => {
    expect(obligationPlaceIds(chore({ anchorType: "place" }), makeCtx())).toEqual([]);
  });
});

describe("obligationPlaceIds — anchorType:'occupied_place' (brooder-style: only where actually occupied)", () => {
  it("returns only the occupied descendants of the root", () => {
    // Of the whole farm subtree, exactly brooder1 and coop1 hold a
    // batch; coop2, the pastures, and the house are skipped.
    const c = chore({ anchorType: "occupied_place", placeId: "farm" });
    expect(obligationPlaceIds(c, makeCtx()).sort())
      .toEqual(["brooder1", "coop1"]);
  });

  it("legacy chores (placeId set, no anchorType) are treated as occupied_place", () => {
    expect(obligationPlaceIds(chore({ placeId: "farm" }), makeCtx()).sort())
      .toEqual(["brooder1", "coop1"]);
  });

  it("falls back to the ROOT itself when nothing in the subtree is occupied", () => {
    const ctx = makeCtx({ placementsByPlaceId: new Map() }); // nothing occupied anywhere
    expect(obligationPlaceIds(chore({ anchorType: "occupied_place", placeId: "farm" }), ctx))
      .toEqual(["farm"]);
  });

  it("resolves to [null] (one whole-farm obligation) when placeId is missing", () => {
    expect(obligationPlaceIds(chore({ anchorType: "occupied_place" }), makeCtx()))
      .toEqual([null]);
  });
});

describe("obligationPlaceIds — anchorType:'place_kind' (every place tagged X)", () => {
  it("returns every ACTIVE place carrying the anchorKindTag, occupied or not", () => {
    const out = obligationPlaceIds(chore({ anchorType: "place_kind", anchorKindTag: "coop" }), makeCtx());
    expect(new Set(out)).toEqual(new Set(["coop1", "coop2"]));
  });

  it("excludes inactive places even if they carry the tag", () => {
    const ctx = makeCtx();
    ctx.placesById.set("coop3", { id: "coop3", kindTag: "coop", isActive: false });
    const out = obligationPlaceIds(chore({ anchorType: "place_kind", anchorKindTag: "coop" }), ctx);
    expect(out).not.toContain("coop3");
  });

  it("returns [] when no anchorKindTag is set (dangling anchor)", () => {
    expect(obligationPlaceIds(chore({ anchorType: "place_kind" }), makeCtx())).toEqual([]);
  });

  it("returns [] when nothing carries the tag", () => {
    expect(obligationPlaceIds(chore({ anchorType: "place_kind", anchorKindTag: "silo" }), makeCtx()))
      .toEqual([]);
  });
});

describe("obligationPlaceIds — anchorType:'species' (wherever active animals of the species live)", () => {
  it("resolves to every place currently housing that species", () => {
    const out = obligationPlaceIds(
      chore({ anchorType: "species", anchorSpeciesId: "layer" }), makeCtx());
    expect(out).toEqual(["coop1"]);
  });

  it("returns [] (dormant) when no active animals of the species exist anywhere", () => {
    expect(obligationPlaceIds(chore({ anchorType: "species", anchorSpeciesId: "sheep" }), makeCtx()))
      .toEqual([]);
  });

  it("narrows by anchorKindTag (housed-in filter) when set", () => {
    // Layers live in coop1 (kindTag 'coop'); asking for kindTag 'house' finds nothing.
    const out = obligationPlaceIds(
      chore({ anchorType: "species", anchorSpeciesId: "layer", anchorKindTag: "house" }), makeCtx());
    expect(out).toEqual([]);
  });

  it("collapses to atPlaceId when the work happens at a fixed place regardless of housing (egg washing)", () => {
    const out = obligationPlaceIds(
      chore({ anchorType: "species", anchorSpeciesId: "layer", atPlaceId: "house" }), makeCtx());
    // The animals' existence creates the obligation, but it fires at House.
    expect(out).toEqual(["house"]);
  });

  it("returns [] with no anchorSpeciesId set (dangling anchor)", () => {
    expect(obligationPlaceIds(chore({ anchorType: "species" }), makeCtx())).toEqual([]);
  });
});

describe("obligationPlaceIds — anchorType:'batch' (one specific livestock group)", () => {
  it("resolves to wherever that one batch currently lives", () => {
    const out = obligationPlaceIds(
      chore({ anchorType: "batch", anchorBatchId: "broilerBatch1" }), makeCtx());
    expect(out).toEqual(["brooder1"]);
  });

  it("returns [] when the batch has no active placement (already moved / dormant)", () => {
    const out = obligationPlaceIds(
      chore({ anchorType: "batch", anchorBatchId: "nonexistentBatch" }), makeCtx());
    expect(out).toEqual([]);
  });

  it("returns [] with no anchorBatchId set", () => {
    expect(obligationPlaceIds(chore({ anchorType: "batch" }), makeCtx())).toEqual([]);
  });
});

describe("obligationPlaceIds — anchorType:'former_occupancy' (clean-out-after-vacating chores)", () => {
  it("resolves to places the batch has occupied historically, filtered by kindTag", () => {
    const ctx = makeCtx({
      placementsByOccupant: new Map([
        ["batch:broilerBatch1", [
          { placeId: "brooder1" },
          { placeId: "coop1" }, // wrong kind, should be filtered out below
        ]],
      ]),
    });
    const out = obligationPlaceIds(
      chore({
        anchorType: "former_occupancy", anchorBatchId: "broilerBatch1",
      }),
      ctx,
    );
    // No kindTag filter: both history entries with active places qualify.
    expect(new Set(out)).toEqual(new Set(["brooder1", "coop1"]));
  });

  it("excludes inactive places from the occupancy history", () => {
    const ctx = makeCtx({
      placementsByOccupant: new Map([
        ["batch:broilerBatch1", [{ placeId: "retired" }, { placeId: "brooder1" }]],
      ]),
    });
    const out = obligationPlaceIds(
      chore({ anchorType: "former_occupancy", anchorBatchId: "broilerBatch1" }), ctx);
    expect(out).toEqual(["brooder1"]);
  });

  it("returns [] with no anchorBatchId set", () => {
    expect(obligationPlaceIds(chore({ anchorType: "former_occupancy" }), makeCtx())).toEqual([]);
  });
});

describe("describeChoreAnchor — human labels", () => {
  it("'none' reads 'Whole farm'", () => {
    expect(describeChoreAnchor(chore({ anchorType: "none" }), makeCtx())).toBe("Whole farm");
  });

  it("'place' reads 'Parent · Name' (skipping the farm root as an uninformative parent)", () => {
    expect(describeChoreAnchor(chore({ anchorType: "place", placeId: "coop1" }), makeCtx()))
      .toBe("Pasture A · Coop 1");
    // A place whose parent IS the farm root shows just its own name.
    expect(describeChoreAnchor(chore({ anchorType: "place", placeId: "house" }), makeCtx()))
      .toBe("House");
  });

  it("'place' with no placeId reads 'Needs re-anchoring'", () => {
    expect(describeChoreAnchor(chore({ anchorType: "place" }), makeCtx()))
      .toBe("Needs re-anchoring");
  });

  it("'occupied_place' reads 'Name · occupied'", () => {
    expect(describeChoreAnchor(chore({ anchorType: "occupied_place", placeId: "brooder1" }), makeCtx()))
      .toBe("Brooder 1 · occupied");
  });

  it("'place_kind' reads 'Every <kind>' with underscores turned to spaces", () => {
    expect(describeChoreAnchor(chore({ anchorType: "place_kind", anchorKindTag: "mobile_coop" }), makeCtx()))
      .toBe("Every mobile coop");
  });

  it("'species' reads '<Species> · in <kind>s' when a housed-in filter is set", () => {
    // kind tags are humanized: underscores become spaces.
    expect(describeChoreAnchor(
      chore({ anchorType: "species", anchorSpeciesId: "broiler", anchorKindTag: "chicken_tractor" }),
      makeCtx(),
    )).toBe("Broilers · in chicken tractors");
  });

  it("'species' with atPlaceId reads '<Species> · at <Place>' (egg-handling style)", () => {
    expect(describeChoreAnchor(
      chore({ anchorType: "species", anchorSpeciesId: "layer", atPlaceId: "house" }),
      makeCtx(),
    )).toBe("Layers · at House");
  });

  it("'batch' reads '<Label> · <Species>'", () => {
    expect(describeChoreAnchor(
      chore({ anchorType: "batch", anchorBatchId: "broilerBatch1" }), makeCtx(),
    )).toBe("Batch 1 · Broilers");
  });

  it("a dangling anchor (missing required ref) reads 'Needs re-anchoring' for every type that requires one", () => {
    expect(describeChoreAnchor(chore({ anchorType: "place_kind" }), makeCtx()))
      .toBe("Needs re-anchoring");
    expect(describeChoreAnchor(chore({ anchorType: "species" }), makeCtx()))
      .toBe("Needs re-anchoring");
    expect(describeChoreAnchor(chore({ anchorType: "batch" }), makeCtx()))
      .toBe("Needs re-anchoring");
    expect(describeChoreAnchor(chore({ anchorType: "batch", anchorBatchId: "ghost" }), makeCtx()))
      .toBe("Needs re-anchoring");
  });
});

describe("choresReferencingBlock — the soft-delete impact list (F5 step 6)", () => {
  // Archiving a block leaves every reference to it dangling — the UI
  // renders those loudly ("by end of a deleted block"), so the admin
  // must see the blast radius BEFORE confirming the archive.
  const waterByMorning = chore({
    id: "c-water",
    deadline: { kind: "block", block: BID.morning },
  });
  const morningRound = chore({
    id: "c-round",
    blockId: BID.morning,
    deadline: { kind: "midnight" },
  });
  const eveningClose = chore({
    id: "c-close",
    lastChanceBlockId: BID.morning,
    deadline: { kind: "midnight" },
  });
  const unrelated = chore({
    id: "c-other",
    deadline: { kind: "block", block: BID.end_of_day },
  });

  it("finds a chore through each of the three reference fields", () => {
    const all = [waterByMorning, morningRound, eveningClose, unrelated];
    const referencing = choresReferencingBlock(all, BID.morning);
    expect(referencing.map((c) => c.id))
      .toEqual(["c-water", "c-round", "c-close"]);
  });

  it("counts a chore once even when it references the block twice", () => {
    const doubleRef = chore({
      id: "c-double",
      blockId: BID.morning,
      deadline: { kind: "block", block: BID.morning },
    });
    expect(choresReferencingBlock([doubleRef], BID.morning))
      .toHaveLength(1);
  });

  it("is empty when nothing references the block", () => {
    expect(choresReferencingBlock([unrelated], BID.morning))
      .toEqual([]);
  });
});
