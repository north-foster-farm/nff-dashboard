import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// CRUD on event_occurrences.
//
// The primary write paths are:
//   * upsertOverride({ seriesId, occursOn, ...overrideFields })
//       — first-override materialization. Idempotent on
//       (series_id, occurs_on); subsequent edits to the same date
//       update the same row.
//   * skipOccurrence({ seriesId, occursOn })
//       — shorthand for upsertOverride with status='skipped'.
//   * unskipOccurrence({ seriesId, occursOn })
//       — flip status back to 'scheduled'. Used when the user
//       changes their mind on a per-occurrence skip.
//   * deleteOverride(id)
//       — removes a materialized row. The series's read-time
//       expansion takes over again for that date.
//
// One-off series are also held here: their single occurrence row is
// the source of truth for date / start / end. The EventEditor's
// "edit one-off" path updates this row directly via upsertOverride
// (the row already exists from the migration / create-series flow).

const SELECT_COLS =
  "id, series_id, occurs_on, start_time, end_time, " +
  "location_override, notes_override, status, gcal_event_id, " +
  "payload_override";

export function useEventOccurrences({ seriesId } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    let q = supabase.from("event_occurrences")
      .select(SELECT_COLS)
      .order("occurs_on", { ascending: true });
    if (seriesId) q = q.eq("series_id", seriesId);
    q.then((res) => {
      if (cancelled) return;
      if (res.error) { setError(res.error); setRows([]); return; }
      setRows(res.data ?? []);
    });
    return () => { cancelled = true; };
  }, [seriesId]);

  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        let q = supabase.from("event_occurrences")
          .select(SELECT_COLS)
          .order("occurs_on", { ascending: true });
        if (seriesId) q = q.eq("series_id", seriesId);
        const res = await q;
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`event_occurrences:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_occurrences" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, seriesId]);

  const occurrences = useMemo(() => (rows ?? []).map(toCamel), [rows]);

  const upsertOverride = useCallback(async (input) => {
    const dbRow = toDb(input);
    const { data, error: err } = await supabase
      .from("event_occurrences")
      .upsert(dbRow, { onConflict: "series_id,occurs_on" })
      .select()
      .single();
    if (err) throw err;
    setRows((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex(r =>
        r.series_id === data.series_id && r.occurs_on === data.occurs_on
      );
      if (idx === -1) return [...prev, data];
      const next = [...prev];
      next[idx] = data;
      return next;
    });
    return toCamel(data);
  }, []);

  const skipOccurrence = useCallback(async ({ seriesId, occursOn }) => (
    upsertOverride({ seriesId, occursOn, status: "skipped" })
  ), [upsertOverride]);

  const unskipOccurrence = useCallback(async ({ seriesId, occursOn }) => (
    upsertOverride({ seriesId, occursOn, status: "scheduled" })
  ), [upsertOverride]);

  const deleteOverride = useCallback(async (id) => {
    const prev = rows ? [...rows] : null;
    setRows((cur) => cur ? cur.filter(r => r.id !== id) : cur);
    const { error: err } = await supabase
      .from("event_occurrences").delete().eq("id", id);
    if (err) {
      setRows(prev);
      throw err;
    }
  }, [rows]);

  return {
    occurrences,
    loading: rows === null,
    error,
    upsertOverride,
    skipOccurrence,
    unskipOccurrence,
    deleteOverride,
  };
}

function toCamel(r) {
  return {
    id: r.id,
    seriesId: r.series_id,
    occursOn: r.occurs_on,
    startTime: r.start_time,
    endTime: r.end_time,
    locationOverride: r.location_override,
    notesOverride: r.notes_override,
    status: r.status,
    gcalEventId: r.gcal_event_id,
    payloadOverride: r.payload_override,
  };
}

function toDb(patch) {
  const out = {};
  if ("seriesId" in patch) out.series_id = patch.seriesId;
  if ("occursOn" in patch) out.occurs_on = patch.occursOn;
  if ("startTime" in patch) out.start_time = patch.startTime || null;
  if ("endTime" in patch) out.end_time = patch.endTime || null;
  if ("locationOverride" in patch) out.location_override = patch.locationOverride;
  if ("notesOverride" in patch) out.notes_override = patch.notesOverride;
  if ("status" in patch) out.status = patch.status;
  if ("payloadOverride" in patch) out.payload_override = patch.payloadOverride;
  return out;
}
