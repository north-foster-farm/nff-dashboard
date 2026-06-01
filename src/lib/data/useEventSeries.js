import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// CRUD on event_series + the split-series transaction that powers
// the "This and following" branch of the EventEditor scope prompt.
//
// Realtime-subscribed; consumers get live updates when other tabs /
// devices edit a series.
//
// Returned shape:
//   {
//     series:      [{ id, kindId, label, subtitle, location, rrule,
//                     dtstart, until, durationMinutes, seasonWindow,
//                     status, payload, notes, legacyInstanceId }],
//     seriesById:  Map<id, series>,
//     loading, error,
//     createSeries(input)  -> series
//     updateSeries(id, patch) -> void
//     deleteSeries(id) -> void
//     splitSeries(id, splitDate, newRulePatch) -> { oldId, newId }
//       Caps the existing series at splitDate-1 and starts a new
//       series from splitDate. `newRulePatch` is the patch (rrule /
//       dtstart / until / etc.) to apply to the new series. Override
//       rows whose occurs_on >= splitDate move with the new series.
//   }

const SELECT_COLS =
  "id, legacy_instance_id, kind_id, label, subtitle, location, " +
  "rrule, dtstart, until, duration_minutes, season_window, " +
  "status, payload, notes, automation_emission_id";

export function useEventSeries() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("event_series")
      .select(SELECT_COLS)
      .order("label", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setRows([]); return; }
        setRows(res.data ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("event_series")
          .select(SELECT_COLS)
          .order("label", { ascending: true });
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`event_series:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "event_series" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const series = useMemo(() => (rows ?? []).map(toCamel), [rows]);
  const seriesById = useMemo(
    () => new Map(series.map(s => [s.id, s])),
    [series]
  );

  const createSeries = useCallback(async (input) => {
    const dbRow = toDb(input);
    const { data, error: err } = await supabase
      .from("event_series")
      .insert(dbRow)
      .select()
      .single();
    if (err) throw err;
    setRows((prev) => prev ? [...prev, data] : prev);
    return toCamel(data);
  }, []);

  const updateSeries = useCallback(async (id, patch) => {
    const dbPatch = toDb(patch);
    const prev = rows ? [...rows] : null;
    setRows((cur) =>
      cur ? cur.map(r => r.id === id ? { ...r, ...dbPatch } : r) : cur
    );
    const { error: err } = await supabase
      .from("event_series").update(dbPatch).eq("id", id);
    if (err) {
      setRows(prev);
      throw err;
    }
  }, [rows]);

  const deleteSeries = useCallback(async (id) => {
    const prev = rows ? [...rows] : null;
    setRows((cur) => cur ? cur.filter(r => r.id !== id) : cur);
    const { error: err } = await supabase
      .from("event_series").delete().eq("id", id);
    if (err) {
      setRows(prev);
      throw err;
    }
  }, [rows]);

  // Split: cap the original at (splitDate - 1) day end-of-day, then
  // insert a new series whose dtstart is the splitDate at the given
  // wall-clock start time. Move any override rows on/after splitDate
  // to the new series so they ride with the new rule.
  //
  // splitDate is a YYYY-MM-DD string (the date being edited).
  const splitSeries = useCallback(async (id, splitDate, newSeriesPatch) => {
    const old = (rows ?? []).find(r => r.id === id);
    if (!old) throw new Error("series not found");
    // Cap the old series at the day BEFORE splitDate so the split
    // date itself belongs to the new series.
    const capUntil = new Date(`${splitDate}T00:00:00Z`);
    capUntil.setUTCDate(capUntil.getUTCDate() - 1);
    capUntil.setUTCHours(23, 59, 59, 0);
    const oldPatch = { until: capUntil.toISOString() };
    // Default the new series's identity to the old one's; the patch
    // is what changes (typically rrule + dtstart + label edits).
    const newRow = toDb({
      kindId: old.kind_id,
      label: newSeriesPatch.label ?? old.label,
      subtitle: newSeriesPatch.subtitle ?? old.subtitle,
      location: newSeriesPatch.location ?? old.location,
      rrule: newSeriesPatch.rrule ?? old.rrule,
      dtstart: newSeriesPatch.dtstart ?? null,
      until: newSeriesPatch.until ?? null,
      durationMinutes: newSeriesPatch.durationMinutes ?? old.duration_minutes,
      seasonWindow: newSeriesPatch.seasonWindow ?? old.season_window,
      status: "active",
      payload: newSeriesPatch.payload ?? old.payload,
      notes: newSeriesPatch.notes ?? old.notes,
    });
    // Two writes against PostgREST — do them sequentially since the
    // second one needs the inserted id to reparent occurrences. We
    // skip a transaction wrapper because the worst-case (cap landed,
    // insert failed) is recoverable: just re-run from the editor.
    const { error: capErr } = await supabase
      .from("event_series").update(oldPatch).eq("id", id);
    if (capErr) throw capErr;
    const { data: created, error: insErr } = await supabase
      .from("event_series").insert(newRow).select().single();
    if (insErr) throw insErr;
    // Re-parent override rows on/after splitDate.
    const { error: reparentErr } = await supabase
      .from("event_occurrences")
      .update({ series_id: created.id })
      .eq("series_id", id)
      .gte("occurs_on", splitDate);
    if (reparentErr) console.warn("[splitSeries] reparent failed", reparentErr);
    setRows((prev) => prev
      ? prev
        .map(r => r.id === id ? { ...r, ...oldPatch } : r)
        .concat(created)
      : prev);
    return { oldId: id, newId: created.id };
  }, [rows]);

  return {
    series,
    seriesById,
    loading: rows === null,
    error,
    createSeries,
    updateSeries,
    deleteSeries,
    splitSeries,
  };
}

function toCamel(r) {
  return {
    id: r.id,
    legacyInstanceId: r.legacy_instance_id,
    kindId: r.kind_id,
    label: r.label,
    subtitle: r.subtitle,
    location: r.location,
    rrule: r.rrule,
    dtstart: r.dtstart,
    until: r.until,
    durationMinutes: r.duration_minutes,
    seasonWindow: r.season_window,
    status: r.status,
    payload: r.payload,
    notes: r.notes,
    automationEmissionId: r.automation_emission_id,
  };
}

function toDb(patch) {
  const out = {};
  if ("kindId" in patch) out.kind_id = patch.kindId;
  if ("label" in patch) out.label = patch.label;
  if ("subtitle" in patch) out.subtitle = patch.subtitle;
  if ("location" in patch) out.location = patch.location;
  if ("rrule" in patch) out.rrule = patch.rrule || null;
  if ("dtstart" in patch) out.dtstart = patch.dtstart || null;
  if ("until" in patch) out.until = patch.until || null;
  if ("durationMinutes" in patch) out.duration_minutes = patch.durationMinutes;
  if ("seasonWindow" in patch) out.season_window = patch.seasonWindow;
  if ("status" in patch) out.status = patch.status;
  if ("payload" in patch) out.payload = patch.payload;
  if ("notes" in patch) out.notes = patch.notes;
  return out;
}
