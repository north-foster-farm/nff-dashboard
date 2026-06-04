import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Copy, Pencil, Trash2, ChevronDown, ChevronRight, CloudOff,
  Sparkles,
} from "lucide-react";
import { T } from "../theme.js";
import {
  getAllChoreDefinitions, getChoresForDay, describeFrequency,
  displayStartTime, displayDeadline, displayDeadlineConcrete,
  obligationPlaceIds, describeChoreAnchor,
} from "../lib/chores.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useSites } from "../lib/data/useSites.js";
import { buildPlaceTree, childrenOf } from "../lib/places.js";
import {
  useChoreBlocks, formatMinutesOfDay,
} from "../lib/data/useChoreBlocks.js";
import { displayBlockSide, resolveBlockMinutes } from "../lib/sunTimes.js";
import ActivityRow from "../components/ActivityRow.jsx";
import { blockIcon } from "../components/BlockBadge.jsx";
import ModifierBadges from "../components/ModifierBadge.jsx";
import { useChoreModifiers } from "../lib/data/useChoreModifiers.js";
import { resolveModifiers, applyModifier } from "../lib/modifiers.js";
import { formatISODate, todayUTC } from "../lib/dates.js";
import ChoresBlocksTab from "../components/ChoresBlocksTab.jsx";
import ChoresPerformanceTab from "../components/ChoresPerformanceTab.jsx";
import ChoreMessageButton from "../components/ChoreMessageButton.jsx";
import ChoreRemainingPill from "../components/ChoreRemainingPill.jsx";
import AssignmentRulesEditor from "../components/AssignmentRulesEditor.jsx";
import {
  PlaceTreeNode, PlaceTreeSection,
} from "../components/PlaceTree.jsx";
import { useRoute, navigate, usePersistedState } from "../lib/router.js";

// The page renders its own header (title + tabs) in place of the generic
// SectionHeader, so it can fit a tab bar + inline actions.

const TABS = [
  { id: "today", label: "Today" },
  { id: "all", label: "All chores" },
  { id: "blocks", label: "Blocks" },
  { id: "performance", label: "Performance" },
  { id: "activity", label: "Activity log" }
];

// Who the Today tab is filtering chores for. This is deliberately
// independent of the signed-in account: the farm runs on one shared
// device as often as not, so whoever is holding the phone picks the
// farmhand whose chores they're doing (James or Jim) via the selector.
// Defaults to James.
const USERS = ["James", "Jim"];

