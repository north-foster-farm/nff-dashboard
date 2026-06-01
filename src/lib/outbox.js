import { supabase } from "./supabase.js";

// Device-local, append-only outbox (Batch 16.2; run lifecycle 17).
//
// Every field write (chore completions, run events, mortality counts,
// chore_runs lifecycle) is appended here first; a sync engine then
// pushes ops to Supabase in FIFO order. The UI reads pending ops as an
// overlay on top of server state, so a tick in a dead zone applies
// instantly, survives an app kill (IndexedDB), and syncs when signal
// returns — replacing the old silent-revert-on-network-error behavior.
//
// Conflict policy (per ROADMAP Batch 16.2 — deliberately not a CRDT):
//   - Completions are idempotent row-presence inserts/deletes. A
//     unique violation on replay means another device already did it —
//     that's success, not an error.
//   - Counts (mortality) merge ADDITIVELY: ops carry a delta and the
//     executor applies it against the count read at sync time, so two
//     offline phones each logging "1 dead" sum to 2.
//   - Run events are append-only activity_log rows — at-least-once
//     delivery; the original capture time rides in the payload.
//   - Run lifecycle (Batch 17) is last-write-wins on state, keyed by
//     the natural (block_id, run_date) identity rather than the row
//     uuid, so an offline-started run reconciles cleanly with a run
//     another device created for the same block + day.
//
// Op lifecycle: pending → synced (removed) | failed (kept + surfaced
// in the indicator with retry / discard).

const DB_NAME = "nff-outbox";
const STORE = "ops";
const FLUSH_LOCK = "nff-outbox-flush";
const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 60000;

// ── IndexedDB plumbing ──────────────────────────────────────────────
// Falls back to an in-memory queue when IndexedDB is unavailable
// (some private-browsing modes). Ops won't survive a reload there,
// but the queue + indicator still work for the session.

const hasIDB = typeof indexedDB !== "undefined";
let dbPromise = null;
let memoryOps = [];
let memoryNextId = 1;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbAdd(record) {
  if (!hasIDB) {
    const saved = { ...record, id: memoryNextId++ };
    memoryOps.push(saved);
    return saved;
  }
  const db = await openDb();
  const id = await reqAsPromise(tx(db, "readwrite").add(record));
  return { ...record, id };
}

async function idbGetAll() {
  if (!hasIDB) return [...memoryOps];
  const db = await openDb();
  return reqAsPromise(tx(db, "readonly").getAll());
}

async function idbPut(record) {
  if (!hasIDB) {
    memoryOps = memoryOps.map((o) => (o.id === record.id ? record : o));
    return;
  }
  const db = await openDb();
  await reqAsPromise(tx(db, "readwrite").put(record));
}

async function idbDelete(id) {
  if (!hasIDB) {
    memoryOps = memoryOps.filter((o) => o.id !== id);
    return;
  }
  const db = await openDb();
  await reqAsPromise(tx(db, "readwrite").delete(id));
}

// ── Error classification ────────────────────────────────────────────

// Wrap the plain { message, code, … } objects supabase-js returns into
// real Errors so they can be thrown / classified uniformly.
function asError(e) {
  if (e instanceof Error) return e;
  const err = new Error(e?.message ?? String(e));
  err.code = e?.code;
  err.details = e?.details;
  return err;
}

// Transient (connectivity) vs permanent (constraint / RLS) failures.
// Transient stops the flush pass and schedules a retry; permanent
// marks the op failed and moves on.
function isNetworkError(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  const msg = String(err?.message ?? err ?? "");
  return /failed to fetch|fetch failed|network ?error|load failed|network request failed|connection|timed? ?out/i.test(
    msg
  );
}

const UNIQUE_VIOLATION = "23505";

// ── Op executors ────────────────────────────────────────────────────

const COMPLETION_COLS =
  "id, chore_id, place_id, completion_date, completed_by_email, " +
  "completed_at, notes";

function localDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Fetch the server rows for one chore on one date, optionally scoped
// to a single place. Used to return canonical rows when an insert
// turns out to be a no-op (the row already existed) so subscribers can
// reconcile their local state without waiting for a refetch.
async function selectCompletions(choreId, dateStr, placeId) {
  let q = supabase
    .from("chore_completions")
    .select(COMPLETION_COLS)
    .eq("chore_id", choreId)
    .eq("completion_date", dateStr);
  if (placeId !== undefined) {
    q = placeId == null
      ? q.is("place_id", null)
      : q.eq("place_id", placeId);
  }
  const { data, error } = await q;
  if (error) throw asError(error);
  return data ?? [];
}

