// placeStatus.js — the derived `place_status` projection (Batch 17).
//
// Pure helpers that turn today's chore definitions + completions +
// occupancy into per-obligation and per-place status. This is a
// client-side projection, not a table: the same inputs the Rounds
// surface already loads are folded into the two questions the Now
// surface (Batch 17) and the map tint (Batch 18) keep asking:
//
//   - "what needs doing right now, and is any of it overdue?"
//     (per-obligation: due / overdue / done)
//   - "how is this place doing?" (per-place rollup, propagated up the
//     tree so a zone can be tinted by everything beneath it)
//
// Framework-free and side-effect-free, mirroring lib/chores.js and
// lib/places.js. Operates on the camelCase shapes the hooks expose.

import {
  isChoreActiveOn, choreDaysRemaining, obligationPlaceIds,
} from "./chores.js";
import { placePath } from "./places.js";
import { resolveBlockMinutes } from "./sunTimes.js";

// Status of a single not-yet-done obligation. Window chores lean on
// the days-remaining math (overran == past the deadline block); daily
// chores in a block flip to overdue once today's block window has
// ended without a completion.
export function obligationStatus(chore, done, now, blocks) {
  if (done) return "done";
  const remaining = choreDaysRemaining(chore, now, blocks);
  if (remaining?.kind === "overran") return "overdue";
  if (remaining) return "due";
  // Daily / specific-day chores tied to a block: overdue once the
  // block's resolved window for today has fully passed.
  const block = (blocks ?? []).find((b) => b.id === chore.blockId);
  if (block) {
    const start = resolveBlockMinutes(now, block.startKind, block.startMinutes);
    if (start !== null) {
      const end = start + (block.durationMinutes ?? 0);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > end) return "overdue";
    }
  }
  return "due";
}

// Compute the full projection.
//
//   computePlaceStatus({
//     definitions,         // chore defs (camelCase, DB-backed)
//     blocks,              // chore blocks (camelCase)
//     choreCtx,            // useSites().choreCtx — anchor fan-out
//                          // lookups (places, placements, groups)
//     isDone,              // (choreId, placeId) => boolean
//     now,                 // Date (defaults to new Date())
//   })
//
// Returns:
//   {
//     obligations: [{ chore, placeId, block, done, status }],
//          // status: 'done' | 'due' | 'overdue'; one entry per
//          // (chore, place) obligation active today
//     byPlace: Map<placeId|null, { total, done, due, overdue }>,
//          // rolled up: an obligation at Mobile Coop 1 also counts
//          // toward Pasture B and the farm root above it
//     flagOf(placeId): 'overdue' | 'due' | 'done' | 'idle',
//   }
export function computePlaceStatus({
  definitions,
  blocks,
  choreCtx,
  isDone,
  now = new Date(),
}) {
  const placesById = choreCtx?.placesById;
  const blockById = new Map((blocks ?? []).map((b) => [b.id, b]));
  const obligations = [];

  for (const chore of definitions ?? []) {
    if (!isChoreActiveOn(chore, now)) continue;
    // Dormant anchors (no active animals / no matching places) fan out
    // to nothing — the chore simply isn't on today's list.
    const placeIds = obligationPlaceIds(chore, choreCtx);
    for (const placeId of placeIds) {
      const done = isDone ? isDone(chore.id, placeId) : false;
      obligations.push({
        chore,
        placeId,
        block: chore.blockId ? blockById.get(chore.blockId) ?? null : null,
        done,
        status: obligationStatus(chore, done, now, blocks),
      });
    }
  }

  // Per-place rollup, propagated to ancestors. Placeless obligations
  // accumulate under the `null` key only.
  const byPlace = new Map();
  const bump = (key, status) => {
    if (!byPlace.has(key)) {
      byPlace.set(key, { total: 0, done: 0, due: 0, overdue: 0 });
    }
    const c = byPlace.get(key);
    c.total += 1;
    if (status === "done") c.done += 1;
    else if (status === "overdue") c.overdue += 1;
    else c.due += 1;
  };
  for (const o of obligations) {
    if (o.placeId == null) {
      bump(null, o.status);
      continue;
    }
    for (const p of placePath(o.placeId, placesById)) {
      bump(p.id, o.status);
    }
  }

  const flagOf = (placeId) => {
    const c = byPlace.get(placeId ?? null);
    if (!c || c.total === 0) return "idle";
    if (c.overdue > 0) return "overdue";
    if (c.due > 0) return "due";
    return "done";
  };

  return { obligations, byPlace, flagOf };
}
