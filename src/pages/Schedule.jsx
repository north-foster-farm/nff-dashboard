import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { T } from "../theme.js";
import { formatISODate, formatLongDate } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useEventMutator } from "../lib/data/useEventMutator.js";
import {
  startOfWeek, advanceDate, formatViewLabel, isoDateLocal,
} from "../lib/calendarMath.js";
import {
  DayView, WeekView, MonthView, AgendaView,
} from "../components/CalendarViews.jsx";
import DateTyperPopover from "../components/DateTyperPopover.jsx";

// Schedule (Batch 14.1). Single page hosting the four-up Day / Week
// / Month / Agenda view toggle, the clickable date-typer header,
// the kind filter chips, and the "+ New event" button. Delegates
// rendering to CalendarViews.
//
// `initialView` is what the parent passes when the user lands here
// from the events_all section (which now folds into Agenda) — see
// SectionContent.jsx.

const VIEWS = ["day", "week", "month", "agenda"];

export default function Schedule({ data, onOpenEvent, initialView, initialFilter }) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  // Default view is mobile-aware: Day on narrow screens, Month
  // otherwise. The toggle is sticky after the first user interaction
  // — we don't auto-flip on resize to avoid jumping mid-task.
  const [view, setView] = useState(() => initialView ?? defaultView());
  const [date, setDate] = useState(today);
  // Filters: every kind starts on by default. When the parent passes
  // `initialFilter` (e.g. clicking a per-kind preset in the sidebar),
  // start with only that kind enabled — the user can re-enable
  // others via the chip strip.
  const [filters, setFilters] = useState(() => {
    const all = Object.fromEntries((data.events?.kinds ?? []).map(k => [k.id, true]));
    if (!initialFilter) return all;
    const limited = Object.fromEntries(Object.keys(all).map(k => [k, false]));
    limited[initialFilter] = true;
    return limited;
  });

  // Chore-block windows for the banded background on Day + Week.
  const { blocks } = useChoreBlocks();
  // Drag-to-reschedule + drag-to-resize commit handlers (Batch 14.2).
  const { moveOccurrence, resizeOccurrence } = useEventMutator();

  // Compute the visible date range based on view. Recurring series
  // expand inside this range; one-offs filter to it.
  const { fromDate, toDate } = useMemo(() => {
    if (view === "day") {
      const start = new Date(date); start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date); end.setUTCHours(23, 59, 59, 999);
      return { fromDate: start, toDate: end };
    }
    if (view === "week") {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { fromDate: toUtcMidnight(start), toDate: toUtcEod(end) };
    }
    if (view === "month") {
      const y = date.getFullYear(); const m = date.getMonth();
      const start = new Date(Date.UTC(y, m, 1));
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 41);
      end.setUTCHours(23, 59, 59, 999);
      return { fromDate: start, toDate: end };
    }
    // Agenda: today → +12 months.
    const start = new Date(today);
    const end = new Date(today); end.setFullYear(end.getFullYear() + 1);
    return { fromDate: toUtcMidnight(start), toDate: toUtcEod(end) };
  }, [view, date, today]);

  const occurrences = useMemo(
    () => getEventOccurrences(data.events, fromDate, toDate, filters),
    [data.events, fromDate, toDate, filters]
  );

  const onClickItem = (item) => {
    onOpenEvent?.({
      mode: "edit",
      seriesId: item.instanceId,
      occurrenceId: item.occurrenceId ?? null,
      occursOn: item.date,
      kindId: item.kindId,
    });
  };

  const onNewEvent = () => {
    onOpenEvent?.({
      mode: "new",
      occursOn: isoDateLocal(view === "day" ? date : today),
    });
  };

  // Click-empty-space → new event seeded with the picked slot.
  const onCreateAt = ({ date: iso, startTime }) => {
    onOpenEvent?.({
      mode: "new",
      occursOn: iso,
      startTime,
    });
  };

  // Drag-to-reschedule commit — wraps useEventMutator so the views
  // don't have to know about series-id resolution.
  const handleMoveOccurrence = ({ occurrence, newDate, newStartTime, newEndTime }) => {
    if (!occurrence?.instanceId) return;
    moveOccurrence({
      seriesId: occurrence.instanceId,
      fromDate: occurrence.date,
      toDate: newDate,
      newStartTime,
      newEndTime,
    });
  };
  const handleResizeOccurrence = ({ occurrence, newStartTime, newEndTime }) => {
    if (!occurrence?.instanceId) return;
    resizeOccurrence({
      seriesId: occurrence.instanceId,
      occursOn: occurrence.date,
      newStartTime,
      newEndTime,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Controls
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        today={today}
        kinds={data.events?.kinds ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        onNewEvent={onNewEvent}
      />
      {view === "day" && (
        <DayView
          date={date}
          occurrences={occurrences}
          blocks={blocks}
          today={today}
          onClickItem={onClickItem}
          onMoveOccurrence={handleMoveOccurrence}
          onResizeOccurrence={handleResizeOccurrence}
          onCreateAt={onCreateAt}
        />
      )}
      {view === "week" && (
        <WeekView
          date={date}
          occurrences={occurrences}
          blocks={blocks}
          today={today}
          onClickItem={onClickItem}
          onMoveOccurrence={handleMoveOccurrence}
          onResizeOccurrence={handleResizeOccurrence}
          onCreateAt={onCreateAt}
        />
      )}
      {view === "month" && (
        <MonthView
          date={date}
          occurrences={occurrences}
          today={today}
          onClickItem={onClickItem}
          onMoveOccurrence={handleMoveOccurrence}
          onCreateAt={onCreateAt}
        />
      )}
      {view === "agenda" && (
        <AgendaView
          occurrences={occurrences}
          today={today}
          onClickItem={onClickItem}
          range={{
            fromLabel: formatLongDate(formatISODate(fromDate)),
            toLabel: formatLongDate(formatISODate(toDate)),
          }}
        />
      )}
    </div>
  );
}

function defaultView() {
  if (typeof window === "undefined") return "month";
  return window.innerWidth < 768 ? "day" : "month";
}

function toUtcMidnight(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0));
}

