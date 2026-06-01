import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Run Events live in `activity_log` (typed rows tagged with run_id +
// place context) plus the `activity_log_condition_states` child table
// for the multi-select MASH-intake action. Quick actions in Rounds
// write through `logRunEvent` which calls the SECURITY DEFINER RPC
// `log_run_event`. The activity feed picks them up via the same
// realtime subscription that powers `useActivityLog`.
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
    const channel = supabase
      .channel(`run_events:stream:${instanceId}`)
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

  const logRunEvent = useCallback(async ({
    kind,
    payload = {},
    runId = null,
    placeId = null,
    conditions = null,
  }) => {
    const { data, error: rpcErr } = await supabase.rpc("log_run_event", {
      p_kind: kind,
      p_payload: payload,
      p_run_id: runId,
      p_place_id: placeId,
      p_conditions: conditions,
    });
    if (rpcErr) throw rpcErr;
    return data;
  }, []);

  return {
    logRunEvent,
    recentConditionsByPlace,
    repeatWindowDays: REPEAT_WINDOW_DAYS,
    loading: recent === null,
    error,
  };
}
