// Man-down detection (S8) + non-work-time windows (S7).
//
// A "man-down" is an assigned activity that falls in a window where its
// assignee is unavailable — they're off-site (at the market), on a break,
// out for an appointment, or off for the day. Unavailability is recorded as
// a `reservation` commitment (S7) carrying a person + a time window; this
// module turns those into conflicts the Schedule surfaces as a one-line
// "needs cover" leak, and picks who can cover.
//
// Pure + tolerant: malformed times are skipped, never thrown.

export const ADMINS = ["James", "Jim"];

// "13:00" / "13:00:00" -> 780 (minutes past midnight). null on garbage.
export function parseHHMM(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return Number.isFinite(min) ? min : null;
}

// A `reservation` commitment -> { assignee, kind, label, startMin, endMin }.
// A day-off covers the whole day; a window with no end defaults to 30 min.
export function reservationWindow(res) {
  const kind = res.source_ref?.kind ?? "off_site";
  const series = res.source_ref?.series ?? null;
  if (kind === "day_off") {
    return {
      assignee: res.assignee, kind, label: res.source_ref?.label ?? "Day off",
      startMin: 0, endMin: 1440, series,
    };
  }
  const startMin = parseHHMM(res.clock_time);
  if (startMin == null) return null;
  const endMin = parseHHMM(res.source_ref?.end) ?? startMin + 30;
  return {
    assignee: res.assignee, kind, label: res.source_ref?.label ?? null,
    startMin, endMin, series,
  };
}

// Normalise the day's `reservation` deltas into windows (skipping junk).
export function reservationWindows(reservations) {
  const out = [];
  for (const r of reservations ?? []) {
    const w = reservationWindow(r);
    if (w && w.assignee) out.push({ ...w, id: r.id });
  }
  return out;
}

// A block window [start, start+duration) overlaps a reservation [s, e] when
// the block starts on/before the reservation ends and ends after it starts.
// The inclusive start touch is deliberate: a chore due exactly when someone
// gets back from off-site still needs cover (the market hand-off case).
function overlaps(blockStart, blockEnd, w) {
  return blockStart <= w.endMin && blockEnd > w.startMin;
}

// Map each conflicted row key -> the reservation that conflicts. `rows` are
// { key, assignee, blockStart, blockEnd }. Rows with no assignee or no time
// are never man-down.
export function computeManDown(rows, windows) {
  const out = new Map();
  for (const r of rows) {
    if (!r.assignee || r.blockStart == null || r.blockEnd == null) continue;
    const hit = windows.find(
      (w) => w.assignee === r.assignee && overlaps(r.blockStart, r.blockEnd, w));
    if (hit) out.set(r.key, hit);
  }
  return out;
}

// Who can cover an activity the assignee can't: the other admin, flagged
// `free` when they have no overlapping reservation of their own. Only
// admins have an "other" — for anyone else there is nobody to suggest.
export function pickCoverPerson(assignee, windows, blockStart, blockEnd) {
  if (!ADMINS.includes(assignee)) return null;
  const other = ADMINS.find((a) => a !== assignee);
  if (!other) return null;
  const busy = windows.some(
    (w) => w.assignee === other && overlaps(blockStart, blockEnd, w));
  return { person: other, free: !busy };
}