// Single completion insert. Idempotent: a unique violation means the
// row already exists (replay, or another device beat us) — return the
// existing row as the result instead of erroring.
async function execCompletionInsert(p) {
  const { data, error } = await supabase
    .from("chore_completions")
    .insert({
      chore_id: p.choreId,
      place_id: p.placeId ?? null,
      completion_date: p.dateStr,
      completed_by_email: p.email,
      ...(p.completedAt ? { completed_at: p.completedAt } : {}),
    })
    .select(COMPLETION_COLS);
  if (!error) return { rows: data ?? [] };
  if (error.code === UNIQUE_VIOLATION) {
    return {
      rows: await selectCompletions(p.choreId, p.dateStr, p.placeId ?? null),
    };
  }
  throw asError(error);
}

// Batched completion insert (toggleMany / "All taken care of").
// Idempotent: select what exists, insert only the missing places. A
// unique-violation race falls back to per-row inserts tolerating
// duplicates. Returns every row covering the requested places —
// pre-existing and newly inserted — so subscribers get canonical
// state either way.
async function execCompletionInsertMany(p) {
  const wanted = new Set((p.placeIds ?? [null]).map((pid) => pid ?? null));
  const existing = await selectCompletions(p.choreId, p.dateStr);
  const have = new Set(existing.map((r) => r.place_id ?? null));
  const missing = [...wanted].filter((pid) => !have.has(pid));
  const covered = existing.filter((r) => wanted.has(r.place_id ?? null));
  if (missing.length === 0) return { rows: covered };
  const rows = missing.map((pid) => ({
    chore_id: p.choreId,
    place_id: pid ?? null,
    completion_date: p.dateStr,
    completed_by_email: p.email,
    ...(p.completedAt ? { completed_at: p.completedAt } : {}),
  }));
  const { data, error } = await supabase
    .from("chore_completions")
    .insert(rows)
    .select(COMPLETION_COLS);
  if (!error) return { rows: [...covered, ...(data ?? [])] };
  if (error.code !== UNIQUE_VIOLATION) throw asError(error);
  // Race: another device inserted between our select and insert. Fall
  // back to per-row inserts, then read back canonical state.
  for (const row of rows) {
    const { error: e2 } = await supabase
      .from("chore_completions")
      .insert(row);
    if (e2 && e2.code !== UNIQUE_VIOLATION) throw asError(e2);
  }
  const finalRows = await selectCompletions(p.choreId, p.dateStr);
  return { rows: finalRows.filter((r) => wanted.has(r.place_id ?? null)) };
}

// Single completion delete. Matching zero rows is still success.
async function execCompletionDelete(p) {
  let q = supabase
    .from("chore_completions")
    .delete()
    .eq("chore_id", p.choreId)
    .eq("completion_date", p.dateStr);
  q = p.placeId == null
    ? q.is("place_id", null)
    : q.eq("place_id", p.placeId);
  const { error } = await q;
  if (error) throw asError(error);
  return { deleted: true };
}

// Delete every completion row for a chore today (uncheck-all).
async function execCompletionDeleteChore(p) {
  const { error } = await supabase
    .from("chore_completions")
    .delete()
    .eq("chore_id", p.choreId)
    .eq("completion_date", p.dateStr);
  if (error) throw asError(error);
  return { deleted: true };
}

// Run event (Note / MASH / Mortality observation) via the SECURITY
// DEFINER RPC. Append-only on the server side.
async function execRunEvent(p) {
  const { data, error } = await supabase.rpc("log_run_event", {
    p_kind: p.kind,
    p_payload: p.payload ?? {},
    p_run_id: p.runId ?? null,
    p_place_id: p.placeId ?? null,
    p_conditions: p.conditions ?? null,
  });
  if (error) throw asError(error);
  return data;
}

// ADDITIVE mortality merge: read the cohort count at sync time and
// subtract the op's delta — never write an absolute count captured
// when the op was queued. Two offline phones each logging "1 dead"
// therefore sum to 2 instead of clobbering each other.
async function execMortalityDecrement(p) {
  const { data: rows, error: selErr } = await supabase
    .from("livestock_groups")
    .select("id, count")
    .eq("id", p.groupId);
  if (selErr) throw asError(selErr);
  const group = rows?.[0];
  if (!group || typeof group.count !== "number") {
    // Cohort gone or uncounted — nothing to decrement; the
    // mortality_observed activity row is the durable record.
    return { skipped: true };
  }
  const next = Math.max(0, group.count - p.delta);
  const { error: updErr } = await supabase
    .from("livestock_groups")
    .update({ count: next })
    .eq("id", p.groupId);
  if (updErr) throw asError(updErr);
  // Auto move-out (Batch 8.3 behavior, applied at sync time): a cohort
  // that empties to zero closes its open placements. Best-effort —
  // never fail the op (and risk a replayed double-decrement) over
  // move-out bookkeeping.
  if (next === 0) {
    await supabase
      .from("placements")
      .update({ moved_out: localDateString(new Date()) })
      .eq("occupant_type", "batch")
      .eq("occupant_id", p.groupId)
      .is("moved_out", null);
  }
  return { count: next };
}

