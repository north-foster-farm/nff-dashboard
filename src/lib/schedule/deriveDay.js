// The one client-side day assembler for the Schedule feature (S3).
//
// `deriveDay` folds the live sources — the chore fan-out, event
// occurrences, and active projects — into one integrated, ordered day.
// It is computed entirely in JS (no server view) so it works offline, and
// it is REGENERABLE: it reads current state, it is not authored data.
//
// The structured output (blocks each carrying their member chore
// `.items`, plus events and projects) is rich enough for two consumers:
// the Overview "schedule at a glance" card rolls a block up to a count;
// the Schedule accordion (S4) expands a block into its individual chores.
//
// This replaces the old split where Overview owned `rollupChoresForDay`
// and a separate, never-consumed `timeline_items` SQL view existed. The
// view + its dead `useTimelineItems` hook are removed; there is one
// day-assembly path, here.
import {
  getChoresForDay,
  resolveAssignee,
  getBlockStartMinutesForPeriod,
} from "../chores.js";
import { resolveBlockMinutes } from "../sunTimes.js";
import { getEventOccurrences } from "../recurrence.js";
import { isActiveProject } from "../projects.js";
import { projectGaps, PARTITION_ADMINS } from "./partition.js";
import { defaultAssignees } from "./availability.js";

// One rollup per BLOCK for a day, each carrying its member chore instances
// (.items). Chores with no block fall into an "anytime" bucket. Ordered
// downstream by the block's resolved start time.
export function rollupChoresForDay(data, dayDate, ruleOpts) {
  const blocks = ruleOpts?.blocks ?? [];
  const instances = getChoresForDay(data, dayDate, ruleOpts);
  const byBlock = {};
  for (const inst of instances) {
    (byBlock[inst.chore.blockId ?? "anytime"] ??= []).push(inst);
  }
  return Object.keys(byBlock).map((bucket) => {
    const block = blocks.find((b) => b.id === bucket) ?? null;
    const startMin = block
      ? (resolveBlockMinutes(dayDate, block.startKind, block.startMinutes)
         ?? block.startMinutes ?? null)
      : null;
    return { bucket, block, items: byBlock[bucket], startMin };
  });
}

// The morning block's resolved start minutes for a day — used to split a
// day at its morning boundary.
export function todaysMorningCutoff(data, dayDate, blocks, ruleOpts) {
  return getBlockStartMinutesForPeriod(
    getChoresForDay(data, dayDate, ruleOpts),
    "morning",
    blocks,
  );
}

// If every chore in the rollup that has an assignee resolves to the same
// single person on `dayDate`, return that name; otherwise null. Unassigned
// chores are ignored.
//
// X3 (batch 42 slice 6): when NOTHING in the block resolves to anyone
// and the caller passed ruleOpts.availability, the block falls back to
// everyone available during its window ("James · Jim") — unassigned
// stops meaning nobody's job. Nobody available → still null.
export function getRollupAssignee(rollup, dayDate, ruleOpts) {
  const names = new Set();
  for (const inst of rollup.items) {
    const a = resolveAssignee(inst.chore, dayDate, ruleOpts);
    if (a) names.add(a);
  }
  if (names.size === 1) return [...names][0];
  if (names.size > 1) return null;
  const availability = ruleOpts?.availability;
  if (!availability || rollup.startMin == null) return null;
  const endMin =
    rollup.startMin + (rollup.block?.durationMinutes ?? 0);
  const everyone = defaultAssignees(
    dayDate,
    { startMin: rollup.startMin, endMin },
    availability,
    PARTITION_ADMINS
  );
  return everyone.length > 0 ? everyone.join(" · ") : null;
}

