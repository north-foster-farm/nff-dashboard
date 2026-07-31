import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Pencil, Trash2, ChevronDown, ChevronRight, CloudOff,
  Sparkles,
} from "lucide-react";
import { CheckTarget, BTN_ACCENT, BTN_GHOST } from "../components/ui.jsx";
import {
  getAllChoreDefinitions, getChoresForDay, describeFrequency,
  displayStartTime, displayDeadline, displayDeadlineConcrete,
  obligationPlaceIds, describeChoreAnchor, describeChoreSchedule,
  compareChoreOrder,
} from "../lib/chores.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useSites } from "../lib/data/useSites.js";
import { childrenOf } from "../lib/places.js";
import {
  useChoreBlocks,
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
import ChoreFieldsEditor, {
  EditField, EDIT_INPUT_CLS,
} from "../components/ChoreFieldsEditor.jsx";
import {
  PlaceTreeNode, PlaceTreeSection,
} from "../components/PlaceTree.jsx";
import { useRoute, navigate, usePersistedState } from "../lib/browser/router.js";
import {
  blockLabel, NO_BLOCK_BUCKET, NO_BLOCK_LABEL,
} from "../lib/schedule/placement.js";

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
      <h2 className="font-heading text-[32px] font-bold tracking-[-0.02em] m-0 mb-3.5">
        Chores
      </h2>
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
    <div className="flex flex-wrap border-b border-line mb-6">
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={
              "bg-transparent border-0 border-b-2 px-[18px] py-2.5 cursor-pointer " +
              "font-[inherit] text-[11px] uppercase tracking-[0.12em] -mb-px " +
              "transition-colors duration-150 " +
              (isActive
                ? "border-accent text-fg font-semibold"
                : "border-transparent text-dim font-medium")
            }
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
      className="no-scrollbar sticky top-0 z-20 flex items-center gap-1.5
        overflow-x-auto py-2.5 mb-2.5 bg-bg border-b border-line"
    >
      {items.map(it => (
        <button
          key={it.id}
          onClick={() => onJump(it.id)}
          className="inline-flex items-center gap-1.5 bg-surface border border-line
            text-dim font-[inherit] text-[11px] font-semibold px-2.5 py-[5px]
            cursor-pointer uppercase tracking-[0.12em] whitespace-nowrap shrink-0"
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
  // per session, keyed by block id (the orphan bucket for no-block rows).
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
  const { blocks, blockById } = useChoreBlocks();
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
  // "" bucket for chores that have no block. Order blocks by
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
      <div className="flex justify-between items-center flex-wrap gap-3 mb-[18px]">
        <div className="text-[13px] text-dim">{dateLabel}</div>
        <div className="flex gap-1.5 items-center">
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
            id: blockKey || NO_BLOCK_BUCKET,
            label: blockLabel(block),
            icon: <Icon size={12} className="shrink-0" />,
          };
        })}
        onJump={(id) => {
          setCollapsedBlocks(prev => prev.filter(k => k !== id));
          jumpToSection(`today-block-${id}`);
        }}
      />

      {visibleBlockKeys.map(blockKey => {
        const block = blockKey ? blocks.find(b => b.id === blockKey) : null;
        const key = blockKey || NO_BLOCK_BUCKET;
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
            blockById={blockById}
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
  currentUserEmail, blocks, blockById, collapsed, onToggleCollapsed,
}) {
  const headerLabel = blockLabel(block);
  const timeLabel = block
    ? displayBlockSide(block.startKind, block.startMinutes)
    : "";
  return (
    <div
      id={domId}
      className={collapsed ? "mb-4" : "mb-8"}
      style={{ scrollMarginTop: JUMP_NAV_OFFSET }}
    >
      <button
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        className="flex items-baseline gap-3 mb-2 w-full bg-transparent border-0
          p-0 cursor-pointer font-[inherit] text-left"
      >
        {collapsed
          ? <ChevronRight size={14} className="text-muted shrink-0 self-center" />
          : <ChevronDown size={14} className="text-muted shrink-0 self-center" />}
        <div className="font-ui text-[14px] text-fg uppercase tracking-[0.14em] font-bold">
          {headerLabel}
        </div>
        {timeLabel && <div className="text-[12px] text-dim">{timeLabel}</div>}
        <div className="text-[11px] text-muted ml-auto">
          {instances.length} {instances.length === 1 ? "chore" : "chores"}
        </div>
      </button>
      {!collapsed && (
        // F136 — inset the place tree under the block header so the
        // block -> place -> chore hierarchy steps inward instead of all
        // sharing the left edge.
        <div className="pl-[18px]">
          <TodayPlaceTree
            instances={instances}
            roots={roots}
            childrenByParent={childrenByParent}
            completions={completions}
            choreCtx={choreCtx}
            currentUserEmail={currentUserEmail}
            blocks={blocks}
            blockById={blockById}
          />
        </div>
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
  currentUserEmail, blocks, blockById,
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
    const byOrder = (a, b) =>
      compareChoreOrder(a.inst.chore, b.inst.chore);
    for (const list of byPlace.values()) list.sort(byOrder);

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
    farm.sort(byOrder);

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
      blockById={blockById}
      choreCtx={choreCtx}
    />
  );
  const keyOf = ({ inst, placeId }) => `${inst.choreId}|${placeId ?? "farm"}`;

  return (
    <div className="flex flex-col gap-0.5">
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
  inst, placeId, completions, currentUserEmail, blocks, choreCtx,
}) {
  const { chore, assignees } = inst;
  const isDone = completions.isDone(chore.id, placeId);
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;

  // F137 surfaced anchor + schedule + frequency here so the do-surface
  // carries the same context as All chores. D2 trims the redundancy:
  // this row already sits under a block section header naming the block
  // + time, so the per-row schedule echo ("Morning (sunrise)") is
  // dropped, and "every day" — true of nearly every row — is suppressed
  // so only a deviating recurrence (e.g. "Mondays") shows. The anchor
  // stays: its species/occupancy detail is the part the place-tree node
  // doesn't already carry.
  const isDaily = (chore?.frequency?.type ?? "daily") === "daily";
  const metaLine = [
    choreCtx ? describeChoreAnchor(chore, choreCtx) : null,
    isDaily ? null : describeFrequency(chore),
  ].filter(Boolean).join(" · ");

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
      : displayDeadlineConcrete(chore, blocks)
  );

  // Completion writes through the shared CheckTarget -> outbox path, with a
  // local pending guard (matches ChoreCheckRow) so a double-tap can't
  // double-fire the toggle.
  const [pending, setPending] = useState(false);
  const onToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await completions.toggle(chore.id, placeId, isDone);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={"bg-surface" + (effects.skipped ? " opacity-60" : "")}>
      <div className="px-3.5 py-2.5 flex items-center gap-3">
        <CheckTarget
          done={isDone}
          queued={queued}
          pending={pending}
          onToggle={onToggle}
        />
        <div className="flex-1 min-w-0">
          <div className={
            "text-[13px] font-medium flex items-center gap-2 " +
            (isDone ? "text-faint" : "text-fg") +
            (isDone || effects.skipped ? " line-through" : "")
          }>
            <span>{effects.replaceText ?? chore.title}</span>
            {(chore.automationEmissionId || chore.processExpansionId) && (
              <Sparkles
                size={12}
                className="text-accent-deep shrink-0"
                aria-label="Created by an automation"
              />
            )}
            <ModifierBadges resolved={resolved} />
            {queued && (
              <CloudOff
                size={12}
                className="text-warn shrink-0"
                aria-label="Saved on this device — not synced yet"
              />
            )}
          </div>
          {metaLine && (
            <div className="text-[12px] text-dim mt-0.5">{metaLine}</div>
          )}
          {effects.prependText && (
            <div className="text-[12px] text-accent-deep font-medium mt-0.5">
              {effects.prependText}
            </div>
          )}
          {chore.description && (
            <div className="text-[12px] text-dim mt-0.5">{chore.description}</div>
          )}
        </div>
        <div className="text-[12px] text-faint flex items-center gap-1.5 shrink-0">
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
      className="bg-surface border border-line text-fg font-[inherit] text-[11px]
        px-2 py-[5px] cursor-pointer uppercase tracking-[0.12em]"
      title="Viewing as"
    >
      {USERS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

function Toggle({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "font-[inherit] text-[11px] font-semibold px-[9px] py-[5px] cursor-pointer " +
        "uppercase tracking-[0.12em] border " +
        (active
          ? "bg-surface border-accent text-fg"
          : "bg-transparent border-line text-dim")
      }
    >{children}</button>
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
          <button className={BTN_ACCENT} onClick={() => alert("Add new chore — not implemented in the prototype.")}>
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
  defs, roots, childrenByParent, choreCtx,
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
    const byOrder = (a, b) => compareChoreOrder(a.chore, b.chore);
    for (const list of byPlace.values()) list.sort(byOrder);
    farm.sort(byOrder);
    sleeping.sort(compareChoreOrder);
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
    <div className="flex border border-line bg-surface">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={
            "border-0 font-[inherit] text-[11px] font-semibold px-2.5 py-1.5 " +
            "cursor-pointer uppercase tracking-[0.12em] " +
            (value === o.id
              ? "bg-surface-alt text-fg"
              : "bg-transparent text-dim")
          }
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
    <div className="bg-surface">
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={onToggle}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="bg-transparent border-0 cursor-pointer p-0.5 flex text-muted"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-fg flex items-baseline gap-2">
            <span>{chore.title}</span>
            {(chore.automationEmissionId || chore.processExpansionId) && (
              <Sparkles
                size={12}
                className="text-accent-deep shrink-0 self-center"
                aria-label="Created by an automation"
              />
            )}
            {fannedCount > 1 && (
              <span className="text-[11px] text-muted font-normal">
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
        <div className="flex items-center gap-1 shrink-0">
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
          : <ExpandedChoreDetail chore={chore} blocks={blocks} blockById={blockById} />
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
  // (window or block-less chores). Render at the end so the layout
  // stays calm for the simple-daily-chore majority.
  const [editing, setEditing] = useState(null); // 'schedule' | 'frequency' | null

  const close = () => setEditing(null);
  const save = async (patch) => {
    await onQuickSave(patch);
    close();
  };

  return (
    <div className="text-[12px] text-dim mt-0.5 flex items-center flex-wrap gap-1.5">
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
      className="bg-transparent border-0 text-inherit font-[inherit] p-0
        cursor-default text-left"
    >
      {children}
    </button>
  );
}

function ChipSep() {
  return <span aria-hidden className="text-faint select-none">·</span>;
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
      className={EDIT_CHIP_INPUT}
    >
      {/* F30: every chore belongs to a block. Clearing one is not
          offered — the empty option shows only for a chore that is
          already block-less, so it can be given one. */}
      {initial === "" && <option value="">{NO_BLOCK_LABEL}</option>}
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
    <span className="inline-flex gap-0.5">
      {FREQ_DOW.map((label, idx) => {
        const on = multi ? selected.includes(idx) : selected === idx;
        return (
          <button
            key={idx}
            onClick={() => onPick(idx)}
            aria-pressed={on}
            className={
              "border border-line font-[inherit] text-[11px] font-semibold " +
              "px-1.5 py-0.5 cursor-pointer uppercase tracking-[0.06em] " +
              (on ? "bg-row-active text-fg" : "bg-transparent text-dim")
            }
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
      className="inline-flex items-center gap-1.5 flex-wrap"
    >
      <select
        autoFocus
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        className={EDIT_CHIP_INPUT}
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
            className={EDIT_CHIP_INPUT + " w-12"}
          />
          <select
            value={unit}
            onChange={(e) => changeUnit(e.target.value)}
            className={EDIT_CHIP_INPUT}
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
        <span className="text-muted text-[11px]">
          materialized by the process engine
        </span>
      )}

      <button
        onClick={onCancel}
        className="bg-transparent border-0 text-muted cursor-pointer
          font-[inherit] text-[11px] px-1.5 py-0.5"
        title="Done editing"
      >
        Done
      </button>
    </span>
  );
}

const EDIT_CHIP_INPUT =
  "bg-surface border border-line text-fg text-[12px] px-1.5 py-0.5 font-[inherit]";

function ExpandedChoreDetail({ chore, blocks, blockById }) {
  return (
    <div className="pt-2 pb-4 px-4 pl-[42px] border-t border-line bg-surface-alt">
      {chore.description && (
        <div className="text-[12px] text-dim mb-2.5 leading-relaxed">{chore.description}</div>
      )}
      <dl
        className="grid gap-2.5 m-0"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        <Field label="Frequency" value={describeFrequency(chore)} />
        <Field
          label="Block"
          value={blockById
            ? describeChoreSchedule(chore, blockById)
            : displayStartTime(chore)}
        />
        <Field label="Deadline" value={displayDeadline(chore, blocks)} />
        <Field label="Assignment" value={describeAssignment(chore.assignment)} />
      </dl>
      <div className="mt-3 text-[11px] text-faint italic">
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
      <dt className="text-[9px] text-faint uppercase tracking-[0.12em] mb-[3px]">{label}</dt>
      <dd className="text-[12px] text-fg m-0">{value}</dd>
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
// The chore field-set (title, description, "belongs to" anchor, When
// block, deadline block) is rendered by the shared <ChoreFieldsEditor>
// — the same control set the Processes step editor uses, so the two
// stay in lockstep. This host adds the chore-only bits around it: sort
// order, the assignment-rules editor, and an explicit Save (the draft
// accumulates locally and persists once, on Save).
function ChoreInlineEditor({
  chore, places, blocks, groups, speciesById, onCancel, onSave,
}) {
  const [draft, setDraft] = useState(() => ({
    title: chore.title,
    description: chore.description ?? "",
    blockId: chore.blockId ?? null,
    lastChanceBlockId: chore.lastChanceBlockId ?? null,
    startTime: chore.startTime ?? null,
    anchorType:
      chore.anchorType ?? (chore.placeId ? "occupied_place" : "none"),
    anchorSpeciesId: chore.anchorSpeciesId ?? null,
    anchorBatchId: chore.anchorBatchId ?? null,
    anchorKindTag: chore.anchorKindTag ?? null,
    placeId: chore.placeId ?? null,
    atPlaceId: chore.atPlaceId ?? null,
  }));
  const [sortOrder, setSortOrder] = useState(chore.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const patch = (p) => setDraft(d => ({ ...d, ...p }));

  const submit = async () => {
    if (!draft.title.trim()) {
      setErrorMsg("Title can't be empty.");
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await onSave({
        title: draft.title.trim(),
        description: draft.description,
        sortOrder: Number(sortOrder) || 0,
        blockId: draft.blockId || null,
        lastChanceBlockId: draft.lastChanceBlockId || null,
        startTime: draft.startTime || null,
        anchorType: draft.anchorType,
        anchorSpeciesId: draft.anchorSpeciesId ?? null,
        anchorBatchId: draft.anchorBatchId ?? null,
        anchorKindTag: draft.anchorKindTag ?? null,
        placeId: draft.placeId ?? null,
        atPlaceId: draft.atPlaceId ?? null,
      });
    } catch (err) {
      console.error("save chore:", err);
      setErrorMsg(err?.message ?? "Save failed.");
      setSaving(false);
    }
  };

  return (
    <div className="pt-3 pb-4 px-4 pl-[42px] border-t border-line bg-surface-alt
      flex flex-col gap-3">
      <ChoreFieldsEditor
        value={draft}
        onChange={patch}
        places={places}
        blocks={blocks}
        groups={groups}
        speciesById={speciesById}
        concreteAnimals
        commitMode="change"
      />
      <EditField label="Sort order">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={EDIT_INPUT_CLS + " w-[90px]"}
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

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} disabled={saving} className={BTN_GHOST}>
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className={BTN_ACCENT}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function IconAction({ title, onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "bg-transparent border-0 p-1 cursor-pointer flex items-center " +
        "justify-center transition-colors duration-100 " +
        (active ? "text-accent" : "text-muted hover:text-fg")
      }
    >{children}</button>
  );
}

// ─── Activity log ────────────────────────────────────────────────────────────
// Reads the live activity_log table and filters to chore-related kinds, so
// this tab is purpose-built for "what got checked off, by whom, when". The
// global Activity page covers all kinds (chore + batch assignment + future
// kinds); this one stays focused.

const CHORE_ACTIVITY_KINDS = new Set(["chore_completed", "chore_uncompleted"]);

function ActivityLogTab() {
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
    <div className="flex gap-3 items-center justify-between flex-wrap mb-[18px]">
      {children}
    </div>
  );
}

function ControlsActions({ children }) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative basis-[360px] grow-0 shrink min-w-[220px]">
      <Search
        size={13}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted"
      />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-line text-fg font-[inherit]
          text-[12px] py-[7px] pr-2.5 pl-[30px] outline-none focus:border-accent"
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
    <div
      className="grid gap-px bg-line"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {columns.map((colItems, i) => (
        <div key={i} className="flex flex-col gap-px bg-line">
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
      className={BTN_GHOST}
    >{children}</button>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────────────

// Flush empty/loading notice (DESIGN principle 1 — a hairline border on the
// page bg, not a raised surface card).
function EmptyCard({ title, children }) {
  return (
    <div className="border border-line py-8 px-6 text-center">
      <div className="text-[13px] text-muted mb-1.5 font-medium">{title}</div>
      <div className="text-[11px] text-faint leading-relaxed">{children}</div>
    </div>
  );
}
