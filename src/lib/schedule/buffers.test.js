// Buffers (Epic E — S53/S54/S55/S57/S61, BD22/BD23). A buffer reserves
// adjacent time and NEVER moves or deletes the thing it buffers (S61) —
// every function here is read/derive-only against an anchor's own
// start/end; none of them can mutate the activity they're attached to.
import { describe, it, expect } from "vitest";
import {
  bufferWindow, storedBufferWindow, buildBuffer, deriveTemplateBuffer,
  buffersForTarget, describeBuffer,
} from "./buffers.js";

describe("bufferWindow", () => {
  const anchor = { startMin: 480, endMin: 540 }; // 8:00-9:00

  it("'before' reserves [start-mins, start)", () => {
    expect(bufferWindow(anchor, "before", 60)).toEqual({ startMin: 420, endMin: 480 });
  });

  it("'after' reserves [end, end+mins)", () => {
    expect(bufferWindow(anchor, "after", 30)).toEqual({ startMin: 540, endMin: 570 });
  });

  it("'both' reserves [start-mins, end+mins) — a single window on both sides", () => {
    expect(bufferWindow(anchor, "both", 15)).toEqual({ startMin: 465, endMin: 555 });
  });

  it("clamps the low end at 0 (can't reserve before midnight)", () => {
    expect(bufferWindow({ startMin: 20, endMin: 60 }, "before", 60))
      .toEqual({ startMin: 0, endMin: 20 });
  });

  it("clamps the high end at 1440 (can't reserve past midnight)", () => {
    expect(bufferWindow({ startMin: 1380, endMin: 1420 }, "after", 60))
      .toEqual({ startMin: 1420, endMin: 1440 });
  });

  it("returns null for a non-positive or non-finite mins value", () => {
    expect(bufferWindow(anchor, "before", 0)).toBeNull();
    expect(bufferWindow(anchor, "before", -10)).toBeNull();
    expect(bufferWindow(anchor, "before", NaN)).toBeNull();
    expect(bufferWindow(anchor, "before", "not a number")).toBeNull();
  });

  it("'before' with no startMin returns null (nothing to anchor before)", () => {
    expect(bufferWindow({ startMin: null, endMin: 540 }, "before", 30)).toBeNull();
  });

  it("'after' falls back to startMin as the end anchor when endMin is missing (instant activities)", () => {
    expect(bufferWindow({ startMin: 480, endMin: null }, "after", 30))
      .toEqual({ startMin: 480, endMin: 510 });
  });

  it("'after' with BOTH startMin and endMin missing returns null", () => {
    expect(bufferWindow({ startMin: null, endMin: null }, "after", 30)).toBeNull();
  });

  it("'both' requires a resolvable start; missing start returns null", () => {
    expect(bufferWindow({ startMin: null, endMin: 540 }, "both", 30)).toBeNull();
  });

  it("an unrecognized side falls through to the 'both' branch (same requirement, defensive default)", () => {
    // The source has no explicit else; anything not 'before'/'after' takes
    // the 'both' path. Pin this so a typo'd side string doesn't silently
    // become a different, unintended window shape.
    expect(bufferWindow(anchor, "sideways", 15)).toEqual({ startMin: 465, endMin: 555 });
  });
});

describe("storedBufferWindow", () => {
  it("parses clock_time + source_ref.end into a window", () => {
    const buf = { clock_time: "08:00", source_ref: { end: "09:00" } };
    expect(storedBufferWindow(buf)).toEqual({ startMin: 480, endMin: 540 });
  });

  it("returns null when either side is unparseable", () => {
    expect(storedBufferWindow({ clock_time: null, source_ref: { end: "09:00" } })).toBeNull();
    expect(storedBufferWindow({ clock_time: "08:00", source_ref: {} })).toBeNull();
  });
});

describe("buildBuffer", () => {
  const anchor = { startMin: 480, endMin: 540 };
  const target = { kind: "event", id: "ev1", label: "Farmers Market" };

  it("resolves clockTime + sourceRef.end from the chosen side/length", () => {
    const b = buildBuffer({ target, anchor, side: "before", mins: 60 });
    expect(b.clockTime).toBe("07:00");
    expect(b.sourceRef.end).toBe("08:00");
    expect(b.sourceRef.target).toBe(target);
    expect(b.sourceRef.side).toBe("before");
    expect(b.sourceRef.mins).toBe(60);
  });

  it("returns null when the window can't be resolved (e.g. 'before' with no start anchor)", () => {
    const b = buildBuffer({ target, anchor: { startMin: null, endMin: 540 }, side: "before", mins: 60 });
    expect(b).toBeNull();
  });

  it("trims and nulls an empty/whitespace-only label", () => {
    const b1 = buildBuffer({ target, anchor, side: "before", mins: 30, label: "  Setup  " });
    expect(b1.sourceRef.label).toBe("Setup");
    const b2 = buildBuffer({ target, anchor, side: "before", mins: 30, label: "   " });
    expect(b2.sourceRef.label).toBeNull();
    const b3 = buildBuffer({ target, anchor, side: "before", mins: 30 });
    expect(b3.sourceRef.label).toBeNull();
  });

  it("normalizes a checklist of plain strings into {id, text, done:false} items", () => {
    const b = buildBuffer({
      target, anchor, side: "before", mins: 60,
      checklist: ["Load tent", "Load coolers"],
    });
    expect(b.sourceRef.checklist).toEqual([
      { id: "c0", text: "Load tent", done: false },
      { id: "c1", text: "Load coolers", done: false },
    ]);
  });

  it("normalizes a checklist of {text} objects the same way", () => {
    const b = buildBuffer({
      target, anchor, side: "before", mins: 60,
      checklist: [{ text: "Load tent" }],
    });
    expect(b.sourceRef.checklist).toEqual([{ id: "c0", text: "Load tent", done: false }]);
  });

  it("drops blank/whitespace-only checklist entries", () => {
    const b = buildBuffer({
      target, anchor, side: "before", mins: 60,
      checklist: ["Load tent", "   ", "", "Load coolers"],
    });
    expect(b.sourceRef.checklist.map((c) => c.text)).toEqual(["Load tent", "Load coolers"]);
  });

  it("an empty/missing checklist yields an empty array, never undefined", () => {
    const b = buildBuffer({ target, anchor, side: "before", mins: 60 });
    expect(b.sourceRef.checklist).toEqual([]);
  });
});

