// Product catalog pure helpers (Batch 27 pricing workshop model).
// Covers money parsing/formatting, slug id dedupe, the append-only
// price model (newest row per SKU wins; history newest-first), the
// Shopify-style margin math, cost-floor dispatch (whole / cut / bundle),
// animal grouping, SKU expansion + labels, and the sales-by-month
// bucketing with gap-month fill. Price-row fixtures mirror the
// camelCase shape useProducts.js produces (productKindId, bracketId,
// priceCents, createdAt).
import { describe, it, expect } from "vitest";
import {
  CONTENT_SLOTS, SALE_CHANNELS, fmtCents, parseDollarsToCents,
  slugifyProductId, skuKey, currentPriceMap, priceHistoryFor,
  marginInfo, skuCostFloor, bundleCostFloor, groupProductsByAnimal,
  expandSkus, skuLabel, saleGroupKey, saleGroupLabel, salesByMonth,
  bracketMidpointLb,
} from "./productCatalog.js";
import {
  bracketMidpointLb as costBracketMidpointLb,
} from "./productCost.js";

function priceRow(over = {}) {
  return {
    id: "pr1",
    productKindId: "whole_chicken",
    bracketId: "wc_35_4",
    priceCents: 1850,
    createdAt: "2026-06-01T00:00:00Z",
    ...over,
  };
}

function bracket(id, minLb, maxLb, label = `${minLb}–${maxLb} lb`) {
  return { id, label, minLb, maxLb };
}

describe("CONTENT_SLOTS / SALE_CHANNELS", () => {
  it("keeps the four description slots in recipe order", () => {
    expect(CONTENT_SLOTS.map(s => s.key)).toEqual([
      "whatItIs", "cooking", "sourcing", "nutrition",
    ]);
    for (const slot of CONTENT_SLOTS) {
      expect(typeof slot.label).toBe("string");
      expect(typeof slot.hint).toBe("string");
    }
  });

  it("lists the seven sale channels, each with an id and label", () => {
    expect(SALE_CHANNELS.map(c => c.id)).toEqual([
      "farmers_market", "farm_pickup", "delivery", "shipping",
      "wholesale", "family", "other",
    ]);
    for (const ch of SALE_CHANNELS) {
      expect(typeof ch.label).toBe("string");
    }
  });
});

describe("fmtCents", () => {
  it("formats integer cents as dollars", () => {
    expect(fmtCents(1850)).toBe("$18.50");
    expect(fmtCents(0)).toBe("$0.00");
    expect(fmtCents(5)).toBe("$0.05");
  });

  it("renders an em dash for null / undefined / NaN", () => {
    expect(fmtCents(null)).toBe("—");
    expect(fmtCents(undefined)).toBe("—");
    expect(fmtCents(NaN)).toBe("—");
  });
});

describe("parseDollarsToCents", () => {
  it("parses plain and fractional dollar amounts", () => {
    expect(parseDollarsToCents("18")).toBe(1800);
    expect(parseDollarsToCents("1.5")).toBe(150);
  });

  it("strips $ signs, commas, and whitespace", () => {
    expect(parseDollarsToCents("$2.00")).toBe(200);
    expect(parseDollarsToCents("$18.50")).toBe(1850);
    expect(parseDollarsToCents(" 1,234.56 ")).toBe(123456);
  });

  it("rounds sub-cent input to the nearest cent", () => {
    expect(parseDollarsToCents("1.239")).toBe(124);
    expect(parseDollarsToCents("1.234")).toBe(123);
  });

  it("returns null for empty / nullish input", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("  ")).toBeNull();
    expect(parseDollarsToCents(null)).toBeNull();
    expect(parseDollarsToCents(undefined)).toBeNull();
  });

  it("returns null for garbage and for negative amounts", () => {
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("1.2.3")).toBeNull();
    expect(parseDollarsToCents("$-5")).toBeNull();
  });
});

