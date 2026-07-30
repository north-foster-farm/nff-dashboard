// Conflicts (Epic E — S56a/b/c the one list, S58 double-book, S61 buffer
// squeeze). Contrast with manDown.js's INCLUSIVE start-touch overlap rule
// (deliberate, the market hand-off case) — double-book and squeeze here
// use STRICT overlap, so a back-to-back same-person pair flags man-down
// but never double-book ("Man-down uses inclusive start-touch;
// double-book/squeeze use strict overlap").
import { describe, it, expect } from "vitest";
import { bufferSqueezes, doubleBookConflicts, scanHorizonConflicts } from "./conflicts.js";

function row(over = {}) {
  return { key: "k1", label: "Fill waterer", assignee: "James", blockStart: 360, blockEnd: 420, bucket: "morning", ...over };
}

describe("doubleBookConflicts — S58, strict overlap", () => {
  it("flags the SAME person assigned to two overlapping, DIFFERENT-block activities", () => {
    const rows = [
      row({ key: "a", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "b", bucket: "market", blockStart: 390, blockEnd: 450 }),
    ];
    const out = doubleBookConflicts(rows);
    expect(out).toHaveLength(1);
    // buckets keep source (row) order, like the labels field.
    expect(out[0]).toMatchObject({ type: "double", assignee: "James", buckets: ["morning", "market"] });
  });

  it("never flags two rows in the SAME bucket (that's one work session, not a clash)", () => {
    const rows = [
      row({ key: "a", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "b", bucket: "morning", blockStart: 360, blockEnd: 420 }),
    ];
    expect(doubleBookConflicts(rows)).toEqual([]);
  });

  it("QA GOTCHA pinned: a back-to-back same-person pair (touching, not overlapping) does NOT double-book", () => {
    // blockEnd of A === blockStart of B exactly — man-down's inclusive
    // rule would flag this; double-book's STRICT rule must not.
    const rows = [
      row({ key: "a", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "b", bucket: "midmorning", blockStart: 420, blockEnd: 480 }),
    ];
    expect(doubleBookConflicts(rows)).toEqual([]);
  });

  it("never flags different people even with identical overlapping windows", () => {
    const rows = [
      row({ key: "a", assignee: "James", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "b", assignee: "Jim", bucket: "market", blockStart: 390, blockEnd: 450 }),
    ];
    expect(doubleBookConflicts(rows)).toEqual([]);
  });

  it("skips unassigned rows and rows with no resolved block window", () => {
    const rows = [
      row({ key: "a", assignee: null }),
      row({ key: "b", blockStart: null }),
    ];
    expect(doubleBookConflicts(rows)).toEqual([]);
  });

  it("dedupes a many-row-per-bucket clash to ONE conflict per bucket pair", () => {
    const rows = [
      row({ key: "a1", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "a2", bucket: "morning", blockStart: 360, blockEnd: 420 }),
      row({ key: "b1", bucket: "market", blockStart: 390, blockEnd: 450 }),
    ];
    const out = doubleBookConflicts(rows);
    expect(out).toHaveLength(1);
  });

  it("a three-way overlap between the same person's buckets reports each pair once", () => {
    const rows = [
      row({ key: "a", bucket: "A", blockStart: 0, blockEnd: 100 }),
      row({ key: "b", bucket: "B", blockStart: 50, blockEnd: 150 }),
      row({ key: "c", bucket: "C", blockStart: 75, blockEnd: 200 }),
    ];
    const out = doubleBookConflicts(rows);
    // A-B, A-C, B-C = 3 distinct pairs.
    expect(out).toHaveLength(3);
  });

  it("handles an empty row list", () => {
    expect(doubleBookConflicts([])).toEqual([]);
  });
});

