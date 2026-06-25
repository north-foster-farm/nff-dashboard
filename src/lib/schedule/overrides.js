// Schedule instance overrides (S6 3/3 — S63/S71/S73).
//
// The day is DERIVED (chores fan out, events recur), so most rows have no
// DB row to edit. An edit therefore writes a schedule-local 'override'
// commitment that TARGETS a derived instance (source_ref.target =
// {chore_id, place_id}) and carries its new placement (source_ref.block_id,
// clock_time) + ordering (overrides.order). `applyOverrides` folds those
// onto the place-expanded rows: it relocates the targeted row to its new
// block, retimes it, reorders within a block, and tags it with the edit so
// the modification history (S74) is viewable. Commitment-backed rows
// (ad_hoc / chore / note deltas) are already placed by their own fields
// (foldDeltas buckets them on source_ref.block_id); here we only surface
// their order + history for sorting and display.
//
// Pure + orphan-tolerant: an override whose target no longer appears today
// simply matches nothing.

// A row moved into a block with no explicit order lands at the block's end.
const RELOCATED_BIAS = 1000;

export function targetKey(choreId, placeId) {
  return choreId + "|" + (placeId ?? "");
}

// Apply 'override' commitments to the place-expanded block rows. Returns a
// flat list of { bucket, row, order } the caller regroups by bucket and
// sorts (buckets by start time, rows by order). `isRealBlock(bucket)` tells
// a real block id from the "anytime" fallback.
export function applyOverrides(blockRows, overrides, isRealBlock) {
  const byTarget = new Map();
  for (const o of overrides) {
    const t = o.source_ref?.target;
    if (t?.chore_id) byTarget.set(targetKey(t.chore_id, t.place_id ?? null), o);
  }

  const out = [];
  for (const b of blockRows) {
    b.rows.forEach((row, i) => {
      let bucket = b.bucket;
      let order = i; // derived position keeps unedited rows in place
      let edit = null;

      let assignee = row.assignee ?? null;

      if (row.kind === "chore" && !row.deltaId) {
        // A derived chore instance — relocate/retime/reorder/reassign per
        // its override.
        const o = byTarget.get(targetKey(row.chore.id, row.placeId ?? null));
        if (o) {
          const dest = o.source_ref?.block_id ?? bucket;
          bucket = isRealBlock(dest) ? dest : "anytime";
          if (o.assignee != null) assignee = o.assignee;
          edit = {
            overrideId: o.id,
            clockTime: o.clock_time ?? null,
            history: o.history ?? [],
            cover: o.overrides?.cover ?? null,
          };
          if (o.overrides?.order != null) order = o.overrides.order;
          else if (bucket !== b.bucket) order = i + RELOCATED_BIAS;
        }
      } else {
        // A commitment-backed row — order/history/assignee/cover ride on the
        // commitment.
        const c = row.commitment ?? row.delta ?? null;
        if (c?.overrides?.order != null) order = c.overrides.order;
        if (c?.assignee != null) assignee = c.assignee;
        if (c && (c.history?.length || c.clock_time || c.overrides?.cover)) {
          edit = {
            clockTime: c.clock_time ?? null, history: c.history ?? [],
            cover: c.overrides?.cover ?? null,
          };
        }
      }

      out.push({ bucket, row: { ...row, assignee, ...(edit ? { edit } : {}) }, order });
    });
  }
  return out;
}

// The protection heuristic (S65/S66/S70). With no must/critical flag on
// chores, a "risky" edit is one that moves an item to a DIFFERENT block or
// to ANOTHER day; same-block reorder / retime is silent. Returns
// { protected, why } — `why` explains the protection in concrete terms so
// the double-confirm isn't a generic "are you sure".
export function assessEdit({
  label, fromBucket, fromBlockName, isFirstInBlock, toBlockId, toDate,
}) {
  const movingDay = !!toDate;
  const movingBlock = toBlockId != null && toBlockId !== fromBucket;
  if (!movingDay && !movingBlock) return { protected: false, why: null };

  if (movingDay) {
    return {
      protected: true,
      why: `“${label}” is committed for today. Moving it to another day `
        + `changes the plan you already agreed on.`,
    };
  }
  const where = fromBlockName ? ` from the ${fromBlockName} block` : "";
  const first = isFirstInBlock
    ? " It’s the first task there — animals may depend on it being done on time."
    : "";
  return {
    protected: true,
    why: `Moving “${label}”${where} takes it off its planned window.${first}`,
  };
}
