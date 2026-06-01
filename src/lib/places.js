// places.js — pure helpers for the recursive place tree.
//
// The farm is modelled as one tree (farm -> zones -> areas ->
// structures); see migration 0009 `places`. These helpers turn the flat
// row list the hooks load into a tree and answer the two questions the
// UI keeps asking:
//
//   - "what places are inside this one?" (subtree fan-out) — a chore
//     scoped to Pasture C applies to Mobile Coop 1 / 2 beneath it. This
//     replaces the old two-level site -> locations fan-out.
//   - "how do I name this place so Dad isn't confused?" — name + bold
//     parent, since "Mobile Coop 1" exists under more than one pasture.
//
// Framework-free and side-effect-free, mirroring lib/recurrence.js and
// lib/calendarMath.js. Operates on the camelCase place shape the hooks
// expose: { id, parentId, name, kind, kindTag, code, mobile, sortOrder,
// isActive }.

// Build lookup structures from a flat list. Children are sorted by
// sortOrder then name so render order is stable.
export function buildPlaceTree(places) {
  const list = places ?? [];
  const byId = new Map();
  const childrenByParent = new Map();
  for (const p of list) byId.set(p.id, p);
  for (const p of list) {
    const key = p.parentId ?? null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(p);
  }
  for (const arr of childrenByParent.values()) {
    arr.sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? "")
    );
  }
  const roots = childrenByParent.get(null) ?? [];
  return { byId, childrenByParent, roots };
}

// Every place id in the subtree rooted at placeId, INCLUDING placeId
// itself. Iterative so deep trees can't blow the stack. Cycle-safe via
// the visited set (defensive — the tree shouldn't contain cycles).
export function descendantIds(placeId, childrenByParent) {
  const out = new Set();
  if (placeId == null || !childrenByParent) return out;
  const stack = [placeId];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    for (const child of childrenByParent.get(id) ?? []) stack.push(child.id);
  }
  return out;
}

// Root -> self chain of place objects. Useful for breadcrumbs and for
// the Rounds "which top-level place does this sit under?" grouping.
export function placePath(placeId, byId) {
  const chain = [];
  if (!byId) return chain;
  let cur = byId.get(placeId);
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return chain;
}

// Display tuple for D1 disambiguation: the place's own name plus its
// immediate parent's name (render the parent bold). Non-unique names
// ("Mobile Coop 1" under both Pasture B and C) stay distinguishable.
export function displayPlace(place, byId) {
  if (!place) return { name: "", parentName: null };
  const parent = place.parentId && byId ? byId.get(place.parentId) : null;
  return { name: place.name, parentName: parent?.name ?? null };
}

// Convenience: the active immediate children of a place (or of the root
// when placeId is null), already sorted.
export function childrenOf(placeId, childrenByParent) {
  return (childrenByParent?.get(placeId ?? null) ?? []).filter(
    (p) => p.isActive !== false
  );
}
