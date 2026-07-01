import { useCallback, useMemo } from "react";
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
//   useScheduleReflow({ dateISO, projects }) →
//     { stale, planned, committedAuto, plannedCount, syncNow }
//
// `projects` is passed in (the caller — Projects page — already loads them
// with hydrated steps), so we don't double-subscribe useProjects.
//
// SCOPE (this slice): today-only horizon (the planner takes a multi-day
// horizon; widening is a later slice) and manual-sync only (the ~30s auto-
// reflow fallback is Slice 4). STALE = the committed auto-placements differ
// from what a fresh reflow of the current ranking would produce — so
// reordering the list flips `stale` true WITHOUT moving anything (never
// silently rearrange); `syncNow()` writes the minimal diff to reconcile.
export function useScheduleReflow({ dateISO, projects }) {
  const { blocks } = useChoreBlocks();
  const { deltas, addProject, removeDelta } = useScheduleDeltas(dateISO);

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
    return reflowPlan({
      rankedProjects: rankedActiveProjects(projects),
      gapsByDate: [{ dateISO, gaps }],
      excludeStepIds: manualPlacedStepIds(deltas, dateISO),
    });
  }, [dateISO, blocks, projects, deltas]);

  const committedAuto = useMemo(
    () => committedAutoPlacements(deltas, dateISO), [deltas, dateISO]);

  const stale = useMemo(
    () => isStale(planned, committedAuto), [planned, committedAuto]);

  // Write the minimal diff: drop stale auto-placements, add the new ones.
  // Manual placements + completed steps are never in either set, so they
  // are untouched. Returns a small summary for a confirmation line.
  const syncNow = useCallback(() => {
    const { toPlace, toRemove } = reconcilePlan({ planned, committedAuto });
    for (const p of toRemove) removeDelta(p.id);
    for (const p of toPlace) addProject(...placementToAddArgs(p));
    return { placed: toPlace.length, removed: toRemove.length };
  }, [planned, committedAuto, addProject, removeDelta]);

  return {
    stale,
    planned,
    committedAuto,
    plannedCount: planned.length,
    syncNow,
  };
}
