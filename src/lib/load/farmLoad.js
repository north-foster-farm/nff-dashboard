// farmLoad — the one day-load model (Round 3, harvest-remix).
//
// A THIN PRESENTATION COLLAPSE over the existing walks — it reads, it never
// replaces deriveDay or the chore engine. It folds what were several separate,
// per-surface computations (Schedule's inline `daySilhouette` and
// `weekFullness`) into one model consumed by all four pages, so
// adding/removing a block on Chores › Blocks redraws every day-load (G1), and
// projects ride the same model (G2/G3). The day's warming (warn/due) folds the
// same `choreDaysRemaining` countdown the chore pills read (F24).
//
// Folded — not forked: the week field calls the SAME `weekFullness` the
// Schedule used, and the per-block counts reuse `rollupChoresForDay` +
// `obligationPlaceIds` + `resolveAssignee` + the `computeManDown` overlap test.
// Nothing is re-derived; this is why it cannot drift from the surfaces it
// replaces.
import { rollupChoresForDay } from "../schedule/deriveDay.js";
import {
  weekFullness, weekDays,
} from "../schedule/weekView.js";
import { getEventOccurrences } from "../recurrence.js";
import {
  computeManDown,
  reservationWindows,
} from "../schedule/manDown.js";
import { doubleBookConflicts } from "../schedule/conflicts.js";
import {
  obligationPlaceIds,
  resolveAssignee,
  choreDaysRemaining,
} from "../chores.js";
import { projectGaps } from "../schedule/partition.js";
import { resolveBlockMinutes } from "../sunTimes.js";

// (Round-3 NO-LEGACY) The `heatColor` ramp + the `loadColor` state→fill map
// are GONE: the day-load no longer paints a continuous should-heat gradient
// (F24 collapses warming to a binary warn/due signal — see `warming` below)
// and the LoadSpine now colors bars by KIND directly (chore = --c-chore,
// project = --c-project; F23/F26), not by a load-state ramp.

// A block's resolved [start, start+duration) window for the day, or nulls for
// the block-less "anytime" bucket. Mirrors Schedule's `blockWindow`.
function blockWindowFor(block, date) {
  if (!block) return { startMin: null, endMin: null };
  const start = resolveBlockMinutes(date, block.startKind, block.startMinutes)
    ?? block.startMinutes ?? null;
  if (start == null) return { startMin: null, endMin: null };
  return { startMin: start, endMin: start + (block.durationMinutes ?? 0) };
}

// Expand one rollup's chore instances to per-(chore, place) rows, the same
// PLACE-major fan-out Schedule + Rounds walk. Extras (ad-hoc/project/note
// deltas) are counted but not place-expanded here.
function rowsForRollup(rollup, date, choreCtx, ruleOpts, completions) {
  const rows = [];
  for (const inst of rollup.items) {
    const placeIds = obligationPlaceIds(inst.chore, choreCtx ?? {});
    const assignee = resolveAssignee(inst.chore, date, ruleOpts);
    for (const pid of placeIds) {
      rows.push({
        key: "c|" + inst.chore.id + "|" + (pid ?? ""),
        choreId: inst.chore.id,
        placeId: pid,
        assignee: assignee ?? null,
        done: !!completions?.isDone?.(inst.chore.id, pid),
      });
    }
  }
  return rows;
}

