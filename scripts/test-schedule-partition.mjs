// Property test for the Schedule ribbon partitioner (Overnight + Project
// blocks). The partitioner is the load-bearing engine of the feature — the
// scope flags it as the richest bug surface — so this asserts its invariants
// over many randomized block/reservation/buffer configurations rather than a
// few hand-picked cases. Pure functions only; no DB, no React. Run with:
//   npm run test:partition
//
// Properties checked (per the scope's "definition of done"):
//   • projectGaps: segments are ordered, non-overlapping, non-negative,
//     >= MIN_PROJECT_GAP, clamped inside the farm-wide band, each with someone
//     free; a gap that DST/sun-drift inverts is dropped (never negative).
//   • The shrink-to-nothing case re-homes rather than orphans: a time that no
//     longer falls in any project segment routes elsewhere (segmentForStart
//     never invents a project bucket).
//   • overnightWindow: null on a down day (either side), else a valid pair;
//     inOvernight is half-open at the dawn edge (the first block's start
//     belongs to that block, not Overnight — O-B3).
//   • buildDaySegments + segmentForStart tile without overlap: any minute maps
//     to exactly one segment (or "anytime").

import {
  projectGaps, overnightWindow, inOvernight, occurringBlockWindows,
  PROJECT_DEFAULT_START, PROJECT_DEFAULT_END, MIN_PROJECT_GAP,
} from "../src/lib/schedule/partition.js";
import {
  segmentForStart, buildDaySegments,
} from "../src/lib/schedule/placement.js";

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.error("  ✗ " + msg); }
}

// Deterministic PRNG (seeded LCG) so a failure reproduces exactly.
let seed = 0x2545f491;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// A random set of "fixed"-kind chore blocks (resolveBlockMinutes returns their
// startMinutes verbatim, keeping the test deterministic — sun-kinds are
// exercised separately by the app's real data).
function randomBlocks() {
  const n = randInt(0, 5);
  const blocks = [];
  for (let i = 0; i < n; i++) {
    blocks.push({
      id: "b" + i,
      isActive: rand() < 0.85,
      startKind: "fixed",
      startMinutes: randInt(240, 1320), // 4:00a – 22:00
      durationMinutes: randInt(15, 180),
    });
  }
  return blocks;
}

function randomReservations() {
  const n = randInt(0, 3);
  const names = ["James", "Jim"];
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = randInt(240, 1200);
    out.push({
      id: "r" + i, source_type: "reservation",
      assignee: names[randInt(0, 1)],
      clock_time: hm(start),
      source_ref: { end: hm(start + randInt(30, 240)) },
    });
  }
  return out;
}
const hm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":"
  + String(m % 60).padStart(2, "0");

// ── projectGaps invariants ────────────────────────────────────────────
let projRuns = 0;
for (let t = 0; t < 4000; t++) {
  const blocks = randomBlocks();
  const reservations = randomReservations();
  const segs = projectGaps({ date: "2026-06-26", blocks, reservations });
  projRuns++;
  let prevEnd = -Infinity;
  for (const s of segs) {
    check(s.endMin > s.startMin, `seg non-negative (${s.startMin}->${s.endMin})`);
    check(s.durationMin === s.endMin - s.startMin, "durationMin matches span");
    check(s.durationMin >= MIN_PROJECT_GAP,
      `seg >= MIN_PROJECT_GAP (${s.durationMin})`);
    check(s.startMin >= PROJECT_DEFAULT_START,
      `seg start within band (${s.startMin})`);
    check(s.endMin <= PROJECT_DEFAULT_END, `seg end within band (${s.endMin})`);
    check(s.startMin >= prevEnd, "segs ordered + non-overlapping");
    check((s.who?.freeCount ?? 0) > 0, "seg has someone free");
    prevEnd = s.endMin;
  }
}

