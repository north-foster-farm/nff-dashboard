import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { enqueueOp } from "../outbox.js";

// Run Events live in `activity_log` (typed rows tagged with run_id +
// place context) plus the `activity_log_condition_states` child table
// for the multi-select MASH-intake action. Quick actions in Rounds
// write through `logRunEvent`, which (since Batch 16.2) appends a
// `run_event` op to the device-local outbox; the sync engine calls the
// SECURITY DEFINER RPC `log_run_event` whenever there's connectivity.
// The activity feed picks synced rows up via the same realtime
// subscription that powers `useActivityLog`.
//
// `recentConditionsByPlace` lets the MASH sheet flag repeat
// observations ("Brooder 1: 2 off-feed calls in the last 7 days").
// It's a small lookup keyed by place_id over the last 7 days.

const REPEAT_WINDOW_DAYS = 7;

export function useRunEvents() {
  const instanceId = useId();
  const [recent, setRecent] = useState(null); // condition rows w/ chips
  const [error, setError] = useState(null);

  // Load the rolling 7-day window of mash_intake rows + their chip
  // child rows. Small enough that we hand-stitch in JS.
  useEffect(() => {
    let cancelled = false;
    const since = new Date(
      Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    setError(null);
    Promise.all([
      supabase
        .from("activity_log")
        .select("id, occurred_at, place_id")
        .eq("kind", "mash_intake")
        .gte("occurred_at", since),
      supabase
        .from("activity_log_condition_states")
        .select("activity_log_id, state"),
    ]).then(([logsRes, chipsRes]) => {
      if (cancelled) return;
      if (logsRes.error) { setError(logsRes.error); setRecent([]); return; }
      if (chipsRes.error) { setError(chipsRes.error); setRecent([]); return; }
      const chipsByLog = new Map();
      for (const c of chipsRes.data ?? []) {
        if (!chipsByLog.has(c.activity_log_id)) {
          chipsByLog.set(c.activity_log_id, []);
        }
        chipsByLog.get(c.activity_log_id).push(c.state);
      }
      const stitched = (logsRes.data ?? []).map(l => ({
        id: l.id,
        occurredAt: l.occurred_at,
        placeId: l.place_id,
        states: chipsByLog.get(l.id) ?? [],
      }));
      setRecent(stitched);
    });
    return () => { cancelled = true; };
  }, []);

  // Realtime: refetch on insert/delete to either of the two tables.
  // The window is small so a refetch is cheaper than reconciling.
  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const since = new Date(
          Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        const [logsRes, chipsRes] = await Promise.all([
          supabase
            .from("activity_log")
            .select("id, occurred_at, place_id")
            .eq("kind", "mash_intake")
            .gte("occurred_at", since),
          supabase
            .from("activity_log_condition_states")
            .select("activity_log_id, state"),
        ]);
        if (logsRes.error || chipsRes.error) return;
        const chipsByLog = new Map();
        for (const c of chipsRes.data ?? []) {
          if (!chipsByLog.has(c.activity_log_id)) {
            chipsByLog.set(c.activity_log_id, []);
          }
          chipsByLog.get(c.activity_log_id).push(c.state);
        }
        setRecent(
          (logsRes.data ?? []).map(l => ({
            id: l.id,
            occurredAt: l.occurred_at,
            placeId: l.place_id,
            states: chipsByLog.get(l.id) ?? [],
          }))
        );
      }, 120);
    };
    const channel = realtimeChannel(`run_events:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (row?.kind === "mash_intake") refresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_log_condition_states",
        },
        refresh
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  // Map<placeId, Map<state, count>> over the rolling window.
  const recentConditionsByPlace = useMemo(() => {
    const out = new Map();
    if (!recent) return out;
    for (const r of recent) {
      if (!r.placeId) continue;
      if (!out.has(r.placeId)) out.set(r.placeId, new Map());
      const counts = out.get(r.placeId);
      for (const s of r.states) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    return out;
  }, [recent]);

  // Outbox-first (Batch 16.2): append locally, sync engine pushes.
  // Offline captures survive an app kill and sync when signal returns.
  // The original capture time rides in the payload (`captured_at`)
  // since the RPC stamps occurred_at at sync time.
  const logRunEvent = useCallback(async ({
    kind,
    payload = {},
    runId = null,
    placeId = null,
    conditions = null,
  }) => {
    return enqueueOp("run_event", {
      kind,
      payload: { ...payload, captured_at: new Date().toISOString() },
      runId,
      placeId,
      conditions,
    });
  }, []);

  // Mortality fast-path: one observation row + one ADDITIVE count
  // decrement. The decrement op carries a delta (never an absolute
  // count), so two offline phones each logging "1 dead" sum to 2 at
  // sync time instead of clobbering each other. The executor also
  // handles the auto move-out when a cohort empties to zero.
  const logMortality = useCallback(async ({
    groupId,
    groupLabel,
    count,
    runId = null,
    placeId = null,
  }) => {
    await enqueueOp("run_event", {
      kind: "mortality_observed",
      payload: {
        livestock_group_id: groupId,
        group_label: groupLabel,
        count,
        captured_at: new Date().toISOString(),
      },
      runId,
      placeId,
    });
    await enqueueOp("mortality_decrement", {
      groupId,
      delta: count,
    });
  }, []);

  return {
    logRunEvent,
    logMortality,
    recentConditionsByPlace,
    repeatWindowDays: REPEAT_WINDOW_DAYS,
    loading: recent === null,
    error,
  };
}