// The one day-load model.
//
//   farmLoad({ data, date, ruleOpts, choreCtx, completions, deltas, nowMin })
//
// Returns:
//   { dayISO, blocks, projects, week, warming, totals }
//   blocks: [{ blockId, name, kind:'chore', startMin, endMin,
//              total, done, projectCount, state, window }]
//   projects: [{ id, title, startMin, endMin, durationMin, planned, who }]
//   week: the folded weekFullness output (+ per-day `events`)
//   warming: { warn:[…], due:[…], byBucket } — binary warn/due per day (F24)
//     entries: { choreId, title, level:'warn'|'due', daysLeft }
//   totals: { items, chores, blocks, blocksAll, projects, projectsDistinct,
//             done, uncovered }
export function farmLoad({
  data,
  date,
  ruleOpts,
  choreCtx,
  completions,
  deltas = [],
  nowMin = null,
}) {
  const rollups = rollupChoresForDay(data, date, ruleOpts);

  // Reservation windows + man-down, computed over the day's flat rows (same
  // inputs Schedule's `manDown` memo uses).
  const reservations = deltas.filter((d) => d.source_type === "reservation");
  const windows = reservationWindows(reservations);

  const perBlock = rollups.map((r) => {
    const win = blockWindowFor(r.block, date);
    const rows = rowsForRollup(r, date, choreCtx, ruleOpts, completions);
    // Countable extras: ad-hoc tasks + pulled chores carry a real obligation;
    // notes are markers and never count (matches Schedule's `counts`).
    const extras = (r.extras ?? []).filter((e) => e.source_type !== "note");
    const extrasDone = extras.filter((e) => e.state === "done").length;
    const total = rows.length + extras.length;
    const done = rows.filter((x) => x.done).length + extrasDone;
    return { rollup: r, win, rows, total, done };
  });

  // Man-down across every assigned row, using each row's block window.
  const flat = [];
  for (const b of perBlock) {
    for (const row of b.rows) {
      flat.push({
        key: row.key, assignee: row.assignee,
        blockStart: b.win.startMin, blockEnd: b.win.endMin,
      });
    }
  }
  const manDown = computeManDown(flat, windows);

  const blocks = perBlock.map((b) => {
    const hole = b.rows.some((row) => manDown.has(row.key));
    let state;
    if (hole) state = "hole";
    else if (b.total > 0 && b.done === b.total) state = "done";
    else if (
      nowMin != null && b.win.startMin != null && b.win.endMin != null
    ) {
      if (nowMin >= b.win.startMin && nowMin < b.win.endMin) state = "now";
      else if (nowMin >= b.win.endMin) state = "over";
      else state = "future";
    } else state = "committed";
    return {
      blockId: b.rollup.bucket,
      name: b.rollup.block?.name ?? "Anytime",
      kind: "chore",
      startMin: b.win.startMin,
      endMin: b.win.endMin,
      total: b.total,
      done: b.done,
      projectCount: 0,
      state,
      window: { startMin: b.win.startMin, endMin: b.win.endMin },
    };
  });

  // Warming (F24/F25) — the BINARY replacement for the old should-heat
  // gradient (see `dayWarming` below). Same `choreDaysRemaining` the chore
  // pills read, so it can't disagree. The week pane reuses `dayWarming` per
  // day for its own ClockAlert marker.
  const warming = dayWarming({ data, date, ruleOpts, choreCtx, completions });

  // Projects (G2/G3): the day's negative-space Project blocks become
  // interstitial bars on the SAME model — not just the Schedule rail. Lifted
  // from deriveDay's `projectGaps` walk. `who.freeCount` is the simplified MVP
  // availability annotation. `planned` (F11/F26): a gap reads PLANNED when a
  // real project step occupies it (a project_node delta whose clock_time
  // lands in the window); else UNPLANNED → blue cross-hatch.
  const dayISO = ymdLocal(date);
  const projNodeMins = deltas
    .filter((d) => d.source_type === "project_node")
    .map((d) => hmToMin(d.clock_time))
    .filter((t) => t != null);
  const segments = projectGaps({
    date,
    blocks: ruleOpts?.blocks ?? [],
    reservations,
    buffers: deltas.filter(
      (d) => d.source_type === "buffer" && d.source_ref?.scope !== "all"),
  });
  const projects = segments.map((seg, i) => {
    const placed = projNodeMins.some(
      (t) => seg.startMin != null && t >= seg.startMin && t < seg.endMin);
    // Round 4: `placed` alone decides — the old "first gap counts as
    // planned whenever any project is active" clause (an auto-pull
    // mirror, long retired) painted the first bar solid on days with
    // nothing placed, disagreeing with the spine.
    const planned = placed;
    // The bar's hover label describes the GAP, not a borrowed project name
    // (labelling every gap with `activeProjects[0].title` was wrong — it leaked
    // an unrelated project's name onto free time). Planned reads "Project";
    // unplanned reads "Free project block"; both append who's free.
    const free = seg.who?.freeCount ?? 0;
    const whoTxt = free >= 2 ? "both free"
      : free === 1 ? (seg.who?.who?.[0] ?? "") + " free" : "";
    const title = (planned ? "Project" : "Free project block")
      + (whoTxt ? " · " + whoTxt : "");
    return {
      id: seg.id ?? "proj|" + i,
      title,
      startMin: seg.startMin,
      endMin: seg.endMin,
      durationMin: seg.durationMin
        ?? ((seg.endMin ?? 0) - (seg.startMin ?? 0)),
      planned,
      who: seg.who ?? null,
    };
  });

  // Week: FOLD the existing walk (call it, don't re-derive) — this is what
  // guarantees the model reproduces the old surface exactly. (The old
  // `weekShouldHeat` fold is gone with the should-heat gradient — F24.)
  const weekBase = weekFullness(data, date, ruleOpts);

  // Per-day event presence across the week (F17 — the week-pane "E" marker).
  // One expansion over the week's UTC range (mirrors deriveDay's dayUTC), then
  // bucketed by occurrence ISO. Cancelled occurrences don't count.
  const wd = weekDays(date);
  const toUTC = (d) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const eventsByISO = new Map();
  if (data.events?.kinds) {
    for (const o of getEventOccurrences(
      data.events, toUTC(wd[0]), toUTC(wd[6]), null)) {
      if (o.status === "cancelled") continue;
      eventsByISO.set(o.date, (eventsByISO.get(o.date) ?? 0) + 1);
    }
  }
  const week = {
    ...weekBase,
    days: weekBase.days.map((d) => ({
      ...d, events: eventsByISO.get(ymdLocal(d.date)) ?? 0,
    })),
  };

  const items = blocks.reduce((s, b) => s + b.total, 0);
  const doneCount = blocks.reduce((s, b) => s + b.done, 0);
  const uncovered = new Set([...manDown.keys()]).size;
  // Counter fix (42.3 round 3): "chores" counts CHORE obligations only —
  // one-off tasks and placed project steps aren't chores; and the project
  // count is DISTINCT projects worked on the day, not project gaps.
  const chores = perBlock.reduce((s, b) => s + b.rows.length, 0);
  const projectsDistinct = new Set(
    deltas
      .filter((d) => d.source_type === "project_node")
      .map((d) => d.source_ref?.project_id)
      .filter(Boolean)).size;

  // The drawable day-load spine (G2/G3): chore-block bars + the day's project
  // segments as `kind:"project"` bars, interleaved in time order. This is what
  // a LoadSpine renders — projects ride the SAME model, not a separate rail.
  // Project bars carry `total:0` (no item count — F23: counts are dropped) and
  // never affect `totals.items`; their bar height is duration-driven (F26) and
  // `planned` decides solid-slate vs blue cross-hatch.
  const projectBars = projects.map((p) => ({
    blockId: p.id,
    name: p.title,
    kind: "project",
    startMin: p.startMin,
    endMin: p.endMin,
    durationMin: p.durationMin,
    planned: p.planned,
    total: 0,
    done: 0,
    projectCount: 1,
    state: "project",
    window: { startMin: p.startMin, endMin: p.endMin },
    who: p.who,
  }));
  const spine = [...blocks, ...projectBars].sort(
    (a, b) => (a.startMin ?? 1e9) - (b.startMin ?? 1e9));

  return {
    dayISO,
    blocks,
    spine,
    projects,
    week,
    warming,
    totals: {
      items,
      chores,
      blocks: blocks.filter((b) => b.total > 0).length,
      // Blocks as the user sees them: chore blocks + project gaps (events
      // join this count when they enter the day-load model — slice 5).
      blocksAll: blocks.filter((b) => b.total > 0).length + projects.length,
      projects: projects.length,
      projectsDistinct,
      done: doneCount,
      uncovered,
    },
  };
}

