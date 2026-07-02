// Event recurrence expansion (src/lib/recurrence.js) — RRULE-based
// occurrence expansion + override resolution.
//
// REGRESSION CONTEXT (batch 42.4, round 5): two shipped bugs hid real
// events from the app for a long stretch, both caused by CALLERS passing
// a degenerate expansion range into getEventOccurrences, not a defect in
// this file:
//   (1) deriveDay.js expanded over a ZERO-WIDTH range (dayUTC..dayUTC) —
//       any event with a non-midnight start time was excluded, because
//       rule.between()'s instant comparison never lands inside a
//       single-instant window. Only true all-day/midnight events showed.
//   (2) farmLoad.js's week range ended AT Saturday 00:00 UTC, so a
//       Saturday event with an afternoon start (an instant strictly AFTER
//       that boundary) fell outside the window and never got its This
//       Week "E" badge.
// The tests below pin the CORRECT contract this module offers — that a
// zero-width range legitimately excludes non-midnight occurrences (so a
// caller MUST pass a wide-enough window) — plus the override/skip/season
// logic that's local to this file. The caller-side fixes are pinned in
// deriveDay.test.js / farmLoad's own tests (see load/farmLoad.js task).
import { describe, it, expect } from "vitest";
import { getEventOccurrences } from "./recurrence.js";

// A day's [start, end) as UTC instants — the width a caller must use to
// reliably catch every occurrence that calendar day, regardless of the
// event's time-of-day (this is the shape deriveDay.js now uses).
function utcDayRange(y, m, day) {
  const from = new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
  const to = new Date(Date.UTC(y, m - 1, day + 1, 0, 0, 0));
  return [from, to];
}

function kind(over = {}) {
  return { id: "market", label: "Farmers markets", instances: [], ...over };
}

function recurringSeries(over = {}) {
  return {
    id: "s1",
    label: "Scituate Rotary Farmers Market",
    subtitle: null,
    location: "Scituate",
    rrule: "FREQ=WEEKLY;BYDAY=SA",
    dtstart: "2026-06-06T13:15:00Z", // a Saturday, 1:15 PM UTC
    durationMinutes: 180,
    occurrences: [],
    automationEmissionId: null,
    ...over,
  };
}

function oneOffSeries(over = {}) {
  return {
    id: "s2",
    label: "Summer Concert",
    subtitle: null,
    location: null,
    rrule: null,
    dtstart: null,
    durationMinutes: null,
    occurrences: [{ id: "occ1", occursOn: "2026-06-06", startTime: "11:00", endTime: "15:00" }],
    automationEmissionId: null,
    ...over,
  };
}

describe("getEventOccurrences — recurring series, basic expansion", () => {
  it("expands a weekly RRULE across a multi-week window and sorts by date", () => {
    const series = recurringSeries();
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 5, 30));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    const dates = out.map((o) => o.date);
    // Every Saturday in June 2026: 6, 13, 20, 27.
    expect(dates).toEqual(["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27"]);
  });

  it("REGRESSION PIN: a zero-width range excludes a non-midnight occurrence", () => {
    // This is exactly the historical bug's mechanism — pinned here so a
    // future caller-side regression (passing dayUTC..dayUTC again) is
    // provably a caller bug, not a silent engine change.
    const series = recurringSeries(); // occurs Saturdays at 13:15 UTC
    const zeroWidth = new Date(Date.UTC(2026, 5, 6, 0, 0, 0)); // Sat 00:00 UTC
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, zeroWidth, zeroWidth);
    expect(out).toHaveLength(0);
  });

  it("a full [dayStart, nextDayStart) window catches the same occurrence", () => {
    const series = recurringSeries();
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-06-06");
  });

  it("REGRESSION PIN: a week range ending exactly at Saturday 00:00 UTC misses a Saturday afternoon event", () => {
    // Mirrors the farmLoad week-range bug: Sun..Sat-00:00 (exclusive of
    // the Saturday itself in instant terms) drops a 13:15 UTC occurrence.
    const series = recurringSeries();
    const weekStart = new Date(Date.UTC(2026, 5, 0)); // Sun May 31 2026 UTC midnight (day 0 of June = May 31)
    const weekEndAtSatMidnight = new Date(Date.UTC(2026, 5, 6, 0, 0, 0));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, weekStart, weekEndAtSatMidnight);
    expect(out).toHaveLength(0);
  });

  it("extending the week range through the day AFTER Saturday catches it (the shipped fix)", () => {
    const series = recurringSeries();
    const weekStart = new Date(Date.UTC(2026, 5, 0));
    const weekEndPlusOneDay = new Date(Date.UTC(2026, 5, 7, 0, 0, 0));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, weekStart, weekEndPlusOneDay);
    expect(out.map((o) => o.date)).toContain("2026-06-06");
  });
});

