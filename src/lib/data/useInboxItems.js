import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Inbox / "just a thought…" capture (Batch 21).
//
//   useInboxItems() → {
//     items,          // non-archived, pinned first, each group in
//                     // sort_order (the drag order)
//     archived,       // archived items, most recently archived first
//     unreadCount,    // active items the current user hasn't read
//     isRead(id),     // has the CURRENT user read this item
//     loading, error,
//     create(body),
//     setPinned(id, pinned),
//     archive(id), unarchive(id),
//     markRead(id), markUnread(id),
//     reorder(group, idsInOrder),
//                     // group: 'pinned' | 'unpinned'; writes
//                     // sort_order = index for those ids
//     remove(id),     // hard delete (creator cleanup)
//   }
//
// Pinned and unpinned items have independent sort_order spaces — the
// page always renders pinned above unpinned, so the two never
// interleave.

const ITEM_COLS =
  "id, body, created_by, created_at, pinned, archived_at, sort_order";

export function useInboxItems() {
  const instanceId = useId();
  const userEmail = useCurrentUserEmail();
  const [rows, setRows] = useState(null);
  const [reads, setReads] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [itemsRes, readsRes] = await Promise.all([
      supabase.from("inbox_items").select(ITEM_COLS),
      supabase.from("inbox_item_reads").select("item_id, user_email"),
    ]);
    if (itemsRes.error) { setError(itemsRes.error); return; }
    if (readsRes.error) { setError(readsRes.error); return; }
    setRows(itemsRes.data ?? []);
    setReads(readsRes.data ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const channel = realtimeChannel(`inbox:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "inbox_items" }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "inbox_item_reads" },
        refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const readSet = useMemo(() => {
    const s = new Set();
    for (const r of reads ?? []) {
      if (r.user_email === userEmail) s.add(r.item_id);
    }
    return s;
  }, [reads, userEmail]);

  const shaped = useMemo(() => (rows ?? []).map(r => ({
    id: r.id,
    body: r.body,
    createdBy: r.created_by,
    createdAt: r.created_at,
    pinned: r.pinned,
    archivedAt: r.archived_at,
    sortOrder: r.sort_order ?? 0,
  })), [rows]);

  const bySort = (a, b) =>
    (a.sortOrder - b.sortOrder)
    || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");

  const items = useMemo(() => {
    const active = shaped.filter(i => !i.archivedAt);
    const pinned = active.filter(i => i.pinned).sort(bySort);
    const unpinned = active.filter(i => !i.pinned).sort(bySort);
    return [...pinned, ...unpinned];
  }, [shaped]);

  const archived = useMemo(
    () => shaped
      .filter(i => i.archivedAt)
      .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")),
    [shaped]
  );

  const isRead = useCallback((id) => readSet.has(id), [readSet]);

  const unreadCount = useMemo(
    () => items.filter(i => !readSet.has(i.id)).length,
    [items, readSet]
  );

  // ── mutations (optimistic where cheap; realtime reconciles) ────────
  const create = useCallback(async (body) => {
    const trimmed = (body ?? "").trim();
    if (!trimmed || !userEmail) return null;
    // New items land at the top of the unpinned group.
    const minSort = Math.min(
      0,
      ...shaped.filter(i => !i.pinned && !i.archivedAt)
        .map(i => i.sortOrder)
    );
    const { data, error: err } = await supabase.from("inbox_items")
      .insert({
        body: trimmed,
        created_by: userEmail,
        sort_order: minSort - 1,
      })
      .select(ITEM_COLS)
      .single();
    if (err) throw err;
    // The author has implicitly read their own thought.
    await supabase.from("inbox_item_reads")
      .upsert({ item_id: data.id, user_email: userEmail });
    await fetchAll();
    return data.id;
  }, [shaped, userEmail, fetchAll]);

  const update = useCallback(async (id, patch) => {
    const { error: err } = await supabase.from("inbox_items")
      .update(patch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const setPinned = useCallback(async (id, pinned) => {
    // Pin/unpin drops the item at the top of its destination group.
    const destGroup = shaped.filter(
      i => i.pinned === pinned && !i.archivedAt && i.id !== id
    );
    const minSort = Math.min(0, ...destGroup.map(i => i.sortOrder));
    await update(id, { pinned, sort_order: minSort - 1 });
  }, [shaped, update]);

  const archive = useCallback(
    (id) => update(id, { archived_at: new Date().toISOString() }),
    [update]
  );
  const unarchive = useCallback(
    (id) => update(id, { archived_at: null }),
    [update]
  );

  const markRead = useCallback(async (id) => {
    if (!userEmail) return;
    const { error: err } = await supabase.from("inbox_item_reads")
      .upsert({ item_id: id, user_email: userEmail });
    if (err) throw err;
    await fetchAll();
  }, [userEmail, fetchAll]);

  const markUnread = useCallback(async (id) => {
    if (!userEmail) return;
    const { error: err } = await supabase.from("inbox_item_reads")
      .delete()
      .eq("item_id", id)
      .eq("user_email", userEmail);
    if (err) throw err;
    await fetchAll();
  }, [userEmail, fetchAll]);

  const reorder = useCallback(async (idsInOrder) => {
    // Optimistic local apply so the drop doesn't flicker back.
    setRows((cur) => {
      if (!cur) return cur;
      const orderOf = new Map(idsInOrder.map((id, i) => [id, i]));
      return cur.map(r =>
        orderOf.has(r.id) ? { ...r, sort_order: orderOf.get(r.id) } : r
      );
    });
    for (let i = 0; i < idsInOrder.length; i += 1) {
      const { error: err } = await supabase.from("inbox_items")
        .update({ sort_order: i }).eq("id", idsInOrder[i]);
      if (err) { await fetchAll(); throw err; }
    }
  }, [fetchAll]);

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from("inbox_items")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    items,
    archived,
    unreadCount,
    isRead,
    loading: rows === null,
    error,
    create,
    setPinned,
    archive,
    unarchive,
    markRead,
    markUnread,
    reorder,
    remove,
  };
}
