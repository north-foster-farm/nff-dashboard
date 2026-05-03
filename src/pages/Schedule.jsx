import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../theme.js";
import {
  formatISODate, formatLongDate, formatTime12h,
  isSameDay, parseISODate, todayUTC
} from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";

export default function Schedule({ data, onShowDetail }) {
  const [view, setView] = useState("calendar");
  const today = useMemo(() => todayUTC(), []);
  const [viewDate, setViewDate] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  // Initialise filters from the data: every event kind starts visible. Adding a
  // new kind to data flows through automatically as a new chip + filter.
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(data.events.kinds.map(k => [k.id, true]))
  );

  const { fromDate, toDate } = useMemo(() => {
    if (view === "calendar") {
      const y = viewDate.getUTCFullYear(), m = viewDate.getUTCMonth();
      const start = new Date(Date.UTC(y, m, 1));
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 41);
      return { fromDate: start, toDate: end };
    }
    const start = today;
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 60);
    return { fromDate: start, toDate: end };
  }, [view, viewDate, today]);

  const occurrences = useMemo(
    () => getEventOccurrences(data.events, fromDate, toDate, filters),
    [data.events, fromDate, toDate, filters]
  );

  const goToPrevMonth = () => setViewDate(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  const goToNextMonth = () => setViewDate(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  const goToToday = () => setViewDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

  return (
    <div>
      <ScheduleControls
        view={view} onViewChange={setView}
        viewDate={viewDate}
        onPrev={goToPrevMonth} onNext={goToNextMonth} onToday={goToToday}
        filters={filters} onFiltersChange={setFilters}
        kinds={data.events.kinds}
      />
      {view === "calendar" ? (
        <CalendarView
          year={viewDate.getUTCFullYear()} month={viewDate.getUTCMonth()}
          occurrences={occurrences} today={today} onClickItem={onShowDetail}
        />
      ) : (
        <TimelineView occurrences={occurrences} today={today} onClickItem={onShowDetail} />
      )}
      <SyncNotice />
    </div>
  );
}

function ScheduleControls({ view, onViewChange, viewDate, onPrev, onNext, onToday, filters, onFiltersChange, kinds }) {
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, background: T.surface }}>
            <ToggleBtn active={view === "calendar"} onClick={() => onViewChange("calendar")}>Calendar</ToggleBtn>
            <ToggleBtn active={view === "timeline"} onClick={() => onViewChange("timeline")}>Timeline</ToggleBtn>
          </div>
          {view === "calendar" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconBtn onClick={onPrev}><ChevronLeft size={14} /></IconBtn>
              <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, minWidth: 160, textAlign: "center" }}>{monthLabel}</div>
              <IconBtn onClick={onNext}><ChevronRight size={14} /></IconBtn>
              <button onClick={onToday} style={{ marginLeft: 4, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, fontFamily: "inherit", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", padding: "5px 10px", cursor: "pointer" }}>Today</button>
            </div>
          )}
        </div>
      </div>
      <FilterChips filters={filters} onChange={onFiltersChange} kinds={kinds} />
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.surfaceAlt : "transparent", border: "none",
      color: active ? T.text : T.textDim, fontFamily: "inherit", fontSize: 11,
      padding: "8px 14px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em"
    }}>{children}</button>
  );
}

function IconBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`, color: T.textDim,
      padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
    }}>{children}</button>
  );
}

function FilterChips({ filters, onChange, kinds }) {
  // Build one chip per event kind in the data, in the order they appear there.
  // Empty kinds remain toggleable so the user can pre-stage filters before any
  // instances exist; they're just rendered with reduced visual weight.
  const chipDefs = kinds.map(k => ({
    id: k.id,
    label: k.label,
    color: T.cat[k.id] || T.cat.default,
    count: k.instances?.length ?? 0
  }));
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
        title={allOn ? "Hide all" : "Show all"}
      >
        {allOn ? "None" : "All"}
      </button>
      {chipDefs.map(c => {
        const active = !!filters[c.id];
        const empty = c.count === 0;
        return (
          <button key={c.id} onClick={() => toggle(c.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: active ? T.surface : "transparent",
            border: `1px solid ${active ? c.color : T.border}`,
            color: active ? T.text : T.textDim,
            fontFamily: "inherit", fontSize: 10, fontWeight: 600,
            padding: "5px 9px", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em",
            opacity: empty && !active ? 0.55 : 1,
            transition: "background-color 120ms ease, border-color 120ms ease, opacity 120ms ease"
          }}>
            <span style={{
              width: 8, height: 8, background: c.color, borderRadius: "50%",
              opacity: active ? 1 : 0.7
            }} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function CalendarView({ year, month, occurrences, today, onClickItem }) {
  const start = new Date(Date.UTC(year, month, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const dateStr = formatISODate(d);
    cells.push({ date: d, inMonth: d.getUTCMonth() === month, dateStr, items: occurrences.filter(o => o.date === dateStr), isToday: isSameDay(d, today) });
  }
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} style={{ padding: "10px 8px", fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((c, i) => <DayCell key={i} {...c} onClickItem={onClickItem} />)}
      </div>
    </div>
  );
}

function DayCell({ date, inMonth, items, isToday, onClickItem }) {
  return (
    <div style={{
      minHeight: 96, padding: "6px 6px 4px",
      borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      background: isToday ? T.surfaceAlt : T.surface,
      opacity: inMonth ? 1 : 0.4, overflow: "hidden"
    }}>
      <div style={{ fontSize: 11, fontWeight: isToday ? 600 : 400, color: isToday ? T.accent : T.text, marginBottom: 4 }}>{date.getUTCDate()}</div>
      {items.slice(0, 2).map((it, idx) => (
        <button key={idx} onClick={() => onClickItem(it)} style={{
          display: "block", width: "100%", textAlign: "left", marginBottom: 2,
          background: T.cat[it.kindId] || T.textDim, border: "none", color: T.onCat,
          fontFamily: "inherit", fontSize: 9, fontWeight: 600,
          padding: "2px 5px", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{formatTime12h(it.startTime).replace(" ", "")} {it.instanceLabel}</button>
      ))}
      {items.length > 2 && <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>+{items.length - 2} more</div>}
    </div>
  );
}

function TimelineView({ occurrences, today, onClickItem }) {
  if (occurrences.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Nothing scheduled in the next 60 days.</div>
        <div style={{ fontSize: 11, color: T.textFaint }}>Try toggling a different filter or check back when more chores have specific times.</div>
      </div>
    );
  }
  const byDate = {};
  for (const o of occurrences) {
    if (!byDate[o.date]) byDate[o.date] = [];
    byDate[o.date].push(o);
  }
  const dates = Object.keys(byDate).sort();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {dates.map(d => {
        const dDate = parseISODate(d);
        const isTodayRow = isSameDay(dDate, today);
        return (
          <div key={d}>
            <div style={{ fontSize: 11, color: isTodayRow ? T.accent : T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontWeight: isTodayRow ? 600 : 400 }}>
              {formatLongDate(d)}{isTodayRow && " · today"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
              {byDate[d].map((it, idx) => <TimelineRow key={idx} item={it} onClick={() => onClickItem(it)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineRow({ item, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: T.surface, padding: "12px 16px", border: "none", textAlign: "left",
      cursor: "pointer", fontFamily: "inherit", display: "grid",
      gridTemplateColumns: "100px 4px 1fr auto", gap: 12, alignItems: "center"
    }}>
      <div style={{ fontSize: 11, color: T.textDim }}>{formatTime12h(item.startTime)}{item.endTime && ` – ${formatTime12h(item.endTime)}`}</div>
      <div style={{ width: 4, height: 28, background: T.cat[item.kindId] || T.textDim }} />
      <div>
        <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, fontWeight: 600 }}>{item.instanceLabel}</div>
        {item.subtitle && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{item.subtitle}</div>}
      </div>
      <div style={{ fontSize: 11, color: T.textDim, textAlign: "right" }}>{item.location.name}</div>
    </button>
  );
}

function SyncNotice() {
  return (
    <div style={{ marginTop: 24, padding: "14px 16px", background: T.surfaceAlt, border: `1px dashed ${T.border}`, fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
      <span style={{ color: T.warn, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 9, marginRight: 8 }}>Planned</span>
      Push-only sync to Google Calendar. Schedule changes here will publish to a linked GCal in a future build. Drag-and-drop reschedule, in-place editing of times, and the actual GCal API call are deferred — see <em>thread_schedule_full_scope</em>.
    </div>
  );
}
