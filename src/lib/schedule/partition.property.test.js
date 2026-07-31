// Property test for the Schedule ribbon partitioner (Overnight +
// Project blocks). The partitioner is the load-bearing engine of the
// feature — the richest bug surface — so this asserts its invariants
// over many randomized block/reservation/buffer configurations rather
// than a few hand-picked cases. Pure functions only; no DB, no React.
//
// Lived under scripts/ as a standalone node runner until Roadmap
// 0.4: a property suite nothing gated was a property suite nobody
// ran. Folded in here so `npm run check` — and therefore the
// pre-commit hook and CI — runs it on every commit.
import { describe, it, expect } from "vitest";
import {
  projectGaps, overnightWindow, inOvernight, occurringBlockWindows,
  PROJECT_DEFAULT_START, PROJECT_DEFAULT_END, MIN_PROJECT_GAP,
} from "./partition.js";
import {
  segmentForStart, buildDaySegments,
} from "./placement.js";

const SAMPLE_DATE = "2026-06-26";
const NEXT_DATE = "2026-06-27";

const PROJECT_GAP_RUNS = 4000;
const TILING_RUNS = 1500;

// A systematic break would otherwise push tens of thousands of
// strings at the reporter; the count in the message carries the rest.
const MAX_REPORTED_VIOLATIONS = 10;

// Deterministic PRNG (seeded LCG) so a failure reproduces exactly.
// Each property builds its own generator: sharing one stream would
// make every case depend on the order the `it` blocks ran in.
function makeRandom(initialSeed) {
  let seed = initialSeed;
  const fraction = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  return {
    fraction,
    int: (lo, hi) => lo + Math.floor(fraction() * (hi - lo + 1)),
  };
}
const PROJECT_GAP_SEED = 0x2545f491;
const TILING_SEED = 0x2545f491;

const EARLIEST_START = 240; // 4:00a
const LATEST_BLOCK_START = 1320; // 10:00p
const LATEST_RESERVATION_START = 1200; // 8:00p
const LATEST_BUFFER_START = 1020; // 5:00p
const ACTIVE_BLOCK_ODDS = 0.85;
const ASSIGNEES = ["James", "Jim"];

const clockTime = (minutes) =>
  String(Math.floor(minutes / 60)).padStart(2, "0") + ":"
  + String(minutes % 60).padStart(2, "0");

// "fixed"-kind blocks only: resolveBlockMinutes returns their
// startMinutes verbatim, keeping the generated day deterministic.
// Sun-kinds are exercised separately by the app's real data.
function randomBlocks(random) {
  const blockCount = random.int(0, 5);
  return Array.from({ length: blockCount }, (_unused, index) => ({
    id: "b" + index,
    isActive: random.fraction() < ACTIVE_BLOCK_ODDS,
    startKind: "fixed",
    startMinutes: random.int(EARLIEST_START, LATEST_BLOCK_START),
    durationMinutes: random.int(15, 180),
  }));
}

function randomReservations(random) {
  const reservationCount = random.int(0, 3);
  return Array.from({ length: reservationCount }, (_unused, index) => {
    const startMin = random.int(EARLIEST_START, LATEST_RESERVATION_START);
    return {
      id: "r" + index,
      source_type: "reservation",
      assignee: ASSIGNEES[random.int(0, ASSIGNEES.length - 1)],
      clock_time: clockTime(startMin),
      source_ref: { end: clockTime(startMin + random.int(30, 240)) },
    };
  });
}

// Whole-farm buffers are what split one gap into several, so they
// are the only way to reach the sub-gap floor inside projectGaps.
// Without them the generated day exercises the outer clamp twice and
// the inner one never — a mutation that deleted the inner floor
// survived this suite until these were generated.
function randomBuffers(random) {
  const bufferCount = random.int(0, 2);
  return Array.from({ length: bufferCount }, (_unused, index) => {
    const startMin = random.int(EARLIEST_START, LATEST_BUFFER_START);
    return {
      id: "buf" + index,
      source_type: "buffer",
      clock_time: clockTime(startMin),
      source_ref: { end: clockTime(startMin + random.int(15, 150)) },
    };
  });
}

