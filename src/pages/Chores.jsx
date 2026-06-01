import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Copy, Pencil, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { T } from "../theme.js";
import {
  CHORE_CATEGORIES, CHORE_PERIODS,
  getAllChoreDefinitions, getChoresForDay, describeFrequency,
  displayStartTime, displayDeadline, displayDeadlineConcrete,
} from "../lib/chores.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useActivityLog } from "../lib/data/useActivityLog.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useSites } from "../lib/data/useSites.js";
import { buildPlaceTree } from "../lib/places.js";
import {
  useChoreBlocks, formatMinutesOfDay,
} from "../lib/data/useChoreBlocks.js";
import { displayBlockSide, resolveBlockMinutes } from "../lib/sunTimes.js";
import ActivityRow from "../components/ActivityRow.jsx";
import ChoresBlocksTab from "../components/ChoresBlocksTab.jsx";
import ChoresPerformanceTab from "../components/ChoresPerformanceTab.jsx";
import ChoreMessageButton from "../components/ChoreMessageButton.jsx";
import ChoreRemainingPill from "../components/ChoreRemainingPill.jsx";
import AssignmentRulesEditor from "../components/AssignmentRulesEditor.jsx";

// The page renders its own header (title + tabs) in place of the generic
// SectionHeader, so it can fit a tab bar + inline actions.

const TABS = [
  { id: "today", label: "Today" },
  { id: "all", label: "All chores" },
  { id: "blocks", label: "Blocks" },
  { id: "performance", label: "Performance" },
  { id: "activity", label: "Activity log" }
];

// The fake-auth current user. Until real auth lands, users pick who they are
// via the small selector on the Today tab. Defaults to James.
const USERS = ["James", "Jim"];

export default function Chores({ data }) {
  const [tab, setTab] = useState("today");
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
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24 }}>
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

// ─── Today ───────────────────────────────────────────────────────────────────

