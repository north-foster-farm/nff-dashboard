import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_RAIL, railHourLabels, railHeight,
  blockToBand, eventToBlock, layoutOverlappingEvents,
  startOfWeek, isSameDate, isoDateLocal, hhmmToMinutes,
} from "../lib/calendarMath.js";
import { formatLongDate, formatTime12h, parseISODate } from "../lib/dates.js";

// The four calendar views (Batch 14.1 + 14.2).
//
// Layout, drag-to-reschedule on Day / Week / Month, drag-to-resize
// on Day, click-empty-space → new event, and event-on-band conflict
// lint all live here. Mutations bubble up via:
//
//   onMoveOccurrence({ occurrence, newDate, newStartTime, newEndTime })
//   onResizeOccurrence({ occurrence, newStartTime, newEndTime })
//   onCreateAt({ date, startTime })
//
// The parent (Schedule) wires these to useEventMutator + the
// EventEditor seed flow. Drag math is pure pixel → minute conversion
// using calendarMath helpers; commit values snap to 15 minutes.

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SNAP_MIN = 15;
const DRAG_THRESHOLD_PX = 4;

// ── Day / Week / Month / Agenda views ───────────────────────────────
export function DayView({
  date, occurrences, blocks, today,
  onClickItem, onMoveOccurrence, onResizeOccurrence, onCreateAt,
}) {
  const iso = isoDateLocal(date);
  const day = useMemo(
    () => occurrences.filter(o => o.date === iso),
    [occurrences, iso]
  );
  const columnRef = useRef(null);
  return (
    <div className="bg-surface border border-line">
      <ColumnHeader date={date} today={today} singleColumn />
      <div className="flex">
        <HourLegend />
        <div className="flex-1 min-w-0">
          <DayColumn
            ref={columnRef}
            date={date}
            occurrences={day}
            blocks={blocks}
            onClickItem={onClickItem}
            onMoveOccurrence={onMoveOccurrence}
            onResizeOccurrence={onResizeOccurrence}
            onCreateAt={onCreateAt}
            today={today}
            columnRectsRef={null}
          />
        </div>
      </div>
    </div>
  );
}

export function WeekView({
  date, occurrences, blocks, today,
  onClickItem, onMoveOccurrence, onResizeOccurrence, onCreateAt,
}) {
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
  // Per-column refs so cross-column drags can hit-test against each
  // column's bounding rect (filled at render time, read inside the
  // drag commit handler).
  const columnRefs = useRef([]);
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
              ref={(el) => { columnRefs.current[i] = el; }}
              date={d}
              dates={days}
              columnIndex={i}
              columnRefs={columnRefs}
              occurrences={dayOcc}
              blocks={blocks}
              onClickItem={onClickItem}
              onMoveOccurrence={onMoveOccurrence}
              onResizeOccurrence={onResizeOccurrence}
              onCreateAt={onCreateAt}
              today={today}
              border={i < 6}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MonthView({
  date, occurrences, today,
  onClickItem, onMoveOccurrence, onCreateAt,
}) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const cells = useMemo(() => buildMonthCells(year, month, occurrences), [year, month, occurrences]);
  // 42 cell refs (6 rows x 7 cols) so a drag can hit-test against
  // each cell's bounding rect when the user drops onto a new date.
  const cellRefs = useRef([]);
  const drag = useGridDrag({
    cellRefs,
    cells,
    onCommitMove: (info) => {
      onMoveOccurrence?.({
        occurrence: info.occurrence,
        newDate: info.newDateIso,
        newStartTime: info.occurrence.startTime,
        newEndTime: info.occurrence.endTime,
      });
    },
  });
  return (
    <div className="bg-surface border border-line">
      <div className="grid grid-cols-7 bg-surface-alt border-b border-line">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[10px] uppercase tracking-[0.12em] text-dim text-center py-2.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 relative">
        {cells.map((c, i) => (
          <MonthCell
            key={i}
            ref={(el) => { cellRefs.current[i] = el; }}
            cell={c}
            isToday={isSameDate(c.date, today)}
            onClickItem={onClickItem}
            onCreateAt={onCreateAt}
            beginMove={drag.beginMove}
            isDragOriginal={drag.drag?.occurrence
              && drag.drag.occurrence === c.items.find(it => it === drag.drag.occurrence)}
            isDragTarget={drag.drag?.targetCellIndex === i}
          />
        ))}
        {drag.drag && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-[60] text-on-cat text-[10px] font-bold uppercase tracking-[0.04em] px-2 py-0.5 bg-fg/60 border border-fg shadow-lg"
            style={{
              left: drag.drag.clientX + 12,
              top: drag.drag.clientY + 12,
            }}
          >
            {drag.drag.occurrence.instanceLabel}
          </div>
        )}
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

// ── Drag hooks ──────────────────────────────────────────────────────
// Day + Week share `useRailDrag`. The hook tracks pointer deltas via
// document-level listeners (pointer events ride out to the document
// because the cursor easily leaves the small event-block hit area
// during a fast drag). Visual feedback uses a CSS transform on the
// original block — translateY for retime, translateX for cross-day.
function useRailDrag({ rail, onCommitMove, onCommitResize }) {
  const [drag, setDrag] = useState(null);
  const stateRef = useRef(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const cur = stateRef.current;
      if (!cur) return;
      const dy = e.clientY - cur.startY;
      const dx = e.clientX - cur.startX;
      setDrag((s) => s ? { ...s, dy, dx, clientX: e.clientX, clientY: e.clientY } : s);
    };
    const onUp = (e) => {
      const cur = stateRef.current;
      stateRef.current = null;
      setDrag(null);
      if (!cur) return;
      const dy = e.clientY - cur.startY;
      const dx = e.clientX - cur.startX;
      const moved = Math.abs(dy) > DRAG_THRESHOLD_PX || Math.abs(dx) > DRAG_THRESHOLD_PX;
      if (!moved) { cur.onClickFallback?.(); return; }
      const deltaMin = roundSnap(dy / rail.pxPerMinute, SNAP_MIN);
      if (cur.kind === "move") {
        let newColumnIndex = cur.columnIndex;
        if (cur.columnRefs) {
          for (let i = 0; i < cur.columnRefs.current.length; i += 1) {
            const el = cur.columnRefs.current[i];
            if (!el) continue;
            const r = el.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX < r.right) {
              newColumnIndex = i; break;
            }
          }
        }
        onCommitMove?.({
          occurrence: cur.occurrence,
          deltaMin,
          newColumnIndex,
          originalColumnIndex: cur.columnIndex,
          dates: cur.dates,
        });
      } else if (cur.kind === "resize") {
        onCommitResize?.({
          occurrence: cur.occurrence,
          deltaMin,
        });
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
    };
  }, [drag !== null, rail, onCommitMove, onCommitResize]);

  const beginMove = (e, info) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = {
      kind: "move",
      ...info,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0, dy: 0,
      clientX: e.clientX, clientY: e.clientY,
    };
    stateRef.current = start;
    setDrag(start);
  };
  const beginResize = (e, info) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = {
      kind: "resize",
      ...info,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0, dy: 0,
      clientX: e.clientX, clientY: e.clientY,
    };
    stateRef.current = start;
    setDrag(start);
  };
  return { drag, beginMove, beginResize };
}