export default function Chores({ data }) {
  // The active tab lives in the URL (/chores/<tab>) so reloads and the
  // back button keep the user on the same tab.
  const route = useRoute();
  const tab = TABS.some(t => t.id === route.choresTab)
    ? route.choresTab
    : "today";
  const setTab = (id) =>
    navigate(id === "today" ? "/chores" : `/chores/${id}`);
  const [currentUser, setCurrentUser] = useState("James");

  return (
    <div>
      <h2 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, marginBottom: 14 }}>Chores</h2>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "today" && <TodayTab data={data} currentUser={currentUser} onChangeUser={setCurrentUser} />}
      {tab === "all" && <AllChoresTab data={data} />}
      {tab === "blocks" && <ChoresBlocksTab />}
      {tab === "performance" && <ChoresPerformanceTab />}
      {tab === "activity" && <ActivityLogTab data={data} />}
    </div>
  );
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24 }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? T.accent : "transparent"}`,
              padding: "10px 18px",
              cursor: "pointer",
              color: isActive ? T.text : T.textDim,
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: -1,
              transition: "color 140ms ease, border-color 140ms ease"
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Jump nav (sub-tab navigation) ───────────────────────────────────────────
// Sticky horizontal chip strip that scrolls a section of the list
// below into view: block groups on the Today tab, top-level places on
// the All chores tab. Sticky works against the document scroll (the
// app deliberately has no inner scroll containers), so the chips stay
// reachable however long the list grows.

// Height the sticky strip occupies — sections set scroll-margin-top to
// this so a jump never hides the section header underneath the strip.
const JUMP_NAV_OFFSET = 56;

function JumpNav({ items, onJump }) {
  if (!items || items.length < 2) return null;
  return (
    <nav
      className="no-scrollbar"
      style={{
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: 6,
        overflowX: "auto",
        padding: "10px 0",
        marginBottom: 10,
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onJump(it.id)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: T.surface, border: `1px solid ${T.border}`,
            color: T.textDim, fontFamily: "inherit", fontSize: 11,
            fontWeight: 600, padding: "5px 10px", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em",
            whiteSpace: "nowrap", flexShrink: 0,
          }}
          title={`Jump to ${it.label}`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </nav>
  );
}

// Scroll a jump-nav target into view, compensating for the sticky
// strip via the section's scroll-margin-top.
function jumpToSection(domId) {
  const el = document.getElementById(domId);
  if (!el) return;
  el.style.scrollMarginTop = `${JUMP_NAV_OFFSET}px`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Today ───────────────────────────────────────────────────────────────────

function TodayTab({ data, currentUser, onChangeUser }) {
  const [scope, setScope] = useState("mine"); // "mine" | "all"
  // Collapsed block groups (issue: long lists need folding). Persisted
  // per session, keyed by block id ("anytime" for the no-block group).
  const [collapsedBlocks, setCollapsedBlocks] = usePersistedState(
    "chores:today-collapsed", []
  );
  const collapsedSet = useMemo(
    () => new Set(collapsedBlocks), [collapsedBlocks]
  );
  const toggleCollapsed = (key) => setCollapsedBlocks(prev =>
    prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
  );
  const today = useMemo(() => new Date(), []);
  const { rulesByChoreId, rulesByBlockId } = useChoreAssignmentRules();
  // Block schedule: powers the block-grouped Today tab AND is threaded
  // into the engine so new-model block-reference deadlines + block-
  // derived start times resolve against the live block times.
  const { blocks } = useChoreBlocks();
  const instances = useMemo(
    () => getChoresForDay(
      data, today, { rulesByChoreId, rulesByBlockId, blocks }
    ),
    [data, today, rulesByChoreId, rulesByBlockId, blocks]
  );

  // In "mine" mode, show chores assigned to the current user OR unassigned.
  // In "all", show everything. With multi-assignee rules an instance can
  // resolve to e.g. ["James", "Jim"] — current user is "in" if their
  // name is anywhere in the list.
  const visible = instances.filter(i => {
    if (scope === "all") return true;
    if (!i.assignees || i.assignees.length === 0) return true;
    return i.assignees.includes(currentUser);
  });

  const userEmail = useCurrentUserEmail();

  // Group instances by their block_id (the new schema), with a single
  // "" bucket for chores that have no block (anytime). Order blocks by
  // today's resolved start time so sun-event blocks land where they
  // actually fall on the clock.
  //
  // Within each bucket, multi-day window chores (weekly_window /
  // monthly_last_week_window) sort to the bottom so the strict
  // "do this now" daily chores read first; the (N days remaining)
  // pill carries the urgency for the window chores.
  const blockGroups = new Map();
  for (const inst of visible) {
    const key = inst.chore.blockId ?? "";
    if (!blockGroups.has(key)) blockGroups.set(key, []);
    blockGroups.get(key).push(inst);
  }
  for (const list of blockGroups.values()) {
    list.sort((a, b) => isWindowy(a.chore) - isWindowy(b.chore));
  }
  const orderedBlockKeys = [...blockGroups.keys()].sort((a, b) => {
    if (a === "" && b === "") return 0;
    if (a === "") return 1;
    if (b === "") return -1;
    const ba = blocks.find(x => x.id === a);
    const bb = blocks.find(x => x.id === b);
    const sa = ba ? (resolveBlockMinutes(today, ba.startKind, ba.startMinutes) ?? 9999) : 9999;
    const sb = bb ? (resolveBlockMinutes(today, bb.startKind, bb.startMinutes) ?? 9999) : 9999;
    return sa - sb;
  });

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  // One subscription for the whole tab. The completions hook + the
  // place tree propagate down to each block's place tree as props.
  const completions = useChoreCompletions(today);

  // Place tree + occupancy + livestock groups for the anchor-driven
  // obligation fan-out (Batches 16.1 + 18). Within each block, chores
  // group by the place tree (same nesting as the All chores tab); a
  // dormant chore (anchor resolves nowhere — no active animals) drops
  // off today's list.
  const {
    roots, childrenByParent, choreCtx, loading: sitesLoading,
  } = useSites();

  // Hide dormant chores from every block bucket. Skipped while the
  // occupancy data is still loading — an empty placements map would
  // make every animal-anchored chore read as dormant for a frame.
  if (!sitesLoading) {
    for (const [key, list] of blockGroups) {
      const active = list.filter(
        inst => obligationPlaceIds(inst.chore, choreCtx).length > 0
      );
      if (active.length === 0) blockGroups.delete(key);
      else blockGroups.set(key, active);
    }
  }
  const visibleBlockKeys = orderedBlockKeys.filter(k => blockGroups.has(k));

  const isEmpty = visibleBlockKeys.length === 0 && !sitesLoading;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: T.textDim }}>{dateLabel}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <UserPicker value={currentUser} onChange={onChangeUser} />
          <Toggle active={scope === "mine"} onClick={() => setScope("mine")}>Mine</Toggle>
          <Toggle active={scope === "all"} onClick={() => setScope("all")}>All</Toggle>
        </div>
      </div>

      {isEmpty && (
        <EmptyCard title="Nothing to do today">
          {scope === "mine" ? "No chores assigned to you or unassigned today." : "No chores scheduled today."}
        </EmptyCard>
      )}

      {/* Sub-tab jump nav: one chip per block group. Tapping scrolls
          that group into view (expanding it first if collapsed). */}
      <JumpNav
        items={visibleBlockKeys.map(blockKey => {
          const block = blockKey ? blocks.find(b => b.id === blockKey) : null;
          const Icon = blockIcon(block);
          return {
            id: blockKey || "anytime",
            label: block ? block.name : "Anytime",
            icon: <Icon size={12} style={{ flexShrink: 0 }} />,
          };
        })}
        onJump={(id) => {
          setCollapsedBlocks(prev => prev.filter(k => k !== id));
          jumpToSection(`today-block-${id}`);
        }}
      />

      {visibleBlockKeys.map(blockKey => {
        const block = blockKey ? blocks.find(b => b.id === blockKey) : null;
        const key = blockKey || "anytime";
        return (
          <BlockGroup
            key={key}
            domId={`today-block-${key}`}
            block={block}
            instances={blockGroups.get(blockKey)}
            roots={roots}
            childrenByParent={childrenByParent}
            completions={completions}
            choreCtx={choreCtx}
            currentUserEmail={userEmail}
            blocks={blocks}
            collapsed={collapsedSet.has(key)}
            onToggleCollapsed={() => toggleCollapsed(key)}
          />
        );
      })}
    </div>
  );
}

// True for chores whose deadline spans multiple blocks / days, so we
// can sort them to the bottom of their bucket on the Today tab.
function isWindowy(chore) {
  const t = chore?.frequency?.type;
  if (t === "weekly_window" || t === "monthly_last_week_window") return 1;
  // New model: the multi-day window now lives in the deadline — a
  // weekday- or event-offset-anchored deadline spans past its block.
  const k = chore?.deadline?.kind;
  if (k === "block_on_weekday" || k === "block_at_offset") return 1;
  return 0;
}

// One time-of-day block on the Today tab. Blocks order by today's
// resolved start time (handled by the parent); within the block,
// chores group by the place tree — the same nesting + alphabetical
// sorting as the All chores tab — with one checkable row per
// (chore, place) obligation. The whole header is a collapse toggle;
// `domId` is the jump-nav scroll target.
function BlockGroup({
  block, domId, instances, roots, childrenByParent, completions, choreCtx,
  currentUserEmail, blocks, collapsed, onToggleCollapsed,
}) {
  const headerLabel = block ? block.name : "Anytime";
  const timeLabel = block
    ? displayBlockSide(block.startKind, block.startMinutes)
    : "";
  return (
    <div
      id={domId}
      style={{
        marginBottom: collapsed ? 16 : 32,
        scrollMarginTop: JUMP_NAV_OFFSET,
      }}
    >
      <button
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        style={{
          display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8,
          width: "100%", background: "transparent", border: "none",
          padding: 0, cursor: "pointer", fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        {collapsed
          ? <ChevronRight size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />
          : <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0, alignSelf: "center" }} />}
        <div style={{
          fontFamily: T.uiLabel, fontSize: 14, color: T.text,
          textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700
        }}>
          {headerLabel}
        </div>
        {timeLabel && <div style={{ fontSize: 12, color: T.textDim }}>{timeLabel}</div>}
        <div style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
          {instances.length} {instances.length === 1 ? "chore" : "chores"}
        </div>
      </button>
      {!collapsed && (
        <TodayPlaceTree
          instances={instances}
          roots={roots}
          childrenByParent={childrenByParent}
          completions={completions}
          choreCtx={choreCtx}
          currentUserEmail={currentUserEmail}
          blocks={blocks}
        />
      )}
    </div>
  );
}

// The place-tree body of one block group. Fans the block's chores into
// per-place obligations, then renders the place tree with one
// checkable row per obligation. Top-level places with nothing in this
// block are skipped (each block stays focused); nesting inside a
// rendered branch matches the All chores tree exactly.
function TodayPlaceTree({
  instances, roots, childrenByParent, completions, choreCtx,
  currentUserEmail, blocks,
}) {
  const {
    entriesByPlace, farmEntries, subtreeCounts, topLevel,
  } = useMemo(() => {
    const byPlace = new Map();
    const farm = [];
    for (const inst of instances) {
      const placeIds = obligationPlaceIds(inst.chore, choreCtx);
      for (const pid of placeIds) {
        if (pid == null) {
          farm.push({ inst, placeId: null });
          continue;
        }
        if (!byPlace.has(pid)) byPlace.set(pid, []);
        byPlace.get(pid).push({ inst, placeId: pid });
      }
    }
    const byTitle = (a, b) =>
      (a.inst.chore.title ?? "").localeCompare(b.inst.chore.title ?? "");
    for (const list of byPlace.values()) list.sort(byTitle);

    // Subtree counts drive the auto-fold + top-level pruning.
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

    // Obligations sitting at the farm root read as whole-farm work.
    for (const root of roots ?? []) {
      farm.push(...(byPlace.get(root.id) ?? []));
      byPlace.delete(root.id);
    }
    farm.sort(byTitle);

    const top = [];
    for (const root of roots ?? []) {
      top.push(...childrenOf(root.id, childrenByParent));
    }
    top.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    return {
      entriesByPlace: byPlace,
      farmEntries: farm,
      subtreeCounts: counts,
      topLevel: top,
    };
  }, [instances, choreCtx, roots, childrenByParent]);

  const renderEntry = ({ inst, placeId }) => (
    <TodayObligationRow
      inst={inst}
      placeId={placeId}
      completions={completions}
      currentUserEmail={currentUserEmail}
      blocks={blocks}
    />
  );
  const keyOf = ({ inst, placeId }) => `${inst.choreId}|${placeId ?? "farm"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* hideEmpty: places with nothing to do today don't render a
          header at all — only the All chores tab keeps empty places
          visible. */}
      {topLevel.map(place => (
        <PlaceTreeNode
          key={place.id}
          place={place}
          depth={0}
          childrenByParent={childrenByParent}
          entriesByPlace={entriesByPlace}
          subtreeCounts={subtreeCounts}
          renderEntry={renderEntry}
          keyOf={keyOf}
          hideEmpty
        />
      ))}
      {farmEntries.length > 0 && (
        <PlaceTreeSection
          title="Whole farm"
          subtitle="Not tied to any one place"
          entries={farmEntries}
          renderEntry={renderEntry}
          keyOf={keyOf}
        />
      )}
    </div>
  );
}

