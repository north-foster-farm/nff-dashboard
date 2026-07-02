import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { lockState } from "../docdata/liveDoc.js";

// The Supabase half of live HTML doc attachments (batch 42.8,
// migration 0045): one attachment's key/value store
// (attachment_doc_data) + its advisory write lock
// (attachment_doc_locks), both realtime. The pure semantics (shim,
// injection, lock states) live in lib/docdata/liveDoc.js.
//
//   const doc = useDocData(attachmentId, me);
//   doc.data          — { key: value } (strings; the shim's seed)
//   doc.loading
//   doc.lock          — shaped lock row or null
//   doc.state         — "unlocked" | "mine" | "theirs" | "stale"
//   doc.writeKey(key, value)  — upsert (null value deletes)
//   doc.claim() / doc.release() / doc.heartbeat()
//
// Writes apply optimistically; realtime refreshes fold in the other
// editor's saves (the viewer diffs `data` into the iframe).

const DATA_COLS = "id, attachment_id, key, value, updated_at, updated_by";
const LOCK_COLS = "attachment_id, locked_by, acquired_at, heartbeat_at";

export function useDocData(attachmentId, me) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [lockRow, setLockRow] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!attachmentId) return;
    const [dataRes, lockRes] = await Promise.all([
      supabase.from("attachment_doc_data").select(DATA_COLS)
        .eq("attachment_id", attachmentId),
      supabase.from("attachment_doc_locks").select(LOCK_COLS)
        .eq("attachment_id", attachmentId).maybeSingle(),
    ]);
    if (!dataRes.error) setRows(dataRes.data ?? []);
    if (!lockRes.error) setLockRow(lockRes.data ?? null);
    setLoading(false);
  }, [attachmentId]);

  useEffect(() => {
    setRows(null);
    setLockRow(null);
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // One channel, both tables, filtered to this attachment; the 80ms
  // debounce matches the useAvailability/useChoreBlocks pattern.
  useEffect(() => {
    if (!attachmentId) return undefined;
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const filter = `attachment_id=eq.${attachmentId}`;
    const channel = realtimeChannel(`doc:${attachmentId}:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public",
          table: "attachment_doc_data", filter }, refresh)
      .on("postgres_changes",
        { event: "*", schema: "public",
          table: "attachment_doc_locks", filter }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [attachmentId, instanceId, fetchAll]);

  const data = useMemo(() => {
    const map = {};
    for (const r of rows ?? []) map[r.key] = r.value;
    return map;
  }, [rows]);

  const lock = useMemo(
    () => (lockRow ? {
      lockedBy: lockRow.locked_by,
      acquiredAt: lockRow.acquired_at,
      heartbeatAt: lockRow.heartbeat_at,
    } : null),
    [lockRow]
  );

  const state = lockState(lock, { me });

  const writeKey = useCallback(async (key, value) => {
    // Optimistic local fold so the viewer's diff-to-iframe no-ops on
    // our own writes.
    setRows((prev) => {
      if (!prev) return prev;
      const rest = prev.filter((r) => r.key !== key);
      return value == null
        ? rest
        : [...rest, { attachment_id: attachmentId, key, value }];
    });
    if (value == null) {
      await supabase.from("attachment_doc_data").delete()
        .eq("attachment_id", attachmentId).eq("key", key);
      return;
    }
    await supabase.from("attachment_doc_data").upsert({
      attachment_id: attachmentId,
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: me,
    }, { onConflict: "attachment_id,key" });
  }, [attachmentId, me]);

  // Claim is guarded by `state` in the caller (Edit is only offered
  // when unlocked/stale/mine); the upsert takes the row either way —
  // fine for a two-editor farm.
  const claim = useCallback(async () => {
    const now = new Date().toISOString();
    const { data: saved } = await supabase
      .from("attachment_doc_locks")
      .upsert({
        attachment_id: attachmentId,
        locked_by: me,
        acquired_at: now,
        heartbeat_at: now,
      }, { onConflict: "attachment_id" })
      .select(LOCK_COLS).single();
    if (saved) setLockRow(saved);
  }, [attachmentId, me]);

  const heartbeat = useCallback(async () => {
    await supabase.from("attachment_doc_locks")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("attachment_id", attachmentId).eq("locked_by", me);
  }, [attachmentId, me]);

  const release = useCallback(async () => {
    setLockRow((cur) => (cur?.locked_by === me ? null : cur));
    await supabase.from("attachment_doc_locks").delete()
      .eq("attachment_id", attachmentId).eq("locked_by", me);
  }, [attachmentId, me]);

  return {
    data, loading, lock, state,
    writeKey, claim, heartbeat, release,
  };
}
