import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Egg collections data hook (Batch 26.1).
//
//   useEggCollections(groupId) → {
//     collections,      // camelCase rows, newest-first
//     loading, error,
//     recordCollection({ collectedOn, count, avgEggWeightOz, notes }),
//     updateCollection(id, patch),
//     removeCollection(id),
//   }
//
// One row per capture — a flock can log several per day (AM + PM
// collection chores). This is the desktop write path; the Rounds quick
// action writes the same table through the offline outbox
// (lib/data/outbox.js → egg_collection_insert). Pass groupId = null to load
// every flock's collections.

const COLS =
  "id, group_id, collected_on, count, avg_egg_weight_oz, notes, " +
  "recorded_by_email, created_at";

function shapeCollection(r) {
  return {
    id: r.id,
    groupId: r.group_id,
    collectedOn: r.collected_on,
    count: r.count,
    avgEggWeightOz:
      r.avg_egg_weight_oz == null ? null : Number(r.avg_egg_weight_oz),
    notes: r.notes,
    recordedByEmail: r.recorded_by_email,
    createdAt: r.created_at,
  };
}

export function useEggCollections(groupId = null) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    let q = supabase.from("egg_collections").select(COLS)
      .order("collected_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (groupId) q = q.eq("group_id", groupId);
    const { data, error: err } = await q;
    if (err) { setError(err); return; }
    setRows((data ?? []).map(shapeCollection));
  }, [groupId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const channel = realtimeChannel(`egg_collections:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "egg_collections" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const collections = useMemo(() => rows ?? [], [rows]);

  const recordCollection = useCallback(async ({
    collectedOn, count, avgEggWeightOz = null, notes = null, groupId: gid,
  }) => {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error("Egg count must be zero or more.");
    }
    const { data: { session } } = await supabase.auth.getSession();
    const row = {
      group_id: gid ?? groupId,
      collected_on: collectedOn || new Date().toISOString().slice(0, 10),
      count: n,
      avg_egg_weight_oz: avgEggWeightOz === "" || avgEggWeightOz == null
        ? null : Number(avgEggWeightOz),
      notes: (notes ?? "").trim() || null,
      recorded_by_email: session?.user?.email ?? null,
    };
    const { data, error: err } = await supabase.from("egg_collections")
      .insert(row).select(COLS).single();
    if (err) throw err;
    await fetchAll();
    return data.id;
  }, [fetchAll, groupId]);

  const updateCollection = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("collectedOn" in patch) dbPatch.collected_on = patch.collectedOn;
    if ("count" in patch) dbPatch.count = Number(patch.count);
    if ("avgEggWeightOz" in patch) {
      dbPatch.avg_egg_weight_oz =
        patch.avgEggWeightOz === "" || patch.avgEggWeightOz == null
          ? null : Number(patch.avgEggWeightOz);
    }
    if ("notes" in patch) dbPatch.notes = patch.notes;
    const { error: err } = await supabase.from("egg_collections")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeCollection = useCallback(async (id) => {
    const { error: err } = await supabase.from("egg_collections")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    collections,
    loading: rows === null,
    error,
    recordCollection,
    updateCollection,
    removeCollection,
  };
}
