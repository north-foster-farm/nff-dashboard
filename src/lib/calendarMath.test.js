// Pure calendar-rail geometry + navigation helpers
// (lib/calendarMath.js). Rail math tests mostly use a 1px-per-minute
// rail over the same 5 AM–10 PM window so pixel expectations are
// exact integers; a few DEFAULT_RAIL (0.9 px/min) spot checks pin
// the shipped scale. Sun-anchored blocks are exercised only through
// the unresolvable-kind null path — real sunrise/sunset minutes are
// timezone-dependent, so they stay out of unit assertions.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_RAIL,
  railMinutes,
  railHeight,
  railHourLabels,
  hhmmToMinutes,
  minutesToY,
  blockToBand,
  eventToBlock,
  layoutOverlappingEvents,
  advanceDate,
  startOfWeek,
  formatViewLabel,
  isSameDate,
  isoDateLocal,
} from "./calendarMath.js";

const d = (y, m, day) => new Date(y, m - 1, day);

// Same window as DEFAULT_RAIL, but 1px per minute for exact math.
const PX1 = { startHour: 5, endHour: 22, pxPerMinute: 1 };

function fixedBlock(over = {}) {
  return {
    id: "b1",
    name: "Morning",
    isActive: true,
    startKind: "fixed",
    startMinutes: 360, // 6:00 AM
    durationMinutes: 60,
    ...over,
  };
}

const ANY_DAY = d(2026, 6, 3);

describe("DEFAULT_RAIL", () => {
  it("spans 5 AM to 10 PM at 0.9 px per minute", () => {
    expect(DEFAULT_RAIL.startHour).toBe(5);
    expect(DEFAULT_RAIL.endHour).toBe(22);
    expect(DEFAULT_RAIL.pxPerMinute).toBe(0.9);
  });
});

describe("railMinutes", () => {
  it("defaults to the 17-hour window (1020 minutes)", () => {
    expect(railMinutes()).toBe(1020);
  });

  it("respects a custom rail window", () => {
    expect(railMinutes({ startHour: 0, endHour: 24 })).toBe(1440);
  });
});

describe("railHeight", () => {
  it("is 918px for the default rail (1020 min x 0.9)", () => {
    expect(railHeight()).toBe(918);
  });

  it("scales with pxPerMinute", () => {
    expect(railHeight(PX1)).toBe(1020);
  });
});

describe("railHourLabels", () => {
  it("lists each start-of-hour from startHour up to endHour-1", () => {
    const labels = railHourLabels();
    expect(labels).toHaveLength(17);
    expect(labels[0]).toBe(5);
    expect(labels[labels.length - 1]).toBe(21);
  });

  it("never includes the rail's closing hour", () => {
    expect(railHourLabels()).not.toContain(22);
  });

  it("handles a custom full-day rail", () => {
    const labels = railHourLabels({ startHour: 0, endHour: 24 });
    expect(labels).toHaveLength(24);
    expect(labels[23]).toBe(23);
  });
});

describe("hhmmToMinutes", () => {
  it("converts HH:MM to minutes from midnight", () => {
    expect(hhmmToMinutes("06:30")).toBe(390);
    expect(hhmmToMinutes("22:00")).toBe(1320);
    expect(hhmmToMinutes("00:00")).toBe(0);
  });

  it("accepts a single-digit hour", () => {
    expect(hhmmToMinutes("6:30")).toBe(390);
    expect(hhmmToMinutes("0:05")).toBe(5);
  });

  it("returns null for non-string input", () => {
    expect(hhmmToMinutes(null)).toBeNull();
    expect(hhmmToMinutes(undefined)).toBeNull();
    expect(hhmmToMinutes(390)).toBeNull();
  });

  it("returns null for strings that don't lead with HH:MM", () => {
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("abc")).toBeNull();
    expect(hhmmToMinutes("6:3")).toBeNull(); // minutes need 2 digits
  });

  it("ignores anything after the leading HH:MM (no end anchor)", () => {
    expect(hhmmToMinutes("06:30:15")).toBe(390);
  });
});

