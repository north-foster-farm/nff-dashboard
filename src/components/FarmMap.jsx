import { useEffect, useMemo, useRef, useState } from "react";
import {
  zoomTransform, layoutPins, tintForFlag, FLAG_TINTS,
} from "../lib/farmMap.js";
import { childrenOf } from "../lib/places.js";

// The farm map renderer (Batch 18.2). Renders the authored SVG's
// background art as-is and its zone layers as interactive, tinted
// shapes:
//
//   - each zone is tinted by its place_status flag (overdue / due /
//     done / idle), rolled up from everything beneath it
//   - click a zone → zoom into it; its child structures appear as
//     auto-laid-out pins (the v1 art has no structure geometry)
//   - click a pin (or the zoomed zone's name plate) → open that
//     place's page
//   - click the backdrop → zoom back out
//
// Pure presentation: all data (zones, flags, places) comes in as
// props; navigation goes out through callbacks.

export default function FarmMap({
  svg,                 // parseFarmMapSvg() result
  zones,               // [{ layer, place }] from bindLayersToPlaces
  background,          // [layer, …]
  placesById,
  childrenByParent,
  flagOf,              // placeStatus flag accessor
  byPlace,             // placeStatus rollup map (for due counts)
  zoomedPlaceId,       // place id of the zoomed zone, or null
  onZoomPlace,         // (placeId|null) =>
  onOpenPlace,         // (placeId) =>
  onBboxes,            // optional: (Map<layerId, bbox>) => — for callers
                       // that want centroids (auto-bind persistence)
}) {
  // ── Measure zone path bounding boxes ───────────────────────────────
  // getBBox() needs rendered elements, so we measure post-mount and
  // whenever the zone list changes.
  const pathRefs = useRef(new Map());
  const [bboxes, setBboxes] = useState(() => new Map());
  const zonesKey = zones.map((z) => z.layer.id).join("|");
  useEffect(() => {
    const m = new Map();
    for (const [id, el] of pathRefs.current) {
      if (el && el.isConnected) {
        try {
          m.set(id, el.getBBox());
        } catch {
          // detached/invalid path — skip
        }
      }
    }
    setBboxes(m);
    if (m.size > 0) onBboxes?.(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zonesKey]);

  // ── Zoom ────────────────────────────────────────────────────────────
  const zoomedZone = zones.find((z) => z.place.id === zoomedPlaceId) ?? null;
  const zoomedBbox = zoomedZone ? bboxes.get(zoomedZone.layer.id) : null;
  const { scale, transform } = useMemo(
    () =>
      zoomedBbox
        ? zoomTransform(zoomedBbox, svg.width, svg.height)
        : { scale: 1, transform: "none" },
    [zoomedBbox, svg.width, svg.height]
  );

  // Child structures of the zoomed place → pins on a grid.
  const pins = useMemo(() => {
    if (!zoomedZone || !zoomedBbox) return [];
    const children = childrenOf(zoomedZone.place.id, childrenByParent);
    const slots = layoutPins(zoomedBbox, children.length);
    return children.map((place, i) => ({ place, ...slots[i] }));
  }, [zoomedZone, zoomedBbox, childrenByParent]);

  const dueCount = (placeId) => {
    const c = byPlace?.get(placeId);
    if (!c) return 0;
    return c.due + c.overdue;
  };

  return (
    <svg
      viewBox={svg.viewBox}
      className="w-full h-full select-none"
      role="img"
      aria-label="Farm map"
    >
      {/* Backdrop click target — zooms back out. */}
      <rect
        x={0}
        y={0}
        width={svg.width}
        height={svg.height}
        fill="transparent"
        onClick={() => onZoomPlace(null)}
      />
      <g
        style={{
          transform,
          transformOrigin: "0 0",
          transition: "transform 450ms cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      >
        {/* Background art (roads, farm boundary) */}
        {background.map((layer) => (
          <path
            key={layer.id}
            d={layer.d}
            fill={layer.fill}
            fillOpacity={layer.fillOpacity}
            stroke={layer.stroke ?? "none"}
            strokeOpacity={layer.strokeOpacity}
            strokeWidth={layer.strokeWidth}
            pointerEvents="none"
          />
        ))}

        {/* Zones — tinted by place_status, clickable */}
        {zones.map(({ layer, place }) => {
          const flag = flagOf(place.id);
          const tint = tintForFlag(flag);
          const isZoomed = place.id === zoomedPlaceId;
          return (
            <path
              key={layer.id}
              ref={(el) => {
                if (el) pathRefs.current.set(layer.id, el);
                else pathRefs.current.delete(layer.id);
              }}
              d={layer.d}
              fill={tint.fill}
              fillOpacity={tint.fillOpacity}
              stroke={isZoomed ? "var(--c-text)" : "var(--c-text-muted)"}
              strokeOpacity={isZoomed ? 0.8 : 0.4}
              strokeWidth={(isZoomed ? 2.5 : 1.5) / scale}
              className="cursor-pointer"
              style={{ transition: "fill 300ms ease, fill-opacity 300ms ease" }}
              onClick={(e) => {
                e.stopPropagation();
                if (isZoomed) onOpenPlace(place.id);
                else onZoomPlace(place.id);
              }}
            >
              <title>{place.name}</title>
            </path>
          );
        })}

        {/* Zone labels — name + due-count badge at the bbox center.
            Hidden for the zoomed zone (its pins + name plate take over). */}
        {zones.map(({ layer, place }) => {
          const bbox = bboxes.get(layer.id);
          if (!bbox || place.id === zoomedPlaceId) return null;
          const due = dueCount(place.id);
          const cx = bbox.x + bbox.width / 2;
          const cy = bbox.y + bbox.height / 2;
          return (
            <g key={`label-${layer.id}`} pointerEvents="none">
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--c-text)"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 26 / scale,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  paintOrder: "stroke",
                  stroke: "var(--c-bg)",
                  strokeWidth: 5 / scale,
                  strokeLinejoin: "round",
                }}
              >
                {place.name}
              </text>
              {due > 0 && (
                <text
                  x={cx}
                  y={cy + 30 / scale}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--c-text-dim)"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 18 / scale,
                    fontWeight: 600,
                    paintOrder: "stroke",
                    stroke: "var(--c-bg)",
                    strokeWidth: 4 / scale,
                    strokeLinejoin: "round",
                  }}
                >
                  {due} to do
                </text>
              )}
            </g>
          );
        })}

        {/* Zoomed zone: name plate + structure pins */}
        {zoomedZone && zoomedBbox && (
          <g>
            {/* Name plate above the zone — click → place page */}
            <text
              x={zoomedBbox.x + zoomedBbox.width / 2}
              y={zoomedBbox.y - 14 / scale}
              textAnchor="middle"
              fill="var(--c-text)"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPlace(zoomedZone.place.id);
              }}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 24 / scale,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "underline",
                paintOrder: "stroke",
                stroke: "var(--c-bg)",
                strokeWidth: 5 / scale,
                strokeLinejoin: "round",
              }}
            >
              {zoomedZone.place.name} →
            </text>

            {pins.map(({ place, x, y }) => (
              <StructurePin
                key={place.id}
                place={place}
                x={x}
                y={y}
                scale={scale}
                flag={flagOf(place.id)}
                due={dueCount(place.id)}
                onClick={() => onOpenPlace(place.id)}
              />
            ))}
          </g>
        )}
      </g>
    </svg>
  );
}

