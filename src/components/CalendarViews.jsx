import { useMemo } from "react";
import {
  DEFAULT_RAIL, railHourLabels, railHeight,
  blockToBand, eventToBlock, layoutOverlappingEvents,
  startOfWeek, isSameDate, isoDateLocal, hhmmToMinutes,
} from "../lib/calendarMath.js";
import { formatLongDate, formatTime12h, parseISODate } from "../lib/dates.js";

// The four calendar views (Batch 14.1).
//
//   <DayView>     single-day time rail, banded chore-block backgrounds
//   <WeekView>    7-column time rail
//   <MonthView>   six-week calendar grid
//   <AgendaView>  chronological list grouped by date (folds AllEvents)
//
// Each view consumes a pre-filtered list of occurrences (the parent's
// recurrence wrapper handles expansion + filters), the active chore
// blocks (banded backgrounds), a `today` anchor, and an `onClickItem`
// callback. The view shells decide their own date range and emit
// occurrences that match it; the parent doesn't need to slice.

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayView({ date, occurrences, blocks, today, onClickItem }) {
  const iso = isoDateLocal(date);
  const day = useMemo(
    () => occurrences.filter(o => o.date === iso),
    [occurrences, iso]
  );
  return (
    <div className="bg-surface border border-line">
      <ColumnHeader date={date} today={today} singleColumn />
      <div className="flex">
        <HourLegend />
        <div className="flex-1 min-w-0">
          <DayColumn
            date={date}
            occurrences={day}
            blocks={blocks}
            onClickItem={onClickItem}
            today={today}
          />
        </div>
      </div>
    </div>
  );
}

export function WeekView({ date, occurrences, blocks, today, onClickItem }) {
  const start = useMemo(() => startOfWeek(date), [date]);
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [start]);
  return (
    <div className="bg-surface border border-line">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {days.map((d, i) => (
          <ColumnHeader key={i} date={d} today={today} />
        ))}
      </div>
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <HourLegend />
        {days.map((d, i) => {
          const iso = isoDateLocal(d);
          const dayOcc = occurrences.filter(o => o.date === iso);
          return (
            <DayColumn
              key={i}
              date={d}
              occurrences={dayOcc}
              blocks={blocks}
              onClickItem={onClickItem}
              today={today}
              border={i < 6}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MonthView({ date, occurrences, today, onClickItem }) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month, occurrences), [year, month, occurrences]);
  return (
    <div className="bg-surface border border-line">
      <div className="grid grid-cols-7 bg-surface-alt border-b border-line">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[10px] uppercase tracking-[0.12em] text-dim text-center py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => (
          <MonthCell
            key={i}
            cell={c}
            isToday={isSameDate(c.date, today)}
            onClickItem={onClickItem}
          />
        ))}
      </div>
    </div>
  );
}

export function AgendaView({ occurrences, today, onClickItem, range }) {
  if (occurrences.length === 0) {
    return (
      <div className="bg-surface border border-line py-12 px-6 text-center">
        <div className="text-[13px] text-muted font-medium mb-1">Nothing scheduled</div>
        <div className="text-[11px] text-faint leading-relaxed">
          Try a wider date range, change filters, or create a new event.
        </div>
      </div>
    );
  }
  // Group consecutive same-date rows. occurrences arrive sorted by date
  // (recurrence wrapper does that); this scan is O(n).
  const groups = [];
  for (const ev of occurrences) {
    const last = groups[groups.length - 1];
    if (last && last.date === ev.date) last.items.push(ev);
    else groups.push({ date: ev.date, items: [ev] });
  }
  return (
    <div className="flex flex-col gap-4">
      {range && (
        <div className="text-[10px] text-faint uppercase tracking-[0.12em]">
          {occurrences.length}{" "}
          {occurrences.length === 1 ? "event" : "events"}{" "}
          {range.fromLabel} → {range.toLabel}
        </div>
      )}
      {groups.map(g => (
        <AgendaGroup
          key={g.date}
          group={g}
          today={today}
          onClickItem={onClickItem}
        />
      ))}
    </div>
  );
}

// ── Shared pieces ───────────────────────────────────────────────────
function ColumnHeader({ date, today, singleColumn = false }) {
  const isToday = isSameDate(date, today);
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-0.5 py-2.5 " +
        (singleColumn ? "border-b border-line" : "border-r border-line last:border-r-0") +
        (isToday ? " bg-surface-alt" : "")
      }
    >
      <span
        className={
          "text-[9px] uppercase tracking-[0.12em] font-semibold " +
          (isToday ? "text-accent" : "text-faint")
        }
      >
        {date.toLocaleDateString("en-US", { weekday: "short" })}
      </span>
      <span
        className={
          "text-[15px] font-semibold " +
          (isToday ? "text-accent" : "text-fg")
        }
      >
        {date.getDate()}
      </span>
    </div>
  );
}

