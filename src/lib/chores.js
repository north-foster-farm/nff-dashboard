// Chore engine. Pure functions that take chore definitions + a date and
// expand them into concrete instances for that day, with computed deadline
// and resolved assignee.

import { CHORE_SEEDS, CHORE_CATEGORIES, CHORE_PERIODS } from "../data/choreSeeds.js";
import { sunMinutesOfDay } from "./sunTimes.js";

export { CHORE_SEEDS, CHORE_CATEGORIES, CHORE_PERIODS };

// The canonical list of chore definitions the app shows. Once a backend
// exists, this source flips to whatever is in the DB and the seeds are used
// only for initial insertion. Demo-tagged chores from the seeds are *always*
// merged in so design fixtures (e.g. the 3 AM "Overnight brooder check"
// that exercises the pre-dawn / Tomorrow timeline rendering) survive even
// after DB-backed chores override the seed list.
export function getAllChoreDefinitions(data) {
  const fromData = data?.chores?.definitions ?? [];
  const demoSeeds = CHORE_SEEDS.filter(c => (c.tags ?? []).includes("demo"));
  if (fromData.length > 0) {
    const existingIds = new Set(fromData.map(c => c.id));
    return [...fromData, ...demoSeeds.filter(c => !existingIds.has(c.id))];
  }
  return CHORE_SEEDS;
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
    default:
      return false;
  }
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

// Resolve a chore's deadline for the given date.
export function computeDeadline(chore, date) {
  const d = chore.deadline;
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

// Resolve who is assigned to the chore on a given day. Assignment precedence:
// 1. explicit byDayOfWeek override, 2. default assignee, 3. null (unassigned).
export function resolveAssignee(chore, date) {
  const a = chore.assignment;
  if (!a) return null;
  const dow = dayOfWeek(date);
  if (a.byDayOfWeek && a.byDayOfWeek[dow]) return a.byDayOfWeek[dow];
  return a.default ?? null;
}

// Expand a chore definition into a concrete instance for `date`, or null if
// it doesn't fire that day.
export function expandChoreForDay(chore, date) {
  if (!isChoreActiveOn(chore, date)) return null;
  return {
    choreId: chore.id,
    chore,
    date,
    startAt: atTime(date, chore.startTime),
    deadlineAt: computeDeadline(chore, date),
    assignee: resolveAssignee(chore, date)
  };
}

// Get all chore instances for a given day. Preserves the canonical seed
// order (which is the order James / Jim work through them in real life).
// Callers that need a different ordering (e.g. the All Chores tab's sort
// dropdown) sort the returned array themselves.
export function getChoresForDay(data, date) {
  const defs = getAllChoreDefinitions(data);
  const instances = [];
  for (const c of defs) {
    const inst = expandChoreForDay(c, date);
    if (inst) instances.push(inst);
  }
  return instances;
}

// Short human-readable string describing a chore's frequency.
export function describeFrequency(chore) {
  const f = chore.frequency;
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (f?.type) {
    case "daily": return "Every day";
    case "specific_days": return (f.days || []).map(d => DOW[d]).join(" & ");
    case "weekly_window":
      return `Weekly — ${DOW[f.preferredDay]} preferred, by ${DOW[f.latestDay]}`;
    case "monthly_last_week_window":
      return `Monthly (last week) — ${DOW[f.preferredDay]} preferred, by ${DOW[f.latestDay]}`;
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
  if (chore.period === "evening") return "After sunset";
  const [h, m] = (chore.startTime || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
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
  const f = chore.frequency;
  const hasWindow =
    f?.type === "weekly_window" || f?.type === "monthly_last_week_window";
  const isAnytime = !chore.blockId;
  // Daily / specific_days chores with a fixed block aren't "windowy" —
  // they fire on a specific day in a specific block, so no pill.
  if (!hasWindow && !isAnytime) return null;

  const deadlineBlock = chore.lastChanceBlockId
    ? (blocks ?? []).find(b => b.id === chore.lastChanceBlockId)
    : null;

  const today = startOfDay(now);
  let deadlineDate;
  if (hasWindow) {
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

// Short label for the days-remaining pill, e.g. "due today" /
// "3 days left" / "overran". Returns "" when no pill applies.
export function displayDaysRemaining(chore, now, blocks) {
  const r = choreDaysRemaining(chore, now, blocks);
  if (!r) return "";
  if (r.kind === "today") return "due today";
  if (r.kind === "overran") return "overran";
  if (r.kind === "days") {
    if (r.days === 1) return "1 day left";
    return `${r.days} days left`;
  }
  return "";
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

// Short display for a chore's deadline (relative to its start).
export function displayDeadline(chore) {
  const d = chore.deadline;
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
