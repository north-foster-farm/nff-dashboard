// Chore engine. Pure functions that take chore definitions + a date and
// expand them into concrete instances for that day, with computed deadline
// and resolved assignee.

import {
  CHORE_SEEDS, CHORE_CATEGORIES,
  CHORE_BLOCK_IDS, CHORE_BLOCKS_META, CHORE_OWNERS,
} from "../data/choreSeeds.js";
import { sunMinutesOfDay, displayBlockSide } from "./sunTimes.js";
import { descendantIds } from "./places.js";

export {
  CHORE_SEEDS, CHORE_CATEGORIES,
  CHORE_BLOCK_IDS, CHORE_BLOCKS_META, CHORE_OWNERS,
};

// Short weekday names, Sun=0…Sat=6 (matches stored frequency/weekday
// values). Module-level so frequency + deadline formatters share it.
const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Display label for a block slug (new model). Falls back to the raw
// slug if it isn't one of the five known blocks.
function blockSlugLabel(slug) {
  return CHORE_BLOCKS_META[slug]?.label ?? slug ?? "";
}

// The canonical list of chore definitions the app shows. Once a backend
// exists, this source flips to whatever is in the DB and the seeds are
// used only for initial insertion (the empty-DB dev fallback).
export function getAllChoreDefinitions(data) {
  const fromData = data?.chores?.definitions ?? [];
  return fromData.length > 0 ? fromData : CHORE_SEEDS;
}

// The Chores sidebar badge: how many chores due today have no
// completion logged yet. Chore-level and deliberately place-blind — a
// fanned-out chore (2 of 3 coops done) stops counting at its first
// completion; the per-place truth lives in Rounds and the Chores tab,
// not in a nav badge. A missing set means completions are still
// loading: count everything due.
export function choresRemainingToday(data, date, completedChoreIds) {
  const done = completedChoreIds ?? new Set();
  return getChoresForDay(data, date)
    .filter((inst) => !done.has(inst.choreId)).length;
}

// Day-of-week in local time, Sun=0…Sat=6 (matches stored frequency values).
export function dayOfWeek(date) {
  return date.getDay();
}

// Is the given date inside the "last week" of its month? The last week is
// defined as the week (Sun–Sat) that contains the final Sunday of the month.
export function isInLastWeekOfMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  // Last day of the month:
  const lastDay = new Date(y, m + 1, 0);
  // Walk backwards to the final Sunday.
  const finalSunday = new Date(lastDay);
  finalSunday.setDate(lastDay.getDate() - lastDay.getDay());
  const weekStart = finalSunday;
  const weekEnd = new Date(finalSunday);
  weekEnd.setDate(finalSunday.getDate() + 6);
  weekStart.setHours(0, 0, 0, 0);
  weekEnd.setHours(23, 59, 59, 999);
  return date >= weekStart && date <= weekEnd;
}

// Does this chore's frequency fire on `date`? For window chores, a chore
// "fires" every day of its window — whether it has been completed is the
// caller's concern.
export function isChoreActiveOn(chore, date) {
  const f = chore.frequency;
  const dow = dayOfWeek(date);
  switch (f?.type) {
    case "daily":
      return true;
    case "specific_days":
      return (f.days ?? []).includes(dow);
    case "weekly_window":
      return dow >= (f.preferredDay ?? 1) && dow <= (f.latestDay ?? 5);
    case "monthly_last_week_window":
      return isInLastWeekOfMonth(date)
        && dow >= (f.preferredDay ?? 1)
        && dow <= (f.latestDay ?? 5);
    // ── New (block) model ────────────────────────────────────────────
    case "weekly":
      // Fires on each listed weekday (Monday-only, or Mon/Wed/Fri).
      return (f.days ?? []).includes(dow);
    case "monthly_last_week":
      // Last week of the month, on weekday f.day.
      return isInLastWeekOfMonth(date) && dow === (f.day ?? 1);
    case "every_n":
      return firesEveryN(f, date);
    case "event":
      // Event/batch/landmark-triggered chores never fire on their own;
      // they're materialized by the process/automation engine.
      return false;
    case "once":
      // One-time chores (auto-created by automations) fire on their
      // date and keep nagging until completed. Completion retires the
      // chore row (DB trigger sets retired_at), which drops it from
      // the definitions list entirely — so "active forever after its
      // date" never outlives the chore being done.
      return Boolean(f.date) && localISODate(date) >= f.date;
    default:
      return false;
  }
}

