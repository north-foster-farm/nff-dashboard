import { useCallback, useSyncExternalStore } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// chore_modifiers reader/writer (Batch 23 — the table itself shipped
// in Batch 7 and has been waiting for this).
//
//   useChoreModifiers() → {
//     modifiers,        // every modifier row, camelCased
//     loading, error,
//     createModifier({ targetChoreId, occursOn, action,
//                      replacementText, targetPlaceId, priority }),
//     removeModifier(id),
//   }
//
// Unlike the other data hooks, this one is backed by a MODULE-LEVEL
// shared store (useSyncExternalStore) rather than per-mount fetch +
// realtime channel. Modifiers are a tiny app-wide dataset consumed by
// leaf row components across three surfaces (Rounds rows, Chores
// Today rows, Schedule-at-a-glance rollups) — per-mount plumbing would
// mean one fetch + one channel per visible row. Here every mount
// shares one fetch and one realtime subscription for the app's
// lifetime.

const COLS =
  "id, target_chore_id, target_place_id, occurs_on, action, " +
  "replacement_text, priority, source, expires_at, created_by_email, " +
  "process_expansion_id, created_at, updated_at";

function shape(r) {
  return {
    id: r.id,
    targetChoreId: r.target_chore_id,
    targetPlaceId: r.target_place_id,
    occursOn: r.occurs_on,
    action: r.action,
    replacementText: r.replacement_text,
    priority: r.priority ?? 0,
    source: r.source,
    expiresAt: r.expires_at,
    createdByEmail: r.created_by_email,
    processExpansionId: r.process_expansion_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ── The shared store ──────────────────────────────────────────────────
let rawRows = null;     // null = not loaded yet
let snapshot = [];      // shaped projection; reassigned only on change
let storeError = null;
let started = false;
const listeners = new Set();

function notify() {
  for (const l of listeners) l();
}

async function fetchAll() {
  const { data, error } = await supabase
    .from("chore_modifiers").select(COLS);
  if (error) {
    storeError = error;
    notify();
    return;
  }
  rawRows = data ?? [];
  snapshot = rawRows.map(shape);
  notify();
}

function ensureStarted() {
  if (started) return;
  started = true;
  fetchAll();
  // One app-lifetime realtime subscription — deliberately never torn
  // down (there's no "last unmount" to hang teardown on, and the
  // subscription is the entire point of the shared store).
  let scheduled = false;
  const refresh = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; fetchAll(); }, 80);
  };
  realtimeChannel("modifiers:store")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "chore_modifiers" }, refresh)
    .subscribe();
}

function subscribe(listener) {
  ensureStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

// ── The hook ──────────────────────────────────────────────────────────
export function useChoreModifiers() {
  const modifiers = useSyncExternalStore(subscribe, getSnapshot);
  const userEmail = useCurrentUserEmail();

  const createModifier = useCallback(async ({
    targetChoreId, occursOn, action, replacementText = null,
    targetPlaceId = null, priority = 0,
  }) => {
    const { data, error } = await supabase.from("chore_modifiers")
      .insert({
        target_chore_id: targetChoreId,
        target_place_id: targetPlaceId,
        occurs_on: occursOn,
        action,
        replacement_text: replacementText,
        priority,
        source: "manual",
        created_by_email: userEmail,
      })
      .select(COLS)
      .single();
    if (error) throw error;
    await fetchAll();
    return data.id;
  }, [userEmail]);

  const removeModifier = useCallback(async (id) => {
    const { error } = await supabase.from("chore_modifiers")
      .delete().eq("id", id);
    if (error) throw error;
    await fetchAll();
  }, []);

  return {
    modifiers,
    loading: rawRows === null,
    error: storeError,
    createModifier,
    removeModifier,
  };
}