function HourLegend({ rail = DEFAULT_RAIL }) {
  const hours = railHourLabels(rail);
  const totalHeight = railHeight(rail);
  return (
    <div
      className="bg-surface-alt border-r border-line text-[9px] text-faint uppercase tracking-[0.06em] relative"
      style={{ height: totalHeight, width: 64 }}
    >
      {hours.map((h, i) => (
        <div
          key={h}
          className="absolute right-1.5"
          style={{ top: i * 60 * rail.pxPerMinute - 5 }}
        >
          {formatHour(h)}
        </div>
      ))}
    </div>
  );
}

function formatHour(h) {
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${period}`;
}

function DayColumn({
  date, occurrences, blocks, onClickItem, today, border = false,
  rail = DEFAULT_RAIL,
}) {
  const totalHeight = railHeight(rail);
  const isToday = isSameDate(date, today);

  // Chore-block bands for this date.
  const bands = useMemo(() => {
    return (blocks ?? [])
      .map(b => blockToBand(b, date, rail))
      .filter(Boolean);
  }, [blocks, date, rail]);

  // Layout overlapping events into side-by-side columns within the
  // day column.
  const positions = useMemo(
    () => layoutOverlappingEvents(occurrences),
    [occurrences]
  );

  const hours = railHourLabels(rail);
  return (
    <div
      className={
        "relative" +
        (border ? " border-r border-line" : "") +
        (isToday ? " bg-row-active-dim" : "")
      }
      style={{ height: totalHeight }}
    >
      {/* Banded chore-block backgrounds (option C from the mockup) */}
      {bands.map(b => (
        <div
          key={b.blockId}
          aria-hidden
          className="absolute left-0 right-0 bg-warn/[0.10] border-y border-warn/30"
          style={{ top: b.top, height: b.height }}
        >
          <span className="absolute top-0.5 left-1.5 text-[9px] uppercase tracking-[0.12em] text-warn font-semibold">
            {b.name}
          </span>
        </div>
      ))}
      {/* Hour grid lines */}
      {hours.map((h, i) => (
        <div
          key={h}
          aria-hidden
          className="absolute left-0 right-0 border-t border-line/40"
          style={{ top: i * 60 * rail.pxPerMinute }}
        />
      ))}
      {/* Half-hour ticks */}
      {hours.map((h, i) => (
        <div
          key={`half-${h}`}
          aria-hidden
          className="absolute left-0 right-0 border-t border-line/15"
          style={{ top: i * 60 * rail.pxPerMinute + 30 * rail.pxPerMinute }}
        />
      ))}
      {/* Now-line on today */}
      {isToday && <NowLine rail={rail} />}
      {/* Events */}
      {positions.map(p => (
        <EventBlock
          key={(p.occurrence.occurrenceId ?? p.occurrence.instanceId) + p.occurrence.date}
          occurrence={p.occurrence}
          columnIndex={p.columnIndex}
          columnCount={p.columnCount}
          rail={rail}
          onClick={() => onClickItem?.(p.occurrence)}
        />
      ))}
    </div>
  );
}

function NowLine({ rail = DEFAULT_RAIL }) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const railStart = rail.startHour * 60;
  const railEnd = rail.endHour * 60;
  if (minutes < railStart || minutes > railEnd) return null;
  const top = (minutes - railStart) * rail.pxPerMinute;
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 border-t border-accent z-[1] pointer-events-none"
      style={{ top }}
    >
      <div
        className="absolute -left-1 -top-[3px] w-1.5 h-1.5 bg-accent rounded-full"
      />
    </div>
  );
}

function EventBlock({ occurrence, columnIndex, columnCount, rail, onClick }) {
  const block = eventToBlock(occurrence, rail);
  const widthPct = 100 / Math.max(1, columnCount);
  const leftPct = columnIndex * widthPct;
  const isSkipped = occurrence.status === "skipped";
  if (isSkipped) return null;

  return (
    <button
      onClick={onClick}
      className={
        "absolute mx-0.5 px-2 py-1 text-left text-[11px] font-semibold leading-tight " +
        "border border-on-cat/0 cursor-pointer overflow-hidden text-on-cat " +
        "hover:opacity-90 transition-opacity z-[2]"
      }
      style={{
        top: block.top,
        height: block.height,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: `var(--c-cat-${kindToCss(occurrence.kindId)})`,
      }}
      title={occurrence.instanceLabel}
    >
      <div className="flex flex-col gap-0.5 h-full">
        <span className="truncate font-bold">
          {formatTime12h(occurrence.startTime).replace(" ", "")} {occurrence.instanceLabel}
        </span>
        {occurrence.location?.name && block.height > 30 && (
          <span className="truncate text-[10px] opacity-80 font-medium">
            {occurrence.location.name}
          </span>
        )}
      </div>
    </button>
  );
}

function kindToCss(kindId) {
  // Map an event-kind id to the CSS variable suffix that styles.css
  // already exposes (--c-cat-<suffix>). Falls back to "default".
  if (!kindId) return "default";
  const map = {
    farmers_market: "fm",
    popup_event: "popup",
    egg_drop: "egg",
    chore: "chore",
    deliveries: "deliveries",
    farm_visits: "farm-visits",
    pickups: "pickups",
    processing_days: "processing",
  };
  return map[kindId] ?? "default";
}

// ── Month grid ──────────────────────────────────────────────────────
function buildMonthCells(year, month, occurrences) {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - start.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = isoDateLocal(d);
    const items = occurrences.filter(o => o.date === iso);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      iso,
      items,
    });
  }
  return cells;
}

function MonthCell({ cell, isToday, onClickItem }) {
  const visible = cell.items.slice(0, 3);
  const overflow = cell.items.length - visible.length;
  return (
    <div
      className={
        "min-h-[100px] p-1.5 border-r border-b border-line overflow-hidden " +
        (cell.inMonth ? "" : "opacity-50 ") +
        (isToday ? "bg-surface-alt " : "bg-surface ")
      }
    >
      <div
        className={
          "text-[11px] mb-1 leading-none " +
          (isToday ? "font-semibold text-accent" : "text-fg")
        }
      >
        {cell.date.getDate()}
      </div>
      <div className="flex flex-col gap-0.5">
        {visible.map((it, idx) => (
          <button
            key={idx}
            onClick={() => onClickItem?.(it)}
            className="w-full text-left text-[9px] font-bold uppercase tracking-[0.04em] text-on-cat px-1 py-0.5 cursor-pointer truncate"
            style={{
              background: `var(--c-cat-${kindToCss(it.kindId)})`,
            }}
            title={it.instanceLabel}
          >
            {formatTime12h(it.startTime).replace(" ", "")} {it.instanceLabel}
          </button>
        ))}
        {overflow > 0 && (
          <div className="text-[9px] text-dim mt-0.5">
            +{overflow} more
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agenda list ─────────────────────────────────────────────────────
function AgendaGroup({ group, today, onClickItem }) {
  const dDate = parseISODate(group.date);
  const isToday = dDate && (
    dDate.getUTCFullYear() === today.getFullYear()
    && dDate.getUTCMonth() === today.getMonth()
    && dDate.getUTCDate() === today.getDate()
  );
  return (
    <div>
      <div
        className={
          "text-[10px] uppercase tracking-[0.16em] font-semibold mb-2 " +
          (isToday ? "text-accent" : "text-faint")
        }
      >
        {formatLongDate(group.date)}{isToday ? " · today" : ""}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-px bg-line">
        {group.items.map(ev => (
          <li
            key={(ev.occurrenceId ?? ev.instanceId) + ev.date}
            className="bg-surface"
          >
            <button
              onClick={() => onClickItem?.(ev)}
              className="w-full text-left bg-transparent border-0 cursor-pointer flex items-center gap-3 px-3 py-2.5"
            >
              <span
                aria-hidden
                className="w-1 h-7 shrink-0"
                style={{ background: `var(--c-cat-${kindToCss(ev.kindId)})` }}
              />
              <span className="text-[11px] text-dim tabular-nums w-[100px] shrink-0">
                {ev.startTime ? formatTime12h(ev.startTime) : ""}
                {ev.endTime ? ` – ${formatTime12h(ev.endTime)}` : ""}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-[13px] text-fg font-medium block truncate">
                  {ev.instanceLabel}
                </span>
                {ev.subtitle && (
                  <span className="text-[11px] text-faint block truncate">
                    {ev.subtitle}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-dim text-right">
                <span className="block uppercase tracking-[0.08em]">
                  {ev.kindLabel}
                </span>
                {ev.location?.name && (
                  <span className="block text-faint mt-0.5 truncate max-w-[160px]">
                    {ev.location.name}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
