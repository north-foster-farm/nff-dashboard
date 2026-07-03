import { useEffect, useRef } from "react";
import { supabase } from "../supabase.js";
import { useProcessTables } from "./useProcesses.js";
import {
  planExpansions, splitSteps, processChoreRow, occurrenceIsCurrent,
  processAppliesToSpecies,
} from "../processes.js";

// The process expansion engine (Batch 23; reworked in the 0025
// automations rework). Mounted once in App.jsx.
//
// Watches active processes + the events slice; whenever an upcoming
// occurrence of a linked event kind has no expansion yet, it expands:
//
//   1. insert process_expansions      ← the idempotency guard. The
//      unique (process_id, series_id, occurs_on) constraint means two
//      clients racing produce exactly one expansion; the loser's
//      insert conflicts and it skips.
//   2. insert one-time chore_definitions — one per chore-kind process
//      step, built from the step's full chore template (block, time
//      window, deadline, assignment, place), dated event date +
//      offset_days, with the concrete batch/species anchor resolved from
//      the event. (Pre-0025 this created a project + steps; James's
//      call: prep work is chores, not a project.)
//   3. event_links    (series → each chore, role 'process')
//   4. chore_modifiers for modifier-type steps (source 'process')
//      + event_links (series → chore, role 'process_modifier') so the
//      modifier shows from the event side too
//   5. write everything created back onto the expansion row, so
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

  // ── 0. resolve the anchor batch + species ───────────────────────────
  // A process may be scoped to one species (F20). Both broiler and
  // layer arrivals share the batch_milestones kind, so the kind link
  // can't distinguish them — resolve the anchor batch's species and
  // skip before writing anything if a scoped process doesn't match.
  // (These are also the anchor context the chore steps need.)
  const batchLink = await resolveBatchLink(occurrence.instanceId);
  const speciesId = batchLink
    ? await resolveSpecies(batchLink.targetId)
    : null;
  if (!processAppliesToSpecies(process, speciesId)) return;

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

  const created = { chore_ids: [], modifier_ids: [], link_ids: [] };
  const { chores, modifiers } = splitSteps(steps, occurrence.date);

  // ── 2. one-time chores ──────────────────────────────────────────────
  if (chores.length > 0) {
    // The anchor context (batchLink + species, resolved in step 0) lets
    // a step's 'batch'/'species' anchor resolve to a concrete id so the
    // chores show on the batch page and in batch-scoped rounds.
    // Floor for the never-null block_id guarantee (Phase 0 soft policy).
    const { data: morningBlock } = await supabase
      .from("chore_blocks")
      .select("id")
      .eq("slug", "morning")
      .maybeSingle();
    const morningBlockId = morningBlock?.id ?? null;

    for (let i = 0; i < chores.length; i++) {
      const row = processChoreRow({
        expansionId: expansion.id,
        chore: chores[i],
        index: i,
        process,
        occurrence,
        batchLink,
        speciesId,
        morningBlockId,
      });
      const { data: inserted, error: choreErr } = await supabase
        .from("chore_definitions")
        .upsert(row, { onConflict: "id", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();
      if (choreErr) throw choreErr;
      const choreId = inserted?.id ?? row.id;
      created.chore_ids.push(choreId);

      // ── 3. event → chore link ─────────────────────────────────────
      const { data: elink, error: elinkErr } = await supabase
        .from("event_links")
        .insert({
          series_id: occurrence.instanceId,
          target_type: "chore",
          target_id: choreId,
          role: "process",
        })
        .select("id")
        .single();
      if (elinkErr) throw elinkErr;
      created.link_ids.push(elink.id);
    }
  }

  // ── 4. chore modifiers ──────────────────────────────────────────────
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

  // ── 5. record what was created ──────────────────────────────────────
  const { error: doneErr } = await supabase
    .from("process_expansions")
    .update({ created })
    .eq("id", expansion.id);
  if (doneErr) throw doneErr;
}

// The batch this event anchors to (event_links, target_type 'batch').
// Processing days created with the batch picker and arrival events both
// carry one; calendar events like a farmers market do not.
async function resolveBatchLink(seriesId) {
  const { data } = await supabase
    .from("event_links")
    .select("id, target_id")
    .eq("series_id", seriesId)
    .eq("target_type", "batch")
    .limit(1);
  return data?.[0] ? { targetId: data[0].target_id } : null;
}

async function resolveSpecies(batchId) {
  const { data } = await supabase
    .from("livestock_groups")
    .select("species_id")
    .eq("id", batchId)
    .maybeSingle();
  return data?.species_id ?? null;
}
