import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Loads the full set of chore groups + their members in a single hook so
// the various surfaces (Groups tab, Today tab accordion grouping,
// future schedule rendering) can share the same denormalised view.
//
// Returned shape:
//   {
//     groups: [{ id, name, description, sortOrder, members: [{ choreId, sortOrder }] }],
//     groupByChoreId: Map<choreId, group>,
//     loading, error,
//     createGroup({name, description}) -> group,
//     updateGroup(id, patch) -> void,
//     deleteGroup(id) -> void,
//     setMembers(groupId, choreIds) -> void   (fully replaces membership)
//     addMember(groupId, choreId) -> void     (moves chore from any prior group)
//     removeMember(choreId) -> void
//     reorderGroups(idsInOrder) -> void
//   }
//
// Mutations write to the DB and rely on the realtime channel to push the
// updated state back; we also do a small optimistic local patch so the
// UI doesn't lag the round-trip.

export function useChoreGroups() {
  const instanceId = useId();
  const [groups, setGroups] = useState(null); // null = loading
  const [members, setMembers] = useState(null);
  const [error, setError] = useState(null);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([
      supabase.from("chore_groups")
        .select("id, name, description, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("chore_group_members")
        .select("group_id, chore_id, sort_order")
        .order("sort_order", { ascending: true }),
    ]).then(([groupsRes, membersRes]) => {
      if (cancelled) return;
      if (groupsRes.error) {
        setError(groupsRes.error);
        setGroups([]);
        setMembers([]);
        return;
      }
      if (membersRes.error) {
        setError(membersRes.error);
        setGroups(groupsRes.data ?? []);
        setMembers([]);
        return;
      }
      setGroups(groupsRes.data ?? []);
      setMembers(membersRes.data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  // Realtime: refetch on any change. Keeps the implementation small and
  // avoids the bookkeeping needed to surgically merge each row by hand.
  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const [g, m] = await Promise.all([
          supabase.from("chore_groups")
            .select("id, name, description, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),
          supabase.from("chore_group_members")
            .select("group_id, chore_id, sort_order")
            .order("sort_order", { ascending: true }),
        ]);
        if (!g.error) setGroups(g.data ?? []);
        if (!m.error) setMembers(m.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`chore_groups:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_group_members" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  // ── Derived: shaped tree, lookup maps ───────────────────────────────
  const shaped = useMemo(() => {
    const byGroup = new Map();
    for (const g of groups ?? []) {
      byGroup.set(g.id, {
        id: g.id,
        name: g.name,
        description: g.description,
        sortOrder: g.sort_order,
        members: [],
      });
    }
    for (const m of members ?? []) {
      const g = byGroup.get(m.group_id);
      if (g) g.members.push({ choreId: m.chore_id, sortOrder: m.sort_order });
    }
    const list = [...byGroup.values()].sort((a, b) =>
      (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name)
    );
    const groupByChoreId = new Map();
    for (const g of list) {
      for (const m of g.members) groupByChoreId.set(m.choreId, g);
    }
    return { list, groupByChoreId };
  }, [groups, members]);

  // ── Mutations ───────────────────────────────────────────────────────
  const createGroup = useCallback(async ({ name, description = null } = {}) => {
    if (!name?.trim()) throw new Error("Group needs a name.");
    const sort_order = (groups ?? []).reduce((m, g) => Math.max(m, g.sort_order), 0) + 1;
    const { data: created, error: err } = await supabase
      .from("chore_groups")
      .insert({ name: name.trim(), description: description?.trim() || null, sort_order })
      .select()
      .single();
    if (err) throw err;
    setGroups((prev) => prev ? [...prev, created] : prev);
    return created;
  }, [groups]);

  const updateGroup = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (typeof patch.name === "string") dbPatch.name = patch.name.trim();
    if ("description" in patch) dbPatch.description = patch.description?.trim() || null;
    if (typeof patch.sortOrder === "number") dbPatch.sort_order = patch.sortOrder;
    setGroups((prev) => prev ? prev.map(g => g.id === id ? { ...g, ...mapPatchToDB(dbPatch) } : g) : prev);
    const { error: err } = await supabase
      .from("chore_groups")
      .update(dbPatch)
      .eq("id", id);
    if (err) throw err;
  }, []);

  const deleteGroup = useCallback(async (id) => {
    setGroups((prev) => prev ? prev.filter(g => g.id !== id) : prev);
    setMembers((prev) => prev ? prev.filter(m => m.group_id !== id) : prev);
    const { error: err } = await supabase
      .from("chore_groups")
      .delete()
      .eq("id", id);
    if (err) throw err;
  }, []);

  // Adding a chore to a group implicitly removes it from any other group
  // (the unique constraint on chore_id enforces 1-membership). Use a
  // delete-then-insert to make the move atomic.
  const addMember = useCallback(async (groupId, choreId) => {
    setMembers((prev) => {
      if (!prev) return prev;
      const filtered = prev.filter(m => m.chore_id !== choreId);
      return [...filtered, { group_id: groupId, chore_id: choreId, sort_order: 0 }];
    });
    const { error: delErr } = await supabase
      .from("chore_group_members")
      .delete()
      .eq("chore_id", choreId);
    if (delErr) throw delErr;
    const sort_order = ((members ?? [])
      .filter(m => m.group_id === groupId)
      .reduce((mx, m) => Math.max(mx, m.sort_order), 0)) + 1;
    const { error: insErr } = await supabase
      .from("chore_group_members")
      .insert({ group_id: groupId, chore_id: choreId, sort_order });
    if (insErr) throw insErr;
  }, [members]);

  const removeMember = useCallback(async (choreId) => {
    setMembers((prev) => prev ? prev.filter(m => m.chore_id !== choreId) : prev);
    const { error: err } = await supabase
      .from("chore_group_members")
      .delete()
      .eq("chore_id", choreId);
    if (err) throw err;
  }, []);

  const setGroupMembers = useCallback(async (groupId, choreIds) => {
    // Replaces a group's full membership in one shot.
    setMembers((prev) => {
      if (!prev) return prev;
      const others = prev.filter(m => m.group_id !== groupId && !choreIds.includes(m.chore_id));
      const fresh = choreIds.map((cid, i) => ({
        group_id: groupId, chore_id: cid, sort_order: i + 1,
      }));
      return [...others, ...fresh];
    });
    // Atomic-ish: clear out the group + reassign any chores that may live elsewhere.
    const { error: clearErr } = await supabase
      .from("chore_group_members")
      .delete()
      .or(`group_id.eq.${groupId},chore_id.in.(${choreIds.map(safeQuoteForOr).join(",")})`);
    if (clearErr) throw clearErr;
    if (choreIds.length === 0) return;
    const rows = choreIds.map((cid, i) => ({
      group_id: groupId, chore_id: cid, sort_order: i + 1,
    }));
    const { error: insErr } = await supabase
      .from("chore_group_members")
      .insert(rows);
    if (insErr) throw insErr;
  }, []);

  const reorderGroups = useCallback(async (idsInOrder) => {
    // Optimistic local reorder.
    setGroups((prev) => {
      if (!prev) return prev;
      const byId = new Map(prev.map(g => [g.id, g]));
      return idsInOrder.map((id, i) => ({
        ...(byId.get(id) ?? { id }),
        sort_order: i + 1,
      })).filter(Boolean);
    });
    for (let i = 0; i < idsInOrder.length; i++) {
      const id = idsInOrder[i];
      // eslint-disable-next-line no-await-in-loop
      await supabase.from("chore_groups")
        .update({ sort_order: i + 1 })
        .eq("id", id);
    }
  }, []);

  return {
    groups: shaped.list,
    groupByChoreId: shaped.groupByChoreId,
    loading: groups === null || members === null,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    removeMember,
    setGroupMembers,
    reorderGroups,
  };
}

// Maps an internal DB-shape patch to the JS-shape used in derived state.
// Used by updateGroup's optimistic apply step so React state reflects the
// camelCase shape consumers expect, even before the realtime echo.
function mapPatchToDB(dbPatch) {
  const out = {};
  if ("name" in dbPatch) out.name = dbPatch.name;
  if ("description" in dbPatch) out.description = dbPatch.description;
  if ("sort_order" in dbPatch) out.sort_order = dbPatch.sort_order;
  return out;
}

function safeQuoteForOr(s) {
  // Rough escape for the postgrest .or() filter — chore IDs in this
  // codebase are lowercase ASCII slugs, so this is overkill, but it keeps
  // the call safe if a future ID picks up unusual characters.
  return `"${String(s).replace(/"/g, '""')}"`;
}
