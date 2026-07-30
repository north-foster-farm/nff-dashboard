// Pure helpers for the Performance sub-tab. Operates on the camelCase
// run shape returned by useRunHistory / useChoreRuns and the
// camelCase block shape from useChoreBlocks.
//
// Sun-event blocks resolve their start against each run's run_date,
// not today — so a run from three weeks ago compares against THAT
// day's sunrise / sunset, not the current one. This keeps the
// histogram and overrun rates honest as the year advances.

import { resolveBlockMinutes } from "./sunTimes.js";

// Minutes-of-day a run was started (0..1439), or null if missing.
export function runStartMinutes(run) {
  const t = run?.startedAt;
  if (!(t instanceof Date) || Number.isNaN(t.getTime())) return null;
  return t.getHours() * 60 + t.getMinutes();
}

// Minutes-of-day a run was ended, or null if missing.
export function runEndMinutes(run) {
  const t = run?.endedAt;
  if (!(t instanceof Date) || Number.isNaN(t.getTime())) return null;
  return t.getHours() * 60 + t.getMinutes();
}

// Length of a run in minutes (rounded down). Returns null if either
// side is missing.
export function runDurationMinutes(run) {
  if (!(run?.startedAt instanceof Date) || !(run?.endedAt instanceof Date)) {
    return null;
  }
  const ms = run.endedAt.getTime() - run.startedAt.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60_000);
}

// Resolve the block's nominal start to minutes-of-day for the given
// run's calendar date (run_date is a YYYY-MM-DD string, parsed in
// local time). Returns null when a sun-event can't be computed.
export function nominalStartMinutes(block, run) {
  if (!block) return null;
  const date = parseRunDate(run);
  if (!date) return null;
  return resolveBlockMinutes(date, block.startKind, block.startMinutes);
}

// Resolve the block's nominal end (start + duration) for the run's
// date, or null if start can't be computed.
export function nominalEndMinutes(block, run) {
  const start = nominalStartMinutes(block, run);
  if (start === null) return null;
  return start + (block.durationMinutes ?? 0);
}

// True when the run started after its block's nominal start. Strict
// comparison — exactly-on-the-dot doesn't count.
export function runIsLate(run, block) {
  const startedMin = runStartMinutes(run);
  const nominalMin = nominalStartMinutes(block, run);
  if (startedMin === null || nominalMin === null) return null;
  return startedMin > nominalMin;
}

// Minutes the run ran past the nominal end, or 0 if it didn't. Uses
// run_date-resolved nominal end for sun-event blocks. A run that
// crosses midnight wraps runEndMinutes into the small hours — unwrap
// it past the start so it compares against the (also unwrapped)
// nominal end instead of silently reading as "ended early".
export function runOverrunMinutes(run, block) {
  let endedMin = runEndMinutes(run);
  const nominalEnd = nominalEndMinutes(block, run);
  if (endedMin === null || nominalEnd === null) return null;
  const startedMin = runStartMinutes(run);
  if (startedMin !== null && endedMin < startedMin) endedMin += 1440;
  if (endedMin <= nominalEnd) return 0;
  return endedMin - nominalEnd;
}

