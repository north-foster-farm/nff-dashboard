// Go/no-go verification for farmLoad — the Round-3 linchpin.
// Asserts: (1) week folds the original EXACTLY (no drift), (2) per-block
// state machine (done/hole/now/committed), (3) G1 — block name/window come from
// the live blocks array, (4) man-down hole detection, (5) warming = binary
// warn/due (F24 — daily block chores don't warm, so it's empty here).
//
// RUN (plain node can't named-import the CJS `rrule` in the import chain, so
// bundle with esbuild first, from repo root):
//   npx esbuild .ignored/playbooks/design-bracket/examples/harvest-remix/round3/verify-farmload.mjs \
//     --bundle --platform=node --format=esm --outfile=/tmp/vf.mjs && node /tmp/vf.mjs
// Re-run whenever farmLoad or the walks it folds change — load-bearing.
import assert from "node:assert";
import { farmLoad, dayConflictCount }
  from "../../../../../../src/lib/load/farmLoad.js";
import { weekFullness }
  from "../../../../../../src/lib/schedule/weekView.js";

const date = new Date(2026, 5, 29); // local midnight, fixed (no Date.now)

// Two daily chores, one per block, anchor "none" -> [null] place.
const mkChore = (id, blockId) => ({
  id, title: id, frequency: { type: "daily" },
  blockId, assignment: { default: "James" },
});
const data = {
  chores: { definitions: [mkChore("c1", "b1"), mkChore("c2", "b2")] },
  projects: [], events: [],
};

const blocks = (b1name) => ([
  { id: "b1", name: b1name, slug: "b1", startKind: "fixed",
    startMinutes: 540, durationMinutes: 60, sortOrder: 0, isActive: true },
  { id: "b2", name: "Afternoon", slug: "b2", startKind: "fixed",
    startMinutes: 780, durationMinutes: 60, sortOrder: 1, isActive: true },
]);
const ruleOpts = (b1name = "Morning") => ({
  rulesByChoreId: new Map(), rulesByBlockId: new Map(), blocks: blocks(b1name),
});

// completions: c2 done, c1 not.
const completions = { isDone: (choreId) => choreId === "c2" };

// James off-site 08:00–12:00 -> overlaps b1 [09:00,10:00) -> c1 is man-down.
const deltas = [{
  id: "r1", source_type: "reservation", assignee: "James",
  clock_time: "08:00", source_ref: { kind: "off_site", end: "12:00" },
}];

const opts = ruleOpts();
const fl = farmLoad({
  data, date, ruleOpts: opts, choreCtx: {}, completions, deltas,
  nowMin: null,
});

// (1) week folds the original exactly. The week gains a per-day `events`
// count (F17 — the week-pane "E" marker); strip it to compare the fold, then
// assert every day carries the count (0 here — `events: []`).
const strippedWeek = {
  ...fl.week,
  days: fl.week.days.map(({ events, ...d }) => d),
};
assert.deepStrictEqual(
  strippedWeek, weekFullness(data, date, opts), "week must fold weekFullness");
assert.ok(
  fl.week.days.every((d) => d.events === 0),
  "each week day carries an events count (0 with no events)");

// (5) warming (F24) — binary warn/due. The fixtures are `daily` chores anchored
// to a block, which `choreDaysRemaining` does NOT count down (no window/once/
// anytime), so neither warms: warn + due are empty and `byBucket` is bare.
assert.deepStrictEqual(
  { warn: fl.warming.warn, due: fl.warming.due }, { warn: [], due: [] },
  "daily block chores produce no warn/due");
assert.strictEqual(fl.warming.byBucket.size, 0, "no per-block warming");

// (2)+(4) per-block state.
const b1 = fl.blocks.find((b) => b.blockId === "b1");
const b2 = fl.blocks.find((b) => b.blockId === "b2");
assert.ok(b1 && b2, "both blocks present");
assert.strictEqual(b1.total, 1, "b1 total");
assert.strictEqual(b1.done, 0, "b1 done");
assert.strictEqual(b1.state, "hole", "b1 is a man-down hole");
assert.strictEqual(b2.total, 1, "b2 total");
assert.strictEqual(b2.done, 1, "b2 done");
assert.strictEqual(b2.state, "done", "b2 complete");
assert.strictEqual(fl.totals.uncovered, 1, "one uncovered obligation");
assert.strictEqual(fl.totals.items, 2, "two items total");

// (4b) the exported per-day conflict engine (F17 week-pane conflict mark)
// reproduces the focal hole given the SAME reservation, and reports 0 when
// the day carries no reservation/double-book — this is what the week pane
// reads per day (man-down + double-book; buffer squeezes stay focal-only).
assert.strictEqual(
  dayConflictCount({
    data, date, ruleOpts: opts, choreCtx: {}, completions, reservations: deltas,
  }), 1, "dayConflictCount matches the focal man-down (1)");
assert.strictEqual(
  dayConflictCount({
    data, date, ruleOpts: opts, choreCtx: {}, completions, reservations: [],
  }), 0, "dayConflictCount is 0 with no reservation/double-book");

// (4c) override divergence — the real-world case: c2 lives in b2 (13:00,
// no clash with James off-site 08:00–12:00), so the raw count is 1 (c1
// only). A block-move 'override' relocates c2 into b1 (09:00, inside the
// reservation) → c2 becomes man-down too → 2. Without applying overrides
// the week pane would miss exactly this (the Sun-28 "Fill waterers" case).
const moveC2toB1 = [{
  id: "ov1", source_type: "override",
  source_ref: { target: { chore_id: "c2", place_id: null }, block_id: "b1" },
  assignee: null,
}];
assert.strictEqual(
  dayConflictCount({
    data, date, ruleOpts: opts, choreCtx: {}, completions,
    reservations: deltas, overrides: [],
  }), 1, "no override: only c1 is man-down (1)");
assert.strictEqual(
  dayConflictCount({
    data, date, ruleOpts: opts, choreCtx: {}, completions,
    reservations: deltas, overrides: moveC2toB1,
  }), 2, "block-move override relocates c2 into the reserved window (2)");

// (2) now-state when nowMin lands inside b2's window.
const flNow = farmLoad({
  data, date, ruleOpts: opts, choreCtx: {},
  completions: { isDone: () => false }, deltas: [], nowMin: 800,
});
assert.strictEqual(
  flNow.blocks.find((b) => b.blockId === "b2").state, "now",
  "nowMin inside b2 -> now");

// (3) G1: the block NAME/window come from the live blocks array.
assert.strictEqual(b1.name, "Morning", "name from blocks array");
assert.strictEqual(b1.window.startMin, 540, "window from blocks array");
const fl2 = farmLoad({
  data, date, ruleOpts: ruleOpts("Dawn patrol"), choreCtx: {},
  completions, deltas,
});
assert.strictEqual(
  fl2.blocks.find((b) => b.blockId === "b1").name, "Dawn patrol",
  "G1: renaming the block redraws the day-load name");

console.log("farmLoad verification PASSED — all", 14, "assertions hold.");
console.log("  day-load blocks:", fl.blocks.map(
  (b) => `${b.name}:${b.done}/${b.total}:${b.state}`).join("  "));
console.log("  totals:", JSON.stringify(fl.totals));
