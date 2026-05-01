import { parseISODate, formatISODate } from "./dates.js";

function expandWeekly(instance, kind, fromDate, toDate) {
  const r = instance.recurrence;
  const seasonStart = parseISODate(r.seasonStart);
  const seasonEnd = parseISODate(r.seasonEnd);
  if (!seasonStart || !seasonEnd) return [];
  const effStart = seasonStart > fromDate ? seasonStart : fromDate;
  const effEnd = seasonEnd < toDate ? seasonEnd : toDate;
  if (effStart > effEnd) return [];
  const out = [];
  const cursor = new Date(effStart);
  while (cursor.getUTCDay() !== r.dayOfWeek) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor > effEnd) return out;
  }
  while (cursor <= effEnd) {
    out.push({
      date: formatISODate(cursor),
      startTime: r.startTime,
      endTime: r.endTime,
      kindId: kind.id,
      kindLabel: kind.label,
      instanceId: instance.id,
      instanceLabel: instance.label,
      subtitle: instance.subtitle,
      location: instance.location,
      recurring: true
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

function expandSingle(instance, kind, fromDate, toDate) {
  const d = parseISODate(instance.date);
  if (!d || d < fromDate || d > toDate) return [];
  return [
    {
      date: instance.date,
      startTime: instance.startTime,
      endTime: instance.endTime,
      kindId: kind.id,
      kindLabel: kind.label,
      instanceId: instance.id,
      instanceLabel: instance.label,
      subtitle: instance.subtitle,
      location: instance.location,
      recurring: false
    }
  ];
}

export function getEventOccurrences(eventsData, fromDate, toDate, filters) {
  const all = [];
  for (const kind of eventsData.kinds) {
    if (filters && filters[kind.id] === false) continue;
    for (const inst of kind.instances) {
      if (inst.recurrence) all.push(...expandWeekly(inst, kind, fromDate, toDate));
      else if (inst.date) all.push(...expandSingle(inst, kind, fromDate, toDate));
    }
  }
  all.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startTime || "").localeCompare(b.startTime || "")
  );
  return all;
}
