// Conflicts (Epic E — S56a/b/c the one list, S58 double-booking).
//
// Two conflict kinds surface on the Schedule:
//   • man-down  — an assigned activity falls in a window where its assignee is
//     unavailable (off-site / appointment / day-off). Detected by computeManDown
//     against the day's reservations (manDown.js).
//   • double-book — the SAME person is assigned to two activities whose time
//     windows overlap, with no unavailability involved (S58). Distinct from a
//     man-down: nobody is away, the day is simply over-promised for one person.
//
// This module adds double-book detection and a horizon scan so all conflicts —
// today and the days ahead — can be shown in one list. Pure + tolerant.

import { computeManDown, reservationWindows } from "./manDown.js";
import { rollupChoresForDay } from "./deriveDay.js";
import { resolveAssignee } from "../chores.js";
import { resolveBlockMinutes } from "../sunTimes.js";

function overlaps(aStart, aEnd, bStart, bEnd) {
  if (aStart == null || bStart == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

// Buffer squeezes (S61) — a buffer reserves adjacent time and never moves the
// thing it buffers; it only surfaces the squeeze when OTHER work lands in that
// reserved window. `buffers` are { id, label, startMin, endMin, targetBucket }
// (targetBucket = the buffer's own block, exempt; null for event buffers).
// `rows` are the day's assigned { label, blockStart, blockEnd, bucket }.
// Returns one squeeze per buffer that's encroached, naming the first hit's
// block so the conflict can jump there.
export function bufferSqueezes(buffers, rows) {
  const out = [];
  for (const b of buffers) {
    if (b.startMin == null) continue;
    const hits = rows.filter((r) =>
      r.bucket !== b.targetBucket
      && overlaps(b.startMin, b.endMin, r.blockStart, r.blockEnd));
    if (!hits.length) continue;
    out.push({
      type: "squeeze", bufferId: b.id, bucket: hits[0].bucket,
      label: `${b.label} squeezed`,
      detail: `${hits.length} item${hits.length === 1 ? "" : "s"} land in the reserved window`,
    });
  }
  return out;
}

// Same-person, overlapping, different-block assignments (S58). `rows` are
// { key, label, assignee, blockStart, blockEnd, bucket }. Returns one conflict
// per overlapping pair, deduped by the unordered bucket pair so a block with
// many rows reports the clash once.
export function doubleBookConflicts(rows) {
  const out = [];
  const seen = new Set();
  const byPerson = new Map();
  for (const r of rows) {
    if (!r.assignee || r.blockStart == null) continue;
    if (!byPerson.has(r.assignee)) byPerson.set(r.assignee, []);
    byPerson.get(r.assignee).push(r);
  }
  for (const [assignee, list] of byPerson) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.bucket === b.bucket) continue; // same work session, not a clash
        if (!overlaps(a.blockStart, a.blockEnd, b.blockStart, b.blockEnd))
          continue;
        const pair = [a.bucket, b.bucket].sort().join("|");
        const dedup = assignee + "·" + pair;
        if (seen.has(dedup)) continue;
        seen.add(dedup);
        out.push({
          type: "double", assignee,
          buckets: [a.bucket, b.bucket],
          labels: [a.label, b.label],
        });
      }
    }
  }
  return out;
}

// Resolve a chore block's [start, end) window for a given day.
function blockWindowFor(block, dayDate) {
  if (!block) return { start: null, end: null };
  const start = resolveBlockMinutes(dayDate, block.startKind, block.startMinutes)
    ?? block.startMinutes ?? null;
  if (start == null) return { start: null, end: null };
  return { start, end: start + (block.durationMinutes ?? 0) };
}

// Per-day assigned rows (chore granularity) for the horizon scan. One row per
// chore instance carrying its resolved assignee + its block window.
function assignedRowsForDay(data, dayDate, ruleOpts) {
  const rows = [];
  for (const r of rollupChoresForDay(data, dayDate, ruleOpts)) {
    const w = blockWindowFor(r.block, dayDate);
    for (const inst of r.items) {
      rows.push({
        key: (inst.chore?.id ?? "?") + "@" + r.bucket,
        label: inst.chore?.title ?? "chore",
        assignee: resolveAssignee(inst.chore, dayDate, ruleOpts),
        blockStart: w.start, blockEnd: w.end, bucket: r.bucket,
      });
    }
  }
  return rows;
}

// Scan `days` days starting the day AFTER `fromDate` for conflicts ahead:
// man-downs (an assigned chore overlapping its assignee's reservation that
// day) AND double-bookings (S58 — same person, two overlapping assignments).
// Returns a flat list of { type:'manDown'|'double', date:Date, iso, assignee,
// label, detail }. `reservationsByISO` maps "YYYY-MM-DD" -> reservation rows.
export function scanHorizonConflicts({
  data, fromDate, days, ruleOpts, reservationsByISO, ymd,
}) {
  const out = [];
  const base = new Date(fromDate);
  base.setHours(0, 0, 0, 0);
  for (let i = 1; i <= days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = ymd(d);
    const rows = assignedRowsForDay(data, d, ruleOpts);

    // man-down (only when the day carries reservations)
    const res = reservationsByISO.get(iso) ?? [];
    const windows = res.length ? reservationWindows(res) : [];
    if (windows.length) {
      const md = computeManDown(rows, windows);
      const seen = new Set();
      for (const row of rows) {
        const hit = md.get(row.key);
        if (!hit || seen.has(row.assignee)) continue;
        seen.add(row.assignee);
        out.push({
          type: "manDown", date: d, iso, assignee: row.assignee,
          label: `${row.assignee} unavailable`,
          detail: hit.label
            ? `${hit.label} clashes with assigned work`
            : "off during assigned work",
        });
      }
    }

    // double-book (independent of reservations)
    for (const c of doubleBookConflicts(rows)) {
      out.push({
        type: "double", date: d, iso, assignee: c.assignee,
        label: `${c.assignee} double-booked`,
        detail: c.labels.join(" · "),
      });
    }
  }
  return out;
}
