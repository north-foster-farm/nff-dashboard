import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";
import { CHORE_SEEDS } from "../../data/choreSeeds.js";

// Loads activity_log rows ordered most-recent-first, with optional time
// window and row limit. Subscribes to realtime so the dashboard ticker
// updates without a refresh when chores get checked off.
//
// The returned `entries` are pre-shaped to match the existing UI:
//   { id, logTime, actor, summary, kind, payload, edited, ownerEmail }
// — `logTime` is a string (UI parses with `new Date()` already) and
// `actor` / `summary` are the human-readable rendering of the row, so
// neither Activity.jsx nor Overview's ActivityTimeline needs changes.
//
// Returns helpers `edit(entryId, newSummary)` and `remove(entryId)` that
// invoke the SECURITY DEFINER RPCs added in migration 0007. They throw
// on failure (RPC errors, ownership mismatch). The realtime subscription
// reflects the change back into local state automatically; the optimistic
// update path below is just to keep the UI snappy during the round-trip.
export function useActivityLog({ sinceDate, limit } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(null);

  // We freeze sinceDate's wall-clock value into the query key so the
  // effect's dependency array is stable.
  const sinceISO = sinceDate ? sinceDate.toISOString() : null;

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    let q = supabase
      .from("activity_log")
      .select("id, occurred_at, actor_email, kind, payload, edited_summary")
      .order("occurred_at", { ascending: false });
    if (sinceISO) q = q.gte("occurred_at", sinceISO);
    if (typeof limit === "number") q = q.limit(limit);
    q.then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError(error);
        setRows([]);
        return;
      }
      setRows(data);
    });
    return () => { cancelled = true; };
  }, [sinceISO, limit]);

  // Realtime: prepend new rows, replace edited rows, remove deleted rows.
  useEffect(() => {
    const channel = supabase
      .channel(`activity_log:stream:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        (payload) => {
          setRows((prev) => {
            if (!prev) return prev;
            if (sinceISO && payload.new.occurred_at < sinceISO) return prev;
            const next = [payload.new, ...prev];
            return typeof limit === "number" ? next.slice(0, limit) : next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "activity_log" },
        (payload) => {
          setRows((prev) => {
            if (!prev) return prev;
            return prev.map(r => r.id === payload.new.id ? payload.new : r);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "activity_log" },
        (payload) => {
          setRows((prev) => {
            if (!prev) return prev;
            return prev.filter(r => r.id !== payload.old.id);
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sinceISO, limit, instanceId]);

  // ── Mutators ─────────────────────────────────────────────────────────
  const edit = useCallback(async (entryId, newSummary) => {
    // Optimistic local update so the input doesn't snap back during the
    // round-trip. Realtime UPDATE will overwrite on success / a refetch
    // restores on failure.
    setRows((prev) => prev
      ? prev.map(r => r.id === entryId
          ? { ...r, edited_summary: newSummary?.trim() || null }
          : r)
      : prev);
    const { error } = await supabase.rpc("edit_activity_entry", {
      entry_id: entryId,
      new_summary: newSummary
    });
    if (error) throw error;
  }, []);

  const remove = useCallback(async (entryId) => {
    // Optimistic remove.
    let removed = null;
    setRows((prev) => {
      if (!prev) return prev;
      removed = prev.find(r => r.id === entryId) ?? null;
      return prev.filter(r => r.id !== entryId);
    });
    const { error } = await supabase.rpc("delete_activity_entry", {
      entry_id: entryId
    });
    if (error) {
      // Roll back the optimistic remove.
      if (removed) setRows((prev) => (prev ? [removed, ...prev] : prev));
      throw error;
    }
  }, []);

  // Map raw rows into the shape the existing UI expects. Memoized so the
  // identity is stable across renders for downstream React.memo if any.
  const entries = useMemo(
    () => rows ? rows.map(toUIEntry) : null,
    [rows]
  );

  return {
    entries,
    loading: rows === null,
    error,
    edit,
    remove
  };
}

// Render-side translation: row → display tuple. Lives here (not in the UI
// file) so every consumer formats the same way and so kinds are easy to
// add. When a new `kind` lands without a matching renderer we fall back to
// a generic "did something" line that still surfaces actor + time.
function toUIEntry(row) {
  const generated = summarize(row);
  const editedSummary = row.edited_summary?.trim() || null;
  return {
    id: row.id,
    logTime: row.occurred_at,
    actor: actorDisplay(row.actor_email),
    summary: editedSummary ?? generated,
    generatedSummary: generated,
    edited: editedSummary != null,
    ownerEmail: row.actor_email,
    kind: row.kind,
    payload: row.payload
  };
}

// First-name display for the activity ticker. The admins are James and Jim;
// using just the first name keeps the line short. If we ever onboard a
// third admin we'll bind this to admins.display_name instead.
function actorDisplay(email) {
  if (!email) return "Someone";
  const local = email.split("@")[0];
  // james@nff → "James", jim@nff → "Jim"
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function summarize(row) {
  const p = row.payload ?? {};
  switch (row.kind) {
    case "chore_completed": {
      const title = choreTitleFor(p.chore_id) ?? p.chore_id;
      return `completed ${title}`;
    }
    case "chore_uncompleted": {
      const title = choreTitleFor(p.chore_id) ?? p.chore_id;
      return `un-checked ${title}`;
    }
    case "batch_assigned":
      return `assigned batch ${p.batch_id} to processing day ${p.event_instance_id}`;
    case "batch_reassigned":
      return `re-assigned processing day ${p.event_instance_id} to batch ${p.batch_id} (was ${p.previous_batch_id})`;
    case "note_observed": {
      const text = (p.text ?? "").trim();
      if (!text) return "noted something";
      const trimmed = text.length > 80 ? text.slice(0, 77) + "…" : text;
      return `noted: ${trimmed}`;
    }
    case "condition_observed": {
      const states = Array.isArray(p.states) && p.states.length > 0
        ? p.states.join(", ").toLowerCase()
        : "a condition";
      return `flagged ${states}`;
    }
    case "mortality_observed": {
      const count = Number(p.count) || 1;
      const label = p.group_label || p.livestock_group_id || "a cohort";
      const noun = count === 1 ? "loss" : "losses";
      return `logged ${count} ${noun} on ${label}`;
    }
    default:
      return `logged a ${row.kind} entry`;
  }
}

// Look up a chore's display title from the seeds. Once chores live in
// Postgres (Stage 2c) this becomes a join in the query instead.
const CHORE_TITLE_BY_ID = (() => {
  const m = new Map();
  for (const c of CHORE_SEEDS) m.set(c.id, c.title);
  return m;
})();

function choreTitleFor(choreId) {
  if (!choreId) return null;
  return CHORE_TITLE_BY_ID.get(choreId) ?? null;
}
