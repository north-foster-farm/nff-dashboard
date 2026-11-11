// The single placement/catch-rule function (Overnight + Project auto-route
// + ad-hoc add all share this — scope §2.2). The randomized INVARIANTS
// (tiling never overlaps, segmentForStart is total, the shrink-to-nothing
// re-home case) already have dedicated property-test coverage over 4,000+
// generated configurations: `src/lib/schedule/partition.property.test.js`,
// which `npm run check` runs with everything else. This file is DELIBERATELY
// NARROWER and complementary: hand-picked, named boundary cases that read
// as documentation of the exact half-open contract (O-B3) — a regression
// here fails on ONE readable case instead of a fuzzer counterexample.
import { describe, it, expect } from "vitest";
import { segmentForStart, buildDaySegments } from "./placement.js";

describe("segmentForStart — half-open [start, end) boundary contract (O-B3)", () => {
  const segments = [
    { bucket: "morning", start: 360, end: 420 },   // 6:00-7:00
    { bucket: "project:420", start: 420, end: 600 }, // 7:00-10:00 gap
    { bucket: "midmorning", start: 600, end: 660 }, // 10:00-11:00
  ];

  it("a minute exactly at a segment's START belongs to that segment", () => {
    expect(segmentForStart(420, segments)).toBe("project:420"); // not "morning"
    expect(segmentForStart(600, segments)).toBe("midmorning"); // not "project:420"
  });

  it("a minute exactly at a segment's END belongs to the NEXT segment, not this one", () => {
    // end is exclusive: 420 is morning's end AND project's start -> project wins.
    expect(segmentForStart(419, segments)).toBe("morning");
    expect(segmentForStart(420, segments)).not.toBe("morning");
  });

  it("a minute strictly inside a segment resolves to it", () => {
    expect(segmentForStart(390, segments)).toBe("morning");
    expect(segmentForStart(500, segments)).toBe("project:420");
  });

  it("a minute before every segment routes to 'anytime'", () => {
    expect(segmentForStart(0, segments)).toBe("anytime");
    expect(segmentForStart(359, segments)).toBe("anytime");
  });

  it("a minute after every segment routes to 'anytime'", () => {
    expect(segmentForStart(660, segments)).toBe("anytime");
    expect(segmentForStart(1439, segments)).toBe("anytime");
  });

  it("a gap in the tiling (segments don't actually tile edge-to-edge) also routes to 'anytime'", () => {
    const gappy = [{ bucket: "morning", start: 360, end: 420 }, { bucket: "evening", start: 1080, end: 1140 }];
    expect(segmentForStart(700, gappy)).toBe("anytime");
  });
});

describe("segmentForStart — input guards", () => {
  const segments = [{ bucket: "morning", start: 360, end: 420 }];

  it("null/undefined/NaN startMin routes to 'anytime' rather than throwing", () => {
    expect(segmentForStart(null, segments)).toBe("anytime");
    expect(segmentForStart(undefined, segments)).toBe("anytime");
    expect(segmentForStart(NaN, segments)).toBe("anytime");
  });

  it("an empty or missing segments list routes to 'anytime'", () => {
    expect(segmentForStart(400, [])).toBe("anytime");
    expect(segmentForStart(400, null)).toBe("anytime");
    expect(segmentForStart(400, undefined)).toBe("anytime");
  });

  it("a malformed segment (null start/end) is skipped, not thrown on", () => {
    const malformed = [{ bucket: "broken", start: null, end: null }, { bucket: "morning", start: 360, end: 420 }];
    expect(() => segmentForStart(400, malformed)).not.toThrow();
    expect(segmentForStart(400, malformed)).toBe("morning");
  });
});

describe("buildDaySegments", () => {
  it("combines chore-block windows and project gaps into one flat, start-sorted list", () => {
    const choreWindows = [
      { bucket: "evening", start: 1080, end: 1140 },
      { bucket: "morning", start: 360, end: 420 },
    ];
    const projectSegments = [{ startMin: 420, endMin: 1080, who: { freeCount: 2 } }];
    const out = buildDaySegments(choreWindows, projectSegments);
    expect(out.map((s) => s.bucket)).toEqual(["morning", "project:420", "evening"]);
  });

  it("names a project segment's bucket 'project:<startMin>' (a stable, derivable id)", () => {
    const out = buildDaySegments([], [{ startMin: 480, endMin: 600 }]);
    expect(out[0]).toEqual({ bucket: "project:480", start: 480, end: 600 });
  });

  it("drops a chore window with a null start or end (an unresolved sun-time block, say)", () => {
    const choreWindows = [
      { bucket: "unresolved", start: null, end: null },
      { bucket: "morning", start: 360, end: 420 },
    ];
    const out = buildDaySegments(choreWindows, []);
    expect(out.map((s) => s.bucket)).toEqual(["morning"]);
  });

  it("handles empty/missing inputs and returns an empty array", () => {
    expect(buildDaySegments([], [])).toEqual([]);
    expect(buildDaySegments(null, null)).toEqual([]);
    expect(buildDaySegments(undefined, undefined)).toEqual([]);
  });

  it("the resulting tiling is immediately usable by segmentForStart with correct half-open semantics", () => {
    const choreWindows = [{ bucket: "morning", start: 360, end: 420 }];
    const projectSegments = [{ startMin: 420, endMin: 600 }];
    const segs = buildDaySegments(choreWindows, projectSegments);
    expect(segmentForStart(419, segs)).toBe("morning");
    expect(segmentForStart(420, segs)).toBe("project:420");
  });
});
