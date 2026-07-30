// Event recurrence expansion (Batch 13.1).
//
// Reads the new event_series shape (RFC 5545 RRULE) plus
// pre-materialized event_occurrences overrides loaded alongside it.
// Replaces the previous weekly-only `{ dayOfWeek, seasonStart,
// seasonEnd }` shape — the migration in 0013 converts that legacy
// JSONB into RRULE strings.
//
// Public API stays compatible with the pre-13 callers:
//
//   getEventOccurrences(eventsData, fromDate, toDate, filters?)
//     → flat array of expanded occurrences in the legacy display
//     shape (date, startTime, endTime, kindId, kindLabel, instanceId,
//     instanceLabel, subtitle, location, recurring).
//
// Behaviour:
//   * Recurring series: rrule.js expands the rule between fromDate
//     and toDate. Each computed date is checked against the
//     pre-loaded `occurrences` list — overrides win on time / loc /
//     status; `skipped` rows are dropped; un-overridden dates fall
//     back to the series defaults.
//   * One-off series: rrule is null. The pre-materialized
//     occurrence carries the canonical date / times.
//   * Season window: extra MM-DD filter applied client-side after
//     RRULE expansion. Lets a "every Saturday May 14 → Sept 21" series
//     skip Saturdays in the dormant months without baking a complex
//     RRULE string. Falls through unchanged when null.
//
// `occurrence` shape (camelCase, provided by useReferenceData.loadEvents):
//   { id, occursOn, startTime, endTime, locationOverride, status,
//     notesOverride, payloadOverride }

import { rrulestr } from "rrule";
import { parseISODate, formatISODate } from "./dates.js";

const ZERO_OFFSETS = ["00:00", "00:00:00"];

// Resolve an RRule object from the series's rrule string + dtstart.
// rrule.js expects `DTSTART:...\nRRULE:...` form when calling
// rrulestr, so we compose that on the fly. Cached per-series in a
// WeakMap so repeated calls don't re-parse.
const RULE_CACHE = new WeakMap();
function getRule(series) {
  if (!series?.rrule || !series?.dtstart) return null;
  const cached = RULE_CACHE.get(series);
  if (cached) return cached;
  const dtstart = new Date(series.dtstart);
  if (Number.isNaN(dtstart.getTime())) return null;
  const dtIso = dtstart.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const composed =
    `DTSTART:${dtIso.slice(0, dtIso.length - 1)}Z\nRRULE:${series.rrule}`;
  let rule;
  try {
    rule = rrulestr(composed);
  } catch (e) {
    console.warn("[recurrence] failed to parse RRULE:", composed, e);
    return null;
  }
  RULE_CACHE.set(series, rule);
  return rule;
}

// Expand a recurring series within [fromDate, toDate].
function expandRecurring(series, kind, fromDate, toDate) {
  const rule = getRule(series);
  if (!rule) return [];
  // `between` is inclusive on both ends.
  let dates;
  try {
    dates = rule.between(fromDate, toDate, true);
  } catch (e) {
    console.warn("[recurrence] expansion failed:", e);
    return [];
  }
  const seasonOk = makeSeasonChecker(series.seasonWindow);
  const overridesByDate = indexOverrides(series.occurrences);
  const out = [];
  for (const d of dates) {
    const iso = formatISODate(d);
    if (!seasonOk(iso)) continue;
    const ov = overridesByDate.get(iso);
    if (ov?.status === "skipped") continue;
    out.push(buildEntry(series, kind, iso, ov, /* recurring */ true));
  }
  // Plus any override rows that fall in-range but landed on a date
  // the rule doesn't produce (e.g. drag-rescheduled to a new day).
  for (const ov of (series.occurrences ?? [])) {
    if (!ov?.occursOn) continue;
    if (ov.status === "skipped") continue;
    const d = parseISODate(ov.occursOn);
    if (!d) continue;
    if (d < fromDate || d > toDate) continue;
    if (out.some(e => e.date === ov.occursOn)) continue;
    out.push(buildEntry(series, kind, ov.occursOn, ov, true));
  }
  return out;
}

