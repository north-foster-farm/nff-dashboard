// Broiler cost-model helpers (Products page cost floors). Covers the
// bracket-midpoint rule, the metered-stage feed roll-up (free-choice /
// tbd / unit-mismatch stages contribute nothing), the per-bird known
// floor with its missing-component ledger, the cut cost-per-sellable-lb
// allocation, the two per-SKU cost shapes, and fmtUSD. Fixtures mirror
// nff-data.json: costs.broilers, feedSchedules[].stages, feeds[] with
// costPerUnit, and whole_chicken sizeBrackets (dressed-weight).
import { describe, it, expect } from "vitest";
import {
  bracketMidpointLb,
  computeKnownFeedCostPerBatch,
  computeBroilerCostPerBird,
  computeBroilerCutCostPerLb,
  computeWholeBirdSkuCost,
  computeCutSkuCost,
  fmtUSD,
} from "./productCost.js";

function bracket(minLb, maxLb, over = {}) {
  return { id: "b1", label: "3–4 lb", minLb, maxLb, ...over };
}

const FEEDS = [
  { id: "starter", costPerUnit: { amount: 0.6, currency: "USD", unit: "lb" } },
  { id: "grower", costPerUnit: { amount: 0.5, currency: "USD", unit: "lb" } },
];

function meteredStage(over = {}) {
  return {
    id: "s_w3",
    startDay: 14,
    endDay: 21,
    feedTypeId: "grower",
    consumption: {
      type: "metered", amount: 100, unit: "lb", per: "day", basis: "batch",
    },
    ...over,
  };
}

// Hand-traced feed math: week-3 stage is 7 days × 100 lb × $0.50 = $350;
// week-4 stage is 7 days × 50 lb × $0.50 = $175; starter is free-choice
// (not computable). Known feed per batch = $525.
const SCHEDULE = {
  id: "broiler_standard",
  speciesId: "broilers",
  stages: [
    {
      id: "s_starter", startDay: 0, endDay: 14, feedTypeId: "starter",
      consumption: { type: "free_choice" },
    },
    meteredStage(),
    meteredStage({
      id: "s_w4",
      startDay: 21,
      endDay: 28,
      consumption: {
        type: "metered", amount: 50, unit: "lb", per: "day", basis: "batch",
      },
    }),
  ],
};

function baseData(over = {}) {
  return {
    costs: {
      broilers: {
        chickPurchasePerBird: 2.5,
        processingSlaughterPerBird: 7.5,
        processingCutAdditionalPerBird: 4,
        packagingPerWholeBird: 1.25,
        packagingPerCutPackage: 0.4,
        yieldLiveToDressed: 0.7,
        yieldDressedBreakdown: {
          boneless_breast: 0.4,
          frame_remainder: 0.25,
        },
        ...(over.broilers ?? {}),
      },
    },
    feedSchedules: over.feedSchedules ?? [
      { id: "layer_standard", speciesId: "layers", stages: [] },
      SCHEDULE,
    ],
    feeds: over.feeds ?? FEEDS,
    // Bracket midpoints 3.5 and 4.5 → average dressed weight 4 lb.
    productKinds: over.productKinds ?? [
      { id: "whole_chicken", sizeBrackets: [bracket(3, 4), bracket(4, 5)] },
    ],
  };
}

describe("bracketMidpointLb", () => {
  it("returns the arithmetic midpoint of a bounded bracket", () => {
    expect(bracketMidpointLb(bracket(3, 4))).toBe(3.5);
  });

  it("treats a 0 bound as a real bound (== null check, not falsy)", () => {
    expect(bracketMidpointLb(bracket(0, 1))).toBe(0.5);
  });

  it("returns null when either bound is missing (open bracket)", () => {
    expect(bracketMidpointLb(bracket(null, 4))).toBeNull();
    expect(bracketMidpointLb(bracket(3, null))).toBeNull();
  });

  it("returns null (not a crash) for a missing bracket entirely", () => {
    expect(bracketMidpointLb(null)).toBeNull();
    expect(bracketMidpointLb(undefined)).toBeNull();
  });
});

describe("computeKnownFeedCostPerBatch", () => {
  it("sums only the metered, computable stages ($350 + $175)", () => {
    expect(computeKnownFeedCostPerBatch(SCHEDULE, FEEDS)).toBe(525);
  });

  it("returns null for a null schedule", () => {
    expect(computeKnownFeedCostPerBatch(null, FEEDS)).toBeNull();
  });

  it("returns null when no stage is computable (all free-choice)", () => {
    const schedule = {
      ...SCHEDULE,
      stages: [SCHEDULE.stages[0]],
    };
    expect(computeKnownFeedCostPerBatch(schedule, FEEDS)).toBeNull();
  });

  it("skips a stage whose consumption unit mismatches the feed's", () => {
    const kgFeeds = [
      { id: "grower", costPerUnit: { amount: 0.5, unit: "kg" } },
    ];
    const schedule = { ...SCHEDULE, stages: [meteredStage()] };
    expect(computeKnownFeedCostPerBatch(schedule, kgFeeds)).toBeNull();
  });

  it("skips an open-ended stage (endDay null) and unknown feed ids", () => {
    const schedule = {
      ...SCHEDULE,
      stages: [
        meteredStage({ endDay: null }),
        meteredStage({ id: "s_x", feedTypeId: "nope" }),
        meteredStage(),
      ],
    };
    expect(computeKnownFeedCostPerBatch(schedule, FEEDS)).toBe(350);
  });
});

