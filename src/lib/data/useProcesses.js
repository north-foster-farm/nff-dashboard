import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Processes data hooks (Batch 23).
//
//   useProcesses() → {
//     processes,        // [{ ...process, steps, kindIds, expansions }]
//     expansions,       // every expansion, newest first
//     activeExpansions, // status === 'active' (the Heads-up subset)
//     loading, error,
//     createProcess / updateProcess / removeProcess / setActive,
//     createStep / updateStep / removeStep,
//     setKinds(processId, kindIds),
//     acknowledgeExpansion(id),
//     dismissExpansion(id, reason),  // tombstones what it created
//   }
//
// The raw-tables fetch is shared with useProcessRunner via
// useProcessTables (exported) so the runner doesn't duplicate the
// realtime plumbing.

const PROCESS_COLS =
  "id, title, description, is_active, lookahead_days, created_by, " +
  "created_at, updated_at";
const STEP_COLS =
  "id, process_id, title, body_md, offset_days, kind, target_chore_id, " +
  "modifier_action, modifier_text, modifier_priority, sort_order, " +
  "created_at, updated_at";
const KIND_LINK_COLS = "id, process_id, event_kind_id, created_at";
const EXPANSION_COLS =
  "id, process_id, series_id, occurs_on, summary, status, created, " +
  "acknowledged_at, acknowledged_by_email, dismissed_at, " +
  "dismissed_reason, dismissed_by_email, expanded_at";

const TABLES = [
  "processes", "process_steps", "process_event_kind_links",
  "process_expansions",
];

