import { useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import {
  enqueueOp, initOutbox, subscribeOutbox, outboxOps,
} from "../outbox.js";
import { hmToMin } from "../schedule/reflowBridge.js";

// Schedule placement deltas (S6) — the authored, schedule-local
// commitments that aren't chore-block runs: ad-hoc one-off tasks, notes,
// pulled chores, and pulled project steps added to a day. (Events are
// derived, not deltas.) Read for one day, with the outbox overlaid so an add /
// remove / done-toggle shows instantly and survives offline, reconciled by
// realtime when the op syncs.
const DELTA_TYPES = [
  "ad_hoc", "note", "chore", "project_node", "override", "reservation",
  "buffer",
];
const COLS =
  "id, source_type, source_ref, block_id, run_date, clock_time, " +
  "assignee, reason, overrides, history, state";

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

  const allDeltas = useMemo(() => {
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
            clock_time: p.clockTime ?? null, assignee: p.assignee ?? null,
            reason: p.reason ?? null, overrides: p.overrides ?? null,
            history: p.history ?? [], state: "scheduled", _pending: true,
          });
        }
      } else if (op.opKind === "commitment_delete" && byId.has(p.id)) {
        byId.delete(p.id);
      } else if (op.opKind === "commitment_set_state" && byId.has(p.id)) {
        byId.set(p.id, { ...byId.get(p.id), state: p.state });
      } else if (op.opKind === "commitment_update" && byId.has(p.id)) {
        const f = p.fields ?? {};
        const merged = { ...byId.get(p.id) };
        if ("runDate" in f) merged.run_date = f.runDate;
        if ("clockTime" in f) merged.clock_time = f.clockTime;
        if ("assignee" in f) merged.assignee = f.assignee;
        if ("sourceRef" in f) merged.source_ref = f.sourceRef;
        if ("overrides" in f) merged.overrides = f.overrides;
        if ("history" in f) merged.history = f.history;
        // A cross-day move (run_date changed off today) leaves this day.
        if (merged.run_date !== dateISO) byId.delete(p.id);
        else byId.set(p.id, merged);
      }
    }
    return [...byId.values()];
  }, [serverRows, outboxTick, dateISO]);

  // A removed placed project step is a TOMBSTONE, not a deletion (see
  // removeDelta): the row survives with source_ref.origin:'removed' so the
  // reflow engine knows the step was deliberately taken off the day and
  // never re-places it. Tombstones are invisible to every surface — the
  // `deltas` this hook returns filters them out — and reach the engine only
  // as `removedStepIds` + `removedGapStarts` (a removal frees its GAP for
  // the day too: the engine must not slide the next queued step into the
  // slot the user just cleared).
  const isTombstone = (d) =>
    d.source_type === "project_node" && d.source_ref?.origin === "removed";
  const deltas = useMemo(
    () => allDeltas.filter((d) => !isTombstone(d)), [allDeltas]);
  const removedStepIds = useMemo(() => new Set(
    allDeltas.filter(isTombstone)
      .map((d) => d.source_ref?.step_id)
      .filter(Boolean)), [allDeltas]);
  // The tombstoned placements' gap starts (minutes of day, from the
  // clock_time the tombstone keeps) — reflowPlan skips these gaps today.
  const removedGapStarts = useMemo(() => new Set(
    allDeltas.filter(isTombstone)
      .map((d) => hmToMin(d.clock_time))
      .filter((m) => m != null)), [allDeltas]);

  // The day(s) an add targets. Defaults to the viewed day; a non-empty
  // `dates` array (S34 — add the same item to several days at once) fans the
  // insert out, one commitment per date. Returns the first id created.
  const targetDates = (dates) =>
    Array.isArray(dates) && dates.length ? dates : [dateISO];
  const insertEach = (dates, build) => {
    let first = null;
    for (const d of targetDates(dates)) {
      const id = crypto.randomUUID();
      enqueueOp("commitment_insert", { id, runDate: d, ...build(d) });
      if (!first) first = id;
    }
    return first;
  };

  // Block placement rides in source_ref.block_id — the real block_id column
  // is reserved for the chore_block run path (the unique (block_id, run_date)
  // constraint), so deltas keep it null and never collide with a run.
  // `clockTime` ("HH:MM") lets the add carry a time so it routes to the
  // segment whose window contains it (Project blocks — segmentForStart).
  const addTask = (
    title, blockId = null, assignee = null, dates = null, clockTime = null,
  ) =>
    insertEach(dates, () => ({
      sourceType: "ad_hoc",
      sourceRef: { title, block_id: blockId ?? null }, assignee,
      clockTime: clockTime ?? null,
    }));
  // Add a free-text note/marker to the day (S36) — a 'note' delta. Not a
  // task: it has no done-state, it just rides the day as a reminder.
  const addNote = (text, blockId = null, dates = null) =>
    insertEach(dates, () => ({
      sourceType: "note", sourceRef: { text, block_id: blockId ?? null },
    }));
  // Pull an existing chore onto the day at a specific place (a 'chore'
  // delta — renders as a real chore row, completion via chore_completions).
  const addChore = (choreId, placeId, blockId = null, dates = null) =>
    insertEach(dates, () => ({
      sourceType: "chore",
      sourceRef: {
        chore_id: choreId, place_id: placeId ?? null, block_id: blockId ?? null,
      },
    }));
  // Pull a project STEP onto the day (S6 — project-node add). Renders as a
  // checkable row whose done-state lives on the commitment; the source_ref
  // carries the step title + its project's title for the sub-line. The
  // 'project_node' source_type was already whitelisted by migration 0034.
  // `clockTime` ("HH:MM") routes the placed step to a Project segment by time
  // (segmentForStart) rather than a chore block.
  const addProject = (node, blockId = null, dates = null, clockTime = null) =>
    insertEach(dates, () => ({
      sourceType: "project_node",
      sourceRef: {
        project_id: node.projectId, step_id: node.stepId ?? null,
        title: node.title, project_title: node.projectTitle ?? null,
        block_id: blockId ?? null,
        // `origin: "auto"` marks a placement written by the scheduling
        // engine's reflow, so a later reflow can replace only its own
        // placements and leave manual (origin absent) ones untouched.
        // Rides source_ref jsonb — no schema/outbox change.
        origin: node.origin ?? null,
      },
      clockTime: clockTime ?? null,
    }));
  // Removing a placed project step must STICK: a plain delete just frees
  // the step for the reflow engine, which re-places it after its quiet
  // window (the plan can't tell "removed" from "never placed"). So a
  // project_node delta is tombstoned in place — origin:'removed' — which
  // hides it everywhere and excludes its step + its gap from the day's
  // plan. Everything else really deletes. USER removals only — the reflow
  // engine reconciles its own stale placements through `hardRemove`
  // below (an engine move must NOT tombstone, or the moved step would be
  // excluded from the very plan that is moving it).
  const removeDelta = (id) => {
    const d = allDeltas.find((x) => x.id === id);
    if (d?.source_type === "project_node") {
      enqueueOp("commitment_update", {
        id,
        fields: {
          sourceRef: { ...(d.source_ref ?? {}), origin: "removed" },
        },
      });
      return;
    }
    enqueueOp("commitment_delete", { id });
  };

  // A real delete, no tombstone — the reflow engine's reconciliation path
  // (dropping a stale auto-placement so its step can land in a new gap, or
  // clearing a duplicate). Never wired to a user-facing remove control.
  const hardRemove = (id) => enqueueOp("commitment_delete", { id });

  // Remove a whole recurring reservation series (S46 follow-up) — every
  // materialised day that shares the `series` id, across the horizon. Looks up
  // the member ids server-side, then deletes each through the outbox so it's
  // offline-safe and consistent with single-day removal. Returns the count.
  const removeSeries = async (seriesId) => {
    if (!seriesId) return 0;
    const { data } = await supabase.from("commitments")
      .select("id")
      .eq("source_type", "reservation")
      .eq("source_ref->>series", seriesId);
    const ids = (data ?? []).map((r) => r.id);
    for (const id of ids) enqueueOp("commitment_delete", { id });
    return ids.length;
  };
  const setDone = (id, done) =>
    enqueueOp("commitment_set_state", { id, state: done ? "done" : "scheduled" });

  // Non-work time (S7) — an off-site / break / appointment / day-off window
  // for a person, stored as a 'reservation' commitment. `start`/`end` are
  // "HH:MM" (end omitted for a day-off, which spans the whole day). An
  // optional `dates` array (S45 multi-day / S46 recurring) materialises one
  // reservation per date; `series` tags them as one group for context.
  const addReservation = ({
    assignee, kind, start, end, label, dates = null, series = null,
  }) =>
    insertEach(dates, () => ({
      sourceType: "reservation", assignee,
      sourceRef: {
        kind, end: end ?? null, label: label ?? null,
        series: series ?? null,
      },
      clockTime: start ?? null,
    }));

  // A buffer (S53/S55/S57) — reserved adjacent time bound to an activity,
  // stored as a `buffer` commitment. `clockTime`/`sourceRef` come prebuilt
  // from buildBuffer (window resolved from the activity's time anchor).
  const addBuffer = ({ clockTime, sourceRef, assignee = null }) => {
    const id = crypto.randomUUID();
    enqueueOp("commitment_insert", {
      id, sourceType: "buffer", assignee,
      sourceRef, runDate: dateISO, clockTime,
    });
    return id;
  };

  // Tick / untick one of a buffer's checklist items (the market-equipment
  // list). Done-state lives in source_ref.checklist; rewritten through the
  // outbox so it's offline-safe.
  const toggleBufferItem = (bufferId, itemId, done) => {
    const buf = deltas.find((d) => d.id === bufferId);
    if (!buf) return;
    const checklist = (buf.source_ref?.checklist ?? []).map((c) =>
      c.id === itemId ? { ...c, done } : c);
    enqueueOp("commitment_update", {
      id: bufferId,
      fields: { sourceRef: { ...buf.source_ref, checklist } },
    });
  };

  // The existing 'override' commitment for a derived instance (a chore that
  // fans out onto the day with no row of its own), keyed by source target.
  const overrideFor = (target) => deltas.find((d) =>
    d.source_type === "override"
    && d.source_ref?.target?.chore_id === target.chore_id
    && (d.source_ref?.target?.place_id ?? null) === (target.place_id ?? null));

  // Merge the jsonb-`overrides` keys a patch may carry (order, cover).
  const mergeOverrides = (base, patch) => {
    const o = { ...(base ?? {}) };
    if ("order" in patch) o.order = patch.order;
    if ("cover" in patch) o.cover = patch.cover;
    return o;
  };

  // Edit a DERIVED chore instance for today only (S63/S71 + S8 cover):
  // upsert an 'override' commitment the assembler renders in the original's
  // place. `patch` = { blockId, clockTime, order, assignee, cover }; blockId
  // is always the resolved target bucket. `entry` is the history record.
  const upsertOverride = (target, patch, entry) => {
    const existing = overrideFor(target);
    if (existing) {
      const sourceRef = { ...existing.source_ref };
      if ("blockId" in patch) sourceRef.block_id = patch.blockId;
      const fields = {
        sourceRef,
        overrides: mergeOverrides(existing.overrides, patch),
        history: [...(existing.history ?? []), entry],
      };
      if ("clockTime" in patch) fields.clockTime = patch.clockTime;
      if ("assignee" in patch) fields.assignee = patch.assignee;
      enqueueOp("commitment_update", { id: existing.id, fields });
      return existing.id;
    }
    const id = crypto.randomUUID();
    const overrides = mergeOverrides(null, patch);
    enqueueOp("commitment_insert", {
      id, sourceType: "override",
      sourceRef: {
        target: { chore_id: target.chore_id, place_id: target.place_id ?? null },
        block_id: patch.blockId ?? null,
      },
      runDate: dateISO,
      clockTime: patch.clockTime ?? null,
      assignee: "assignee" in patch ? patch.assignee : null,
      overrides: Object.keys(overrides).length ? overrides : null,
      history: [entry],
    });
    return id;
  };

  // Edit a commitment-backed row (ad_hoc / chore / note delta) in place
  // (S63/S71/S73 + S8 cover). `patch` may set blockId (rides in
  // source_ref.block_id), clockTime, runDate (cross-day), order, assignee,
  // cover. `entry` is logged.
  const updateDelta = (id, patch, entry) => {
    const existing = deltas.find((d) => d.id === id);
    const fields = { history: [...(existing?.history ?? []), entry] };
    if ("blockId" in patch) {
      fields.sourceRef = { ...(existing?.source_ref ?? {}), block_id: patch.blockId };
    }
    if ("clockTime" in patch) fields.clockTime = patch.clockTime;
    if ("runDate" in patch) fields.runDate = patch.runDate;
    if ("assignee" in patch) fields.assignee = patch.assignee;
    if ("order" in patch || "cover" in patch) {
      fields.overrides = mergeOverrides(existing?.overrides, patch);
    }
    enqueueOp("commitment_update", { id, fields });
  };

  return {
    deltas, removedStepIds, removedGapStarts, loading: serverRows === null,
    addTask, addNote, addChore, addProject, removeDelta, hardRemove, setDone,
    upsertOverride, updateDelta, addReservation, removeSeries,
    addBuffer, toggleBufferItem,
  };
}
