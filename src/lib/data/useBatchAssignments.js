import { useCallback, useEffect, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Loads every batch assignment in one round-trip and exposes:
//   - getBatchId(eventInstanceId) → string | null
//   - assign(eventInstanceId, batchId) → Error | null
//
// The full table is small (one row per processing-day event, ~8/year) so
// pulling all of it once is cheaper than one query per event card.
export function useBatchAssignments() {
  const [byEventId, setByEventId] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("batch_assignments")
      .select("event_instance_id, batch_id, assigned_by_email, assigned_at")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error);
          setByEventId(new Map());
          return;
        }
        const m = new Map();
        for (const row of data) m.set(row.event_instance_id, row);
        setByEventId(m);
      });
    return () => { cancelled = true; };
  }, []);

  // Realtime — keep every open EventKindPage in sync as soon as anyone
  // assigns a batch. Useful when one admin assigns from a phone while the
  // other is on the desktop.
  useEffect(() => {
    const channel = realtimeChannel("batch_assignments:stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "batch_assignments" },
        (payload) => {
          setByEventId((prev) => {
            if (!prev) return prev;
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              next.delete(payload.old.event_instance_id);
            } else {
              next.set(payload.new.event_instance_id, payload.new);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const getBatchId = useCallback(
    (eventInstanceId) => byEventId?.get(eventInstanceId)?.batch_id ?? null,
    [byEventId]
  );

  // Upsert via PG `on conflict do update`. The realtime push will reconcile
  // the local Map after the round-trip completes.
  const assign = useCallback(async (eventInstanceId, batchId) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const email = sessionData.session?.user?.email;
    if (!email) return new Error("No active session");
    const { error } = await supabase
      .from("batch_assignments")
      .upsert(
        {
          event_instance_id: eventInstanceId,
          batch_id: batchId,
          assigned_by_email: email,
          assigned_at: new Date().toISOString()
        },
        { onConflict: "event_instance_id" }
      );
    return error ?? null;
  }, []);

  return useMemo(
    () => ({ getBatchId, assign, loading: byEventId === null, error }),
    [getBatchId, assign, byEventId, error]
  );
}
