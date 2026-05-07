import SunCalc from "suncalc";

// Foster, RI — same coordinates the weather widget uses. Hardcoded
// for now; future improvement is to pull from a farm-location setting.
const FARM_LAT = 41.7948;
const FARM_LON = -71.7515;

// Resolve a date + sun-event ('sunrise' | 'sunset') to minutes-of-day
// at the farm's coordinates. Returns null if SunCalc can't compute
// (polar regions in deep winter / summer — moot for Rhode Island but
// the guard keeps the function safe to call).
export function sunMinutesOfDay(date, kind) {
  if (kind !== "sunrise" && kind !== "sunset") return null;
  const times = SunCalc.getTimes(date, FARM_LAT, FARM_LON);
  const t = times[kind];
  if (!(t instanceof Date) || Number.isNaN(t.getTime())) return null;
  return t.getHours() * 60 + t.getMinutes();
}

// Resolve a chore_block's start or end to a concrete minutes-of-day
// for a given date. `kind` is 'fixed' | 'sunrise' | 'sunset' and
// `fixedMinutes` is used only when kind === 'fixed'.
export function resolveBlockMinutes(date, kind, fixedMinutes) {
  if (kind === "fixed") return fixedMinutes ?? null;
  return sunMinutesOfDay(date, kind);
}

// Format a minutes-of-day integer as "6:00 AM" / "1:30 PM". Imported
// here as well as in useChoreBlocks so the formatting stays in lock-
// step everywhere we display block times.
export function formatMinutesOfDay(minutes) {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) return "";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return min === 0
    ? `${h12} ${period}`
    : `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

// Display label for a block side: a fixed clock time, or the literal
// word "sunrise" / "sunset" so block windows read naturally even
// before SunCalc has been consulted.
export function displayBlockSide(kind, fixedMinutes) {
  if (kind === "sunrise") return "sunrise";
  if (kind === "sunset")  return "sunset";
  return formatMinutesOfDay(fixedMinutes);
}
