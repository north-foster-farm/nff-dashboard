import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";
import {
  enqueueOp, initOutbox, subscribeOutbox, outboxOps,
} from "./outbox.js";

// All-occurrences buffers (S53/S54) — a buffer bound to an activity SERIES
// rather than one day, so it auto-reserves on every occurrence (a market
// always needs an hour beforehand). Stored as `buffer` commitments carrying
// `source_ref.scope = 'all'`; unlike per-day buffers these are read across all
// run_dates (the row's run_date is just a creation stamp) and synthesized onto
// each day's occurrence by deriveTemplateBuffer. Checklist done-state lives
// per-day in `source_ref.checklistState[iso]` so the list resets each day.
//
// The outbox is overlaid so an add / tick / remove shows instantly and
// survives offline, reconciled by realtime when it syncs.
const COLS =
  "id, source_type, source_ref, run_date, clock_time, assignee, state";

export function useBufferTemplates() {
  const instanceId = useId();
  const [serverRows, setServerRows] = useState(null);
  const [outboxTick, setOutboxTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase.from("commitments").select(COLS)
      .eq("source_type", "buffer")
      .then((res) => {
        if (cancelled) return;
        const rows = (res.error ? [] : (res.data ?? []))
          .filter((r) => r.source_ref?.scope === "all");
        setServerRows(rows);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("commitments").select(COLS)
          .eq("source_type", "buffer");
        if (!res.error) {
          setServerRows((res.data ?? [])
            .filter((r) => r.source_ref?.scope === "all"));
        }
      }, 80);
    };
    const ch = realtimeChannel(`buffer-templates:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "commitments" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instanceId]);

  useEffect(() => {
    let cancelled = false;
    initOutbox().then(() => { if (!cancelled) setOutboxTick((t) => t + 1); });
    const unsub = subscribeOutbox(() => setOutboxTick((t) => t + 1));
    return () => { cancelled = true; unsub(); };
  }, []);

  const templates = useMemo(() => {
    const byId = new Map((serverRows ?? []).map((r) => [r.id, r]));
    for (const op of outboxOps()) {
      if (op.status === "done") continue;
      const p = op.payload ?? {};
      if (op.opKind === "commitment_insert") {
        if (p.sourceType === "buffer" && p.sourceRef?.scope === "all"
            && !byId.has(p.id)) {
          byId.set(p.id, {
            id: p.id, source_type: "buffer", source_ref: p.sourceRef,
            run_date: p.runDate, clock_time: p.clockTime ?? null,
            assignee: p.assignee ?? null, state: "scheduled", _pending: true,
          });
        }
      } else if (op.opKind === "commitment_delete" && byId.has(p.id)) {
        byId.delete(p.id);
      } else if (op.opKind === "commitment_update" && byId.has(p.id)) {
        const f = p.fields ?? {};
        const merged = { ...byId.get(p.id) };
        if ("sourceRef" in f) merged.source_ref = f.sourceRef;
        byId.set(p.id, merged);
      }
    }
    return [...byId.values()];
  }, [serverRows, outboxTick]);

  // Tick / untick a template item for ONE day — written into
  // source_ref.checklistState[iso] so each day tracks its own progress.
  const toggleTemplateItem = (templateId, itemId, done, dateISO) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const sr = t.source_ref ?? {};
    const checklistState = { ...(sr.checklistState ?? {}) };
    const day = { ...(checklistState[dateISO] ?? {}) };
    day[itemId] = done;
    checklistState[dateISO] = day;
    enqueueOp("commitment_update", {
      id: templateId, fields: { sourceRef: { ...sr, checklistState } },
    });
  };

  const removeTemplate = (id) => enqueueOp("commitment_delete", { id });

  return {
    templates, loading: serverRows === null,
    toggleTemplateItem, removeTemplate,
  };
}
