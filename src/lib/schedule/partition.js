// The ribbon partitioner — Project blocks (and, later, Overnight).
//
// Derives the day's NEGATIVE space — the time between chore blocks — into
// Project segments. A Project block is the available time in a gap BETWEEN
// chore blocks, or BEFORE the first one (the window AFTER the last chore
// block is Overnight, added in a later batch — not here).
//
// Pure + tolerant: bad input yields fewer segments, never throws. Computed
// client-side from chore-block DEFINITIONS (occurrence-based) + sun-times, so
// it works offline. Project time is bounded by a farm-wide default band
// (earliest start / latest end); a per-day override is deferred (scope). Gaps
// are trimmed by buffer windows (whole-farm reserved time) and annotated with
// who's free (per-person availability after their own reservations). A gap
// shorter than MIN_PROJECT_GAP, or with nobody free, yields no segment.
//
// This decouples from the React data hooks on purpose — it imports only the
// pure sun-time / reservation / buffer helpers, so it stays unit-testable.

import { resolveBlockMinutes } from "../sunTimes.js";
import { reservationWindows } from "./manDown.js";
import { storedBufferWindow } from "./buffers.js";

// Farm-wide defaults (v1 — the per-day override editor is deferred).
export const PROJECT_DEFAULT_START = 8 * 60; // 8:00a earliest project start
export const PROJECT_DEFAULT_END = 18 * 60; // 6:00p latest project end
export const MIN_PROJECT_GAP = 30; // skip gaps shorter than this
export const PARTITION_ADMINS = ["James", "Jim"];

// Subtract an array of [s,e) "hole" intervals from a base [s,e) interval.
// Returns 0+ disjoint intervals (ascending). Holes may overlap / be unsorted.
export function subtractIntervals(base, holes) {
  let segs = [{ s: base.s, e: base.e }];
  for (const h of holes ?? []) {
    if (!(h.e > h.s)) continue;
    const next = [];
    for (const seg of segs) {
      if (h.e <= seg.s || h.s >= seg.e) {
        next.push(seg);
        continue;
      }
      if (h.s > seg.s) next.push({ s: seg.s, e: Math.min(h.s, seg.e) });
      if (h.e < seg.e) next.push({ s: Math.max(h.e, seg.s), e: seg.e });
    }
    segs = next.filter((x) => x.e > x.s);
  }
  return segs;
}

// All ACTIVE block windows that occur on `date`, resolved to minutes-of-day
// and sorted by start. "Occurs" = the block definition is active (a daily
// time window); whether it has chores that day is irrelevant to the partition
// (occurrence-based — so project time is well-defined even on a quiet day).
export function occurringBlockWindows(date, blocks) {
  return (blocks ?? [])
    .filter((b) => b.isActive)
    .map((b) => {
      const start = resolveBlockMinutes(date, b.startKind, b.startMinutes);
      if (start == null || !Number.isFinite(start)) return null;
      return { start, end: start + (b.durationMinutes ?? 0) };
    })
    .filter((w) => w && Number.isFinite(w.end))
    .sort((a, b) => a.start - b.start);
}

// Merge overlapping / touching windows into disjoint ones (sorted by start).
// Chore blocks normally don't overlap, but a sun-resolved block and a fixed one
// CAN on some days — and a naive between-consecutive gap walk would then carve
// a "gap" straight through an earlier block that ends late (its end exceeds a
// later block's start). Merging to the union first makes the gaps true negative
// space and gives the overnight anchor the real last-block end.
export function mergeWindows(wins) {
  const out = [];
  for (const w of (wins ?? [])) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ start: w.start, end: w.end });
  }
  return out;
}

// who's-free for a [s,e) segment: each admin is "free" if they have any
// uncovered minute in the segment (after subtracting THEIR reservations).
// Returns structured { freeCount, who:[names] } so a consumer can branch on
// "both free" vs "one free" without re-deriving (kept structured per scope).
export function whoFree(segment, resWindows) {
  const who = [];
  for (const name of PARTITION_ADMINS) {
    const holes = (resWindows ?? [])
      .filter((w) => w.assignee === name)
      .map((w) => ({ s: w.startMin, e: w.endMin }));
    if (subtractIntervals({ s: segment.s, e: segment.e }, holes).length > 0) {
      who.push(name);
    }
  }
  return { freeCount: who.length, who };
}