function TodayTab({ data, currentUser, onChangeUser }) {
  const [scope, setScope] = useState("mine"); // "mine" | "all"
  const today = useMemo(() => new Date(), []);
  const { rulesByChoreId, rulesByBlockId } = useChoreAssignmentRules();
  const instances = useMemo(
    () => getChoresForDay(data, today, { rulesByChoreId, rulesByBlockId }),
    [data, today, rulesByChoreId, rulesByBlockId]
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
  // Block-aware period labels: "Morning · 6 AM" comes from the
  // configured Morning block, so editing the block window in
  // Settings → Sites & blocks updates every chore display in one
  // shot. Falls back to instance-derived times when no block matches.
  const { blocks } = useChoreBlocks();

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

  // Width-observed column count. Threshold is 960px: once the content pane
  // crosses that, all period groups switch from one column to two. We
  // measure once on the outer wrapper so every period picks up the same
  // break — avoids weirdness like Morning being 2-col and Evening 1-col
  // just because one had fewer chores.
  const [setWidthRef, cols] = useColumnCount(960);

  // One subscription for the whole tab. The Set + toggle propagate down to
  // each TodayChoreRow as props — see PeriodGroup → TodayChoreRow below.
  const { completedSet, toggle: toggleCompletion } = useChoreCompletions(today);

  const isEmpty = orderedBlockKeys.length === 0;

  return (
    <div ref={setWidthRef}>
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

      {orderedBlockKeys.map(blockKey => {
        const block = blockKey ? blocks.find(b => b.id === blockKey) : null;
        return (
          <BlockGroup
            key={blockKey || "anytime"}
            block={block}
            instances={blockGroups.get(blockKey)}
            cols={cols}
            completedSet={completedSet}
            onToggle={toggleCompletion}
            currentUserEmail={userEmail}
            blocks={blocks}
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
  return (t === "weekly_window" || t === "monthly_last_week_window") ? 1 : 0;
}

function BlockGroup({ block, instances, cols, completedSet, onToggle, currentUserEmail, blocks }) {
  const headerLabel = block ? block.name : "Anytime";
  const timeLabel = block
    ? displayBlockSide(block.startKind, block.startMinutes)
    : "";
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
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
      </div>
      <ColumnList
        items={instances}
        cols={cols}
        keyFor={inst => inst.choreId}
        renderItem={inst => (
          <TodayChoreRow
            inst={inst}
            done={completedSet?.has(inst.chore.id) ?? false}
            onToggle={onToggle}
            currentUserEmail={currentUserEmail}
            blocks={blocks}
          />
        )}
      />
    </div>
  );
}

function TodayChoreRow({ inst, done, onToggle, currentUserEmail, blocks }) {
  const { chore, assignees } = inst;
  // Persistence happens through onToggle (Supabase via useChoreCompletions).
  // The Set arrives via realtime so re-rendering on success is automatic.
  const handleClick = () => onToggle?.(chore.id, done);
  // Right-column metadata: explicit assignees + deadline. If no
  // assignees, show only the deadline — no "unassigned" label.
  // Multi-assignee rules render names joined with " · ".
  const metaParts = [];
  if (assignees && assignees.length > 0) metaParts.push(assignees.join(" · "));
  metaParts.push(displayDeadlineConcrete(chore));

  return (
    <div style={{ background: T.surface, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={handleClick}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        style={{
          width: 20, height: 20, flexShrink: 0,
          background: done ? T.accent : "transparent",
          border: `1.5px solid ${done ? T.accent : T.border}`,
          cursor: "pointer",
          padding: 0,
          transition: "background-color 120ms ease, border-color 120ms ease"
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500,
          color: done ? T.textFaint : T.text,
          textDecoration: done ? "line-through" : "none"
        }}>
          {chore.title}
        </div>
        {chore.description && (
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{chore.description}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: T.textDim }}>{CHORE_CATEGORIES[chore.category]?.label ?? chore.category}</div>
        <div style={{ fontSize: 12, color: T.textFaint, display: "flex", alignItems: "center", gap: 6 }}>
          <ChoreRemainingPill chore={chore} blocks={blocks} />
          <span>{metaParts.join(" · ")}</span>
        </div>
      </div>
      <ChoreMessageButton
        choreId={chore.id}
        choreTitle={chore.title}
        currentUserEmail={currentUserEmail}
      />
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
  const [sort, setSort] = useState("time"); // alpha | time | category
  const [expanded, setExpanded] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // chore_id currently in edit mode
  const {
    definitions: liveDefs, loading: defsLoading,
    updateDefinition, deleteDefinition,
  } = useChoreDefinitions();
  const { places, placesById } = useSites();
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
      || (CHORE_CATEGORIES[c.category]?.label ?? "").toLowerCase().includes(q)
    );
    if (sort === "alpha") {
      out.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "time") {
      // Sort by today's resolved block start time (ascending — chores
      // with no block sort last), then by site name (alphabetical),
      // then by title.
      const today = new Date();
      const blockMap = new Map(blocks.map(b => [b.id, b]));
      const startMin = (chore) => {
        const b = chore.blockId ? blockMap.get(chore.blockId) : null;
        if (!b) return 9999;
        return resolveBlockMinutes(today, b.startKind, b.startMinutes) ?? 9999;
      };
      const placeName = (chore) =>
        chore.placeId ? placesById.get(chore.placeId)?.name ?? "" : "";
      out.sort((a, b) => {
        const sa = startMin(a);
        const sb = startMin(b);
        if (sa !== sb) return sa - sb;
        const na = placeName(a).toLowerCase();
        const nb = placeName(b).toLowerCase();
        if (na !== nb) return na.localeCompare(nb);
        return a.title.localeCompare(b.title);
      });
    } else if (sort === "category") {
      out.sort((a, b) => {
        const ac = CHORE_CATEGORIES[a.category]?.order ?? 99;
        const bc = CHORE_CATEGORIES[b.category]?.order ?? 99;
        if (ac !== bc) return ac - bc;
        return a.title.localeCompare(b.title);
      });
    }
    return out;
  }, [defs, query, sort, blocks, placesById]);

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

      {filtered.length === 0 ? (
        <EmptyCard title="No chores match">Try a different search term.</EmptyCard>
      ) : (
        <AllChoresList
          filtered={filtered}
          expanded={expanded}
          onToggle={toggleExpand}
          editing={editing}
          onStartEdit={startEdit}
          onCancelEdit={() => setEditing(null)}
          onSaveEdit={async (id, patch) => {
            await updateDefinition(id, patch);
            setEditing(null);
          }}
          onQuickSave={updateDefinition}
          onDeleteChore={async (id) => {
            const ok = window.confirm("Delete this chore? This can't be undone.");
            if (!ok) return;
            await deleteDefinition(id);
          }}
          places={places}
          blocks={blocks}
          blockById={blockById}
        />
      )}
    </div>
  );
}

// Same newspaper-split layout as Today, but the width threshold is higher
// (1200px) because each chore-definition row is denser (inline actions +
// expand caret) and needs more horizontal room before it's worth splitting.
function AllChoresList({
  filtered, expanded, onToggle,
  editing, onStartEdit, onCancelEdit, onSaveEdit, onQuickSave, onDeleteChore,
  places, blocks, blockById,
}) {
  const [setWidthRef, cols] = useColumnCount(1200);
  const userEmail = useCurrentUserEmail();
  return (
    <div ref={setWidthRef}>
      <ColumnList
        items={filtered}
        cols={cols}
        keyFor={c => c.id}
        renderItem={chore => (
          <ChoreDefinitionRow
            chore={chore}
            expanded={expanded.has(chore.id)}
            onToggle={() => onToggle(chore.id)}
            currentUserEmail={userEmail}
            editing={editing === chore.id}
            onStartEdit={() => onStartEdit(chore.id)}
            onCancelEdit={onCancelEdit}
            onSaveEdit={(patch) => onSaveEdit(chore.id, patch)}
            onQuickSave={(patch) => onQuickSave(chore.id, patch)}
            onDeleteChore={() => onDeleteChore(chore.id)}
            places={places}
            blocks={blocks}
            blockById={blockById}
          />
        )}
      />
    </div>
  );
}

function SortPicker({ value, onChange }) {
  const options = [
    { id: "alpha", label: "A–Z" },
    { id: "time", label: "Time of day" },
    { id: "category", label: "Category" }
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
  chore, expanded, onToggle, currentUserEmail,
  editing, onStartEdit, onCancelEdit, onSaveEdit, onQuickSave, onDeleteChore,
  places, blocks, blockById,
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
          <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{chore.title}</div>
          <SecondaryRow
            chore={chore}
            places={places}
            blocks={blocks}
            blockById={blockById}
            onQuickSave={onQuickSave}
          />
        </div>
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
      {expanded && (
        editing
          ? <ChoreInlineEditor
              chore={chore}
              places={places}
              blocks={blocks}
              onCancel={onCancelEdit}
              onSave={onSaveEdit}
            />
          : <ExpandedChoreDetail chore={chore} />
      )}
    </div>
  );
}

// Three quick-edit chips on the row's secondary line. Double-click
// any of them to swap in an inline editor for that field; saving
// commits via onQuickSave (chore_definitions update) without
// expanding the full row editor.
function SecondaryRow({ chore, places, blocks, blockById, onQuickSave }) {
  // Pill is conditional — appears only when the helper resolves
  // (window or anytime chores). Render at the end so the layout
  // stays calm for the simple-daily-chore majority.
  const [editing, setEditing] = useState(null); // 'site' | 'schedule' | 'frequency' | null

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
      {editing === "site" ? (
        <PlaceQuickEdit
          chore={chore}
          places={places}
          onSave={save}
          onCancel={close}
        />
      ) : (
        <Chip onDoubleClick={() => setEditing("site")} title="Double-click to edit place">
          {describeChorePlace(chore, places)}
        </Chip>
      )}
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

// ── Place quick-edit ────────────────────────────────────────────────
// Single select of every active place (indented by depth). A chore is
// scoped to one place_id and fans out to that place's subtree.
function PlaceQuickEdit({ chore, places, onSave, onCancel }) {
  const initial = chore.placeId ?? "";
  const [val, setVal] = useState(initial);
  const options = placeSelectOptions(places);

  const submit = async (newVal) => {
    if (newVal === initial) { onCancel(); return; }
    await onSave({ placeId: newVal || null });
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
      <option value="">— no place —</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
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
// Type select; "specific_days" expands inline 7-day toggles.
// weekly_window / monthly_last_week_window types are preserved when
// already present (read-only label here); converting to daily or
// specific-days commits via the type select.
function FrequencyQuickEdit({ chore, onSave, onCancel }) {
  const initial = chore.frequency ?? { type: "daily" };
  const [type, setType] = useState(initial.type ?? "daily");
  const [days, setDays] = useState(
    Array.isArray(initial.days) ? initial.days : []
  );

  const submit = async (nextType, nextDays) => {
    let freq;
    if (nextType === "daily") {
      freq = { type: "daily" };
    } else if (nextType === "specific_days") {
      freq = { type: "specific_days", days: nextDays };
    } else {
      // Preserve the original payload for window types (we don't
      // surface their sub-fields in quick-edit yet).
      freq = initial.type === nextType ? initial : { type: nextType };
    }
    await onSave({ frequency: freq });
  };

  const toggleDay = async (d) => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort();
    setDays(next);
    if (type === "specific_days" && next.length > 0) {
      await onSave({ frequency: { type: "specific_days", days: next } });
    }
  };

  const onTypeChange = (newType) => {
    setType(newType);
    if (newType === "daily") {
      submit("daily", []);
    } else if (newType === "specific_days") {
      // Wait for at least one day to be picked before saving.
      if (days.length > 0) submit("specific_days", days);
    } else {
      submit(newType, []);
    }
  };

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        <option value="specific_days">Specific days</option>
        <option value="weekly_window">Weekly window</option>
        <option value="monthly_last_week_window">Monthly window</option>
      </select>
      {type === "specific_days" && (
        <span style={{ display: "inline-flex", gap: 2 }}>
          {DOW.map((label, idx) => {
            const on = days.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
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

// Place label for the row's secondary line: name + parent for D1
// disambiguation ("Mobile Coop 1 · Pasture C").
function describeChorePlace(chore, places) {
  if (chore.placeId) {
    const p = (places ?? []).find(x => x.id === chore.placeId);
    if (!p) return "(removed place)";
    const parent = p.parentId
      ? (places ?? []).find(x => x.id === p.parentId)
      : null;
    return parent ? `${parent.name} · ${p.name}` : p.name;
  }
  // Fall back to the legacy category text (pre-migration).
  return CHORE_CATEGORIES[chore.category]?.label ?? chore.category ?? "No place";
}

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

function ExpandedChoreDetail({ chore }) {
  return (
    <div style={{ padding: "8px 16px 16px 42px", borderTop: `1px solid ${T.border}`, background: T.surfaceAlt }}>
      {chore.description && (
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 10, lineHeight: 1.6 }}>{chore.description}</div>
      )}
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, margin: 0 }}>
        <Field label="Frequency" value={describeFrequency(chore)} />
        <Field label="Start" value={displayStartTime(chore)} />
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
// Editable fields: title, description, site assignment (specific
// location / parent site / none), block, sort_order. Frequency,
// deadline, and per-day-of-week assignment editing are out of scope
// for v1 — those JSON shapes deserve dedicated editors later.
function ChoreInlineEditor({ chore, places, blocks, onCancel, onSave }) {
  const [title, setTitle] = useState(chore.title);
  const [description, setDescription] = useState(chore.description ?? "");
  const [placeId, setPlaceId] = useState(chore.placeId ?? "");
  const [blockId, setBlockId] = useState(chore.blockId ?? "");
  const [lastChanceBlockId, setLastChanceBlockId] = useState(
    chore.lastChanceBlockId ?? ""
  );
  const [sortOrder, setSortOrder] = useState(chore.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const placeOptions = placeSelectOptions(places);
  const activeBlocks = blocks.filter(b => b.isActive);

  const submit = async () => {
    if (!title.trim()) {
      setErrorMsg("Title can't be empty.");
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
        placeId: placeId || null,
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
      <EditField label="Where">
        <select
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          style={editInputStyle}
        >
          <option value="">— no place —</option>
          {placeOptions.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, lineHeight: 1.5 }}>
          The chore applies to this place and everything beneath it
          (scoping to Pastures covers every tractor and coop).
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
        <div style={{ fontSize: 11, color: "#e25c4a" }}>{errorMsg}</div>
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