// every_n recurrence: { n, unit: days|weeks|months|years, day? }.
// `day` (when present) is a weekday (Sun=0…Sat=6) the chore lands on.
// Anchored to the epoch so it's deterministic without a per-chore start
// date (the spec's only user is the egg-washer clean = every 3 months
// on a Monday → the first Monday of Jan/Apr/Jul/Oct).
function firesEveryN(f, date) {
  const n = Math.max(1, f.n ?? 1);
  const day = f.day; // optional weekday
  const dow = date.getDay();
  switch (f.unit) {
    case "days": {
      const epochDay = Math.floor(date.getTime() / 86400000);
      return epochDay % n === 0;
    }
    case "weeks": {
      if (day != null && dow !== day) return false;
      const epochWeek = Math.floor(date.getTime() / (7 * 86400000));
      return epochWeek % n === 0;
    }
    case "months": {
      const absMonth = date.getFullYear() * 12 + date.getMonth();
      if (absMonth % n !== 0) return false;
      if (day == null) return date.getDate() === 1;
      // First occurrence of `day` weekday in the month.
      return dow === day && date.getDate() <= 7;
    }
    case "years": {
      if (date.getMonth() !== 0) return false; // January
      if (day == null) return date.getDate() === 1;
      return dow === day && date.getDate() <= 7;
    }
    default:
      return false;
  }
}

// Local-time "YYYY-MM-DD" for a Date (no UTC shift).
function localISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse "YYYY-MM-DD" as a local-time start-of-day Date.
function parseLocalISODate(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Combine a date + "HH:MM" string into a local Date.
function atTime(date, hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out;
}

// End-of-day (23:59:59) for a given date.
function endOfDay(date) {
  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

// The Friday of the Sun–Sat week that contains `date`.
function fridayOfWeek(date) {
  const out = new Date(date);
  const shift = 5 - out.getDay(); // Fri=5
  out.setDate(out.getDate() + shift);
  return endOfDay(out);
}

// The Friday of the last week of the month containing `date`.
function fridayOfLastWeekOfMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0);
  const finalSunday = new Date(lastDay);
  finalSunday.setDate(lastDay.getDate() - lastDay.getDay());
  const fri = new Date(finalSunday);
  fri.setDate(finalSunday.getDate() + 5);
  return endOfDay(fri);
}

// ── Block helpers (new deadline + start-time model) ──────────────────
// `blocks` is the useChoreBlocks shape: { id, name, startKind,
// startMinutes, durationMinutes, isActive }.

// Resolve a block by uuid (chore.blockId) or by slug (deadline refs).
function findBlock(ref, blocks) {
  if (!ref || !blocks) return null;
  const id = CHORE_BLOCK_IDS[ref] ?? ref;
  return blocks.find((b) => b.id === id) ?? null;
}

// A block's start minutes-of-day on `date` (sun events resolve per-day).
function blockStartMin(block, date) {
  if (!block) return null;
  if (block.startKind === "fixed") return block.startMinutes ?? 0;
  return sunMinutesOfDay(date, block.startKind);
}

function blockEndMin(block, date) {
  const s = blockStartMin(block, date);
  return s == null ? null : s + (block.durationMinutes ?? 0);
}

// Active blocks ordered by their resolved start minutes on `date`.
function orderedBlocks(blocks, date) {
  return (blocks ?? [])
    .filter((b) => b.isActive !== false)
    .map((b) => ({ b, min: blockStartMin(b, date) ?? 0 }))
    .sort((x, y) => x.min - y.min)
    .map((x) => x.b);
}

// The next date on/after `date` whose weekday is `weekday` (Sun=0).
function nextWeekdayOnOrAfter(date, weekday) {
  const out = startOfDay(date);
  out.setDate(out.getDate() + ((weekday - out.getDay() + 7) % 7));
  return out;
}

// A minutes-of-day value as a Date on `baseDate`.
function dateAtMinutes(baseDate, minutes) {
  const out = startOfDay(baseDate);
  out.setMinutes(minutes);
  return out;
}

// Resolve a new-model block-reference deadline ({ kind: ... }) to a
// concrete Date. Degrades to end-of-day when blocks aren't available.
function resolveBlockDeadline(d, chore, date, blocks) {
  switch (d.kind) {
    case "midnight":
    case "none":
      return endOfDay(date);
    case "following_block": {
      const ord = orderedBlocks(blocks, date);
      const idx = ord.findIndex((b) => b.id === chore.blockId);
      const next = idx >= 0 ? ord[idx + 1] : null;
      const m = blockStartMin(next, date);
      return m != null ? dateAtMinutes(date, m) : endOfDay(date);
    }
    case "block": {
      const m = blockEndMin(findBlock(d.block, blocks), date);
      return m != null ? dateAtMinutes(date, m) : endOfDay(date);
    }
    case "block_on_weekday": {
      const target = nextWeekdayOnOrAfter(date, d.weekday ?? 5);
      const m = blockEndMin(findBlock(d.block, blocks), target);
      return m != null ? dateAtMinutes(target, m) : endOfDay(target);
    }
    case "block_at_offset": {
      const target = startOfDay(date);
      target.setDate(target.getDate() + (d.offset_days ?? 0));
      const m = blockEndMin(findBlock(d.block, blocks), target);
      return m != null ? dateAtMinutes(target, m) : endOfDay(target);
    }
    default:
      return endOfDay(date);
  }
}