describe("minutesToY", () => {
  it("returns 0 for non-numeric input", () => {
    expect(minutesToY(null)).toBe(0);
    expect(minutesToY("360")).toBe(0);
    expect(minutesToY(NaN)).toBe(0);
  });

  it("maps the rail's start minute to y = 0", () => {
    expect(minutesToY(300, PX1)).toBe(0); // 5 AM
  });

  it("scales minutes past the rail start by pxPerMinute", () => {
    expect(minutesToY(360, PX1)).toBe(60);
    expect(minutesToY(360)).toBe(54); // default 0.9 px/min
  });

  it("clamps below the rail start to 0", () => {
    expect(minutesToY(0, PX1)).toBe(0);
  });

  it("clamps above the rail end to the full rail height", () => {
    expect(minutesToY(1440, PX1)).toBe(1020);
    expect(minutesToY(1440)).toBe(918);
  });
});

describe("blockToBand", () => {
  it("returns null for a missing or inactive block", () => {
    expect(blockToBand(null, ANY_DAY, PX1)).toBeNull();
    expect(blockToBand(fixedBlock({ isActive: false }), ANY_DAY, PX1))
      .toBeNull();
  });

  it("positions a fixed block inside the rail", () => {
    const band = blockToBand(fixedBlock(), ANY_DAY, PX1);
    expect(band).toEqual({
      blockId: "b1",
      name: "Morning",
      top: 60,
      height: 60,
      startMin: 360,
      endMin: 420,
    });
  });

  it("matches the default rail's 0.9 px/min scale", () => {
    const band = blockToBand(fixedBlock(), ANY_DAY);
    expect(band.top).toBe(54);
    expect(band.height).toBe(54);
  });

  it("a missing duration yields a zero-length band 2px tall", () => {
    const band = blockToBand(
      fixedBlock({ durationMinutes: undefined }), ANY_DAY, PX1
    );
    expect(band.height).toBe(2);
    expect(band.endMin).toBe(band.startMin);
  });

  it("returns null when the block ends at or before the rail", () => {
    // 2:00–3:00 AM, and 4:00–5:00 AM ending exactly at rail start.
    expect(blockToBand(fixedBlock({ startMinutes: 120 }), ANY_DAY, PX1))
      .toBeNull();
    expect(blockToBand(fixedBlock({ startMinutes: 240 }), ANY_DAY, PX1))
      .toBeNull();
  });

  it("returns null when the block starts at or after rail end", () => {
    expect(blockToBand(fixedBlock({ startMinutes: 1320 }), ANY_DAY, PX1))
      .toBeNull();
  });

  it("clips a block straddling the rail start, keeping raw mins", () => {
    // 4:00–6:00 AM: only the 5:00–6:00 hour is on the rail.
    const band = blockToBand(
      fixedBlock({ startMinutes: 240, durationMinutes: 120 }),
      ANY_DAY, PX1
    );
    expect(band.top).toBe(0);
    expect(band.height).toBe(60);
    expect(band.startMin).toBe(240);
    expect(band.endMin).toBe(360);
  });

  it("clips a block straddling the rail end", () => {
    // 9:00–11:00 PM: only the 9:00–10:00 hour is on the rail.
    const band = blockToBand(
      fixedBlock({ startMinutes: 1260, durationMinutes: 120 }),
      ANY_DAY, PX1
    );
    expect(band.top).toBe(960);
    expect(band.height).toBe(60);
    expect(band.endMin).toBe(1380);
  });

  it("returns null when the start kind can't be resolved", () => {
    expect(blockToBand(fixedBlock({ startKind: "lunar" }), ANY_DAY, PX1))
      .toBeNull();
  });
});