// Compose the integrated day. Returns the structured shape consumers
// render from:
//   { dayISO, events, choreRollups, projects, projectSegments }
//
// `projectSegments` is the day's NEGATIVE space (the gaps between / before
// chore blocks) derived by the ribbon partitioner — ordered, non-overlapping
// Project blocks, each carrying structured who's-free availability. It is a
// separate field (not folded into `choreRollups`) so the load-bearing chore
// assembly stays untouched; the trailing after-last gap is Overnight,
// composed by Schedule from `partition.js`'s `overnightWindow` and not
// emitted here.
//
// `deltas` is the seam for schedule-local commitment overrides
// (placements, reassignments, pulled should-chores), folded in by
// `foldDeltas` below (S6). With no deltas it degrades to an identity
// fold. It is orphan-tolerant BY CONTRACT: a delta that points at a
// source no longer emitted by the derived day must be skipped, never
// throw (the derive-and-fold merge is the feature's richest bug
// surface).
export function deriveDay({ data, dayDate, dayUTC, dayISO, ruleOpts, deltas = [] }) {
  // Round 5 BUG FIX: the zero-width range (dayUTC..dayUTC) only matched
  // occurrences at exactly midnight — an event with a real start time
  // (rrule dtstart carrying 13:15) sits after the range end and never
  // reached the day page. Expand across the whole day, then keep the
  // day's own occurrences.
  const dayEnd = new Date(dayUTC.getTime() + 24 * 60 * 60 * 1000 - 1);
  const events = getEventOccurrences(data.events, dayUTC, dayEnd, null)
    .filter((o) => o.date === dayISO);
  const choreRollups = rollupChoresForDay(data, dayDate, ruleOpts);
  const projects = (data.projects ?? []).filter((p) => isActiveProject(p, dayISO));
  // Project blocks (the gaps) trim against the same availability the rest of
  // the day reads: time-off reservations + per-day buffer windows (the
  // all-occurrences buffer templates ride a separate hook and are folded in
  // a later batch — per-day buffers cover the explicit case for v1).
  const projectSegments = projectGaps({
    date: dayDate,
    blocks: ruleOpts?.blocks ?? [],
    reservations: deltas.filter((d) => d.source_type === "reservation"),
    buffers: deltas.filter((d) =>
      d.source_type === "buffer" && d.source_ref?.scope !== "all"),
    // Batch 42 slice 6: working hours derive the band, breaks carve
    // holes, who's-free respects time off (null = legacy band).
    availability: ruleOpts?.availability ?? null,
  });
  return foldDeltas(
    { dayISO, events, choreRollups, projects, projectSegments },
    deltas,
    ruleOpts?.blocks ?? [],
  );
}

// Fold schedule-local commitment deltas (S6) — ad-hoc tasks / notes added
// to the day — onto the derived day. Every block rollup gains an `extras`
// array of the deltas placed in it; a delta whose block has no chores
// today still gets a rollup so the block shows. Orphan-tolerant: a delta
// whose block_id is no longer a real block falls into "anytime" rather
// than throwing.
function foldDeltas(day, deltas, blocks) {
  const withExtras = (extrasOf) =>
    day.choreRollups.map((r) => ({ ...r, extras: extrasOf(r.bucket) }));

  if (!deltas || deltas.length === 0) {
    return { ...day, choreRollups: withExtras(() => []) };
  }

  const byBucket = new Map();
  for (const d of deltas) {
    // 'override' deltas edit a DERIVED instance; they're applied at the
    // place-expanded row level (applyOverrides), not as block extras here.
    // 'reservation' (time off) and 'buffer' are reserved NON-WORK time, shown
    // in the chip strip (reservation windows + buffer chips). They must never
    // fold in as block extras or they surface as phantom "(task)" rows in the
    // Anytime group and inflate the change ribbon (F25).
    if (d.source_type === "override"
        || d.source_type === "reservation"
        || d.source_type === "buffer") continue;
    // Deltas keep block_id null (the chore_block run path); their placement
    // block lives in source_ref.block_id.
    let bucket = d.block_id ?? d.source_ref?.block_id ?? "anytime";
    if (bucket !== "anytime" && !blocks.some((b) => b.id === bucket)) {
      bucket = "anytime";
    }
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(d);
  }

  const rollups = withExtras((bucket) => byBucket.get(bucket) ?? []);
  const have = new Set(rollups.map((r) => r.bucket));
  for (const [bucket, ds] of byBucket) {
    if (have.has(bucket)) continue;
    const block = bucket === "anytime"
      ? null
      : (blocks.find((b) => b.id === bucket) ?? null);
    rollups.push({
      bucket, block, items: [], extras: ds,
      startMin: block?.startMinutes ?? null,
    });
  }
  return { ...day, choreRollups: rollups };
}
