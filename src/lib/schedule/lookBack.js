// Looking-back / routine-drift engine (S11 / Epic L). Derives the "did the
// routine hold?" reads from two durable sources:
//   - ACTUALS: the commitments exec history (useRunHistory) — per chore block,
//     when work actually started/ended each day.
//   - PLANNED: schedule.confirmed_day captures — the agreed shape of each day.
// Two outputs: per-block start-time drift (are chores creeping later? S117/
// S86) and per-day plan-vs-actual (did the shape hold? S116/S91/S119). This
// is for LEARNING the routine, never grading a person (S120) — nothing here
// is per-person.

function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function mean(xs) {
  if (!xs.length) return null;
  return Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
}

function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Per-block start-time drift. `runs` from useRunHistory (blockId, runDate,
// state, startedAt). `blocks` from useChoreBlocks (id, name) — drives order +
// labels. Splits the window at `splitDays` ago into recent vs prior, and
// compares mean start (minutes of day). `deltaMin > 0` = starting LATER =
// the drift we're trying to spot. Blocks with no started runs are skipped.
export function blockStartDrift(runs, blocks, splitDays = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - splitDays);
  const cutoffISO = isoLocal(cutoff);

  const byBlock = new Map();
  for (const r of runs) {
    if (!r.startedAt) continue;
    if (!byBlock.has(r.blockId)) {
      byBlock.set(r.blockId, { recent: [], prior: [] });
    }
    const bucket = r.runDate >= cutoffISO ? "recent" : "prior";
    byBlock.get(r.blockId)[bucket].push(minutesOfDay(r.startedAt));
  }

  const out = [];
  for (const b of blocks ?? []) {
    const g = byBlock.get(b.id);
    if (!g || (!g.recent.length && !g.prior.length)) continue;
    const recentAvg = mean(g.recent);
    const priorAvg = mean(g.prior);
    out.push({
      blockId: b.id,
      name: b.name,
      recentAvg,
      priorAvg,
      samples: g.recent.length + g.prior.length,
      deltaMin:
        recentAvg != null && priorAvg != null ? recentAvg - priorAvg : null,
    });
  }
  return out;
}

// Per-day plan-vs-actual. `captures` = confirmed_day rows ({subject_id, doc})
// newest-first (readCaptures order). `runs` = useRunHistory rows. Returns one
// review per confirmed day (deduped, newest-first): planned block/entry counts
// vs how many blocks actually ran to done.
export function dayReviews(captures, runs) {
  const ranByDate = new Map();
  for (const r of runs) {
    if (!ranByDate.has(r.runDate)) ranByDate.set(r.runDate, []);
    ranByDate.get(r.runDate).push(r);
  }

  const seen = new Set();
  const reviews = [];
  for (const c of captures ?? []) {
    const date = c.subject_id ?? c.doc?.date;
    if (!date || seen.has(date)) continue; // newest capture per day wins
    seen.add(date);
    const dayRuns = ranByDate.get(date) ?? [];
    reviews.push({
      date,
      plannedBlocks: c.doc?.blocks?.length ?? 0,
      plannedEntries: c.doc?.entries?.length ?? 0,
      ranBlocks: dayRuns.filter((r) => r.state === "done").length,
      confirmedAt: c.doc?.confirmed_at ?? null,
    });
  }
  return reviews;
}
