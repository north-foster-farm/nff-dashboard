import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Neighbor-day timed deltas for the Overnight block (the two-day span). When
// you view day X, the Overnight shift that ENDS this morning carries
// yesterday's evening rows, and the shift that STARTS tonight carries
// tomorrow's pre-dawn rows — neither is in day X's own deltas. This reads the
// timed deltas (ad-hoc tasks + project steps) for X-1 and X+1 so both overnight
// edges populate, even offline once cached.
//
// Read-only: no outbox overlay (neighbor edits are rare, and an item added on
// the viewed day rides that day's own hook). `loading` stays true until the
// first fetch resolves so a not-yet-cached neighbor renders "syncing…" rather
// than a false-empty (Dad's rule — empty must mean empty).
const TYPES = ["ad_hoc", "project_node"];
const COLS =
  "id, source_type, source_ref, block_id, run_date, clock_time, " +
  "assignee, reason, overrides, history, state";

export function useNeighborDeltas(prevISO, nextISO) {
  const instanceId = useId();
  const [rows, setRows] = useState(null); // null = not loaded yet (syncing)

  useEffect(() => {
    if (!prevISO || !nextISO) return;
    let cancelled = false;
    const load = async () => {
      const res = await supabase.from("commitments").select(COLS)
        .in("run_date", [prevISO, nextISO]).in("source_type", TYPES);
      if (!cancelled) setRows(res.error ? [] : (res.data ?? []));
    };
    load();
    // Any commitments change re-reads both neighbor days.
    const ch = realtimeChannel(`sched-neighbor:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "commitments" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [instanceId, prevISO, nextISO]);

  const prevDeltas = useMemo(
    () => (rows ?? []).filter((r) => r.run_date === prevISO),
    [rows, prevISO]);
  const nextDeltas = useMemo(
    () => (rows ?? []).filter((r) => r.run_date === nextISO),
    [rows, nextISO]);
  return { prevDeltas, nextDeltas, loading: rows === null };
}