describe("deriveTemplateBuffer — all-occurrences templates (S53/S54)", () => {
  const template = {
    id: "tmpl1",
    assignee: "James",
    source_ref: {
      side: "before", mins: 60,
      checklist: [{ id: "c0", text: "Load tent" }, { id: "c1", text: "Load coolers" }],
      checklistState: { "2026-06-06": { c0: true } },
    },
  };

  it("recomputes the window from THAT day's anchor (occurrences can shift time)", () => {
    const mondayAnchor = { startMin: 480, endMin: 540 }; // 8-9 this week
    const out = deriveTemplateBuffer(template, mondayAnchor, "2026-06-01");
    expect(out.clock_time).toBe("07:00");
    expect(out.source_ref.end).toBe("08:00");
  });

  it("reads the per-day checklist done-state from checklistState[dateISO]", () => {
    const out = deriveTemplateBuffer(template, { startMin: 780, endMin: 900 }, "2026-06-06");
    const byId = Object.fromEntries(out.source_ref.checklist.map((c) => [c.id, c.done]));
    expect(byId).toEqual({ c0: true, c1: false });
  });

  it("a day with NO checklistState entry resets every item to not-done (fresh per market day)", () => {
    const out = deriveTemplateBuffer(template, { startMin: 780, endMin: 900 }, "2026-06-13");
    expect(out.source_ref.checklist.every((c) => c.done === false)).toBe(true);
  });

  it("flags the derived buffer with _template:true so callers can distinguish it from a stored buffer", () => {
    const out = deriveTemplateBuffer(template, { startMin: 780, endMin: 900 }, "2026-06-13");
    expect(out._template).toBe(true);
    expect(out.id).toBe("tmpl1");
  });

  it("returns null when the day's anchor can't support the configured side", () => {
    const out = deriveTemplateBuffer(template, { startMin: null, endMin: 900 }, "2026-06-13");
    expect(out).toBeNull();
  });

  it("carries the template's assignee through", () => {
    const out = deriveTemplateBuffer(template, { startMin: 780, endMin: 900 }, "2026-06-13");
    expect(out.assignee).toBe("James");
  });
});

describe("buffersForTarget", () => {
  const buffers = [
    { id: "b1", source_ref: { target: { kind: "event", id: "ev1" } } },
    { id: "b2", source_ref: { target: { kind: "block", id: "morning" } } },
    { id: "b3", source_ref: { target: { kind: "event", id: "ev2" } } },
  ];

  it("returns only buffers targeting the given kind + id", () => {
    expect(buffersForTarget(buffers, "event", "ev1").map((b) => b.id)).toEqual(["b1"]);
  });

  it("compares ids as strings (a numeric id still matches a string target id)", () => {
    const withNumericId = [{ id: "b1", source_ref: { target: { kind: "block", id: 5 } } }];
    expect(buffersForTarget(withNumericId, "block", "5")).toHaveLength(1);
  });

  it("returns an empty array when nothing matches", () => {
    expect(buffersForTarget(buffers, "event", "nonexistent")).toEqual([]);
  });

  it("handles a null/undefined buffers list", () => {
    expect(buffersForTarget(null, "event", "ev1")).toEqual([]);
    expect(buffersForTarget(undefined, "event", "ev1")).toEqual([]);
  });
});

describe("describeBuffer", () => {
  const fmt = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const ampm = h >= 12 ? "p" : "a";
    const h12 = ((h + 11) % 12) + 1;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
  };

  it("reads 'Label · range' when a label is set", () => {
    const buf = { clock_time: "08:00", source_ref: { end: "09:00", label: "Setup" } };
    expect(describeBuffer(buf, fmt)).toBe("Setup · 8a–9a");
  });

  it("reads 'Buffer range' with no label", () => {
    const buf = { clock_time: "08:00", source_ref: { end: "09:00" } };
    expect(describeBuffer(buf, fmt)).toBe("Buffer 8a–9a");
  });

  it("falls back to the label alone (or 'Buffer') when the window can't be resolved", () => {
    const withLabel = { clock_time: null, source_ref: { label: "Setup" } };
    expect(describeBuffer(withLabel, fmt)).toBe("Setup");
    const withoutLabel = { clock_time: null, source_ref: {} };
    expect(describeBuffer(withoutLabel, fmt)).toBe("Buffer");
  });
});