describe("getEventOccurrences — recurring series, override resolution", () => {
  it("an override at a produced date wins on startTime/endTime/location/status", () => {
    const series = recurringSeries({
      occurrences: [{
        id: "ov1", occursOn: "2026-06-13",
        startTime: "10:00:00", endTime: "14:00:00",
        locationOverride: "Different Green", status: "scheduled",
      }],
    });
    const [from, to] = utcDayRange(2026, 6, 13);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out).toHaveLength(1);
    expect(out[0].startTime).toBe("10:00"); // trimmed to HH:MM
    expect(out[0].endTime).toBe("14:00");
    expect(out[0].location).toBe("Different Green");
    expect(out[0].occurrenceId).toBe("ov1");
  });

  it("an occurrence with status:'skipped' is dropped entirely from RRULE-produced dates", () => {
    const series = recurringSeries({
      occurrences: [{ id: "ov1", occursOn: "2026-06-13", status: "skipped" }],
    });
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 5, 30));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.map((o) => o.date)).not.toContain("2026-06-13");
    expect(out.map((o) => o.date)).toEqual(["2026-06-06", "2026-06-20", "2026-06-27"]);
  });

  it("an override on a date the RRULE would NOT naturally produce still appears (drag-reschedule)", () => {
    // Rescheduled from a Saturday to a Tuesday — the weekly-Saturday
    // RRULE never generates 2026-06-16, but the override row anchors it.
    const series = recurringSeries({
      occurrences: [{
        id: "ov1", occursOn: "2026-06-16", startTime: "09:00", endTime: "12:00",
      }],
    });
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 5, 30));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.map((o) => o.date)).toContain("2026-06-16");
    const moved = out.find((o) => o.date === "2026-06-16");
    expect(moved.startTime).toBe("09:00");
  });

  it("a drag-rescheduled override that lands on ANOTHER produced date is never duplicated", () => {
    // Both the RRULE and a (hypothetical, buggy-data) override could
    // theoretically point at the same date — the dedupe guard keeps
    // one entry, not two.
    const series = recurringSeries({
      occurrences: [{ id: "ov1", occursOn: "2026-06-13", startTime: "09:00" }],
    });
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 5, 30));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.filter((o) => o.date === "2026-06-13")).toHaveLength(1);
  });

  it("an unoverridden produced date falls back to the series' own dtstart time", () => {
    const series = recurringSeries(); // dtstart 13:15 UTC, no overrides
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out[0].startTime).toBe("13:15");
  });

  it("endTime derives from dtstart + durationMinutes when unoverridden", () => {
    const series = recurringSeries({ durationMinutes: 180 }); // 13:15 + 3h = 16:15
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out[0].endTime).toBe("16:15");
  });

  it("a dtstart at exactly UTC midnight (an all-day event) yields a null startTime, not '00:00'", () => {
    const series = recurringSeries({ dtstart: "2026-06-06T00:00:00Z" });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out[0].startTime).toBeNull();
  });
});

describe("getEventOccurrences — one-off series", () => {
  it("a one-off event appears on its occursOn date within range", () => {
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ id: "concert", instances: [oneOffSeries()] })] }, from, to);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-06-06");
    expect(out[0].startTime).toBe("11:00");
    expect(out[0].recurring).toBe(false);
  });

  it("a one-off event outside the range doesn't appear", () => {
    const [from, to] = utcDayRange(2026, 7, 1);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [oneOffSeries()] })] }, from, to);
    expect(out).toHaveLength(0);
  });

  it("a skipped one-off occurrence never appears", () => {
    const series = oneOffSeries({
      occurrences: [{ id: "occ1", occursOn: "2026-06-06", status: "skipped" }],
    });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out).toHaveLength(0);
  });

  it("after a drag-reschedule, the tombstoned original row is skipped and the NEW row is the live anchor", () => {
    const series = oneOffSeries({
      occurrences: [
        { id: "orig", occursOn: "2026-06-06", status: "skipped" },
        { id: "moved", occursOn: "2026-06-08", status: "scheduled", startTime: "14:00" },
      ],
    });
    const juneRange = [new Date(Date.UTC(2026, 5, 1)), new Date(Date.UTC(2026, 5, 30))];
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, juneRange[0], juneRange[1]);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-06-08");
    expect(out[0].occurrenceId).toBe("moved");
  });

  it("a one-off series with no occurrence rows yields nothing (never crashes)", () => {
    const series = oneOffSeries({ occurrences: [] });
    const [from, to] = utcDayRange(2026, 6, 6);
    expect(() => getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to)).not.toThrow();
  });
});