// Warming (F24/F25) — the BINARY replacement for the old should-heat gradient.
// A deferrable chore is one of two things on `date`:
//   DUE   = its deadline is today (or already overran) → red signal;
//   WARN  = its deadline lands later THIS SAME week    → warn (amber).
// `choreDaysRemaining` is the same countdown the chore pills read, so this
// can't disagree with them. A chore whose every obligation is already done
// drops out (nothing to warn). Returns { warn:[…], due:[…], byBucket } —
// `byBucket` keys the per-block badge by the rollup bucket (= a block's
// `blockId`); each entry names the chore + days-left (F25). Exported so the
// focal day-load AND the week pane (per day) read the same classification.
export function dayWarming({ data, date, ruleOpts, choreCtx, completions }) {
  const blocksList = ruleOpts?.blocks ?? [];
  const daysLeftInWeek = 6 - date.getDay(); // Sun-first week; Sat = 0 left.
  const rollups = rollupChoresForDay(data, date, ruleOpts);
  const warn = [];
  const due = [];
  const byBucket = new Map();
  const seen = new Set();
  for (const r of rollups) {
    for (const inst of r.items) {
      const chore = inst.chore;
      if (seen.has(chore.id)) continue;
      // Skip a chore whose every obligation is already done.
      const placeIds = obligationPlaceIds(chore, choreCtx ?? {});
      if (placeIds.length
        && placeIds.every((pid) => completions?.isDone?.(chore.id, pid))) {
        continue;
      }
      const rem = choreDaysRemaining(chore, date, blocksList);
      if (!rem) continue;
      let level = null;
      let daysLeft = 0;
      if (rem.kind === "today" || rem.kind === "overran") {
        level = "due";
      } else if (rem.kind === "days" && rem.days <= daysLeftInWeek) {
        level = "warn";
        daysLeft = rem.days;
      }
      if (!level) continue;
      seen.add(chore.id);
      const entry = { choreId: chore.id, title: chore.title, level, daysLeft };
      (level === "due" ? due : warn).push(entry);
      const bucket = r.bucket;
      if (!byBucket.has(bucket)) byBucket.set(bucket, { warn: [], due: [] });
      byBucket.get(bucket)[level].push(entry);
    }
  }
  return { warn, due, byBucket };
}