// Aggregate stats for a list of runs against a block. Only runs in
// the 'done' state with both start + end stamps participate. Returns:
//   {
//     count:           runs considered,
//     lateRate:        0..1 (or null if no usable runs),
//     overrunRate:     0..1 (ditto),
//     medianDuration:  minutes (or null),
//     p25Duration:     minutes (or null),
//     p75Duration:     minutes (or null),
//     medianOverrun:   minutes past end (median, or null),
//     medianStartDelta: median minutes-from-nominal-start
//                       (positive = late, negative = early; null if
//                       no usable runs),
//   }
export function summarizeRuns(runs, block) {
  const usable = (runs ?? []).filter(r =>
    r.state === "done" && r.startedAt && r.endedAt
  );
  if (usable.length === 0 || !block) {
    return {
      count: 0, lateRate: null, overrunRate: null,
      medianDuration: null, p25Duration: null, p75Duration: null,
      medianOverrun: null, medianStartDelta: null,
    };
  }
  const durations = [];
  const overruns = [];
  const startDeltas = [];
  let lateCount = 0;
  let overrunCount = 0;
  let lateUsable = 0;
  let overrunUsable = 0;
  for (const r of usable) {
    const dur = runDurationMinutes(r);
    if (dur !== null) durations.push(dur);
    const over = runOverrunMinutes(r, block);
    if (over !== null) {
      overruns.push(over);
      overrunUsable += 1;
      if (over > 0) overrunCount += 1;
    }
    const late = runIsLate(r, block);
    if (late !== null) {
      lateUsable += 1;
      if (late) lateCount += 1;
    }
    const startedMin = runStartMinutes(r);
    const nominalMin = nominalStartMinutes(block, r);
    if (startedMin !== null && nominalMin !== null) {
      startDeltas.push(startedMin - nominalMin);
    }
  }
  return {
    count: usable.length,
    lateRate:    lateUsable === 0    ? null : lateCount    / lateUsable,
    overrunRate: overrunUsable === 0 ? null : overrunCount / overrunUsable,
    medianDuration: median(durations),
    p25Duration:    quantile(durations, 0.25),
    p75Duration:    quantile(durations, 0.75),
    medianOverrun:  median(overruns),
    medianStartDelta: median(startDeltas),
  };
}

// Bin start times for a histogram. Bins are `binMinutes` wide and
// span [domainStart, domainEnd] minutes-of-day. Each bin is the
// count of runs whose start-minutes-of-day falls inside it.
export function histogramBins(runs, block, opts = {}) {
  const { binMinutes = 10, padBefore = 60, padAfter = 60 } = opts;
  if (!block) return null;
  // Pick a domain that includes every run's start-minute as well as
  // the block's nominal window. Sun-event blocks have a different
  // nominal each day, so we expand the domain to cover the run-by-
  // run nominals plus the runs themselves.
  const usable = (runs ?? []).filter(r => r.state === "done" && r.startedAt);
  const startMins = usable.map(runStartMinutes).filter(v => v !== null);
  const nominalsStart = usable.map(r => nominalStartMinutes(block, r))
    .filter(v => v !== null);
  const nominalsEnd = usable.map(r => nominalEndMinutes(block, r))
    .filter(v => v !== null);
  const candidates = [...startMins, ...nominalsStart, ...nominalsEnd];
  if (candidates.length === 0) return null;
  const lo = Math.max(0, Math.min(...candidates) - padBefore);
  const hi = Math.min(1440, Math.max(...candidates) + padAfter);
  const domainStart = Math.floor(lo / binMinutes) * binMinutes;
  const domainEnd   = Math.ceil(hi / binMinutes) * binMinutes;
  const count = Math.max(1, Math.round((domainEnd - domainStart) / binMinutes));
  const bins = new Array(count).fill(0);
  for (const m of startMins) {
    const idx = Math.min(count - 1, Math.floor((m - domainStart) / binMinutes));
    if (idx >= 0) bins[idx] += 1;
  }
  return {
    bins,
    domainStart,
    domainEnd,
    binMinutes,
    // Median nominal start across the runs (so the histogram has a
    // sensible vertical line for sun-event blocks too — the line
    // sits at the typical-day position over the window).
    nominalStartMedian: median(nominalsStart),
    nominalEndMedian: median(nominalsEnd),
    maxCount: bins.reduce((m, n) => Math.max(m, n), 0),
  };
}

// ── Tiny stats helpers ──────────────────────────────────────────────
export function median(values) {
  return quantile(values, 0.5);
}

export function quantile(values, q) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ── Date plumbing ───────────────────────────────────────────────────

// Parse a chore_runs.run_date (YYYY-MM-DD, no timezone) into a local
// Date for sun-event resolution. We anchor at noon to avoid the DST
// "spring forward" hour producing a sunrise on the previous day.
function parseRunDate(run) {
  if (!run?.runDate) return null;
  const [y, m, d] = run.runDate.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

// Format minutes-of-day as the H AM/PM short clock string used on
// the histogram axis.
export function formatHourLabel(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return "";
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}${period}`;
}

// Format a duration in minutes as "1h 12m" / "47m".
export function formatDurationMinutes(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
    return "—";
  }
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Format a number 0..1 as a percent string "37%". Returns "—" for null.
export function formatRate(rate) {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}
