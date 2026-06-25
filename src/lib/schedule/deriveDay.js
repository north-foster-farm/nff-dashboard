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
export function getRollupAssignee(rollup, dayDate, ruleOpts) {
  const names = new Set();
  for (const inst of rollup.items) {
    const a = resolveAssignee(inst.chore, dayDate, ruleOpts);
    if (a) names.add(a);
  }
  return names.size === 1 ? [...names][0] : null;
}

// Compose the integrated day. Returns the structured shape consumers
// render from:
//   { dayISO, events, choreRollups, projects }
//
// `deltas` is the seam for schedule-local commitment overrides
// (placements, reassignments, pulled should-chores). None exist yet — they
// arrive in S6 — so this is an identity fold today. It is orphan-tolerant
// BY CONTRACT: a delta that points at a source no longer emitted by the
// derived day must be skipped, never throw (the derive-and-fold merge is
// the feature's richest bug surface; S6 fills `foldDeltas` accordingly).
export function deriveDay({ data, dayDate, dayUTC, dayISO, ruleOpts, deltas = [] }) {
  const events = getEventOccurrences(data.events, dayUTC, dayUTC, null);
  const choreRollups = rollupChoresForDay(data, dayDate, ruleOpts);
  const projects = (data.projects ?? []).filter((p) => isActiveProject(p, dayISO));
  return foldDeltas(
    { dayISO, events, choreRollups, projects },
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
