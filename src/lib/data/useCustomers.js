import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Customers + Lists data hook (Batch 24).
//
//   useCustomers() → {
//     customers,        // active, sorted by name (no-name → by email)
//     archived,
//     lists,            // [{ ...list, memberIds: Set, memberCount }]
//     loading, error,
//     createCustomer({ name, email, phone, notes }),
//     updateCustomer(id, patch),
//     archiveCustomer(id), unarchiveCustomer(id), removeCustomer(id),
//     createList({ title, purpose }),
//     updateList(id, patch), removeList(id),
//     addToList(listId, customerId), removeFromList(listId, customerId),
//   }

const CUSTOMER_COLS =
  "id, name, email, phone, notes, address, archived_at, created_at, " +
  "updated_at";
const LIST_COLS = "id, title, purpose, created_at, updated_at";
const MEMBER_COLS = "list_id, customer_id, added_at";

const TABLES = ["customers", "customer_lists", "customer_list_members"];

function shapeCustomer(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    notes: r.notes,
    // Default ship-to (Batch 29.3) — same shape as orders.ship_to.
    address: r.address,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // What the directory sorts / displays by.
    displayName: r.name ?? r.email ?? "(no name)",
  };
}

export function useCustomers() {
  const instanceId = useId();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [custRes, listRes, memberRes] = await Promise.all([
      supabase.from("customers").select(CUSTOMER_COLS),
      supabase.from("customer_lists").select(LIST_COLS),
      supabase.from("customer_list_members").select(MEMBER_COLS),
    ]);
    const failed = [custRes, listRes, memberRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      customers: (custRes.data ?? []).map(shapeCustomer),
      lists: listRes.data ?? [],
      members: memberRes.data ?? [],
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
    let channel = realtimeChannel(`customers:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const byName = (a, b) =>
    a.displayName.localeCompare(b.displayName, undefined,
      { sensitivity: "base" });

  const customers = useMemo(
    () => (tables?.customers ?? [])
      .filter(c => !c.archivedAt).sort(byName),
    [tables]
  );
  const archived = useMemo(
    () => (tables?.customers ?? [])
      .filter(c => c.archivedAt).sort(byName),
    [tables]
  );

  const lists = useMemo(() => {
    return (tables?.lists ?? []).map(l => {
      const memberIds = new Set(
        (tables?.members ?? [])
          .filter(m => m.list_id === l.id)
          .map(m => m.customer_id)
      );
      return {
        id: l.id,
        title: l.title,
        purpose: l.purpose,
        createdAt: l.created_at,
        memberIds,
        memberCount: memberIds.size,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [tables]);

  // ── customer mutations ─────────────────────────────────────────────
  const createCustomer = useCallback(async ({ name, email, phone, notes }) => {
    const row = {
      name: (name ?? "").trim() || null,
      email: (email ?? "").trim() || null,
      phone: (phone ?? "").trim() || null,
      notes: (notes ?? "").trim() || null,
    };
    if (!row.name && !row.email) {
      throw new Error("A customer needs at least a name or an email.");
    }
    const { data, error: err } = await supabase.from("customers")
      .insert(row).select(CUSTOMER_COLS).single();
    if (err) throw err;
    await fetchAll();
    return data.id;
  }, [fetchAll]);

  const updateCustomer = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name?.trim() || null;
    if ("email" in patch) dbPatch.email = patch.email?.trim() || null;
    if ("phone" in patch) dbPatch.phone = patch.phone?.trim() || null;
    if ("notes" in patch) dbPatch.notes = patch.notes?.trim() || null;
    if ("address" in patch) dbPatch.address = patch.address;
    if ("archivedAt" in patch) dbPatch.archived_at = patch.archivedAt;
    const { error: err } = await supabase.from("customers")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const archiveCustomer = useCallback(
    (id) => updateCustomer(id, { archivedAt: new Date().toISOString() }),
    [updateCustomer]
  );
  const unarchiveCustomer = useCallback(
    (id) => updateCustomer(id, { archivedAt: null }),
    [updateCustomer]
  );

  const removeCustomer = useCallback(async (id) => {
    const { error: err } = await supabase.from("customers")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── list mutations ─────────────────────────────────────────────────
  const createList = useCallback(async ({ title, purpose }) => {
    const trimmed = (title ?? "").trim();
    if (!trimmed) throw new Error("Title required.");
    const { data, error: err } = await supabase.from("customer_lists")
      .insert({ title: trimmed, purpose: (purpose ?? "").trim() || null })
      .select(LIST_COLS).single();
    if (err) throw err;
    await fetchAll();
    return data.id;
  }, [fetchAll]);

  const updateList = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("title" in patch) dbPatch.title = patch.title;
    if ("purpose" in patch) dbPatch.purpose = patch.purpose;
    const { error: err } = await supabase.from("customer_lists")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeList = useCallback(async (id) => {
    const { error: err } = await supabase.from("customer_lists")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const addToList = useCallback(async (listId, customerId) => {
    const { error: err } = await supabase.from("customer_list_members")
      .upsert(
        { list_id: listId, customer_id: customerId },
        { onConflict: "list_id,customer_id", ignoreDuplicates: true }
      );
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeFromList = useCallback(async (listId, customerId) => {
    const { error: err } = await supabase.from("customer_list_members")
      .delete().eq("list_id", listId).eq("customer_id", customerId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    customers,
    archived,
    lists,
    loading: tables === null,
    error,
    createCustomer,
    updateCustomer,
    archiveCustomer,
    unarchiveCustomer,
    removeCustomer,
    createList,
    updateList,
    removeList,
    addToList,
    removeFromList,
  };
}
