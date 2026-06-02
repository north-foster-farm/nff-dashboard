import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// event_links reader for one polymorphic target (Batch 20). The batch
// lifecycle page reads its milestone strip from here: every link row
// comes back with its series embedded (label, kind, status, payload)
// and the series' materialized occurrences (the canonical date for
// one-off events lives on the occurrence).
//
//   useEventLinks({ targetType: "batch", targetId })
//     → {
//         links: [{ id, role, seriesId, series: {
//                    id, kindId, label, status, payload, dtstart,
//                    automationEmissionId,
//                    occurrences: [{ id, occursOn, startTime, endTime,
//                                    status }] } }],
//         loading, error,
//         linkSeries(seriesId, role)   — create a link to this target
//         unlink(linkId)
//         refresh()
//       }
//
// Realtime: re-fetches on any event_links / event_series /
// event_occurrences change (debounced) so date edits made in the
// EventEditor reflect on the lifecycle strip immediately.

const SELECT =
  "id, series_id, occurrence_id, target_type, target_id, role, " +
  "created_at, " +
  "event_series(id, kind_id, label, status, payload, dtstart, " +
  "automation_emission_id, " +
  "event_occurrences(id, occurs_on, start_time, end_time, status))";

export function useEventLinks({ targetType, targetId }) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!targetType || !targetId) { setRows([]); return; }
    const res = await supabase.from("event_links")
      .select(SELECT)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (res.error) { setError(res.error); setRows([]); return; }
    setRows(res.data ?? []);
  }, [targetType, targetId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!targetType || !targetId) return undefined;
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 120);
    };
    const channel = realtimeChannel(
      `event_links:${targetType}:${targetId}:${instanceId}`
    )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_links" }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_series" }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_occurrences" },
        refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [targetType, targetId, instanceId, fetchAll]);

  const links = useMemo(() => (rows ?? []).map(toCamel), [rows]);

  const linkSeries = useCallback(async (seriesId, role) => {
    const { error: err } = await supabase.from("event_links").insert({
      series_id: seriesId,
      target_type: targetType,
      target_id: targetId,
      role,
    });
    if (err) throw err;
    await fetchAll();
  }, [targetType, targetId, fetchAll]);

  const unlink = useCallback(async (linkId) => {
    const { error: err } = await supabase.from("event_links")
      .delete().eq("id", linkId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    links,
    loading: rows === null,
    error,
    linkSeries,
    unlink,
    refresh: fetchAll,
  };
}

function toCamel(r) {
  const s = r.event_series;
  return {
    id: r.id,
    seriesId: r.series_id,
    occurrenceId: r.occurrence_id,
    targetType: r.target_type,
    targetId: r.target_id,
    role: r.role,
    series: s ? {
      id: s.id,
      kindId: s.kind_id,
      label: s.label,
      status: s.status,
      payload: s.payload,
      dtstart: s.dtstart,
      automationEmissionId: s.automation_emission_id,
      occurrences: (s.event_occurrences ?? [])
        .map(o => ({
          id: o.id,
          occursOn: o.occurs_on,
          startTime: o.start_time,
          endTime: o.end_time,
          status: o.status,
        }))
        .sort((a, b) => (a.occursOn ?? "").localeCompare(b.occursOn ?? "")),
    } : null,
  };
}
