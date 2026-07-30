export function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

export function formatISODate(d) {
  return d.toISOString().slice(0, 10);
}

export function todayUTC() {
  const t = new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export function formatLongDate(iso) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}

export function formatTime12h(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0
    ? `${h12}${period === "PM" ? " PM" : " AM"}`
    : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function computeAge(knownAge) {
  if (!knownAge || knownAge.weeks == null || !knownAge.asOfDate) return "Unknown";
  const asOfMs = Date.parse(knownAge.asOfDate + "T00:00:00Z");
  if (isNaN(asOfMs)) return "Unknown";
  const dayDiff = Math.round((Date.now() - asOfMs) / 86400000);
  return formatAge(Math.max(0, knownAge.weeks * 7 + dayDiff));
}

export function formatAge(days) {
  if (days <= 28) {
    const w = Math.max(1, Math.round(days / 7));
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  const totalMonths = days / 30.4375;
  if (totalMonths < 12) {
    const m = Math.max(1, Math.round(totalMonths));
    return `${m} month${m === 1 ? "" : "s"}`;
  }
  const wholeYears = Math.floor(totalMonths / 12);
  const remM = Math.round(totalMonths - wholeYears * 12);
  if (remM === 0) return `${wholeYears} year${wholeYears === 1 ? "" : "s"}`;
  if (remM === 12) return `${wholeYears + 1} year${wholeYears + 1 === 1 ? "" : "s"}`;
  return `${wholeYears} year${wholeYears === 1 ? "" : "s"}, ${remM} month${remM === 1 ? "" : "s"}`;
}