// One checkable (chore, place) obligation row on the Today tab. The
// place is carried by the tree header above it, so the row is just the
// chore: checkbox, title, queued glyph, assignees + deadline meta, and
// the sticky-note button.
function TodayObligationRow({
  inst, placeId, completions, currentUserEmail, blocks,
}) {
  const { chore, assignees } = inst;
  const isDone = completions.isDone(chore.id, placeId);
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;

  // Batch 23 — date-bound modifiers on this chore today (from a
  // process expansion or placed by hand). The winner changes how the
  // row reads; the stacked badge explains winner + losers on tap.
  const { modifiers } = useChoreModifiers();
  const resolved = resolveModifiers(
    modifiers, chore.id, formatISODate(todayUTC()), placeId
  );
  const effects = applyModifier(resolved);

  // Right-column metadata: explicit assignees + deadline. If no
  // assignees, show only the deadline — no "unassigned" label.
  const metaParts = [];
  if (assignees && assignees.length > 0) metaParts.push(assignees.join(" · "));
  metaParts.push(
    effects.deadlineText
      ? `today: ${effects.deadlineText}`
      : displayDeadlineConcrete(chore)
  );

  return (
    <div style={{ background: T.surface, opacity: effects.skipped ? 0.6 : 1 }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => completions.toggle(chore.id, placeId, isDone)}
          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
          style={{
            width: 20, height: 20, flexShrink: 0,
            background: isDone ? T.accent : "transparent",
            border: `1.5px solid ${isDone ? T.accent : T.border}`,
            cursor: "pointer",
            padding: 0,
            transition: "background-color 120ms ease, border-color 120ms ease"
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            color: isDone ? T.textFaint : T.text,
            textDecoration: isDone || effects.skipped ? "line-through" : "none",
            display: "flex", alignItems: "center", gap: 8
          }}>
            <span>{effects.replaceText ?? chore.title}</span>
            {(chore.automationEmissionId || chore.processExpansionId) && (
              <Sparkles
                size={12}
                style={{ color: T.accentDeep, flexShrink: 0 }}
                aria-label="Created by an automation"
              />
            )}
            <ModifierBadges resolved={resolved} />
            {queued && (
              <CloudOff
                size={12}
                style={{ color: T.warn, flexShrink: 0 }}
                aria-label="Saved on this device — not synced yet"
              />
            )}
          </div>
          {effects.prependText && (
            <div style={{
              fontSize: 12, color: T.accentDeep, fontWeight: 500, marginTop: 2,
            }}>
              {effects.prependText}
            </div>
          )}
          {chore.description && (
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{chore.description}</div>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.textFaint, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <ChoreRemainingPill chore={chore} blocks={blocks} />
          <span>{metaParts.join(" · ")}</span>
        </div>
        <ChoreMessageButton
          choreId={chore.id}
          choreTitle={chore.title}
          currentUserEmail={currentUserEmail}
        />
      </div>
    </div>
  );
}

function UserPicker({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: T.surface, border: `1px solid ${T.border}`, color: T.text,
        fontFamily: "inherit", fontSize: 11, padding: "5px 8px", cursor: "pointer",
        textTransform: "uppercase", letterSpacing: "0.12em"
      }}
      title="Viewing as"
    >
      {USERS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.surface : "transparent",
      border: `1px solid ${active ? T.accent : T.border}`,
      color: active ? T.text : T.textDim,
      fontFamily: "inherit", fontSize: 11, fontWeight: 600,
      padding: "5px 9px", cursor: "pointer",
      textTransform: "uppercase", letterSpacing: "0.12em"
    }}>{children}</button>
  );
}

// ─── All chores ──────────────────────────────────────────────────────────────