// Resolve a chore's deadline for the given date. New-model chores carry
// a block-reference deadline ({ kind: ... }, needs `blocks`); legacy
// chores carry the old { type: ... } jsonb.
export function computeDeadline(chore, date, blocks) {
  const d = chore.deadline;
  if (d?.kind) return resolveBlockDeadline(d, chore, date, blocks);
  switch (d?.type) {
    case "offset_hours": {
      const start = atTime(date, chore.startTime);
      start.setHours(start.getHours() + (d.hours || 0));
      return start;
    }
    case "end_of_day":
      return endOfDay(date);
    case "end_of_week_friday":
      return fridayOfWeek(date);
    case "end_of_month_week_friday":
      return fridayOfLastWeekOfMonth(date);
    default:
      return endOfDay(date);
  }
}

// Canonical within-place chore order (F49). Chores share one global
// `sort_order` rank; it's applied INSIDE each place group so the same
// activity lands in the same position at every place it fans out to.
// A positive rank sorts ascending (1 = first); an unranked chore
// (sort_order 0 / null) sinks below the ranked ones and tie-breaks on
// title, so a fresh, all-unranked set still reads alphabetically.
// Used by the Today view, the All-chores "by place" tree, and Rounds so
// the order is consistent everywhere it's "pulled in".
export function compareChoreOrder(a, b) {
  const ra = a?.sortOrder ? a.sortOrder : Infinity;
  const rb = b?.sortOrder ? b.sortOrder : Infinity;
  if (ra !== rb) return ra - rb;
  return (a?.title ?? "").localeCompare(b?.title ?? "");
}

// A chore's start time as a Date on `date`. New-model chores derive it
// from their block's resolved start; legacy chores use chore.startTime.
function choreStartAt(chore, date, blocks) {
  if (chore.blockId && blocks) {
    const m = blockStartMin(findBlock(chore.blockId, blocks), date);
    if (m != null) return dateAtMinutes(date, m);
  }
  return atTime(date, chore.startTime);
}

// Resolve who is assigned to a chore on a given day. Returns an
// array of names (one or more) — multi-assignee rules are common
// (Wed/Sat/Sun = both James + Jim). Empty array means unassigned.
//
// Precedence (Batch 12):
//   1. Active chore-scoped rule whose days_of_week includes the
//      day-of-week, ordered by priority desc, then created_at desc
//      (the hook delivers them pre-sorted). Highest priority wins;
//      its assignees become the resolved list.
//   2. Active block-scoped rule for the chore's blockId, same
//      ordering.
//   3. Legacy chore.assignment.byDayOfWeek[dow] → list with that one
//      name.
//   4. Legacy chore.assignment.default → list with that one name.
//   5. [] (unassigned).
//
// `rulesByChoreId` and `rulesByBlockId` are the Maps returned by
// useChoreAssignmentRules. Either can be omitted; the function
// degrades gracefully to the legacy fields.
export function resolveAssignees(chore, date, opts = {}) {
  if (!chore) return [];
  const { rulesByChoreId, rulesByBlockId } = opts;
  const dow = dayOfWeek(date);

  // 1. Chore-scoped rules.
  const choreRules = rulesByChoreId?.get?.(chore.id) ?? [];
  const choreMatch = pickRule(choreRules, dow);
  if (choreMatch) return choreMatch.assignees.slice();

  // 2. Block-scoped rules (only meaningful when the chore has a block).
  if (chore.blockId) {
    const blockRules = rulesByBlockId?.get?.(chore.blockId) ?? [];
    const blockMatch = pickRule(blockRules, dow);
    if (blockMatch) return blockMatch.assignees.slice();
  }

  // 3 + 4. Legacy chore.assignment fallbacks.
  const a = chore.assignment;
  if (a) {
    if (a.byDayOfWeek && a.byDayOfWeek[dow]) return [a.byDayOfWeek[dow]];
    if (a.default) return [a.default];
  }
  return [];
}

// Single-name shim — keeps existing callers working. Joins multiple
// resolved assignees with " · " so a Wed/Sat/Sun "both" rule reads
// "James · Jim" in the meta line. Returns null when nobody is on it.
export function resolveAssignee(chore, date, opts) {
  const list = resolveAssignees(chore, date, opts);
  if (list.length === 0) return null;
  return list.join(" · ");
}

