// The weather module's pure helpers: the WMO weather-code → label
// table (describeCode) and the sunset half-hour ceiling
// (roundUpToHalfHour). The fetch/cache hook (useCurrentWeather) is
// network- and React-bound and not covered here.
import { describe, it, expect } from "vitest";
import { describeCode, roundUpToHalfHour } from "./weather.js";

describe("describeCode", () => {
  it("maps the four clear/cloud codes to their exact labels", () => {
    expect(describeCode(0)).toBe("Clear");
    expect(describeCode(1)).toBe("Mostly clear");
    expect(describeCode(2)).toBe("Partly cloudy");
    expect(describeCode(3)).toBe("Overcast");
  });

  it("both WMO fog codes (45 and 48) read as Fog", () => {
    expect(describeCode(45)).toBe("Fog");
    expect(describeCode(48)).toBe("Fog");
  });

  it("maps the precipitation ranges inclusively at both ends", () => {
    expect(describeCode(51)).toBe("Drizzle");
    expect(describeCode(57)).toBe("Drizzle");
    expect(describeCode(61)).toBe("Rain");
    expect(describeCode(67)).toBe("Rain");
    expect(describeCode(71)).toBe("Snow");
    expect(describeCode(77)).toBe("Snow");
    expect(describeCode(80)).toBe("Showers");
    expect(describeCode(82)).toBe("Showers");
    expect(describeCode(85)).toBe("Snow showers");
    expect(describeCode(86)).toBe("Snow showers");
  });

  it("everything from 95 up is Thunder", () => {
    expect(describeCode(95)).toBe("Thunder");
    expect(describeCode(99)).toBe("Thunder");
  });

  it("falls back to an em-dash for unknown or gap codes", () => {
    expect(describeCode(4)).toBe("—"); // below the fog codes
    expect(describeCode(60)).toBe("—"); // gap between drizzle/rain
    expect(describeCode(83)).toBe("—"); // gap between shower kinds
    expect(describeCode(null)).toBe("—");
    expect(describeCode(undefined)).toBe("—");
  });
});

describe("roundUpToHalfHour", () => {
  it("ceils minutes up to the next :30 mark", () => {
    expect(roundUpToHalfHour("18:01")).toBe("18:30");
    expect(roundUpToHalfHour("18:29")).toBe("18:30");
  });

  it("ceils minutes past :30 up to the next hour", () => {
    expect(roundUpToHalfHour("18:34")).toBe("19:00");
    expect(roundUpToHalfHour("09:59")).toBe("10:00");
  });

  it("keeps a time already on :00 or :30 exactly as-is", () => {
    expect(roundUpToHalfHour("18:00")).toBe("18:00");
    expect(roundUpToHalfHour("18:30")).toBe("18:30");
  });

  it("rolls 23:xx past the half hour over to midnight", () => {
    expect(roundUpToHalfHour("23:45")).toBe("00:00");
  });

  it("zero-pads single-digit hours in the output", () => {
    expect(roundUpToHalfHour("05:15")).toBe("05:30");
  });

  it("returns null for a missing time string", () => {
    expect(roundUpToHalfHour(null)).toBeNull();
    expect(roundUpToHalfHour("")).toBeNull();
    expect(roundUpToHalfHour(undefined)).toBeNull();
  });
});
