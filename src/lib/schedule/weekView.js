// Week fullness silhouettes (S9). The week is shown as a day-list of
// silhouettes — per block, a bar whose height is the block's ITEM COUNT
// (not duration), so it needs no scheduling/duration data and stays cheap
// to compute for seven days. This is the "answers the one fair charge"
// surface from the design: the day's shape is one glance away.
import { rollupChoresForDay } from "./deriveDay.js";

// The seven dates of the week containing `date` (Sunday-first, to match the
// app's week elsewhere). Local dates, midnight.
export function weekDays(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sunday = new Date(base);
  sunday.setDate(base.getDate() - base.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

// Per-block chore counts for one day: [{ bucket, name, count }], ordered by
// block start (the block-less "anytime" bucket last). Counts are the chore
// fan-out only — enough for a silhouette.
export function blockFullness(data, date, ruleOpts) {
  const rollups = rollupChoresForDay(data, date, ruleOpts);
  return rollups
    .map((r) => ({
      bucket: r.bucket,
      name: r.block?.name ?? "Anytime",
      count: r.items.length,
      startMin: r.startMin,
    }))
    .sort((a, b) =>
      (a.startMin ?? Number.MAX_SAFE_INTEGER)
      - (b.startMin ?? Number.MAX_SAFE_INTEGER));
}

// The whole week's fullness + the max single-block count (for bar scaling).
export function weekFullness(data, date, ruleOpts) {
  const days = weekDays(date).map((d) => ({
    date: d,
    blocks: blockFullness(data, d, ruleOpts),
  }));
  let max = 1;
  for (const day of days) {
    for (const b of day.blocks) if (b.count > max) max = b.count;
  }
  const total = (day) => day.blocks.reduce((s, b) => s + b.count, 0);
  return { days: days.map((d) => ({ ...d, total: total(d) })), max };
}