describe("eventToBlock", () => {
  it("flags a time-less event and parks it at the rail top", () => {
    const block = eventToBlock({}, PX1);
    expect(block).toEqual({
      top: 0,
      height: 60, // defaultDurationMinutes * pxPerMinute
      missingTime: true,
      startMin: null,
      endMin: null,
    });
  });

  it("the time-less fallback height honors the duration option", () => {
    const block = eventToBlock({}, PX1, { defaultDurationMinutes: 90 });
    expect(block.height).toBe(90);
  });

  it("a timed event with no end gets the default duration", () => {
    const block = eventToBlock({ startTime: "06:00" }, PX1);
    expect(block).toEqual({
      top: 60,
      height: 60,
      missingTime: false,
      startMin: 360,
      endMin: 420,
    });
  });

  it("honors an explicit end time later than the start", () => {
    const block = eventToBlock(
      { startTime: "06:00", endTime: "07:30" }, PX1
    );
    expect(block.endMin).toBe(450);
    expect(block.height).toBe(90);
  });

  it("an end at or before the start falls back to the default", () => {
    const block = eventToBlock(
      { startTime: "10:00", endTime: "09:00" }, PX1
    );
    expect(block.endMin).toBe(660); // 10:00 + 60
  });

  it("an end of '00:00' means midnight CLOSING the day (1440)", () => {
    const block = eventToBlock(
      { startTime: "22:00", endTime: "00:00" }, PX1
    );
    expect(block.endMin).toBe(1440);
  });

  it("never renders shorter than 18px", () => {
    const block = eventToBlock(
      { startTime: "06:00", endTime: "06:05" }, PX1
    );
    expect(block.height).toBe(18);
  });

  it("clips to the rail but reports raw start/end minutes", () => {
    const block = eventToBlock(
      { startTime: "04:00", endTime: "06:00" }, PX1
    );
    expect(block.top).toBe(0);
    expect(block.height).toBe(60);
    expect(block.startMin).toBe(240);
    expect(block.endMin).toBe(360);
  });

  it("uses the default rail's 0.9 px/min when none is passed", () => {
    const block = eventToBlock({ startTime: "06:00" });
    expect(block.top).toBe(54);
    expect(block.height).toBe(54);
  });
});

describe("layoutOverlappingEvents", () => {
  const ev = (startTime, endTime) => ({ startTime, endTime });

  it("returns an empty array for no events", () => {
    expect(layoutOverlappingEvents([])).toEqual([]);
  });

  it("a lone event fills a single column", () => {
    const out = layoutOverlappingEvents([ev("06:00", "07:00")]);
    expect(out).toHaveLength(1);
    expect(out[0].columnIndex).toBe(0);
    expect(out[0].columnCount).toBe(1);
  });

  it("overlapping events split into side-by-side columns", () => {
    const a = ev("06:00", "07:00");
    const b = ev("06:30", "07:30");
    const out = layoutOverlappingEvents([a, b]);
    expect(out.map((p) => p.columnIndex)).toEqual([0, 1]);
    expect(out.every((p) => p.columnCount === 2)).toBe(true);
  });

  it("back-to-back events (end == next start) share a column", () => {
    const out = layoutOverlappingEvents([
      ev("06:00", "07:00"),
      ev("07:00", "08:00"),
    ]);
    expect(out.every((p) => p.columnIndex === 0)).toBe(true);
    expect(out[0].columnCount).toBe(1);
  });

  it("reuses the lowest column that has freed up", () => {
    const a = ev("06:00", "07:00");
    const b = ev("06:30", "07:30");
    const c = ev("07:00", "08:00"); // fits under a in column 0
    const out = layoutOverlappingEvents([a, b, c]);
    const byOcc = new Map(out.map((p) => [p.occurrence, p.columnIndex]));
    expect(byOcc.get(a)).toBe(0);
    expect(byOcc.get(b)).toBe(1);
    expect(byOcc.get(c)).toBe(0);
    expect(out[0].columnCount).toBe(2);
  });

  it("emits results in start-time order, not input order", () => {
    const late = ev("09:00", "10:00");
    const early = ev("06:00", "07:00");
    const out = layoutOverlappingEvents([late, early]);
    expect(out[0].occurrence).toBe(early);
    expect(out[1].occurrence).toBe(late);
  });

  it("a missing end time defaults to a 60-minute footprint", () => {
    // 06:00 open-ended blocks 06:30 but frees up 07:00.
    const out = layoutOverlappingEvents([
      ev("06:00", null),
      ev("06:30", "07:30"),
      ev("07:00", "08:00"),
    ]);
    expect(out.map((p) => p.columnIndex)).toEqual([0, 1, 0]);
  });

  it("events with no start time sort as midnight (minute 0)", () => {
    const timeless = ev(null, null);
    const timed = ev("06:00", "07:00");
    const out = layoutOverlappingEvents([timed, timeless]);
    expect(out[0].occurrence).toBe(timeless);
  });
});

