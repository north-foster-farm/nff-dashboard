// modifiers.js — pure helpers for chore modifiers (Batch 23).
//
// A chore_modifiers row is a date-bound override on a chore:
//   skip            — the chore isn't needed that day
//   replace         — do this instead (replacement_text)
//   prepend         — extra instruction before the normal chore
//   restrict_until  — finish earlier than usual (replacement_text holds
//                     the human deadline, e.g. "by 2 PM")
//
// Conflict resolution (v1, per the chores-overhaul decision): priority
// based and deterministic — no manual resolver. Highest priority wins;
// ties break to the most recently created row. The losers still render
// (ghosted) so nothing silently disappears; tap-to-explain shows
// winner + losers + where each came from.
//
// Framework-free and side-effect-free, mirroring lib/chores.js.
// Operates on the camelCase shapes useChoreModifiers exposes.

export const MODIFIER_ACTION_LABEL = {
  skip: "Skip today",
  replace: "Do instead",
  prepend: "Extra step",
  restrict_until: "Earlier deadline",
};

// All modifiers that apply to a chore on a date, winner first.
// `placeId` (optional): modifiers with a target_place_id only apply to
// that place's obligation rows; null-place modifiers apply everywhere.
export function modifiersFor(modifiers, choreId, dateISO, placeId = null) {
  const applicable = (modifiers ?? []).filter(m =>
    m.targetChoreId === choreId
    && m.occursOn === dateISO
    && (!m.expiresAt || new Date(m.expiresAt).getTime() > Date.now())
    && (!m.targetPlaceId || !placeId || m.targetPlaceId === placeId)
  );
  return applicable.sort(byWinner);
}

// Winner ordering: priority desc, then created_at desc (newest wins
// ties), then id for full determinism.
function byWinner(a, b) {
  return (b.priority - a.priority)
    || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    || (a.id ?? "").localeCompare(b.id ?? "");
}

// The resolved view a chore row renders from:
//   { winner, losers, all } — or null when nothing applies.
export function resolveModifiers(modifiers, choreId, dateISO, placeId) {
  const all = modifiersFor(modifiers, choreId, dateISO, placeId);
  if (all.length === 0) return null;
  return { winner: all[0], losers: all.slice(1), all };
}

// Display effects of the winning modifier on a chore row.
//   skipped       — render ghosted / don't count as required
//   replaceText   — show instead of the chore title
//   prependText   — show as an extra instruction line
//   deadlineText  — human deadline override text
export function applyModifier(resolved) {
  if (!resolved) {
    return {
      skipped: false, replaceText: null, prependText: null,
      deadlineText: null,
    };
  }
  const w = resolved.winner;
  return {
    skipped: w.action === "skip",
    replaceText: w.action === "replace" ? w.replacementText : null,
    prependText: w.action === "prepend" ? w.replacementText : null,
    deadlineText: w.action === "restrict_until" ? w.replacementText : null,
  };
}

// Human description of where a modifier came from, for tap-to-explain.
export function describeModifierSource(modifier, processTitleById) {
  if (modifier.source === "process") {
    const title = modifier.processExpansionId
      ? processTitleById?.get(modifier.processExpansionId)
      : null;
    return title ? `Process: ${title}` : "A process";
  }
  if (modifier.source === "automation") return "An automation";
  return modifier.createdByEmail
    ? `Added by ${modifier.createdByEmail.split("@")[0]}`
    : "Added by hand";
}

// Count of chores in a list that carry at least one modifier today —
// the Schedule-at-a-glance rollup badge.
export function countModified(modifiers, choreIds, dateISO) {
  const idSet = new Set(choreIds);
  const seen = new Set();
  for (const m of modifiers ?? []) {
    if (m.occursOn !== dateISO) continue;
    if (!idSet.has(m.targetChoreId)) continue;
    seen.add(m.targetChoreId);
  }
  return seen.size;
}