// Per-day conflict count using the SAME engine as the focal day (NOT the
// horizon scan's lighter `assignedRowsForDay`): rollup → place-expanded rows,
// then `computeManDown` against that day's reservation windows PLUS
// `doubleBookConflicts` over the same rows. This is what lets the week pane
// mark every day with a conflict count that matches what selecting the day
// would show (F17).
//
// `overrides` matters: a man-down often only exists because a schedule-local
// 'override' delta RELOCATED a chore into a block that overlaps a reservation
// (or reassigned it). We mirror `applyOverrides`' man-down-relevant effects —
// block move (→ a new window) + reassignment — onto the derived rows before
// computing; without it the raw rollup leaves the chore in its default block
// and the conflict vanishes. Buffer squeezes stay focal-only (they need the
// day's buffer windows). `reservations` / `overrides` = that day's
// materialized commitments.
export function dayConflictCount({
  data, date, ruleOpts, choreCtx, completions,
  reservations = [], overrides = [],
}) {
  const byTarget = new Map();
  for (const o of overrides) {
    const t = o.source_ref?.target;
    if (t?.chore_id) {
      byTarget.set(t.chore_id + "|" + (t.place_id ?? ""), {
        blockId: o.source_ref?.block_id ?? null,
        assignee: o.assignee ?? null,
      });
    }
  }
  const blocksById = new Map(
    (ruleOpts?.blocks ?? []).map((b) => [b.id, b]));

  const rollups = rollupChoresForDay(data, date, ruleOpts);
  const flat = [];
  for (const r of rollups) {
    for (const row of rowsForRollup(r, date, choreCtx, ruleOpts, completions)) {
      const ov = byTarget.get(row.choreId + "|" + (row.placeId ?? ""));
      // Block-move override relocates the row to a real target block's window.
      const block = ov?.blockId && blocksById.has(ov.blockId)
        ? blocksById.get(ov.blockId) : r.block;
      const win = blockWindowFor(block, date);
      flat.push({
        key: row.key,
        assignee: ov?.assignee ?? row.assignee, // reassignment override
        blockStart: win.startMin, blockEnd: win.endMin,
      });
    }
  }
  const windows = reservationWindows(reservations);
  const manDown = windows.length ? computeManDown(flat, windows).size : 0;
  return manDown + doubleBookConflicts(flat).length;
}

// "HH:MM" → minutes-of-day, or null (mirrors Schedule's `hmToMin`; kept local
// to route project_node placements into their gap window for the F26 planned
// test).
function hmToMin(hm) {
  if (!hm) return null;
  const [h, m] = String(hm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Local YYYY-MM-DD (mirrors Schedule's `ymdLocal`; kept local to avoid a new
// import cycle).
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
