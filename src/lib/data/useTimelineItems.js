import { useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Read-only hook over the `timeline_items` view (Batch 13.1).
//
// The view unions event_occurrences + chore_runs with a `kind`
// discriminator so the calendar UI consumes one source. Note:
// recurring event series with no materialized override don't show up
// here — those expand at read-time via lib/recurrence.js. The view
// is the materialized half.
//
// Realtime subscription listens to both underlying tables; the
// view itself doesn't broadcast.
//
// `range` accepts `{ fromISO, toISO }` (YYYY-MM-DD strings, both
// inclusive). Defaults to the current calendar month.
//
// Returned shape:
//   {
//     items: [{
//       kind: 'event' | 'chore_run',
//       id, occursOn, startTime, endTime, status,
//       seriesId, eventKindId, label,    // event rows only
//       blockId, startedAt, endedAt,     // chore_run rows only
//     }],
//     loading, error,
//   }

const SELECT_COLS =
  "kind, id, series_id, occurs_on, start_time, end_time, status, " +
  "event_kind_id, label, block_id, started_at, ended_at";

export function useTimelineItems({ fromISO, toISO } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const range = useMemo(() => {
    if (fromISO && toISO) return { fromISO, toISO };
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      fromISO: isoDate(first),
      toISO: isoDate(last),
    };
  }, [fromISO, toISO]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("timeline_items")
      .select(SELECT_COLS)
      .gte("occurs_on", range.fromISO)
      .lte("occurs_on", range.toISO)
      .order("occurs_on", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setRows([]); return; }
        setRows(res.data ?? []);
      });
    return () => { cancelled = true; };
  }, [range.fromISO, range.toISO]);

  // Realtime: bounce on either underlying table changing in-window.
  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("timeline_items")
          .select(SELECT_COLS)
          .gte("occurs_on", range.fromISO)
          .lte("occurs_on", range.toISO)
          .order("occurs_on", { ascending: true });
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`timeline_items:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_occurrences" },
        refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chore_runs" },
        refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, range.fromISO, range.toISO]);

  const items = useMemo(() => (rows ?? []).map(r => ({
    kind: r.kind,
    id: r.id,
    seriesId: r.series_id,
    occursOn: r.occurs_on,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    eventKindId: r.event_kind_id,
    label: r.label,
    blockId: r.block_id,
    startedAt: r.started_at ? new Date(r.started_at) : null,
    endedAt: r.ended_at ? new Date(r.ended_at) : null,
  })), [rows]);

  return {
    items,
    loading: rows === null,
    error,
    range,
  };
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
