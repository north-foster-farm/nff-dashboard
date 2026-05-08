import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "../supabase.js";

// Chore assignment rules engine (Batch 12).
//
// One row per rule. Two scopes:
//   'chore' — applies to one chore_definitions row (scope_id is the
//             chore's text id).
//   'block' — applies to every chore in one chore_blocks row (scope_id
//             is the block's uuid, stored as text on this side too).
//
// days_of_week is an int[] of JS-style day numbers (Sun=0…Sat=6).
// assignees is text[] of display names ("James", "Jim").
//
// The hook surfaces:
//   rules               — the live list
//   rulesByChoreId      — Map<choreId, rule[]> of active chore-scoped rules
//   rulesByBlockId      — Map<blockId, rule[]> of active block-scoped rules
//   loading, error
//   createRule(input)
//   updateRule(id, patch)
//   deleteRule(id)

const SELECT_COLS =
  "id, scope, scope_id, days_of_week, assignees, priority, is_active";

export function useChoreAssignmentRules() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    supabase.from("chore_assignment_rules")
      .select(SELECT_COLS)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .then((res) => {
        if (cancelled) return;
        if (res.error) { setError(res.error); setRows([]); return; }
        setRows(res.data ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let scheduled = false;
    const refresh = async () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const res = await supabase.from("chore_assignment_rules")
          .select(SELECT_COLS)
          .order("priority", { ascending: false })
          .order("created_at", { ascending: false });
        if (!res.error) setRows(res.data ?? []);
      }, 80);
    };
    const channel = supabase
      .channel(`chore_assignment_rules:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "chore_assignment_rules" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId]);

  const rules = useMemo(() => (rows ?? []).map(r => ({
    id: r.id,
    scope: r.scope,
    scopeId: r.scope_id,
    daysOfWeek: Array.isArray(r.days_of_week) ? r.days_of_week.slice() : [],
    assignees: Array.isArray(r.assignees) ? r.assignees.slice() : [],
    priority: r.priority ?? 0,
    isActive: r.is_active,
  })), [rows]);

  const rulesByChoreId = useMemo(() => {
    const m = new Map();
    for (const r of rules) {
      if (r.scope !== "chore" || !r.isActive) continue;
      if (!m.has(r.scopeId)) m.set(r.scopeId, []);
      m.get(r.scopeId).push(r);
    }
    return m;
  }, [rules]);

  const rulesByBlockId = useMemo(() => {
    const m = new Map();
    for (const r of rules) {
      if (r.scope !== "block" || !r.isActive) continue;
      if (!m.has(r.scopeId)) m.set(r.scopeId, []);
      m.get(r.scopeId).push(r);
    }
    return m;
  }, [rules]);

  const createRule = useCallback(async ({
    scope, scopeId, daysOfWeek, assignees, priority = 0,
  }) => {
    if (!scope || !scopeId) throw new Error("scope + scopeId required");
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      throw new Error("days_of_week must be a non-empty array");
    }
    if (!Array.isArray(assignees) || assignees.length === 0) {
      throw new Error("assignees must be a non-empty array");
    }
    const sanitizedDays = [...new Set(daysOfWeek.map(Number)
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
      .sort((a, b) => a - b);
    const sanitizedAssignees = [...new Set(assignees.map(s => String(s).trim())
      .filter(Boolean))];
    if (sanitizedDays.length === 0 || sanitizedAssignees.length === 0) {
      throw new Error("rule needs at least one day and one assignee");
    }
    const { data, error: err } = await supabase
      .from("chore_assignment_rules")
      .insert({
        scope,
        scope_id: scopeId,
        days_of_week: sanitizedDays,
        assignees: sanitizedAssignees,
        priority,
      })
      .select()
      .single();
    if (err) throw err;
    setRows((prev) => prev ? [data, ...prev] : prev);
    return data;
  }, []);

  const updateRule = useCallback(async (id, patch) => {
    const dbPatch = {};
    if (Array.isArray(patch.daysOfWeek)) {
      dbPatch.days_of_week = [...new Set(patch.daysOfWeek.map(Number)
        .filter(n => Number.isInteger(n) && n >= 0 && n <= 6))]
        .sort((a, b) => a - b);
    }
    if (Array.isArray(patch.assignees)) {
      dbPatch.assignees = [...new Set(patch.assignees.map(s => String(s).trim())
        .filter(Boolean))];
    }
    if (typeof patch.priority === "number") dbPatch.priority = patch.priority;
    if (typeof patch.isActive === "boolean") dbPatch.is_active = patch.isActive;
    const prev = rows ? [...rows] : null;
    setRows((cur) =>
      cur ? cur.map(r => r.id === id ? { ...r, ...dbPatch } : r) : cur
    );
    const { error: err } = await supabase
      .from("chore_assignment_rules").update(dbPatch).eq("id", id);
    if (err) {
      setRows(prev);
      throw err;
    }
  }, [rows]);

  const deleteRule = useCallback(async (id) => {
    const prev = rows ? [...rows] : null;
    setRows((cur) => cur ? cur.filter(r => r.id !== id) : cur);
    const { error: err } = await supabase
      .from("chore_assignment_rules").delete().eq("id", id);
    if (err) {
      setRows(prev);
      throw err;
    }
  }, [rows]);

  return {
    rules,
    rulesByChoreId,
    rulesByBlockId,
    loading: rows === null,
    error,
    createRule,
    updateRule,
    deleteRule,
  };
}
