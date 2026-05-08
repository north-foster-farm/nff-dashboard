// Pure helpers for the calendar time rail (Batch 14.1).
//
// The Day + Week views use a single fixed coordinate space:
//   * "Day rail" is the visible time window, defaulting to 5 AM
//     through 10 PM (inclusive of both endpoints — 17 hour-slots).
//   * Each minute = `pxPerMinute` pixels of vertical height.
//   * Events + chore-block bands position absolutely inside their
//     day column.
//
// Sun-event chore blocks (sunrise / sunset) resolve their start
// against the day being rendered via lib/sunTimes — so a "Sunset
// rounds" block lands at today's actual sunset, not yesterday's.

import { resolveBlockMinutes } from "./sunTimes.js";

// Defaults. Each view is free to override via props (e.g. a future
// "compact" preference shrinking pxPerMinute).
export const DEFAULT_RAIL = {
  startHour: 5,    // 5 AM
  endHour: 22,     // 10 PM
  pxPerMinute: 0.9, // 54px per hour
};

export function railMinutes(rail = DEFAULT_RAIL) {
  return (rail.endHour - rail.startHour) * 60;
}

export function railHeight(rail = DEFAULT_RAIL) {
  return railMinutes(rail) * rail.pxPerMinute;
}

export function railHourLabels(rail = DEFAULT_RAIL) {
  const out = [];
  for (let h = rail.startHour; h < rail.endHour; h += 1) {
    out.push(h);
  }
  return out;
}

// Convert an "HH:MM" wall-clock string into minutes-from-midnight.
// Returns null when the input isn't usable.
export function hhmmToMinutes(hhmm) {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

// Given an absolute minutes-from-midnight, return the y-pixel
// position inside the rail (top = 0). Clamps to the rail bounds.
export function minutesToY(minutes, rail = DEFAULT_RAIL) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return 0;
  const railStart = rail.startHour * 60;
  const railEnd = rail.endHour * 60;
  const clamped = Math.max(railStart, Math.min(railEnd, minutes));
  return (clamped - railStart) * rail.pxPerMinute;
}

// Resolve a chore_block window for a date into a rail-positioned
// rectangle: { top, height, label, fullyOff: boolean }. Sun-event
// blocks resolve per-date. Returns null when the block can't be
// resolved (sun-event for a polar latitude, etc.).
export function blockToBand(block, date, rail = DEFAULT_RAIL) {
  if (!block?.isActive) return null;
  const start = resolveBlockMinutes(date, block.startKind, block.startMinutes);
  if (start === null) return null;
  const end = start + (block.durationMinutes ?? 0);
  const railStart = rail.startHour * 60;
  const railEnd = rail.endHour * 60;
  const fullyOff = end <= railStart || start >= railEnd;
  if (fullyOff) return null;
  return {
    blockId: block.id,
    name: block.name,
    top: minutesToY(start, rail),
    height: Math.max(2, minutesToY(Math.min(end, railEnd), rail) - minutesToY(Math.max(start, railStart), rail)),
    startMin: start,
    endMin: end,
  };
}

// Resolve an expanded event occurrence into a rail-positioned block:
//   { top, height, missingTime: boolean }
// Events that have no start time fall back to a row at the rail's
// top with `missingTime: true` so the caller can show a hint
// instead of stacking everything at midnight.
export function eventToBlock(occurrence, rail = DEFAULT_RAIL, opts = {}) {
  const { defaultDurationMinutes = 60 } = opts;
  const startMin = hhmmToMinutes(occurrence.startTime);
  if (startMin === null) {
    return {
      top: 0,
      height: defaultDurationMinutes * rail.pxPerMinute,
      missingTime: true,
      startMin: null,
      endMin: null,
    };
  }
  const explicitEnd = hhmmToMinutes(occurrence.endTime);
  const endMin = (explicitEnd && explicitEnd > startMin)
    ? explicitEnd
    : startMin + defaultDurationMinutes;
  const railStart = rail.startHour * 60;
  const railEnd = rail.endHour * 60;
  const visibleStart = Math.max(startMin, railStart);
  const visibleEnd = Math.min(endMin, railEnd);
  const top = minutesToY(visibleStart, rail);
  const height = Math.max(18, minutesToY(visibleEnd, rail) - top);
  return { top, height, missingTime: false, startMin, endMin };
}

// Two events on the same day with overlapping ranges — used by the
// view to spread them into side-by-side columns. Returns an array
// of { occurrence, columnIndex, columnCount } shapes preserving the
// input order.
export function layoutOverlappingEvents(occurrences) {
  const positioned = [];
  // Sort by start so the "is overlapping?" sweep is deterministic.
  const sorted = [...occurrences].sort((a, b) => {
    const sa = hhmmToMinutes(a.startTime) ?? 0;
    const sb = hhmmToMinutes(b.startTime) ?? 0;
    return sa - sb;
  });
  // Greedy column packing: each event gets the lowest column index
  // that doesn't overlap with another event already in that column.
  const columns = [];
  for (const ev of sorted) {
    const startMin = hhmmToMinutes(ev.startTime) ?? 0;
    const endMin = hhmmToMinutes(ev.endTime) ?? startMin + 60;
    let placed = false;
    for (let i = 0; i < columns.length; i += 1) {
      const col = columns[i];
      const last = col[col.length - 1];
      const lastEnd = hhmmToMinutes(last.endTime)
        ?? (hhmmToMinutes(last.startTime) ?? 0) + 60;
      if (startMin >= lastEnd) {
        col.push(ev);
        positioned.push({ occurrence: ev, columnIndex: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([ev]);
      positioned.push({ occurrence: ev, columnIndex: columns.length - 1 });
    }
  }
  const columnCount = Math.max(1, columns.length);
  return positioned.map(p => ({ ...p, columnCount }));
}

// Walk forward / backward by a calendar unit. Day = 1 day, week = 7
// days, month = 1 calendar month with day clamping to month end.
export function advanceDate(date, unit, delta) {
  const out = new Date(date);
  if (unit === "day" || unit === "agenda") {
    out.setDate(out.getDate() + delta);
  } else if (unit === "week") {
    out.setDate(out.getDate() + delta * 7);
  } else if (unit === "month") {
    out.setMonth(out.getMonth() + delta);
  }
  return out;
}

// Sunday-anchored start-of-week.
export function startOfWeek(date) {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

// "Today, May 8" / "May 8 – 14, 2026" / "May 2026" — reused header
// labels so each view's prev/next nav reads consistently.
export function formatViewLabel(view, date) {
  if (view === "month") {
    return date.toLocaleDateString("en-US", {
      month: "long", year: "numeric",
    });
  }
  if (view === "week") {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${end.getFullYear()}`;
  }
  return date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

// Quick compare: do two dates fall on the same calendar day?
export function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

// "YYYY-MM-DD" anchored to local time (NOT UTC). The schedule's
// occurrence rows already carry this format from loadEvents.
export function isoDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
