// Schedule open-block focus resolution (F45).
//
// The Schedule keeps at most one block "open" (its detail expanded).
// `focusSel` is the user's intent, resolved to a concrete bucket id (or
// null = whole-day overview) against the CURRENT day's blocks:
//
//   null        follow now — the block the clock sits in, else the day's
//               nearest edge block (last if now is past the day, first if
//               before it)
//   "overview"  no open block (the whole-day agenda)
//   "first"     the day's first block (the landing selector from
//               Week/Month/This-Week)
//   <bucket>    that block — but only if it still exists on this day. A
//               bucket remembered from another day (blocks differ
//               day-to-day, e.g. overnight) falls back to the first block
//               rather than leaving focus pointing at a block that isn't
//               here.
export function resolveFocusBucket({
  focusSel, buckets = [], nowBucket = null, nowEdge = null,
}) {
  const first = buckets[0] ?? null;
  const last = buckets[buckets.length - 1] ?? null;

  if (focusSel === null || focusSel === undefined) {
    return nowBucket ?? (nowEdge === "after" ? last : first) ?? null;
  }
  if (focusSel === "overview") return null;
  if (focusSel === "first") return first;
  return buckets.includes(focusSel) ? focusSel : first;
}
