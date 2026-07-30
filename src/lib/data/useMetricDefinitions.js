import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Metric registry hook (Batch 26.2).
//
//   useMetricDefinitions() → { definitions, byAppliesTo, loading, error }
//
// Read-only view over the `metrics` table — the registry of every
// metric the subsystem knows how to compute (seeded in 0023). The
// Metrics page renders definitions / formulas / target bands from
// here; the math itself lives in src/lib/metrics.js.

const COLS =
  "id, name, description, unit, applies_to, target_low, target_high, " +
  "target_note, ordinal";

function shapeDefinition(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    unit: r.unit,
    appliesTo: r.applies_to,
    targetLow: r.target_low == null ? null : Number(r.target_low),
    targetHigh: r.target_high == null ? null : Number(r.target_high),
    targetNote: r.target_note,
    ordinal: r.ordinal ?? 0,
  };
}

export function useMetricDefinitions() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let scheduled = false;

    const fetchAll = async () => {
      const { data, error: err } = await supabase.from("metrics")
        .select(COLS).order("applies_to").order("ordinal");
      if (cancelled) return;
      if (err) { setError(err); return; }
      setRows((data ?? []).map(shapeDefinition));
    };

    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 120);
    };

    fetchAll();
    const channel = realtimeChannel(`metrics:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "metrics" }, refresh)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [instanceId]);

  const definitions = useMemo(() => rows ?? [], [rows]);

  const byAppliesTo = useMemo(() => {
    const map = new Map();
    for (const d of definitions) {
      const arr = map.get(d.appliesTo) ?? [];
      arr.push(d);
      map.set(d.appliesTo, arr);
    }
    return map;
  }, [definitions]);

  return { definitions, byAppliesTo, loading: rows === null, error };
}