// Every invariant a project segment must satisfy on its own, plus
// ordering against the segment before it. Returns human-readable
// violations so a failure names the offending span, not an index.
function gapViolations(gaps) {
  const violations = [];
  let previousEnd = -Infinity;
  for (const gap of gaps) {
    const span = `[${gap.startMin},${gap.endMin})`;
    if (gap.endMin <= gap.startMin) {
      violations.push(`${span} is not a positive span`);
    }
    if (gap.durationMin !== gap.endMin - gap.startMin) {
      violations.push(`${span} durationMin ${gap.durationMin} != span`);
    }
    if (gap.durationMin < MIN_PROJECT_GAP) {
      violations.push(
        `${span} is ${gap.durationMin}min, under the`
        + ` ${MIN_PROJECT_GAP}min minimum`);
    }
    if (gap.startMin < PROJECT_DEFAULT_START
      || gap.endMin > PROJECT_DEFAULT_END) {
      violations.push(
        `${span} escapes the farm band`
        + ` [${PROJECT_DEFAULT_START},${PROJECT_DEFAULT_END}]`);
    }
    if (gap.startMin < previousEnd) {
      violations.push(`${span} overlaps the gap ending ${previousEnd}`);
    }
    if ((gap.who?.freeCount ?? 0) === 0) {
      violations.push(`${span} has nobody free`);
    }
    previousEnd = gap.endMin;
  }
  return violations;
}

const expectNoViolations = (violations, what) =>
  expect(
    violations.slice(0, MAX_REPORTED_VIOLATIONS),
    `${violations.length} ${what} (first`
    + ` ${MAX_REPORTED_VIOLATIONS} shown)`,
  ).toEqual([]);

describe("projectGaps over randomized days", () => {
  it("carves gaps that hold every band invariant", () => {
    const random = makeRandom(PROJECT_GAP_SEED);
    const violations = [];
    for (let run = 0; run < PROJECT_GAP_RUNS; run++) {
      const gaps = projectGaps({
        date: SAMPLE_DATE,
        blocks: randomBlocks(random),
        reservations: randomReservations(random),
        buffers: randomBuffers(random),
      });
      violations.push(
        ...gapViolations(gaps).map((why) => `run ${run}: ${why}`));
    }
    expectNoViolations(violations,
      `projectGaps invariant violation(s) across ${PROJECT_GAP_RUNS}`
      + " randomized days");
  });
});

describe("a gap that shrinks to nothing", () => {
  const morningBlock = {
    id: "m", isActive: true, startKind: "fixed",
    startMinutes: 360, durationMinutes: 60, // 6:00–7:00
  };
  const eveningBlock = {
    id: "e", isActive: true, startKind: "fixed",
    startMinutes: 1020, durationMinutes: 90, // 17:00–18:30
  };
  const blocks = [morningBlock, eveningBlock];
  const middayMinute = 720; // 12:00, inside the 7:00–17:00 gap

  it("re-homes the times it held instead of orphaning them", () => {
    const beforeBuffer = projectGaps({ date: SAMPLE_DATE, blocks });
    expect(beforeBuffer, "one mid-day gap before any buffer")
      .toHaveLength(1);

    const swallowingBuffer = [{
      id: "buf", source_type: "buffer",
      clock_time: "08:00",
      source_ref: { end: "17:00" }, // swallows the whole gap
    }];
    const afterBuffer = projectGaps({
      date: SAMPLE_DATE, blocks, buffers: swallowingBuffer,
    });
    expect(afterBuffer, "a fully-swallowed gap is dropped, not kept")
      .toEqual([]);

    const daySegments = buildDaySegments([
      { bucket: morningBlock.id, start: 360, end: 420 },
      { bucket: eveningBlock.id, start: 1020, end: 1110 },
    ], afterBuffer);
    expect(
      segmentForStart(middayMinute, daySegments),
      "a midday item whose gap vanished routes to anytime — "
      + "segmentForStart must never invent a project bucket",
    ).toBe("anytime");
  });
});

describe("DST and sun-drift inversion", () => {
  // Two blocks that overlap each other invert the candidate gap
  // between them: its start lands past its end. The winter-sunset-
  // inverts-a-summer-gap guard must clamp that away, never emit it.
  it("drops an inverted gap rather than going negative", () => {
    const overlappingBlocks = [
      {
        id: "a", isActive: true, startKind: "fixed",
        startMinutes: 420, durationMinutes: 30, // 7:00–7:30
      },
      {
        id: "b", isActive: true, startKind: "fixed",
        startMinutes: 430, durationMinutes: 30, // 7:10–7:40
      },
    ];
    const gaps = projectGaps({
      date: SAMPLE_DATE, blocks: overlappingBlocks,
    });
    const inverted = gaps.filter((gap) => gap.endMin <= gap.startMin);
    expect(inverted, "no inverted gap may survive the clamp")
      .toEqual([]);
  });
});