describe("slugifyProductId", () => {
  it("slugs a name to lowercase underscore form", () => {
    expect(slugifyProductId("Whole Chicken", [])).toBe("whole_chicken");
  });

  it("collapses punctuation runs and trims edge underscores", () => {
    expect(slugifyProductId("Pat's Pastured — Eggs!", []))
      .toBe("pat_s_pastured_eggs");
  });

  it("falls back to 'product' when nothing survives", () => {
    expect(slugifyProductId("", [])).toBe("product");
    expect(slugifyProductId("!!!", [])).toBe("product");
    expect(slugifyProductId(null, [])).toBe("product");
  });

  it("caps the base slug at 40 characters", () => {
    expect(slugifyProductId("x".repeat(50), [])).toBe("x".repeat(40));
  });

  it("dedupes against existing ids with a numeric suffix", () => {
    expect(slugifyProductId("Whole Chicken", ["whole_chicken"]))
      .toBe("whole_chicken_2");
    expect(slugifyProductId("Whole Chicken", [
      "whole_chicken", "whole_chicken_2", "whole_chicken_3",
    ])).toBe("whole_chicken_4");
  });
});

describe("skuKey", () => {
  it("joins product and bracket with a colon", () => {
    expect(skuKey("whole_chicken", "wc_35_4")).toBe("whole_chicken:wc_35_4");
  });

  it("normalizes a missing bracket to an empty suffix", () => {
    expect(skuKey("egg_dozen", null)).toBe("egg_dozen:");
    expect(skuKey("egg_dozen", undefined)).toBe("egg_dozen:");
  });
});

describe("currentPriceMap — newest row per SKU wins", () => {
  it("keeps the newest row even when rows arrive oldest-first", () => {
    const oldRow = priceRow({ id: "old", priceCents: 1600,
      createdAt: "2026-05-01T00:00:00Z" });
    const newRow = priceRow({ id: "new", priceCents: 1850,
      createdAt: "2026-06-01T00:00:00Z" });
    const map = currentPriceMap([oldRow, newRow]);
    expect(map.size).toBe(1);
    expect(map.get("whole_chicken:wc_35_4").id).toBe("new");
  });

  it("keeps the newest row when rows arrive newest-first too", () => {
    const oldRow = priceRow({ id: "old",
      createdAt: "2026-05-01T00:00:00Z" });
    const newRow = priceRow({ id: "new",
      createdAt: "2026-06-01T00:00:00Z" });
    const map = currentPriceMap([newRow, oldRow]);
    expect(map.get("whole_chicken:wc_35_4").id).toBe("new");
  });

  it("keys each (product, bracket) pair separately", () => {
    const map = currentPriceMap([
      priceRow({ id: "a" }),
      priceRow({ id: "b", bracketId: "wc_4_45" }),
      priceRow({ id: "c", productKindId: "egg_dozen", bracketId: null }),
    ]);
    expect(map.size).toBe(3);
    expect(map.get("egg_dozen:").id).toBe("c");
  });

  it("treats null and undefined bracketId as the same SKU", () => {
    const map = currentPriceMap([
      priceRow({ id: "a", bracketId: null,
        createdAt: "2026-05-01T00:00:00Z" }),
      priceRow({ id: "b", bracketId: undefined,
        createdAt: "2026-06-01T00:00:00Z" }),
    ]);
    expect(map.size).toBe(1);
    expect(map.get("whole_chicken:").id).toBe("b");
  });

  it("returns an empty map for null / empty input", () => {
    expect(currentPriceMap(null).size).toBe(0);
    expect(currentPriceMap([]).size).toBe(0);
  });
});

