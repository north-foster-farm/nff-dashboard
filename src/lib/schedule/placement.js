// The single placement function — the catch rule shared by Overnight,
// Project auto-route, and ad-hoc add (scope §2.2). Given a start minute and
// the day's tiled segments, it returns the bucket whose half-open
// `[start, end)` window contains the minute.
//
// The day's ribbon is tiled: chore-block windows + the derived Project gaps
// (and, later, the Overnight wrap) partition the day with no overlap. Because
// the windows are HALF-OPEN, an item at *exactly* a chore block's start
// belongs to that chore block, not the gap that ends at the same minute
// (O-B3) — the gap's `end` is exclusive, the block's `start` is inclusive, so
// the boundary minute falls to the block that starts there. No second
// placement path exists; everything that needs "which segment owns this time"
// calls this.
//
// Pure + tolerant: a null/loose minute, or a minute outside every segment,
// routes to "anytime" rather than throwing.

// The block-less bucket. F30 removed "Anytime" as something the app
// offers — a chore requires a block, and no add or edit control lists
// this as a destination. What the bucket still does is catch orphans:
// a delta whose block_id no longer resolves lands here instead of
// vanishing from the day (1d1ad4a kept it for exactly that). So the
// key stays, and every surface names it for what it is through
// NO_BLOCK_LABEL rather than dressing a fallback up as a choice.
export const NO_BLOCK_BUCKET = "anytime";
export const NO_BLOCK_LABEL = "No block";

// Display name for a bucket's block: its own name, or the no-block
// label when the block didn't resolve.
export function blockLabel(block) {
  return block?.name ?? NO_BLOCK_LABEL;
}

// segments: ordered [{ bucket, start, end }] with minutes-of-day bounds
// (start inclusive, end exclusive). Returns the matching bucket, or "anytime".
export function segmentForStart(startMin, segments) {
  if (startMin == null || !Number.isFinite(startMin)) return "anytime";
  for (const s of segments ?? []) {
    if (s.start == null || s.end == null) continue;
    if (startMin >= s.start && startMin < s.end) return s.bucket;
  }
  return "anytime";
}

// Build the day's tiled segment list for routing — chore-block windows +
// derived Project gaps — each as { bucket, start, end }. `choreWindows` =
// [{ bucket, start, end }] (a chore block's resolved window); `projectSegments`
// = the partitioner's output ([{ startMin, endMin, ... }], bucketed
// "project:<startMin>"). Sorted by start so segmentForStart's first match is
// the earliest containing window (the tiling guarantees at most one).
export function buildDaySegments(choreWindows, projectSegments) {
  const out = [];
  for (const w of choreWindows ?? []) {
    if (w.start == null || w.end == null) continue;
    out.push({ bucket: w.bucket, start: w.start, end: w.end });
  }
  for (const seg of projectSegments ?? []) {
    out.push({
      bucket: "project:" + seg.startMin,
      start: seg.startMin,
      end: seg.endMin,
    });
  }
  return out.sort((a, b) => a.start - b.start);
}