// Expand a one-off series. Always materialized — the migration
// pre-creates a single occurrence row. After a drag-to-reschedule
// (Batch 14.2), the original row may be tombstoned `skipped` and a
// new row inserted at the new date — so we walk all non-skipped
// rows in case the canonical anchor moved.
function expandOneOff(series, kind, fromDate, toDate) {
  const live = (series.occurrences ?? []).filter(o =>
    o?.occursOn && o.status !== "skipped"
  );
  const out = [];
  for (const ov of live) {
    const d = parseISODate(ov.occursOn);
    if (!d || d < fromDate || d > toDate) continue;
    out.push(buildEntry(series, kind, ov.occursOn, ov, false));
  }
  return out;
}

// Compose the legacy display row from series defaults + an optional
// override row. Overrides win on every populated field.
function buildEntry(series, kind, dateIso, override, recurring) {
  const startTime = pickTime(override?.startTime, defaultStartTime(series));
  const endTime = pickTime(override?.endTime, defaultEndTime(series));
  return {
    date: dateIso,
    startTime,
    endTime,
    kindId: kind.id,
    kindLabel: kind.label,
    instanceId: series.id,
    instanceLabel: series.label,
    subtitle: series.subtitle,
    location: override?.locationOverride ?? series.location,
    recurring,
    occurrenceId: override?.id ?? null,
    status: override?.status ?? "scheduled",
    // Sparkle treatment: occurrences of automation-created series
    // carry the emission id so calendar rows can render the icon.
    automationEmissionId: series.automationEmissionId ?? null,
  };
}

function pickTime(override, fallback) {
  const v = override ?? fallback;
  if (typeof v !== "string") return v ?? null;
  // Trim seconds / sub-seconds: "08:00:00" → "08:00".
  return v.length >= 5 ? v.slice(0, 5) : v;
}

function defaultStartTime(series) {
  if (!series?.dtstart) return null;
  const d = new Date(series.dtstart);
  if (Number.isNaN(d.getTime())) return null;
  // Use UTC components so the time matches what the migration stored.
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const result = `${hh}:${mm}`;
  return ZERO_OFFSETS.includes(result) ? null : result;
}

function defaultEndTime(series) {
  const start = defaultStartTime(series);
  if (!start || !series?.durationMinutes) return null;
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + series.durationMinutes;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function indexOverrides(list) {
  const m = new Map();
  for (const o of list ?? []) {
    if (o?.occursOn) m.set(o.occursOn, o);
  }
  return m;
}

// Season window is an inclusive MM-DD..MM-DD pair. Wrapping windows
// (e.g. Nov-04 → Mar-12) are supported by inverting the test.
function makeSeasonChecker(window) {
  if (!window?.start || !window?.end) return () => true;
  const startMD = monthDay(window.start);
  const endMD = monthDay(window.end);
  if (startMD == null || endMD == null) return () => true;
  return (iso) => {
    const md = monthDay(iso);
    if (md == null) return true;
    if (startMD <= endMD) return md >= startMD && md <= endMD;
    // Wrapping window (winter season): inside if before-end OR
    // after-start.
    return md >= startMD || md <= endMD;
  };
}

// "MM-DD" or full ISO → 4-digit MMDD integer (Jan 14 = 0114).
function monthDay(s) {
  if (typeof s !== "string") return null;
  let mm; let dd;
  if (s.length === 5 && s[2] === "-") {
    mm = s.slice(0, 2); dd = s.slice(3, 5);
  } else if (s.length >= 10 && s[4] === "-") {
    mm = s.slice(5, 7); dd = s.slice(8, 10);
  } else {
    return null;
  }
  const n = parseInt(mm + dd, 10);
  return Number.isFinite(n) ? n : null;
}

// Top-level entry point. Walks every kind / instance and concatenates
// expanded rows. Filters expects the same { [kindId]: boolean } shape
// the pre-13 caller used.
export function getEventOccurrences(eventsData, fromDate, toDate, filters) {
  const all = [];
  for (const kind of eventsData.kinds) {
    if (filters && filters[kind.id] === false) continue;
    for (const inst of kind.instances) {
      if (inst.rrule) {
        all.push(...expandRecurring(inst, kind, fromDate, toDate));
      } else {
        all.push(...expandOneOff(inst, kind, fromDate, toDate));
      }
    }
  }
  all.sort((a, b) =>
    a.date < b.date ? -1
    : a.date > b.date ? 1
    : (a.startTime || "").localeCompare(b.startTime || "")
  );
  return all;
}