// MonthView grid drag — drop on a different cell to retime.
// Cell-rect hit-testing uses the same bounding-rect approach.
function useGridDrag({ cellRefs, cells, onCommitMove }) {
  const [drag, setDrag] = useState(null);
  const stateRef = useRef(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const cur = stateRef.current;
      if (!cur) return;
      let targetCellIndex = null;
      for (let i = 0; i < cellRefs.current.length; i += 1) {
        const el = cellRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX < r.right
          && e.clientY >= r.top && e.clientY < r.bottom) {
          targetCellIndex = i;
          break;
        }
      }
      setDrag((s) => s ? {
        ...s, clientX: e.clientX, clientY: e.clientY, targetCellIndex,
      } : s);
    };
    const onUp = (e) => {
      const cur = stateRef.current;
      stateRef.current = null;
      setDrag(null);
      if (!cur) return;
      const dx = e.clientX - cur.startX;
      const dy = e.clientY - cur.startY;
      const moved = Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;
      if (!moved) { cur.onClickFallback?.(); return; }
      let targetCellIndex = null;
      for (let i = 0; i < cellRefs.current.length; i += 1) {
        const el = cellRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX < r.right
          && e.clientY >= r.top && e.clientY < r.bottom) {
          targetCellIndex = i;
          break;
        }
      }
      if (targetCellIndex == null) return;
      const targetCell = cells[targetCellIndex];
      if (!targetCell || targetCell.iso === cur.occurrence.date) return;
      onCommitMove?.({
        occurrence: cur.occurrence,
        newDateIso: targetCell.iso,
        targetCellIndex,
      });
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
    };
  }, [drag !== null, cellRefs, cells, onCommitMove]);

  const beginMove = (e, info) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = {
      ...info,
      startX: e.clientX,
      startY: e.clientY,
      clientX: e.clientX, clientY: e.clientY,
      targetCellIndex: null,
    };
    stateRef.current = start;
    setDrag(start);
  };
  return { drag, beginMove };
}

