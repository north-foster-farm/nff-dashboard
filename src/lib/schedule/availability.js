// Availability engine (batch 42 slices 6-7, F50/F51).
// availability = working hours ∩ not-time-off ∩ not-break.

import { isoDateLocal } from "../calendarMath.js";
import { sunMinutesOfDay } from "../sunTimes.js";
import { subtractIntervals } from "./partition.js";

// F15 — resolve one side of a window row for `date`: a sun anchor
// (startSun/endSun = 'sunrise' | 'sunset') wins over fixed minutes.
function resolveSide(sun, fixedMin, date) {
  return sun ? sunMinutesOfDay(date, sun) : fixedMin;
}

// Resolve a { startMin, endMin, startSun?, endSun? } row to concrete
// minutes for `date`. Null when either side is unset or the resolved
// window is empty/inverted (a sunset-anchored window can invert in
// summer — treat it as absent rather than carving garbage).
export function resolveWindow(row, date) {
  const startMin = resolveSide(row.startSun, row.startMin, date);
  const endMin = resolveSide(row.endSun, row.endMin, date);
  if (startMin == null || endMin == null || endMin <= startMin) {
    return null;
  }
  return { startMin, endMin };
}

// App-level default when a person has no working_hours rows for a
// day: 9:00-17:00 (F51 — "default e.g. 9-5").
export const DEFAULT_WORKING_WINDOW = {
  startMin: 9 * 60,
  endMin: 17 * 60,
};

// One person's working span on `date`, from working_hours rows.
// Precedence: per-date exception > weekday default > 9-5 fallback.
// A row with null minutes is a scheduled day OFF → null.
export function workingWindow(person, date, hoursRows) {
  const rows = hoursRows ?? [];
  const dateISO = isoDateLocal(date);
  const row =
    rows.find((r) => r.person === person && r.onDate === dateISO) ??
    rows.find(
      (r) => r.person === person && r.weekday === date.getDay()
    );
  if (!row) return { ...DEFAULT_WORKING_WINDOW };
  return resolveWindow(row, date); // null = day off
}

// The person's actual availability on `date`: the working window with
// their time off and the farm-wide active breaks carved out. `ctx` is
// { hours, timeOff, breaks } — the three hooks' row arrays. Returns
// 0+ disjoint ascending { startMin, endMin } windows.
export function availableWindows(person, date, ctx = {}) {
  const working = workingWindow(person, date, ctx.hours);
  if (!working) return [];
  const holes = [
    ...timeOffWindows(person, date, ctx.timeOff),
    ...(ctx.breaks ?? [])
      .filter((b) => b.isActive !== false)
      .map((b) => resolveWindow(b, date))
      .filter(Boolean),
  ].map((w) => ({ s: w.startMin, e: w.endMin }));
  return subtractIntervals(
    { s: working.startMin, e: working.endMin }, holes
  ).map((seg) => ({ startMin: seg.s, endMin: seg.e }));
}

// True when the person's availability overlaps the asked window at
// all (strict overlap — touching doesn't count, matching the strict
// double-book rule in conflicts.js).
export function availableDuring(person, date, window, ctx) {
  return availableWindows(person, date, ctx).some(
    (w) => w.startMin < window.endMin && w.endMin > window.startMin
  );
}

// X3 — the default-assignment fallback: when nothing is explicitly
// assigned, the work belongs to everyone available during the window.
// Returns [] when nobody is (the needs-cover case).
export function defaultAssignees(date, window, ctx, roster) {
  return (roster ?? []).filter(
    (person) => availableDuring(person, date, window, ctx)
  );
}

// F48 — who's here across the day: minimal ascending segments between
// availability boundaries, each carrying the people available in it
// (roster order). Zero-people holes BETWEEN covered spans are kept
// (the lunch-break dip); leading/trailing emptiness is not.
export function availabilitySegments(date, ctx, roster) {
  const windowsByPerson = (roster ?? []).map((person) => ({
    person,
    windows: availableWindows(person, date, ctx),
  }));
  const bounds = [...new Set(
    windowsByPerson.flatMap(({ windows }) =>
      windows.flatMap((w) => [w.startMin, w.endMin]))
  )].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const seg = { startMin: bounds[i], endMin: bounds[i + 1] };
    const people = windowsByPerson
      .filter(({ windows }) => windows.some(
        (w) => w.startMin <= seg.startMin && w.endMin >= seg.endMin))
      .map(({ person }) => person);
    const prev = out[out.length - 1];
    if (prev && prev.endMin === seg.startMin
        && prev.people.join("\n") === people.join("\n")) {
      prev.endMin = seg.endMin;
    } else {
      out.push({ ...seg, people });
    }
  }
  return out;
}

// F46 — whole-day-out test for the This Week strip: true when the
// person has NO availability at all on `date` (a scheduled day off,
// an all-day time off, or a partial time off that swallows the whole
// working window).
export function outAllDay(person, date, ctx = {}) {
  return availableWindows(person, date, ctx).length === 0;
}

// The day's project band, derived from working hours (the magic 6pm
// cutoff, retired): projects can run whenever ANYONE is scheduled to
// work. Time off doesn't shrink the band — who's-free handles that
// per gap. Null when nobody works at all.
export function projectBand(date, ctx, roster) {
  let startMin = null;
  let endMin = null;
  for (const person of roster ?? []) {
    const w = workingWindow(person, date, ctx?.hours);
    if (!w) continue;
    startMin = startMin == null ? w.startMin : Math.min(startMin, w.startMin);
    endMin = endMin == null ? w.endMin : Math.max(endMin, w.endMin);
  }
  return startMin == null ? null : { startMin, endMin };
}

// The person's absence windows on `date` from time_off rows. The date
// span is inclusive on both ends; null minutes = all-day.
export function timeOffWindows(person, date, timeOffRows) {
  const dateISO = isoDateLocal(date);
  const out = [];
  for (const r of timeOffRows ?? []) {
    if (r.person !== person) continue;
    if (dateISO < r.startDate || dateISO > r.endDate) continue;
    out.push(
      r.startMin == null
        ? { startMin: 0, endMin: 1440 }
        : { startMin: r.startMin, endMin: r.endMin }
    );
  }
  return out;
}
