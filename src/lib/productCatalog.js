// Pure helpers for the product catalog (Batch 27).
//
// The catalog model (decided in the 2026-06-02 pricing workshop):
//   - A product is a product_kinds row: name, animal (source species,
//     nullable = "not animal-specific"), sale unit, size brackets,
//     photo, four-slot description content, sold-out flag, bundle
//     support.
//   - Prices are fixed per size bracket (the Pat's Pastured / White
//     Oak pattern), stored as append-only product_prices rows; the
//     current price of a SKU is the newest row for that
//     (product, bracket) pair.
//   - Margin awareness: every price renders next to its computed cost
//     floor (lib/productCost.js) as margin % + profit $, the Shopify
//     admin pattern.

import {
  bracketMidpointLb,
  computeCutSkuCost,
  computeWholeBirdSkuCost,
} from "./productCost.js";

// ── description content slots ─────────────────────────────────────────
// The four-part description recipe every researched farm storefront
// uses, in order. Keys index into product_kinds.content (jsonb).
export const CONTENT_SLOTS = [
  {
    key: "whatItIs",
    label: "What it is",
    hint: "What this product is and why this cut — e.g. \"a whole " +
      "pasture-raised chicken with the backbone removed so the bird " +
      "can lay flat for faster, more even cooking.\"",
  },
  {
    key: "cooking",
    label: "Cooking",
    hint: "Methods and a target temp — e.g. \"roast, grill, or " +
      "skillet; cook to an internal temperature of 165°F.\"",
  },
  {
    key: "sourcing",
    label: "Farming & sourcing",
    hint: "Practices statement — e.g. \"raised humanely on pasture " +
      "without antibiotics, hormones, or steroids, supplemented with " +
      "certified non-GMO grains.\"",
  },
  {
    key: "nutrition",
    label: "Nutrition & value",
    hint: "The nutrition or value angle — e.g. \"rich in collagen, " +
      "ideal for gelatin-rich broths.\"",
  },
];

// ── sales channels ─────────────────────────────────────────────────────
// Where a sale happened. The "record a sale" form and the sales chart
// share this list; POS (Batch 28) will reuse it.
export const SALE_CHANNELS = [
  { id: "farmers_market", label: "Farmers market" },
  { id: "farm_pickup", label: "Farm pick-up" },
  { id: "delivery", label: "Delivery" },
  { id: "shipping", label: "Shipping" },
  { id: "wholesale", label: "Wholesale" },
  { id: "family", label: "Family" },
  { id: "other", label: "Other" },
];

// ── money ──────────────────────────────────────────────────────────────

