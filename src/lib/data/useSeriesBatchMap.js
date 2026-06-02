import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Series → batch lookup (Batch 27.6). One map covering every way an
// event series can reference a batch:
//   - event_links rows with target_type 'batch' (arrival / pasture-move
//     / processing milestones, written by automations and the batch
//     picker), and
//   - batch_assignments rows (the per-series assignment written by the
//     Processing workspace and the EventEditor's batch picker; the
//     picker keeps event_links in sync, so these normally agree).
//
// Used by the Schedule to render batch-referencing titles on
// processing days and to filter the place timeline down to the events
// of the batches placed there.

export function useSeriesBatchMap() {
  const instanceId = useId();
  const [linkRows, setLinkRows] = useState(null);
  const [assignmentRows, setAssignmentRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const [links, assignments] = await Promise.all([
        supabase.from("event_links")
          .select("series_id, target_id")
          .eq("target_type", "batch"),
        supabase.from("batch_assignments")
          .select("event_instance_id, batch_id"),
      ]);
      if (cancelled) return;
      if (!links.error) setLinkRows(links.data ?? []);
      if (!assignments.error) setAssignmentRows(assignments.data ?? []);
    };
    fetchAll();

    // Debounced realtime refresh on either source table.
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 120);
    };
    const channel = realtimeChannel(`series-batch-map:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_links" }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "batch_assignments" },
        refresh)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [instanceId]);

  // batch_assignments win over event_links when both exist — the
  // picker keeps them in sync, so this is a tie-breaker, not a
  // conflict.
  return useMemo(() => {
    const map = new Map();
    for (const r of linkRows ?? []) {
      map.set(r.series_id, r.target_id);
    }
    for (const r of assignmentRows ?? []) {
      map.set(r.event_instance_id, r.batch_id);
    }
    return map;
  }, [linkRows, assignmentRows]);
}