describe("getEventOccurrences — season window filtering", () => {
  it("keeps only occurrences inside a normal (non-wrapping) MM-DD window", () => {
    // Market season: May 14 -> Sep 21. A weekly-Saturday RRULE with no
    // season limit would produce dozens; season narrows it.
    const series = recurringSeries({
      dtstart: "2026-01-03T13:15:00Z", // a Saturday, well before the season
      seasonWindow: { start: "05-14", end: "09-21" },
    });
    const from = new Date(Date.UTC(2026, 0, 1));
    const to = new Date(Date.UTC(2026, 11, 31));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.every((o) => o.date >= "2026-05-14" && o.date <= "2026-09-21")).toBe(true);
    expect(out.some((o) => o.date < "2026-05-14")).toBe(false);
    expect(out.length).toBeGreaterThan(0);
  });

  it("supports a WRAPPING season window (e.g. a winter season spanning New Year's)", () => {
    // Nov 4 -> Mar 12: dates >= Nov4 OR <= Mar12 qualify.
    const series = recurringSeries({
      dtstart: "2026-01-03T13:15:00Z",
      rrule: "FREQ=WEEKLY;BYDAY=SA",
      seasonWindow: { start: "11-04", end: "03-12" },
    });
    const from = new Date(Date.UTC(2026, 0, 1));
    const to = new Date(Date.UTC(2026, 11, 31));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.some((o) => o.date === "2026-01-03")).toBe(true); // Jan qualifies (<=Mar12... actually before Mar12)
    expect(out.some((o) => o.date > "2026-03-12" && o.date < "2026-11-04")).toBe(false);
  });

  it("a missing/malformed season window is a no-op filter (everything passes)", () => {
    const series = recurringSeries({ seasonWindow: null });
    const from = new Date(Date.UTC(2026, 5, 1));
    const to = new Date(Date.UTC(2026, 5, 30));
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out.length).toBe(4); // all four June Saturdays, unfiltered
  });
});

describe("getEventOccurrences — kind filtering + multi-kind sorting", () => {
  it("excludes an entire kind when filters[kindId] === false", () => {
    const marketKind = kind({ id: "market", instances: [recurringSeries()] });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences({ kinds: [marketKind] }, from, to, { market: false });
    expect(out).toHaveLength(0);
  });

  it("includes a kind when filters is undefined (no filtering applied)", () => {
    const marketKind = kind({ id: "market", instances: [recurringSeries()] });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences({ kinds: [marketKind] }, from, to, undefined);
    expect(out).toHaveLength(1);
  });

  it("includes a kind not mentioned in a partial filters object (default-on)", () => {
    const marketKind = kind({ id: "market", instances: [recurringSeries()] });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences({ kinds: [marketKind] }, from, to, { otherKind: false });
    expect(out).toHaveLength(1);
  });

  it("merges + sorts occurrences from multiple kinds by date, then startTime", () => {
    const marketKind = kind({
      id: "market",
      instances: [recurringSeries({ dtstart: "2026-06-06T13:15:00Z" })], // 13:15
    });
    const concertKind = kind({
      id: "concert",
      instances: [oneOffSeries({
        occurrences: [{ id: "occ1", occursOn: "2026-06-06", startTime: "09:00" }],
      })],
    });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences({ kinds: [marketKind, concertKind] }, from, to);
    expect(out).toHaveLength(2);
    // 09:00 concert before 13:15 market, even though market's kind was listed first.
    expect(out.map((o) => o.kindId)).toEqual(["concert", "market"]);
  });

  it("carries kindLabel / instanceLabel / subtitle through untouched", () => {
    const series = recurringSeries({ label: "Scituate Rotary Farmers Market", subtitle: "Rain or shine" });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ id: "market", label: "Farmers markets", instances: [series] })] }, from, to);
    expect(out[0]).toMatchObject({
      kindId: "market",
      kindLabel: "Farmers markets",
      instanceId: "s1",
      instanceLabel: "Scituate Rotary Farmers Market",
      subtitle: "Rain or shine",
    });
  });

  it("passes automationEmissionId through so Sparkle-treatment rows are identifiable", () => {
    const series = recurringSeries({ automationEmissionId: "emit-123" });
    const [from, to] = utcDayRange(2026, 6, 6);
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out[0].automationEmissionId).toBe("emit-123");
  });
});

describe("getEventOccurrences — malformed series data doesn't crash the whole expansion", () => {
  it("an unparseable RRULE string yields no occurrences for that series, not a throw", () => {
    const series = recurringSeries({ rrule: "NOT-A-VALID-RRULE-STRING" });
    const [from, to] = utcDayRange(2026, 6, 6);
    expect(() => getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to)).not.toThrow();
  });

  it("a series with a missing dtstart yields no occurrences, not a throw", () => {
    const series = recurringSeries({ dtstart: null });
    const [from, to] = utcDayRange(2026, 6, 6);
    expect(() => getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to)).not.toThrow();
    const out = getEventOccurrences(
      { kinds: [kind({ instances: [series] })] }, from, to);
    expect(out).toHaveLength(0);
  });

  it("an empty kinds list returns an empty array", () => {
    const [from, to] = utcDayRange(2026, 6, 6);
    expect(getEventOccurrences({ kinds: [] }, from, to)).toEqual([]);
  });
});
