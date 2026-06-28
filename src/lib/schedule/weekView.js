// Week fullness silhouettes (S9). The week is shown as a day-list of
// silhouettes — per block, a bar whose height is the block's ITEM COUNT
// (not duration), so it needs no scheduling/duration data and stays cheap
// to compute for seven days. This is the "answers the one fair charge"
// surface from the design: the day's shape is one glance away.
import { rollupChoresForDay } from "./deriveDay.js";
import { choreDaysRemaining } from "../chores.js";

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
      block: r.block ?? null,
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

// ── Should-escalation heat (Rethinker §3.7) ────────────────────────────
// A "should" is a deferrable window chore that still has days of runway;
// it WARMS as its deadline nears (choreDaysRemaining `days` shrinks toward
// the deadline, then flips to `today`). `weekShouldHeat` reads the week as
// that pressure: per day, the hottest deferrable chore (0..1), and the one
// chore driving the week's peak — so the row can name "X warming toward Y".

const HEAT_RUNWAY = 5; // days over which a should warms from cool to hot.

function choreHeat(remaining) {
  if (!remaining) return 0;
  if (remaining.kind === "today" || remaining.kind === "overran") return 1;
  if (remaining.kind === "days") {
    const n = remaining.days;
    if (n <= 0) return 1;
    return Math.max(0, Math.min(1, (HEAT_RUNWAY - n + 1) / HEAT_RUNWAY));
  }
  return 0;
}

// Returns { days:[{date, heat, peak, topTitle}], top:{title, date}|null,
//   peakDate|null }. `top` is the week's driving should (highest heat);
// `peakDate` is the first day a should reaches its deadline.
export function weekShouldHeat(data, date, ruleOpts) {
  const blocks = ruleOpts?.blocks ?? [];
  const days = weekDays(date).map((d) => {
    const rollups = rollupChoresForDay(data, d, ruleOpts);
    let heat = 0;
    let peak = false;
    let topTitle = null;
    let topHeat = 0;
    for (const r of rollups) {
      for (const inst of r.items) {
        const rem = choreDaysRemaining(inst.chore, d, blocks);
        const h = choreHeat(rem);
        if (h <= 0) continue;
        if (rem.kind === "today" || rem.kind === "overran") peak = true;
        if (h > topHeat) { topHeat = h; topTitle = inst.chore.title; }
        if (h > heat) heat = h;
      }
    }
    return { date: d, heat, peak, topTitle };
  });

  let top = null;
  for (const day of days) {
    if (day.heat > 0 && (!top || day.heat > top.heat)) {
      top = { title: day.topTitle, heat: day.heat, date: day.date };
    }
  }
  const peakDay = days.find((d) => d.peak) ?? null;
  return { days, top, peakDate: peakDay?.date ?? null };
}
