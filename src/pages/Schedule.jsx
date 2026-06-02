import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { T } from "../theme.js";
import { formatISODate, formatLongDate } from "../lib/dates.js";
import { getEventOccurrences } from "../lib/recurrence.js";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useEventMutator } from "../lib/data/useEventMutator.js";
import { useSeriesBatchMap } from "../lib/data/useSeriesBatchMap.js";
import {
  startOfWeek, advanceDate, formatViewLabel, isoDateLocal,
} from "../lib/calendarMath.js";
import {
  DayView, WeekView, MonthView, AgendaView,
} from "../components/CalendarViews.jsx";
import DateTyperPopover from "../components/DateTyperPopover.jsx";
import { usePersistedState } from "../lib/router.js";

// Schedule (Batch 14.1). Single page hosting the four-up Day / Week
// / Month / Agenda view toggle, the clickable date-typer header,
// the kind filter chips, and the "+ New event" button. Delegates
// rendering to CalendarViews.
//
// `initialView` is what the parent passes when the user lands here
// from the events_all section (which now folds into Agenda) — see
// SectionContent.jsx.
//
// `forPlace` (Batch 27.6) turns the page into a place timeline:
// `{ place, batchIds: Set }` filters occurrences down to the events
// of the batches placed there. Passed by MapPage's PlaceTimeline.

const VIEWS = ["day", "week", "month", "agenda"];