function toUtcEod(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));
}

// ── Controls ────────────────────────────────────────────────────────
function Controls({
  view, onViewChange,
  date, onDateChange, today,
  kinds, filters, onFiltersChange,
  onNewEvent,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <ViewToggle view={view} onChange={onViewChange} />
          <Nav
            view={view}
            date={date}
            onDateChange={onDateChange}
            today={today}
          />
        </div>
        <button
          onClick={onNewEvent}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          <Plus size={13} className="shrink-0" /> New event
        </button>
      </div>
      <FilterChips kinds={kinds} filters={filters} onChange={onFiltersChange} />
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div className="inline-flex border border-line bg-surface">
      {VIEWS.map((v, i) => {
        const active = v === view;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={
              "px-3 py-1.5 font-[inherit] text-[11px] font-semibold uppercase " +
              "tracking-[0.12em] cursor-pointer border-0 leading-none " +
              (active
                ? "bg-surface-alt text-fg"
                : "bg-transparent text-dim hover:text-fg") +
              (i > 0 ? " border-l border-line" : "")
            }
            aria-pressed={active}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

function Nav({ view, date, onDateChange, today }) {
  const labelRef = useRef(null);
  const [typerOpen, setTyperOpen] = useState(false);
  const isAgenda = view === "agenda";
  const label = isAgenda
    ? "Next 12 months"
    : formatViewLabel(view, date);

  const goPrev = () => onDateChange(advanceDate(date, view, -1));
  const goNext = () => onDateChange(advanceDate(date, view, 1));
  const goToday = () => onDateChange(today);

  return (
    <div className="flex items-center gap-2">
      {!isAgenda && (
        <>
          <NavBtn onClick={goPrev} ariaLabel="Previous">
            <ChevronLeft size={14} />
          </NavBtn>
          <button
            ref={labelRef}
            onClick={() => setTyperOpen(true)}
            className="font-heading text-[16px] font-semibold min-w-[180px] text-center bg-transparent border-0 cursor-pointer hover:underline px-1"
            title="Click to type a date"
          >
            {label}
          </button>
          <NavBtn onClick={goNext} ariaLabel="Next">
            <ChevronRight size={14} />
          </NavBtn>
          <button
            onClick={goToday}
            className="ml-1 bg-transparent border border-line text-dim font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 cursor-pointer"
          >
            Today
          </button>
          {typerOpen && (
            <DateTyperPopover
              initial={date}
              anchorRef={labelRef}
              onCancel={() => setTyperOpen(false)}
              onPick={(d) => { onDateChange(d); setTyperOpen(false); }}
            />
          )}
        </>
      )}
      {isAgenda && (
        <span className="font-heading text-[16px] font-semibold text-fg px-1">
          {label}
        </span>
      )}
    </div>
  );
}

function NavBtn({ onClick, ariaLabel, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="bg-surface border border-line text-dim hover:text-fg font-[inherit] px-2 py-1.5 cursor-pointer flex items-center justify-center"
    >
      {children}
    </button>
  );
}

function FilterChips({ kinds, filters, onChange }) {
  const chipDefs = (kinds ?? [])
    .map(k => ({
      id: k.id,
      label: k.label,
      color: T.cat[k.id] || T.cat.default,
      count: k.instances?.length ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const toggle = (id) => onChange({ ...filters, [id]: !filters[id] });
  const allOn = chipDefs.every(c => filters[c.id]);
  const setAll = (val) =>
    onChange(Object.fromEntries(chipDefs.map(c => [c.id, val])));

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => setAll(!allOn)}
        className="bg-transparent border border-line text-dim hover:text-fg font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 cursor-pointer"
        title={allOn ? "Hide all kinds" : "Show all kinds"}
      >
        {allOn ? "None" : "All"}
      </button>
      {chipDefs.map(c => {
        const active = !!filters[c.id];
        const dim = c.count === 0;
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            className={
              "inline-flex items-center gap-1.5 font-[inherit] text-[10px] " +
              "font-semibold uppercase tracking-[0.12em] px-2.5 py-1 " +
              "cursor-pointer border " +
              (active
                ? "bg-surface text-fg"
                : "bg-transparent text-dim")
            }
            style={{
              borderColor: active ? c.color : undefined,
              opacity: dim && !active ? 0.55 : 1,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
