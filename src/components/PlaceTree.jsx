import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { childrenOf } from "../lib/places.js";

// Shared place-tree list components. Extracted from Chores.jsx so the
// Now surface, the Chores Today tab, and the All chores tab all render
// the same nested place hierarchy with the same look.
//
// Generic over what an "entry" is — All chores renders definition
// rows, Today / Now render checkable obligation rows. The two render
// modes:
//
//   * hideEmpty=false (All chores): every place renders a header even
//     with nothing beneath it (auto-folded), so the whole farm stays
//     visible while editing definitions.
//   * hideEmpty=true (Today / Now / everywhere else): places whose
//     subtree has no entries don't render at all — the field surfaces
//     show only places with actual work.

// Group flat entries under the place tree. Returns the bag of lookups
// PlaceTreeNode needs:
//   {
//     entriesByPlace: Map<placeId, entry[]>,
//     farmEntries:    entries with no place / sitting at the farm root,
//     subtreeCounts:  Map<placeId, count incl. descendants>,
//     topLevel:       the farm root's children, alphabetical,
//   }
export function groupByPlaceTree({
  entries, getPlaceId, roots, childrenByParent, sortEntries,
}) {
  const byPlace = new Map();
  const farm = [];
  for (const entry of entries ?? []) {
    const pid = getPlaceId(entry);
    if (pid == null) {
      farm.push(entry);
      continue;
    }
    if (!byPlace.has(pid)) byPlace.set(pid, []);
    byPlace.get(pid).push(entry);
  }

  // Subtree counts drive the auto-fold + empty pruning.
  const counts = new Map();
  const walk = (placeId) => {
    let n = (byPlace.get(placeId) ?? []).length;
    for (const child of childrenOf(placeId, childrenByParent)) {
      n += walk(child.id);
    }
    counts.set(placeId, n);
    return n;
  };
  for (const root of roots ?? []) walk(root.id);

  // Entries sitting at the farm root read as whole-farm work.
  for (const root of roots ?? []) {
    farm.push(...(byPlace.get(root.id) ?? []));
    byPlace.delete(root.id);
  }

  if (sortEntries) {
    for (const list of byPlace.values()) list.sort(sortEntries);
    farm.sort(sortEntries);
  }

  const topLevel = [];
  for (const root of roots ?? []) {
    topLevel.push(...childrenOf(root.id, childrenByParent));
  }
  topLevel.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return {
    entriesByPlace: byPlace,
    farmEntries: farm,
    subtreeCounts: counts,
    topLevel,
  };
}

// One place in the tree: accordion header + (when open) its own
// entries followed by its child places. Auto-folds when the whole
// subtree is empty; with hideEmpty the empty header disappears
// entirely instead.
export function PlaceTreeNode({
  place, depth, childrenByParent, entriesByPlace, subtreeCounts,
  renderEntry, keyOf, hideEmpty = false, countNoun = "chore",
}) {
  const subtreeCount = subtreeCounts.get(place.id) ?? 0;
  // User toggle overrides the default (open when there's something to
  // show). Defaults re-derive when data changes: an empty header that
  // gains a chore pops open on its own.
  const [userOpen, setUserOpen] = useState(null);
  const open = userOpen ?? subtreeCount > 0;

  if (hideEmpty && subtreeCount === 0) return null;

  const ownEntries = entriesByPlace.get(place.id) ?? [];
  const children = [...childrenOf(place.id, childrenByParent)]
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : "var(--tree-indent, 18px)" }}>
      {/* Baseline alignment: the name and count are different font
          sizes, so centering their line boxes leaves the count looking
          sunken — aligning their text baselines is what reads as
          "lined up". The chevron self-centers against the row. */}
      {/* F136 — parent place headers carry a subtle alt-surface fill and
          a left rule (accent at the top level, line below) so the
          hierarchy reads by colour as well as indentation, without the
          dark-gray fill that reads as "disabled" (cf. F46/F83). */}
      <button
        onClick={() => setUserOpen(o => (o == null ? !(subtreeCount > 0) : !o))}
        className={
          "flex items-baseline gap-2 w-full bg-surface-alt border-l-2 " +
          "cursor-pointer py-[7px] px-[10px] font-[inherit] text-left " +
          (depth === 0 ? "border-accent" : "border-line")
        }
        aria-expanded={open}
      >
        {open
          ? <ChevronDown size={14} className="text-muted shrink-0 self-center" />
          : <ChevronRight size={14} className="text-muted shrink-0 self-center" />}
        <span className={
          "font-ui uppercase tracking-[0.12em] leading-[1.2] " +
          (depth === 0 ? "text-[13px] font-bold " : "text-[12px] font-semibold ") +
          (subtreeCount > 0 ? "text-fg" : "text-dim")
        }>
          {place.name}
        </span>
        <span className="text-[11px] text-muted whitespace-nowrap shrink-0 leading-[1.2]">
          {subtreeCount > 0
            ? `${subtreeCount} ${subtreeCount === 1 ? countNoun : countNoun + "s"}`
            : `no ${countNoun}s`}
        </span>
      </button>
      {open && (
        <div
          className="border-l border-line ml-1.5 flex flex-col gap-0.5"
          style={{ paddingLeft: "var(--tree-rail, 12px)" }}
        >
          {ownEntries.length > 0 && (
            <div className="flex flex-col gap-px bg-line">
              {ownEntries.map(entry => (
                <div key={keyOf(entry, place.id)}>
                  {renderEntry(entry, place.id)}
                </div>
              ))}
            </div>
          )}
          {children.map(child => (
            <PlaceTreeNode
              key={child.id}
              place={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              entriesByPlace={entriesByPlace}
              subtreeCounts={subtreeCounts}
              renderEntry={renderEntry}
              keyOf={keyOf}
              hideEmpty={hideEmpty}
              countNoun={countNoun}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Flat titled section used for the "Whole farm" / "Dormant" buckets.
export function PlaceTreeSection({
  title, subtitle, entries, renderEntry, keyOf, defaultOpen = true,
  dimmed = false, countNoun = "chore",
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      {/* Baseline alignment — same rationale as PlaceTreeNode. */}
      <button
        onClick={() => setOpen(o => !o)}
        className={
          "flex items-baseline gap-2 w-full bg-surface-alt border-l-2 " +
          "cursor-pointer py-[7px] px-[10px] font-[inherit] text-left " +
          (dimmed ? "border-line" : "border-accent")
        }
        aria-expanded={open}
      >
        {open
          ? <ChevronDown size={14} className="text-muted shrink-0 self-center" />
          : <ChevronRight size={14} className="text-muted shrink-0 self-center" />}
        <span className={
          "font-ui text-[13px] uppercase tracking-[0.12em] font-bold " +
          "leading-[1.2] " +
          (dimmed ? "text-dim" : "text-fg")
        }>
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] text-muted leading-[1.2]">{subtitle}</span>
        )}
        <span className="text-[11px] text-muted ml-auto whitespace-nowrap shrink-0 leading-[1.2]">
          {entries.length} {entries.length === 1 ? countNoun : countNoun + "s"}
        </span>
      </button>
      {open && (
        <div
          className={
            "border-l border-line ml-1.5 " +
            (dimmed ? "opacity-70" : "opacity-100")
          }
          style={{ paddingLeft: "var(--tree-rail, 12px)" }}
        >
          <div className="flex flex-col gap-px bg-line">
            {entries.map(entry => (
              <div key={keyOf(entry, null)}>
                {renderEntry(entry, null)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
