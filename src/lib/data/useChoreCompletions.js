import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { toLocalDateString } from "./dateUtil.js";
import {
  enqueueOp, initOutbox, outboxOps, subscribeOutbox,
} from "../outbox.js";

// Per-place chore completions (Batch 16.1), outbox-backed (Batch 16.2).
//
// A completion row is keyed (chore_id, place_id, completion_date) — a
// chore scoped to a parent place fans out into one independently
// completable obligation per occupied descendant place (see
// lib/chores.js → obligationPlaceIds). place_id NULL = a chore-level
// completion (chores with no place).
//
// Writes never hit Supabase directly anymore. Each toggle appends an
// op to the device-local IndexedDB outbox (lib/outbox.js); the sync
// engine pushes it whenever there's connectivity. Displayed state is
// the server rows (initial load + realtime) overlaid with the queue's
// not-yet-synced ops, so a tick in a dead zone applies instantly,
// survives an app kill, and never silently reverts.
//
// Returns:
//   - isDone(choreId, placeId)             : boolean
//   - isQueued(choreId, placeId)           : boolean (awaiting sync)
//   - doneCountForChore(choreId, placeIds) : { done, total }
//   - toggle(choreId, placeId, currentlyDone)   : Error | null
//   - toggleMany(choreId, placeIds, makeDone)   : Error | null
//   - completions : Map<key, row> (server rows, for who/when metadata)
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

// Build the local overlay from outbox ops touching this date. Ops are
// replayed in queue order so the last op for a key wins (check then
// uncheck while offline nets out to "not done").
function overlayFromOps(ops, dateStr) {
  const overlay = new Map(); // key → "insert" | "delete"
  for (const op of ops) {
    if (op.status !== "pending" && op.status !== "failed") continue;
    const p = op.payload;
    if (p?.dateStr !== dateStr) continue;
    switch (op.opKind) {
      case "completion_insert":
        overlay.set(keyOf(p.choreId, p.placeId), "insert");
        break;
      case "completion_delete":
        overlay.set(keyOf(p.choreId, p.placeId), "delete");
        break;
      case "completion_insert_many":
        for (const pid of p.placeIds ?? [null]) {
          overlay.set(keyOf(p.choreId, pid), "insert");
        }
        break;
      case "completion_delete_chore":
        for (const pid of p.placeIds ?? [null]) {
          overlay.set(keyOf(p.choreId, pid), "delete");
        }
        break;
      default:
        break;
    }
  }
  return overlay;
}

