// Chore engine. Pure functions that take chore definitions + a date and
// expand them into concrete instances for that day, with computed deadline
// and resolved assignee.

import { CHORE_SEEDS, CHORE_CATEGORIES, CHORE_PERIODS } from "../data/choreSeeds.js";

export { CHORE_SEEDS, CHORE_CATEGORIES, CHORE_PERIODS };

// The canonical list of chore definitions the app shows. Once a backend
// exists, this source flips to whatever is in the DB and the seeds are used
// only for initial insertion.
export function getAllChoreDefinitions(data) {
  const fromData = data?.chores?.definitions ?? [];
  if (fromData.length > 0) return fromData;
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

// Short display for a chore's start time, respecting evening chores that are
// anchored to sunset rather than a literal clock time.
export function displayStartTime(chore) {
  if (chore.period === "evening") return "After sunset";
  const [h, m] = (chore.startTime || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
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
