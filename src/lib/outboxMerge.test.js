import { describe, it, expect } from "vitest";
import { planMortalityMerge } from "./outboxMerge.js";

// A cohort row as `livestock_groups` hands it back at sync time.
const cohort = (count) => ({ id: "flock-1", count });

// Replay a queue of mortality ops the way flushPass does: FIFO, each
// op applied against the count the op before it left behind.
const replay = (startingCount, deltas) =>
  deltas.reduce(
    (count, delta) => planMortalityMerge(cohort(count), delta).count,
    startingCount,
  );

// A seeded LCG (glibc constants) so a failing trial is reproducible
// from the seed printed with it, and CI never flakes.
function seededRandom(seed) {
  let state = seed;
  return (maxExclusive) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % maxExclusive;
  };
}

const shuffled = (items, random) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const TRIALS = 500;
const SEED = 20260731;

describe("planMortalityMerge", () => {
  it("subtracts the delta from the count read at sync time", () => {
    const countAtSyncTime = 10;
    const deadThisOp = 1;

    const plan = planMortalityMerge(cohort(countAtSyncTime), deadThisOp);

    expect(plan.count).toBe(9);
  });

  // The whole point of the additive policy: what lands is the SUM of
  // every queued delta, not whichever phone synced last.
  it("sums queued deltas in any replay order, floored at zero", () => {
    const random = seededRandom(SEED);

    for (let trial = 0; trial < TRIALS; trial += 1) {
      const startingCount = random(40);
      const deltas = Array.from({ length: random(5) + 1 }, () =>
        random(12) + 1);
      const totalDead = deltas.reduce((sum, d) => sum + d, 0);
      const expectedCount = Math.max(0, startingCount - totalDead);
      const trace =
        `seed ${SEED} trial ${trial}: ${startingCount} - ` +
        `[${deltas}] should leave ${expectedCount}`;

      expect(replay(startingCount, deltas), trace)
        .toBe(expectedCount);
      expect(replay(startingCount, shuffled(deltas, random)), trace)
        .toBe(expectedCount);
    }
  });

  // A cohort deleted (or never counted) between queueing and sync:
  // the mortality_observed activity row is the durable record, so the
  // merge is a no-op rather than an error that strands the op failed.
  it("skips a cohort that is gone or uncounted", () => {
    const deletedCohort = undefined;
    const uncountedCohort = { id: "flock-1", count: null };

    expect(planMortalityMerge(deletedCohort, 1).skipped).toBe(true);
    expect(planMortalityMerge(uncountedCohort, 1).skipped).toBe(true);
  });

  // Batch 8.3 auto move-out, applied at sync time rather than when the
  // op was queued: a cohort that empties closes its open placements.
  it("closes open placements only when the cohort empties", () => {
    const lastOneDied = planMortalityMerge(cohort(1), 1);
    const someStillAlive = planMortalityMerge(cohort(2), 1);

    expect(lastOneDied.closePlacements).toBe(true);
    expect(someStillAlive.closePlacements).toBe(false);
  });
});
