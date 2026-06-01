import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { toLocalDateString } from "./dateUtil.js";

// Per-place chore completions (Batch 16.1).
//
// A completion row is keyed (chore_id, place_id, completion_date) — a
// chore scoped to a parent place fans out into one independently
// completable obligation per occupied descendant place (see
// lib/chores.js → obligationPlaceIds). place_id NULL = a chore-level
// completion (chores with no place).
//
// Loads completions for `date`, exposes per-obligation toggles with
// optimistic UI, and listens to realtime changes so two admins on two
// devices stay in sync without manual refresh.
//
// Returns:
//   - isDone(choreId, placeId)             : boolean
//   - doneCountForChore(choreId, placeIds) : { done, total }
//   - toggle(choreId, placeId, currentlyDone)   : Error | null
//   - toggleMany(choreId, placeIds, makeDone)   : Error | null
//   - completions : Map<key, row> (full rows, for who/when metadata)
//   - loading / error
//
// The hook is meant to be mounted ONCE per page and the returned
// helpers passed down to per-row components — that way we open exactly
// one realtime subscription instead of one per chore row.

// Composite map key for a (chore, place) obligation. NULL place
// collapses to the empty string so chore-level obligations get a
// stable key too.
function keyOf(choreId, placeId) {
  return `${choreId}|${placeId ?? ""}`;
}

