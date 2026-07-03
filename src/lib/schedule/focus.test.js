import { describe, it, expect } from "vitest";
import { resolveFocusBucket } from "./focus.js";

// F45 — the Schedule's open-block resolver. `focusSel` is the user's
// intent (null = follow now, "overview" = whole-day agenda, "first" =
// the day's first block, or a concrete bucket id). It resolves against
// the CURRENT day's block buckets so a bucket carried over from another
// day (blocks differ day-to-day, e.g. overnight) can't leave the surface
// pointing at a block that doesn't exist here.
describe("resolveFocusBucket", () => {
  const buckets = ["morning", "midday", "evening"];

  it("follows the now-block when the selection is null", () => {
    const out = resolveFocusBucket({
      focusSel: null, buckets, nowBucket: "midday", nowEdge: null,
    });
    expect(out).toBe("midday");
  });

  it("lands on the last block when now is past the day's end", () => {
    const out = resolveFocusBucket({
      focusSel: null, buckets, nowBucket: null, nowEdge: "after",
    });
    expect(out).toBe("evening");
  });

  it("lands on the first block when now is before the day starts", () => {
    const out = resolveFocusBucket({
      focusSel: null, buckets, nowBucket: null, nowEdge: "before",
    });
    expect(out).toBe("morning");
  });

  it("maps the overview selection to no open block", () => {
    expect(resolveFocusBucket({ focusSel: "overview", buckets })).toBeNull();
  });

  it("resolves the 'first' landing selector to the first block", () => {
    expect(resolveFocusBucket({ focusSel: "first", buckets })).toBe("morning");
  });

  it("keeps a concrete bucket that exists on this day", () => {
    expect(resolveFocusBucket({ focusSel: "evening", buckets })).toBe("evening");
  });

  it("falls back to the first block when the bucket is absent from this day", () => {
    // 'overnight' was focused on another day and carried here, but this
    // day has no overnight block — don't leave focus dangling.
    const out = resolveFocusBucket({ focusSel: "overnight", buckets });
    expect(out).toBe("morning");
  });

  it("returns null when the day has no blocks at all", () => {
    expect(resolveFocusBucket({ focusSel: "midday", buckets: [] })).toBeNull();
  });
});