function AllChoresTab({ data }) {
  const [query, setQuery] = useState("");
  // "place" (default — recursive place-tree accordions) | alpha | time.
  // Session-persisted so flipping between screens keeps the chosen sort.
  const [sort, setSort] = usePersistedState("chores:all-sort", "place");
  const [expanded, setExpanded] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // chore_id currently in edit mode
  const {
    definitions: liveDefs, loading: defsLoading,
    updateDefinition, deleteDefinition,
  } = useChoreDefinitions();
  const {
    places, placesById, childrenByParent, roots, groups, speciesById,
    choreCtx, loading: sitesLoading,
  } = useSites();
  const { blocks, blockById } = useChoreBlocks();

  // Until live data lands, fall back to the static definitions from the
  // boot-time data prop so the UI doesn't flash empty.
  const defs = liveDefs.length > 0 || !defsLoading
    ? liveDefs
    : getAllChoreDefinitions(data);

  const toggleExpand = id => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const startEdit = id => {
    setEditing(id);
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = !q ? [...defs] : defs.filter(c =>
      c.title.toLowerCase().includes(q)
      || (c.description ?? "").toLowerCase().includes(q)
      || (c.tags ?? []).some(t => t.toLowerCase().includes(q))
      || describeChoreAnchor(c, choreCtx).toLowerCase().includes(q)
    );
    if (sort === "alpha") {
      out.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "time") {
      // Sort by today's resolved block start time (ascending — chores
      // with no block sort last), then by anchor label, then by title.
      const today = new Date();
      const blockMap = new Map(blocks.map(b => [b.id, b]));
      const startMin = (chore) => {
        const b = chore.blockId ? blockMap.get(chore.blockId) : null;
        if (!b) return 9999;
        return resolveBlockMinutes(today, b.startKind, b.startMinutes) ?? 9999;
      };
      out.sort((a, b) => {
        const sa = startMin(a);
        const sb = startMin(b);
        if (sa !== sb) return sa - sb;
        const na = describeChoreAnchor(a, choreCtx).toLowerCase();
        const nb = describeChoreAnchor(b, choreCtx).toLowerCase();
        if (na !== nb) return na.localeCompare(nb);
        return a.title.localeCompare(b.title);
      });
    }
    // sort === "place" keeps definition order; the tree handles
    // grouping + per-place alphabetical sorting itself.
    return out;
  }, [defs, query, sort, blocks, choreCtx]);

  // Jump-nav chips for the by-place view: the farm root's children,
  // alphabetical — the same top-level ordering PlaceGroupedChores
  // renders its sections in.
  const topLevelNavItems = useMemo(() => {
    const out = [];
    for (const root of roots ?? []) {
      out.push(...childrenOf(root.id, childrenByParent));
    }
    out.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return out.map(p => ({ id: p.id, label: p.name }));
  }, [roots, childrenByParent]);

  // Shared row-level handlers, threaded into both render modes.
  const userEmail = useCurrentUserEmail();
  const rowHandlers = {
    expanded,
    onToggle: toggleExpand,
    editing,
    onStartEdit: startEdit,
    onCancelEdit: () => setEditing(null),
    onSaveEdit: async (id, patch) => {
      await updateDefinition(id, patch);
      setEditing(null);
    },
    onQuickSave: updateDefinition,
    onDeleteChore: async (id) => {
      const ok = window.confirm("Delete this chore? This can't be undone.");
      if (!ok) return;
      await deleteDefinition(id);
    },
  };
  const editorData = {
    places, blocks, blockById, groups, speciesById, choreCtx,
    currentUserEmail: userEmail,
  };

  return (
    <div>
      <ControlsBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search chores" />
        <ControlsActions>
          <SortPicker value={sort} onChange={setSort} />
          <button style={primaryButtonStyle} onClick={() => alert("Add new chore — not implemented in the prototype.")}>
            <Plus size={14} /> Add chore
          </button>
        </ControlsActions>
      </ControlsBar>

      {/* Sub-tab jump nav (by-place view): one chip per top-level
          place; tapping scrolls that place's section into view. */}
      {sort === "place" && !sitesLoading && (
        <JumpNav
          items={topLevelNavItems}
          onJump={(placeId) => jumpToSection(`all-place-${placeId}`)}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyCard title="No chores match">Try a different search term.</EmptyCard>
      ) : sort === "place" && sitesLoading ? (
        <EmptyCard title="Loading places…">
          Building the place tree and current occupancy.
        </EmptyCard>
      ) : sort === "place" ? (
        <PlaceGroupedChores
          defs={filtered}
          roots={roots}
          childrenByParent={childrenByParent}
          placesById={placesById}
          choreCtx={choreCtx}
          rowHandlers={rowHandlers}
          editorData={editorData}
        />
      ) : (
        <AllChoresList
          filtered={filtered}
          rowHandlers={rowHandlers}
          editorData={editorData}
        />
      )}
    </div>
  );
}

