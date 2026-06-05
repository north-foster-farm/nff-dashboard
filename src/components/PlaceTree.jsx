import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../theme.js";
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
        style={{
          display: "flex", alignItems: "baseline", gap: 8, width: "100%",
          background: T.surfaceAlt,
          border: "none",
          borderLeft: `2px solid ${depth === 0 ? T.accent : T.border}`,
          cursor: "pointer",
          padding: "7px 10px", fontFamily: "inherit", textAlign: "left",
        }}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />
          : <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />}
        <span style={{
          fontFamily: T.uiLabel, fontSize: depth === 0 ? 13 : 12,
          color: subtreeCount > 0 ? T.text : T.textDim,
          textTransform: "uppercase", letterSpacing: "0.12em",
          fontWeight: depth === 0 ? 700 : 600,
          lineHeight: 1.2,
        }}>
          {place.name}
        </span>
        <span style={{
          fontSize: 11, color: T.textMuted,
          whiteSpace: "nowrap", flexShrink: 0, lineHeight: 1.2,
        }}>
          {subtreeCount > 0
            ? `${subtreeCount} ${subtreeCount === 1 ? countNoun : countNoun + "s"}`
            : `no ${countNoun}s`}
        </span>
      </button>
      {open && (
        <div style={{
          borderLeft: `1px solid ${T.border}`,
          marginLeft: 6, paddingLeft: "var(--tree-rail, 12px)",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {ownEntries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
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
        style={{
          display: "flex", alignItems: "baseline", gap: 8, width: "100%",
          background: T.surfaceAlt,
          border: "none",
          borderLeft: `2px solid ${dimmed ? T.border : T.accent}`,
          cursor: "pointer",
          padding: "7px 10px", fontFamily: "inherit", textAlign: "left",
        }}
        aria-expanded={open}
      >
        {open
          ? <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />
          : <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />}
        <span style={{
          fontFamily: T.uiLabel, fontSize: 13,
          color: dimmed ? T.textDim : T.text,
          textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700,
          lineHeight: 1.2,
        }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.2 }}>{subtitle}</span>
        )}
        <span style={{
          fontSize: 11, color: T.textMuted, marginLeft: "auto",
          whiteSpace: "nowrap", flexShrink: 0, lineHeight: 1.2,
        }}>
          {entries.length} {entries.length === 1 ? countNoun : countNoun + "s"}
        </span>
      </button>
      {open && (
        <div style={{
          borderLeft: `1px solid ${T.border}`,
          marginLeft: 6, paddingLeft: "var(--tree-rail, 12px)",
          opacity: dimmed ? 0.7 : 1,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
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
