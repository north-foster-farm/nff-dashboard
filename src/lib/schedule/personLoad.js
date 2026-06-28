// Per-person day-load model — the data behind the Rethinker two-lane
// ribbon (DESIGN-SYSTEM Phase 1/3). Turns the day's blocks + reservations
// into, per admin, a set of time-positioned segments:
//   - their assigned block work (done / committed),
//   - their off-site / break / day-off reservations (event),
//   - man-down holes (assigned work overlapping their own off-site).
//
// Assignment today is partial — resolveAssignee returns null for chores no
// rule names — so a lane only shows blocks where that person actually has
// assigned rows. That's deliberately honest: the ribbon surfaces the
// per-person load we really track (assignments + reservations + holes),
// not a guess. Pure + tolerant: never throws on malformed input.

// "James · Jim" -> ["James","Jim"]; null/garbage -> [].
export function personsFor(assignee) {
  if (!assignee) return [];
  return String(assignee).split("·").map((s) => s.trim()).filter(Boolean);
}

// blocks: [{ bucket, name, startMin, endMin, rows: [{ key, assignee, done }] }]
// windows: reservationWindows() output [{ assignee, kind, label, startMin, endMin }]
// manDownKeys: Set of row.key that are man-down (assigned but off-site).
// dayStart/dayEnd (optional, minutes): widen the axis to the whole working
//   day even where a stretch has no assigned work, so the ribbon reads as
//   the day's full shape rather than just the busy span.
// Returns { lanes: [{ name, segments }], axisStart, axisEnd } in minutes.
export function buildPersonLanes({
  admins, blocks, windows, manDownKeys, dayStart, dayEnd,
}) {
  const keys = manDownKeys ?? new Set();
  const lanes = (admins ?? []).map((name) => {
    const segments = [];
    for (const b of blocks ?? []) {
      if (b.startMin == null || b.endMin == null) continue;
      const mine = (b.rows ?? []).filter(
        (r) => personsFor(r.assignee).includes(name));
      if (mine.length === 0) continue;
      const done = mine.filter((r) => r.done).length;
      const hole = mine.some((r) => keys.has(r.key));
      // give a zero/short block a visible minimum so it still reads.
      const endMin = Math.max(b.endMin, b.startMin + 20);
      segments.push({
        id: "blk|" + name + "|" + b.bucket,
        kind: hole ? "hole" : done === mine.length ? "done" : "committed",
        startMin: b.startMin,
        endMin,
        label: b.name,
        meta: done + "/" + mine.length,
      });
    }
    for (const w of windows ?? []) {
      if (w.assignee !== name) continue;
      if (w.startMin == null || w.endMin == null) continue;
      segments.push({
        id: "res|" + name + "|" + w.startMin,
        kind: w.kind === "break" ? "break" : "event",
        startMin: w.startMin,
        endMin: w.endMin,
        label: w.label ?? (w.kind === "day_off" ? "Off" : w.kind ?? "Out"),
      });
    }
    segments.sort((a, b) => a.startMin - b.startMin);
    return { name, segments };
  });

  let lo = Number.isFinite(dayStart) ? dayStart : Infinity;
  let hi = Number.isFinite(dayEnd) ? dayEnd : -Infinity;
  for (const l of lanes) {
    for (const s of l.segments) {
      lo = Math.min(lo, s.startMin);
      hi = Math.max(hi, s.endMin);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 6 * 60; hi = 20 * 60; }
  const axisStart = Math.floor(lo / 60) * 60;
  const axisEnd = Math.max(Math.ceil(hi / 60) * 60, axisStart + 60);
  return { lanes, axisStart, axisEnd };
}
