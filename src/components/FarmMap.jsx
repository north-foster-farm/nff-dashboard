import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize } from "lucide-react";
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
// On top of the zone zoom there is a free pan/zoom layer driven by the
// SVG viewBox:
//
//   - pinch with two fingers to zoom (touch)
//   - drag with one finger / the mouse to pan while zoomed in
//   - on-screen + / − / fit controls as a fallback for any device
//   - right-click zooms out a step (context menu is suppressed)
//
// Pure presentation: all data (zones, flags, places) comes in as
// props; navigation goes out through callbacks.

const ZOOM_STEP = 1.5;     // per +/− click or right-click
const MAX_ZOOM = 16;       // deepest free zoom-in
const DRAG_THRESHOLD = 4;  // px before a drag counts as a pan, not a tap

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

  // ── Zone zoom (click a zone) ────────────────────────────────────────
  const zoomedZone = zones.find((z) => z.place.id === zoomedPlaceId) ?? null;
  const zoomedBbox = zoomedZone ? bboxes.get(zoomedZone.layer.id) : null;
  const { scale: zoneScale, transform } = useMemo(
    () =>
      zoomedBbox
        ? zoomTransform(zoomedBbox, svg.width, svg.height)
        : { scale: 1, transform: "none" },
    [zoomedBbox, svg.width, svg.height]
  );

  // ── Free pan / zoom (viewBox) ───────────────────────────────────────
  const svgRef = useRef(null);
  // The authored viewBox, parsed; the free view defaults to it.
  const fullView = useMemo(() => {
    const [x, y, w, h] = (svg.viewBox ?? "0 0 1000 1000")
      .split(/\s+/).map(Number);
    return { x, y, w, h };
  }, [svg.viewBox]);
  const [view, setView] = useState(null); // null = full view
  const curView = view ?? fullView;
  const freeScale = fullView.w / curView.w;

  // Counter-scale for strokes / labels / pins so they keep a constant
  // on-screen size through both zoom layers.
  const scale = zoneScale * freeScale;

  // Clamp a candidate view to the map bounds; zooming out to (or past)
  // the full view resets to null.
  const clampView = (v) => {
    if (v.w >= fullView.w || v.h >= fullView.h) return null;
    const minW = fullView.w / MAX_ZOOM;
    const minH = fullView.h / MAX_ZOOM;
    const w = Math.max(v.w, minW);
    const h = Math.max(v.h, minH);
    const x = Math.min(Math.max(v.x, fullView.x), fullView.x + fullView.w - w);
    const y = Math.min(Math.max(v.y, fullView.y), fullView.y + fullView.h - h);
    return { x, y, w, h };
  };

  // Client px → viewBox coords (preserveAspectRatio: xMidYMid meet).
  const toViewBox = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const s = Math.min(rect.width / curView.w, rect.height / curView.h);
    const offX = (rect.width - curView.w * s) / 2;
    const offY = (rect.height - curView.h * s) / 2;
    return {
      x: curView.x + (clientX - rect.left - offX) / s,
      y: curView.y + (clientY - rect.top - offY) / s,
      pxScale: s,
    };
  };

  // Zoom by `factor` keeping viewBox point (px, py) fixed on screen.
  const zoomAt = (px, py, factor) => {
    setView((prev) => {
      const cur = prev ?? fullView;
      const w = cur.w / factor;
      const h = cur.h / factor;
      const x = px - (px - cur.x) / factor;
      const y = py - (py - cur.y) / factor;
      return clampView({ x, y, w, h });
    });
  };

  const zoomStep = (factor) => {
    zoomAt(curView.x + curView.w / 2, curView.y + curView.h / 2, factor);
  };

  // Shared "zoom out one notch": free zoom first, then the zone zoom.
  const zoomOutStep = () => {
    if (view) zoomStep(1 / ZOOM_STEP);
    else if (zoomedPlaceId) onZoomPlace(null);
  };

  const resetView = () => {
    setView(null);
    onZoomPlace(null);
  };

  // ── Pointer gestures (pan + pinch) ──────────────────────────────────
  const pointersRef = useRef(new Map()); // pointerId → {x, y}
  const downRef = useRef(null);          // first pointer-down position
  const gestureRef = useRef(false);      // true once a pan/pinch engaged

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pointersRef.current.size === 0) {
      downRef.current = { x: e.clientX, y: e.clientY };
      gestureRef.current = false;
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const prevPts = new Map(pointersRef.current);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ids = [...pointersRef.current.keys()];

    if (ids.length >= 2) {
      // Pinch: scale around the midpoint of the first two pointers.
      const [a, b] = ids;
      const p1 = pointersRef.current.get(a);
      const p2 = pointersRef.current.get(b);
      const q1 = prevPts.get(a);
      const q2 = prevPts.get(b);
      const dNow = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const dPrev = Math.hypot(q1.x - q2.x, q1.y - q2.y);
      if (dPrev > 0 && dNow > 0) {
        engageGesture(e);
        const mid = toViewBox((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        zoomAt(mid.x, mid.y, dNow / dPrev);
      }
      return;
    }

    // Single pointer: pan, but only while zoomed in (panning the full
    // view has nowhere to go) and only past a small threshold so taps
    // still read as clicks.
    if (!view) return;
    const cur = pointersRef.current.get(e.pointerId);
    const prev = prevPts.get(e.pointerId);
    const fromDown = downRef.current
      ? Math.hypot(cur.x - downRef.current.x, cur.y - downRef.current.y)
      : 0;
    if (!gestureRef.current && fromDown < DRAG_THRESHOLD) return;
    engageGesture(e);
    const rect = svgRef.current.getBoundingClientRect();
    const s = Math.min(rect.width / curView.w, rect.height / curView.h);
    const dx = (cur.x - prev.x) / s;
    const dy = (cur.y - prev.y) / s;
    setView((prevView) => {
      const v = prevView ?? fullView;
      return clampView({ ...v, x: v.x - dx, y: v.y - dy });
    });
  };

  // Capturing the pointer routes the eventual click to the <svg> root
  // (which has no click handler), so zones / pins / backdrop never see
  // a click that was actually a drag or pinch.
  const engageGesture = (e) => {
    gestureRef.current = true;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // capture can fail if the pointer is already gone — harmless
    }
  };

  const onPointerEnd = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0) downRef.current = null;
  };

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

  // Zone label positions with a vertical declutter pass: adjacent
  // authored zones (e.g. Barn / Pasture B) can sit close enough that
  // their centered name plates overlap. We estimate each label's box
  // and, scanning top-to-bottom, nudge any label that collides with one
  // already placed straight down until it clears — cheap, deterministic,
  // and enough for the handful of zones on the map.
  const zoneLabels = useMemo(() => {
    const fontUnits = 38 / scale; // name glyph height in SVG units
    const out = [];
    const placed = [];
    const candidates = zones
      .map(({ layer, place }) => {
        const bbox = bboxes.get(layer.id);
        if (!bbox || place.id === zoomedPlaceId) return null;
        const due = dueCount(place.id);
        return {
          layerId: layer.id,
          place,
          due,
          cx: bbox.x + bbox.width / 2,
          cy: bbox.y + bbox.height / 2,
          // crude text box estimate: ~0.6em per glyph wide
          halfW: Math.max(
            (place.name.length * fontUnits * 0.32),
            fontUnits),
          halfH: (due > 0 ? fontUnits * 1.4 : fontUnits * 0.7),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.cy - b.cy);

    for (const c of candidates) {
      let guard = 0;
      // Push down while overlapping any already-placed label.
      // eslint-disable-next-line no-loop-func
      while (guard++ < 40 && placed.some((p) =>
        Math.abs(p.cx - c.cx) < (p.halfW + c.halfW) &&
        Math.abs(p.cy - c.cy) < (p.halfH + c.halfH))) {
        c.cy += fontUnits * 0.5;
      }
      placed.push(c);
      out.push(c);
    }
    return out;
  }, [zones, bboxes, zoomedPlaceId, scale, byPlace]);

  const viewBoxAttr = view
    ? `${curView.x} ${curView.y} ${curView.w} ${curView.h}`
    : svg.viewBox;

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={viewBoxAttr}
        className="w-full h-full select-none"
        style={{ touchAction: "none" }}
        role="img"
        aria-label="Farm map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => {
          // Right-click = zoom out one notch.
          e.preventDefault();
          zoomOutStep();
        }}
      >
        {/* Backdrop click target — zooms back out. */}
        <rect
          x={fullView.x}
          y={fullView.y}
          width={fullView.w}
          height={fullView.h}
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
          {zoneLabels.map(({ layerId, place, due, cx, cy }) => {
            return (
              <g key={`label-${layerId}`} pointerEvents="none">
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--c-text)"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 38 / scale,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    paintOrder: "stroke",
                    stroke: "var(--c-bg)",
                    strokeWidth: 7 / scale,
                    strokeLinejoin: "round",
                  }}
                >
                  {place.name}
                </text>
                {due > 0 && (
                  <text
                    x={cx}
                    y={cy + 42 / scale}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="var(--c-text-dim)"
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 26 / scale,
                      fontWeight: 600,
                      paintOrder: "stroke",
                      stroke: "var(--c-bg)",
                      strokeWidth: 5.5 / scale,
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
                y={zoomedBbox.y - 18 / scale}
                textAnchor="middle"
                fill="var(--c-text)"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPlace(zoomedZone.place.id);
                }}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 34 / scale,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textDecoration: "underline",
                  paintOrder: "stroke",
                  stroke: "var(--c-bg)",
                  strokeWidth: 7 / scale,
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

      {/* On-screen zoom controls — fallback for devices where pinch /
          right-click isn't natural. */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col bg-surface border border-line shadow-lg">
        <MapControlButton onClick={() => zoomStep(ZOOM_STEP)} label="Zoom in">
          <Plus size={16} />
        </MapControlButton>
        <MapControlButton onClick={zoomOutStep} label="Zoom out">
          <Minus size={16} />
        </MapControlButton>
        <MapControlButton onClick={resetView} label="Fit whole farm" last>
          <Maximize size={14} />
        </MapControlButton>
      </div>
    </div>
  );
}

// One auto-laid-out structure pin. Sized in screen units (divided by
// the zoom scale) so pins stay readable at any zoom level.
function StructurePin({ place, x, y, scale, flag, due, onClick }) {
  const tint = tintForFlag(flag);
  const r = 24 / scale;
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
        strokeWidth={3.5 / scale}
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
          fontSize: 21 / scale,
          fontWeight: 700,
        }}
      >
        {due > 0 ? due : "✓"}
      </text>
      {/* Label under the pin */}
      <text
        x={x}
        y={y + r + 20 / scale}
        textAnchor="middle"
        fill="var(--c-text)"
        pointerEvents="none"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 19 / scale,
          fontWeight: 600,
          paintOrder: "stroke",
          stroke: "var(--c-bg)",
          strokeWidth: 5 / scale,
          strokeLinejoin: "round",
        }}
      >
        {place.code || place.name}
      </text>
    </g>
  );
}

function MapControlButton({ onClick, label, last = false, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "w-9 h-9 flex items-center justify-center bg-transparent " +
        "text-dim hover:text-fg cursor-pointer " +
        (last ? "border-0" : "border-0 border-b border-line")
      }
    >
      {children}
    </button>
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
