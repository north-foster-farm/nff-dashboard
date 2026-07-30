import { getEventOccurrences } from "./recurrence.js";
import { shiftISODate } from "./projects.js";
import { formatISODate, formatDate } from "./dates.js";

// processes.js — pure helpers for the Processes subsystem (Batch 23).
//
// A process is a template tied to one or more event kinds. When an
// event occurrence of a linked kind sits within the process's
// lookahead window, the process "expands": one-time chores are created
// for chore-kind steps from each step's full chore template (dated
// event date + offset; pre-0025 these were project steps), and
// chore_modifiers rows are written for modifier-kind steps.
//
// This module owns the planning math; the actual DB writes live in
// lib/data/useProcessRunner.js. Framework-free and side-effect-free,
// mirroring lib/chores.js / lib/projects.js.

// ── Expansion planning ────────────────────────────────────────────────
//
// planExpansions({ processes, steps, kindLinks, expansions, events })
//   → [{ process, occurrence, occursOn, summary }]
//
// One entry per (active process, upcoming occurrence of a linked kind)
// that has no process_expansions row yet. `events` is data.events (the
// useReferenceData shape getEventOccurrences consumes).
export function planExpansions({
  processes, steps, kindLinks, expansions, events, today = new Date(),
}) {
  if (!events?.kinds) return [];
  const active = (processes ?? []).filter(p => p.isActive);
  if (active.length === 0) return [];

  const expanded = new Set(
    (expansions ?? []).map(e => expansionKey(e.processId, e.seriesId, e.occursOn))
  );

  const plans = [];
  for (const process of active) {
    const kindIds = (kindLinks ?? [])
      .filter(l => l.processId === process.id)
      .map(l => l.eventKindId);
    if (kindIds.length === 0) continue;

    const ownSteps = (steps ?? []).filter(s => s.processId === process.id);
    if (ownSteps.length === 0) continue;

    // Lookahead window: from today to today + lookahead_days. Earlier
    // occurrences (already past) don't expand — there's nothing useful
    // about creating prep work for an event that already happened.
    const from = startOfDayUTC(today);
    const to = new Date(from.getTime());
    to.setUTCDate(to.getUTCDate() + (process.lookaheadDays ?? 60));

    const filters = {};
    for (const kind of events.kinds) {
      filters[kind.id] = kindIds.includes(kind.id);
    }

    for (const occ of getEventOccurrences(events, from, to, filters)) {
      const key = expansionKey(process.id, occ.instanceId, occ.date);
      if (expanded.has(key)) continue;
      plans.push({
        process,
        steps: ownSteps,
        occurrence: occ,
        occursOn: occ.date,
        summary: expansionSummary(process, occ),
      });
    }
  }
  return plans;
}

export function expansionKey(processId, seriesId, occursOn) {
  return `${processId}:${seriesId}:${occursOn}`;
}

export function expansionSummary(process, occurrence) {
  return `${process.title} expanded for ${occurrence.instanceLabel}` +
    ` on ${formatDate(occurrence.date)}`;
}

