// Process seed config — Phase B2 of the chores rebuild
// (.ignored/nff-chores-spec.md §5–§6, plan in
// .ignored/chores-rebuild-reconciliation.md). Source of truth for the
// event-driven PROCESSES that spawn the spec's non-recurring chores.
// Phase C reads this to insert processes / process_steps /
// process_event_kind_links on the live DB (backup-gated, attended). It
// writes no rows itself.
//
// How processes work (migration 0018; engine lib/processes.js +
// lib/data/useProcessRunner.js):
//   * A `process` is a template linked to one or more event kinds. When
//     an occurrence of a linked kind sits inside the lookahead window,
//     the process EXPANDS once (idempotent via process_expansions).
//   * Each `process_step` is either:
//       - kind "task" → spawns one one-time chore on
//         (event date + offset_days). [F85: these are CHORES, not
//         tasks — the legacy "task" name stays until a later migration
//         tightens process_steps.kind once processes are reseeded.]
//       - kind "chore_modifier" → writes a chore_modifiers row that
//         skip/replace/prepend/restrict_until's ONE target chore on
//         (event date + offset_days).
//
// Each task step references a stable `choreId` in EVENT_CHORES
// (choreSeeds.js) — the single source of truth for that chore's title,
// block, place, deadline, checklist, etc. `offsetDays` is read straight
// off the chore's own `trigger.offset` so the two can't drift.
//
// ENGINE GAP (captured for the Processes rebuild — audit F84–F93): the
// CURRENT runner carries only title + body onto the spawned one-time
// chore (period hardcoded "morning", no block / deadline / checklist /
// place / time window). The block/deadline/checklist carry-through is
// engine work; `choreId` is recorded on every step so that upgrade has
// everything it needs to spawn block- and deadline-aware chores and
// attach chore_checklist_items. Until then, mkt-load-vehicle's checklist
// is also rendered into the step body so nothing is lost.
//
// DEFERRED: the six manual-landmark post-return chores (§5.4, §6.3) are
// NOT steps here — landmarks have no engine foundation yet
// (DEFERRED_LANDMARK_CHORES in choreSeeds.js).
//
// PHASE C NOTE: migration 0018 already seeds a disabled "Processing day
// prep" process linked to processing_days with its own 6 task steps.
// The cutover should RETIRE that legacy process in favor of
// "Broiler processing day" below (otherwise both expand on the same
// processing_days occurrences). Exact-id / attended per the prod rules.

import { EVENT_CHORES } from "./choreSeeds.js";

const BY_ID = Object.fromEntries(EVENT_CHORES.map((c) => [c.id, c]));

// Spec event ref → the live event_kind id(s) a process links to.
export const EVENT_KIND_LINKS = {
  processing_day: ["processing_days"],
  farmers_market_or_popup: ["farmers_market", "popup_event"],
};

// A task step built from an EVENT_CHORES entry. offset_days comes from
// the chore's own trigger.offset so the two never drift.
function taskStep(choreId, sortOrder, bodyMd) {
  const c = BY_ID[choreId];
  if (!c) throw new Error(`processSeeds: unknown choreId ${choreId}`);
  return {
    choreId,
    title: c.title,
    bodyMd: bodyMd ?? c.description ?? null,
    offsetDays: c.trigger?.offset ?? 0,
    kind: "task",
    sortOrder,
  };
}

// A chore_modifier (skip) step targeting a recurring chore id on
// (event date + offset_days). modifier_text is null for skips.
function skipStep(targetChoreId, offsetDays, sortOrder) {
  return {
    choreId: null,
    title: `Skip ${targetChoreId} (pre-processing feed withhold)`,
    bodyMd: null,
    offsetDays,
    kind: "chore_modifier",
    targetChoreId,
    modifierAction: "skip",
    modifierText: null,
    modifierPriority: 10,
    sortOrder,
  };
}

// Render a chore checklist into markdown for the step body (interim,
// until process-spawned chores carry chore_checklist_items).
function checklistToMd(items) {
  return (items ?? [])
    .map((i) => `- [ ] ${i.label}${i.optional ? " _(optional)_" : ""}`)
    .join("\n");
}

// ── Step body overrides ──────────────────────────────────────────────
const _load = BY_ID["proc-load-crates"];
const PROC_LOAD_BODY =
  (_load.description ? _load.description + " " : "")
  + `Window ${_load.timeWindow.start}–${_load.timeWindow.end}.`;

const _mkt = BY_ID["mkt-load-vehicle"];
const MKT_LOAD_BODY = "Packing checklist:\n" + checklistToMd(_mkt.checklist);

// ─────────────────────────────────────────────────────────────────────
// PROCESS TEMPLATES
// Seeded DISABLED (isActive: false) — there are real processing-day and
// market events on the schedule; James enables each on the Processes
// page after reviewing. Matches the 0018 seed convention.
// ─────────────────────────────────────────────────────────────────────
export const PROCESS_SEEDS = [
  // ── §5 Processing day ──────────────────────────────────────────────
  {
    key: "broiler_processing_day",
    title: "Broiler processing day",
    description:
      "Everything around a broiler processing day — from staging "
      + "crates the afternoon before, through loading and pickup, to "
      + "resetting the tractors. The day-before feed withhold rides "
      + "along as skip modifiers. Post-return freezer/inventory chores "
      + "are deferred until manual landmarks ship.",
    isActive: false,
    lookaheadDays: 60,
    eventRef: "processing_day",
    eventKindIds: EVENT_KIND_LINKS.processing_day,
    steps: [
      // −1 day before
      taskStep("proc-stage-crates-trailer", 0),
      taskStep("proc-stage-coolers", 1),
      // 0 day of
      taskStep("proc-load-crates", 2, PROC_LOAD_BODY),
      taskStep("proc-pwash-crates", 3),
      taskStep("proc-pwash-deck", 4),
      taskStep("proc-tractor-reset", 5),
      // +1 day after
      taskStep("proc-pickup", 6),
      // §6.1 pre-processing feed withhold — skip the three later tractor
      // feeders the day before (offset −1); the morning feed stands.
      // Mirrors CHORE_MODIFIER_SEEDS.mod-proc-no-feed expressed as the
      // engine's per-target chore_modifier steps.
      skipStep("mm-tractor-feed", -1, 7),
      skipStep("la-tractor-feed", -1, 8),
      skipStep("eod-tractor-feed", -1, 9),
    ],
  },

  // ── §6.3 Farmers market / pop-up ───────────────────────────────────
  {
    key: "farmers_market_or_popup",
    title: "Farmers market / pop-up",
    description:
      "Prep and load-out for a market or pop-up: prep preorders three "
      + "days out, load the vehicle the day before (packing checklist "
      + "in the load step). Post-return inventory/cash-out/sanitize "
      + "chores are deferred until manual landmarks ship.",
    isActive: false,
    lookaheadDays: 60,
    eventRef: "farmers_market_or_popup",
    eventKindIds: EVENT_KIND_LINKS.farmers_market_or_popup,
    steps: [
      taskStep("mkt-prep-preorders", 0),
      taskStep("mkt-load-vehicle", 1, MKT_LOAD_BODY),
    ],
  },
];