// ── Run lifecycle executors (Batch 17 — hardened Rounds) ───────────
// chore_runs writes go through the outbox so a run can start, finish,
// or cancel with no signal. Updates key off the natural
// (block_id, run_date) identity instead of the row uuid: an offline-
// created run carries a client-generated uuid that may lose the race
// to a row another device inserted for the same block + day, and the
// natural key makes every later op land on whichever row won.

const RUN_COLS =
  "id, block_id, run_date, state, started_at, ended_at, " +
  "started_by_email, ended_by_email";

async function selectRun(blockId, runDate) {
  const { data, error } = await supabase
    .from("chore_runs")
    .select(RUN_COLS)
    .eq("block_id", blockId)
    .eq("run_date", runDate);
  if (error) throw asError(error);
  return data?.[0] ?? null;
}

// Start (or resume) a run. Insert with the client-generated id; a
// unique violation — on the pkey (replay of our own op) or on the
// (block_id, run_date) index (another device created today's run) —
// downgrades to an UPDATE of the existing row.
async function execRunStart(p) {
  const { data, error } = await supabase
    .from("chore_runs")
    .insert({
      id: p.id,
      block_id: p.blockId,
      run_date: p.runDate,
      state: "in_progress",
      started_at: p.startedAt,
      started_by_email: p.email,
    })
    .select(RUN_COLS);
  if (!error) return { run: data?.[0] ?? null };
  if (error.code !== UNIQUE_VIOLATION) throw asError(error);
  const existing = await selectRun(p.blockId, p.runDate);
  if (!existing) throw asError(error);
  const patch = { state: "in_progress", ended_at: null, ended_by_email: null };
  if (!existing.started_at) {
    patch.started_at = p.startedAt;
    patch.started_by_email = p.email;
  }
  const { data: updated, error: updErr } = await supabase
    .from("chore_runs")
    .update(patch)
    .eq("id", existing.id)
    .select(RUN_COLS);
  if (updErr) throw asError(updErr);
  return { run: updated?.[0] ?? existing };
}

// Shared shape for end / resume / cancel: update by natural key.
// Matching zero rows means the run_start op for this run failed
// permanently — treat as a no-op rather than wedging the queue.
async function updateRunByKey(p, patch) {
  const { data, error } = await supabase
    .from("chore_runs")
    .update(patch)
    .eq("block_id", p.blockId)
    .eq("run_date", p.runDate)
    .select(RUN_COLS);
  if (error) throw asError(error);
  return { run: data?.[0] ?? null };
}

async function execRunEnd(p) {
  const result = await updateRunByKey(p, {
    state: "done",
    ended_at: p.endedAt,
    ended_by_email: p.email,
  });
  // Fire the push trigger (Batch 11.3) at sync time — the run is now
  // actually persisted. Best-effort; the function is idempotent on its
  // own (notified_at lock).
  if (result.run) fireRunDoneNotification(result.run.id);
  return result;
}

function execRunResume(p) {
  return updateRunByKey(p, {
    state: "in_progress",
    ended_at: null,
    ended_by_email: null,
  });
}

function execRunCancel(p) {
  return updateRunByKey(p, {
    state: "canceled",
    ended_at: p.endedAt,
    ended_by_email: p.email,
  });
}

// Fire-and-forget POST to the Netlify function that fans out the
// run-done push. Failures are logged but never re-thrown — the run
// state UPDATE already succeeded by the time this is called.
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

const EXECUTORS = {
  completion_insert: execCompletionInsert,
  completion_insert_many: execCompletionInsertMany,
  completion_delete: execCompletionDelete,
  completion_delete_chore: execCompletionDeleteChore,
  run_event: execRunEvent,
  mortality_decrement: execMortalityDecrement,
  run_start: execRunStart,
  run_end: execRunEnd,
  run_resume: execRunResume,
  run_cancel: execRunCancel,
};

// ── Queue state + subscriptions ─────────────────────────────────────