function startOfDayUTC(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// ── Step → concrete work ──────────────────────────────────────────────

// The date a process step lands on, given its anchor event date.
export function stepDateFor(step, eventDateISO) {
  return shiftISODate(eventDateISO, step.offsetDays ?? 0);
}

// Chore-kind steps become one-time chores; modifier-kind steps become
// chore_modifiers rows. Split a process's steps into the two plans.
// A chore-kind step is a full chore template (block, time window,
// deadline, assignment, place anchor) carried through verbatim — only
// the date (eventDate + offset) and the concrete batch/species anchor
// are resolved later from the bound event.
export function splitSteps(steps, eventDateISO) {
  const chores = [];
  const modifiers = [];
  for (const step of [...steps].sort(bySort)) {
    const onDate = stepDateFor(step, eventDateISO);
    if (step.kind === "chore_modifier") {
      // Inert if the target chore was deleted out from under the step.
      if (!step.targetChoreId) continue;
      modifiers.push({
        targetChoreId: step.targetChoreId,
        occursOn: onDate,
        action: step.modifierAction,
        replacementText: step.modifierText,
        priority: step.modifierPriority ?? 10,
      });
    } else {
      chores.push({
        stepId: step.id,
        title: step.title,
        bodyMd: step.bodyMd,
        targetDate: onDate,
        sortOrder: step.sortOrder ?? 0,
        blockId: step.blockId ?? null,
        lastChanceBlockId: step.lastChanceBlockId ?? null,
        startTime: step.startTime ?? null,
        deadline: step.deadline ?? null,
        assignment: step.assignment ?? null,
        anchorType: step.anchorType ?? "none",
        anchorKindTag: step.anchorKindTag ?? null,
        placeId: step.placeId ?? null,
        atPlaceId: step.atPlaceId ?? null,
      });
    }
  }
  return { chores, modifiers };
}

function bySort(a, b) {
  return (a.sortOrder - b.sortOrder)
    || (a.offsetDays - b.offsetDays)
    || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

// ── Display helpers ───────────────────────────────────────────────────

// "-7" → "7 days before", "0" → "day of", "+1" → "1 day after"
export function describeOffset(offsetDays) {
  const n = offsetDays ?? 0;
  if (n === 0) return "day of";
  const abs = Math.abs(n);
  const unit = abs === 1 ? "day" : "days";
  return n < 0 ? `${abs} ${unit} before` : `${abs} ${unit} after`;
}

// ── Expansion → chores (0025 automations rework; Phase 1 template) ───
// Chore-kind steps become one-time chores, not project steps. Chore ids
// are deterministic per (expansion, step) so a re-run after a partial
// failure conflicts instead of duplicating.

export function processChoreId(expansionId, chore, index) {
  return `process_${expansionId}_${chore.stepId ?? index}`;
}

// The anchor fields for a process chore. A step authors the anchor
// *shape* (anchor_type + place / kind tag); the bound event supplies the
// concrete batch/species id. A step that authored no anchor inherits the
// event's batch (when present) so the chore still surfaces on the batch
// page — the pre-Phase-1 behavior, now the unauthored default rather
// than the only option.
export function resolveChoreAnchor(chore, { batchLink, speciesId } = {}) {
  const authored = chore.anchorType && chore.anchorType !== "none";
  if (!authored) {
    return batchLink
      ? { anchor_type: "batch", anchor_batch_id: batchLink.targetId }
      : { anchor_type: "none" };
  }
  const out = {
    anchor_type: chore.anchorType,
    anchor_kind_tag: chore.anchorKindTag ?? null,
    place_id: chore.placeId ?? null,
    at_place_id: chore.atPlaceId ?? null,
  };
  // former_occupancy resolves like a batch anchor (the brooders THIS
  // batch used), so it also takes the event's batch id.
  if (
    (chore.anchorType === "batch" ||
      chore.anchorType === "former_occupancy") &&
    batchLink
  ) {
    out.anchor_batch_id = batchLink.targetId;
  }
  if (chore.anchorType === "species" && speciesId) {
    out.anchor_species_id = speciesId;
  }
  return out;
}

// The chore_definitions row a chore-kind step expands into. Carries the
// step's full chore template through verbatim — block, time window,
// deadline, assignment, place — and resolves the date from
// eventDate + offset and the anchor from the bound event.
// `morningBlockId` is the floor for the never-null block_id guarantee
// (Phase 0 soft policy): a step should always carry a block (editor
// default + backfill), but if one is somehow missing we resolve morning
// rather than emit a block_id=null chore — the bug this rewrite closes.
export function processChoreRow({
  expansionId, chore, index, process, occurrence,
  batchLink, speciesId, morningBlockId,
}) {
  return {
    id: processChoreId(expansionId, chore, index),
    title: chore.title,
    category: "one_time",
    description: (chore.bodyMd ? chore.bodyMd + "\n\n" : "")
      + `Part of "${process.title}" for ${occurrence.instanceLabel}`
      + ` (${formatDate(occurrence.date)}).`,
    frequency: { type: "once", date: chore.targetDate },
    block_id: chore.blockId ?? morningBlockId ?? null,
    last_chance_block_id: chore.lastChanceBlockId ?? null,
    start_time: chore.startTime ?? null,
    deadline: chore.deadline ?? null,
    assignment: chore.assignment ?? null,
    ...resolveChoreAnchor(chore, { batchLink, speciesId }),
    process_expansion_id: expansionId,
  };
}

// Sanity guard used by the runner: never expand for an occurrence in
// the past (e.g. a stale tab that was open across midnight).
export function occurrenceIsCurrent(occursOn, today = new Date()) {
  return occursOn >= formatISODate(startOfDayUTC(today));
}

// F20: a process may be scoped to a single livestock species. Because
// both broiler and layer arrival events share the batch_milestones
// kind, the kind link alone can't tell them apart — this predicate
// gates expansion on the anchor batch's species. An unscoped process
// (speciesId null) applies to any anchor, including one with no batch
// (e.g. a farmers-market event); a scoped process needs a concrete
// matching species, so it never fires on a batch-less anchor.
export function processAppliesToSpecies(process, speciesId) {
  if (!process?.speciesId) return true;
  return process.speciesId === speciesId;
}

// F22c invariant: a processing day can't exist without a batch — the
// event *is* the processing of some batch. Returns true when a
// processing-kind event still lacks a batch, so callers can block the
// write (creating the event, resolving it in the workspace). Any other
// event kind is never blocked by this rule.
export function processingBatchMissing({ kindId, batchId }) {
  return kindId === "processing_days" && !batchId;
}

// Classify an event's process-work links (event_links rows) for the
// event-side badge. A process expansion emits two kinds of chore link:
// role 'process' = one-time prep chores it *adds*, and
// role 'process_modifier' = edits to an existing chore. Only the latter
// are chore *changes* — the badge must count them apart. Legacy
// project-based expansions (role 'process', target_type 'project') are
// returned untouched so their "open the prep project" link still shows.
export function classifyProcessWork(links) {
  const rows = links ?? [];
  const projectLinks = rows.filter(l => l.target_type === "project");
  const chores = rows.filter(l => l.target_type === "chore");
  return {
    projectLinks,
    prepChoreCount: chores.filter(l => l.role === "process").length,
    modifierCount: chores.filter(l => l.role === "process_modifier").length,
  };
}
