import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Mortality log read hook (Batch 26.1).
//
//   useMortalityLog(groupId) → { events, loading, error }
//
// Read-only view over the activity_log rows the Rounds mortality quick
// action writes (kind = 'mortality_observed', payload carries
// livestock_group_id + count). The metrics engine sums these for the
// mortality-rate metric; the write path stays where it's always been
// (useRunEvents.logMortality → outbox). Pass groupId = null for every
// group's events (the Metrics page comparison view).

function shapeEvent(r) {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    groupId: r.payload?.livestock_group_id ?? null,
    groupLabel: r.payload?.group_label ?? null,
    count: Number(r.payload?.count) || 0,
    placeId: r.place_id ?? null,
  };
}

export function useMortalityLog(groupId = null) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;

    const fetchAll = async () => {
      const { data, error: err } = await supabase
        .from("activity_log")
        .select("id, occurred_at, payload, place_id")
        .eq("kind", "mortality_observed")
        .order("occurred_at", { ascending: false });
      if (cancelled) return;
      if (err) { setError(err); return; }
      setRows((data ?? []).map(shapeEvent));
    };

    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 120);
    };

    fetchAll();
    const channel = realtimeChannel(`mortality_log:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        (payload) => {
          const row = payload.new ?? payload.old;
          if (row?.kind === "mortality_observed") refresh();
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [instanceId]);

  const events = useMemo(() => {
    if (!rows) return [];
    return groupId ? rows.filter(e => e.groupId === groupId) : rows;
  }, [rows, groupId]);

  return { events, loading: rows === null, error };
}
