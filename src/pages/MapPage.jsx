import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { useSites } from "../lib/data/useSites.js";
import { usePlaceGeometry } from "../lib/data/usePlaceGeometry.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { computePlaceStatus } from "../lib/placeStatus.js";
import { parseFarmMapSvg, bindLayersToPlaces } from "../lib/farmMap.js";
import FarmMap, { MapLegend } from "../components/FarmMap.jsx";
import PlaceSearch, { pushRecent } from "../components/PlaceSearch.jsx";
import PlacePage from "./PlacePage.jsx";

// The Farm map page (Batch 18.2) — the desktop landing (decision 2 of
// the farm-map workshop). One dataset, two renderers: this is the
// WHERE-view (the Schedule is the WHEN-view). Zones tint by
// place_status; clicking drills zone → structure pins → place page.
// The place search is the express lane for going anywhere directly.
//
// On phone the map is a secondary, read-only browse view — capture
// always happens through Now / Rounds, never here.

const SVG_URL = "/farm-map_v1.svg";

export default function MapPage({ data, onOpenRounds, onNavigate }) {
  const {
    places, placesById, childrenByParent, placementsByPlaceId,
    groupsById, choreCtx, loading: sitesLoading,
  } = useSites();
  const { geometry, saveBinding, loading: geoLoading } = usePlaceGeometry();
  const { definitions } = useChoreDefinitions();
  const { blocks } = useChoreBlocks();
  const today = useMemo(() => new Date(), []);
  const completions = useChoreCompletions(today);

  // ── Authored SVG ────────────────────────────────────────────────────
  const [svg, setSvg] = useState(null);
  const [svgError, setSvgError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(SVG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseFarmMapSvg(text);
        if (!parsed) throw new Error("unparseable SVG");
        setSvg(parsed);
      })
      .catch((e) => {
        if (!cancelled) setSvgError(e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Layer ↔ place binding ───────────────────────────────────────────
  const { zones, background } = useMemo(() => {
    if (!svg) return { zones: [], background: [] };
    return bindLayersToPlaces(svg.layers, places, geometry);
  }, [svg, places, geometry]);

  // Persist slug-matched bindings to place_geometry (once per zone).
  // Explicit rows win on later loads, so renames don't break the map.
  const savedRef = useRef(new Set());
  const [zoneBboxes, setZoneBboxes] = useState(null);
  useEffect(() => {
    if (geoLoading || !zoneBboxes) return;
    const explicit = new Set(geometry.map((g) => g.placeId));
    for (const { layer, place } of zones) {
      if (explicit.has(place.id)) continue;
      if (savedRef.current.has(place.id)) continue;
      savedRef.current.add(place.id);
      const bbox = zoneBboxes.get(layer.id);
      const centroid = bbox
        ? { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
        : null;
      saveBinding(place.id, layer.id, centroid);
    }
  }, [zones, geometry, geoLoading, zoneBboxes, saveBinding]);

  // ── place_status projection (the tint) ──────────────────────────────
  const status = useMemo(() => computePlaceStatus({
    definitions,
    blocks,
    choreCtx,
    isDone: completions.isDone,
    now: today,
  }), [definitions, blocks, choreCtx, completions.isDone, today]);

  // ── Navigation state ────────────────────────────────────────────────
  // zoomedPlaceId — which zone the map is zoomed into (null = whole farm)
  // openPlaceId   — which place page is open (null = the map)
  const [zoomedPlaceId, setZoomedPlaceId] = useState(null);
  const [openPlaceId, setOpenPlaceId] = useState(null);

  const openPlace = (placeId) => {
    pushRecent(placeId);
    setOpenPlaceId(placeId);
  };

  // ── Place page takes over the section body ──────────────────────────
  if (openPlaceId) {
    return (
      <PlacePage
        placeId={openPlaceId}
        data={data}
        onBack={() => setOpenPlaceId(null)}
        onOpenPlace={(id) => openPlace(id)}
        onOpenRounds={onOpenRounds}
        onNavigate={onNavigate}
      />
    );
  }

  const farmRoot = places.find((p) => p.kind === "farm") ?? null;
  const loading = sitesLoading || (!svg && !svgError);

  return (
    <div className="flex flex-col gap-4">
      {/* Header: title + search + legend */}
      <header className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h2 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg">
            {farmRoot?.name ?? "Farm map"}
          </h2>
          <MapLegend className="mt-2" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <PlaceSearch
            places={places}
            placesById={placesById}
            groupsById={groupsById}
            placementsByPlaceId={placementsByPlaceId}
            onOpenPlace={(id) => setOpenPlaceId(id)}
            className="flex-1 sm:flex-none sm:w-[320px]"
          />
          <button
            onClick={() => onNavigate?.("resources_sites")}
            title="Edit the place tree"
            aria-label="Edit the place tree"
            className={
              "shrink-0 inline-flex items-center gap-1.5 bg-transparent " +
              "border border-line text-dim text-[11px] font-semibold " +
              "uppercase tracking-[0.12em] px-2.5 py-2 cursor-pointer " +
              "hover:text-fg"
            }
          >
            <Pencil size={12} />
            <span className="hidden sm:inline">Edit places</span>
          </button>
        </div>
      </header>

      {/* The map. Height is viewport-based (the page scrolls as a
          normal document now) so the map still fills most of the
          screen without an inner scroll container. */}
      <div className="h-[calc(100dvh-280px)] min-h-[420px] bg-surface border border-line relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] text-muted uppercase tracking-[0.16em]">
              Loading map…
            </span>
          </div>
        ) : svgError ? (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <span className="text-[13px] text-muted">
              The farm map artwork couldn't be loaded
              ({String(svgError.message ?? svgError)}). The place tree is
              still available through search and the place pages.
            </span>
          </div>
        ) : (
          <FarmMap
            svg={svg}
            zones={zones}
            background={background}
            placesById={placesById}
            childrenByParent={childrenByParent}
            flagOf={status.flagOf}
            byPlace={status.byPlace}
            zoomedPlaceId={zoomedPlaceId}
            onZoomPlace={setZoomedPlaceId}
            onOpenPlace={openPlace}
            onBboxes={setZoneBboxes}
          />
        )}
      </div>

      {/* Hint line */}
      <div className="shrink-0 text-[11px] text-faint">
        {zoomedPlaceId
          ? "Tap a pin to open that place — tap the zone name for the zone itself. Tap outside to zoom back out."
          : "Tap a zone to zoom in. Colors roll up everything inside a zone."}
      </div>
    </div>
  );
}
