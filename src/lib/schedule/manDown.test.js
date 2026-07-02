// Man-down detection (S8) + reservation windows (S7). See story-set.md
// S39-S52 (non-work time + man-down alerts) and BD21 (a reservation is
// NOT an activity — man-down is exactly the activity-vs-reservation
// conflict).
import { describe, it, expect } from "vitest";
import {
  parseHHMM, reservationWindow, reservationWindows, computeManDown,
  pickCoverPerson, ADMINS,
} from "./manDown.js";

describe("ADMINS", () => {
  it("is the hardcoded James/Jim pair (BD29 — no users/roles system)", () => {
    expect(ADMINS).toEqual(["James", "Jim"]);
  });
});

describe("parseHHMM", () => {
  it("parses 'HH:MM' to minutes-past-midnight", () => {
    expect(parseHHMM("13:00")).toBe(780);
    expect(parseHHMM("00:00")).toBe(0);
    expect(parseHHMM("23:59")).toBe(1439);
  });

  it("parses 'HH:MM:SS' the same way (seconds ignored)", () => {
    expect(parseHHMM("13:00:00")).toBe(780);
  });

  it("returns null for garbage/missing input rather than throwing", () => {
    expect(parseHHMM(null)).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
    expect(parseHHMM("")).toBeNull();
    expect(parseHHMM("not a time")).toBeNull();
    expect(parseHHMM(1300)).toBeNull(); // not a string
  });
});

describe("reservationWindow", () => {
  it("a day_off reservation covers the whole day [0, 1440) regardless of clock_time", () => {
    const w = reservationWindow({
      assignee: "James", source_ref: { kind: "day_off" },
    });
    expect(w).toMatchObject({ assignee: "James", kind: "day_off", startMin: 0, endMin: 1440 });
  });

  it("an off-site/break/appointment reservation resolves start/end from clock_time + source_ref.end", () => {
    const w = reservationWindow({
      assignee: "James", clock_time: "13:00",
      source_ref: { kind: "off_site", end: "16:00" },
    });
    expect(w).toMatchObject({ assignee: "James", kind: "off_site", startMin: 780, endMin: 960 });
  });

  it("defaults to a 30-minute window when source_ref.end is missing", () => {
    const w = reservationWindow({ assignee: "James", clock_time: "13:00", source_ref: {} });
    expect(w.endMin).toBe(780 + 30);
  });

  it("defaults kind to 'off_site' when source_ref.kind is missing", () => {
    const w = reservationWindow({ assignee: "James", clock_time: "13:00", source_ref: {} });
    expect(w.kind).toBe("off_site");
  });

  it("returns null when clock_time is unparseable and it's not a day_off", () => {
    expect(reservationWindow({ assignee: "James", clock_time: null, source_ref: {} })).toBeNull();
  });

  it("carries a series id through when the reservation is part of a recurring set (S46)", () => {
    const w = reservationWindow({
      assignee: "James", clock_time: "13:00", source_ref: { series: "series-abc" },
    });
    expect(w.series).toBe("series-abc");
  });
});

describe("reservationWindows", () => {
  it("normalizes a list, skipping junk rows and stamping each with its commitment id", () => {
    const rows = [
      { id: "r1", assignee: "James", source_ref: { kind: "day_off" } },
      { id: "r2", assignee: null, clock_time: "13:00", source_ref: {} }, // no assignee -> dropped
      { id: "r3", assignee: "Jim", clock_time: null, source_ref: {} }, // unparseable -> dropped
    ];
    const out = reservationWindows(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "r1", assignee: "James" });
  });

  it("handles null/undefined/empty input without throwing", () => {
    expect(reservationWindows(null)).toEqual([]);
    expect(reservationWindows(undefined)).toEqual([]);
    expect(reservationWindows([])).toEqual([]);
  });
});

describe("computeManDown — inclusive start-touch (deliberate, the market hand-off case)", () => {
  it("flags a row whose block overlaps its assignee's reservation window", () => {
    const rows = [{ key: "c1@morning", assignee: "James", blockStart: 780, blockEnd: 840 }];
    const windows = [{ assignee: "James", startMin: 700, endMin: 800 }]; // 11:40-13:20 covers 13:00-14:00
    const hit = computeManDown(rows, windows);
    expect(hit.get("c1@morning")).toBeDefined();
  });

  it("QA GOTCHA pinned: a block starting EXACTLY when the reservation ends STILL flags (inclusive)", () => {
    // Someone off-site 9:00-13:00 (540-780); a chore block starting at
    // exactly 13:00 (780) still needs cover — "back exactly when the
    // market ends" is the hand-off risk this deliberately catches.
    const rows = [{ key: "c1@block", assignee: "James", blockStart: 780, blockEnd: 840 }];
    const windows = [{ assignee: "James", startMin: 540, endMin: 780 }];
    const hit = computeManDown(rows, windows);
    expect(hit.get("c1@block")).toBeDefined();
  });

  it("does NOT flag a block that ends exactly when the reservation starts", () => {
    // blockEnd(780) must be > w.startMin, not >=, so a block finishing
    // right as the reservation begins is clear.
    const rows = [{ key: "c1@block", assignee: "James", blockStart: 720, blockEnd: 780 }];
    const windows = [{ assignee: "James", startMin: 780, endMin: 900 }];
    expect(computeManDown(rows, windows).size).toBe(0);
  });

  it("never flags a DIFFERENT person's reservation (per-person, S44)", () => {
    const rows = [{ key: "c1@block", assignee: "James", blockStart: 780, blockEnd: 840 }];
    const windows = [{ assignee: "Jim", startMin: 700, endMin: 900 }];
    expect(computeManDown(rows, windows).size).toBe(0);
  });

  it("skips unassigned rows and rows with no resolved block window", () => {
    const rows = [
      { key: "a", assignee: null, blockStart: 780, blockEnd: 840 },
      { key: "b", assignee: "James", blockStart: null, blockEnd: 840 },
      { key: "c", assignee: "James", blockStart: 780, blockEnd: null },
    ];
    const windows = [{ assignee: "James", startMin: 0, endMin: 1440 }];
    expect(computeManDown(rows, windows).size).toBe(0);
  });

  it("a day_off window [0,1440) catches every assigned row that day", () => {
    const rows = [
      { key: "morning", assignee: "James", blockStart: 360, blockEnd: 420 },
      { key: "evening", assignee: "James", blockStart: 1200, blockEnd: 1260 },
    ];
    const windows = [{ assignee: "James", startMin: 0, endMin: 1440 }];
    const hits = computeManDown(rows, windows);
    expect(hits.size).toBe(2);
  });
});

describe("pickCoverPerson", () => {
  it("suggests the OTHER admin, flagged free when they have no conflicting reservation", () => {
    const cover = pickCoverPerson("James", [], 780, 840);
    expect(cover).toEqual({ person: "Jim", free: true });
  });

  it("flags free:false when the other admin ALSO has an overlapping reservation", () => {
    const windows = [{ assignee: "Jim", startMin: 700, endMin: 900 }];
    const cover = pickCoverPerson("James", windows, 780, 840);
    expect(cover).toEqual({ person: "Jim", free: false });
  });

  it("resolves symmetrically for the other assignee", () => {
    expect(pickCoverPerson("Jim", [], 780, 840)).toEqual({ person: "James", free: true });
  });

  it("returns null when the assignee isn't one of the two known admins (no 'other' to suggest)", () => {
    expect(pickCoverPerson("Guest Helper", [], 780, 840)).toBeNull();
  });
});
