import { useCallback, useEffect, useId, useState } from "react";
import { supabase } from "../supabase.js";

// place_geometry — the binding between places and the authored farm-map
// SVG (Batch 18.2). One row per place that maps onto an SVG layer:
// { placeId, svgLayerId, centroid, footprint }.
//
// The map renderer binds by name-slug match when no explicit row
// exists, then persists that match here (saveBinding) so the table
// reflects reality and later features (the Rotation planner's
// place-geometry substrate) can rely on it. Bindings survive renames:
// once a row exists it wins over slug matching.

const COLS = "place_id, svg_layer_id, centroid, footprint";

export function usePlaceGeometry() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const res = await supabase.from("place_geometry").select(COLS);
    if (res.error) {
      setError(res.error);
      setRows([]);
      return;
    }
    setRows(res.data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("place_geometry")
      .select(COLS)
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setRows([]);
          return;
        }
        setRows(res.data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        await load();
      }, 80);
    };
    const channel = supabase
      .channel(`place_geometry:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_geometry" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, load]);

  // Persist a layer↔place binding (idempotent upsert on place_id).
  // Fire-and-forget from the renderer's auto-bind pass — a failure just
  // means we slug-match again next load.
  const saveBinding = useCallback(async (placeId, svgLayerId, centroid) => {
    if (!placeId || !svgLayerId) return;
    const { error: err } = await supabase.from("place_geometry").upsert(
      {
        place_id: placeId,
        svg_layer_id: svgLayerId,
        centroid: centroid ?? null,
      },
      { onConflict: "place_id" }
    );
    if (err) console.error("place_geometry upsert:", err);
  }, []);

  const geometry = (rows ?? []).map((r) => ({
    placeId: r.place_id,
    svgLayerId: r.svg_layer_id,
    centroid: r.centroid,
    footprint: r.footprint,
  }));

  return {
    geometry,
    loading: rows === null,
    error,
    saveBinding,
  };
}
