import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Weight samples data hook (Batch 26.1).
//
//   useWeightSamples(groupId) → {
//     samples,          // camelCase rows, newest-first
//     loading, error,
//     recordSample({ sampledOn, weights, unit, notes }),
//     updateSample(id, patch),
//     removeSample(id),
//   }
//
// One row per weigh-in session; `weights` is an array of individual
// bird weights (the uniformity metric needs the spread, not just the
// average). Pass groupId = null to load every group's samples (the
// Metrics page comparison view does this).

const COLS =
  "id, group_id, sampled_on, weights, unit, notes, recorded_by_email, " +
  "created_at";

function shapeSample(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    sampledOn: r.sampled_on,
    weights: Array.isArray(r.weights) ? r.weights : [],
    unit: r.unit,
    notes: r.notes,
    recordedByEmail: r.recorded_by_email,
    createdAt: r.created_at,
  };
}

export function useWeightSamples(groupId = null) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    let q = supabase.from("weight_samples").select(COLS)
      .order("sampled_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (groupId) q = q.eq("group_id", groupId);
    const { data, error: err } = await q;
    if (err) { setError(err); return; }
    setRows((data ?? []).map(shapeSample));
  }, [groupId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const channel = realtimeChannel(`weight_samples:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "weight_samples" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const samples = useMemo(() => rows ?? [], [rows]);

  const recordSample = useCallback(async ({
    sampledOn, weights, unit = "lb", notes = null, groupId: gid,
  }) => {
    const cleaned = (weights ?? []).map(Number).filter(Number.isFinite);
    if (cleaned.length === 0) {
      throw new Error("At least one weight is required.");
    }
    const { data: { session } } = await supabase.auth.getSession();
    const row = {
      group_id: gid ?? groupId,
      sampled_on: sampledOn || new Date().toISOString().slice(0, 10),
      weights: cleaned,
      unit,
      notes: (notes ?? "").trim() || null,
      recorded_by_email: session?.user?.email ?? null,
    };
    const { data, error: err } = await supabase.from("weight_samples")
      .insert(row).select(COLS).single();
    if (err) throw err;
    await fetchAll();
    return data.id;
  }, [fetchAll, groupId]);

  const updateSample = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("sampledOn" in patch) dbPatch.sampled_on = patch.sampledOn;
    if ("weights" in patch) {
      dbPatch.weights = (patch.weights ?? [])
        .map(Number).filter(Number.isFinite);
    }
    if ("unit" in patch) dbPatch.unit = patch.unit;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    const { error: err } = await supabase.from("weight_samples")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeSample = useCallback(async (id) => {
    const { error: err } = await supabase.from("weight_samples")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    samples,
    loading: rows === null,
    error,
    recordSample,
    updateSample,
    removeSample,
  };
}
