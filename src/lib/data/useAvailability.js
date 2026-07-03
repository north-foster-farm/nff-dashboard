import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Loads the three availability tables (migration 0044) and exposes
// CRUD for the Availability UI (F50 time off, F51 working hours +
// breaks). The three row arrays are shaped exactly as the engine
// (lib/schedule/availability.js) consumes them, and `ctx` bundles
// them as its { hours, timeOff, breaks } argument.
//
// Returned shape:
//   {
//     timeOff:  [{ id, person, startDate, endDate, startMin, endMin,
//                  note }],                     // minutes null = all-day
//     hours:    [{ id, person, weekday, onDate, startMin, endMin }],
//                                               // minutes null = day off
//     breaks:   [{ id, name, startMin, endMin, isActive }],
//     ctx:      { hours, timeOff, breaks },     // engine-ready bundle
//     loading, error,
//     addTimeOff({ person, startDate, endDate, startMin, endMin,
//                  note }) -> row,
//     updateTimeOff(id, patch) -> row,   // F13 edit-in-place
//     deleteTimeOff(id),
//     setWorkingHours({ person, weekday | onDate, startMin, endMin,
//       startSun, endSun }) -> row, // upserts the (person, slot) row
//     clearWorkingHours(id),   // back to the 9-5 default
//     createBreak({ name, startMin, endMin, startSun, endSun }) -> row,
//     updateBreak(id, patch), deleteBreak(id),
//   }
//
// hours and breaks rows also carry startSun / endSun ('sunrise' |
// 'sunset' | null, F15) — a set anchor wins over that side's minutes.
//
// Mutations apply optimistically and revert on persistence failure,
// matching useChoreBlocks.

const TIME_OFF_COLS =
  "id, person, start_date, end_date, start_minutes, end_minutes, note";
const HOURS_COLS =
  "id, person, weekday, on_date, start_minutes, end_minutes, " +
  "start_sun, end_sun";
const BREAKS_COLS =
  "id, name, start_minutes, end_minutes, start_sun, end_sun, is_active";