// ── Overnight (the trailing wrap-around) ─────────────────────────────────
//
// The Overnight block owns the gap from the LAST chore block tonight to the
// FIRST chore block tomorrow — the one window the Project partitioner leaves
// out (P-B1). It belongs to two calendar days: it's the last segment on the
// day it starts and the first segment on the day it ends, with the same
// contents. Bucket ids are stable so both day pages address the one shift.
export const OVERNIGHT_LEAD = "overnight:lead";   // continued from last night
export const OVERNIGHT_TRAIL = "overnight:trail"; // continues into tomorrow

// The overnight window for the night that STARTS on `date` and ends on
// `nextDate`: `[lastChoreEnd(date), firstStart(nextDate))`. `startMin` is
// minutes-of-day on the start date (< 1440, the evening edge); `endMin` is
// minutes-of-day on the end date (the pre-dawn edge). Occurrence-based (O-B2):
// anchored to block DEFINITIONS that occur each day, not to which blocks have
// work. Returns null when either side has no occurring frame — a true down day
// has no anchor, so no Overnight (O-B1).
export function overnightWindow(date, nextDate, blocks) {
  const today = mergeWindows(occurringBlockWindows(date, blocks));
  const tom = mergeWindows(occurringBlockWindows(nextDate, blocks));
  if (today.length === 0 || tom.length === 0) return null;
  // Last block END today = the latest end across merged windows (the last
  // merged window, since they're sorted + disjoint); first block START
  // tomorrow = the earliest start (the first merged window).
  const startMin = today[today.length - 1].end;
  const endMin = tom[0].start;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
  return { startMin, endMin };
}

// Does a minutes-of-day time fall inside an overnight window, on the given
// side of midnight? `side` "evening" = the start date (time at/after the last
// chore block); "dawn" = the end date (time before the first chore block,
// half-open so an item exactly at the first block's start belongs to that
// block, not Overnight — O-B3). The two sides are disjoint (evening minutes
// are late, dawn minutes early), so a timed item is caught by at most one.
export function inOvernight(win, minutes, side) {
  if (win == null || minutes == null || !Number.isFinite(minutes)) return false;
  return side === "evening" ? minutes >= win.startMin : minutes < win.endMin;
}

// Derive the Project segments for a day. Returns ordered segments:
//   { kind:'project', startMin, endMin, durationMin, who:{freeCount,who} }
// Excludes the after-last-block window (that is Overnight, added later).
export function projectGaps({
  date,
  blocks,
  reservations = [],
  buffers = [],
  defaultStart = PROJECT_DEFAULT_START,
  defaultEnd = PROJECT_DEFAULT_END,
}) {
  // Merge to the union first so overlapping blocks can't leave a "gap" that
  // runs through a block ending late (see mergeWindows).
  const wins = mergeWindows(occurringBlockWindows(date, blocks));
  if (wins.length === 0) return []; // no chore frame → no project time

  // Candidate gaps: before the first block, then between consecutive blocks.
  // (After the last block belongs to Overnight, never a Project block.)
  const candidates = [{ s: defaultStart, e: wins[0].start }];
  for (let i = 0; i < wins.length - 1; i++) {
    candidates.push({ s: wins[i].end, e: wins[i + 1].start });
  }

  const resWins = reservationWindows(reservations);
  const bufHoles = (buffers ?? [])
    .map((b) => storedBufferWindow(b))
    .filter(Boolean)
    .map((w) => ({ s: w.startMin, e: w.endMin }));

  const out = [];
  for (const c of candidates) {
    // Clamp to the farm-wide band; drop inverted/empty gaps (the DST /
    // sun-drift safety clamp — a winter sunset block can invert a summer gap).
    const s = Math.max(c.s, defaultStart);
    const e = Math.min(c.e, defaultEnd);
    if (e - s < MIN_PROJECT_GAP) continue;
    // Subtract whole-farm buffer windows → 1+ sub-gaps (a buffer mid-gap
    // splits project time rather than shrinking one edge).
    for (const sub of subtractIntervals({ s, e }, bufHoles)) {
      const durationMin = sub.e - sub.s;
      if (durationMin < MIN_PROJECT_GAP) continue;
      const who = whoFree(sub, resWins);
      if (who.freeCount === 0) continue; // nobody home → no segment (absent)
      out.push({
        kind: "project",
        startMin: sub.s,
        endMin: sub.e,
        durationMin,
        who,
      });
    }
  }
  return out;
}
