import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Loads chore_definitions and exposes update + delete actions for the
// in-place edit affordance on the All chores tab. A chore carries an
// *anchor* (migration 0014) — what it belongs to: a place, an occupied
// place subtree, every place of a kind, a species, or one specific
// batch. The fan-out into per-place obligations is computed client-side
// via lib/chores.js obligationPlaceIds().
//
// patch is a JS-shaped (camelCase) object; the hook converts to DB
// (snake_case) before writing.

export function useChoreDefinitions() {
  const instanceId = useId();
  const [defs, setDefs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("chore_definitions")
      .select(
        "id, title, description, frequency, period, start_time, deadline, " +
        "assignment, tags, category, place_id, block_id, " +
        "last_chance_block_id, sort_order, anchor_type, anchor_kind_tag, " +
        "anchor_species_id, anchor_batch_id, at_place_id, retired_at, " +
        "automation_emission_id, process_expansion_id"
      )
      .is("retired_at", null)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          setError(res.error);
          setDefs([]);
          return;
        }
        setDefs(res.data ?? []);
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
        const res = await supabase.from("chore_definitions")
          .select(
            "id, title, description, frequency, period, start_time, deadline, " +
            "assignment, tags, category, place_id, block_id, " +
            "last_chance_block_id, sort_order, anchor_type, anchor_kind_tag, " +
            "anchor_species_id, anchor_batch_id, at_place_id, retired_at, " +
            "automation_emission_id, process_expansion_id"
          )
          .is("retired_at", null)
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true });
        if (!res.error) setDefs(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`chore_definitions:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_definitions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const shaped = useMemo(() => (defs ?? []).map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    frequency: c.frequency,
    startTime: c.start_time,
    deadline: c.deadline,
    assignment: c.assignment,
    tags: c.tags,
    category: c.category,
    placeId: c.place_id,
    blockId: c.block_id,
    lastChanceBlockId: c.last_chance_block_id,
    sortOrder: c.sort_order ?? 0,
    anchorType: c.anchor_type ?? "none",
    anchorKindTag: c.anchor_kind_tag,
    anchorSpeciesId: c.anchor_species_id,
    anchorBatchId: c.anchor_batch_id,
    atPlaceId: c.at_place_id,
    retiredAt: c.retired_at,
    automationEmissionId: c.automation_emission_id,
    processExpansionId: c.process_expansion_id,
  })), [defs]);

  const updateDefinition = useCallback(async (id, patch) => {
    const dbPatch = camelToDb(patch);
    const prev = defs ? [...defs] : null;
    setDefs((cur) =>
      cur ? cur.map(c => c.id === id ? { ...c, ...dbPatch } : c) : cur
    );
    const { error: err } = await supabase
      .from("chore_definitions").update(dbPatch).eq("id", id);
    if (err) {
      setDefs(prev);
      throw err;
    }
  }, [defs]);

  const deleteDefinition = useCallback(async (id) => {
    const prev = defs ? [...defs] : null;
    setDefs((cur) => cur ? cur.filter(c => c.id !== id) : cur);
    const { error: err } = await supabase
      .from("chore_definitions").delete().eq("id", id);
    if (err) {
      setDefs(prev);
      throw err;
    }
  }, [defs]);

  return {
    definitions: shaped,
    loading: defs === null,
    error,
    updateDefinition,
    deleteDefinition,
  };
}

function camelToDb(patch) {
  const out = {};
  if (typeof patch.title === "string") out.title = patch.title.trim();
  if ("description" in patch) out.description = patch.description?.trim() || null;
  if ("placeId" in patch) out.place_id = patch.placeId || null;
  if ("blockId" in patch) out.block_id = patch.blockId || null;
  if ("anchorType" in patch) out.anchor_type = patch.anchorType || "none";
  if ("anchorKindTag" in patch) {
    out.anchor_kind_tag = patch.anchorKindTag || null;
  }
  if ("anchorSpeciesId" in patch) {
    out.anchor_species_id = patch.anchorSpeciesId || null;
  }
  if ("anchorBatchId" in patch) {
    out.anchor_batch_id = patch.anchorBatchId || null;
  }
  if ("atPlaceId" in patch) out.at_place_id = patch.atPlaceId || null;
  if ("lastChanceBlockId" in patch) {
    out.last_chance_block_id = patch.lastChanceBlockId || null;
  }
  if (typeof patch.sortOrder === "number") out.sort_order = patch.sortOrder;
  if ("startTime" in patch) out.start_time = patch.startTime || null;
  return out;
}