// Internal: pick the highest-priority rule whose days_of_week
// includes `dow`. Caller passes the per-scope list already filtered
// to active rules and pre-sorted (priority desc, created_at desc).
function pickRule(rules, dow) {
  for (const r of rules) {
    if (Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(dow)) return r;
  }
  return null;
}

// Expand a chore definition into a concrete instance for `date`, or null if
// it doesn't fire that day. `opts` flows through to the assignment resolver
// (rulesByChoreId, rulesByBlockId from useChoreAssignmentRules).
export function expandChoreForDay(chore, date, opts = {}) {
  if (!isChoreActiveOn(chore, date)) return null;
  const blocks = opts.blocks;
  return {
    choreId: chore.id,
    chore,
    date,
    startAt: choreStartAt(chore, date, blocks),
    deadlineAt: computeDeadline(chore, date, blocks),
    assignees: resolveAssignees(chore, date, opts),
    assignee: resolveAssignee(chore, date, opts),
  };
}

// Get all chore instances for a given day. Preserves the canonical seed
// order (which is the order James / Jim work through them in real life).
// Callers that need a different ordering (e.g. the All Chores tab's sort
// dropdown) sort the returned array themselves.
export function getChoresForDay(data, date, opts) {
  const defs = getAllChoreDefinitions(data);
  const instances = [];
  for (const c of defs) {
    const inst = expandChoreForDay(c, date, opts);
    if (inst) instances.push(inst);
  }
  return instances;
}

// Short human-readable string describing a chore's frequency.
export function describeFrequency(chore) {
  const f = chore.frequency;
  const DOW = DOW_SHORT;
  switch (f?.type) {
    case "daily": return "Every day";
    case "specific_days": return (f.days || []).map(d => DOW[d]).join(" & ");
    case "weekly_window":
      return `Weekly — ${DOW[f.preferredDay]} preferred, by ${DOW[f.latestDay]}`;
    case "monthly_last_week_window":
      return `Monthly (last week) — ${DOW[f.preferredDay]} preferred, by ${DOW[f.latestDay]}`;
    // ── New (block) model ────────────────────────────────────────────
    case "weekly": {
      const days = (f.days || []).map(d => DOW[d]);
      return days.length ? days.join(" / ") : "Weekly";
    }
    case "monthly_last_week":
      return `Monthly (last week) — ${DOW[f.day ?? 1]}`;
    case "every_n": {
      const unit = (f.n ?? 1) === 1
        ? (f.unit || "").replace(/s$/, "") : f.unit;
      const base = `Every ${f.n ?? 1} ${unit}`;
      return f.day != null ? `${base} — ${DOW[f.day]}` : base;
    }
    case "event": return "Event-triggered";
    case "once": {
      const d = parseLocalISODate(f.date);
      if (!d) return "One-time";
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `One-time — ${MON[d.getMonth()]} ${d.getDate()}`;
    }
    default: return "—";
  }
}

