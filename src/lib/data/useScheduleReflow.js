import { useCallback, useEffect, useMemo } from "react";
import { useChoreBlocks } from "./useChoreBlocks.js";
import { useScheduleDeltas } from "./useScheduleDeltas.js";
import { projectGaps } from "../schedule/partition.js";
import {
  rankedActiveProjects, reflowPlan, reconcilePlan, isStale,
} from "../schedule/reflow.js";
import {
  committedAutoPlacements, manualPlacedStepIds, placementToAddArgs,
} from "../schedule/reflowBridge.js";
import { parseISODate } from "../dates.js";

// useScheduleReflow — the Projects-rework scheduling engine (Slice 2).
//
// Fills a day's project GAPS (projectGaps() — the negative space left by
// chores + events, already trimmed by reservations/buffers) with the
// forced-ranked projects' next incomplete steps, written as `origin:"auto"`
// schedule deltas. Exposes the DERIVED staleness + a manual `syncNow()`.
//
//   useScheduleReflow({ dateISO, projects, autoReflow }) →
//     { stale, planned, committedAuto, plannedCount, syncNow }
//
// `projects` is passed in (the caller — Projects page — already loads them
// with hydrated steps), so we don't double-subscribe useProjects.
//
// SCOPE (this slice): today-only horizon (the planner takes a multi-day
// horizon; widening is a later slice). STALE = the committed auto-
// placements differ from what a fresh reflow of the current ranking would
// produce — so reordering the list flips `stale` true WITHOUT moving
// anything (never silently rearrange); `syncNow()` writes the minimal diff.
//
// AUTO-REFLOW (Slice 4): when `autoReflow` is on (the default), a stale
// schedule auto-syncs after AUTO_REFLOW_MS of quiet — the "automatic
// fallback." The timer resets on every ranking change (the effect re-runs
// when `syncNow`'s identity changes), so rapid planning debounces to a
// single reflow rather than one per change. The manual Sync is always
// instant; turning `autoReflow` off leaves staleness for the user to
// resolve deliberately. Fires only while this hook is mounted (the
// Projects page today); an app-wide mount is a later refinement.
const AUTO_REFLOW_MS = 30_000;

export function useScheduleReflow({ dateISO, projects, autoReflow = true }) {
  const { blocks } = useChoreBlocks();
  const { deltas, removedStepIds, removedGapStarts, addProject, hardRemove } =
    useScheduleDeltas(dateISO);

  const planned = useMemo(() => {
    if (!dateISO) return [];
    const gaps = projectGaps({
      date: parseISODate(dateISO),
      blocks: blocks ?? [],
      reservations: (deltas ?? []).filter(
        (d) => d.source_type === "reservation"),
      buffers: (deltas ?? []).filter(
        (d) => d.source_type === "buffer" && d.source_ref?.scope !== "all"),
    });
    // Excluded from the plan: manually placed steps (they're spoken for)
    // AND steps the user REMOVED from the day (tombstones — a removal must
    // stick; re-placing what was just taken off is the bug, not a sync).
    // A removal also frees its GAP for the day (removedGapStarts): the
    // engine must not slide the next queued step into the cleared slot.
    const exclude = new Set([
      ...manualPlacedStepIds(deltas, dateISO),
      ...(removedStepIds ?? []),
    ]);
    return reflowPlan({
      rankedProjects: rankedActiveProjects(projects),
      gapsByDate: [{ dateISO, gaps }],
      excludeStepIds: exclude,
      excludeGapStarts: removedGapStarts ?? new Set(),
    });
  }, [dateISO, blocks, projects, deltas, removedStepIds, removedGapStarts]);

  const committedAuto = useMemo(
    () => committedAutoPlacements(deltas, dateISO), [deltas, dateISO]);

  const stale = useMemo(
    () => isStale(planned, committedAuto), [planned, committedAuto]);

  // Write the minimal diff: drop stale auto-placements, add the new ones.
  // Manual placements + completed steps are never in either set, so they
  // are untouched. Returns a small summary for a confirmation line.
  // `hardRemove`, NOT removeDelta: the user's remove tombstones (so the
  // removal sticks against future reflows), but the engine reconciling its
  // own stale placement is a MOVE — tombstoning here would exclude the
  // step from the very plan that's moving it, and the step would drop off
  // the day entirely on the next sync.
  const syncNow = useCallback(() => {
    const { toPlace, toRemove } = reconcilePlan({ planned, committedAuto });
    for (const p of toRemove) hardRemove(p.id);
    for (const p of toPlace) addProject(...placementToAddArgs(p));
    return { placed: toPlace.length, removed: toRemove.length };
  }, [planned, committedAuto, addProject, hardRemove]);

  // The automatic fallback: while stale + enabled, sync after a quiet
  // window. `syncNow` changes identity on every ranking change (its deps
  // include `planned`), so this effect re-runs and RESETS the timer —
  // that's the debounce. Clears on unmount / sync / toggle-off.
  useEffect(() => {
    if (!autoReflow || !stale) return undefined;
    const t = setTimeout(() => { syncNow(); }, AUTO_REFLOW_MS);
    return () => clearTimeout(t);
  }, [autoReflow, stale, syncNow]);

  return {
    stale,
    planned,
    committedAuto,
    plannedCount: planned.length,
    syncNow,
  };
}