describe("the overnight window", () => {
  const eveningEnd = 1110; // 18:30, the last block's end
  const dawn = 360; // 6:00, the first block's start
  const blocks = [
    {
      id: "m", isActive: true, startKind: "fixed",
      startMinutes: dawn, durationMinutes: 60,
    },
    {
      id: "e", isActive: true, startKind: "fixed",
      startMinutes: 1020, durationMinutes: 90,
    },
  ];
  const window = overnightWindow(SAMPLE_DATE, NEXT_DATE, blocks);

  it("spans the last block's end to the first block's start", () => {
    expect(window).toMatchObject({
      startMin: eveningEnd, endMin: dawn,
    });
  });

  it("is null on a down day and anchors on a single frame", () => {
    expect(overnightWindow(SAMPLE_DATE, NEXT_DATE, []),
      "no blocks at all means no overnight to show").toBeNull();
    expect(overnightWindow(SAMPLE_DATE, NEXT_DATE, [blocks[0]]),
      "one block still anchors both edges").not.toBeNull();
  });

  it("is half-open at the dawn edge (O-B3)", () => {
    expect(inOvernight(window, dawn, "dawn"),
      "the first block's start belongs to that block, not overnight")
      .toBe(false);
    expect(inOvernight(window, dawn - 1, "dawn")).toBe(true);
    expect(inOvernight(window, eveningEnd, "evening"),
      "the evening edge is inclusive").toBe(true);
    expect(inOvernight(window, eveningEnd - 1, "evening")).toBe(false);
  });

  it("never counts a minute as both evening and dawn", () => {
    const MINUTES_IN_DAY = 1440;
    const bothSides = [];
    for (let minute = 0; minute < MINUTES_IN_DAY; minute++) {
      if (inOvernight(window, minute, "evening")
        && inOvernight(window, minute, "dawn")) {
        bothSides.push(minute);
      }
    }
    expect(bothSides, "evening and dawn must stay disjoint")
      .toEqual([]);
  });
});

describe("the day tiles without double-claiming a minute", () => {
  const overlaps = (aStart, aEnd, bStart, bEnd) =>
    aStart < bEnd && bStart < aEnd;

  // The partitioner carves gaps strictly BETWEEN sorted block windows
  // (and before the first), so no project gap may overlap an
  // occurring block — even when the random blocks overlap each other.
  it("keeps project gaps clear of every chore block", () => {
    const random = makeRandom(TILING_SEED);
    const violations = [];
    for (let run = 0; run < TILING_RUNS; run++) {
      const blocks = randomBlocks(random).filter((b) => b.isActive);
      const blockWindows = occurringBlockWindows(SAMPLE_DATE, blocks);
      const gaps = projectGaps({ date: SAMPLE_DATE, blocks });
      for (const gap of gaps) {
        for (const window of blockWindows) {
          if (overlaps(gap.startMin, gap.endMin,
            window.start, window.end)) {
            violations.push(
              `run ${run}: gap [${gap.startMin},${gap.endMin})`
              + ` overlaps block [${window.start},${window.end})`);
          }
        }
      }
    }
    expectNoViolations(violations,
      `gap/block overlap(s) across ${TILING_RUNS} randomized days`);
  });

  it("maps every minute of the day to some bucket", () => {
    const random = makeRandom(TILING_SEED);
    const MINUTE_STRIDE = 37; // coprime with 1440 — walks the day
    const unmapped = [];
    for (let run = 0; run < TILING_RUNS; run++) {
      const blocks = randomBlocks(random).filter((b) => b.isActive);
      const blockWindows = occurringBlockWindows(SAMPLE_DATE, blocks);
      const daySegments = buildDaySegments(
        blockWindows.map((window, index) => ({
          bucket: "blk" + index,
          start: window.start,
          end: window.end,
        })),
        projectGaps({ date: SAMPLE_DATE, blocks }));
      for (let minute = 0; minute < 1440; minute += MINUTE_STRIDE) {
        if (typeof segmentForStart(minute, daySegments) !== "string") {
          unmapped.push(`run ${run}: minute ${minute} maps to nothing`);
        }
      }
    }
    expectNoViolations(unmapped,
      `minute(s) with no bucket across ${TILING_RUNS} randomized days`);
  });
});