// Format a "HH:MM" time as a short 12h clock string (no leading zero on the
// hour, no minutes when the chore starts on the hour).
export function formatTime12hShort(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Convert "HH:MM" to minutes since midnight (0–1439). Treats post-midnight
// evening times as still-in-the-evening-bucket — i.e. a 3 AM chore returns
// 180, NOT 1620; period detection happens elsewhere.
function startMinutes(hhmm) {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return h * 60 + m;
}

// True if `hhmm` falls inside the spec's window for the given period.
// Period windows:
//   morning   05:00–11:59
//   afternoon 12:00–17:59
//   evening   18:00–04:59  (wraps midnight)
function inPeriodWindow(hhmm, period) {
  const min = startMinutes(hhmm);
  if (period === "morning") return min >= 300 && min <= 719;
  if (period === "afternoon") return min >= 720 && min <= 1079;
  if (period === "evening") return min >= 1080 || min <= 299;
  return false;
}

// Find the earliest chore instance within a given period for a day. Evening
// times wrap (so 6 PM precedes 3 AM next morning). Returns null if no chore
// in the period matches.
export function getEarliestChoreInPeriod(instances, period) {
  const candidates = instances.filter(
    (i) => i.chore.period === period && inPeriodWindow(i.chore.startTime, period)
  );
  if (candidates.length === 0) return null;
  const order = (t) => {
    const min = startMinutes(t);
    if (period === "evening") return min < 300 ? min + 24 * 60 : min;
    return min;
  };
  candidates.sort((a, b) => order(a.chore.startTime) - order(b.chore.startTime));
  return candidates[0];
}

// Earliest start time for a period as minutes-since-midnight (0–1439). Used
// to detect "pre-morning" items in the schedule timeline (anything before
// today's morning-chores start). Returns null if the period has no chores.
export function getChorePeriodStartMinutes(instances, period) {
  const earliest = getEarliestChoreInPeriod(instances, period);
  return earliest ? startMinutes(earliest.chore.startTime) : null;
}

// Compute the displayed start-time label for a chore period given the chore
// instances scheduled on a particular day. The label is the earliest start
// time among that period's chores, formatted via formatTime12hShort. Returns
// "" if the period has no qualifying chores.
export function getChorePeriodTimeLabel(instances, period) {
  const earliest = getEarliestChoreInPeriod(instances, period);
  return earliest ? formatTime12hShort(earliest.chore.startTime) : "";
}

// Block-aware variant: prefers chore_blocks data over the legacy
// period helpers when a matching block is available. Lookup is by
// lower-cased block name. Sunrise / sunset blocks resolve to today's
// actual times via SunCalc; fixed blocks use their stored minutes.
//
// `blocks` is the list returned by useChoreBlocks (camelCase shape).
export function getBlockTimeLabelForPeriod(instances, period, blocks) {
  const block = blocks?.find((b) => b.isActive && b.name.toLowerCase() === period);
  if (block) {
    if (block.startKind === "sunrise") return "sunrise";
    if (block.startKind === "sunset") return "sunset";
    const m = ((block.startMinutes % 1440) + 1440) % 1440;
    const h24 = Math.floor(m / 60);
    const minutes = m % 60;
    const ampm = h24 < 12 ? "AM" : "PM";
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return minutes === 0
      ? `${h12} ${ampm}`
      : `${h12}:${String(minutes).padStart(2, "0")} ${ampm}`;
  }
  return getChorePeriodTimeLabel(instances, period);
}

// Block-aware start-minutes for the timeline pre-morning detection.
// Sunrise / sunset blocks resolve via SunCalc; fixed blocks return
// their stored minutes.
export function getBlockStartMinutesForPeriod(instances, period, blocks) {
  const block = blocks?.find((b) => b.isActive && b.name.toLowerCase() === period);
  if (block) {
    if (block.startKind === "fixed") return block.startMinutes;
    return sunMinutesOfDay(new Date(), block.startKind);
  }
  return getChorePeriodStartMinutes(instances, period);
}

// Short display for a chore's start time, respecting evening chores that are
// anchored to sunset rather than a literal clock time.
export function displayStartTime(chore) {
  // New model: a chore's time is its block (resolved elsewhere with the
  // live block schedule); fall back to the block label here.
  if (chore.block) return blockSlugLabel(chore.block);
  if (!chore.period && !chore.startTime) return "—";
  if (chore.period === "evening") return "After sunset";
  const [h, m] = (chore.startTime || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Block-aware schedule label, e.g. "Mid-Morning (10 AM)". Resolves the
// chore's blockId against a live blockId -> block Map (from
// useChoreBlocks); falls back to the plain start-time label when the
// chore has no block or the map is unavailable. Shared by the Chores
// tab, the Now surface, and the species pages (F137).
export function describeChoreSchedule(chore, blockById) {
  if (chore.blockId && blockById) {
    const b = blockById.get(chore.blockId);
    if (b) return `${b.name} (${displayBlockSide(b.startKind, b.startMinutes)})`;
  }
  return displayStartTime(chore);
}

// ── Days-remaining + last-chance-block (Batch 11.1) ──────────────────
//
// A chore with a window spanning multiple blocks or days can carry a
// `lastChanceBlockId` — the block beyond which it counts as overrun.
// "Anytime" chores (no `blockId`) treat their last-chance block as
// the only block they have, so the pill collapses to "due today".
// Window chores (weekly_window / monthly_last_week_window) walk the
// frequency window's latestDay forward to find the deadline date.
//
// Returns one of:
//   null                     — pill doesn't apply to this chore.
//   { kind: 'overran' }      — deadline has passed.
//   { kind: 'today' }        — deadline lands today, in the future.
//   { kind: 'days', days: N }— N full days until the deadline (≥1).
//
// `now` is the current Date (defaults to new Date()). `blocks` is the
// active block list from useChoreBlocks (camelCase shape).
export function choreDaysRemaining(chore, now = new Date(), blocks = []) {
  if (!chore) return null;
  // New model: the multi-day "window" now lives in the block-reference
  // deadline, not the frequency. Only a weekday-anchored deadline gets a
  // countdown pill; same-day kinds carry their info in the label.
  if (chore.deadline?.kind) {
    if (chore.deadline.kind !== "block_on_weekday") return null;
    const today = startOfDay(now);
    const target = nextWeekdayOnOrAfter(today, chore.deadline.weekday ?? 5);
    const days = Math.round(
      (target.getTime() - today.getTime()) / 86400000
    );
    return days > 0 ? { kind: "days", days } : { kind: "today" };
  }
  const f = chore.frequency;
  const hasWindow =
    f?.type === "weekly_window" || f?.type === "monthly_last_week_window";
  const isOnce = f?.type === "once";
  const isAnytime = !chore.blockId;
  // Daily / specific_days chores with a fixed block aren't "windowy" —
  // they fire on a specific day in a specific block, so no pill.
  if (!hasWindow && !isOnce && !isAnytime) return null;

  const deadlineBlock = chore.lastChanceBlockId
    ? (blocks ?? []).find(b => b.id === chore.lastChanceBlockId)
    : null;

  const today = startOfDay(now);
  let deadlineDate;
  if (isOnce) {
    // One-time chores: the deadline is their date — past it, the pill
    // reads "overran" until the chore is completed (and retired).
    deadlineDate = parseLocalISODate(f.date);
    if (!deadlineDate) return null;
  } else if (hasWindow) {
    deadlineDate = windowDeadlineDate(f, today);
    if (!deadlineDate) return null;
  } else {
    // Anytime daily / anytime specific_days: deadline is today.
    deadlineDate = today;
  }

  // If the deadline is in the future, count whole days.
  if (deadlineDate.getTime() > today.getTime()) {
    const days = Math.round(
      (deadlineDate.getTime() - today.getTime()) / 86400000
    );
    return { kind: "days", days };
  }

  // Deadline day == today. The pill flips to "overran" once the
  // deadline block's window has passed; otherwise it reads "today".
  if (deadlineBlock) {
    const endMin = blockEndMinutesNow(deadlineBlock, now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (endMin !== null && nowMin > endMin) {
      return { kind: "overran" };
    }
  }
  // Deadline is in the past entirely (shouldn't happen for today, but
  // covers the case where the window passed without a last-chance).
  if (deadlineDate.getTime() < today.getTime()) {
    return { kind: "overran" };
  }
  return { kind: "today" };
}

const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Fri Jun 6" — the resolved deadline DATE for a chore whose window
// spans multiple days (the only chores choreDaysRemaining counts down).
// Returns "" for same-day chores, so callers can render it only when a
// real future deadline date applies.
export function displayDeadlineDateShort(chore, now = new Date(), blocks = []) {
  const r = choreDaysRemaining(chore, now, blocks);
  if (!r || r.kind !== "days") return "";
  const d = computeDeadline(chore, now, blocks);
  if (!d) return "";
  return `${DOW_SHORT[d.getDay()]} ${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// Resolve a chore's window deadline date given today. Returns a Date
// pointing at the latest day of the chore's window (start-of-day),
// or null if today isn't inside the window.
function windowDeadlineDate(frequency, today) {
  const dow = today.getDay();
  if (frequency.type === "weekly_window") {
    const latest = frequency.latestDay ?? 5; // default Fri
    if (dow > latest) return null; // today is past this week's window
    const out = new Date(today);
    out.setDate(today.getDate() + (latest - dow));
    return out;
  }
  if (frequency.type === "monthly_last_week_window") {
    if (!isInLastWeekOfMonth(today)) return null;
    const latest = frequency.latestDay ?? 5;
    if (dow > latest) return null;
    const out = new Date(today);
    out.setDate(today.getDate() + (latest - dow));
    return out;
  }
  return null;
}

// End-minutes of a block resolved against `now` (sun-event blocks
// resolve to today's actual times). Returns null if a sunrise/sunset
// can't be computed for this date.
function blockEndMinutesNow(block, now) {
  if (!block) return null;
  let start;
  if (block.startKind === "fixed") {
    start = block.startMinutes;
  } else {
    start = sunMinutesOfDay(now, block.startKind);
  }
  if (typeof start !== "number") return null;
  return start + (block.durationMinutes ?? 0);
}

function startOfDay(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// Human label for a new-model block-reference deadline ({ kind: ... }).
function describeBlockDeadline(d) {
  switch (d.kind) {
    case "following_block": return "by the next block";
    case "block": return d.block === "end_of_day"
      ? "by end of day" : `by end of ${blockSlugLabel(d.block)}`;
    case "midnight": return "by midnight";
    case "block_on_weekday": {
      const wd = DOW_SHORT[d.weekday ?? 5];
      return d.block === "end_of_day"
        ? `by ${wd} end of day` : `by ${wd} ${blockSlugLabel(d.block)}`;
    }
    case "block_at_offset": {
      const off = d.offset_days ?? 0;
      const rel = off === 0 ? "day of"
        : off < 0 ? `${-off}d before` : `${off}d after`;
      return `by ${blockSlugLabel(d.block)} (${rel})`;
    }
    case "none": return "no fixed deadline";
    default: return "—";
  }
}

// Short display for a chore's deadline (relative to its start).
export function displayDeadline(chore) {
  const d = chore.deadline;
  if (d?.kind) return describeBlockDeadline(d);
  switch (d?.type) {
    case "offset_hours": return `within ${d.hours}h of start`;
    case "end_of_day": return "by end of day";
    case "end_of_week_friday": return "by sunset Friday";
    case "end_of_month_week_friday": return "by sunset Friday (last week)";
    default: return "—";
  }
}

// Concrete deadline time as a human string, e.g. "by 10 AM" for a 2-hour
// offset on an 8 AM chore. Used wherever we have an actual day in hand
// (Today tab, Upcoming chores card) — the relative form is reserved for
// abstract definition lists where we don't know what day we're talking about.
export function displayDeadlineConcrete(chore) {
  const d = chore.deadline;
  if (d?.kind) return describeBlockDeadline(d);
  switch (d?.type) {
    case "offset_hours": {
      const [h, m] = (chore.startTime || "00:00").split(":").map(Number);
      let totalH = h + (d.hours || 0);
      const period = totalH >= 12 ? "PM" : "AM";
      totalH = ((totalH + 11) % 12) + 1;
      return m === 0
        ? `by ${totalH} ${period}`
        : `by ${totalH}:${String(m).padStart(2, "0")} ${period}`;
    }
    case "end_of_day": return "by end of day";
    case "end_of_week_friday": return "by sunset Friday";
    case "end_of_month_week_friday": return "by sunset Friday (last week)";
    default: return "—";
  }
}

// ── Per-place obligations (Batches 16.1 + 18) ────────────────────────
// A chore belongs to *something* (its anchor — migration 0014), and
// the anchor determines where its obligations surface:
//
//   anchorType        obligations appear at…
//   ──────────────    ──────────────────────────────────────────────
//   'none'            [null] — one whole-farm obligation
//   'place'           the anchored place, occupied or not (mowing)
//   'occupied_place'  occupied structures in the place's subtree
//                     (pre-0014 behavior; brooder-style chores)
//   'place_kind'      every active place tagged anchorKindTag
//                     (power-wash nest boxes → every coop)
//   'species'         wherever active batches of the species live
//                     right now, narrowed by the optional housed-in
//                     anchorKindTag, collapsed to atPlaceId when the
//                     work happens at a fixed place (egg washing →
//                     layers, at the House)
//   'batch'           same, for one specific livestock group
//
// Returns [] when the anchor resolves nowhere (no active animals, no
// matching places, dangling anchor) — the chore is *dormant* and
// surfaces nothing today. Chores follow the animals: move a batch and
// its obligations move with it; pasture chores stay with the pasture.
//
// `ctx` is the choreCtx object from useSites: { placesById,
// childrenByParent, placementsByPlaceId, groupsById }. Pure + id-only;
// callers sort for display via placesById. Reused by Rounds, the Today
// tab, the dashboard Upcoming card, the All chores tree, and the
// place_status projection (Batch 17) + map tint (Batch 18).
export function obligationPlaceIds(chore, ctx = {}) {
  const {
    placesById, childrenByParent, placementsByPlaceId, groupsById,
    placementsByOccupant,
  } = ctx;
  // Legacy chores (static seeds / pre-0014 rows) have no anchorType;
  // infer the old semantics from place_id.
  const type =
    chore?.anchorType ??
    (chore?.placeId ? "occupied_place" : "none");

  switch (type) {
    case "place":
      return chore.placeId ? [chore.placeId] : [];

    case "occupied_place": {
      const root = chore.placeId ?? null;
      if (root == null) return [null];
      const subtree = descendantIds(root, childrenByParent);
      const hosting = [];
      for (const id of subtree) {
        const occupants = placementsByPlaceId?.get(id) ?? [];
        if (occupants.some((o) => o.occupantType === "batch")) {
          hosting.push(id);
        }
      }
      return hosting.length > 0 ? hosting : [root];
    }

    case "place_kind": {
      if (!chore.anchorKindTag) return [];
      const out = [];
      for (const place of placesById?.values() ?? []) {
        if (place.isActive === false) continue;
        if (place.kindTag === chore.anchorKindTag) out.push(place.id);
      }
      return out;
    }

    case "species":
    case "batch": {
      if (type === "species" && !chore.anchorSpeciesId) return [];
      if (type === "batch" && !chore.anchorBatchId) return [];
      const placeIds = new Set();
      let anyAnimals = false;
      for (const [placeId, occupants] of
           placementsByPlaceId?.entries() ?? []) {
        for (const o of occupants) {
          if (o.occupantType !== "batch") continue;
          if (type === "batch") {
            if (o.occupantId !== chore.anchorBatchId) continue;
          } else {
            const group = groupsById?.get(o.occupantId);
            if (!group || group.speciesId !== chore.anchorSpeciesId) {
              continue;
            }
          }
          const place = placesById?.get(placeId);
          if (
            chore.anchorKindTag &&
            place?.kindTag !== chore.anchorKindTag
          ) {
            continue;
          }
          anyAnimals = true;
          placeIds.add(placeId);
        }
      }
      // No active animals match → dormant, nothing to do anywhere.
      if (!anyAnimals) return [];
      // Fixed work place: the animals' existence creates the
      // obligation, but the work happens somewhere specific.
      if (chore.atPlaceId) return [chore.atPlaceId];
      return [...placeIds];
    }

    case "former_occupancy": {
      // Places of kind anchorKindTag that this batch has OCCUPIED —
      // open OR closed placements. For "clean the place after the batch
      // leaves it" chores: a broiler batch's brooder cleanout must fire
      // on the brooder(s) it sat in, even though the batch has since
      // moved to pasture, so it can't follow the batch's live location.
      if (!chore.anchorBatchId) return [];
      const out = new Set();
      const history =
        placementsByOccupant?.get(`batch:${chore.anchorBatchId}`) ?? [];
      for (const pl of history) {
        const place = placesById?.get(pl.placeId);
        if (!place || place.isActive === false) continue;
        if (chore.anchorKindTag && place.kindTag !== chore.anchorKindTag) {
          continue;
        }
        out.add(pl.placeId);
      }
      return [...out];
    }

    case "none":
    default:
      return [null];
  }
}

// Human-readable label for what a chore belongs to. `ctx` additionally
// carries speciesById (Map<speciesId, { id, name }>) for species names.
//   "Broilers · in tractors"       (species + housed-in filter)
//   "Layers · at House"            (species + fixed work place)
//   "Batch 1 · Broilers"           (one specific batch)
//   "Every coop"                   (place_kind)
//   "Pastures · Pasture B"         (place — parent · name)
//   "Brooders · occupied"          (occupied_place)
//   "Whole farm"                   (none)
//   "Needs re-anchoring"           (dangling anchor)
export function describeChoreAnchor(chore, ctx = {}) {
  const { placesById, groupsById, speciesById } = ctx;
  const type =
    chore?.anchorType ??
    (chore?.placeId ? "occupied_place" : "none");

  const placeLabel = (placeId) => {
    const p = placesById?.get(placeId);
    if (!p) return "(removed place)";
    const parent = p.parentId ? placesById?.get(p.parentId) : null;
    // Skip the farm root as a parent prefix — it adds no information.
    return parent && parent.parentId != null
      ? `${parent.name} · ${p.name}`
      : p.name;
  };
  const kindLabel = (tag) =>
    (tag ?? "").replaceAll("_", " ").trim();

  switch (type) {
    case "place":
      return chore.placeId ? placeLabel(chore.placeId) : "Needs re-anchoring";
    case "occupied_place": {
      if (!chore.placeId) return "Needs re-anchoring";
      const p = placesById?.get(chore.placeId);
      return `${p?.name ?? "(removed place)"} · occupied`;
    }
    case "place_kind":
      return chore.anchorKindTag
        ? `Every ${kindLabel(chore.anchorKindTag)}`
        : "Needs re-anchoring";
    case "species": {
      if (!chore.anchorSpeciesId) return "Needs re-anchoring";
      const sp = speciesById?.get(chore.anchorSpeciesId);
      let label = sp?.name ?? chore.anchorSpeciesId;
      if (chore.anchorKindTag) {
        label += ` · in ${kindLabel(chore.anchorKindTag)}s`;
      }
      if (chore.atPlaceId) {
        const p = placesById?.get(chore.atPlaceId);
        label += ` · at ${p?.name ?? "(removed place)"}`;
      }
      return label;
    }
    case "batch": {
      if (!chore.anchorBatchId) return "Needs re-anchoring";
      const group = groupsById?.get(chore.anchorBatchId);
      const sp = group ? speciesById?.get(group.speciesId) : null;
      let label = group
        ? `${group.label}${sp ? ` · ${sp.name}` : ""}`
        : "Needs re-anchoring";
      if (chore.atPlaceId) {
        const p = placesById?.get(chore.atPlaceId);
        label += ` · at ${p?.name ?? "(removed place)"}`;
      }
      return label;
    }
    case "former_occupancy": {
      if (!chore.anchorBatchId) return "Needs re-anchoring";
      const group = groupsById?.get(chore.anchorBatchId);
      const where = chore.anchorKindTag
        ? `${kindLabel(chore.anchorKindTag)}s it used`
        : "places it used";
      return group ? `${group.label} · ${where}` : `Batch · ${where}`;
    }
    case "none":
    default:
      return "Whole farm";
  }
}
