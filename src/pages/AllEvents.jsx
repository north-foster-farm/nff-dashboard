import { useMemo, useState } from "react";
import { ArrowDownNarrowWide, ArrowUpNarrowWide } from "lucide-react";
import { T } from "../theme.js";
import { formatLongDate, formatTime12h, parseISODate } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";

// All events, in chronological order, with:
//   - sort direction toggle (asc / desc)
//   - one filter chip per event kind (multi-select; sticky-on by default)
//   - date range selector (defaults to today → +12 months)
// Recurring instances are expanded to one row per occurrence within the
// chosen window so users see e.g. every Saturday Scituate market separately.

const DAY_MS = 24 * 60 * 60 * 1000;

function isoFromDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return { from: isoFromDate(start), to: isoFromDate(end) };
}

export default function AllEvents({ data }) {
  const kinds = data.events.kinds;
  const [range, setRange] = useState(defaultRange);
  const [sortDir, setSortDir] = useState("asc");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(kinds.map(k => [k.id, true]))
  );

  const occurrences = useMemo(() => {
    const fromDate = parseISODate(range.from);
    const toDate = parseISODate(range.to);
    if (!fromDate || !toDate || fromDate > toDate) return [];
    const all = getEventOccurrences(data.events, fromDate, toDate, filters);
    if (sortDir === "desc") all.reverse();
    return all;
  }, [data.events, range, filters, sortDir]);

  return (
    <div>
      <ControlsBar
        kinds={kinds}
        filters={filters}
        onFiltersChange={setFilters}
        range={range}
        onRangeChange={setRange}
        sortDir={sortDir}
        onToggleSort={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
        count={occurrences.length}
      />
      {occurrences.length === 0 ? (
        <EmptyState />
      ) : (
        <EventsList occurrences={occurrences} />
      )}
    </div>
  );
}

// ─── Controls ────────────────────────────────────────────────────────────────

function ControlsBar({ kinds, filters, onFiltersChange, range, onRangeChange, sortDir, onToggleSort, count }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <DateRange range={range} onChange={onRangeChange} />
        <SortToggle dir={sortDir} onToggle={onToggleSort} />
        <div style={{ marginLeft: "auto", fontSize: 11, color: T.textFaint }}>
          {count} {count === 1 ? "event" : "events"}
        </div>
      </div>
      <FilterChips kinds={kinds} filters={filters} onChange={onFiltersChange} />
    </div>
  );
}

function DateRange({ range, onChange }) {
  const setFrom = e => onChange({ ...range, from: e.target.value });
  const setTo = e => onChange({ ...range, to: e.target.value });
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>From</span>
      <DateInput value={range.from} onChange={setFrom} />
      <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>to</span>
      <DateInput value={range.to} onChange={setTo} />
    </div>
  );
}

function DateInput({ value, onChange }) {
  return (
    <input
      type="date"
      value={value}
      onChange={onChange}
      style={{
        background: T.surface, border: `1px solid ${T.border}`, color: T.text,
        fontFamily: "inherit", fontSize: 12,
        padding: "5px 8px", outline: "none"
      }}
    />
  );
}

function SortToggle({ dir, onToggle }) {
  const Icon = dir === "asc" ? ArrowUpNarrowWide : ArrowDownNarrowWide;
  const label = dir === "asc" ? "Earliest first" : "Latest first";
  return (
    <button
      onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: T.surface, border: `1px solid ${T.border}`,
        color: T.text, fontFamily: "inherit", fontSize: 11, fontWeight: 600,
        padding: "5px 10px", cursor: "pointer",
        textTransform: "uppercase", letterSpacing: "0.1em"
      }}
      title="Toggle sort direction"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function FilterChips({ kinds, filters, onChange }) {
  const chipDefs = kinds
    .map(k => ({ id: k.id, label: k.label, color: T.cat[k.id] || T.cat.default, count: k.instances?.length ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const toggle = id => onChange({ ...filters, [id]: !filters[id] });
  const allOn = chipDefs.every(c => filters[c.id]);
  const setAll = (val) => onChange(Object.fromEntries(chipDefs.map(c => [c.id, val])));
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <button
        onClick={() => setAll(!allOn)}
        style={{
          background: "transparent", border: `1px solid ${T.border}`,
          color: T.textDim, fontFamily: "inherit", fontSize: 10, fontWeight: 600,
          padding: "5px 9px", cursor: "pointer",
          textTransform: "uppercase", letterSpacing: "0.12em"
        }}
      >{allOn ? "Clear all" : "Select all"}</button>
      {chipDefs.map(c => {
        const active = !!filters[c.id];
        const dim = c.count === 0;
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: active ? T.surface : "transparent",
              border: `1px solid ${active ? c.color : T.border}`,
              color: active ? T.text : T.textDim,
              opacity: dim ? 0.55 : 1,
              fontFamily: "inherit", fontSize: 10, fontWeight: 600,
              padding: "5px 9px", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.12em"
            }}
          >
            <span style={{ width: 6, height: 6, background: c.color, borderRadius: "50%" }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── List ────────────────────────────────────────────────────────────────────

function EventsList({ occurrences }) {
  // Group into [{ dateLabel, items }] runs of the same date so users can
  // scan day-by-day. Order within each group preserves the controlling sort.
  const groups = [];
  for (const ev of occurrences) {
    const last = groups[groups.length - 1];
    if (last && last.date === ev.date) last.items.push(ev);
    else groups.push({ date: ev.date, items: [ev] });
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map(g => <DayGroup key={g.date} group={g} />)}
    </div>
  );
}

function DayGroup({ group }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600, marginBottom: 8 }}>
        {formatLongDate(group.date)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {group.items.map(ev => <EventRow key={ev.instanceId + ev.date} ev={ev} />)}
      </div>
    </div>
  );
}

function EventRow({ ev }) {
  const color = T.cat[ev.kindId] || T.cat.default;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", background: T.surface, padding: "10px 14px" }}>
      <div style={{ width: 4, alignSelf: "stretch", background: color, flexShrink: 0 }} />
      <div style={{ fontVariantNumeric: "tabular-nums", color: T.textDim, fontSize: 11, minWidth: 88, flexShrink: 0 }}>
        {ev.startTime ? formatTime12h(ev.startTime) : ""}
        {ev.endTime ? ` – ${formatTime12h(ev.endTime)}` : ""}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{ev.instanceLabel}</div>
        {ev.subtitle && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{ev.subtitle}</div>}
      </div>
      <div style={{ fontSize: 11, color: T.textDim, flexShrink: 0, textAlign: "right" }}>
        <div>{ev.kindLabel}</div>
        {ev.location?.name && <div style={{ color: T.textFaint, marginTop: 1 }}>{ev.location.name}</div>}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>No events</div>
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.6 }}>
        No events match the selected types within this date range. Try widening the range or selecting more types.
      </div>
    </div>
  );
}
