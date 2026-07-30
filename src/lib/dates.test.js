// Pure date helpers (lib/dates.js). The ISO-string functions are
// UTC-anchored by design — parseISODate/formatDate append
// "T00:00:00Z" — so assertions use toISOString / getUTC* accessors
// and stay stable across machine timezones. The two current-time
// readers (todayUTC, computeAge) run under fake timers pinned to a
// known instant and restored after each test.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseISODate,
  formatISODate,
  todayUTC,
  formatDate,
  formatLongDate,
  formatTime12h,
  computeAge,
  formatAge,
} from "./dates.js";

const utc = (y, m, day) => new Date(Date.UTC(y, m - 1, day));

afterEach(() => {
  vi.useRealTimers();
});

describe("parseISODate", () => {
  it("parses YYYY-MM-DD to midnight UTC of that calendar day", () => {
    const d = parseISODate("2026-06-03");
    expect(d.toISOString()).toBe("2026-06-03T00:00:00.000Z");
  });

  it("returns null for falsy input", () => {
    expect(parseISODate(null)).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
    expect(parseISODate("")).toBeNull();
  });

  it("returns null for a non-date string", () => {
    expect(parseISODate("not-a-date")).toBeNull();
  });

  it("rolls an out-of-range day forward instead of rejecting", () => {
    // V8's ISO parser is lenient: Feb 30 -> Mar 2.
    expect(parseISODate("2026-02-30").toISOString())
      .toBe("2026-03-02T00:00:00.000Z");
  });
});

describe("formatISODate", () => {
  it("renders a UTC-midnight date as YYYY-MM-DD", () => {
    expect(formatISODate(utc(2026, 6, 3))).toBe("2026-06-03");
  });

  it("zero-pads single-digit month and day", () => {
    expect(formatISODate(utc(2026, 1, 5))).toBe("2026-01-05");
  });

  it("round-trips with parseISODate", () => {
    expect(formatISODate(parseISODate("2025-12-31"))).toBe("2025-12-31");
  });
});

describe("todayUTC", () => {
  it("maps the LOCAL calendar date onto midnight UTC", () => {
    vi.useFakeTimers();
    // Local noon: the local calendar date is Jun 3 in every timezone.
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    expect(todayUTC().toISOString()).toBe("2026-06-03T00:00:00.000Z");
  });

  it("is always exactly midnight UTC", () => {
    const t = todayUTC();
    expect(t.getUTCHours()).toBe(0);
    expect(t.getUTCMinutes()).toBe(0);
    expect(t.getUTCSeconds()).toBe(0);
    expect(t.getUTCMilliseconds()).toBe(0);
  });

  it("round-trips losslessly through formatISODate/parseISODate", () => {
    const t = todayUTC();
    expect(parseISODate(formatISODate(t)).getTime()).toBe(t.getTime());
  });
});

describe("formatDate", () => {
  it("renders 'Mon D, YYYY' in en-US with UTC anchoring", () => {
    expect(formatDate("2026-06-03")).toBe("Jun 3, 2026");
  });

  it("returns null for falsy input", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(formatDate("garbage")).toBeNull();
  });
});

describe("formatLongDate", () => {
  it("renders 'Weekday, Month D, YYYY' with UTC anchoring", () => {
    expect(formatLongDate("2026-06-03")).toBe("Wednesday, June 3, 2026");
  });

  it("passes falsy input through unchanged (not null)", () => {
    expect(formatLongDate(null)).toBeNull();
    expect(formatLongDate("")).toBe("");
  });

  it("passes an unparseable string through unchanged", () => {
    expect(formatLongDate("garbage")).toBe("garbage");
  });
});

describe("formatTime12h", () => {
  it("returns an empty string for falsy input", () => {
    expect(formatTime12h("")).toBe("");
    expect(formatTime12h(null)).toBe("");
  });

  it("drops :00 minutes for on-the-hour times", () => {
    expect(formatTime12h("06:00")).toBe("6 AM");
    expect(formatTime12h("15:00")).toBe("3 PM");
  });

  it("keeps zero-padded minutes for off-the-hour times", () => {
    expect(formatTime12h("13:30")).toBe("1:30 PM");
    expect(formatTime12h("09:05")).toBe("9:05 AM");
  });

  it("midnight is 12 AM and noon is 12 PM", () => {
    expect(formatTime12h("00:00")).toBe("12 AM");
    expect(formatTime12h("12:00")).toBe("12 PM");
    expect(formatTime12h("00:30")).toBe("12:30 AM");
  });

  it("handles the last minute of the day", () => {
    expect(formatTime12h("23:59")).toBe("11:59 PM");
  });
});

describe("computeAge", () => {
  // Pin "now" to a UTC midnight so day-diff math is exact.
  const pinNow = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T00:00:00Z"));
  };

  it("returns 'Unknown' when the record is missing or incomplete", () => {
    expect(computeAge(null)).toBe("Unknown");
    expect(computeAge({ weeks: null, asOfDate: "2026-06-01" }))
      .toBe("Unknown");
    expect(computeAge({ weeks: 2 })).toBe("Unknown");
  });

  it("returns 'Unknown' for an unparseable asOfDate", () => {
    expect(computeAge({ weeks: 2, asOfDate: "junk" })).toBe("Unknown");
  });

  it("an as-of-today record reads back its own week count", () => {
    pinNow();
    expect(computeAge({ weeks: 2, asOfDate: "2026-06-03" }))
      .toBe("2 weeks");
  });

  it("adds elapsed days since asOfDate before formatting", () => {
    pinNow();
    // 2 weeks as of 14 days ago -> 28 days -> 4 weeks.
    expect(computeAge({ weeks: 2, asOfDate: "2026-05-20" }))
      .toBe("4 weeks");
  });

  it("a future asOfDate clamps at zero days, never negative", () => {
    pinNow();
    expect(computeAge({ weeks: 0, asOfDate: "2026-06-10" }))
      .toBe("1 week");
  });
});

describe("formatAge", () => {
  it("uses weeks through 28 days, flooring at 1 week", () => {
    expect(formatAge(0)).toBe("1 week");
    expect(formatAge(7)).toBe("1 week");
    expect(formatAge(10)).toBe("1 week"); // 1.43 wk rounds down
    expect(formatAge(28)).toBe("4 weeks");
  });

  it("switches to months from day 29", () => {
    expect(formatAge(29)).toBe("1 month");
    expect(formatAge(60)).toBe("2 months");
  });

  it("day 365 still reads as months (rounds to 11.99, under 12)", () => {
    expect(formatAge(365)).toBe("12 months");
  });

  it("a clean year boundary drops the months remainder", () => {
    expect(formatAge(366)).toBe("1 year");
  });

  it("mixes years and months past the first year", () => {
    expect(formatAge(456)).toBe("1 year, 3 months");
    expect(formatAge(761)).toBe("2 years, 1 month");
  });

  it("a remainder that rounds to 12 months rolls into a year", () => {
    // 718 days = 23.59 months -> 1 year + 11.59 -> rounds to 12.
    expect(formatAge(718)).toBe("2 years");
  });
});
