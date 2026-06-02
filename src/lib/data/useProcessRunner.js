import { useEffect, useRef } from "react";
import { supabase } from "../supabase.js";
import { useProcessTables } from "./useProcesses.js";
import {
  planExpansions, splitSteps, expansionProjectTitle, occurrenceIsCurrent,
} from "../processes.js";

// The process expansion engine (Batch 23). Mounted once in App.jsx.
//
// Watches active processes + the events slice; whenever an upcoming
// occurrence of a linked event kind has no expansion yet, it expands:
//
//   1. insert process_expansions      ← the idempotency guard. The
//      unique (process_id, series_id, occurs_on) constraint means two
//      clients racing produce exactly one expansion; the loser's
//      insert conflicts and it skips.
//   2. insert a project (+ one phase + a step per task-type process
//      step, dated event date + offset_days)
//   3. project_links  (project → its anchor event series)
//   4. event_links    (series → project, role 'process')
//   5. chore_modifiers for modifier-type steps (source 'process')
//      + event_links (series → chore, role 'process_modifier') so the
//      modifier shows from the event side too
//   6. write everything created back onto the expansion row, so
//      dismissal can tombstone exactly that set
//
// All writes are sequential client-side inserts — same trade-off as
// the rest of the app's data layer. A failure mid-expansion leaves the
// expansion row present (so it won't re-run) with whatever `created`
// ids made it; the Processes page surfaces expansion rows so a partial
// one is visible rather than silent.

export function useProcessRunner(data) {
  const { tables, fetchAll } = useProcessTables();
  // Re-entrancy lock: planning re-fires whenever tables/data update,
  // including the updates our own writes cause. The lock keeps a
  // single in-flight run per client.
  const running = useRef(false);

  useEffect(() => {
    if (!tables || !data?.events?.kinds) return;
    if (running.current) return;

    const plans = planExpansions({
      processes: tables.processes,
      steps: tables.steps,
      kindLinks: tables.kindLinks,
      expansions: tables.expansions,
      events: data.events,
    });
    if (plans.length === 0) return;

    running.current = true;
    (async () => {
      try {
        for (const plan of plans) {
          if (!occurrenceIsCurrent(plan.occursOn)) continue;
          await expandOne(plan);
        }
      } catch (err) {
        // Non-fatal: the next data refresh retries anything unplanned.
        console.error("[processes] expansion failed:", err);
      } finally {
        running.current = false;
        fetchAll();
      }
    })();
  }, [tables, data, fetchAll]);
}

async function expandOne(plan) {
  const { process, steps, occurrence } = plan;

  // ── 1. idempotency guard ────────────────────────────────────────────
  const { data: expansion, error: expErr } = await supabase
    .from("process_expansions")
    .insert({
      process_id: process.id,
      series_id: occurrence.instanceId,
      occurs_on: occurrence.date,
      summary: plan.summary,
    })
    .select("id")
    .single();
  if (expErr) {
    // 23505 = unique violation → another client already expanded this.
    if (expErr.code === "23505") return;
    throw expErr;
  }

  const created = { project_id: null, modifier_ids: [], link_ids: [] };
  const { tasks, modifiers } = splitSteps(steps, occurrence.date);

  // ── 2. project + phase + steps ──────────────────────────────────────
  if (tasks.length > 0) {
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .insert({
        title: expansionProjectTitle(process, occurrence),
        description: process.description,
        status: "in_progress",
        target_date: occurrence.date,
        created_by: "process",
        process_expansion_id: expansion.id,
      })
      .select("id")
      .single();
    if (projErr) throw projErr;
    created.project_id = project.id;

    const { data: phase, error: phaseErr } = await supabase
      .from("project_phases")
      .insert({
        project_id: project.id,
        title: process.title,
        target_date: occurrence.date,
      })
      .select("id")
      .single();
    if (phaseErr) throw phaseErr;

    const stepRows = tasks.map((t, i) => ({
      project_id: project.id,
      phase_id: phase.id,
      title: t.title,
      body_md: t.bodyMd ?? null,
      target_date: t.targetDate,
      sort_order: i,
      assignees: [],
    }));
    const { error: stepsErr } = await supabase
      .from("project_steps").insert(stepRows);
    if (stepsErr) throw stepsErr;

    // ── 3. project → event link ───────────────────────────────────────
    const { error: plinkErr } = await supabase.from("project_links")
      .insert({
        project_id: project.id,
        target_kind: "event_series",
        target_id: occurrence.instanceId,
        label: occurrence.instanceLabel,
      });
    if (plinkErr) throw plinkErr;

    // ── 4. event → project link ───────────────────────────────────────
    const { data: elink, error: elinkErr } = await supabase
      .from("event_links")
      .insert({
        series_id: occurrence.instanceId,
        target_type: "project",
        target_id: project.id,
        role: "process",
      })
      .select("id")
      .single();
    if (elinkErr) throw elinkErr;
    created.link_ids.push(elink.id);
  }

  // ── 5. chore modifiers ──────────────────────────────────────────────
  for (const mod of modifiers) {
    const { data: row, error: modErr } = await supabase
      .from("chore_modifiers")
      .insert({
        target_chore_id: mod.targetChoreId,
        occurs_on: mod.occursOn,
        action: mod.action,
        replacement_text: mod.replacementText,
        priority: mod.priority,
        source: "process",
        process_expansion_id: expansion.id,
      })
      .select("id")
      .single();
    if (modErr) throw modErr;
    created.modifier_ids.push(row.id);

    const { data: mlink, error: mlinkErr } = await supabase
      .from("event_links")
      .insert({
        series_id: occurrence.instanceId,
        target_type: "chore",
        target_id: mod.targetChoreId,
        role: "process_modifier",
      })
      .select("id")
      .single();
    if (mlinkErr) throw mlinkErr;
    created.link_ids.push(mlink.id);
  }

  // ── 6. record what was created ──────────────────────────────────────
  const { error: doneErr } = await supabase
    .from("process_expansions")
    .update({ created })
    .eq("id", expansion.id);
  if (doneErr) throw doneErr;
}
