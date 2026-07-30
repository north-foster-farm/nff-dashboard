import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";
import { resolveBlockMinutes } from "../sunTimes.js";
import {
  enqueueOp, initOutbox, outboxOps, subscribeOutbox,
} from "./outbox.js";

// Loads block-run commitments (`commitments`,
// `source_type='chore_block'`) for today + a rolling history window and exposes
// lifecycle mutations for the Rounds takeover.
//
// "Today" is the calendar date in the user's local timezone. A run
// row is identified by (block_id, run_date). We materialize the row
// lazily — Start rounds is what creates it, and All done flips it
// to state='done'. Cancel-current flips it to state='canceled'.
//
// Outbox-backed (Batch 17 — hardened Rounds): mutations never call
// Supabase directly. Each one appends an op to the device-local outbox
// (lib/data/outbox.js); displayed state is the server rows (initial load +
// realtime) overlaid with the queue's not-yet-synced ops, so starting,
// finishing, or canceling a run works with no signal and survives an
// app kill. Offline-created runs carry a client-generated uuid; the
// sync executors reconcile against the natural (block_id, run_date)
// key so they merge cleanly with rows other devices created.
//
// Returned shape:
//   {
//     runs:           today's runs,
//     historicalRuns: yesterday-and-back, up to historyDays,
//     runByBlockId:   Map<block_id, run>,    // today's runs only
//     activeRun:      the currently-in_progress run, or null,
//     nextBlock:      the next block whose run hasn't been done yet,
//                     or null. Resolves to the one whose window is
//                     open now if any; otherwise the soonest future
//                     start.
//     participantsByRunId: Map<runId, [{userEmail, finishedAt, …}]>,
//     loading, error,
//     startRun(block_id) -> run,             // creates / resumes
//     endRun(runId, {endedAt}) -> void,      // state='done'
//     finishRun(runId) -> {ended, waitingOn} // multi-person finish
//     joinRun(runId) -> void,                // participant upsert
//     resumeRun(runId) -> void,              // state='in_progress'
//     cancelRun(runId) -> {ended, waitingOn} // gated like finishRun
//   }
//
// Lifecycle guarantees (chore-ux fix, 2026-06): an in_progress run is
// swept to done when a later block starts or the day rolls over, and
// re-starting a finished run resets its clock.

const SELECT_COLS =
  "id, block_id, run_date, state, started_at, ended_at, " +
  "started_by_email, ended_by_email";

const RUN_OP_KINDS = new Set([
  "run_start", "run_end", "run_resume", "run_cancel", "run_delete",
]);

// Natural-key map key for a run.
function runKey(blockId, runDate) {
  return `${blockId}|${runDate}`;
}

// Replay not-yet-synced run ops over the server rows. Returns a
// Map<runKey, snake_case row> — synthetic rows for offline-created
// runs, patched rows for offline state flips.
function applyRunOps(serverRows, ops) {
  const byKey = new Map();
  for (const r of serverRows) byKey.set(runKey(r.block_id, r.run_date), r);
  for (const op of ops) {
    if (op.status !== "pending" && op.status !== "failed") continue;
    if (!RUN_OP_KINDS.has(op.opKind)) continue;
    const p = op.payload;
    const key = runKey(p.blockId, p.runDate);
    const existing = byKey.get(key);
    switch (op.opKind) {
      case "run_start": {
        if (existing) {
          // Re-starting a finished (done / canceled) run resets the
          // clock — same rule as the outbox executor (execRunStart).
          const isRestart =
            existing.state === "done" || existing.state === "canceled";
          byKey.set(key, {
            ...existing,
            state: "in_progress",
            started_at: isRestart
              ? p.startedAt
              : (existing.started_at ?? p.startedAt),
            started_by_email: isRestart
              ? p.email
              : (existing.started_by_email ?? p.email),
            ended_at: null,
            ended_by_email: null,
          });
        } else {
          byKey.set(key, {
            id: p.id,
            block_id: p.blockId,
            run_date: p.runDate,
            state: "in_progress",
            started_at: p.startedAt,
            ended_at: null,
            started_by_email: p.email,
            ended_by_email: null,
          });
        }
        break;
      }
      case "run_end":
        if (existing) {
          byKey.set(key, {
            ...existing,
            state: "done",
            ended_at: p.endedAt,
            ended_by_email: p.email,
          });
        }
        break;
      case "run_resume":
        if (existing) {
          byKey.set(key, {
            ...existing,
            state: "in_progress",
            ended_at: null,
            ended_by_email: null,
          });
        }
        break;
      case "run_cancel":
        if (existing) {
          byKey.set(key, {
            ...existing,
            state: "canceled",
            ended_at: p.endedAt,
            ended_by_email: p.email,
          });
        }
        break;
      case "run_delete":
        byKey.delete(key);
        break;
      default:
        break;
    }
  }
  return byKey;
}

