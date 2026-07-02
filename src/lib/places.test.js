// The recursive place tree (migration 0009). Backs the Farm map, the
// chore anchor fan-out (obligationPlaceIds' occupied_place case), and
// Rounds' place-major grouping.
import { describe, it, expect } from "vitest";
import { buildPlaceTree, descendantIds, placePath, displayPlace, childrenOf } from "./places.js";

function place(id, parentId, over = {}) {
  return { id, parentId, name: id, sortOrder: 0, isActive: true, ...over };
}

// farm -> pastureA -> coop1
//               \-> coop2
//      -> pastureB
const PLACES = [
  place("farm", null),
  place("pastureA", "farm", { name: "Pasture A" }),
  place("pastureB", "farm", { name: "Pasture B" }),
  place("coop1", "pastureA", { name: "Mobile Coop 1", sortOrder: 1 }),
  place("coop2", "pastureA", { name: "Mobile Coop 2", sortOrder: 0 }),
];

describe("buildPlaceTree", () => {
  it("indexes every place by id", () => {
    const { byId } = buildPlaceTree(PLACES);
    expect(byId.get("coop1").name).toBe("Mobile Coop 1");
    expect(byId.size).toBe(PLACES.length);
  });

  it("groups children by parentId, root-level places under the null key", () => {
    const { childrenByParent } = buildPlaceTree(PLACES);
    expect(childrenByParent.get(null).map((p) => p.id)).toEqual(["farm"]);
    expect(childrenByParent.get("farm").map((p) => p.id).sort()).toEqual(["pastureA", "pastureB"]);
  });

  it("`roots` is the top-level (parentId: null) place list", () => {
    const { roots } = buildPlaceTree(PLACES);
    expect(roots.map((p) => p.id)).toEqual(["farm"]);
  });

  it("sorts children by sortOrder, then name (stable render order)", () => {
    const { childrenByParent } = buildPlaceTree(PLACES);
    // coop2 (sortOrder 0) must come before coop1 (sortOrder 1).
    expect(childrenByParent.get("pastureA").map((p) => p.id)).toEqual(["coop2", "coop1"]);
  });

  it("ties in sortOrder break alphabetically by name", () => {
    const tied = [
      place("farm", null),
      place("z", "farm", { name: "Zebra", sortOrder: 0 }),
      place("a", "farm", { name: "Apple", sortOrder: 0 }),
    ];
    const { childrenByParent } = buildPlaceTree(tied);
    expect(childrenByParent.get("farm").map((p) => p.id)).toEqual(["a", "z"]);
  });

  it("handles an empty or missing place list without throwing", () => {
    expect(() => buildPlaceTree([])).not.toThrow();
    expect(() => buildPlaceTree(undefined)).not.toThrow();
    expect(buildPlaceTree(undefined).roots).toEqual([]);
  });
});

describe("descendantIds", () => {
  const { childrenByParent } = buildPlaceTree(PLACES);

  it("includes the place itself PLUS every place beneath it", () => {
    const out = descendantIds("pastureA", childrenByParent);
    expect(out).toEqual(new Set(["pastureA", "coop1", "coop2"]));
  });

  it("a leaf place's subtree is just itself", () => {
    expect(descendantIds("coop1", childrenByParent)).toEqual(new Set(["coop1"]));
  });

  it("the farm root's subtree is everything", () => {
    const out = descendantIds("farm", childrenByParent);
    expect(out.size).toBe(PLACES.length);
  });

  it("returns an empty set for a null placeId or missing childrenByParent", () => {
    expect(descendantIds(null, childrenByParent)).toEqual(new Set());
    expect(descendantIds("farm", null)).toEqual(new Set());
  });

  it("is cycle-safe (never infinite-loops even with a malformed self-referential tree)", () => {
    const cyclic = new Map([
      ["a", [{ id: "b" }]],
      ["b", [{ id: "a" }]], // cycle back to a
    ]);
    expect(() => descendantIds("a", cyclic)).not.toThrow();
    expect(descendantIds("a", cyclic)).toEqual(new Set(["a", "b"]));
  });
});

describe("placePath", () => {
  const { byId } = buildPlaceTree(PLACES);

  it("returns the root-to-self chain of place objects", () => {
    const chain = placePath("coop1", byId);
    expect(chain.map((p) => p.id)).toEqual(["farm", "pastureA", "coop1"]);
  });

  it("a root place's path is just itself", () => {
    expect(placePath("farm", byId).map((p) => p.id)).toEqual(["farm"]);
  });

  it("returns [] for an unknown placeId or a missing byId map", () => {
    expect(placePath("nonexistent", byId)).toEqual([]);
    expect(placePath("coop1", null)).toEqual([]);
  });

  it("is cycle-safe (a malformed self-parenting tree doesn't infinite-loop)", () => {
    const cyclic = new Map([
      ["a", { id: "a", parentId: "b" }],
      ["b", { id: "b", parentId: "a" }],
    ]);
    expect(() => placePath("a", cyclic)).not.toThrow();
  });
});

describe("displayPlace — D1 disambiguation (name + parent)", () => {
  const { byId } = buildPlaceTree(PLACES);

  it("returns the place's own name plus its immediate parent's name", () => {
    const out = displayPlace(byId.get("coop1"), byId);
    expect(out).toEqual({ name: "Mobile Coop 1", parentName: "Pasture A" });
  });

  it("a root place (no parent) has parentName:null", () => {
    expect(displayPlace(byId.get("farm"), byId)).toEqual({ name: "farm", parentName: null });
  });

  it("returns an empty tuple for a null place", () => {
    expect(displayPlace(null, byId)).toEqual({ name: "", parentName: null });
  });

  it("disambiguates two places sharing a name under different parents (Mobile Coop 1 style)", () => {
    const sameNamePlaces = [
      place("farm", null),
      place("pA", "farm", { name: "Pasture A" }),
      place("pB", "farm", { name: "Pasture B" }),
      place("coopA", "pA", { name: "Mobile Coop" }),
      place("coopB", "pB", { name: "Mobile Coop" }),
    ];
    const { byId: sameById } = buildPlaceTree(sameNamePlaces);
    const a = displayPlace(sameById.get("coopA"), sameById);
    const b = displayPlace(sameById.get("coopB"), sameById);
    expect(a.name).toBe(b.name); // same display name...
    expect(a.parentName).not.toBe(b.parentName); // ...disambiguated by parent
  });
});

describe("childrenOf", () => {
  const { childrenByParent } = buildPlaceTree(PLACES);

  it("returns the sorted active children of a place", () => {
    expect(childrenOf("pastureA", childrenByParent).map((p) => p.id)).toEqual(["coop2", "coop1"]);
  });

  it("filters out inactive children", () => {
    const withInactive = [
      place("farm", null),
      place("active", "farm", { isActive: true }),
      place("gone", "farm", { isActive: false }),
    ];
    const { childrenByParent: cbp } = buildPlaceTree(withInactive);
    expect(childrenOf("farm", cbp).map((p) => p.id)).toEqual(["active"]);
  });

  it("null placeId returns the root-level children", () => {
    expect(childrenOf(null, childrenByParent).map((p) => p.id)).toEqual(["farm"]);
  });

  it("returns [] for a place with no children (a leaf) or a missing map", () => {
    expect(childrenOf("coop1", childrenByParent)).toEqual([]);
    expect(childrenOf("farm", null)).toEqual([]);
  });
});
