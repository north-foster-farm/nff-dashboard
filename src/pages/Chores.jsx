import { useMemo, useState, useEffect, useCallback } from "react";
import { Plus, Search, Copy, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../theme.js";
import {
  CHORE_CATEGORIES, CHORE_PERIODS,
  getAllChoreDefinitions, getChoresForDay, describeFrequency,
  displayStartTime, displayDeadline, displayDeadlineConcrete
} from "../lib/chores.js";

// The page renders its own header (title + tabs) in place of the generic
// SectionHeader, so it can fit a tab bar + inline actions.

const TABS = [
  { id: "today", label: "Today" },
  { id: "all", label: "All chores" },
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
  const instances = useMemo(() => getChoresForDay(data, today), [data, today]);

  // In "mine" mode, show chores assigned to the current user OR unassigned.
  // In "all", show everything.
  const visible = instances.filter(i =>
    scope === "all" || i.assignee == null || i.assignee === currentUser
  );

  // Group by period for the linear timeline feel.
  const groups = {};
  for (const inst of visible) {
    const key = inst.chore.period || "anytime";
    (groups[key] ??= []).push(inst);
  }
  const orderedKeys = Object.keys(groups).sort(
    (a, b) => (CHORE_PERIODS[a]?.order ?? 99) - (CHORE_PERIODS[b]?.order ?? 99)
  );

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  // Width-observed column count. Threshold is 960px: once the content pane
  // crosses that, all period groups switch from one column to two. We
  // measure once on the outer wrapper so every period picks up the same
  // break — avoids weirdness like Morning being 2-col and Evening 1-col
  // just because one had fewer chores.
  const [setWidthRef, cols] = useColumnCount(960);

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

      {orderedKeys.length === 0 && (
        <EmptyCard title="Nothing to do today">
          {scope === "mine" ? "No chores assigned to you or unassigned today." : "No chores scheduled today."}
        </EmptyCard>
      )}

      {orderedKeys.map(period => (
        <PeriodGroup key={period} period={period} instances={groups[period]} cols={cols} />
      ))}
    </div>
  );
}

function PeriodGroup({ period, instances, cols }) {
  const meta = CHORE_PERIODS[period];
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div style={{
          fontFamily: T.uiLabel, fontSize: 14, color: T.text,
          textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700
        }}>
          {meta?.label ?? period}
        </div>
        {meta?.hint && <div style={{ fontSize: 12, color: T.textDim }}>{meta.hint}</div>}
        <div style={{ fontSize: 11, color: T.textMuted, marginLeft: "auto" }}>
          {instances.length} {instances.length === 1 ? "chore" : "chores"}
        </div>
      </div>
      <ColumnList
        items={instances}
        cols={cols}
        keyFor={inst => inst.choreId}
        renderItem={inst => <TodayChoreRow inst={inst} />}
      />
    </div>
  );
}

function TodayChoreRow({ inst }) {
  const [done, setDone] = useState(false);
  const { chore, assignee } = inst;
  return (
    <div style={{ background: T.surface, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={() => setDone(v => !v)}
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
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{chore.description}</div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.textDim }}>{CHORE_CATEGORIES[chore.category]?.label ?? chore.category}</div>
        <div style={{ fontSize: 11, color: T.textFaint }}>
          {assignee ?? "unassigned"} · {displayDeadlineConcrete(chore)}
        </div>
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
  const [sort, setSort] = useState("alpha"); // alpha | time | category
  const [expanded, setExpanded] = useState(() => new Set());
  const defs = getAllChoreDefinitions(data);

  const toggleExpand = id => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
      out.sort((a, b) => {
        const ap = CHORE_PERIODS[a.period]?.order ?? 99;
        const bp = CHORE_PERIODS[b.period]?.order ?? 99;
        if (ap !== bp) return ap - bp;
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
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
  }, [defs, query, sort]);

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
        />
      )}
    </div>
  );
}

// Same newspaper-split layout as Today, but the width threshold is higher
// (1200px) because each chore-definition row is denser (inline actions +
// expand caret) and needs more horizontal room before it's worth splitting.
function AllChoresList({ filtered, expanded, onToggle }) {
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
            expanded={expanded.has(chore.id)}
            onToggle={() => onToggle(chore.id)}
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

function ChoreDefinitionRow({ chore, expanded, onToggle }) {
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
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
            {CHORE_CATEGORIES[chore.category]?.label ?? chore.category}
            {" · "}
            {displayStartTime(chore)}
            {" · "}
            {describeFrequency(chore)}
          </div>
        </div>
        <RowActions choreId={chore.id} />
      </div>
      {expanded && <ExpandedChoreDetail chore={chore} />}
    </div>
  );
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

function RowActions({ choreId }) {
  const notImpl = (action) => () => alert(`${action} chore — not implemented in the prototype.`);
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <IconAction title="Edit" onClick={notImpl("Edit")}><Pencil size={13} /></IconAction>
      <IconAction title="Duplicate" onClick={notImpl("Duplicate")}><Copy size={13} /></IconAction>
      <IconAction title="Delete" onClick={notImpl("Delete")}><Trash2 size={13} /></IconAction>
    </div>
  );
}

function IconAction({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "transparent", border: "none", color: T.textMuted,
        padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: "color 120ms ease"
      }}
      onMouseEnter={e => (e.currentTarget.style.color = T.text)}
      onMouseLeave={e => (e.currentTarget.style.color = T.textMuted)}
    >{children}</button>
  );
}

// ─── Activity log ────────────────────────────────────────────────────────────

function ActivityLogTab({ data }) {
  const [query, setQuery] = useState("");
  // Composable filter state. All currently empty because no completions exist
  // in prototype data. Once they do, these become the compose inputs.
  const completions = data?.chores?.completions ?? [];

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

      {completions.length === 0 ? (
        <EmptyCard title="No completions logged yet">
          Once chores start being checked off, every completion (and the person who did it) lands here with filters to compose across.
        </EmptyCard>
      ) : (
        <div>{/* activity rows — deferred until the log storage thread resolves */}</div>
      )}
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