// ── By-place tree view (Batch 18) ───────────────────────────────────
// The default All-chores rendering: the full place tree as nested
// accordion headers — every level of nesting gets its own header, so
// the hierarchy reads exactly like the farm is organized. Chores land
// under the place their anchor currently resolves to (one row per
// fanned obligation), which is what makes coop chores follow the coops
// and pasture chores stay with the pasture. Headers with nothing
// beneath them fold up automatically but stay visible — every place is
// represented even when it has no chores yet.
function PlaceGroupedChores({
  defs, roots, childrenByParent, placesById, choreCtx,
  rowHandlers, editorData,
}) {
  // Fan every definition into its obligations. choresByPlace maps
  // placeId|null → [{ chore, placeIds }] (placeIds kept so rows can
  // show "1 of N places" context). Dormant chores collect separately.
  const { choresByPlace, wholeFarm, dormant } = useMemo(() => {
    const byPlace = new Map();
    const farm = [];
    const sleeping = [];
    for (const chore of defs) {
      const placeIds = obligationPlaceIds(chore, choreCtx);
      if (placeIds.length === 0) {
        sleeping.push(chore);
        continue;
      }
      for (const pid of placeIds) {
        if (pid == null) {
          farm.push({ chore, placeIds });
          continue;
        }
        if (!byPlace.has(pid)) byPlace.set(pid, []);
        byPlace.get(pid).push({ chore, placeIds });
      }
    }
    const byTitle = (a, b) =>
      (a.chore.title ?? "").localeCompare(b.chore.title ?? "");
    for (const list of byPlace.values()) list.sort(byTitle);
    farm.sort(byTitle);
    sleeping.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    return { choresByPlace: byPlace, wholeFarm: farm, dormant: sleeping };
  }, [defs, choreCtx]);

  // Subtree chore counts drive the auto-fold behavior: a header with
  // nothing anywhere beneath it renders collapsed.
  const subtreeCounts = useMemo(() => {
    const counts = new Map();
    const walk = (placeId) => {
      let n = (choresByPlace.get(placeId) ?? []).length;
      for (const child of childrenOf(placeId, childrenByParent)) {
        n += walk(child.id);
      }
      counts.set(placeId, n);
      return n;
    };
    for (const root of roots) walk(root.id);
    return counts;
  }, [choresByPlace, childrenByParent, roots]);

  // Top level: the farm root's children, alphabetical. Obligations
  // sitting at the farm root itself read as whole-farm work.
  const topLevel = useMemo(() => {
    const out = [];
    for (const root of roots) {
      out.push(...childrenOf(root.id, childrenByParent));
    }
    out.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return out;
  }, [roots, childrenByParent]);
  const rootChores = useMemo(() => {
    const out = [...wholeFarm];
    for (const root of roots) {
      out.push(...(choresByPlace.get(root.id) ?? []));
    }
    return out;
  }, [wholeFarm, roots, choresByPlace]);

  // Definition-row renderers for the generic tree components.
  const renderDefinition = ({ chore, placeIds }) => (
    <ChoreDefinitionRow
      chore={chore}
      fannedCount={placeIds?.length}
      {...rowHandlersFor(chore, rowHandlers)}
      {...editorData}
    />
  );
  const renderDormant = (chore) => (
    <ChoreDefinitionRow
      chore={chore}
      dormantNote={describeChoreAnchor(chore, choreCtx)}
      {...rowHandlersFor(chore, rowHandlers)}
      {...editorData}
    />
  );
  const definitionKey = (entry, placeId) =>
    `${(entry.chore ?? entry).id}|${placeId ?? "farm"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Each top-level place is a jump-nav scroll target. */}
      {topLevel.map(place => (
        <div
          key={place.id}
          id={`all-place-${place.id}`}
          style={{ scrollMarginTop: JUMP_NAV_OFFSET }}
        >
          <PlaceTreeNode
            place={place}
            depth={0}
            childrenByParent={childrenByParent}
            entriesByPlace={choresByPlace}
            subtreeCounts={subtreeCounts}
            renderEntry={renderDefinition}
            keyOf={definitionKey}
          />
        </div>
      ))}
      {rootChores.length > 0 && (
        <PlaceTreeSection
          title="Whole farm"
          subtitle="Not tied to any one place"
          entries={rootChores}
          renderEntry={renderDefinition}
          keyOf={definitionKey}
        />
      )}
      {dormant.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <PlaceTreeSection
            title="Dormant"
            subtitle="No active animals or places right now"
            entries={dormant}
            renderEntry={renderDormant}
            keyOf={definitionKey}
            defaultOpen={false}
            dimmed
          />
        </div>
      )}
    </div>
  );
}

// PlaceTreeNode + PlaceTreeSection moved to components/PlaceTree.jsx
// (shared with the Now surface).

// Adapt the tab-level handler bag to the per-row prop shape
// ChoreDefinitionRow expects.
function rowHandlersFor(chore, h) {
  return {
    expanded: h.expanded.has(chore.id),
    onToggle: () => h.onToggle(chore.id),
    editing: h.editing === chore.id,
    onStartEdit: () => h.onStartEdit(chore.id),
    onCancelEdit: h.onCancelEdit,
    onSaveEdit: (patch) => h.onSaveEdit(chore.id, patch),
    onQuickSave: (patch) => h.onQuickSave(chore.id, patch),
    onDeleteChore: () => h.onDeleteChore(chore.id),
  };
}

// Same newspaper-split layout as Today, but the width threshold is higher
// (1200px) because each chore-definition row is denser (inline actions +
// expand caret) and needs more horizontal room before it's worth splitting.
function AllChoresList({ filtered, rowHandlers, editorData }) {
  const [setWidthRef, cols] = useColumnCount(1200);
  return (
    <div ref={setWidthRef}>
      <ColumnList
        items={filtered}
        cols={cols}
        keyFor={c => c.id}
        renderItem={chore => (
          <ChoreDefinitionRow
            chore={chore}
            {...rowHandlersFor(chore, rowHandlers)}
            {...editorData}
          />
        )}
      />
    </div>
  );
}

function SortPicker({ value, onChange }) {
  const options = [
    { id: "place", label: "By place" },
    { id: "alpha", label: "A–Z" },
    { id: "time", label: "Time of day" }
  ];
  return (
    <div style={{ display: "flex", border: `1px solid ${T.border}`, background: T.surface }}>
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            background: value === o.id ? T.surfaceAlt : "transparent",
            border: "none", color: value === o.id ? T.text : T.textDim,
            fontFamily: "inherit", fontSize: 11, fontWeight: 600,
            padding: "6px 10px", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em"
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

function ChoreDefinitionRow({
  chore, fannedCount, dormantNote,
  expanded, onToggle, currentUserEmail,
  editing, onStartEdit, onCancelEdit, onSaveEdit, onQuickSave, onDeleteChore,
  places, blocks, blockById, groups, speciesById, choreCtx,
}) {
  return (
    <div style={{ background: T.surface }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggle}
          aria-label={expanded ? "Collapse" : "Expand"}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", color: T.textMuted }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span>{chore.title}</span>
            {(chore.automationEmissionId || chore.processExpansionId) && (
              <Sparkles
                size={12}
                style={{ color: T.accentDeep, flexShrink: 0, alignSelf: "center" }}
                aria-label="Created by an automation"
              />
            )}
            {fannedCount > 1 && (
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}>
                1 of {fannedCount} places
              </span>
            )}
          </div>
          <SecondaryRow
            chore={chore}
            blocks={blocks}
            blockById={blockById}
            choreCtx={choreCtx}
            onQuickSave={onQuickSave}
            onStartEdit={onStartEdit}
            dormantNote={dormantNote}
          />
        </div>
        {/* Right-side icon cluster: one container, one gap, so the
            message / edit / delete icons space + align uniformly
            instead of inheriting the row's wider gap between the
            first two. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
        }}>
          <ChoreMessageButton
            choreId={chore.id}
            choreTitle={chore.title}
            currentUserEmail={currentUserEmail}
          />
          <RowActions
            editing={editing}
            onEdit={onStartEdit}
            onDelete={onDeleteChore}
          />
        </div>
      </div>
      {expanded && (
        editing
          ? <ChoreInlineEditor
              chore={chore}
              places={places}
              blocks={blocks}
              groups={groups}
              speciesById={speciesById}
              choreCtx={choreCtx}
              onCancel={onCancelEdit}
              onSave={onSaveEdit}
            />
          : <ExpandedChoreDetail chore={chore} blockById={blockById} />
      )}
    </div>
  );
}

// Quick-edit chips on the row's secondary line. The anchor ("belongs
// to") chip opens the full inline editor on double-click — anchors
// have too many moving parts for a single inline select. Schedule and
// frequency keep their in-place quick editors.
function SecondaryRow({
  chore, blocks, blockById, choreCtx, onQuickSave, onStartEdit,
  dormantNote,
}) {
  // Pill is conditional — appears only when the helper resolves
  // (window or anytime chores). Render at the end so the layout
  // stays calm for the simple-daily-chore majority.
  const [editing, setEditing] = useState(null); // 'schedule' | 'frequency' | null

  const close = () => setEditing(null);
  const save = async (patch) => {
    await onQuickSave(patch);
    close();
  };

  return (
    <div
      style={{
        fontSize: 12, color: T.textDim, marginTop: 2,
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6,
      }}
    >
      <Chip
        onDoubleClick={onStartEdit}
        title="Double-click to edit what this chore belongs to"
      >
        {dormantNote ?? describeChoreAnchor(chore, choreCtx)}
      </Chip>
      <ChipSep />
      {editing === "schedule" ? (
        <ScheduleQuickEdit
          chore={chore}
          blocks={blocks}
          onSave={save}
          onCancel={close}
        />
      ) : (
        <Chip onDoubleClick={() => setEditing("schedule")} title="Double-click to edit schedule">
          {describeChoreSchedule(chore, blockById)}
        </Chip>
      )}
      <ChipSep />
      {editing === "frequency" ? (
        <FrequencyQuickEdit
          chore={chore}
          onSave={save}
          onCancel={close}
        />
      ) : (
        <Chip onDoubleClick={() => setEditing("frequency")} title="Double-click to edit frequency">
          {describeFrequency(chore)}
        </Chip>
      )}
      <ChoreRemainingPill chore={chore} blocks={blocks} className="ml-1" />
    </div>
  );
}

function Chip({ onDoubleClick, title, children }) {
  return (
    <button
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      onClick={(e) => e.stopPropagation()}
      title={title}
      style={{
        background: "transparent",
        border: "none",
        color: "inherit",
        font: "inherit",
        padding: 0,
        cursor: "default",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}

function ChipSep() {
  return <span aria-hidden style={{ color: T.textFaint, userSelect: "none" }}>·</span>;
}

// Depth-ordered, indented options for a place <select>. A chore scoped
// to a place applies to that place's whole subtree, so any node is a
// valid target. Order is a pre-order tree walk; depth drives the indent.
function placeSelectOptions(places) {
  const { childrenByParent } = buildPlaceTree(
    (places ?? []).filter(p => p.isActive !== false)
  );
  const out = [];
  const walk = (parentId, depth) => {
    for (const p of childrenByParent.get(parentId) ?? []) {
      out.push({ id: p.id, label: `${"  ".repeat(depth)}${p.name}` });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// ── Schedule (block) quick-edit ────────────────────────────────────
function ScheduleQuickEdit({ chore, blocks, onSave, onCancel }) {
  const initial = chore.blockId ?? "";
  const [val, setVal] = useState(initial);
  const activeBlocks = blocks.filter(b => b.isActive);

  const submit = async (newVal) => {
    if (newVal === initial) { onCancel(); return; }
    await onSave({ blockId: newVal || null });
  };

  return (
    <select
      autoFocus
      value={val}
      onChange={(e) => { setVal(e.target.value); submit(e.target.value); }}
      onBlur={() => submit(val)}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      onClick={(e) => e.stopPropagation()}
      style={editChipInputStyle}
    >
      <option value="">— anytime —</option>
      {activeBlocks.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}

// ── Frequency quick-edit ───────────────────────────────────────────
// New (block) model frequencies:
//   daily | weekly{days} | monthly_last_week{day} | every_n{n,unit,day?}
//   | event (read-only — event-triggered chores are materialized by the
//   process engine, not hand-edited here).
const FREQ_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function FrequencyQuickEdit({ chore, onSave, onCancel }) {
  const initial = chore.frequency ?? { type: "daily" };
  const [type, setType] = useState(initial.type ?? "daily");
  const [days, setDays] = useState(
    Array.isArray(initial.days) ? initial.days : []
  );
  const [day, setDay] = useState(
    typeof initial.day === "number" ? initial.day : 1
  );
  const [n, setN] = useState(initial.n ?? 1);
  const [unit, setUnit] = useState(initial.unit ?? "months");

  const save = (next) => onSave({ frequency: next });

  const onTypeChange = (newType) => {
    setType(newType);
    if (newType === "daily") save({ type: "daily" });
    else if (newType === "weekly") {
      if (days.length > 0) save({ type: "weekly", days });
    } else if (newType === "monthly_last_week") {
      save({ type: "monthly_last_week", day });
    } else if (newType === "every_n") {
      save({ type: "every_n", n, unit, day });
    }
    // "event" is read-only; no commit.
  };

  const toggleDay = (d) => {
    const next = days.includes(d)
      ? days.filter(x => x !== d)
      : [...days, d].sort((a, b) => a - b);
    setDays(next);
    if (type === "weekly" && next.length > 0) {
      save({ type: "weekly", days: next });
    }
  };

  const pickDay = (d) => {
    setDay(d);
    if (type === "monthly_last_week") {
      save({ type: "monthly_last_week", day: d });
    } else if (type === "every_n") {
      save({ type: "every_n", n, unit, day: d });
    }
  };

  const changeN = (val) => {
    const v = Math.max(1, parseInt(val, 10) || 1);
    setN(v);
    if (type === "every_n") save({ type: "every_n", n: v, unit, day });
  };
  const changeUnit = (u) => {
    setUnit(u);
    if (type === "every_n") save({ type: "every_n", n, unit: u, day });
  };

  const dayButtons = (selected, onPick, multi) => (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {FREQ_DOW.map((label, idx) => {
        const on = multi ? selected.includes(idx) : selected === idx;
        return (
          <button
            key={idx}
            onClick={() => onPick(idx)}
            aria-pressed={on}
            style={{
              border: `1px solid ${T.border}`,
              background: on ? T.rowActive : "transparent",
              color: on ? T.text : T.textDim,
              font: "inherit", fontSize: 11, fontWeight: 600,
              padding: "2px 6px", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}
            title={`${on ? "Remove" : "Add"} ${label}`}
          >
            {label}
          </button>
        );
      })}
    </span>
  );

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
    >
      <select
        autoFocus
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        style={editChipInputStyle}
      >
        <option value="daily">Every day</option>
        <option value="weekly">Weekly (days)</option>
        <option value="monthly_last_week">Monthly (last week)</option>
        <option value="every_n">Every N…</option>
        <option value="event">Event-triggered</option>
      </select>

      {type === "weekly" && dayButtons(days, toggleDay, true)}
      {type === "monthly_last_week" && dayButtons(day, pickDay, false)}
      {type === "every_n" && (
        <>
          <input
            type="number" min="1" value={n}
            onChange={(e) => changeN(e.target.value)}
            style={{ ...editChipInputStyle, width: 48 }}
          />
          <select
            value={unit}
            onChange={(e) => changeUnit(e.target.value)}
            style={editChipInputStyle}
          >
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
            <option value="years">years</option>
          </select>
          {dayButtons(day, pickDay, false)}
        </>
      )}
      {type === "event" && (
        <span style={{ color: T.textMuted, fontSize: 11 }}>
          materialized by the process engine
        </span>
      )}

      <button
        onClick={onCancel}
        style={{
          background: "transparent", border: "none", color: T.textMuted,
          cursor: "pointer", font: "inherit", fontSize: 11, padding: "2px 6px",
        }}
        title="Done editing"
      >
        Done
      </button>
    </span>
  );
}

const editChipInputStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.text,
  fontSize: 12,
  padding: "2px 6px",
  fontFamily: "inherit",
};

// Block label for the row's secondary line.
function describeChoreSchedule(chore, blockById) {
  if (chore.blockId) {
    const b = blockById.get(chore.blockId);
    if (b) {
      const startLabel = displayBlockSide(b.startKind, b.startMinutes);
      return `${b.name} (${startLabel})`;
    }
  }
  return displayStartTime(chore);
}

function ExpandedChoreDetail({ chore, blockById }) {
  return (
    <div style={{ padding: "8px 16px 16px 42px", borderTop: `1px solid ${T.border}`, background: T.surfaceAlt }}>
      {chore.description && (
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>{chore.description}</div>
      )}
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, margin: 0 }}>
        <Field label="Frequency" value={describeFrequency(chore)} />
        <Field
          label="Block"
          value={blockById
            ? describeChoreSchedule(chore, blockById)
            : displayStartTime(chore)}
        />
        <Field label="Deadline" value={displayDeadline(chore)} />
        <Field label="Assignment" value={describeAssignment(chore.assignment)} />
      </dl>
      <div style={{ marginTop: 12, fontSize: 11, color: T.textFaint, fontStyle: "italic" }}>
        Activity for this chore will appear here once completion logging is wired up.
      </div>
    </div>
  );
}

function describeAssignment(a) {
  if (!a) return "Unassigned";
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const parts = [];
  if (a.byDayOfWeek) {
    for (const [d, who] of Object.entries(a.byDayOfWeek)) {
      parts.push(`${dows[Number(d)]} → ${who}`);
    }
  }
  if (a.default) parts.push(`default → ${a.default}`);
  return parts.length ? parts.join(", ") : "Unassigned";
}

function Field({ label, value }) {
  return (
    <div>
      <dt style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</dt>
      <dd style={{ fontSize: 12, color: T.text, margin: 0 }}>{value}</dd>
    </div>
  );
}

function RowActions({ editing, onEdit, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <IconAction
        title={editing ? "Editing…" : "Edit"}
        onClick={onEdit}
        active={editing}
      >
        <Pencil size={13} />
      </IconAction>
      <IconAction title="Delete" onClick={onDelete}>
        <Trash2 size={13} />
      </IconAction>
    </div>
  );
}

// Inline editor body — lives where ExpandedChoreDetail normally renders.
// Editable fields: title, description, the anchor ("belongs to" — what
// drives where obligations surface), block, sort_order. Frequency,
// deadline, and per-day-of-week assignment editing are out of scope
// for v1 — those JSON shapes deserve dedicated editors later.
function ChoreInlineEditor({
  chore, places, blocks, groups, speciesById, choreCtx, onCancel, onSave,
}) {
  const [title, setTitle] = useState(chore.title);
  const [description, setDescription] = useState(chore.description ?? "");
  const [blockId, setBlockId] = useState(chore.blockId ?? "");
  const [lastChanceBlockId, setLastChanceBlockId] = useState(
    chore.lastChanceBlockId ?? ""
  );
  const [sortOrder, setSortOrder] = useState(chore.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // ── Anchor ("belongs to") state ──────────────────────────────────
  // Four UI modes mapping onto the six anchor types:
  //   animals    → 'species' | 'batch'
  //   place      → 'place' | 'occupied_place' (checkbox)
  //   place_kind → 'place_kind'
  //   none       → 'none'
  const initialType =
    chore.anchorType ?? (chore.placeId ? "occupied_place" : "none");
  const [anchorMode, setAnchorMode] = useState(
    initialType === "species" || initialType === "batch" ? "animals"
    : initialType === "place" || initialType === "occupied_place" ? "place"
    : initialType === "place_kind" ? "place_kind"
    : "none"
  );
  // animals mode: "species:<id>" or "batch:<id>"
  const [animalKey, setAnimalKey] = useState(
    initialType === "batch" && chore.anchorBatchId
      ? `batch:${chore.anchorBatchId}`
      : initialType === "species" && chore.anchorSpeciesId
        ? `species:${chore.anchorSpeciesId}`
        : ""
  );
  const [housedTag, setHousedTag] = useState(
    initialType === "species" || initialType === "batch"
      ? chore.anchorKindTag ?? ""
      : ""
  );
  const [atPlaceId, setAtPlaceId] = useState(chore.atPlaceId ?? "");
  const [placeId, setPlaceId] = useState(chore.placeId ?? "");
  const [occupiedOnly, setOccupiedOnly] = useState(
    initialType === "occupied_place"
  );
  const [kindTag, setKindTag] = useState(
    initialType === "place_kind" ? chore.anchorKindTag ?? "" : ""
  );

  const placeOptions = placeSelectOptions(places);
  const activeBlocks = blocks.filter(b => b.isActive);
  const speciesList = [...(speciesById?.values() ?? [])];
  const kindTags = [...new Set(
    (places ?? [])
      .filter(p => p.isActive !== false && p.kindTag)
      .map(p => p.kindTag)
  )].sort();
  const prettyTag = (tag) => tag.replaceAll("_", " ");

  // The anchor portion of the save patch, derived from the UI mode.
  // Every anchor field is written every time so switching modes clears
  // the fields the new mode doesn't use.
  const anchorPatch = () => {
    if (anchorMode === "animals") {
      const [kind, id] = animalKey.split(":");
      if (!id) return null; // validation failure
      return {
        anchorType: kind === "batch" ? "batch" : "species",
        anchorSpeciesId: kind === "species" ? id : null,
        anchorBatchId: kind === "batch" ? id : null,
        anchorKindTag: housedTag || null,
        atPlaceId: atPlaceId || null,
        placeId: null,
      };
    }
    if (anchorMode === "place") {
      if (!placeId) return null;
      return {
        anchorType: occupiedOnly ? "occupied_place" : "place",
        anchorSpeciesId: null,
        anchorBatchId: null,
        anchorKindTag: null,
        atPlaceId: null,
        placeId,
      };
    }
    if (anchorMode === "place_kind") {
      if (!kindTag) return null;
      return {
        anchorType: "place_kind",
        anchorSpeciesId: null,
        anchorBatchId: null,
        anchorKindTag: kindTag,
        atPlaceId: null,
        placeId: null,
      };
    }
    return {
      anchorType: "none",
      anchorSpeciesId: null,
      anchorBatchId: null,
      anchorKindTag: null,
      atPlaceId: null,
      placeId: null,
    };
  };

  const submit = async () => {
    if (!title.trim()) {
      setErrorMsg("Title can't be empty.");
      return;
    }
    const anchor = anchorPatch();
    if (!anchor) {
      setErrorMsg(
        anchorMode === "animals"
          ? "Pick which animals this chore belongs to."
          : anchorMode === "place"
            ? "Pick which place this chore belongs to."
            : "Pick a kind of place."
      );
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      const patch = {
        title: title.trim(),
        description: description,
        sortOrder: Number(sortOrder) || 0,
        blockId: blockId || null,
        lastChanceBlockId: lastChanceBlockId || null,
        ...anchor,
      };
      await onSave(patch);
    } catch (err) {
      console.error("save chore:", err);
      setErrorMsg(err?.message ?? "Save failed.");
      setSaving(false);
    }
  };

  return (
    <div style={{
      padding: "12px 16px 16px 42px",
      borderTop: `1px solid ${T.border}`,
      background: T.surfaceAlt,
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      <EditField label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={editInputStyle}
        />
      </EditField>
      <EditField label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={{ ...editInputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </EditField>
      <EditField label="Belongs to">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <AnchorModeRadio
            value={anchorMode}
            onChange={setAnchorMode}
            options={[
              { id: "animals", label: "Animals" },
              { id: "place", label: "A place" },
              { id: "place_kind", label: "Every place of a kind" },
              { id: "none", label: "Nothing — whole farm" },
            ]}
          />
          {anchorMode === "animals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 22 }}>
              <select
                value={animalKey}
                onChange={(e) => setAnimalKey(e.target.value)}
                style={editInputStyle}
              >
                <option value="">— pick animals —</option>
                <optgroup label="A species (every batch)">
                  {speciesList.map(s => (
                    <option key={s.id} value={`species:${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="One specific batch">
                  {(groups ?? []).map(g => (
                    <option key={g.id} value={`batch:${g.id}`}>
                      {g.label}
                      {speciesById?.get(g.speciesId)
                        ? ` (${speciesById.get(g.speciesId).name})`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  value={housedTag}
                  onChange={(e) => setHousedTag(e.target.value)}
                  style={editInputStyle}
                  title="Only count these animals where they're housed in this kind of place"
                >
                  <option value="">housed anywhere</option>
                  {kindTags.map(tag => (
                    <option key={tag} value={tag}>
                      housed in {prettyTag(tag)}s
                    </option>
                  ))}
                </select>
                <select
                  value={atPlaceId}
                  onChange={(e) => setAtPlaceId(e.target.value)}
                  style={editInputStyle}
                  title="Where the work physically happens"
                >
                  <option value="">work happens where they live</option>
                  {placeOptions.map(o => (
                    <option key={o.id} value={o.id}>
                      work happens at {o.label.trim()}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5 }}>
                The chore follows these animals — move them and the
                chore moves with them. No active animals → the chore
                goes dormant. "Wash eggs" belongs to the layers but
                happens at the House.
              </div>
            </div>
          )}
          {anchorMode === "place" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 22 }}>
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                style={editInputStyle}
              >
                <option value="">— pick a place —</option>
                {placeOptions.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textDim, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={occupiedOnly}
                  onChange={(e) => setOccupiedOnly(e.target.checked)}
                />
                Only where animals currently live (fans into occupied
                places beneath it)
              </label>
              <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5 }}>
                Unchecked: the chore sticks to this exact place whether
                or not anything lives there ("mow Pasture B").
              </div>
            </div>
          )}
          {anchorMode === "place_kind" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 22 }}>
              <select
                value={kindTag}
                onChange={(e) => setKindTag(e.target.value)}
                style={editInputStyle}
              >
                <option value="">— pick a kind —</option>
                {kindTags.map(tag => (
                  <option key={tag} value={tag}>
                    every {prettyTag(tag)}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5 }}>
                One obligation per active place of this kind, occupied
                or not ("power-wash nest boxes" → every coop).
              </div>
            </div>
          )}
        </div>
      </EditField>
      <EditField label="When">
        <select
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          style={editInputStyle}
        >
          <option value="">— anytime —</option>
          {activeBlocks.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} · {displayBlockSide(b.startKind, b.startMinutes)}
            </option>
          ))}
        </select>
      </EditField>
      <EditField label="Deadline block">
        <select
          value={lastChanceBlockId}
          onChange={(e) => setLastChanceBlockId(e.target.value)}
          style={editInputStyle}
        >
          <option value="">— no specific deadline —</option>
          {activeBlocks.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} · {displayBlockSide(b.startKind, b.startMinutes)}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, lineHeight: 1.5 }}>
          The last block on the deadline day before the chore counts as
          overrun. Drives the "(N days remaining)" pill on multi-day
          and anytime chores.
        </div>
      </EditField>
      <EditField label="Sort order">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{ ...editInputStyle, width: 90 }}
        />
      </EditField>

      <EditField label="Assignment">
        <AssignmentRulesEditor
          scope="chore"
          scopeId={chore.id}
          previewChore={chore}
        />
      </EditField>

      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            color: T.textDim,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: saving ? "default" : "pointer",
          }}
        >Cancel</button>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            ...primaryButtonStyle,
            opacity: saving ? 0.5 : 1,
            cursor: saving ? "default" : "pointer",
          }}
        >{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{
        fontSize: 9,
        color: T.textFaint,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
      }}>{label}</label>
      {children}
    </div>
  );
}

