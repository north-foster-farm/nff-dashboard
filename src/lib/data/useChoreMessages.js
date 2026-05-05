import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "./../supabase.js";

// Sticky-note style messages pinned to chores. The UI scopes use of this
// hook two ways:
//   * `useChoreMessages({ choreId })` for the per-chore composer popover
//   * `useChoreMessages({ unaddressedOnly: true })` for the global inbox
//
// Returns:
//   { messages, loading, error, post, address, unaddress, remove }
//
// Mutations are optimistic where it makes sense; the realtime channel
// reconciles state across tabs.

export function useChoreMessages({ choreId, unaddressedOnly = false } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(null);

  // Initial fetch.
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);

    let q = supabase
      .from("chore_messages")
      .select("id, chore_id, body, author_email, created_at, addressed_at, addressed_by_email")
      .order("created_at", { ascending: false });
    if (choreId) q = q.eq("chore_id", choreId);
    if (unaddressedOnly) q = q.is("addressed_at", null);

    q.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err);
        setRows([]);
        return;
      }
      setRows(data ?? []);
    });
    return () => { cancelled = true; };
  }, [choreId, unaddressedOnly]);

  // Realtime: keep the local view in sync with cross-device writes.
  useEffect(() => {
    const filterParts = [];
    if (choreId) filterParts.push(`chore_id=eq.${choreId}`);
    const filter = filterParts.join(",") || undefined;

    const channel = supabase
      .channel(`chore_messages:${choreId ?? "all"}:${unaddressedOnly}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chore_messages", ...(filter ? { filter } : {}) },
        (payload) => {
          if (unaddressedOnly && payload.new.addressed_at != null) return;
          setRows((prev) => prev ? [payload.new, ...prev] : prev);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chore_messages", ...(filter ? { filter } : {}) },
        (payload) => {
          setRows((prev) => {
            if (!prev) return prev;
            // Drop from the unaddressed view as soon as it's addressed.
            if (unaddressedOnly && payload.new.addressed_at != null) {
              return prev.filter(r => r.id !== payload.new.id);
            }
            return prev.map(r => r.id === payload.new.id ? payload.new : r);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chore_messages", ...(filter ? { filter } : {}) },
        (payload) => {
          setRows((prev) => prev ? prev.filter(r => r.id !== payload.old.id) : prev);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [choreId, unaddressedOnly, instanceId]);

  // Resolve current user once per call so optimistic local rows are
  // attributed correctly.
  const [authorEmail, setAuthorEmail] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) =>
      setAuthorEmail(data?.session?.user?.email ?? null)
    );
  }, []);

  const post = useCallback(async (forChoreId, body) => {
    const trimmed = (body ?? "").trim();
    if (!trimmed) throw new Error("Message body is required.");
    const targetChore = forChoreId || choreId;
    if (!targetChore) throw new Error("chore_id is required.");
    const { data, error: err } = await supabase
      .from("chore_messages")
      .insert({
        chore_id: targetChore,
        body: trimmed,
        author_email: authorEmail,
      })
      .select()
      .single();
    if (err) throw err;
    // Realtime will prepend, but if subscription is slow do it locally too.
    setRows((prev) => {
      if (!prev) return prev;
      if (prev.some(r => r.id === data.id)) return prev;
      return [data, ...prev];
    });
    return data;
  }, [choreId, authorEmail]);

  const address = useCallback(async (id) => {
    setRows((prev) => prev ? prev.map(r => r.id === id
      ? { ...r, addressed_at: new Date().toISOString(), addressed_by_email: authorEmail }
      : r) : prev);
    const { error: err } = await supabase
      .from("chore_messages")
      .update({
        addressed_at: new Date().toISOString(),
        addressed_by_email: authorEmail,
      })
      .eq("id", id);
    if (err) throw err;
  }, [authorEmail]);

  const unaddress = useCallback(async (id) => {
    setRows((prev) => prev ? prev.map(r => r.id === id
      ? { ...r, addressed_at: null, addressed_by_email: null }
      : r) : prev);
    const { error: err } = await supabase
      .from("chore_messages")
      .update({ addressed_at: null, addressed_by_email: null })
      .eq("id", id);
    if (err) throw err;
  }, []);

  const remove = useCallback(async (id) => {
    let removed = null;
    setRows((prev) => {
      if (!prev) return prev;
      removed = prev.find(r => r.id === id) ?? null;
      return prev.filter(r => r.id !== id);
    });
    const { error: err } = await supabase
      .from("chore_messages")
      .delete()
      .eq("id", id);
    if (err) {
      if (removed) setRows((prev) => (prev ? [removed, ...prev] : prev));
      throw err;
    }
  }, []);

  const messages = useMemo(() => rows ?? [], [rows]);

  return {
    messages,
    loading: rows === null,
    error,
    post,
    address,
    unaddress,
    remove,
  };
}
