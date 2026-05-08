import { useCallback } from "react";
import { useEventOccurrences } from "./useEventOccurrences.js";
import { useEventSeries } from "./useEventSeries.js";

// High-level mutation helpers built on top of useEventOccurrences +
// useEventSeries (Batch 14.2). Wraps drag-to-reschedule and drag-to-
// resize semantics so the calendar views never have to know about
// recurring-vs-one-off split.
//
// Two operations:
//   moveOccurrence({
//     seriesId, fromDate, toDate, newStartTime?, newEndTime?,
//     durationMinutes?
//   })
//     - Same date: upsert override at toDate with the new times.
//     - Different date (recurring): skip-old + upsert-new.
//     - Different date (one-off): same skip-old + upsert-new — the
//       skipped row stays as a tombstone so the recurrence reader
//       knows to look past it.
//
//   resizeOccurrence({ seriesId, occursOn, newStartTime?, newEndTime? })
//     - Pure same-day retime. Upserts at occursOn with the new times.
//
// Both ultimately call useEventOccurrences.upsertOverride; the
// realtime channel echoes back so the schedule re-renders with the
// override row in place of the rule's default.

export function useEventMutator() {
  const { upsertOverride } = useEventOccurrences();
  const { seriesById } = useEventSeries();

  const moveOccurrence = useCallback(async ({
    seriesId, fromDate, toDate,
    newStartTime, newEndTime, durationMinutes,
  }) => {
    const computedEnd = newEndTime ?? deriveEnd(newStartTime, durationMinutes);
    if (fromDate === toDate) {
      await upsertOverride({
        seriesId,
        occursOn: toDate,
        startTime: newStartTime,
        endTime: computedEnd,
        status: "scheduled",
      });
      return;
    }
    // Cross-date move. Skip the source so the original date drops
    // out of rendering, then write a fresh row at the destination.
    // Same flow for recurring + one-off — the recurrence reader is
    // tolerant of skipped rows on either side.
    await upsertOverride({
      seriesId,
      occursOn: fromDate,
      status: "skipped",
    });
    await upsertOverride({
      seriesId,
      occursOn: toDate,
      startTime: newStartTime,
      endTime: computedEnd,
      status: "scheduled",
    });
    // Eagerly note the series for callers that want it (e.g. an
    // analytics hook later). seriesById is stable per render so just
    // returning it is fine.
    return seriesById.get(seriesId) ?? null;
  }, [upsertOverride, seriesById]);

  const resizeOccurrence = useCallback(async ({
    seriesId, occursOn, newStartTime, newEndTime,
  }) => {
    await upsertOverride({
      seriesId,
      occursOn,
      startTime: newStartTime,
      endTime: newEndTime,
      status: "scheduled",
    });
  }, [upsertOverride]);

  return { moveOccurrence, resizeOccurrence };
}

function deriveEnd(startTime, durationMinutes) {
  if (!startTime || typeof durationMinutes !== "number") return null;
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m + Math.max(0, durationMinutes);
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