function roundSnap(value, snap) {
  return Math.round(value / snap) * snap;
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

const DayColumn = forwardRef(function DayColumn({
  date, dates, columnIndex = 0, columnRefs,
  occurrences, blocks, onClickItem, today, border = false,
  rail = DEFAULT_RAIL,
  onMoveOccurrence, onResizeOccurrence, onCreateAt,
}, ref) {
  const totalHeight = railHeight(rail);
  const isToday = isSameDate(date, today);
  const hostRef = useRef(null);

  const bands = useMemo(() => {
    return (blocks ?? [])
      .map(b => blockToBand(b, date, rail))
      .filter(Boolean);
  }, [blocks, date, rail]);

  const positions = useMemo(
    () => layoutOverlappingEvents(occurrences),
    [occurrences]
  );

  // Drag controller scoped to this column. Day view: columnRefs is
  // null so the commit handler keeps the same date. Week view: each
  // column gets the shared columnRefs ref so a cross-column drag
  // resolves to the correct date in `dates[i]`.
  const drag = useRailDrag({
    rail,
    onCommitMove: ({ occurrence, deltaMin, newColumnIndex, originalColumnIndex }) => {
      const startMin = hhmmToMinutes(occurrence.startTime);
      const endMin = hhmmToMinutes(occurrence.endTime);
      if (startMin == null) return;
      const newStartMin = clampMinute(startMin + deltaMin);
      const newEndMin = endMin != null
        ? clampMinute(endMin + deltaMin)
        : null;
      const newStart = minutesToHHMM(newStartMin);
      const newEnd = newEndMin != null ? minutesToHHMM(newEndMin) : occurrence.endTime;
      let newDateIso = occurrence.date;
      if (dates && newColumnIndex !== originalColumnIndex
        && dates[newColumnIndex]) {
        newDateIso = isoDateLocal(dates[newColumnIndex]);
      }
      onMoveOccurrence?.({
        occurrence,
        newDate: newDateIso,
        newStartTime: newStart,
        newEndTime: newEnd,
      });
    },
    onCommitResize: ({ occurrence, deltaMin }) => {
      const startMin = hhmmToMinutes(occurrence.startTime);
      const endMin = hhmmToMinutes(occurrence.endTime);
      if (startMin == null || endMin == null) return;
      const newEndMin = Math.max(startMin + SNAP_MIN, endMin + deltaMin);
      onResizeOccurrence?.({
        occurrence,
        newStartTime: occurrence.startTime,
        newEndTime: minutesToHHMM(newEndMin),
      });
    },
  });

  // Empty-space click → create at that time.
  const onColumnClick = (e) => {
    if (e.target !== hostRef.current) return; // ignore bubbled clicks from events
    if (!onCreateAt) return;
    const r = hostRef.current.getBoundingClientRect();
    const y = e.clientY - r.top;
    const minutes = roundSnap(y / rail.pxPerMinute + rail.startHour * 60, SNAP_MIN);
    onCreateAt({
      date: isoDateLocal(date),
      startTime: minutesToHHMM(minutes),
    });
  };

  const hours = railHourLabels(rail);
  return (
    <div
      ref={(el) => { hostRef.current = el; if (typeof ref === "function") ref(el); else if (ref) ref.current = el; }}
      onClick={onColumnClick}
      className={
        "relative" +
        (border ? " border-r border-line" : "") +
        (isToday ? " bg-row-active-dim" : "") +
        " cursor-cell"
      }
      style={{ height: totalHeight }}
    >
      {bands.map(b => (
        <div
          key={b.blockId}
          aria-hidden
          className="absolute left-0 right-0 bg-warn/[0.10] border-y border-warn/30 pointer-events-none"
          style={{ top: b.top, height: b.height }}
        >
          <span className="absolute top-0.5 left-1.5 text-[9px] uppercase tracking-[0.12em] text-warn font-semibold">
            {b.name}
          </span>
        </div>
      ))}
      {hours.map((h, i) => (
        <div
          key={h}
          aria-hidden
          className="absolute left-0 right-0 border-t border-line/40 pointer-events-none"
          style={{ top: i * 60 * rail.pxPerMinute }}
        />
      ))}
      {hours.map((h, i) => (
        <div
          key={`half-${h}`}
          aria-hidden
          className="absolute left-0 right-0 border-t border-line/15 pointer-events-none"
          style={{ top: i * 60 * rail.pxPerMinute + 30 * rail.pxPerMinute }}
        />
      ))}
      {isToday && <NowLine rail={rail} />}
      {positions.map(p => (
        <EventBlock
          key={(p.occurrence.occurrenceId ?? p.occurrence.instanceId) + p.occurrence.date}
          occurrence={p.occurrence}
          columnIndex={p.columnIndex}
          columnCount={p.columnCount}
          rail={rail}
          bands={bands}
          drag={drag}
          gridDrag={null}
          dayContext={{
            columnIndex,
            columnRefs,
            dates,
            beginMove: drag.beginMove,
            beginResize: drag.beginResize,
          }}
          onClick={() => onClickItem?.(p.occurrence)}
        />
      ))}
    </div>
  );
});

function NowLine({ rail = DEFAULT_RAIL }) {
  // Tick once a minute so the line creeps down without a full
  // schedule re-render every second.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
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

function EventBlock({ occurrence, columnIndex, columnCount, rail, bands, drag, dayContext, onClick }) {
  const block = eventToBlock(occurrence, rail);
  const widthPct = 100 / Math.max(1, columnCount);
  const leftPct = columnIndex * widthPct;
  if (occurrence.status === "skipped") return null;

  const isDragging = drag.drag?.kind && drag.drag.occurrence === occurrence;
  const dy = isDragging ? drag.drag.dy : 0;
  const dx = isDragging && drag.drag.kind === "move" ? drag.drag.dx : 0;
  const heightOverride = isDragging && drag.drag.kind === "resize"
    ? Math.max(18, block.height + drag.drag.dy)
    : null;

  const conflict = useMemo(
    () => bandsOverlapEvent(bands, block),
    [bands, block.top, block.height]
  );

  const onPointerDown = (e) => {
    // Bottom 6px is the resize grip; everywhere else moves.
    const target = e.currentTarget.getBoundingClientRect();
    const offset = e.clientY - target.bottom;
    if (offset > -8) {
      dayContext.beginResize(e, {
        occurrence,
        onClickFallback: onClick,
      });
    } else {
      dayContext.beginMove(e, {
        occurrence,
        columnIndex: dayContext.columnIndex,
        columnRefs: dayContext.columnRefs,
        dates: dayContext.dates,
        onClickFallback: onClick,
      });
    }
  };

  return (
    <button
      onPointerDown={onPointerDown}
      className={
        "absolute mx-0.5 px-2 py-1 text-left text-[11px] font-semibold leading-tight " +
        "border border-on-cat/0 cursor-grab overflow-hidden text-on-cat " +
        "hover:opacity-90 transition-opacity z-[2] select-none " +
        (isDragging ? "opacity-70 ring-2 ring-fg/40 cursor-grabbing" : "")
      }
      style={{
        top: block.top,
        height: heightOverride ?? block.height,
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: `var(--c-cat-${kindToCss(occurrence.kindId)})`,
        transform: dx || dy
          ? `translate(${dx}px, ${dy}px)`
          : undefined,
      }}
      title={occurrence.instanceLabel}
    >
      {conflict && (
        <span
          aria-hidden
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warn shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          title="Overlaps a chore-block"
        />
      )}
      <div className="flex flex-col gap-0.5 h-full">
        <span className="truncate font-bold">
          {formatTime12h(occurrence.startTime).replace(" ", "")} {occurrence.instanceLabel}
        </span>
        {occurrence.location?.name && (heightOverride ?? block.height) > 30 && (
          <span className="truncate text-[10px] opacity-80 font-medium">
            {occurrence.location.name}
          </span>
        )}
      </div>
      {/* bottom resize affordance — invisible but functional */}
      <span
        aria-hidden
        className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
      />
    </button>
  );
}

function bandsOverlapEvent(bands, block) {
  if (!bands || !block || block.missingTime) return false;
  const eStart = block.top;
  const eEnd = block.top + block.height;
  for (const b of bands) {
    const bStart = b.top;
    const bEnd = b.top + b.height;
    if (eStart < bEnd && eEnd > bStart) return true;
  }
  return false;
}

function clampMinute(m) {
  if (!Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(1439, m));
}

function minutesToHHMM(m) {
  const safe = clampMinute(m);
  const hh = Math.floor(safe / 60);
  const mm = safe % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function kindToCss(kindId) {
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

const MonthCell = forwardRef(function MonthCell({
  cell, isToday, onClickItem, onCreateAt, beginMove, isDragTarget,
}, ref) {
  const visible = cell.items.slice(0, 3);
  const overflow = cell.items.length - visible.length;
  const cellRef = useRef(null);

  const onCellClick = (e) => {
    if (e.target !== cellRef.current) return;
    onCreateAt?.({ date: cell.iso, startTime: "09:00" });
  };

  return (
    <div
      ref={(el) => {
        cellRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      onClick={onCellClick}
      className={
        "min-h-[100px] p-1.5 border-r border-b border-line overflow-hidden cursor-cell " +
        (cell.inMonth ? "" : "opacity-50 ") +
        (isToday ? "bg-surface-alt " : "bg-surface ") +
        (isDragTarget ? "outline outline-2 outline-accent z-[3] " : "")
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
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              beginMove?.(e, {
                occurrence: it,
                onClickFallback: () => onClickItem?.(it),
              });
            }}
            className="w-full text-left text-[9px] font-bold uppercase tracking-[0.04em] text-on-cat px-1 py-0.5 cursor-grab truncate select-none"
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
});

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