describe("advanceDate", () => {
  it("steps a day at a time for the day view", () => {
    expect(isSameDate(advanceDate(d(2026, 6, 3), "day", 1), d(2026, 6, 4)))
      .toBe(true);
    expect(isSameDate(advanceDate(d(2026, 6, 1), "day", -1), d(2026, 5, 31)))
      .toBe(true);
  });

  it("treats the agenda view as day-stepping", () => {
    const out = advanceDate(d(2026, 6, 3), "agenda", 2);
    expect(isSameDate(out, d(2026, 6, 5))).toBe(true);
  });

  it("steps 7 days at a time for the week view", () => {
    const out = advanceDate(d(2026, 6, 3), "week", -1);
    expect(isSameDate(out, d(2026, 5, 27))).toBe(true);
  });

  it("steps whole calendar months for the month view", () => {
    const out = advanceDate(d(2026, 6, 15), "month", 1);
    expect(isSameDate(out, d(2026, 7, 15))).toBe(true);
  });

  it("clamps the day-of-month when the target month is shorter", () => {
    // Jan 31 + 1 month = Feb 28, not Mar 3 (setMonth overflow).
    const fwd = advanceDate(d(2026, 1, 31), "month", 1);
    expect(isSameDate(fwd, d(2026, 2, 28))).toBe(true);
    // Mar 31 - 1 month = Feb 28 going backward too.
    const back = advanceDate(d(2026, 3, 31), "month", -1);
    expect(isSameDate(back, d(2026, 2, 28))).toBe(true);
  });

  it("returns an untouched copy for an unknown unit", () => {
    const input = d(2026, 6, 3);
    const out = advanceDate(input, "year", 1);
    expect(out).not.toBe(input);
    expect(out.getTime()).toBe(input.getTime());
  });

  it("never mutates the input date", () => {
    const input = d(2026, 6, 3);
    advanceDate(input, "month", 1);
    expect(isSameDate(input, d(2026, 6, 3))).toBe(true);
  });
});

describe("startOfWeek", () => {
  it("walks a midweek date back to the previous Sunday", () => {
    // 2026-06-03 is a Wednesday.
    const out = startOfWeek(d(2026, 6, 3));
    expect(out.getDay()).toBe(0);
    expect(isSameDate(out, d(2026, 5, 31))).toBe(true);
  });

  it("a Sunday is already its own week start", () => {
    const out = startOfWeek(d(2026, 5, 31));
    expect(isSameDate(out, d(2026, 5, 31))).toBe(true);
  });

  it("zeroes the time-of-day and leaves the input alone", () => {
    const input = new Date(2026, 5, 3, 15, 45, 30);
    const out = startOfWeek(input);
    expect(out.getHours()).toBe(0);
    expect(out.getMinutes()).toBe(0);
    expect(input.getHours()).toBe(15);
  });
});

describe("formatViewLabel", () => {
  it("month view reads 'Month YYYY'", () => {
    expect(formatViewLabel("month", d(2026, 6, 15))).toBe("June 2026");
  });

  it("a same-month week collapses the second month name", () => {
    // Week of Wed Jun 10 = Sun Jun 7 – Sat Jun 13.
    expect(formatViewLabel("week", d(2026, 6, 10)))
      .toBe("Jun 7 – 13, 2026");
  });

  it("a month-spanning week names both months", () => {
    // Week of Wed Jun 3 = Sun May 31 – Sat Jun 6.
    expect(formatViewLabel("week", d(2026, 6, 3)))
      .toBe("May 31 – Jun 6, 2026");
  });

  it("any other view falls back to the full day label", () => {
    expect(formatViewLabel("day", d(2026, 6, 3)))
      .toBe("Wednesday, June 3, 2026");
  });
});

describe("isSameDate", () => {
  it("matches two times on the same local calendar day", () => {
    const a = new Date(2026, 5, 3, 1, 0);
    const b = new Date(2026, 5, 3, 23, 59);
    expect(isSameDate(a, b)).toBe(true);
  });

  it("rejects the same wall-clock time on different days", () => {
    expect(isSameDate(d(2026, 6, 3), d(2026, 6, 4))).toBe(false);
    expect(isSameDate(d(2026, 6, 3), d(2025, 6, 3))).toBe(false);
  });
});

describe("isoDateLocal", () => {
  it("renders the LOCAL calendar date as YYYY-MM-DD", () => {
    expect(isoDateLocal(d(2026, 6, 3))).toBe("2026-06-03");
  });

  it("zero-pads month and day", () => {
    expect(isoDateLocal(d(2026, 1, 5))).toBe("2026-01-05");
  });

  it("stays on the local day even late in the evening", () => {
    expect(isoDateLocal(new Date(2026, 5, 3, 23, 30)))
      .toBe("2026-06-03");
  });
});
