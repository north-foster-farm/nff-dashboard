import { getEventOccurrences } from "./recurrence.js";
import { shiftISODate } from "./projects.js";
import { formatISODate, formatDate } from "./dates.js";

// processes.js — pure helpers for the Processes subsystem (Batch 23).
//
// A process is a template tied to one or more event kinds. When an
// event occurrence of a linked kind sits within the process's
// lookahead window, the process "expands": a project is created with
// one step per task-type process step (dated event date + offset), and
// chore_modifiers rows are written for modifier-type steps.
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

// Task-type steps become project steps; modifier-type steps become
// chore_modifiers rows. Split a process's steps into the two plans.
export function splitSteps(steps, eventDateISO) {
  const tasks = [];
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
      tasks.push({
        title: step.title,
        bodyMd: step.bodyMd,
        targetDate: onDate,
        sortOrder: step.sortOrder ?? 0,
      });
    }
  }
  return { tasks, modifiers };
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

// The project title an expansion creates.
export function expansionProjectTitle(process, occurrence) {
  return `${process.title} — ${occurrence.instanceLabel}` +
    ` (${formatDate(occurrence.date)})`;
}

// Sanity guard used by the runner: never expand for an occurrence in
// the past (e.g. a stale tab that was open across midnight).
export function occurrenceIsCurrent(occursOn, today = new Date()) {
  return occursOn >= formatISODate(startOfDayUTC(today));
}