// Radio row for the anchor mode in ChoreInlineEditor.
function AnchorModeRadio({ value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
      {options.map(o => (
        <label
          key={o.id}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: value === o.id ? T.text : T.textDim,
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="chore-anchor-mode"
            checked={value === o.id}
            onChange={() => onChange(o.id)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const editInputStyle = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  color: T.text,
  fontSize: 12,
  padding: "6px 8px",
  fontFamily: "inherit",
};

function IconAction({ title, onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "transparent", border: "none",
        color: active ? T.accent : T.textMuted,
        padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "color 120ms ease"
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = T.textMuted; }}
    >{children}</button>
  );
}

// ─── Activity log ────────────────────────────────────────────────────────────
// Reads the live activity_log table and filters to chore-related kinds, so
// this tab is purpose-built for "what got checked off, by whom, when". The
// global Activity page covers all kinds (chore + batch assignment + future
// kinds); this one stays focused.

const CHORE_ACTIVITY_KINDS = new Set(["chore_completed", "chore_uncompleted"]);

function ActivityLogTab({ data }) {
  const [query, setQuery] = useState("");
  const { entries, loading, edit, remove } = useActivityLog();
  const userEmail = useCurrentUserEmail();

  const choreEntries = useMemo(
    () => (entries ?? []).filter(e => CHORE_ACTIVITY_KINDS.has(e.kind)),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choreEntries;
    return choreEntries.filter(e =>
      (e.summary ?? "").toLowerCase().includes(q)
      || (e.actor ?? "").toLowerCase().includes(q)
    );
  }, [choreEntries, query]);

  return (
    <div>
      <ControlsBar>
        <SearchInput value={query} onChange={setQuery} placeholder="Search notes / chore / person" />
        <ControlsActions>
          <FilterButton>Chore</FilterButton>
          <FilterButton>Date</FilterButton>
          <FilterButton>Person</FilterButton>
          <FilterButton>Type</FilterButton>
        </ControlsActions>
      </ControlsBar>

      {loading ? (
        <EmptyCard title="Loading activity…">
          Fetching the latest chore-completion log.
        </EmptyCard>
      ) : filtered.length === 0 ? (
        <EmptyCard title={query ? "No matches" : "No completions logged yet"}>
          {query
            ? "Try a different search term."
            : "Once chores start being checked off, every completion (and the person who did it) lands here."}
        </EmptyCard>
      ) : (
        <ol className="m-0 p-0 list-none flex flex-col gap-px bg-line">
          {filtered.map((entry) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              ownerEmail={userEmail}
              onEdit={edit}
              onDelete={remove}
              renderTime={renderChoreActivityTime}
              wrapperClass="bg-surface px-4 py-3 items-baseline"
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function renderChoreActivityTime(logTime) {
  const dt = new Date(logTime);
  return (
    <div className="min-w-[140px]">
      <div>
        {dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
      <div className="text-faint mt-px">
        {dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  );
}

// Controls-bar primitives.
//
// The old layout was a single flex row: [search-input, filter-a, filter-b,
// ...]. With `flex: 1 1 240px` + `maxWidth` on the search, browsers were
// still letting it hug / overlap the trailing filter buttons at some pane
// widths. The new layout is two discrete flex regions separated by
// `justify-content: space-between`, so the search can never encroach on the
// filters — at narrow widths the filters group wraps below the search as a
// unit instead of being individually squeezed.
function ControlsBar({ children }) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "center",
      justifyContent: "space-between", flexWrap: "wrap", marginBottom: 18
    }}>
      {children}
    </div>
  );
}

function ControlsActions({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", flex: "0 1 360px", minWidth: 220 }}>
      <Search size={13} color={T.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: T.surface, border: `1px solid ${T.border}`, color: T.text,
          fontFamily: "inherit", fontSize: 12,
          padding: "7px 10px 7px 30px", outline: "none"
        }}
      />
    </div>
  );
}

// Observes an element's width via ResizeObserver and returns the column
// count (1 or 2) given a threshold. Used by the Today / All Chores lists to
// switch into a two-column newspaper layout on wide content panes.
// Returns [setRef, cols].
function useColumnCount(threshold) {
  const [el, setEl] = useState(null);
  const [cols, setCols] = useState(1);
  const setRef = useCallback(node => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const update = () => setCols(el.getBoundingClientRect().width >= threshold ? 2 : 1);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, threshold]);
  return [setRef, cols];
}

// Splits an array into `cols` roughly-equal chunks, newspaper-style: the
// first chunk gets ceil(N/cols) items, subsequent chunks get the rest. So
// with 20 items across 2 cols: col 1 = 1..10, col 2 = 11..20.
function splitIntoColumns(items, cols) {
  if (cols <= 1) return [items];
  const perCol = Math.ceil(items.length / cols);
  const out = [];
  for (let i = 0; i < cols; i++) {
    out.push(items.slice(i * perCol, (i + 1) * perCol));
  }
  return out;
}

// Renders a list split into N newspaper columns separated by 1px borders.
// Each column is its own vertically-separated list; the parent grid's
// column-gap is 1px so the vertical gutter renders as a single separator.
function ColumnList({ items, cols, renderItem, keyFor }) {
  const columns = splitIntoColumns(items, cols);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      columnGap: 1, background: T.border
    }}>
      {columns.map((colItems, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
          {colItems.map(item => (
            <div key={keyFor(item)}>{renderItem(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function FilterButton({ children }) {
  return (
    <button
      onClick={() => alert(`${children} filter — not implemented in the prototype.`)}
      style={{
        background: "transparent", border: `1px solid ${T.border}`,
        color: T.textDim, fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        padding: "6px 10px", cursor: "pointer",
        textTransform: "uppercase", letterSpacing: "0.12em"
      }}
    >{children}</button>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function EmptyCard({ title, children }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>{title}</div>
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

const primaryButtonStyle = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: T.accent, border: `1px solid ${T.accent}`, color: T.onAccent,
  fontFamily: "inherit", fontSize: 11, fontWeight: 600,
  padding: "6px 12px", cursor: "pointer",
  textTransform: "uppercase", letterSpacing: "0.12em"
};