describe("computeBroilerCostPerBird", () => {
  it("sums chick + feed/batchSize + slaughter + packaging", () => {
    // 2.50 + 525/100 + 7.50 + 1.25 = 16.50 with an explicit batch of
    // 100 birds.
    const out = computeBroilerCostPerBird(baseData(), { batchSize: 100 });
    expect(out.knownTotal).toBe(16.5);
    expect(out.components).toEqual({
      chick: 2.5, feed: 5.25, slaughter: 7.5, packagingWhole: 1.25,
    });
    expect(out.missing).toEqual([]);
    expect(out.batchSize).toBe(100);
  });

  it("defaults the batch size to 275 birds", () => {
    const out = computeBroilerCostPerBird(baseData());
    expect(out.batchSize).toBe(275);
    expect(out.components.feed).toBeCloseTo(525 / 275, 12);
    expect(out.knownTotal).toBeCloseTo(11.25 + 525 / 275, 12);
  });

  it("lists missing components but still totals the known ones", () => {
    // Mirrors prod today: chick + packaging TBD, and here also no
    // broiler schedule → feed unknown. Only slaughter ($7.50) is known.
    const data = baseData({
      broilers: { chickPurchasePerBird: null, packagingPerWholeBird: null },
      feedSchedules: [],
    });
    const out = computeBroilerCostPerBird(data, { batchSize: 100 });
    expect(out.knownTotal).toBe(7.5);
    expect(out.missing).toEqual([
      "chick", "feed (full schedule)", "packaging",
    ]);
  });
});

describe("computeBroilerCutCostPerLb", () => {
  it("allocates (per-bird + cut extra) over sellable cut lb", () => {
    // cutBirdCost = 16.50 + 4 = 20.50; avg midpoint 4 lb dressed;
    // sellable = 4 × (1 − 0.25) = 3 lb → 20.50 / 3 ≈ 6.8333 $/lb.
    const out = computeBroilerCutCostPerLb(baseData(), { batchSize: 100 });
    expect(out.cutBirdCost).toBe(20.5);
    expect(out.dressedLbPerBird).toBe(4);
    expect(out.sellableCutLbPerBird).toBe(3);
    expect(out.costPerSellableLb).toBeCloseTo(20.5 / 3, 12);
    expect(out.cutExtra).toBe(4);
    expect(out.packagingPerCutPackage).toBe(0.4);
    expect(out.perBird.knownTotal).toBe(16.5);
  });

  it("averages only the bounded brackets when some are open", () => {
    const data = baseData({
      productKinds: [{
        id: "whole_chicken",
        sizeBrackets: [bracket(3, 4), bracket(4, 5), bracket(null, null)],
      }],
    });
    const out = computeBroilerCutCostPerLb(data, { batchSize: 100 });
    expect(out.dressedLbPerBird).toBe(4);
  });

  it("returns null when the slaughter fee is unknown", () => {
    const data = baseData({
      broilers: { processingSlaughterPerBird: null },
    });
    expect(computeBroilerCutCostPerLb(data)).toBeNull();
  });

  it("returns null when there is no whole_chicken kind to average", () => {
    const data = baseData({ productKinds: [{ id: "eggs" }] });
    expect(computeBroilerCutCostPerLb(data)).toBeNull();
  });
});

describe("computeWholeBirdSkuCost", () => {
  const perBird = { knownTotal: 16.5, missing: ["chick"] };

  it("uses the per-bird floor and prices per lb at the midpoint", () => {
    const out = computeWholeBirdSkuCost(bracket(4, 5), perBird);
    expect(out.costFloor).toBe(16.5);
    expect(out.costPerLbAtMidpoint).toBeCloseTo(16.5 / 4.5, 12);
    expect(out.midpointLb).toBe(4.5);
    expect(out.missing).toEqual(["chick"]);
  });

  it("returns null for an open bracket (no midpoint)", () => {
    expect(computeWholeBirdSkuCost(bracket(null, 5), perBird)).toBeNull();
  });
});

describe("computeCutSkuCost", () => {
  const cutCtx = {
    costPerSellableLb: 6,
    packagingPerCutPackage: 0.4,
    perBird: { missing: [] },
  };

  it("costs = $/lb × midpoint + one per-package packaging fee", () => {
    // 6 × 1.25 + 0.40 = 7.90; per lb = 7.90 / 1.25 = 6.32.
    const out = computeCutSkuCost({}, bracket(1, 1.5), cutCtx);
    expect(out.costFloor).toBeCloseTo(7.9, 12);
    expect(out.costPerLbAtMidpoint).toBeCloseTo(6.32, 12);
    expect(out.midpointLb).toBe(1.25);
    expect(out.missing).toEqual([]);
  });

  it("flags unknown packaging as missing and omits it from cost", () => {
    const ctx = {
      ...cutCtx,
      packagingPerCutPackage: null,
      perBird: { missing: ["chick"] },
    };
    const out = computeCutSkuCost({}, bracket(1, 1.5), ctx);
    expect(out.costFloor).toBeCloseTo(7.5, 12);
    expect(out.missing).toEqual(["chick", "package packaging"]);
  });

  it("returns null without a cut context or without a midpoint", () => {
    expect(computeCutSkuCost({}, bracket(1, 1.5), null)).toBeNull();
    expect(computeCutSkuCost({}, bracket(null, 1.5), cutCtx)).toBeNull();
  });
});

describe("fmtUSD", () => {
  it("formats dollars to two places", () => {
    expect(fmtUSD(7.5)).toBe("$7.50");
    expect(fmtUSD(0)).toBe("$0.00");
    expect(fmtUSD(20.5 / 3)).toBe("$6.83");
  });

  it("renders an em dash for null / NaN (unknown)", () => {
    expect(fmtUSD(null)).toBe("—");
    expect(fmtUSD(undefined)).toBe("—");
    expect(fmtUSD(NaN)).toBe("—");
  });
});
