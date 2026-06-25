import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import {
  enqueueOp, initOutbox, subscribeOutbox, outboxOps,
} from "../outbox.js";

// Schedule placement deltas (S6) — the authored, schedule-local
// commitments that aren't chore-block runs: ad-hoc one-off tasks and
// notes added to a day. (Extra chores / project nodes / events arrive in
// later batches.) Read for one day, with the outbox overlaid so an add /
// remove / done-toggle shows instantly and survives offline, reconciled by
// realtime when the op syncs.
const DELTA_TYPES = ["ad_hoc", "note", "chore"];
const COLS =
  "id, source_type, source_ref, block_id, run_date, clock_time, " +
  "assignee, reason, state";

export function useScheduleDeltas(dateISO) {
  const instanceId = useId();
  const [serverRows, setServerRows] = useState(null);
  const [outboxTick, setOutboxTick] = useState(0);

  // initial fetch
  useEffect(() => {
    if (!dateISO) return;
    let cancelled = false;
    supabase.from("commitments").select(COLS)
      .eq("run_date", dateISO).in("source_type", DELTA_TYPES)
      .then((res) => {
        if (cancelled) return;
        setServerRows(res.error ? [] : (res.data ?? []));
      });
    return () => { cancelled = true; };
  }, [dateISO]);

  // realtime — any commitments change re-reads this day's deltas
  useEffect(() => {
    if (!dateISO) return;
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("commitments").select(COLS)
          .eq("run_date", dateISO).in("source_type", DELTA_TYPES);
        if (!res.error) setServerRows(res.data ?? []);
      }, 80);
    };
    const ch = realtimeChannel(`sched-deltas:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "commitments" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instanceId, dateISO]);

  // outbox subscription — recompute the overlay as ops queue/sync
  useEffect(() => {
    let cancelled = false;
    initOutbox().then(() => { if (!cancelled) setOutboxTick((t) => t + 1); });
    const unsub = subscribeOutbox(() => setOutboxTick((t) => t + 1));
    return () => { cancelled = true; unsub(); };
  }, []);

  const deltas = useMemo(() => {
    const byId = new Map((serverRows ?? []).map((r) => [r.id, r]));
    for (const op of outboxOps()) {
      if (op.status === "done") continue;
      const p = op.payload ?? {};
      if (op.opKind === "commitment_insert") {
        if (p.runDate === dateISO && DELTA_TYPES.includes(p.sourceType)
            && !byId.has(p.id)) {
          byId.set(p.id, {
            id: p.id, source_type: p.sourceType, source_ref: p.sourceRef,
            block_id: p.blockId ?? null, run_date: p.runDate,
            clock_time: null, assignee: p.assignee ?? null,
            reason: p.reason ?? null, state: "scheduled", _pending: true,
          });
        }
      } else if (op.opKind === "commitment_delete" && byId.has(p.id)) {
        byId.delete(p.id);
      } else if (op.opKind === "commitment_set_state" && byId.has(p.id)) {
        byId.set(p.id, { ...byId.get(p.id), state: p.state });
      }
    }
    return [...byId.values()];
  }, [serverRows, outboxTick, dateISO]);

  // Block placement rides in source_ref.block_id — the real block_id column
  // is reserved for the chore_block run path (the unique (block_id, run_date)
  // constraint), so deltas keep it null and never collide with a run.
  const addTask = (title, blockId = null, assignee = null) => {
    const id = crypto.randomUUID();
    enqueueOp("commitment_insert", {
      id, sourceType: "ad_hoc",
      sourceRef: { title, block_id: blockId ?? null },
      runDate: dateISO, assignee,
    });
    return id;
  };
  // Pull an existing chore onto the day at a specific place (a 'chore'
  // delta — renders as a real chore row, completion via chore_completions).
  const addChore = (choreId, placeId, blockId = null) => {
    const id = crypto.randomUUID();
    enqueueOp("commitment_insert", {
      id, sourceType: "chore",
      sourceRef: {
        chore_id: choreId, place_id: placeId ?? null, block_id: blockId ?? null,
      },
      runDate: dateISO,
    });
    return id;
  };
  const removeDelta = (id) => enqueueOp("commitment_delete", { id });
  const setDone = (id, done) =>
    enqueueOp("commitment_set_state", { id, state: done ? "done" : "scheduled" });

  return {
    deltas, loading: serverRows === null,
    addTask, addChore, removeDelta, setDone,
  };
}
