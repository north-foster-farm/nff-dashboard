import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { resolveBlockMinutes } from "../sunTimes.js";

// Loads chore_runs for today + a rolling history window and exposes
// lifecycle mutations for the Rounds takeover.
//
// "Today" is the calendar date in the user's local timezone. A run
// row is identified by (block_id, run_date). We materialize the row
// lazily — Start rounds is what creates it, and All done flips it
// to state='done'. Cancel-current flips it to state='canceled'.
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
//     loading, error,
//     startRun(block_id) -> run,             // creates / resumes
//     endRun(runId) -> void,                 // state='done'
//     resumeRun(runId) -> void,              // state='in_progress'
//     cancelRun(runId) -> void,              // state='canceled'
//   }

const SELECT_COLS =
  "id, block_id, run_date, state, started_at, ended_at, " +
  "started_by_email, ended_by_email";

export function useChoreRuns({ blocks, historyDays = 7 } = {}) {
  const instanceId = useId();
  const [runs, setRuns] = useState(null);
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
    supabase.from("chore_runs")
      .select(SELECT_COLS)
      .gte("run_date", sinceISO)
      .order("run_date", { ascending: false })
      .order("started_at", { ascending: false })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setRuns([]); return; }
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
        const res = await supabase.from("chore_runs")
          .select(SELECT_COLS)
          .gte("run_date", sinceISO)
          .order("run_date", { ascending: false })
          .order("started_at", { ascending: false });
        if (!res.error) setRuns(res.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`chore_runs:stream:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_runs" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, sinceISO]);

  const shaped = useMemo(() => {
    const list = (runs ?? []).map(r => ({
      id: r.id,
      blockId: r.block_id,
      runDate: r.run_date,
      state: r.state,
      startedAt: r.started_at ? new Date(r.started_at) : null,
      endedAt: r.ended_at ? new Date(r.ended_at) : null,
      startedByEmail: r.started_by_email,
      endedByEmail: r.ended_by_email,
    }));
    const todayRuns = list.filter(r => r.runDate === todayISO);
    const historicalRuns = list.filter(r => r.runDate !== todayISO);
    const runByBlockId = new Map(todayRuns.map(r => [r.blockId, r]));
    const activeRun = todayRuns.find(r => r.state === "in_progress") ?? null;
    return { todayRuns, historicalRuns, runByBlockId, activeRun };
  }, [runs, todayISO]);

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

  // ── Mutations ─────────────────────────────────────────────────────
  const startRun = useCallback(async (blockId) => {
    if (!blockId) throw new Error("Need a blockId to start a run.");
    const email = await getCurrentEmail();
    const existing = shaped.runByBlockId.get(blockId);
    if (existing) {
      // Resume a prior run for this block today.
      const patch = { state: "in_progress" };
      if (!existing.startedAt) {
        patch.started_at = new Date().toISOString();
        patch.started_by_email = email;
      }
      const prev = runs ? [...runs] : null;
      setRuns((cur) =>
        cur ? cur.map(r => r.id === existing.id
          ? { ...r, state: "in_progress",
              started_at: r.started_at ?? patch.started_at,
              started_by_email: r.started_by_email ?? patch.started_by_email,
              ended_at: null, ended_by_email: null }
          : r
        ) : cur
      );
      const { data, error: err } = await supabase
        .from("chore_runs")
        .update({ ...patch, ended_at: null, ended_by_email: null })
        .eq("id", existing.id)
        .select()
        .single();
      if (err) {
        setRuns(prev);
        throw err;
      }
      return data;
    }
    // Create a fresh run for (block, today).
    const startedAt = new Date().toISOString();
    const { data, error: err } = await supabase
      .from("chore_runs")
      .insert({
        block_id: blockId,
        run_date: todayISO,
        state: "in_progress",
        started_at: startedAt,
        started_by_email: email,
      })
      .select()
      .single();
    if (err) throw err;
    setRuns((prev) => prev ? [...prev, data] : prev);
    return data;
  }, [shaped.runByBlockId, runs, todayISO]);

  const endRun = useCallback(async (runId) => {
    const email = await getCurrentEmail();
    const endedAt = new Date().toISOString();
    const prev = runs ? [...runs] : null;
    setRuns((cur) =>
      cur ? cur.map(r => r.id === runId
        ? { ...r, state: "done", ended_at: endedAt, ended_by_email: email }
        : r
      ) : cur
    );
    const { error: err } = await supabase
      .from("chore_runs")
      .update({ state: "done", ended_at: endedAt, ended_by_email: email })
      .eq("id", runId);
    if (err) {
      setRuns(prev);
      throw err;
    }
    // Fire the push trigger (Batch 11.3). Best-effort — the function
    // is idempotent on its own (notified_at lock), so a missed call
    // here just means nobody got notified for this run; the run
    // itself is already persisted.
    fireRunDoneNotification(runId);
  }, [runs]);

  const resumeRun = useCallback(async (runId) => {
    const prev = runs ? [...runs] : null;
    setRuns((cur) =>
      cur ? cur.map(r => r.id === runId
        ? { ...r, state: "in_progress", ended_at: null, ended_by_email: null }
        : r
      ) : cur
    );
    const { error: err } = await supabase
      .from("chore_runs")
      .update({ state: "in_progress", ended_at: null, ended_by_email: null })
      .eq("id", runId);
    if (err) {
      setRuns(prev);
      throw err;
    }
  }, [runs]);

  // Cancel a run that's in progress (or scheduled). Records ended_at
  // so wrap-card math + history list still know when it stopped, but
  // distinguishes cancellation from completion via the state column.
  const cancelRun = useCallback(async (runId) => {
    const email = await getCurrentEmail();
    const endedAt = new Date().toISOString();
    const prev = runs ? [...runs] : null;
    setRuns((cur) =>
      cur ? cur.map(r => r.id === runId
        ? { ...r, state: "canceled", ended_at: endedAt, ended_by_email: email }
        : r
      ) : cur
    );
    const { error: err } = await supabase
      .from("chore_runs")
      .update({ state: "canceled", ended_at: endedAt, ended_by_email: email })
      .eq("id", runId);
    if (err) {
      setRuns(prev);
      throw err;
    }
  }, [runs]);

  return {
    runs: shaped.todayRuns,
    historicalRuns: shaped.historicalRuns,
    runByBlockId: shaped.runByBlockId,
    activeRun: shaped.activeRun,
    nextBlock,
    loading: runs === null,
    error,
    startRun,
    endRun,
    resumeRun,
    cancelRun,
  };
}

// Local-date YYYY-MM-DD (not UTC). chore_runs.run_date is a `date`
// column, no timezone, so we want the user's day.
function isoLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getCurrentEmail() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

// Fire-and-forget POST to the Netlify function that fans out the push.
// Called from endRun; failures are logged but never re-thrown — the
// run-state UPDATE already succeeded by the time we get here, so the
// user-facing flow shouldn't break on a notification miss.
function fireRunDoneNotification(runId) {
  try {
    void fetch("/.netlify/functions/notify-run-done", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId }),
      keepalive: true,
    }).catch((e) => console.warn("[notify-run-done] post failed", e));
  } catch (e) {
    console.warn("[notify-run-done] fetch threw", e);
  }
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
