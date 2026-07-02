// feedCost — per-stage feed cost for a metered, day-bounded schedule
// stage (SpeciesPage's schedule panels + productCost's per-batch
// rollup). computeStageCost is intentionally strict: anything it can't
// price (missing feed, unmetered, open-ended, zero-length) returns
// null, and a unit mismatch is flagged rather than mispriced.
import { describe, it, expect } from "vitest";
import { computeStageCost } from "./feedCost.js";

// Shapes lifted from nff-data.json's feedSchedules[].stages / feeds.
function meteredStage(over = {}) {
  return {
    id: "st1", name: "Week 3", feedTypeId: "grower",
    startDay: 14, endDay: 21,
    consumption: {
      type: "metered", amount: 100, unit: "lb", basis: "batch",
    },
    ...over,
  };
}

const FEED = {
  id: "grower", name: "Broiler grower",
  costPerUnit: { amount: 0.5, currency: "USD", unit: "lb" },
};

describe("computeStageCost", () => {
  it("prices a metered, day-bounded stage: amount x days x $/unit", () => {
    // Days 14-21 = 7 days x 100 lb x $0.50.
    expect(computeStageCost(meteredStage(), FEED)).toEqual({
      totalAmount: 700, totalUnit: "lb", cost: 350, days: 7,
    });
  });

  it("keeps fractional dollar math (within float tolerance)", () => {
    const feed = { ...FEED, costPerUnit: { amount: 0.48, unit: "lb" } };
    const out = computeStageCost(
      meteredStage({ consumption: {
        type: "metered", amount: 75, unit: "lb", basis: "batch",
      } }),
      feed);
    expect(out.totalAmount).toBe(525); // 75 x 7
    expect(out.cost).toBeCloseTo(252, 6);
  });

  it("returns null when the feed is missing", () => {
    expect(computeStageCost(meteredStage(), null)).toBeNull();
    expect(computeStageCost(meteredStage(), undefined)).toBeNull();
  });

  it("returns null when the stage has no consumption at all", () => {
    expect(computeStageCost(meteredStage({ consumption: null }), FEED))
      .toBeNull();
  });

  it("returns null for unmetered stages (tbd, free_choice)", () => {
    expect(computeStageCost(
      meteredStage({ consumption: { type: "tbd" } }), FEED)).toBeNull();
    expect(computeStageCost(
      meteredStage({ consumption: { type: "free_choice" } }), FEED))
      .toBeNull();
  });

  it("returns null for an open-ended stage (endDay null)", () => {
    expect(computeStageCost(meteredStage({ endDay: null }), FEED))
      .toBeNull();
  });

  it("returns null (not NaN) when startDay is missing", () => {
    expect(computeStageCost(meteredStage({ startDay: null }), FEED))
      .toBeNull();
    expect(computeStageCost(
      meteredStage({ startDay: undefined }), FEED)).toBeNull();
  });

  it("returns null when the feed has no captured costPerUnit", () => {
    const uncosted = { id: "grower", name: "Broiler grower" };
    expect(computeStageCost(meteredStage(), uncosted)).toBeNull();
  });

  it("returns null for zero-length or inverted day ranges", () => {
    expect(computeStageCost(
      meteredStage({ startDay: 14, endDay: 14 }), FEED)).toBeNull();
    expect(computeStageCost(
      meteredStage({ startDay: 21, endDay: 14 }), FEED)).toBeNull();
  });

  it("flags a stage metered in a different unit than the feed is " +
     "priced in, instead of computing a bogus cost", () => {
    const bales = { ...FEED, costPerUnit: { amount: 5, unit: "bale" } };
    expect(computeStageCost(meteredStage(), bales))
      .toEqual({ unitMismatch: true });
  });
});
