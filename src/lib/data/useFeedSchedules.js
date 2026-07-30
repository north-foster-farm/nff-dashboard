import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Feed schedules data hook (Batch 25.2) — the editing surface for the
// per-species feed programs the reorder projections run on.
//
//   useFeedSchedules() → {
//     schedules,        // [{ ...schedule, stages: [...] }] camelCase,
//                       // stages sorted by startDay
//     loading, error,
//     createSchedule({ name, speciesId, description,
//                      cycleAnchorLabel, assignedGroupIds }),
//     updateSchedule(id, patch),
//     removeSchedule(id),                 // cascades to stages
//     createStage(scheduleId, fields),
//     updateStage(id, patch),
//     removeStage(id),
//   }
//
// Stage `consumption` keeps the established jsonb shapes:
//   { type: "free_choice" }
//   { type: "tbd" }
//   { type: "metered", amount, unit, per: "day", basis: "batch"|"bird" }
//
// Stage ordinals are derived from start_day on every write — the
// natural order of a feed program IS chronological, so there's no
// manual reordering surface.

const SCHEDULE_COLS =
  "id, name, species_id, description, cycle_anchor_label, " +
  "assigned_group_ids";
const STAGE_COLS =
  "id, schedule_id, name, start_day, end_day, feed_type_id, " +
  "consumption, notes, ordinal";

const TABLES = ["feed_schedules", "feed_schedule_stages"];

// Text-PK id generator matching the existing seed style
// ("broiler_standard", "stage_starter"): slug of the name plus a short
// random suffix for uniqueness.
function makeId(prefix, name) {
  const slug = (name ?? "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .slice(0, 40) || "untitled";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${slug}_${suffix}`;
}

function shapeStage(r) {
  return {
    id: r.id,
    scheduleId: r.schedule_id,
    name: r.name,
    startDay: r.start_day,
    endDay: r.end_day,
    feedTypeId: r.feed_type_id,
    consumption: r.consumption,
    notes: r.notes,
    ordinal: r.ordinal,
  };
}

export function useFeedSchedules() {
  const instanceId = useId();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [schedRes, stageRes] = await Promise.all([
      supabase.from("feed_schedules").select(SCHEDULE_COLS).order("id"),
      supabase.from("feed_schedule_stages").select(STAGE_COLS)
        .order("start_day", { nullsFirst: true }).order("ordinal"),
    ]);
    const failed = [schedRes, stageRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      schedules: schedRes.data ?? [],
      stages: (stageRes.data ?? []).map(shapeStage),
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    let channel = realtimeChannel(`feed_schedules:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const schedules = useMemo(() => {
    if (!tables) return [];
    const stagesBySchedule = new Map();
    for (const st of tables.stages) {
      const arr = stagesBySchedule.get(st.scheduleId) ?? [];
      arr.push(st);
      stagesBySchedule.set(st.scheduleId, arr);
    }
    return tables.schedules.map(s => ({
      id: s.id,
      name: s.name,
      speciesId: s.species_id,
      description: s.description,
      cycleAnchorLabel: s.cycle_anchor_label,
      assignedGroupIds: s.assigned_group_ids ?? [],
      stages: stagesBySchedule.get(s.id) ?? [],
    }));
  }, [tables]);

  // After any stage write, re-derive ordinals for the schedule so they
  // track chronological (start_day) order.
  const syncOrdinals = useCallback(async (scheduleId) => {
    const { data, error: err } = await supabase
      .from("feed_schedule_stages")
      .select("id, start_day")
      .eq("schedule_id", scheduleId)
      .order("start_day", { nullsFirst: true });
    if (err || !data) return;
    for (let i = 0; i < data.length; i++) {
      if (data[i].ordinal === i + 1) continue;
      await supabase.from("feed_schedule_stages")
        .update({ ordinal: i + 1 }).eq("id", data[i].id);
    }
  }, []);

  // ── schedule mutations ─────────────────────────────────────────────
  const createSchedule = useCallback(async ({
    name, speciesId, description = null, cycleAnchorLabel = null,
    assignedGroupIds = [],
  }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("Schedule name required.");
    const row = {
      id: makeId("sched", trimmed),
      name: trimmed,
      species_id: speciesId ?? null,
      description: (description ?? "").trim() || null,
      cycle_anchor_label: cycleAnchorLabel ?? "Days from arrival",
      assigned_group_ids: assignedGroupIds,
    };
    const { data, error: err } = await supabase.from("feed_schedules")
      .insert(row).select(SCHEDULE_COLS).single();
    if (err) throw err;
    await fetchAll();
    return data.id;
  }, [fetchAll]);

  const updateSchedule = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("description" in patch) dbPatch.description = patch.description;
    if ("speciesId" in patch) dbPatch.species_id = patch.speciesId;
    if ("cycleAnchorLabel" in patch) {
      dbPatch.cycle_anchor_label = patch.cycleAnchorLabel;
    }
    if ("assignedGroupIds" in patch) {
      dbPatch.assigned_group_ids = patch.assignedGroupIds;
    }
    const { error: err } = await supabase.from("feed_schedules")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeSchedule = useCallback(async (id) => {
    // Stages cascade via the FK.
    const { error: err } = await supabase.from("feed_schedules")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── stage mutations ────────────────────────────────────────────────
  const createStage = useCallback(async (scheduleId, {
    name, startDay, endDay = null, feedTypeId = null,
    consumption = { type: "tbd" }, notes = null,
  }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("Stage name required.");
    const row = {
      id: makeId("stage", trimmed),
      schedule_id: scheduleId,
      name: trimmed,
      start_day: startDay ?? 0,
      end_day: endDay,
      feed_type_id: feedTypeId,
      consumption,
      notes: (notes ?? "").trim() || null,
      ordinal: 999, // re-derived by syncOrdinals below
    };
    const { data, error: err } = await supabase
      .from("feed_schedule_stages")
      .insert(row).select(STAGE_COLS).single();
    if (err) throw err;
    await syncOrdinals(scheduleId);
    await fetchAll();
    return data.id;
  }, [fetchAll, syncOrdinals]);

  const updateStage = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("startDay" in patch) dbPatch.start_day = patch.startDay;
    if ("endDay" in patch) dbPatch.end_day = patch.endDay;
    if ("feedTypeId" in patch) dbPatch.feed_type_id = patch.feedTypeId;
    if ("consumption" in patch) dbPatch.consumption = patch.consumption;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    const { data, error: err } = await supabase
      .from("feed_schedule_stages")
      .update(dbPatch).eq("id", id)
      .select("schedule_id").single();
    if (err) throw err;
    if ("startDay" in patch) await syncOrdinals(data.schedule_id);
    await fetchAll();
  }, [fetchAll, syncOrdinals]);

  const removeStage = useCallback(async (id) => {
    const { error: err } = await supabase.from("feed_schedule_stages")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    schedules,
    loading: tables === null,
    error,
    createSchedule,
    updateSchedule,
    removeSchedule,
    createStage,
    updateStage,
    removeStage,
  };
}
