import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { toLocalDateString } from "./dateUtil.js";

// Loads which chores are completed for `date`, exposes a `toggle(choreId)`
// function with optimistic UI, and listens to realtime changes so two
// admins on two devices stay in sync without manual refresh.
//
// Returns:
//   - completedSet : Set<string> | null  (null = still loading)
//   - completions  : Map<choreId, row>    (full rows, for who/when metadata)
//   - toggle       : async (choreId, currentlyDone) => Error | null
//   - error        : Error | null
//
// The hook is meant to be mounted ONCE per page (e.g. in TodayTab) and the
// completed/toggle pair passed down to per-row components — that way we
// open exactly one realtime subscription instead of one per chore row.
export function useChoreCompletions(date) {
  const dateStr = useMemo(() => toLocalDateString(date), [date]);
  // We keep the full rows (not just the IDs) so consumers can display
  // "completed at 7:42 AM by Jim" in the future. The Set is derived for
  // O(1) "is X done?" checks in render hot paths.
  const [rowsByChoreId, setRowsByChoreId] = useState(null); // null = loading
  const [error, setError] = useState(null);

  // ── Initial load + reload-on-date-change ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setRowsByChoreId(null);
    setError(null);
    supabase
      .from("chore_completions")
      .select("id, chore_id, completion_date, completed_by_email, completed_at, notes")
      .eq("completion_date", dateStr)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error);
          setRowsByChoreId(new Map());
          return;
        }
        const m = new Map();
        for (const row of data) m.set(row.chore_id, row);
        setRowsByChoreId(m);
      });
    return () => { cancelled = true; };
  }, [dateStr]);

  // ── Realtime subscription, scoped to today's rows ────────────────────────
  // Filter pushes the date predicate down to the server so we don't get
  // pinged about every chore in history.
  useEffect(() => {
    const channel = supabase
      .channel(`chore_completions:${dateStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chore_completions",
          filter: `completion_date=eq.${dateStr}`
        },
        (payload) => {
          setRowsByChoreId((prev) => {
            if (!prev) return prev;
            const next = new Map(prev);
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              next.set(payload.new.chore_id, payload.new);
            } else if (payload.eventType === "DELETE") {
              next.delete(payload.old.chore_id);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateStr]);

  // ── Optimistic toggle ────────────────────────────────────────────────────
  // We mutate local state immediately, then fire the DB call. If the call
  // fails we revert. The realtime subscription will also fire for the
  // (eventually committed) row but Map.set with the same key is idempotent.
  const toggle = useCallback(async (choreId, currentlyDone) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;
    if (!email) {
      // Should be impossible — LoginGate guarantees a session before this
      // hook ever mounts — but guard anyway so we fail loud.
      const e = new Error("No active session");
      setError(e);
      return e;
    }

    if (currentlyDone) {
      // Snapshot for revert
      const prevRow = rowsByChoreId?.get(choreId);
      setRowsByChoreId((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        next.delete(choreId);
        return next;
      });
      const { error } = await supabase
        .from("chore_completions")
        .delete()
        .eq("chore_id", choreId)
        .eq("completion_date", dateStr);
      if (error) {
        setRowsByChoreId((prev) => {
          if (!prev || !prevRow) return prev;
          const next = new Map(prev);
          next.set(choreId, prevRow);
          return next;
        });
        return error;
      }
    } else {
      // Optimistic insert with a synthetic row. The realtime push will
      // overwrite this with the canonical server row a moment later.
      const optimisticRow = {
        id: `optimistic-${choreId}-${Date.now()}`,
        chore_id: choreId,
        completion_date: dateStr,
        completed_by_email: email,
        completed_at: new Date().toISOString(),
        notes: null
      };
      setRowsByChoreId((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        next.set(choreId, optimisticRow);
        return next;
      });
      const { error } = await supabase
        .from("chore_completions")
        .insert({
          chore_id: choreId,
          completion_date: dateStr,
          completed_by_email: email
        });
      if (error) {
        setRowsByChoreId((prev) => {
          if (!prev) return prev;
          const next = new Map(prev);
          next.delete(choreId);
          return next;
        });
        return error;
      }
    }
    return null;
  }, [dateStr, rowsByChoreId]);

  // Derived view: a Set of completed chore IDs for fast lookups in render.
  const completedSet = useMemo(
    () => rowsByChoreId ? new Set(rowsByChoreId.keys()) : null,
    [rowsByChoreId]
  );

  return {
    completedSet,
    completions: rowsByChoreId,
    toggle,
    loading: rowsByChoreId === null,
    error
  };
}