// One auto-laid-out structure pin. Sized in screen units (divided by
// the zoom scale) so pins stay readable at any zoom level.
function StructurePin({ place, x, y, scale, flag, due, onClick }) {
  const tint = tintForFlag(flag);
  const r = 16 / scale;
  return (
    <g
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <title>{place.name}</title>
      {/* Pin disc */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={tint.fill}
        fillOpacity={Math.min(tint.fillOpacity + 0.3, 1)}
        stroke="var(--c-bg)"
        strokeWidth={2.5 / scale}
      />
      {/* Due-count inside the disc */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--c-bg)"
        pointerEvents="none"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 14 / scale,
          fontWeight: 700,
        }}
      >
        {due > 0 ? due : "✓"}
      </text>
      {/* Label under the pin */}
      <text
        x={x}
        y={y + r + 14 / scale}
        textAnchor="middle"
        fill="var(--c-text)"
        pointerEvents="none"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13 / scale,
          fontWeight: 600,
          paintOrder: "stroke",
          stroke: "var(--c-bg)",
          strokeWidth: 3.5 / scale,
          strokeLinejoin: "round",
        }}
      >
        {place.code || place.name}
      </text>
    </g>
  );
}

// Compact legend mapping tints to meanings — rendered by the page
// header, exported here so the color source of truth stays in one file.
export function MapLegend({ className = "" }) {
  return (
    <div className={"flex items-center gap-3 flex-wrap " + className}>
      {Object.entries(FLAG_TINTS).map(([flag, tint]) => (
        <span key={flag} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 border border-line"
            style={{ background: tint.fill, opacity: tint.fillOpacity + 0.3 }}
          />
          <span className="text-[11px] text-dim">{tint.label}</span>
        </span>
      ))}
    </div>
  );
}