describe("priceHistoryFor", () => {
  it("filters to one SKU and sorts newest first", () => {
    const rows = [
      priceRow({ id: "mid", createdAt: "2026-05-01T00:00:00Z" }),
      priceRow({ id: "other", bracketId: "wc_4_45" }),
      priceRow({ id: "new", createdAt: "2026-06-01T00:00:00Z" }),
      priceRow({ id: "old", createdAt: "2026-04-01T00:00:00Z" }),
    ];
    const hist = priceHistoryFor(rows, "whole_chicken", "wc_35_4");
    expect(hist.map(r => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("matches a row's undefined bracketId against a null query", () => {
    const rows = [priceRow({ id: "a", bracketId: undefined })];
    expect(priceHistoryFor(rows, "whole_chicken", null))
      .toHaveLength(1);
  });

  it("returns [] for null rows or a SKU with no history", () => {
    expect(priceHistoryFor(null, "whole_chicken", "wc_35_4")).toEqual([]);
    expect(priceHistoryFor([priceRow()], "egg_dozen", null)).toEqual([]);
  });
});

describe("marginInfo — Shopify-style margin on price", () => {
  it("computes profit and margin % from cents price + $ floor", () => {
    // $18.50 price, $12.50 floor → $6 profit, 6/18.5 ≈ 32.43%.
    const out = marginInfo(1850, 12.5);
    expect(out.profit).toBeCloseTo(6, 12);
    expect(out.marginPct).toBeCloseTo((6 / 18.5) * 100, 10);
    expect(out.belowFloor).toBe(false);
  });

  it("flags a price below the cost floor", () => {
    const out = marginInfo(1000, 12);
    expect(out.profit).toBeCloseTo(-2, 12);
    expect(out.marginPct).toBeCloseTo(-20, 10);
    expect(out.belowFloor).toBe(true);
  });

  it("a price exactly at the floor is zero margin, not below", () => {
    const out = marginInfo(1000, 10);
    expect(out.profit).toBe(0);
    expect(out.marginPct).toBe(0);
    expect(out.belowFloor).toBe(false);
  });

  it("returns null when either side is unknown, or price is 0", () => {
    expect(marginInfo(null, 12.5)).toBeNull();
    expect(marginInfo(1850, null)).toBeNull();
    expect(marginInfo(0, 12.5)).toBeNull();
  });
});

describe("skuCostFloor — dispatch by product category", () => {
  const perBird = { knownTotal: 16.5, missing: [] };
  const cutCtx = {
    costPerSellableLb: 6,
    packagingPerCutPackage: 0.4,
    perBird: { missing: [] },
  };

  it("whole broilers cost the per-bird floor regardless of size", () => {
    const kind = { id: "whole_chicken", category: "broiler_whole" };
    const floor = skuCostFloor(kind, bracket("b", 4, 5), perBird, cutCtx);
    expect(floor).toBe(16.5);
  });

  it("cuts cost $/lb × midpoint + packaging", () => {
    const kind = { id: "wings", category: "broiler_cut" };
    const floor = skuCostFloor(kind, bracket("c", 1, 1.5), perBird, cutCtx);
    expect(floor).toBeCloseTo(6 * 1.25 + 0.4, 12);
  });

  it("is null for bundles, unknown categories, and open brackets", () => {
    const bundle = { id: "box", category: "broiler_whole", isBundle: true };
    expect(skuCostFloor(bundle, bracket("b", 4, 5), perBird, cutCtx))
      .toBeNull();
    const eggs = { id: "egg_dozen", category: "eggs" };
    expect(skuCostFloor(eggs, null, perBird, cutCtx)).toBeNull();
    const whole = { id: "whole_chicken", category: "broiler_whole" };
    expect(skuCostFloor(whole, bracket("b", null, 5), perBird, cutCtx))
      .toBeNull();
  });
});

describe("bundleCostFloor", () => {
  const perBird = { knownTotal: 16.5, missing: [] };
  const cutCtx = {
    costPerSellableLb: 6,
    packagingPerCutPackage: 0.4,
    perBird: { missing: [] },
  };
  const whole = {
    id: "whole_chicken",
    category: "broiler_whole",
    sizeBrackets: [bracket("b1", 4, 5)],
  };
  const wings = {
    id: "wings",
    category: "broiler_cut",
    sizeBrackets: [bracket("c1", 1, 1.5)],
  };
  const eggs = { id: "egg_dozen", category: "eggs", sizeBrackets: [] };
  const byId = new Map([
    ["whole_chicken", whole], ["wings", wings], ["egg_dozen", eggs],
  ]);

  it("sums component floors × quantity (quantity defaults to 1)", () => {
    const bundle = {
      bundleContents: [
        { productKindId: "whole_chicken", bracketId: "b1", quantity: 2 },
        { productKindId: "wings", bracketId: "c1" },
      ],
    };
    // 2 × 16.50 + (6 × 1.25 + 0.40) = 33 + 7.90 = 40.90.
    expect(bundleCostFloor(bundle, byId, perBird, cutCtx))
      .toBeCloseTo(40.9, 12);
  });

  it("is null when empty — no contents means no floor", () => {
    expect(bundleCostFloor({ bundleContents: [] }, byId, perBird, cutCtx))
      .toBeNull();
    expect(bundleCostFloor({}, byId, perBird, cutCtx)).toBeNull();
  });

  it("is null when any component is missing or unpriceable", () => {
    const ghost = {
      bundleContents: [{ productKindId: "nope", bracketId: null }],
    };
    expect(bundleCostFloor(ghost, byId, perBird, cutCtx)).toBeNull();
    const withEggs = {
      bundleContents: [
        { productKindId: "whole_chicken", bracketId: "b1" },
        { productKindId: "egg_dozen", bracketId: null },
      ],
    };
    expect(bundleCostFloor(withEggs, byId, perBird, cutCtx)).toBeNull();
  });
});

describe("groupProductsByAnimal", () => {
  const species = [
    { id: "pigs", name: "Pigs" },
    { id: "chickens", name: "Chickens" },
  ];

  it("orders animals A→Z, then uncategorized, then bundles", () => {
    const products = [
      { id: "box", name: "Sampler box", isBundle: true },
      { id: "pork", name: "Pork chops", sourceSpeciesId: "pigs" },
      { id: "honey", name: "Honey", sourceSpeciesId: null },
      { id: "wc", name: "Whole chicken", sourceSpeciesId: "chickens" },
    ];
    const groups = groupProductsByAnimal(products, species);
    expect(groups.map(g => g.label)).toEqual([
      "Chickens", "Pigs", "Not animal-specific", "Bundles",
    ]);
    expect(groups[0].products.map(p => p.id)).toEqual(["wc"]);
    expect(groups[3].products.map(p => p.id)).toEqual(["box"]);
  });

  it("bundles group as bundles even with a source species set", () => {
    const products = [
      { id: "box", name: "Box", isBundle: true, sourceSpeciesId: "pigs" },
    ];
    const groups = groupProductsByAnimal(products, species);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("__bundles__");
  });

  it("falls back to species .label, then to the raw id", () => {
    const products = [
      { id: "a", sourceSpeciesId: "sheep" },
      { id: "b", sourceSpeciesId: "mystery" },
    ];
    const groups = groupProductsByAnimal(products, [
      { id: "sheep", label: "Sheep" },
    ]);
    // localeCompare is case-insensitive: "mystery" sorts before
    // "Sheep".
    expect(groups.map(g => g.label)).toEqual(["mystery", "Sheep"]);
  });
});

describe("expandSkus", () => {
  it("emits one row per (product, bracket)", () => {
    const p = {
      id: "wc",
      sizeBrackets: [bracket("b1", 3, 4), bracket("b2", 4, 5)],
    };
    const rows = expandSkus([p]);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.bracket.id)).toEqual(["b1", "b2"]);
    expect(rows[0].product).toBe(p);
  });

  it("gives bracket-less products a single null-bracket row", () => {
    const rows = expandSkus([{ id: "honey", sizeBrackets: [] }]);
    expect(rows).toEqual([
      { product: { id: "honey", sizeBrackets: [] }, bracket: null },
    ]);
  });

  it("ignores a bundle's size brackets — bundles are one SKU", () => {
    const bundle = {
      id: "box", isBundle: true, sizeBrackets: [bracket("b1", 3, 4)],
    };
    const rows = expandSkus([bundle]);
    expect(rows).toHaveLength(1);
    expect(rows[0].bracket).toBeNull();
  });

  it("returns [] for null / empty input", () => {
    expect(expandSkus(null)).toEqual([]);
    expect(expandSkus([])).toEqual([]);
  });
});

describe("skuLabel", () => {
  const product = { id: "wc", name: "Whole chicken" };

  it("joins name and bracket label with a middle dot", () => {
    expect(skuLabel(product, bracket("b1", 3, 4, "3–4 lb")))
      .toBe("Whole chicken · 3–4 lb");
  });

  it("uses the bare name for no bracket or the default bracket", () => {
    expect(skuLabel(product, null)).toBe("Whole chicken");
    expect(skuLabel(product, { id: "default", label: "One size" }))
      .toBe("Whole chicken");
  });
});

describe("saleGroupKey / saleGroupLabel", () => {
  const species = [{ id: "chickens", name: "Chickens" }];

  it("keys sales the way the catalog groups products", () => {
    expect(saleGroupKey(null)).toBe("__none__");
    expect(saleGroupKey({ isBundle: true })).toBe("__bundles__");
    expect(saleGroupKey({ sourceSpeciesId: "chickens" })).toBe("chickens");
    expect(saleGroupKey({ sourceSpeciesId: null })).toBe("__none__");
  });

  it("labels groups, using 'Other' (not 'Not animal-specific')", () => {
    expect(saleGroupLabel("__bundles__", species)).toBe("Bundles");
    expect(saleGroupLabel("__none__", species)).toBe("Other");
    expect(saleGroupLabel("chickens", species)).toBe("Chickens");
    expect(saleGroupLabel("mystery", species)).toBe("mystery");
  });
});

describe("salesByMonth", () => {
  const productsById = new Map([
    ["wc", { id: "wc", sourceSpeciesId: "chickens" }],
    ["box", { id: "box", isBundle: true }],
  ]);

  function sale(soldOn, productKindId, totalCents) {
    return { soldOn, productKindId, totalCents };
  }

  it("buckets by month, splits by group, and fills gap months", () => {
    const out = salesByMonth([
      sale("2026-03-15", "wc", 1000),
      sale("2026-03-20", "box", 500),
      sale("2026-05-02", "wc", 2000),
    ], productsById);
    expect(out.map(b => b.month)).toEqual([
      "2026-03", "2026-04", "2026-05",
    ]);
    expect(out[0].totalCents).toBe(1500);
    expect(out[0].byGroup.get("chickens")).toBe(1000);
    expect(out[0].byGroup.get("__bundles__")).toBe(500);
    expect(out[1].totalCents).toBe(0);
    expect(out[1].byGroup.size).toBe(0);
    expect(out[2].totalCents).toBe(2000);
  });

  it("labels the first bucket and Januaries with the year", () => {
    const out = salesByMonth([
      sale("2025-12-05", "wc", 100),
      sale("2026-02-10", "wc", 100),
    ], productsById);
    expect(out.map(b => b.label)).toEqual(["Dec ’25", "Jan ’26", "Feb"]);
  });

  it("groups sales of unknown products under __none__", () => {
    const out = salesByMonth([sale("2026-06-01", "ghost", 300)],
      productsById);
    expect(out[0].byGroup.get("__none__")).toBe(300);
  });

  it("skips sales with no soldOn date", () => {
    const out = salesByMonth([
      sale(null, "wc", 100),
      sale("2026-06-01", "wc", 250),
    ], productsById);
    expect(out).toHaveLength(1);
    expect(out[0].totalCents).toBe(250);
  });

  it("returns [] for null / empty sales", () => {
    expect(salesByMonth(null, productsById)).toEqual([]);
    expect(salesByMonth([], productsById)).toEqual([]);
  });
});

describe("bracketMidpointLb re-export", () => {
  it("re-exports the productCost implementation unchanged", () => {
    expect(bracketMidpointLb).toBe(costBracketMidpointLb);
    expect(bracketMidpointLb(bracket("b", 3, 4))).toBe(3.5);
  });
});