let ops = []; // in-memory mirror of the IDB store, sorted by id
let listeners = new Set();
let syncing = false;
let initPromise = null;
let flushTimer = null;
let retryDelayMs = BASE_RETRY_MS;
let triggersWired = false;

function notify(event) {
  for (const fn of listeners) {
    try {
      fn(event);
    } catch {
      // A broken listener must never break the queue.
    }
  }
}

export function subscribeOutbox(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function outboxOps() {
  return ops;
}

export function outboxSyncing() {
  return syncing;
}

function scheduleFlush(delayMs) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushOutbox();
  }, delayMs);
}

function scheduleRetry() {
  scheduleFlush(retryDelayMs);
  retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
}

function wireGlobalTriggers() {
  if (triggersWired || typeof window === "undefined") return;
  triggersWired = true;
  window.addEventListener("online", () => {
    retryDelayMs = BASE_RETRY_MS;
    scheduleFlush(0);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleFlush(0);
  });
}

// Load persisted ops (from a previous session, possibly killed while
// offline) and start syncing them. Safe to call repeatedly.
export function initOutbox() {
  if (!initPromise) {
    initPromise = (async () => {
      wireGlobalTriggers();
      try {
        ops = await idbGetAll();
      } catch {
        ops = [];
      }
      ops.sort((a, b) => a.id - b.id);
      notify({ type: "init" });
      if (ops.some((o) => o.status === "pending")) scheduleFlush(0);
    })();
  }
  return initPromise;
}

// Append an op. This is the only write entry point — callers never
// talk to Supabase directly for field writes anymore.
export async function enqueueOp(opKind, payload) {
  await initOutbox();
  const record = {
    opKind,
    payload,
    status: "pending",
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  const saved = await idbAdd(record);
  ops.push(saved);
  notify({ type: "enqueued", op: saved });
  scheduleFlush(0);
  return saved;
}

// ── Sync engine ─────────────────────────────────────────────────────

export async function flushOutbox() {
  await initOutbox();
  if (syncing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // No point trying — the 'online' listener will call us back.
    return;
  }
  if (!ops.some((o) => o.status === "pending")) return;
  syncing = true;
  notify({ type: "flush-start" });
  let networkBlocked = false;
  try {
    // The Web Locks API serializes flushes across tabs so two open
    // tabs don't both replay the same op (which would double-log run
    // events). Falls back to unguarded flush where unsupported.
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      await navigator.locks.request(FLUSH_LOCK, async () => {
        networkBlocked = await flushPass();
      });
    } else {
      networkBlocked = await flushPass();
    }
  } finally {
    syncing = false;
    notify({ type: "flush-end" });
    if (ops.some((o) => o.status === "pending")) {
      // Connectivity failure → back off. Ops that arrived mid-flush →
      // go again right away.
      if (networkBlocked) scheduleRetry();
      else scheduleFlush(0);
    } else {
      retryDelayMs = BASE_RETRY_MS;
    }
  }
}

// Returns true when the pass stopped early on a connectivity failure
// (so the caller backs off) vs. completing normally.
async function flushPass() {
  // Re-read inside the lock so the mirror reflects what other tabs
  // already synced (their deletes aren't in our memory copy).
  ops = await idbGetAll();
  ops.sort((a, b) => a.id - b.id);
  for (const op of [...ops]) {
    if (op.status !== "pending") continue;
    let result;
    try {
      const exec = EXECUTORS[op.opKind];
      if (!exec) throw new Error(`Unknown outbox op kind: ${op.opKind}`);
      result = await exec(op.payload);
    } catch (err) {
      if (isNetworkError(err)) {
        // Transient: stop the pass, leave everything pending; the
        // caller schedules a backoff retry.
        return true;
      }
      op.status = "failed";
      op.lastError = String(err?.message ?? err);
      op.attempts += 1;
      await idbPut(op);
      notify({ type: "failed", op });
      continue;
    }
    await idbDelete(op.id);
    ops = ops.filter((o) => o.id !== op.id);
    notify({ type: "synced", op, result });
  }
  return false;
}

// ── Failed-op management (surfaced by the indicator) ───────────────

export async function retryFailedOps() {
  await initOutbox();
  for (const op of ops) {
    if (op.status === "failed") {
      op.status = "pending";
      op.lastError = null;
      await idbPut(op);
    }
  }
  notify({ type: "changed" });
  scheduleFlush(0);
}

export async function discardFailedOps() {
  await initOutbox();
  const failed = ops.filter((o) => o.status === "failed");
  for (const op of failed) {
    await idbDelete(op.id);
  }
  ops = ops.filter((o) => o.status !== "failed");
  notify({ type: "changed" });
}
