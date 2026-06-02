import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Scheduled processing dates for every batch, in one query (Batch 26.2).
//
//   useProcessingDates() → { processingDateByBatchId, loading, error }
//
// Reads event_links rows with role = 'processing' and target_type =
// 'batch', embedding each link's series + occurrences, and returns a
// Map<batchId, ISO date> of the live (non-skipped) occurrence. The
// Metrics page comparison sheet and the dashboard weeks-remaining
// widget use this so weeks-remaining counts down to the real scheduled
// processing day when one exists (falling back to the species target
// otherwise). BatchPage keeps its own per-batch useEventLinks read.

const SELECT =
  "target_id, event_series(status, " +
  "event_occurrences(occurs_on, status))";

export function useProcessingDates() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;

    const fetchAll = async () => {
      const { data, error: err } = await supabase.from("event_links")
        .select(SELECT)
        .eq("target_type", "batch")
        .eq("role", "processing");
      if (cancelled) return;
      if (err) { setError(err); return; }
      setRows(data ?? []);
    };

    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 120);
    };

    fetchAll();
    const channel = realtimeChannel(`processing_dates:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_links" }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_occurrences" }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [instanceId]);

  const processingDateByBatchId = useMemo(() => {
    const map = new Map();
    for (const r of rows ?? []) {
      const series = r.event_series;
      // Tombstoned (ended) series don't count — the batch page treats
      // them as removed milestones.
      if (!series || series.status === "ended") continue;
      const occs = (series.event_occurrences ?? [])
        .filter(o => o.status !== "skipped")
        .sort((a, b) => (a.occurs_on ?? "").localeCompare(b.occurs_on ?? ""));
      const live = occs[0];
      if (live?.occurs_on && !map.has(r.target_id)) {
        map.set(r.target_id, live.occurs_on);
      }
    }
    return map;
  }, [rows]);

  return { processingDateByBatchId, loading: rows === null, error };
}