function useTable(table, cols, order) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const res = await supabase.from(table).select(cols).order(order);
    return res;
  }, [table, cols, order]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchAll().then((res) => {
      if (cancelled) return;
      if (res.error) { setError(res.error); setRows([]); return; }
      setRows(res.data ?? []);
    });
    return () => { cancelled = true; };
  }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await fetchAll();
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`${table}:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, instanceId, fetchAll]);

  return { rows, setRows, error };
}

export function useAvailability() {
  const timeOffT = useTable("time_off", TIME_OFF_COLS, "start_date");
  const hoursT = useTable("working_hours", HOURS_COLS, "person");
  const breaksT = useTable("breaks", BREAKS_COLS, "start_minutes");

  const timeOff = useMemo(
    () => (timeOffT.rows ?? []).map((r) => ({
      id: r.id,
      person: r.person,
      startDate: r.start_date,
      endDate: r.end_date,
      startMin: r.start_minutes,
      endMin: r.end_minutes,
      note: r.note,
    })),
    [timeOffT.rows]
  );

  const hours = useMemo(
    () => (hoursT.rows ?? []).map((r) => ({
      id: r.id,
      person: r.person,
      weekday: r.weekday,
      onDate: r.on_date,
      startMin: r.start_minutes,
      endMin: r.end_minutes,
      startSun: r.start_sun,
      endSun: r.end_sun,
    })),
    [hoursT.rows]
  );

  const breaks = useMemo(
    () => (breaksT.rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      startMin: r.start_minutes,
      endMin: r.end_minutes,
      startSun: r.start_sun,
      endSun: r.end_sun,
      isActive: r.is_active,
    })),
    [breaksT.rows]
  );

  const ctx = useMemo(
    () => ({ hours, timeOff, breaks }),
    [hours, timeOff, breaks]
  );

  // ── time off ────────────────────────────────────────────────────
  const addTimeOff = useCallback(async (input) => {
    const { person, startDate, endDate, startMin, endMin, note } = input;
    if (!person) throw new Error("Time off needs a person.");
    if (!startDate) throw new Error("Time off needs a start date.");
    const { data: created, error: err } = await supabase
      .from("time_off")
      .insert({
        person,
        start_date: startDate,
        end_date: endDate || startDate,
        start_minutes: startMin ?? null,
        end_minutes: endMin ?? null,
        note: note?.trim() || null,
      })
      .select(TIME_OFF_COLS)
      .single();
    if (err) throw err;
    timeOffT.setRows((prev) => (prev ? [...prev, created] : prev));
    return created;
  }, [timeOffT.setRows]);

  // F13 — edit an existing entry in place. `patch` uses the hook's
  // camelCase field names; only the keys present are written.
  const updateTimeOff = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("person" in patch) dbPatch.person = patch.person;
    if ("startDate" in patch) dbPatch.start_date = patch.startDate;
    if ("endDate" in patch) dbPatch.end_date = patch.endDate;
    if ("startMin" in patch) dbPatch.start_minutes = patch.startMin;
    if ("endMin" in patch) dbPatch.end_minutes = patch.endMin;
    if ("note" in patch) dbPatch.note = patch.note?.trim() || null;
    const { data: saved, error: err } = await supabase
      .from("time_off").update(dbPatch).eq("id", id)
      .select(TIME_OFF_COLS).single();
    if (err) throw err;
    timeOffT.setRows((prev) =>
      prev ? prev.map((r) => (r.id === id ? saved : r)) : prev
    );
    return saved;
  }, [timeOffT.setRows]);

  const deleteTimeOff = useCallback(async (id) => {
    const prev = timeOffT.rows ? [...timeOffT.rows] : null;
    timeOffT.setRows((cur) =>
      cur ? cur.filter((r) => r.id !== id) : cur
    );
    const { error: err } = await supabase
      .from("time_off").delete().eq("id", id);
    if (err) { timeOffT.setRows(prev); throw err; }
  }, [timeOffT.rows, timeOffT.setRows]);

  // ── working hours ───────────────────────────────────────────────
  // Upsert the (person, weekday) or (person, date) slot: one row per
  // slot (the migration's partial unique indexes), replaced in place.
  const setWorkingHours = useCallback(async (input) => {
    const { person, weekday = null, onDate = null } = input;
    if (!person) throw new Error("Working hours need a person.");
    if ((weekday == null) === (onDate == null)) {
      throw new Error("Set exactly one of weekday / onDate.");
    }
    const row = {
      person,
      weekday,
      on_date: onDate,
      start_minutes: input.startMin ?? null,
      end_minutes: input.endMin ?? null,
      start_sun: input.startSun ?? null,
      end_sun: input.endSun ?? null,
    };
    const existing = (hoursT.rows ?? []).find((r) =>
      r.person === person &&
      (weekday != null ? r.weekday === weekday : r.on_date === onDate)
    );
    const q = existing
      ? supabase.from("working_hours").update(row).eq("id", existing.id)
      : supabase.from("working_hours").insert(row);
    const { data: saved, error: err } =
      await q.select(HOURS_COLS).single();
    if (err) throw err;
    hoursT.setRows((prev) => {
      if (!prev) return prev;
      const rest = prev.filter((r) => r.id !== saved.id);
      return [...rest, saved];
    });
    return saved;
  }, [hoursT.rows, hoursT.setRows]);

  const clearWorkingHours = useCallback(async (id) => {
    const prev = hoursT.rows ? [...hoursT.rows] : null;
    hoursT.setRows((cur) =>
      cur ? cur.filter((r) => r.id !== id) : cur
    );
    const { error: err } = await supabase
      .from("working_hours").delete().eq("id", id);
    if (err) { hoursT.setRows(prev); throw err; }
  }, [hoursT.rows, hoursT.setRows]);

  // ── breaks ──────────────────────────────────────────────────────
  const createBreak = useCallback(async (input) => {
    const { name, startMin, endMin, startSun, endSun } = input;
    if (!name?.trim()) throw new Error("A break needs a name.");
    const { data: created, error: err } = await supabase
      .from("breaks")
      .insert({
        name: name.trim(),
        start_minutes: startMin ?? null,
        end_minutes: endMin ?? null,
        start_sun: startSun ?? null,
        end_sun: endSun ?? null,
      })
      .select(BREAKS_COLS)
      .single();
    if (err) throw err;
    breaksT.setRows((prev) => (prev ? [...prev, created] : prev));
    return created;
  }, [breaksT.setRows]);

  const updateBreak = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
    if ("startMin" in patch) dbPatch.start_minutes = patch.startMin;
    if ("endMin" in patch) dbPatch.end_minutes = patch.endMin;
    if ("startSun" in patch) dbPatch.start_sun = patch.startSun;
    if ("endSun" in patch) dbPatch.end_sun = patch.endSun;
    if (typeof patch.isActive === "boolean") {
      dbPatch.is_active = patch.isActive;
    }
    const prev = breaksT.rows ? [...breaksT.rows] : null;
    breaksT.setRows((cur) =>
      cur ? cur.map((r) => (r.id === id ? { ...r, ...dbPatch } : r)) : cur
    );
    const { error: err } = await supabase
      .from("breaks").update(dbPatch).eq("id", id);
    if (err) { breaksT.setRows(prev); throw err; }
  }, [breaksT.rows, breaksT.setRows]);

  const deleteBreak = useCallback(async (id) => {
    const prev = breaksT.rows ? [...breaksT.rows] : null;
    breaksT.setRows((cur) =>
      cur ? cur.filter((r) => r.id !== id) : cur
    );
    const { error: err } = await supabase
      .from("breaks").delete().eq("id", id);
    if (err) { breaksT.setRows(prev); throw err; }
  }, [breaksT.rows, breaksT.setRows]);

  return {
    timeOff,
    hours,
    breaks,
    ctx,
    loading:
      timeOffT.rows === null ||
      hoursT.rows === null ||
      breaksT.rows === null,
    error: timeOffT.error ?? hoursT.error ?? breaksT.error ?? null,
    addTimeOff,
    updateTimeOff,
    deleteTimeOff,
    setWorkingHours,
    clearWorkingHours,
    createBreak,
    updateBreak,
    deleteBreak,
  };
}