function shapeProcess(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    isActive: r.is_active,
    lookaheadDays: r.lookahead_days ?? 60,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapeStep(r) {
  return {
    id: r.id,
    processId: r.process_id,
    title: r.title,
    bodyMd: r.body_md,
    offsetDays: r.offset_days ?? 0,
    kind: r.kind,
    targetChoreId: r.target_chore_id,
    modifierAction: r.modifier_action,
    modifierText: r.modifier_text,
    modifierPriority: r.modifier_priority ?? 10,
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapeKindLink(r) {
  return {
    id: r.id,
    processId: r.process_id,
    eventKindId: r.event_kind_id,
    createdAt: r.created_at,
  };
}

function shapeExpansion(r) {
  return {
    id: r.id,
    processId: r.process_id,
    seriesId: r.series_id,
    occursOn: r.occurs_on,
    summary: r.summary,
    status: r.status,
    created: r.created ?? {},
    acknowledgedAt: r.acknowledged_at,
    acknowledgedByEmail: r.acknowledged_by_email,
    dismissedAt: r.dismissed_at,
    dismissedReason: r.dismissed_reason,
    dismissedByEmail: r.dismissed_by_email,
    expandedAt: r.expanded_at,
  };
}

const bySort = (a, b) =>
  (a.sortOrder - b.sortOrder)
  || (a.offsetDays - b.offsetDays)
  || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

// ── Shared raw-tables fetch (also used by useProcessRunner) ──────────
export function useProcessTables() {
  const instanceId = useId();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [procRes, stepRes, kindRes, expRes] = await Promise.all([
      supabase.from("processes").select(PROCESS_COLS),
      supabase.from("process_steps").select(STEP_COLS),
      supabase.from("process_event_kind_links").select(KIND_LINK_COLS),
      supabase.from("process_expansions").select(EXPANSION_COLS),
    ]);
    const failed = [procRes, stepRes, kindRes, expRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      processes: (procRes.data ?? []).map(shapeProcess),
      steps: (stepRes.data ?? []).map(shapeStep),
      kindLinks: (kindRes.data ?? []).map(shapeKindLink),
      expansions: (expRes.data ?? []).map(shapeExpansion),
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    let channel = realtimeChannel(`processes:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  return { tables, error, fetchAll };
}

// ── Shared mutation helpers ───────────────────────────────────────────
async function dbInsert(table, row, cols) {
  const { data, error } = await supabase.from(table)
    .insert(row).select(cols).single();
  if (error) throw error;
  return data;
}

async function dbUpdate(table, id, patch) {
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) throw error;
}

async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

function processPatch(patch) {
  const out = {};
  if ("title" in patch) out.title = patch.title;
  if ("description" in patch) out.description = patch.description;
  if ("isActive" in patch) out.is_active = patch.isActive;
  if ("lookaheadDays" in patch) out.lookahead_days = patch.lookaheadDays;
  return out;
}

function stepPatch(patch) {
  const out = {};
  if ("title" in patch) out.title = patch.title;
  if ("bodyMd" in patch) out.body_md = patch.bodyMd;
  if ("offsetDays" in patch) out.offset_days = patch.offsetDays;
  if ("kind" in patch) out.kind = patch.kind;
  if ("targetChoreId" in patch) out.target_chore_id = patch.targetChoreId;
  if ("modifierAction" in patch) out.modifier_action = patch.modifierAction;
  if ("modifierText" in patch) out.modifier_text = patch.modifierText;
  if ("modifierPriority" in patch) {
    out.modifier_priority = patch.modifierPriority;
  }
  if ("sortOrder" in patch) out.sort_order = patch.sortOrder;
  return out;
}

// ── useProcesses — the Processes page ─────────────────────────────────
export function useProcesses() {
  const userEmail = useCurrentUserEmail();
  const { tables, error, fetchAll } = useProcessTables();

  const processes = useMemo(() => {
    if (!tables) return [];
    return tables.processes
      .map(p => ({
        ...p,
        steps: tables.steps
          .filter(s => s.processId === p.id).sort(bySort),
        kindIds: tables.kindLinks
          .filter(l => l.processId === p.id)
          .map(l => l.eventKindId),
        expansions: tables.expansions
          .filter(e => e.processId === p.id)
          .sort((a, b) =>
            (b.expandedAt ?? "").localeCompare(a.expandedAt ?? "")),
      }))
      .sort((a, b) =>
        (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  }, [tables]);

  const expansions = useMemo(
    () => (tables?.expansions ?? []).slice().sort((a, b) =>
      (b.expandedAt ?? "").localeCompare(a.expandedAt ?? "")),
    [tables]
  );

  const activeExpansions = useMemo(
    () => expansions.filter(e => e.status === "active"),
    [expansions]
  );

  // ── process CRUD ────────────────────────────────────────────────────
  const createProcess = useCallback(async ({ title, description }) => {
    const trimmed = (title ?? "").trim();
    if (!trimmed) throw new Error("Title required.");
    const data = await dbInsert("processes", {
      title: trimmed,
      description: (description ?? "").trim() || null,
      is_active: false, // new processes start off until configured
      created_by: userEmail,
    }, PROCESS_COLS);
    await fetchAll();
    return data.id;
  }, [userEmail, fetchAll]);

  const updateProcess = useCallback(async (id, patch) => {
    await dbUpdate("processes", id, processPatch(patch));
    await fetchAll();
  }, [fetchAll]);

  const setActive = useCallback(
    (id, isActive) => updateProcess(id, { isActive }),
    [updateProcess]
  );

  const removeProcess = useCallback(async (id) => {
    await dbDelete("processes", id);
    await fetchAll();
  }, [fetchAll]);

  // ── step CRUD ───────────────────────────────────────────────────────
  const createStep = useCallback(async (processId, fields = {}) => {
    const siblings = (tables?.steps ?? [])
      .filter(s => s.processId === processId);
    const maxSort = Math.max(-1, ...siblings.map(s => s.sortOrder));
    const data = await dbInsert("process_steps", {
      process_id: processId,
      title: (fields.title ?? "").trim() || "New step",
      offset_days: fields.offsetDays ?? 0,
      kind: fields.kind ?? "task",
      target_chore_id: fields.targetChoreId ?? null,
      modifier_action: fields.modifierAction ?? null,
      modifier_text: fields.modifierText ?? null,
      sort_order: maxSort + 1,
    }, STEP_COLS);
    await fetchAll();
    return data.id;
  }, [tables, fetchAll]);

  const updateStep = useCallback(async (id, patch) => {
    await dbUpdate("process_steps", id, stepPatch(patch));
    await fetchAll();
  }, [fetchAll]);

  const removeStep = useCallback(async (id) => {
    await dbDelete("process_steps", id);
    await fetchAll();
  }, [fetchAll]);

  // ── kind links ──────────────────────────────────────────────────────
  const setKinds = useCallback(async (processId, kindIds) => {
    const current = (tables?.kindLinks ?? [])
      .filter(l => l.processId === processId);
    const want = new Set(kindIds);
    for (const link of current) {
      if (!want.has(link.eventKindId)) {
        await dbDelete("process_event_kind_links", link.id);
      }
    }
    const have = new Set(current.map(l => l.eventKindId));
    for (const kindId of kindIds) {
      if (!have.has(kindId)) {
        const { error: err } = await supabase
          .from("process_event_kind_links")
          .insert({ process_id: processId, event_kind_id: kindId });
        if (err) throw err;
      }
    }
    await fetchAll();
  }, [tables, fetchAll]);

  // ── expansion lifecycle ─────────────────────────────────────────────
  const acknowledgeExpansion = useCallback(async (id) => {
    await dbUpdate("process_expansions", id, {
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_email: userEmail,
    });
    await fetchAll();
  }, [userEmail, fetchAll]);

  // Dismissal tombstones what the expansion created: chores are
  // retired (0025+ expansions create chores; the legacy project_id
  // path archives the project for pre-0025 rows), the modifier rows
  // are deleted (date-bound overrides; deleting restores normal
  // chores), and the event_links rows are deleted.
  const dismissExpansion = useCallback(async (id, reason) => {
    const expansion = (tables?.expansions ?? []).find(e => e.id === id);
    const created = expansion?.created ?? {};
    for (const choreId of created.chore_ids ?? []) {
      await supabase.from("chore_definitions")
        .update({ retired_at: new Date().toISOString() })
        .eq("id", choreId);
    }
    if (created.project_id) {
      await dbUpdate("projects", created.project_id, {
        archived_at: new Date().toISOString(),
      });
    }
    for (const modId of created.modifier_ids ?? []) {
      await supabase.from("chore_modifiers").delete().eq("id", modId);
    }
    for (const linkId of created.link_ids ?? []) {
      await supabase.from("event_links").delete().eq("id", linkId);
    }
    await dbUpdate("process_expansions", id, {
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_reason: (reason ?? "").trim() || null,
      dismissed_by_email: userEmail,
    });
    await fetchAll();
  }, [tables, userEmail, fetchAll]);

  return {
    processes,
    expansions,
    activeExpansions,
    loading: tables === null,
    error,
    createProcess,
    updateProcess,
    setActive,
    removeProcess,
    createStep,
    updateStep,
    removeStep,
    setKinds,
    acknowledgeExpansion,
    dismissExpansion,
  };
}
