// Cost helpers for Products page.
// All values may be partial: callers must handle null returns.

import { computeStageCost } from "./feedCost.js";

const BATCH_SIZE_DEFAULT = 275;

export function bracketMidpointLb(bracket) {
  if (bracket?.minLb == null || bracket?.maxLb == null) return null;
  return (bracket.minLb + bracket.maxLb) / 2;
}

// Sum of metered, computable feed-stage costs for a single broiler schedule.
// Returns dollars consumed by one full batch (per the schedule) for stages we can compute.
export function computeKnownFeedCostPerBatch(schedule, feeds) {
  if (!schedule) return null;
  let total = 0;
  let anyKnown = false;
  for (const stage of schedule.stages) {
    const feed = feeds.find(f => f.id === stage.feedTypeId);
    const info = computeStageCost(stage, feed);
    if (info && info.cost != null) {
      total += info.cost;
      anyKnown = true;
    }
  }
  return anyKnown ? total : null;
}

// Known cost-per-bird floor (chicks + feed + slaughter + packaging-whole),
// excluding cut-extra. Returns { knownTotal, components: { chick, feed, slaughter, packaging }, missing: [...] }.
export function computeBroilerCostPerBird(data, opts = {}) {
  const batchSize = opts.batchSize ?? BATCH_SIZE_DEFAULT;
  const c = data.costs.broilers;
  const schedule = data.feedSchedules.find(fs => fs.speciesId === "broilers") ?? null;
  const feedPerBatch = computeKnownFeedCostPerBatch(schedule, data.feeds);

  const components = {
    chick: c.chickPurchasePerBird,
    feed: feedPerBatch != null ? feedPerBatch / batchSize : null,
    slaughter: c.processingSlaughterPerBird,
    packagingWhole: c.packagingPerWholeBird
  };
  const missing = [];
  if (components.chick == null) missing.push("chick");
  if (components.feed == null) missing.push("feed (full schedule)");
  if (components.slaughter == null) missing.push("slaughter");
  if (components.packagingWhole == null) missing.push("packaging");

  const knownTotal = Object.values(components).reduce((sum, v) => sum + (v ?? 0), 0);
  return { knownTotal, components, missing, batchSize };
}

// Cost per lb of dressed-bird meat (used to allocate to cuts).
// Costs allocated to cuts include the cut-extra processing fee plus a per-cut packaging fee
// applied to each package (we approximate by bracket midpoint and assume one package per bracket).
export function computeBroilerCutCostPerLb(data, opts = {}) {
  const c = data.costs.broilers;
  const perBird = computeBroilerCostPerBird(data, opts);
  if (perBird.components.slaughter == null) return null;
  // Per-bird cost of taking it to cuts (excludes packaging-per-package which is per-SKU)
  const cutBirdCost =
    perBird.knownTotal +
    (c.processingCutAdditionalPerBird ?? 0);
  // Average dressed weight per bird (from yield × average bracket midpoint).
  const wholeKind = data.productKinds.find(k => k.id === "whole_chicken");
  const avgMid =
    wholeKind?.sizeBrackets
      .map(bracketMidpointLb)
      .filter(v => v != null)
      .reduce((a, b, _, arr) => a + b / arr.length, 0) ?? null;
  if (avgMid == null) return null;
  const dressedLbPerBird = avgMid; // brackets are dressed-weight brackets
  const sellableCutLbPerBird = dressedLbPerBird * (1 - (c.yieldDressedBreakdown.frame_remainder ?? 0));
  if (sellableCutLbPerBird <= 0) return null;
  const costPerSellableLb = cutBirdCost / sellableCutLbPerBird;

  return {
    costPerSellableLb,
    perBird,
    cutBirdCost,
    dressedLbPerBird,
    sellableCutLbPerBird,
    cutExtra: c.processingCutAdditionalPerBird,
    packagingPerCutPackage: c.packagingPerCutPackage
  };
}

export function computeWholeBirdSkuCost(bracket, perBird) {
  const mid = bracketMidpointLb(bracket);
  if (mid == null) return null;
  return {
    costFloor: perBird.knownTotal,
    costPerLbAtMidpoint: perBird.knownTotal / mid,
    midpointLb: mid,
    missing: perBird.missing
  };
}

export function computeCutSkuCost(kind, bracket, cutCtx) {
  if (!cutCtx) return null;
  const mid = bracketMidpointLb(bracket);
  if (mid == null) return null;
  const cost =
    cutCtx.costPerSellableLb * mid +
    (cutCtx.packagingPerCutPackage ?? 0);
  return {
    costFloor: cost,
    costPerLbAtMidpoint: cost / mid,
    midpointLb: mid,
    missing: cutCtx.perBird.missing.concat(
      cutCtx.packagingPerCutPackage == null ? ["package packaging"] : []
    )
  };
}

export function fmtUSD(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
}