export function useChoreCompletions(date) {
  const dateStr = useMemo(() => toLocalDateString(date), [date]);
  // Full rows (not just keys) so consumers can display "completed at
  // 7:42 AM by Jim" in the future. null = still loading.
  const [rowsByKey, setRowsByKey] = useState(null);
  const [error, setError] = useState(null);

  // ── Initial load + reload-on-date-change ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    setRowsByKey(null);
    setError(null);
    supabase
      .from("chore_completions")
      .select(
        "id, chore_id, place_id, completion_date, completed_by_email, " +
        "completed_at, notes"
      )
      .eq("completion_date", dateStr)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error);
          setRowsByKey(new Map());
          return;
        }
        const m = new Map();
        for (const row of data) m.set(keyOf(row.chore_id, row.place_id), row);
        setRowsByKey(m);
      });
    return () => { cancelled = true; };
  }, [dateStr]);

  // ── Realtime subscription, scoped to today's rows ──────────────────
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
          setRowsByKey((prev) => {
            if (!prev) return prev;
            const next = new Map(prev);
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const row = payload.new;
              next.set(keyOf(row.chore_id, row.place_id), row);
            } else if (payload.eventType === "DELETE") {
              const row = payload.old;
              next.delete(keyOf(row.chore_id, row.place_id));
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateStr]);

  // ── Helpers ─────────────────────────────────────────────────────────
  const isDone = useCallback(
    (choreId, placeId) => rowsByKey?.has(keyOf(choreId, placeId)) ?? false,
    [rowsByKey]
  );

  // Progress across a chore's obligations: how many of the given
  // obligation place ids are completed today.
  const doneCountForChore = useCallback(
    (choreId, placeIds) => {
      const ids = placeIds ?? [null];
      let done = 0;
      for (const pid of ids) {
        if (rowsByKey?.has(keyOf(choreId, pid))) done += 1;
      }
      return { done, total: ids.length };
    },
    [rowsByKey]
  );

  const sessionEmail = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;
    if (!email) {
      // Should be impossible — LoginGate guarantees a session before
      // this hook ever mounts — but guard anyway so we fail loud.
      const e = new Error("No active session");
      setError(e);
      return null;
    }
    return email;
  }, []);

  // Build a delete query scoped to one obligation. `.eq` with null
  // doesn't match SQL NULL, so chore-level rows need `.is`.
  const placeFilter = useCallback((query, placeId) => {
    return placeId == null
      ? query.is("place_id", null)
      : query.eq("place_id", placeId);
  }, []);

  // ── Optimistic toggle (single obligation) ───────────────────────────
  // Mutate local state immediately, then fire the DB call. If the call
  // fails we revert. The realtime subscription will also fire for the
  // (eventually committed) row but Map.set with the same key is
  // idempotent.
  const toggle = useCallback(async (choreId, placeId, currentlyDone) => {
    const email = await sessionEmail();
    if (!email) return new Error("No active session");
    const k = keyOf(choreId, placeId);

    if (currentlyDone) {
      // Snapshot for revert.
      const prevRow = rowsByKey?.get(k);
      setRowsByKey((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        next.delete(k);
        return next;
      });
      const { error } = await placeFilter(
        supabase
          .from("chore_completions")
          .delete()
          .eq("chore_id", choreId)
          .eq("completion_date", dateStr),
        placeId
      );
      if (error) {
        setRowsByKey((prev) => {
          if (!prev || !prevRow) return prev;
          const next = new Map(prev);
          next.set(k, prevRow);
          return next;
        });
        return error;
      }
    } else {
      // Optimistic insert with a synthetic row. The realtime push will
      // overwrite this with the canonical server row a moment later.
      const optimisticRow = {
        id: `optimistic-${k}-${Date.now()}`,
        chore_id: choreId,
        place_id: placeId ?? null,
        completion_date: dateStr,
        completed_by_email: email,
        completed_at: new Date().toISOString(),
        notes: null
      };
      setRowsByKey((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        next.set(k, optimisticRow);
        return next;
      });
      const { error } = await supabase
        .from("chore_completions")
        .insert({
          chore_id: choreId,
          place_id: placeId ?? null,
          completion_date: dateStr,
          completed_by_email: email
        });
      if (error) {
        setRowsByKey((prev) => {
          if (!prev) return prev;
          const next = new Map(prev);
          next.delete(k);
          return next;
        });
        return error;
      }
    }
    return null;
  }, [dateStr, rowsByKey, sessionEmail, placeFilter]);

  // ── Bulk toggle (a chore's remaining obligations in one call) ──────
  // makeDone=true inserts every not-yet-done obligation as one batched
  // INSERT; makeDone=false deletes every obligation row for the chore
  // today. Used by the chore-level main checkboxes and the Rounds
  // "All taken care of" button — one round-trip instead of N.
  const toggleMany = useCallback(async (choreId, placeIds, makeDone) => {
    const email = await sessionEmail();
    if (!email) return new Error("No active session");
    const ids = placeIds ?? [null];

    if (makeDone) {
      const remaining = ids.filter(
        (pid) => !(rowsByKey?.has(keyOf(choreId, pid)))
      );
      if (remaining.length === 0) return null;
      const nowIso = new Date().toISOString();
      const optimistic = remaining.map((pid) => ({
        id: `optimistic-${keyOf(choreId, pid)}-${Date.now()}`,
        chore_id: choreId,
        place_id: pid ?? null,
        completion_date: dateStr,
        completed_by_email: email,
        completed_at: nowIso,
        notes: null
      }));
      setRowsByKey((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        for (const row of optimistic) {
          next.set(keyOf(row.chore_id, row.place_id), row);
        }
        return next;
      });
      const { error } = await supabase
        .from("chore_completions")
        .insert(remaining.map((pid) => ({
          chore_id: choreId,
          place_id: pid ?? null,
          completion_date: dateStr,
          completed_by_email: email
        })));
      if (error) {
        setRowsByKey((prev) => {
          if (!prev) return prev;
          const next = new Map(prev);
          for (const pid of remaining) next.delete(keyOf(choreId, pid));
          return next;
        });
        return error;
      }
    } else {
      // Uncheck-all: snapshot the chore's rows, drop them locally, then
      // delete every row for this chore today (all places + the
      // chore-level NULL row) in one statement.
      const snapshot = [];
      setRowsByKey((prev) => {
        if (!prev) return prev;
        const next = new Map(prev);
        for (const pid of ids) {
          const k = keyOf(choreId, pid);
          const row = next.get(k);
          if (row) {
            snapshot.push([k, row]);
            next.delete(k);
          }
        }
        return next;
      });
      const { error } = await supabase
        .from("chore_completions")
        .delete()
        .eq("chore_id", choreId)
        .eq("completion_date", dateStr);
      if (error) {
        setRowsByKey((prev) => {
          if (!prev) return prev;
          const next = new Map(prev);
          for (const [k, row] of snapshot) next.set(k, row);
          return next;
        });
        return error;
      }
    }
    return null;
  }, [dateStr, rowsByKey, sessionEmail]);

  return {
    isDone,
    doneCountForChore,
    toggle,
    toggleMany,
    completions: rowsByKey,
    loading: rowsByKey === null,
    error
  };
}
