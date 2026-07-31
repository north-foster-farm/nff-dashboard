// Pure merge arithmetic for the outbox's ADDITIVE conflict policy
// (Batch 16.2). Mortality ops carry a delta, never an absolute count:
// the count is read at sync time and the delta applied against it, so
// two offline phones each logging "1 dead" sum to 2 instead of
// clobbering each other. Extracted out of lib/data/outbox.js so the
// guarantee is testable without a supabase client — the executor keeps
// the two round-trips, this decides what they write.

export function planMortalityMerge(group, delta) {
  if (!group || typeof group.count !== "number") return { skipped: true };
  const count = Math.max(0, group.count - delta);
  return { skipped: false, count, closePlacements: count === 0 };
}