export function useChoreRuns({ blocks, historyDays = 7 } = {}) {
  const instanceId = useId();
  const [runs, setRuns] = useState(null);
  // Bumped on any outbox change touching run ops so the overlay
  // recomputes; the ops themselves are read from the module mirror.
  const [outboxTick, setOutboxTick] = useState(0);
  const [error, setError] = useState(null);

  const todayISO = useMemo(() => isoLocalDate(new Date()), []);
  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - historyDays);
    return isoLocalDate(d);
  }, [historyDays]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("commitments")
      .select(SELECT_COLS)
      .eq("source_type", "chore_block")
      .gte("run_date", sinceISO)
      .order("run_date", { ascending: false })
      .order("started_at", { ascending: false })
      .then((res) => {
        if (cancelled) return;
        if (res.error) {
          // Offline page-load: server state is unknown but the outbox
          // overlay still renders this device's own runs. Treat the
          // server side as empty rather than blocking the UI.
          setError(res.error);
          setRuns([]);
          return;
        }
        setRuns(res.data ?? []);
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
          .order("run_date", { ascending: false })
          .order("started_at", { ascending: false });
        if (!res.error) setRuns(res.data ?? []);
      }, 80);
    };
    const channel = realtimeChannel(`commitments:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "commitments" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, sinceISO]);

  // ── Outbox subscription + synced-op reconciliation ────────────────
  // When a run op lands on the server, fold its confirmed row straight
  // into the server rows so state never flickers in the gap before the
  // realtime echo.
  useEffect(() => {
    let cancelled = false;
    initOutbox().then(() => {
      if (cancelled) return;
      setOutboxTick((t) => t + 1);
    });
    const unsub = subscribeOutbox((event) => {
      if (event?.type === "synced" && RUN_OP_KINDS.has(event.op?.opKind)) {
        const confirmed = event.result?.run;
        if (confirmed) {
          setRuns((prev) => {
            if (!prev) return prev;
            const key = runKey(confirmed.block_id, confirmed.run_date);
            const without = prev.filter(
              (r) => runKey(r.block_id, r.run_date) !== key
            );
            return [...without, confirmed];
          });
        }
      }
      setOutboxTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const shaped = useMemo(() => {
    // Server rows + outbox overlay → effective rows.
    void outboxTick; // dependency: recompute when the queue changes
    const merged = applyRunOps(runs ?? [], outboxOps());
    const list = [...merged.values()].map(r => ({
      id: r.id,
      blockId: r.block_id,
      runDate: r.run_date,
      state: r.state,
      startedAt: r.started_at ? new Date(r.started_at) : null,
      endedAt: r.ended_at ? new Date(r.ended_at) : null,
      startedByEmail: r.started_by_email,
      endedByEmail: r.ended_by_email,
    }));
    list.sort((a, b) => {
      if (a.runDate !== b.runDate) return a.runDate < b.runDate ? 1 : -1;
      return (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0);
    });
    const todayRuns = list.filter(r => r.runDate === todayISO);
    const historicalRuns = list.filter(r => r.runDate !== todayISO);
    const runByBlockId = new Map(todayRuns.map(r => [r.blockId, r]));
    const activeRun = todayRuns.find(r => r.state === "in_progress") ?? null;
    return { todayRuns, historicalRuns, runByBlockId, activeRun };
  }, [runs, todayISO, outboxTick]);

  // Pick the next block to open: open-now first, otherwise the
  // soonest-future block whose run isn't already done.
  const nextBlock = useMemo(() => {
    if (!blocks || blocks.length === 0) return null;
    const today = new Date();
    const now = today.getHours() * 60 + today.getMinutes();
    const candidates = blocks
      .filter(b => b.isActive)
      .map(b => {
        const start = resolveBlockMinutes(today, b.startKind, b.startMinutes);
        const end = start === null ? null : start + (b.durationMinutes ?? 0);
        const run = shaped.runByBlockId.get(b.id) ?? null;
        return { block: b, start, end, run };
      })
      .filter(c => c.start !== null && c.end !== null);
    // 1. A block whose run is in_progress wins.
    const inProgress = candidates.find(c => c.run?.state === "in_progress");
    if (inProgress) return inProgress;
    // 2. Any block whose window contains "now" and isn't done yet.
    const open = candidates.find(c =>
      now >= c.start && now < c.end && c.run?.state !== "done"
    );
    if (open) return open;
    // 3. The soonest future block whose run isn't done.
    const future = candidates
      .filter(c => c.start > now && c.run?.state !== "done")
      .sort((a, b) => a.start - b.start);
    if (future.length > 0) return future[0];
    // 4. Fallback: any block whose run isn't done, soonest by start.
    const remaining = candidates
      .filter(c => c.run?.state !== "done")
      .sort((a, b) => a.start - b.start);
    return remaining[0] ?? null;
  }, [blocks, shaped.runByBlockId]);

  // All loaded runs (today + history) for the lookups the by-id
  // mutations need.
  const allRuns = useMemo(
    () => [...shaped.todayRuns, ...shaped.historicalRuns],
    [shaped.todayRuns, shaped.historicalRuns]
  );

  // ── Participants (multi-person rounds; direct Supabase) ────────────
  // chore_run_participants tracks who has joined / finished a run.
  // Direct writes (not outbox): multi-person coordination is only
  // meaningful online; a solo offline run ends through run_end as
  // before, never touching this table.
  const [participants, setParticipants] = useState([]);

  const fetchParticipants = useCallback(async () => {
    const runIds = (runs ?? []).map(r => r.id);
    if (runIds.length === 0) { setParticipants([]); return; }
    const { data, error: err } = await supabase
      .from("chore_run_participants")
      .select("run_id, user_email, joined_at, finished_at")
      .in("run_id", runIds);
    if (!err) setParticipants(data ?? []);
  }, [runs]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchParticipants(); }, 80);
    };
    const channel = realtimeChannel(`run_participants:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chore_run_participants" },
        refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchParticipants]);

  const participantsByRunId = useMemo(() => {
    const map = new Map();
    for (const p of participants) {
      const list = map.get(p.run_id) ?? [];
      list.push({
        runId: p.run_id,
        userEmail: p.user_email,
        joinedAt: p.joined_at,
        finishedAt: p.finished_at,
      });
      map.set(p.run_id, list);
    }
    return map;
  }, [participants]);

  // Joining is what opening the doing surface does. Best-effort: if
  // offline, the upsert fails silently and the run behaves solo.
  const joinRun = useCallback(async (runId) => {
    const email = await getSessionEmail();
    if (!email || !runId) return;
    await supabase.from("chore_run_participants")
      .upsert(
        { run_id: runId, user_email: email },
        { onConflict: "run_id,user_email", ignoreDuplicates: true }
      )
      .then(() => fetchParticipants())
      .catch(() => {});
  }, [fetchParticipants]);

  // ── Mutations (outbox-first) ──────────────────────────────────────
  const startRun = useCallback(async (blockId) => {
    if (!blockId) throw new Error("Need a blockId to start a run.");
    const email = await getSessionEmail();
    const existing = shaped.runByBlockId.get(blockId);
    const id = existing?.id ?? newUuid();
    await enqueueOp("run_start", {
      id,
      blockId,
      runDate: todayISO,
      startedAt: new Date().toISOString(),
      email,
    });
    return { id, block_id: blockId, run_date: todayISO };
  }, [shaped.runByBlockId, todayISO]);

  // endedAt override lets the stale-run sweep close yesterday's run at
  // a sane timestamp (start + block duration) instead of "now".
  const endRun = useCallback(async (runId, { endedAt } = {}) => {
    const run = allRuns.find(r => r.id === runId);
    if (!run) throw new Error("Run not found.");
    const email = await getSessionEmail();
    await enqueueOp("run_end", {
      blockId: run.blockId,
      runDate: run.runDate,
      endedAt: endedAt ?? new Date().toISOString(),
      email,
    });
  }, [allRuns]);

  // "I'm done" — the Finish button. Marks this user's participant row
  // finished; the run itself only ends when every joined participant
  // has finished. Returns { ended, waitingOn } so the UI can show
  // "waiting on Jim". Solo runs (or offline, where participants are
  // unknown) end immediately.
  const finishRun = useCallback(async (runId) => {
    const email = await getSessionEmail();
    const others = (participantsByRunId.get(runId) ?? [])
      .filter(p => p.userEmail !== email);
    // Mark me finished (best-effort; offline → solo semantics).
    if (email) {
      await supabase.from("chore_run_participants")
        .upsert(
          {
            run_id: runId,
            user_email: email,
            finished_at: new Date().toISOString(),
          },
          { onConflict: "run_id,user_email" }
        )
        .catch(() => {});
    }
    const stillGoing = others.filter(p => !p.finishedAt);
    if (stillGoing.length > 0) {
      await fetchParticipants();
      return {
        ended: false,
        waitingOn: stillGoing.map(p => p.userEmail),
      };
    }
    await endRun(runId);
    return { ended: true, waitingOn: [] };
  }, [participantsByRunId, fetchParticipants, endRun]);

  const resumeRun = useCallback(async (runId) => {
    const run = allRuns.find(r => r.id === runId);
    if (!run) throw new Error("Run not found.");
    await enqueueOp("run_resume", {
      blockId: run.blockId,
      runDate: run.runDate,
    });
  }, [allRuns]);

  // Cancel a run that's in progress (or scheduled). Records ended_at
  // so wrap-card math + history list still know when it stopped, but
  // distinguishes cancellation from completion via the state column.
  //
  // Same multi-person gating as finishRun: with other active
  // participants, "cancel" just marks this user finished — the round
  // keeps going for everyone else until they end it too.
  const cancelRun = useCallback(async (runId) => {
    const email = await getSessionEmail();
    const others = (participantsByRunId.get(runId) ?? [])
      .filter(p => p.userEmail !== email && !p.finishedAt);
    if (email && others.length > 0) {
      await supabase.from("chore_run_participants")
        .upsert(
          {
            run_id: runId,
            user_email: email,
            finished_at: new Date().toISOString(),
          },
          { onConflict: "run_id,user_email" }
        )
        .catch(() => {});
      await fetchParticipants();
      return { ended: false, waitingOn: others.map(p => p.userEmail) };
    }
    const run = allRuns.find(r => r.id === runId);
    if (!run) throw new Error("Run not found.");
    await enqueueOp("run_cancel", {
      blockId: run.blockId,
      runDate: run.runDate,
      endedAt: new Date().toISOString(),
      email,
    });
    return { ended: true, waitingOn: [] };
  }, [allRuns, participantsByRunId, fetchParticipants]);

  // Delete a run row entirely — cleanup of canceled runs from the cold
  // open's history list. Removes the row rather than flipping state, so
  // the block reads as never-run for that day.
  const deleteRun = useCallback(async (runId) => {
    const run = allRuns.find(r => r.id === runId);
    if (!run) throw new Error("Run not found.");
    await enqueueOp("run_delete", {
      blockId: run.blockId,
      runDate: run.runDate,
    });
  }, [allRuns]);

  // ── Stale-run sweep ─────────────────────────────────────────────────
  // Runs don't get to live forever (the "22 hours and climbing" bug).
  // An in_progress run auto-completes when:
  //   (a) it's from a previous calendar day, or
  //   (b) a later block's start time has arrived today.
  // The chores left undone simply read as overdue everywhere — that's
  // computed from completions, not from the run.
  //
  // ended_at is capped at started_at + the block's window so history
  // durations stay sane. The sweep re-checks every minute while any
  // surface that mounts this hook is open.
  useEffect(() => {
    if (!blocks || blocks.length === 0) return;
    if (runs === null) return;

    const sweep = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const run of allRuns) {
        if (run.state !== "in_progress") continue;
        const block = blocks.find(b => b.id === run.blockId) ?? null;
        let stale = false;
        if (run.runDate < todayISO) {
          stale = true;
        } else if (run.runDate === todayISO && block) {
          const start = resolveBlockMinutes(
            now, block.startKind, block.startMinutes);
          // A later active block has started → this run's time is up.
          stale = blocks.some(b => {
            if (b.id === block.id || !b.isActive) return false;
            const s = resolveBlockMinutes(now, b.startKind, b.startMinutes);
            return s != null && start != null && s > start && nowMin >= s;
          });
        }
        if (!stale) continue;
        // Cap the recorded end at the block window's length.
        const cappedEnd = run.startedAt && block?.durationMinutes
          ? new Date(
              run.startedAt.getTime() + block.durationMinutes * 60_000
            ).toISOString()
          : undefined;
        endRun(run.id, { endedAt: cappedEnd }).catch(() => {});
      }
    };

    sweep();
    const id = setInterval(sweep, 60_000);
    return () => clearInterval(id);
  }, [blocks, runs, allRuns, todayISO, endRun]);

  return {
    runs: shaped.todayRuns,
    historicalRuns: shaped.historicalRuns,
    runByBlockId: shaped.runByBlockId,
    activeRun: shaped.activeRun,
    nextBlock,
    participantsByRunId,
    loading: runs === null,
    error,
    startRun,
    endRun,
    finishRun,
    joinRun,
    resumeRun,
    cancelRun,
    deleteRun,
  };
}

// Local-date YYYY-MM-DD (not UTC). The commitment's run_date is a `date`
// column, no timezone, so we want the user's day.
function isoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// getSession reads the locally-cached session, so this works offline
// too — exactly what the outbox needs (getUser() round-trips to the
// auth server and fails in a dead zone).
async function getSessionEmail() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Client-generated run ids let an offline run exist before the server
// ever hears about it. crypto.randomUUID needs a secure context; the
// fallback covers plain-http LAN testing.
function newUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Format an elapsed milliseconds delta as MM:SS or H:MM:SS.
export function formatElapsed(ms) {
  if (ms < 0 || !Number.isFinite(ms)) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