describe("bufferSqueezes — S61, a buffer surfaces the squeeze, never moves anything", () => {
  it("flags a buffer whose reserved window is encroached by other work", () => {
    const buffers = [{ id: "buf1", label: "Market setup", startMin: 480, endMin: 540, targetBucket: "market" }];
    const rows = [row({ key: "a", bucket: "chores", blockStart: 500, blockEnd: 560 })];
    const out = bufferSqueezes(buffers, rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "squeeze", bufferId: "buf1", bucket: "chores" });
  });

  it("a buffer's OWN target bucket is exempt from squeezing it (a buffer doesn't collide with its own anchor)", () => {
    const buffers = [{ id: "buf1", label: "Market setup", startMin: 480, endMin: 540, targetBucket: "market" }];
    const rows = [row({ key: "a", bucket: "market", blockStart: 500, blockEnd: 560 })];
    expect(bufferSqueezes(buffers, rows)).toEqual([]);
  });

  it("reports no squeeze when nothing else lands in the buffer's window", () => {
    const buffers = [{ id: "buf1", label: "Setup", startMin: 480, endMin: 540, targetBucket: "market" }];
    const rows = [row({ key: "a", bucket: "chores", blockStart: 600, blockEnd: 660 })];
    expect(bufferSqueezes(buffers, rows)).toEqual([]);
  });

  it("skips a buffer with no resolvable startMin", () => {
    const buffers = [{ id: "buf1", label: "Setup", startMin: null, endMin: 540, targetBucket: "market" }];
    const rows = [row({ blockStart: 480, blockEnd: 540 })];
    expect(bufferSqueezes(buffers, rows)).toEqual([]);
  });

  it("counts multiple encroaching items in the detail text", () => {
    const buffers = [{ id: "buf1", label: "Setup", startMin: 480, endMin: 540, targetBucket: "market" }];
    const rows = [
      row({ key: "a", bucket: "chores", blockStart: 500, blockEnd: 560 }),
      row({ key: "b", bucket: "chores2", blockStart: 490, blockEnd: 500 }),
    ];
    const out = bufferSqueezes(buffers, rows);
    expect(out[0].detail).toContain("2 items");
  });

  it("handles an empty buffers list", () => {
    expect(bufferSqueezes([], [row()])).toEqual([]);
  });
});

describe("scanHorizonConflicts — the 14-day-ahead scan", () => {
  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  function fixedBlock(id, startMinutes, durationMinutes = 60) {
    return { id, startKind: "fixed", startMinutes, durationMinutes, isActive: true };
  }
  const BLOCKS = [fixedBlock("morning", 360)];

  it("scans starting the day AFTER fromDate (never re-reports today)", () => {
    const data = { chores: { definitions: [] } };
    const out = scanHorizonConflicts({
      data, fromDate: new Date(2026, 5, 1), days: 3, ruleOpts: { blocks: BLOCKS },
      reservationsByISO: new Map(), ymd,
    });
    // No chores defined -> no conflicts regardless, but this proves the
    // call doesn't throw over an empty definitions set across the horizon.
    expect(out).toEqual([]);
  });

  it("surfaces a man-down conflict on a future day whose reservation clashes with an assigned chore", () => {
    const defs = [{
      id: "c1", title: "Fill waterer", blockId: "morning",
      frequency: { type: "daily" }, deadline: { kind: "midnight" },
      assignment: { default: "James" },
    }];
    const data = { chores: { definitions: defs } };
    const futureISO = ymd(new Date(2026, 5, 2)); // fromDate=Jun1 -> scan starts Jun2
    const reservationsByISO = new Map([
      [futureISO, [{ id: "r1", assignee: "James", source_ref: { kind: "day_off" } }]],
    ]);
    const out = scanHorizonConflicts({
      data, fromDate: new Date(2026, 5, 1), days: 1, ruleOpts: { blocks: BLOCKS },
      reservationsByISO, ymd,
    });
    expect(out.some((c) => c.type === "manDown" && c.assignee === "James")).toBe(true);
  });

  it("surfaces a double-book on a future day independent of any reservation", () => {
    const defs = [
      {
        id: "c1", title: "Fill waterer", blockId: "morning",
        frequency: { type: "daily" }, deadline: { kind: "midnight" },
        assignment: { default: "James" },
      },
      {
        id: "c2", title: "Load truck", blockId: "market",
        frequency: { type: "daily" }, deadline: { kind: "midnight" },
        assignment: { default: "James" },
      },
    ];
    const overlappingBlocks = [
      fixedBlock("morning", 360, 120), // 6:00-8:00
      fixedBlock("market", 420, 60),   // 7:00-8:00 (overlaps morning)
    ];
    const data = { chores: { definitions: defs } };
    const out = scanHorizonConflicts({
      data, fromDate: new Date(2026, 5, 1), days: 1, ruleOpts: { blocks: overlappingBlocks },
      reservationsByISO: new Map(), ymd,
    });
    expect(out.some((c) => c.type === "double" && c.assignee === "James")).toBe(true);
  });

  it("a day with no reservations skips the man-down check entirely but still checks double-book", () => {
    const defs = [{
      id: "c1", title: "Fill waterer", blockId: "morning",
      frequency: { type: "daily" }, deadline: { kind: "midnight" },
      assignment: { default: "James" },
    }];
    const data = { chores: { definitions: defs } };
    const out = scanHorizonConflicts({
      data, fromDate: new Date(2026, 5, 1), days: 5, ruleOpts: { blocks: BLOCKS },
      reservationsByISO: new Map(), ymd,
    });
    expect(out.filter((c) => c.type === "manDown")).toEqual([]);
  });
});
