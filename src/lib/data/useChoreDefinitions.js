import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Loads chore_definitions and exposes update + delete actions for the
// in-place edit affordance on the All chores tab. Site assignment is
// either site_id (the parent kind — fans out to every active location
// underneath) or location_id (instance-scoped). Setting one clears
// the other.
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
        "assignment, tags, category, site_id, location_id, block_id, " +
        "last_chance_block_id, sort_order"
      )
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
            "assignment, tags, category, site_id, location_id, block_id, " +
            "last_chance_block_id, sort_order"
          )
          .order("sort_order", { ascending: true })
          .order("title", { ascending: true });
        if (!res.error) setDefs(res.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`chore_definitions:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_definitions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const shaped = useMemo(() => (defs ?? []).map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    frequency: c.frequency,
    period: c.period,
    startTime: c.start_time,
    deadline: c.deadline,
    assignment: c.assignment,
    tags: c.tags,
    category: c.category,
    siteId: c.site_id,
    locationId: c.location_id,
    blockId: c.block_id,
    lastChanceBlockId: c.last_chance_block_id,
    sortOrder: c.sort_order ?? 0,
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
  if ("siteId" in patch) out.site_id = patch.siteId || null;
  if ("locationId" in patch) out.location_id = patch.locationId || null;
  if ("blockId" in patch) out.block_id = patch.blockId || null;
  if ("lastChanceBlockId" in patch) {
    out.last_chance_block_id = patch.lastChanceBlockId || null;
  }
  if (typeof patch.sortOrder === "number") out.sort_order = patch.sortOrder;
  if (typeof patch.startTime === "string") out.start_time = patch.startTime;
  // Mutually-exclusive site_id vs location_id: clear the other side
  // when the caller sets one.
  if ("siteId" in patch && patch.siteId) out.location_id = null;
  if ("locationId" in patch && patch.locationId) out.site_id = null;
  return out;
}