export default function Schedule({
  data, onOpenEvent, initialView, initialFilter, forPlace,
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  // Preset instances (per-kind sidebar children / events_all) force
  // their own view + filter; the plain Schedule screen persists what
  // the user last picked across navigation + reload.
  const isPreset = !!(initialView || initialFilter);

  // Default view is mobile-aware: Day on narrow screens, Month
  // otherwise. The toggle is sticky after the first user interaction
  // — we don't auto-flip on resize to avoid jumping mid-task.
  const [localView, setLocalView] = useState(() => initialView ?? defaultView());
  const [savedView, setSavedView] = usePersistedState("schedule:view", null);
  const view = isPreset ? localView : (savedView ?? defaultView());
  const setView = isPreset ? setLocalView : setSavedView;

  const [date, setDate] = useState(today);

  // Filters: every kind starts on by default. When the parent passes
  // `initialFilter` (e.g. clicking a per-kind preset in the sidebar),
  // start with only that kind enabled — the user can re-enable
  // others via the chip strip. The plain Schedule persists its filter
  // selection for the session.
  const kinds = data.events?.kinds ?? [];
  const [localFilters, setLocalFilters] = useState(() => {
    const all = Object.fromEntries(kinds.map(k => [k.id, true]));
    if (!initialFilter) return all;
    const limited = Object.fromEntries(Object.keys(all).map(k => [k, false]));
    limited[initialFilter] = true;
    return limited;
  });
  const [savedFilters, setSavedFilters] = usePersistedState(
    "schedule:filters", null
  );
  const filters = useMemo(() => {
    if (isPreset) return localFilters;
    const all = Object.fromEntries(kinds.map(k => [k.id, true]));
    return { ...all, ...(savedFilters ?? {}) };
  }, [isPreset, localFilters, savedFilters, kinds]);
  const setFilters = isPreset ? setLocalFilters : setSavedFilters;

  // Chore-block windows for the banded background on Day + Week.
  const { blocks } = useChoreBlocks();
  // Show / hide the chore-block bands across every view (Day / Week
  // bands, Month chips, Agenda rows). Chores aren't an event kind, so
  // they get their own toggle next to the kind chips. Persisted for
  // the session; preset screens share it (it's orthogonal to kinds).
  const [showChores, setShowChores] = usePersistedState(
    "schedule:show-chores", true
  );
  const visibleBlocks = showChores ? blocks : [];
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

  // Which batch (if any) each series is about — event_links +
  // batch_assignments merged (Batch 27.6).
  const seriesBatchMap = useSeriesBatchMap();
  // Batch labels by group id, e.g. "Batch 3".
  const batchLabelById = useMemo(() => {
    const m = new Map();
    for (const sp of data.livestock?.species ?? []) {
      for (const g of sp.groups ?? []) m.set(g.id, g.label);
    }
    return m;
  }, [data.livestock]);

  const occurrences = useMemo(() => {
    let out = getEventOccurrences(data.events, fromDate, toDate, filters);
    // Place timeline (Batch 27.6): keep only the events of batches
    // placed at this place (or anywhere in its subtree).
    if (forPlace) {
      out = out.filter((o) => {
        const batchId = seriesBatchMap.get(o.instanceId);
        return batchId != null && forPlace.batchIds.has(batchId);
      });
    }
    // Batch-referencing titles (Batch 27.6): a processing day with an
    // assigned batch shows the batch in its title — unless the title
    // already names it.
    return out.map((o) => {
      if (o.kindId !== "processing_days") return o;
      const batchLabel = batchLabelById.get(seriesBatchMap.get(o.instanceId));
      if (!batchLabel || o.instanceLabel?.includes(batchLabel)) return o;
      return { ...o, instanceLabel: `${o.instanceLabel} — ${batchLabel}` };
    });
  }, [
    data.events, fromDate, toDate, filters,
    forPlace, seriesBatchMap, batchLabelById,
  ]);

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
      {/* Place-timeline context chip (Batch 27.6). */}
      {forPlace && (
        <div className="flex items-center gap-2 text-[11px] text-dim bg-surface border border-line px-3 py-2 self-start">
          <MapPin size={12} className="shrink-0 text-accent-deep" />
          <span>
            Showing events for the batches placed at{" "}
            <span className="font-semibold text-fg">
              {forPlace.place.name}
            </span>
          </span>
        </div>
      )}
      <Controls
        view={view}
        onViewChange={setView}
        date={date}
        onDateChange={setDate}
        today={today}
        kinds={data.events?.kinds ?? []}
        filters={filters}
        onFiltersChange={setFilters}
        showChores={showChores}
        onToggleChores={setShowChores}
        onNewEvent={onNewEvent}
      />
      {view === "day" && (
        <DayView
          date={date}
          occurrences={occurrences}
          blocks={visibleBlocks}
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
          blocks={visibleBlocks}
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
          blocks={visibleBlocks}
          today={today}
          onClickItem={onClickItem}
          onMoveOccurrence={handleMoveOccurrence}
          onCreateAt={onCreateAt}
        />
      )}
      {view === "agenda" && (
        <AgendaView
          occurrences={occurrences}
          blocks={visibleBlocks}
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
  showChores, onToggleChores,
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
      <FilterChips
        kinds={kinds}
        filters={filters}
        onChange={onFiltersChange}
        showChores={showChores}
        onToggleChores={onToggleChores}
      />
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

// Collapsible filters: a single "Filters" toggle (with an arrow that
// rotates right → down) opens a pane of checklist rows — one per event
// kind plus the Chores toggle — each keeping its kind accent color.
// Replaces the old always-visible chip strip, which had grown too
// crowded.
function FilterChips({
  kinds, filters, onChange, showChores, onToggleChores,
}) {
  const [open, setOpen] = useState(false);
  const chipDefs = (kinds ?? [])
    .map(k => ({
      id: k.id,
      label: k.label,
      color: T.cat[k.id] || T.cat.default,
      count: k.instances?.length ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const toggle = (id) => onChange({ ...filters, [id]: !filters[id] });
  // The chores toggle participates in All / None so one tap really
  // does clear (or restore) the whole calendar.
  const allOn = chipDefs.every(c => filters[c.id]) && showChores;
  const setAll = (val) => {
    onChange(Object.fromEntries(chipDefs.map(c => [c.id, val])));
    onToggleChores?.(val);
  };
  const activeCount =
    chipDefs.filter(c => filters[c.id]).length + (showChores ? 1 : 0);
  const totalCount = chipDefs.length + 1;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="self-start inline-flex items-center gap-1.5 bg-transparent border border-line text-dim hover:text-fg font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 cursor-pointer"
        aria-expanded={open}
      >
        <ChevronRight
          size={12}
          className={
            "shrink-0 transition-transform duration-150 " +
            (open ? "rotate-90" : "")
          }
        />
        Filters
        {activeCount < totalCount && (
          <span className="text-faint normal-case tracking-normal">
            · {activeCount}/{totalCount} on
          </span>
        )}
      </button>

      {open && (
        <div className="bg-surface border border-line p-3 flex flex-col gap-1">
          <button
            onClick={() => setAll(!allOn)}
            className="self-start bg-transparent border-0 text-dim hover:text-fg font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] p-0 pb-1.5 cursor-pointer"
            title={allOn ? "Hide all kinds" : "Show all kinds"}
          >
            {allOn ? "Uncheck all" : "Check all"}
          </button>
          {chipDefs.map(c => (
            <FilterCheckRow
              key={c.id}
              label={c.label}
              color={c.color}
              checked={!!filters[c.id]}
              dim={c.count === 0}
              onToggle={() => toggle(c.id)}
            />
          ))}
          {/* Chores aren't an event kind, but the calendar shows their
              block windows on every view — this row shows / hides them. */}
          <FilterCheckRow
            label="Chores"
            color={T.cat.chore}
            checked={showChores}
            onToggle={() => onToggleChores?.(!showChores)}
          />
        </div>
      )}
    </div>
  );
}

// One checklist row in the filters pane: checkbox + color dot + label.
function FilterCheckRow({ label, color, checked, dim = false, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={
        "flex items-center gap-2.5 bg-transparent border-0 p-1 " +
        "cursor-pointer font-[inherit] text-left " +
        (dim && !checked ? "opacity-55" : "")
      }
      role="checkbox"
      aria-checked={checked}
    >
      <span
        className={
          "shrink-0 w-4 h-4 border-2 inline-flex items-center " +
          "justify-center transition-colors duration-100"
        }
        style={{
          borderColor: color,
          background: checked ? color : "transparent",
        }}
      >
        {checked && (
          <Check size={11} strokeWidth={3} className="text-on-cat" />
        )}
      </span>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span className={
        "text-[12px] font-medium " + (checked ? "text-fg" : "text-dim")
      }>
        {label}
      </span>
    </button>
  );
}