export function fmtCents(cents) {
  if (cents == null || isNaN(cents)) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

// "18" / "18.5" / "$18.50" → integer cents (1850). null when unparsable.
export function parseDollarsToCents(text) {
  const cleaned = String(text ?? "").replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

// ── product ids ────────────────────────────────────────────────────────
// product_kinds.id is a text primary key (legacy seed rows use slugs
// like "whole_chicken"). New products get a slug derived from their
// name, deduped with a numeric suffix.
export function slugifyProductId(name, existingIds) {
  const base = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "product";
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

// ── current prices ─────────────────────────────────────────────────────
// product_prices is append-only; the current price of a SKU is the
// newest row. Key on `${productKindId}:${bracketId ?? ""}`.

export function skuKey(productKindId, bracketId) {
  return `${productKindId}:${bracketId ?? ""}`;
}

// rows must be shaped (camelCase) and is expected newest-first per the
// hook's order-by; we still compare timestamps so callers don't have
// to guarantee ordering.
export function currentPriceMap(priceRows) {
  const map = new Map();
  for (const row of priceRows ?? []) {
    const key = skuKey(row.productKindId, row.bracketId);
    const existing = map.get(key);
    if (!existing || row.createdAt > existing.createdAt) map.set(key, row);
  }
  return map;
}

// Price history for one SKU, newest first.
export function priceHistoryFor(priceRows, productKindId, bracketId) {
  return (priceRows ?? [])
    .filter(r =>
      r.productKindId === productKindId
      && (r.bracketId ?? null) === (bracketId ?? null))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── margin ─────────────────────────────────────────────────────────────
// Shopify-style: margin = (price − cost) / price. Returns null when
// either side is unknown so the UI can render "—" instead of a wrong
// number (same philosophy as lib/metrics.js).

export function marginInfo(priceCents, costFloorDollars) {
  if (priceCents == null || costFloorDollars == null) return null;
  const price = priceCents / 100;
  if (price <= 0) return null;
  const profit = price - costFloorDollars;
  return {
    profit,
    marginPct: (profit / price) * 100,
    belowFloor: profit < 0,
  };
}

// ── cost floors ────────────────────────────────────────────────────────
// Per-SKU cost floor, dispatching on the product's category the same
// way the old Products page did. Returns null (unknown) for eggs,
// bundles, and anything else the cost model can't price yet.

export function skuCostFloor(kind, bracket, perBird, cutCtx) {
  if (kind.isBundle) return null;
  if (kind.category === "broiler_whole") {
    return computeWholeBirdSkuCost(bracket, perBird)?.costFloor ?? null;
  }
  if (kind.category === "broiler_cut") {
    return computeCutSkuCost(kind, bracket, cutCtx)?.costFloor ?? null;
  }
  return null;
}

// Bundle cost floor: the sum of its components' floors. Null if any
// component's floor is unknown (a partial sum would read as a real
// floor and overstate margin).
export function bundleCostFloor(bundle, productsById, perBird, cutCtx) {
  const contents = bundle.bundleContents ?? [];
  if (contents.length === 0) return null;
  let total = 0;
  for (const item of contents) {
    const component = productsById.get(item.productKindId);
    if (!component) return null;
    const bracket = (component.sizeBrackets ?? [])
      .find(b => b.id === item.bracketId) ?? null;
    const floor = skuCostFloor(component, bracket, perBird, cutCtx);
    if (floor == null) return null;
    total += floor * (item.quantity ?? 1);
  }
  return total;
}

// ── grouping ───────────────────────────────────────────────────────────
// "Group by animal; allow uncategorized / not animal-specific."
// Bundles get their own group (every researched farm presents bundles
// as a distinct collection).

export function groupProductsByAnimal(products, species) {
  const speciesById = new Map((species ?? []).map(s => [s.id, s]));
  const groups = new Map();
  for (const p of products ?? []) {
    const key = p.isBundle ? "__bundles__" : (p.sourceSpeciesId ?? "__none__");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const order = [];
  for (const [key, items] of groups) {
    const label =
      key === "__bundles__" ? "Bundles"
      : key === "__none__" ? "Not animal-specific"
      : speciesById.get(key)?.name
        ?? speciesById.get(key)?.label
        ?? key;
    order.push({ key, label, products: items });
  }
  // Animals first (alphabetical), then uncategorized, then bundles last.
  const rank = (g) =>
    g.key === "__bundles__" ? 2 : g.key === "__none__" ? 1 : 0;
  order.sort((a, b) =>
    rank(a) - rank(b) || a.label.localeCompare(b.label));
  return order;
}

// ── SKU expansion ──────────────────────────────────────────────────────
// Flatten products into priceable SKU rows for the pricing grid: one
// row per (product, bracket); bracket-less products (bundles, or
// anything with no size brackets) get a single row with bracket null.

export function expandSkus(products) {
  const rows = [];
  for (const p of products ?? []) {
    const brackets = p.isBundle ? [] : (p.sizeBrackets ?? []);
    if (brackets.length === 0) {
      rows.push({ product: p, bracket: null });
    } else {
      for (const bracket of brackets) rows.push({ product: p, bracket });
    }
  }
  return rows;
}

export function skuLabel(product, bracket) {
  if (!bracket || bracket.id === "default") return product.name;
  return `${product.name} · ${bracket.label}`;
}

// ── sales aggregation ──────────────────────────────────────────────────
// Bucket sales rows by calendar month for the sales-over-time chart,
// split inside each month by product group (the same animal grouping
// the catalog uses: species / not-animal-specific / bundles).

export function saleGroupKey(product) {
  if (!product) return "__none__";
  if (product.isBundle) return "__bundles__";
  return product.sourceSpeciesId ?? "__none__";
}

export function saleGroupLabel(key, species) {
  if (key === "__bundles__") return "Bundles";
  if (key === "__none__") return "Other";
  return (species ?? []).find(s => s.id === key)?.name ?? key;
}

// → [{ month: "2026-06", label: "Jun ’26", totalCents,
//      byGroup: Map<groupKey, cents> }], oldest first, with empty
// months filled in so the chart reads as a real timeline.
export function salesByMonth(sales, productsById) {
  if (!sales || sales.length === 0) return [];
  const byMonth = new Map();
  for (const sale of sales) {
    const month = (sale.soldOn ?? "").slice(0, 7);
    if (!month) continue;
    if (!byMonth.has(month)) {
      byMonth.set(month, { month, totalCents: 0, byGroup: new Map() });
    }
    const bucket = byMonth.get(month);
    const group = saleGroupKey(productsById.get(sale.productKindId));
    bucket.totalCents += sale.totalCents;
    bucket.byGroup.set(group,
      (bucket.byGroup.get(group) ?? 0) + sale.totalCents);
  }
  // Fill the gap months between first and last so bars sit on a
  // continuous timeline. Every row can lack soldOn, so the map may
  // be empty even though `sales` wasn't.
  const months = [...byMonth.keys()].sort();
  if (months.length === 0) return [];
  const out = [];
  let [y, m] = months[0].split("-").map(Number);
  const last = months[months.length - 1];
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(byMonth.get(key) ?? { month: key, totalCents: 0, byGroup: new Map() });
    if (key === last) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  for (const bucket of out) {
    const [yy, mm] = bucket.month.split("-").map(Number);
    bucket.label = new Date(yy, mm - 1, 1)
      .toLocaleDateString(undefined, { month: "short" })
      + (mm === 1 || bucket === out[0] ? ` ’${String(yy).slice(2)}` : "");
  }
  return out;
}

export { bracketMidpointLb };
