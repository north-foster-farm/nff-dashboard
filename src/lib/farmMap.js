// farmMap.js — pure helpers for the authored farm-map SVG (Batch 18.2).
//
// The map is a *view* over the place tree, not a separate dataset: the
// authored SVG (public/farm-map_v1.svg) carries zone-level geometry,
// and these helpers bind its layers to `places` rows, compute the zoom
// transform, lay out structure pins (the v1 art has no structure
// geometry), and translate place_status flags into tint styles.
//
// Framework-free except for DOMParser (browser-only), mirroring
// lib/places.js / lib/placeStatus.js.

// ── SVG parsing ───────────────────────────────────────────────────────

// Read an attribute off an element, walking up ancestors so paths
// inherit fills/strokes from their parent <g> (the authored file sets
// fill/stroke on the zone group, not on each path).
function inheritedAttr(el, name) {
  let cur = el;
  while (cur && cur.getAttribute) {
    const v = cur.getAttribute(name);
    if (v != null) return v;
    cur = cur.parentElement;
  }
  return null;
}

// Parse the SVG text into { viewBox, width, height, layers }.
// Every <path id> becomes a layer; binding (below) decides which are
// interactive zones and which stay background art (Roads, the farm
// boundary).
export function parseFarmMapSvg(text) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName !== "svg") return null;
  const viewBox = svg.getAttribute("viewBox") ?? "0 0 1000 1000";
  const [, , width, height] = viewBox.split(/\s+/).map(Number);

  const layers = [...doc.querySelectorAll("path[id]")].map((p) => ({
    id: p.getAttribute("id"),
    d: p.getAttribute("d"),
    fill: inheritedAttr(p, "fill") ?? "#888",
    fillOpacity: Number(inheritedAttr(p, "fill-opacity") ?? 1),
    stroke: inheritedAttr(p, "stroke"),
    strokeOpacity: Number(inheritedAttr(p, "stroke-opacity") ?? 1),
    strokeWidth: Number(inheritedAttr(p, "stroke-width") ?? 1),
  }));

  return { viewBox, width, height, layers };
}

// ── Layer ↔ place binding ─────────────────────────────────────────────

// Slug both sides so "Pasture-A" matches the place named "Pasture A".
export function layerSlug(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Bind SVG layers to places. Returns:
//   {
//     zones: [{ layer, place }],   // interactive, tinted, clickable
//     background: [layer, …],      // static art (Roads, farm boundary)
//   }
// Binding precedence per layer:
//   1. an explicit place_geometry row (svg_layer_id → place_id)
//   2. slug equality between the layer id and a place name
//   3. unbound → background
export function bindLayersToPlaces(layers, places, geometryRows = []) {
  const placeById = new Map((places ?? []).map((p) => [p.id, p]));
  const placeBySlug = new Map(
    (places ?? [])
      .filter((p) => p.isActive !== false)
      .map((p) => [layerSlug(p.name), p])
  );
  const explicit = new Map(
    (geometryRows ?? [])
      .filter((g) => g.svgLayerId)
      .map((g) => [g.svgLayerId, g.placeId])
  );

  const zones = [];
  const background = [];
  for (const layer of layers ?? []) {
    const explicitPlace = explicit.has(layer.id)
      ? placeById.get(explicit.get(layer.id))
      : null;
    const place = explicitPlace ?? placeBySlug.get(layerSlug(layer.id));
    if (place) zones.push({ layer, place });
    else background.push(layer);
  }
  return { zones, background };
}

// ── Zoom ──────────────────────────────────────────────────────────────

// CSS transform that zooms the map's root <g> onto a bbox, centered,
// with proportional padding. Returns { scale, transform } — scale is
// also used to counter-scale pins/labels so they stay readable.
export function zoomTransform(bbox, mapWidth, mapHeight, padding = 0.2) {
  if (!bbox || !bbox.width || !bbox.height) {
    return { scale: 1, transform: "none" };
  }
  const pad = Math.max(bbox.width, bbox.height) * padding;
  const bx = bbox.x - pad;
  const by = bbox.y - pad;
  const bw = bbox.width + pad * 2;
  const bh = bbox.height + pad * 2;
  const scale = Math.min(mapWidth / bw, mapHeight / bh);
  const tx = (mapWidth - bw * scale) / 2 - bx * scale;
  const ty = (mapHeight - bh * scale) / 2 - by * scale;
  return {
    scale,
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
  };
}

// ── Structure pins ────────────────────────────────────────────────────

// Auto-laid-out slots for a zone's child structures — the v1 art has
// no per-structure geometry, so pins land on a centered grid inside
// the zone's bounding box.
export function layoutPins(bbox, count) {
  if (!bbox || count <= 0) return [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = bbox.width / (cols + 1);
  const cellH = bbox.height / (rows + 1);
  const out = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push({
      x: bbox.x + cellW * (c + 1),
      y: bbox.y + cellH * (r + 1),
    });
  }
  return out;
}

// ── Status tint ───────────────────────────────────────────────────────

// place_status flag → SVG tint. Colors ride on the theme's CSS vars so
// light/dark switching keeps working; opacity differentiates "needs
// attention" from "quiet".
export const FLAG_TINTS = {
  overdue: { fill: "var(--c-warn)", fillOpacity: 0.6, label: "Overdue" },
  due: { fill: "var(--c-accent)", fillOpacity: 0.55, label: "To do" },
  done: { fill: "var(--c-resolved)", fillOpacity: 0.4, label: "All done" },
  idle: { fill: "var(--c-text-muted)", fillOpacity: 0.15, label: "Quiet" },
};

export function tintForFlag(flag) {
  return FLAG_TINTS[flag] ?? FLAG_TINTS.idle;
}