// ── shrink-to-nothing re-homes (no silent orphan) ─────────────────────
// A buffer that swallows an entire gap drops the segment; a time that was in it
// must route to "anytime" or a real block — never a phantom project bucket.
{
  const blocks = [
    { id: "m", isActive: true, startKind: "fixed", startMinutes: 360, durationMinutes: 60 },
    { id: "e", isActive: true, startKind: "fixed", startMinutes: 1020, durationMinutes: 90 },
  ];
  const wide = projectGaps({ date: "2026-06-26", blocks });
  check(wide.length === 1, "one mid-day gap before the buffer");
  const buffer = [{
    id: "buf", source_type: "buffer",
    clock_time: "08:00",
    source_ref: { end: "17:00" }, // swallows the whole 7:00–17:00 gap
  }];
  const shrunk = projectGaps({ date: "2026-06-26", blocks, buffers: buffer });
  check(shrunk.length === 0, "gap fully swallowed by buffer -> dropped");
  const segs = buildDaySegments(
    [{ bucket: "m", start: 360, end: 420 }, { bucket: "e", start: 1020, end: 1110 }],
    shrunk);
  // A 12:00 item that used to live in the gap now routes to "anytime".
  check(segmentForStart(720, segs) === "anytime",
    "shrunk-gap item re-homes to anytime (no orphan)");
}

// ── DST / sun-drift inversion clamp ───────────────────────────────────
// A block window that pushes a gap's start past its end must yield no segment
// (clamped, never negative) — the winter-sunset-inverts-summer-gap guard.
{
  const blocks = [
    // first block ends at 18:00 (1080) = the band's end; the "before-first"
    // candidate [480, firstStart] could invert. Use a first block at 7:00.
    { id: "a", isActive: true, startKind: "fixed", startMinutes: 420, durationMinutes: 30 },
    // a second block starting BEFORE the first ends (overlap) -> inverted gap.
    { id: "b", isActive: true, startKind: "fixed", startMinutes: 430, durationMinutes: 30 },
  ];
  const segs = projectGaps({ date: "2026-06-26", blocks });
  for (const s of segs) check(s.endMin > s.startMin, "no inverted segment survives");
}

// ── overnightWindow + inOvernight ─────────────────────────────────────
{
  const blocks = [
    { id: "m", isActive: true, startKind: "fixed", startMinutes: 360, durationMinutes: 60 },
    { id: "e", isActive: true, startKind: "fixed", startMinutes: 1020, durationMinutes: 90 },
  ];
  const w = overnightWindow("2026-06-26", "2026-06-27", blocks);
  check(w && w.startMin === 1110 && w.endMin === 360, "overnight window edges");
  check(overnightWindow("a", "b", []) === null, "down day -> null window");
  check(overnightWindow("a", "b", [blocks[0]]) !== null, "one frame still anchors");
  // half-open at the dawn edge: exactly the first block start is NOT overnight.
  check(inOvernight(w, w.endMin, "dawn") === false, "dawn edge excluded (O-B3)");
  check(inOvernight(w, w.endMin - 1, "dawn") === true, "just before dawn edge in");
  check(inOvernight(w, w.startMin, "evening") === true, "evening edge inclusive");
  check(inOvernight(w, w.startMin - 1, "evening") === false, "before evening edge out");
  // evening + dawn are disjoint (no minute is both).
  for (let m = 0; m < 1440; m += 7) {
    check(!(inOvernight(w, m, "evening") && inOvernight(w, m, "dawn")),
      `evening/dawn disjoint at ${m}`);
  }
}

// ── project gaps never overlap a chore-block window (the negative space) ──
// The partitioner carves gaps strictly BETWEEN sorted block windows (and
// before the first), so no project segment may overlap any occurring block —
// even when the random blocks overlap each other. This is the real tiling
// invariant (the day's chore frame + its gaps don't double-claim a minute).
const overlap = (aS, aE, bS, bE) => aS < bE && bS < aE;
for (let t = 0; t < 1500; t++) {
  const blocks = randomBlocks().filter((b) => b.isActive);
  const wins = occurringBlockWindows("2026-06-26", blocks);
  const projSegs = projectGaps({ date: "2026-06-26", blocks });
  for (const s of projSegs) {
    for (const w of wins) {
      check(!overlap(s.startMin, s.endMin, w.start, w.end),
        `project seg [${s.startMin},${s.endMin}) clear of block [${w.start},${w.end})`);
    }
  }
  // segmentForStart is total: every minute maps to some bucket (or "anytime").
  const segs = buildDaySegments(
    wins.map((w, i) => ({ bucket: "blk" + i, start: w.start, end: w.end })),
    projSegs);
  for (let m = 0; m < 1440; m += 37) {
    check(typeof segmentForStart(m, segs) === "string",
      "segmentForStart always returns a bucket");
  }
}

console.log(
  `partition property test: ${projRuns} projectGaps runs + overnight + tiling`);
if (failures > 0) {
  console.error(`\nFAILED — ${failures} assertion(s)`);
  process.exit(1);
}
console.log("ALL PROPERTIES HOLD");
