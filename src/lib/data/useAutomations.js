import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";

// Automations (Batch 19): trigger rules + their emissions.
//
//   useAutomations()         — the rules table. Settings renders these
//                              with an enable toggle and editable
//                              trigger_config numbers.
//   useAutomationEmissions() — one row per firing. The dashboard
//                              "Heads up" lane shows status='active'
//                              rows; acknowledging or dismissing (with
//                              a reason) moves them out of the lane.
//
// Both are realtime-subscribed so a firing on another device shows up
// live.

const AUTOMATION_COLS =
  "id, name, trigger_kind, trigger_config, actions, enabled, " +
  "last_fired_at, created_at, updated_at";

const EMISSION_COLS =
  "id, automation_id, fired_at, trigger_payload, summary, status, " +
  "acknowledged_at, acknowledged_by_email, dismissed_at, " +
  "dismissed_reason, dismissed_by_email";

export function useAutomations() {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const res = await supabase.from("automations")
      .select(AUTOMATION_COLS)
      .order("name", { ascending: true });
    if (res.error) { setError(res.error); return; }
    setRows(res.data ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const channel = realtimeChannel(`automations:stream:${instanceId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "automations" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const automations = useMemo(() => (rows ?? []).map(r => ({
    id: r.id,
    name: r.name,
    triggerKind: r.trigger_kind,
    triggerConfig: r.trigger_config ?? {},
    actions: r.actions ?? [],
    enabled: r.enabled,
    lastFiredAt: r.last_fired_at,
  })), [rows]);

  const setEnabled = useCallback(async (id, enabled) => {
    const prev = rows ? [...rows] : null;
    setRows(cur =>
      cur ? cur.map(r => r.id === id ? { ...r, enabled } : r) : cur
    );
    const { error: err } = await supabase
      .from("automations").update({ enabled }).eq("id", id);
    if (err) { setRows(prev); throw err; }
  }, [rows]);

  const updateConfig = useCallback(async (id, triggerConfig) => {
    const prev = rows ? [...rows] : null;
    setRows(cur =>
      cur
        ? cur.map(r =>
            r.id === id ? { ...r, trigger_config: triggerConfig } : r)
        : cur
    );
    const { error: err } = await supabase
      .from("automations")
      .update({ trigger_config: triggerConfig })
      .eq("id", id);
    if (err) { setRows(prev); throw err; }
  }, [rows]);

  return {
    automations,
    loading: rows === null,
    error,
    setEnabled,
    updateConfig,
  };
}

export function useAutomationEmissions({ activeOnly = true } = {}) {
  const instanceId = useId();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    let q = supabase.from("automation_emissions")
      .select(EMISSION_COLS)
      .order("fired_at", { ascending: false })
      .limit(50);
    if (activeOnly) q = q.eq("status", "active");
    const res = await q;
    if (res.error) { setError(res.error); return; }
    setRows(res.data ?? []);
  }, [activeOnly]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    const channel = realtimeChannel(
      `automation_emissions:stream:${instanceId}`
    )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "automation_emissions" },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const emissions = useMemo(() => (rows ?? []).map(r => ({
    id: r.id,
    automationId: r.automation_id,
    firedAt: r.fired_at,
    triggerPayload: r.trigger_payload ?? {},
    summary: r.summary,
    status: r.status,
    acknowledgedAt: r.acknowledged_at,
    dismissedAt: r.dismissed_at,
    dismissedReason: r.dismissed_reason,
  })), [rows]);

  // "Got it" — drops the emission out of the Heads-up lane; the rows
  // it created stay.
  const acknowledge = useCallback(async (emissionId) => {
    const prev = rows ? [...rows] : null;
    setRows(cur => cur ? cur.filter(r => r.id !== emissionId) : cur);
    const { error: err } = await supabase
      .rpc("acknowledge_automation_emission", { p_emission_id: emissionId });
    if (err) { setRows(prev); throw err; }
  }, [rows]);

  // Dismiss with a reason — also tombstones what the firing created
  // (events end + skip, one-time chores retire). Reason is logged.
  const dismiss = useCallback(async (emissionId, reason) => {
    const prev = rows ? [...rows] : null;
    setRows(cur => cur ? cur.filter(r => r.id !== emissionId) : cur);
    const { error: err } = await supabase
      .rpc("dismiss_automation_emission", {
        p_emission_id: emissionId,
        p_reason: reason || null,
      });
    if (err) { setRows(prev); throw err; }
  }, [rows]);

  return {
    emissions,
    loading: rows === null,
    error,
    acknowledge,
    dismiss,
  };
}