export function useChoreCompletions(date) {
  const dateStr = useMemo(() => toLocalDateString(date), [date]);
  // Server rows (not just keys) so consumers can display "completed at
  // 7:42 AM by Jim" in the future. null = still loading.
  const [rowsByKey, setRowsByKey] = useState(null);
  // Local overlay derived from not-yet-synced outbox ops.
  const [overlay, setOverlay] = useState(() => new Map());
  const [error, setError] = useState(null);

  // ── Initial load + reload-on-date-change / reconnect ──────────────
  // Realtime doesn't replay events missed while offline, so server
  // state refetches whenever connectivity returns. The refetch waits
  // for this date's queued ops to finish syncing first — otherwise a
  // fetch snapshotted before the flush would clobber the reconciled
  // rows. The overlay keeps this device's own queued ticks rendered
  // correctly throughout.
  const [reloadTick, setReloadTick] = useState(0);
  const needsReloadRef = useRef(false);

  const maybeReload = useCallback(() => {
    if (!needsReloadRef.current) return;
    const stillQueued = outboxOps().some(
      (o) => o.status === "pending" && o.payload?.dateStr === dateStr
    );
    if (stillQueued) return;
    needsReloadRef.current = false;
    setReloadTick((t) => t + 1);
  }, [dateStr]);

  useEffect(() => {
    const onOnline = () => {
      needsReloadRef.current = true;
      maybeReload();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [maybeReload]);

  // Only a date change resets to the loading state — a reconnect
  // refetch swaps rows in place without flashing the UI.
  useEffect(() => {
    setRowsByKey(null);
  }, [dateStr]);

  useEffect(() => {
    let cancelled = false;
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
          // Offline page-load: server state is unknown but the outbox
          // overlay still renders this device's own ticks. Treat the
          // server side as empty rather than blocking the UI.
          setError(error);
          setRowsByKey(new Map());
          return;
        }
        const m = new Map();
        for (const row of data) m.set(keyOf(row.chore_id, row.place_id), row);
        setRowsByKey(m);
      });
    return () => { cancelled = true; };
  }, [dateStr, reloadTick]);

  // ── Outbox overlay + synced-op reconciliation ──────────────────────
  // Subscribe to the outbox: recompute the overlay on any change, and
  // when a completion op lands on the server, fold its confirmed rows
  // straight into rowsByKey so state never flickers in the gap between
  // op-removal and the realtime echo.
  useEffect(() => {
    let cancelled = false;
    initOutbox().then(() => {
      if (cancelled) return;
      setOverlay(overlayFromOps(outboxOps(), dateStr));
    });
    const unsub = subscribeOutbox((event) => {
      if (event?.type === "synced") {
        const { op, result } = event;
        const p = op.payload;
        if (p?.dateStr === dateStr) {
          if (
            (op.opKind === "completion_insert" ||
              op.opKind === "completion_insert_many") &&
            result?.rows?.length
          ) {
            setRowsByKey((prev) => {
              if (!prev) return prev;
              const next = new Map(prev);
              for (const row of result.rows) {
                next.set(keyOf(row.chore_id, row.place_id), row);
              }
              return next;
            });
          } else if (op.opKind === "completion_delete") {
            setRowsByKey((prev) => {
              if (!prev) return prev;
              const next = new Map(prev);
              next.delete(keyOf(p.choreId, p.placeId));
              return next;
            });
          } else if (op.opKind === "completion_delete_chore") {
            setRowsByKey((prev) => {
              if (!prev) return prev;
              const next = new Map(prev);
              for (const pid of p.placeIds ?? [null]) {
                next.delete(keyOf(p.choreId, pid));
              }
              return next;
            });
          }
        }
      }
      setOverlay(overlayFromOps(outboxOps(), dateStr));
      // A drained queue unblocks any reconnect refetch waiting on it.
      if (event?.type === "flush-end" || event?.type === "synced") {
        maybeReload();
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [dateStr, maybeReload]);

  // ── Realtime subscription → debounced day refetch ──────────────────
  // We intentionally DON'T filter on completion_date. Supabase Realtime only
  // delivers DELETE events to a *filtered* subscription when the table is
  // REPLICA IDENTITY FULL — by default the delete payload carries just the PK,
  // so a `completion_date=eq.X` filter silently drops every DELETE. That made
  // a tick (INSERT) sync across devices but an untick (DELETE) not (F16). Any
  // change to the table now triggers a debounced refetch of this day's rows,
  // which applies INSERT/UPDATE/DELETE uniformly regardless of replica
  // identity; this device's own ticks stay instant via the outbox overlay.
  useEffect(() => {
    let scheduled = false;
    const bump = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; setReloadTick((t) => t + 1); }, 120);
    };
    const channel = realtimeChannel(`chore_completions:${dateStr}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chore_completions" },
        bump,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateStr]);

  // ── Read helpers ────────────────────────────────────────────────────
  // The overlay (this device's queued intent) wins over server state;
  // server rows answer for everything the queue isn't touching.
  const isDone = useCallback(
    (choreId, placeId) => {
      const k = keyOf(choreId, placeId);
      const queued = overlay.get(k);
      if (queued) return queued === "insert";
      return rowsByKey?.has(k) ?? false;
    },
    [rowsByKey, overlay]
  );

  // True while this obligation has a not-yet-synced op in the outbox —
  // drives the per-row "saved on this device" affordance.
  const isQueued = useCallback(
    (choreId, placeId) => overlay.has(keyOf(choreId, placeId)),
    [overlay]
  );

  // Progress across a chore's obligations: how many of the given
  // obligation place ids are completed today.
  const doneCountForChore = useCallback(
    (choreId, placeIds) => {
      const ids = placeIds ?? [null];
      let done = 0;
      for (const pid of ids) {
        if (isDone(choreId, pid)) done += 1;
      }
      return { done, total: ids.length };
    },
    [isDone]
  );

  const sessionEmail = useCallback(async () => {
    // getSession reads the locally-cached session, so this works
    // offline too — exactly what the outbox needs.
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

  // ── Toggle (single obligation) ──────────────────────────────────────
  // Append the op to the outbox; the overlay applies it instantly and
  // the sync engine pushes it whenever there's connectivity. No more
  // silent revert on network error.
  const toggle = useCallback(async (choreId, placeId, currentlyDone) => {
    try {
      if (currentlyDone) {
        await enqueueOp("completion_delete", {
          choreId,
          placeId: placeId ?? null,
          dateStr,
        });
      } else {
        const email = await sessionEmail();
        if (!email) return new Error("No active session");
        await enqueueOp("completion_insert", {
          choreId,
          placeId: placeId ?? null,
          dateStr,
          email,
          completedAt: new Date().toISOString(),
        });
      }
      return null;
    } catch (e) {
      // Only IndexedDB failures land here — there's no network in this
      // path anymore.
      setError(e);
      return e;
    }
  }, [dateStr, sessionEmail]);

  // ── Bulk toggle (a chore's remaining obligations in one op) ────────
  // makeDone=true queues one batched insert covering every
  // not-yet-done obligation; makeDone=false queues a delete of every
  // obligation row for the chore today. Used by the chore-level main
  // checkboxes and the Rounds "All taken care of" button.
  const toggleMany = useCallback(async (choreId, placeIds, makeDone) => {
    const ids = placeIds ?? [null];
    try {
      if (makeDone) {
        const remaining = ids.filter((pid) => !isDone(choreId, pid));
        if (remaining.length === 0) return null;
        const email = await sessionEmail();
        if (!email) return new Error("No active session");
        await enqueueOp("completion_insert_many", {
          choreId,
          placeIds: remaining.map((pid) => pid ?? null),
          dateStr,
          email,
          completedAt: new Date().toISOString(),
        });
      } else {
        await enqueueOp("completion_delete_chore", {
          choreId,
          placeIds: ids.map((pid) => pid ?? null),
          dateStr,
        });
      }
      return null;
    } catch (e) {
      setError(e);
      return e;
    }
  }, [dateStr, isDone, sessionEmail]);

  return {
    isDone,
    isQueued,
    doneCountForChore,
    toggle,
    toggleMany,
    completions: rowsByKey,
    loading: rowsByKey === null,
    error
  };
}
