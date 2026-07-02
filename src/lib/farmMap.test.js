// Farm map pure helpers (Batch 18.2) — binding SVG layers to places,
// zoom transform math, structure-pin auto-layout, and status-flag tint.
//
// NOT covered here: `parseFarmMapSvg` — it calls the browser-only
// `DOMParser`, which doesn't exist in this suite's plain-node vitest
// environment (see vitest.config.js). Testing it would need a jsdom
// environment override (an additional dependency this session didn't
// add) or a hand-rolled DOMParser shim; deliberately left as a gap
// rather than authoring a test against a mocked/unrealistic parser.
import { describe, it, expect } from "vitest";
import { layerSlug, bindLayersToPlaces, zoomTransform, layoutPins, tintForFlag, FLAG_TINTS } from "./farmMap.js";

describe("layerSlug", () => {
  it("lowercases and normalizes hyphens/underscores to single spaces", () => {
    expect(layerSlug("Pasture-A")).toBe("pasture a");
    expect(layerSlug("Pasture_A")).toBe("pasture a");
    expect(layerSlug("PASTURE A")).toBe("pasture a");
  });

  it("collapses multiple separators/spaces into one", () => {
    expect(layerSlug("Pasture--A")).toBe("pasture a");
    expect(layerSlug("Pasture   A")).toBe("pasture a");
  });

  it("trims leading/trailing whitespace", () => {
    expect(layerSlug("  Pasture A  ")).toBe("pasture a");
  });

  it("handles null/undefined without throwing", () => {
    expect(layerSlug(null)).toBe("");
    expect(layerSlug(undefined)).toBe("");
  });

  it("two differently-formatted strings for the same place slug identically", () => {
    expect(layerSlug("Pasture-A")).toBe(layerSlug("pasture_a"));
  });
});

describe("bindLayersToPlaces", () => {
  const places = [
    { id: "pastureA", name: "Pasture A", isActive: true },
    { id: "pastureB", name: "Pasture B", isActive: true },
    { id: "retired", name: "Old Barn", isActive: false },
  ];

  it("binds a layer to a place via slug equality (precedence 2)", () => {
    const layers = [{ id: "Pasture-A" }];
    const { zones, background } = bindLayersToPlaces(layers, places);
    expect(zones).toHaveLength(1);
    expect(zones[0].place.id).toBe("pastureA");
    expect(background).toEqual([]);
  });

  it("an EXPLICIT place_geometry row wins over slug matching (precedence 1)", () => {
    const layers = [{ id: "Pasture-A" }];
    const geometryRows = [{ svgLayerId: "Pasture-A", placeId: "pastureB" }];
    const { zones } = bindLayersToPlaces(layers, places, geometryRows);
    expect(zones[0].place.id).toBe("pastureB"); // explicit override, not the slug match
  });

  it("an unbound layer (no explicit row, no slug match) becomes background art", () => {
    const layers = [{ id: "Roads" }];
    const { zones, background } = bindLayersToPlaces(layers, places);
    expect(zones).toEqual([]);
    expect(background).toEqual([{ id: "Roads" }]);
  });

  it("does NOT slug-match an INACTIVE place (a retired place's zone falls back to background)", () => {
    const layers = [{ id: "Old-Barn" }];
    const { zones, background } = bindLayersToPlaces(layers, places);
    expect(zones).toEqual([]);
    expect(background).toHaveLength(1);
  });

  it("handles empty/missing inputs without throwing", () => {
    expect(() => bindLayersToPlaces([], [], [])).not.toThrow();
    expect(bindLayersToPlaces(null, null, null)).toEqual({ zones: [], background: [] });
  });

  it("processes multiple layers independently, preserving input order within each output list", () => {
    const layers = [{ id: "Pasture-A" }, { id: "Roads" }, { id: "Pasture-B" }];
    const { zones, background } = bindLayersToPlaces(layers, places);
    expect(zones.map((z) => z.layer.id)).toEqual(["Pasture-A", "Pasture-B"]);
    expect(background.map((l) => l.id)).toEqual(["Roads"]);
  });
});

