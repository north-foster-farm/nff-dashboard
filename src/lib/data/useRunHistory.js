import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Read-only history hook for the Performance sub-tab. Pulls
// chore_runs for the last `days` calendar days (defaults to 30 — the
// window the spec calls for). Realtime-subscribed so a freshly-ended
// run shows up in the histogram without a reload. No mutations —
// useChoreRuns owns those.
//
// Returned shape:
//   {
//     runs:    { id, blockId, runDate, state, startedAt, endedAt }[],
//     loading, error,
//     sinceISO,
//   }

const SELECT_COLS =
  "id, block_id, run_date, state, started_at, ended_at";

export function useRunHistory({ days = 30 } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return isoLocalDate(d);
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("commitments")
      .select(SELECT_COLS)
      .eq("source_type", "chore_block")
      .gte("run_date", sinceISO)
      .order("run_date", { ascending: true })
      .order("started_at", { ascending: true })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setRows([]); return; }
        setRows(res.data ?? []);
      });
    return () => { cancelled = true; };
  }, [sinceISO]);

  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("commitments")
          .select(SELECT_COLS)
          .eq("source_type", "chore_block")
          .gte("run_date", sinceISO)
          .order("run_date", { ascending: true })
          .order("started_at", { ascending: true });
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`commitments:history:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "commitments" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, sinceISO]);

  const shaped = useMemo(() => (rows ?? []).map(r => ({
    id: r.id,
    blockId: r.block_id,
    runDate: r.run_date,
    state: r.state,
    startedAt: r.started_at ? new Date(r.started_at) : null,
    endedAt: r.ended_at ? new Date(r.ended_at) : null,
  })), [rows]);

  return {
    runs: shaped,
    loading: rows === null,
    error,
    sinceISO,
  };
}

function isoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
