// Sunrise/sunset block resolution (sunTimes.js). Chore blocks can pin
// their start/end to a clock time OR to the sun at the farm's Foster,
// RI coordinates; these tests lock down the pure formatters exactly
// and bound the SunCalc-derived values with ranges + relationships
// (never exact minutes — those drift with SunCalc precision), so a
// regression in kind-dispatch, midnight wrapping, or 12-hour
// formatting can't slip into every block label at once.
//
// SunCalc returns UTC instants; sunMinutesOfDay converts to LOCAL
// minutes via getHours()/getMinutes(). Pin the zone to the farm's so
// the ranges below are meaningful on any machine. Vitest isolates
// test files per worker, so this doesn't leak into other suites.
process.env.TZ = "America/New_York";

import { describe, it, expect } from "vitest";
import {
  sunMinutesOfDay,
  resolveBlockMinutes,
  formatMinutesOfDay,
  displayBlockSide,
} from "./sunTimes.js";

const d = (y, m, day) => new Date(y, m - 1, day);

// Solstices bracket the annual extremes at the farm's latitude.
const SUMMER = d(2026, 6, 21);
const WINTER = d(2026, 12, 21);

describe("sunMinutesOfDay", () => {
  it("summer sunrise at the farm lands between 4:00 and 7:00 AM", () => {
    const min = sunMinutesOfDay(SUMMER, "sunrise");
    expect(min).toBeGreaterThanOrEqual(4 * 60);
    expect(min).toBeLessThanOrEqual(7 * 60);
  });

  it("summer sunset at the farm lands between 7:00 and 10:00 PM", () => {
    const min = sunMinutesOfDay(SUMMER, "sunset");
    expect(min).toBeGreaterThanOrEqual(19 * 60);
    expect(min).toBeLessThanOrEqual(22 * 60);
  });

  it("sunset is later than sunrise on the same day", () => {
    const rise = sunMinutesOfDay(SUMMER, "sunrise");
    const set = sunMinutesOfDay(SUMMER, "sunset");
    expect(set).toBeGreaterThan(rise);
  });

  it("winter sunrise is later than summer sunrise (41.8° N)", () => {
    const winter = sunMinutesOfDay(WINTER, "sunrise");
    const summer = sunMinutesOfDay(SUMMER, "sunrise");
    expect(winter).toBeGreaterThan(summer);
  });

  it("winter daylight is far shorter than summer daylight", () => {
    const summerDay =
      sunMinutesOfDay(SUMMER, "sunset") - sunMinutesOfDay(SUMMER, "sunrise");
    const winterDay =
      sunMinutesOfDay(WINTER, "sunset") - sunMinutesOfDay(WINTER, "sunrise");
    // ~15 h vs ~9 h at this latitude; generous bounds either side.
    expect(summerDay).toBeGreaterThanOrEqual(14 * 60);
    expect(summerDay).toBeLessThanOrEqual(16 * 60);
    expect(winterDay).toBeGreaterThanOrEqual(8 * 60);
    expect(winterDay).toBeLessThanOrEqual(10 * 60);
  });

  it("returns whole minutes-of-day within [0, 1439]", () => {
    for (const kind of ["sunrise", "sunset"]) {
      const min = sunMinutesOfDay(SUMMER, kind);
      expect(Number.isInteger(min)).toBe(true);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThan(1440);
    }
  });

  it("rejects any kind other than 'sunrise'/'sunset' with null", () => {
    expect(sunMinutesOfDay(SUMMER, "noon")).toBeNull();
    expect(sunMinutesOfDay(SUMMER, "fixed")).toBeNull();
    expect(sunMinutesOfDay(SUMMER, undefined)).toBeNull();
    expect(sunMinutesOfDay(SUMMER, null)).toBeNull();
  });
});

describe("resolveBlockMinutes", () => {
  it("kind 'fixed' returns fixedMinutes verbatim", () => {
    expect(resolveBlockMinutes(SUMMER, "fixed", 360)).toBe(360);
  });

  it("kind 'fixed' preserves a midnight 0 (nullish check, not falsy)", () => {
    expect(resolveBlockMinutes(SUMMER, "fixed", 0)).toBe(0);
  });

  it("kind 'fixed' with a missing fixedMinutes resolves to null", () => {
    expect(resolveBlockMinutes(SUMMER, "fixed", undefined)).toBeNull();
    expect(resolveBlockMinutes(SUMMER, "fixed", null)).toBeNull();
  });

  it("sun kinds delegate to sunMinutesOfDay and ignore fixedMinutes", () => {
    expect(resolveBlockMinutes(SUMMER, "sunrise", 999)).toBe(
      sunMinutesOfDay(SUMMER, "sunrise")
    );
    expect(resolveBlockMinutes(SUMMER, "sunset", 999)).toBe(
      sunMinutesOfDay(SUMMER, "sunset")
    );
  });

  it("an unknown kind falls through to null (never a fixed value)", () => {
    expect(resolveBlockMinutes(SUMMER, "noon", 360)).toBeNull();
  });
});

describe("formatMinutesOfDay", () => {
  it("drops ':00' for on-the-hour times", () => {
    expect(formatMinutesOfDay(360)).toBe("6 AM");
    expect(formatMinutesOfDay(1080)).toBe("6 PM");
  });

  it("pads and shows minutes for off-hour times", () => {
    expect(formatMinutesOfDay(390)).toBe("6:30 AM");
    expect(formatMinutesOfDay(810)).toBe("1:30 PM");
    expect(formatMinutesOfDay(65)).toBe("1:05 AM");
  });

  it("renders the 12 o'clock edges correctly", () => {
    expect(formatMinutesOfDay(0)).toBe("12 AM"); // midnight
    expect(formatMinutesOfDay(720)).toBe("12 PM"); // noon
    expect(formatMinutesOfDay(750)).toBe("12:30 PM");
    expect(formatMinutesOfDay(1439)).toBe("11:59 PM");
  });

  it("wraps values outside [0, 1440) back into the day", () => {
    expect(formatMinutesOfDay(1440)).toBe("12 AM"); // next midnight
    expect(formatMinutesOfDay(1500)).toBe("1 AM"); // 25:00
    expect(formatMinutesOfDay(-60)).toBe("11 PM"); // yesterday 23:00
  });

  it("returns '' for non-numbers and NaN", () => {
    expect(formatMinutesOfDay(undefined)).toBe("");
    expect(formatMinutesOfDay(null)).toBe("");
    expect(formatMinutesOfDay("360")).toBe("");
    expect(formatMinutesOfDay(NaN)).toBe("");
  });
});

describe("displayBlockSide", () => {
  it("sun kinds label as the literal words, ignoring fixedMinutes", () => {
    expect(displayBlockSide("sunrise", 360)).toBe("sunrise");
    expect(displayBlockSide("sunset", 360)).toBe("sunset");
  });

  it("kind 'fixed' formats fixedMinutes as a clock time", () => {
    expect(displayBlockSide("fixed", 390)).toBe("6:30 AM");
    expect(displayBlockSide("fixed", 0)).toBe("12 AM");
  });

  it("a fixed side with no minutes displays as an empty string", () => {
    expect(displayBlockSide("fixed", null)).toBe("");
    expect(displayBlockSide("fixed", undefined)).toBe("");
  });
});