describe("zoomTransform", () => {
  it("returns the identity (scale:1, transform:'none') for a missing/empty bbox", () => {
    expect(zoomTransform(null, 800, 600)).toEqual({ scale: 1, transform: "none" });
    expect(zoomTransform({ width: 0, height: 0 }, 800, 600)).toEqual({ scale: 1, transform: "none" });
  });

  it("computes a positive scale that fits the padded bbox into the map dimensions", () => {
    const { scale } = zoomTransform({ x: 0, y: 0, width: 100, height: 100 }, 800, 600, 0.2);
    expect(scale).toBeGreaterThan(0);
    expect(Number.isFinite(scale)).toBe(true);
  });

  it("a WIDER bbox (relative to the map) is scale-limited by width, not height", () => {
    const wide = zoomTransform({ x: 0, y: 0, width: 1000, height: 10 }, 800, 600, 0);
    // width-bound: scale ~= 800/1000 = 0.8, much less than height-bound 600/10=60.
    expect(wide.scale).toBeCloseTo(0.8, 5);
  });

  it("increasing padding shrinks the resulting scale (more breathing room around the zone)", () => {
    const noPad = zoomTransform({ x: 0, y: 0, width: 100, height: 100 }, 800, 600, 0);
    const padded = zoomTransform({ x: 0, y: 0, width: 100, height: 100 }, 800, 600, 0.5);
    expect(padded.scale).toBeLessThan(noPad.scale);
  });

  it("returns a CSS transform string carrying both translate and scale", () => {
    const { transform } = zoomTransform({ x: 0, y: 0, width: 100, height: 100 }, 800, 600);
    expect(transform).toContain("translate(");
    expect(transform).toContain("scale(");
  });
});

describe("layoutPins", () => {
  it("returns [] for a zero/negative count or a missing bbox", () => {
    expect(layoutPins({ x: 0, y: 0, width: 100, height: 100 }, 0)).toEqual([]);
    expect(layoutPins({ x: 0, y: 0, width: 100, height: 100 }, -1)).toEqual([]);
    expect(layoutPins(null, 3)).toEqual([]);
  });

  it("lays out exactly `count` pins", () => {
    expect(layoutPins({ x: 0, y: 0, width: 100, height: 100 }, 5)).toHaveLength(5);
  });

  it("every pin lands strictly inside the bbox (never on the edge or outside)", () => {
    const bbox = { x: 10, y: 10, width: 100, height: 100 };
    const pins = layoutPins(bbox, 4);
    for (const p of pins) {
      expect(p.x).toBeGreaterThan(bbox.x);
      expect(p.x).toBeLessThan(bbox.x + bbox.width);
      expect(p.y).toBeGreaterThan(bbox.y);
      expect(p.y).toBeLessThan(bbox.y + bbox.height);
    }
  });

  it("a single pin centers in the bbox", () => {
    const bbox = { x: 0, y: 0, width: 100, height: 100 };
    const [pin] = layoutPins(bbox, 1);
    expect(pin.x).toBeCloseTo(50, 5);
    expect(pin.y).toBeCloseTo(50, 5);
  });

  it("pin positions are deterministic (same bbox + count -> same layout every time)", () => {
    const bbox = { x: 0, y: 0, width: 100, height: 100 };
    expect(layoutPins(bbox, 5)).toEqual(layoutPins(bbox, 5));
  });
});

describe("tintForFlag / FLAG_TINTS", () => {
  it("resolves each known flag to a distinct tint with a label", () => {
    expect(tintForFlag("overdue").label).toBe("Overdue");
    expect(tintForFlag("due").label).toBe("To do");
    expect(tintForFlag("done").label).toBe("All done");
    expect(tintForFlag("idle").label).toBe("Quiet");
  });

  it("an unrecognized flag falls back to the idle tint (never undefined/crash)", () => {
    expect(tintForFlag("bogus")).toEqual(FLAG_TINTS.idle);
    expect(tintForFlag(undefined)).toEqual(FLAG_TINTS.idle);
  });

  it("severity ordering reads overdue > due > done > idle by fillOpacity (most urgent = most visually prominent)", () => {
    expect(FLAG_TINTS.overdue.fillOpacity).toBeGreaterThan(FLAG_TINTS.due.fillOpacity);
    expect(FLAG_TINTS.due.fillOpacity).toBeGreaterThan(FLAG_TINTS.done.fillOpacity);
    expect(FLAG_TINTS.done.fillOpacity).toBeGreaterThan(FLAG_TINTS.idle.fillOpacity);
  });
});
