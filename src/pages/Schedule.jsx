import { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, ArrowDownToLine, ListChecks, Check, Plus, X,
  CloudOff, GripVertical, MoreHorizontal, AlertTriangle, Ban, CalendarClock,
  MapPin, Repeat, StickyNote, Timer, CalendarX,
  ClockArrowRight, ClockArrowLeft, CornerDownRight,
} from "lucide-react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useChoreBlocks } from "../lib/data/useChoreBlocks.js";
import { useSites } from "../lib/data/useSites.js";
import { useChoreAssignmentRules } from "../lib/data/useChoreAssignmentRules.js";
import { useChoreCompletions } from "../lib/data/useChoreCompletions.js";
import { useScheduleDeltas } from "../lib/data/useScheduleDeltas.js";
import { deriveDay, rollupChoresForDay } from "../lib/schedule/deriveDay.js";
import { applyOverrides } from "../lib/schedule/overrides.js";
import {
  reservationWindows, reservationWindow, ADMINS,
} from "../lib/schedule/manDown.js";
import {
  buffersForTarget, storedBufferWindow, describeBuffer, deriveTemplateBuffer,
} from "../lib/schedule/buffers.js";
import { useBufferTemplates } from "../lib/data/useBufferTemplates.js";
import {
  doubleBookConflicts, scanHorizonConflicts, bufferSqueezes,
} from "../lib/schedule/conflicts.js";
import ConflictsPanel from "../components/ConflictsPanel.jsx";
import {
  obligationPlaceIds, getAllChoreDefinitions, resolveAssignee,
  choreDaysRemaining, describeChoreAnchor,
} from "../lib/chores.js";
import AddToScheduleSearch from "../components/AddToScheduleSearch.jsx";
import ChoreCheckRow from "../components/ChoreCheckRow.jsx";
import ScheduleEditSheet from "../components/ScheduleEditSheet.jsx";
import ReservationSheet from "../components/ReservationSheet.jsx";
import BufferSheet from "../components/BufferSheet.jsx";
import EventTimeSheet from "../components/EventTimeSheet.jsx";
import EventScopePrompt from "../components/EventScopePrompt.jsx";
import { useEventSeries } from "../lib/data/useEventSeries.js";
import EditedHistory, { EditedTag, fmtClock12 }
  from "../components/EditedHistory.jsx";
import { DayRailSpine, DayStrip } from "../components/ScheduleSidebars.jsx";
import { WeekView, MonthView } from "../components/ScheduleZoom.jsx";
import { ScheduleReview } from "../components/ScheduleReview.jsx";
import { weekDays } from "../lib/schedule/weekView.js";
import { monthFullness } from "../lib/schedule/monthView.js";
import { blockStartDrift, dayReviews } from "../lib/schedule/lookBack.js";
import { useRunHistory } from "../lib/data/useRunHistory.js";
import { isActiveProject } from "../lib/projects.js";
import { nextRankedStep } from "../lib/schedule/reflow.js";
import { segmentForStart, buildDaySegments } from "../lib/schedule/placement.js";
import {
  overnightWindow, inOvernight, OVERNIGHT_LEAD, OVERNIGHT_TRAIL,
} from "../lib/schedule/partition.js";
import { useNeighborDeltas } from "../lib/data/useNeighborDeltas.js";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import { navigate } from "../lib/router.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { recordCapture, readCaptures } from "../lib/capture/capture.js";
import { supabase, realtimeChannel } from "../lib/supabase.js";
import { formatMinutesOfDay, resolveBlockMinutes } from "../lib/sunTimes.js";
import {
  NowTag, KindBadge, LoadSpine, WeekStrip, WarmingBadge,
  AlertStrip, Tooltip, CoveredBadge, INPUT_CLS,
} from "../components/ui.jsx";
import {
  farmLoad, dayConflictCount, dayCoveredUnits, dayWarming,
} from "../lib/load/farmLoad.js";
import { T } from "../theme.js";

// The Schedule — the phone-first, single-open accordion of the day's chore
// BLOCKS: exactly one block expanded (the one "now" is in), every other
// block a quiet one-line summary. Married to Rounds + the one completion
// truth (a chore row IS the shared ChoreCheckRow). The day's data comes
// from the S3 `deriveDay` engine; the one-tap Confirm (S5) writes a
// versioned schedule.confirmed_day capture. S6: ad-hoc one-off tasks added
// to a block are commitment deltas the engine folds in (useScheduleDeltas).

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// Local YYYY-MM-DD (not UTC) — the capture's / delta's business day.
function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Sort key: real blocks by resolved start time, the block-less "anytime"
// bucket last. The LEADING overnight (this morning's pre-dawn continuation of
// last night) pins FIRST — its window's start-minute is last night's evening,
// but on this day's page it precedes the morning chore blocks (the scope's
// required ordering fix). The TRAILING overnight sorts by its evening start, so
// it lands after the last chore block.
function startKey(r) {
  if (r.kind === "overnightblock") {
    return r.side === "lead" ? Number.MIN_SAFE_INTEGER : r.startMin;
  }
  // An event pins directly BEFORE the first block it overlaps (round 5 —
  // the mockup's ordering): its sortMin is that block's start minus a
  // hair, while startMin stays the real start for display.
  if (r.sortMin != null) return r.sortMin;
  return r.startMin == null ? Number.MAX_SAFE_INTEGER : r.startMin;
}

// An ISO timestamp -> a compact clock stamp like "6:08a" (the mockup's
// confirmed-at format). null on a bad value.
function fmtStamp(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "a" : "p";
  h %= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")}${ap}`;
}

// Render text + emphasis for a Project gap's structured availability
// ({freeCount, who}). Both-free is the LOUD signal (the scarce two-hand-job
// window); one-free is a quiet annotation. The engine never emits a
// nobody-free segment, so freeCount is always >= 1 here.
function whoFreeLabel(who) {
  const n = who?.freeCount ?? 0;
  if (n >= 2) return { text: "both free", loud: true };
  if (n === 1) return { text: (who?.who?.[0] ?? "one") + " free", loud: false };
  return { text: "", loud: false };
}

// "HH:MM" (24h) -> minutes of day, or null.
function hmToMin(hm) {
  if (!hm || typeof hm !== "string") return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

// minutes of day -> "HH:MM" (24h), or null — the inverse, for the clock_time
// a timed delta carries so it routes back to the right segment.
function minToHM(min) {
  if (min == null || !Number.isFinite(min)) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

// An EVENT entry in the day timeline (S9) — the derived day folds in event
// occurrences alongside chore blocks; the Schedule renders them as their own
// time-ordered, openable lines (NOT chore checklists). Marries the old
// events surface (now Calendar) into the one agreed day. Tap to peek the
// time/place; the body is informational, not a tick list.
// The reserved time + setup/cleanup checklist a buffer carries (S53/S57).
// Rendered inside an activity's detail panel (an event, or a focused chore
// block) — only when the activity HAS buffers. The "Add buffer" entry
// point moved to the toolbar "+ Add" menu (round 4); the card carries no
// add chrome of its own.
function BufferSection({
  buffers, onToggleItem, onRemove, squeezedIds,
}) {
  return (
    <div className="space-y-2">
      {buffers.map((buf) => {
        const win = storedBufferWindow(buf);
        const list = buf.source_ref?.checklist ?? [];
        return (
          <div key={buf.id} className="border border-line bg-surface-alt">
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-dim">
              <Timer size={14} className="shrink-0 text-faint" />
              <span className="flex-1 min-w-0">
                Buffer reserved{" "}
                {win
                  ? `${formatMinutesOfDay(win.startMin)}–${formatMinutesOfDay(win.endMin)}`
                  : ""}
                {buf.source_ref?.label ? ` — ${buf.source_ref.label}` : ""}
                {buf.assignee ? ` · ${buf.assignee}` : ""}
              </span>
              {buf._template && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-faint border border-line px-1">
                  <Repeat size={10} /> every time
                </span>
              )}
              <button type="button" onClick={() => onRemove(buf)}
                className="shrink-0 text-faint hover:text-warn cursor-pointer"
                aria-label={buf._template ? "Remove for every time" : "Remove buffer"}>
                <X size={13} />
              </button>
            </div>
            {list.length > 0 && (
              <ul className="px-3 pb-2.5 space-y-1.5">
                {list.map((it) => (
                  <li key={it.id}>
                    <button type="button"
                      onClick={() => onToggleItem(buf, it.id, !it.done)}
                      className="flex items-center gap-2 text-[13px] text-left cursor-pointer w-full">
                      {it.done
                        ? <Check size={14} className="shrink-0 text-resolved" strokeWidth={3} />
                        : <span className="w-3.5 h-3.5 border border-line inline-block shrink-0" />}
                      <span className={it.done ? "text-faint line-through" : "text-dim"}>
                        {it.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {squeezedIds?.has(buf.id) && (
              <div className="flex items-center gap-1.5 px-3 pb-2 text-[12px] text-warn">
                <AlertTriangle size={12} className="shrink-0" />
                Other work lands in this reserved window.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventEntry({
  occ, isOpen, onToggle,
  buffers, onToggleBufferItem, onRemoveBuffer, onEditTime,
  squeezedIds,
}) {
  const color = T.cat[occ.kindId] || T.cat.default;
  const startMin = hmToMin(occ.startTime);
  const endMin = hmToMin(occ.endTime);
  const timeLabel = startMin == null
    ? "All day"
    : formatMinutesOfDay(startMin)
      + (endMin != null ? "–" + formatMinutesOfDay(endMin) : "");
  return (
    /* Rethinker EventBand: a left color-bar (the event-kind hue) defines
       the card's left edge, spanning header + detail. */
    <li style={{ borderLeft: "3px solid " + color }}>
      <button
        type="button"
        onClick={onToggle}
        className={
          "w-full flex items-center gap-3 px-4 py-3 text-left " +
          (isOpen ? "bg-row-active" : "hover:bg-row-hover")
        }
        aria-expanded={isOpen}
      >
        <span className={
          "flex-1 min-w-0 truncate text-[14px] " +
          (isOpen ? "font-heading font-semibold text-fg -tracking-[0.01em]" : "text-fg")
        }>
          {occ.instanceLabel}
        </span>
        <span className="shrink-0 text-[12px] text-dim [font-variant-numeric:tabular-nums]">
          {startMin == null ? "all day" : formatMinutesOfDay(startMin)}
        </span>
        <ChevronRight
          size={16}
          className={
            "shrink-0 text-faint transition-transform " +
            (isOpen ? "rotate-90" : "")
          }
        />
      </button>
      {isOpen && (
        <div className="bg-surface px-4 py-3 border-t border-line space-y-2">
          <div className="flex items-center gap-2 text-[13px] text-dim">
            <CalendarClock size={14} className="shrink-0 text-faint" />
            <span>{timeLabel}</span>
            <span
              className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 border"
              style={{ color, borderColor: color }}
            >
              {occ.kindLabel}
            </span>
            {occ.recurring && (
              <Repeat size={12} className="shrink-0 text-faint"
                aria-label="Recurring" />
            )}
          </div>
          {occ.location && (
            <div className="flex items-center gap-2 text-[13px] text-dim">
              <MapPin size={14} className="shrink-0 text-faint" />
              <span>{occ.location}</span>
            </div>
          )}
          {occ.subtitle && (
            <div className="text-[13px] text-dim">{occ.subtitle}</div>
          )}
          {(buffers?.length ?? 0) > 0 && (
            <BufferSection
              buffers={buffers}
              onToggleItem={onToggleBufferItem}
              onRemove={onRemoveBuffer}
              squeezedIds={squeezedIds}
            />
          )}
          <div className="flex items-center gap-4">
            {onEditTime && (
              <button
                type="button"
                onClick={() => onEditTime(occ)}
                className="text-[12px] font-medium text-accent inline-flex items-center gap-1 cursor-pointer"
              >
                <CalendarClock size={13} /> Edit time
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/calendar")}
              className="text-[12px] font-medium text-dim inline-flex items-center gap-1"
            >
              Open in Calendar <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// must vs should (S13–S15, reused for S12). A "should" is a deferrable window
// chore that still has days of runway on `date`; everything else — fixed
// daily/specific/weekly work, or a window chore whose deadline has arrived —
// is a "must". No schema flag: derived from frequency + choreDaysRemaining,
// the same rule ChoreCheckRow renders.
function isMustChore(chore, date, blocks) {
  const f = chore.frequency?.type;
  const windowish = f === "weekly_window" || f === "monthly_last_week_window"
    || chore.deadline?.kind === "block_on_weekday";
  if (!windowish) return true;
  const rem = choreDaysRemaining(chore, date, blocks);
  return rem?.kind !== "days";
}

// The block "now" is in: the latest real block whose start has passed;
// failing that, the first block of the day.
function pickNowBucket(orderedBlocks, nowMin) {
  let now = null;
  for (const b of orderedBlocks) {
    if (b.startMin != null && b.startMin <= nowMin) now = b.bucket;
  }
  return now ?? orderedBlocks[0]?.bucket ?? null;
}

// An ad-hoc one-off task row (S6) — a commitment delta, not a chore, so its
// done-state lives on the commitment (not chore_completions). Same look as
// ChoreCheckRow, plus a remove control.
function AdHocRow({
  commitment, onToggle, onRemove, onEdit, edit,
  sortableRef, sortableStyle, dragHandleProps, isDragging,
}) {
  const done = commitment.state === "done";
  const queued = commitment._pending;
  const isProject = commitment.source_type === "project_node";
  const [showHist, setShowHist] = useState(false);
  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={
        "flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
        (done ? "bg-row-active-dim " : "") +
        (isDragging ? "opacity-60 relative z-10" : "")
      }
    >
      {dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="shrink-0 text-faint hover:text-fg cursor-grab touch-none -mr-1"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onToggle(commitment.id, !done)}
        className={
          "shrink-0 w-7 h-7 border-2 inline-flex items-center justify-center " +
          "cursor-pointer transition-colors duration-100 " +
          (done
            ? "bg-resolved border-resolved text-on-accent"
            : "bg-bg border-line text-transparent hover:border-fg")
        }
        aria-pressed={done}
        aria-label={done ? "Mark not done" : "Mark done"}
      >
        <Check size={16} strokeWidth={3} />
      </button>
      <div className="flex-1 min-w-0">
        <div className={
          "text-[14px] flex flex-wrap items-center gap-x-2 gap-y-0.5 " +
          (done ? "text-muted line-through" : "text-fg font-medium")
        }>
          {/* Round 6 — the title WRAPS (matches ChoreCheckRow: a task
              or step name is content, never truncated). */}
          <span className="min-w-0">
            {commitment.source_ref?.title ?? (isProject ? "(project)" : "(task)")}
          </span>
          {/* One-off tasks keep the chip; a project step's identity is
              its block + the project sub-line — no chip (round 4). */}
          {!isProject && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint border border-line px-1">
              task
            </span>
          )}
          {/* Rescheduled treatment (round 4) — matches ChoreCheckRow:
              12-hour time in 10px tabular faint + the EditedTag. */}
          {edit?.clockTime && (
            <span className="shrink-0 text-[10px] leading-tight text-faint [font-variant-numeric:tabular-nums]">
              {fmtClock12(edit.clockTime)}
            </span>
          )}
          {edit?.history?.length > 0 && (
            <EditedTag
              open={showHist}
              onToggle={() => setShowHist((s) => !s)}
            />
          )}
          {queued && (
            <CloudOff size={12} className="shrink-0 text-warn"
              aria-label="Saved on this device — not synced yet" />
          )}
        </div>
        {isProject && commitment.source_ref?.project_title && (
          <div className="text-[12px] text-faint italic mt-0.5 leading-snug">
            {commitment.source_ref.project_title}
          </div>
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-faint hover:text-fg cursor-pointer"
          aria-label="Edit this task"
        >
          <MoreHorizontal size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(commitment.id)}
        className="shrink-0 text-faint hover:text-warn cursor-pointer"
        aria-label="Remove task"
      >
        <X size={16} />
      </button>
      {showHist && edit?.history?.length > 0 && (
        <EditedHistory history={edit.history} />
      )}
    </li>
  );
}

// A free-text note/marker on the day (S36) — a 'note' commitment delta. Not a
// task: no checkbox, no done-state — just a quiet line ("vet called — ask
// about X") with a remove control.
function NoteRow({
  commitment, onRemove, sortableRef, sortableStyle, dragHandleProps, isDragging,
}) {
  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={
        "flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 "
        + (isDragging ? "opacity-60 relative z-10" : "")
      }
    >
      {dragHandleProps && (
        <button
          type="button"
          {...dragHandleProps}
          className="shrink-0 text-faint hover:text-fg cursor-grab touch-none -mr-1"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
      )}
      <StickyNote size={16} className="shrink-0 text-faint" />
      <div className="flex-1 min-w-0 text-[13px] text-dim italic">
        {commitment.source_ref?.text ?? "(note)"}
      </div>
      <button
        type="button"
        onClick={() => onRemove(commitment.id)}
        className="shrink-0 text-faint hover:text-warn cursor-pointer"
        aria-label="Remove note"
      >
        <X size={16} />
      </button>
    </li>
  );
}

// One sortable Schedule row — wires @dnd-kit's per-item drag state into the
// shared ChoreCheckRow / AdHocRow (S6 3/3 reorder). `onEdit` opens the edit
// sheet; `row.edit` carries the instance's clock time + history.
function DraggableRow({
  row, onEdit, completions, blocks, removeDelta, setDone,
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: row.key });
  const sortable = {
    sortableRef: setNodeRef,
    sortableStyle: { transform: CSS.Transform.toString(transform), transition },
    isDragging,
    dragHandleProps: { ...attributes, ...listeners },
  };
  if (row.kind === "chore") {
    return (
      <ChoreCheckRow
        chore={row.chore}
        placeId={row.placeId}
        placeLabel={row.placeLabel}
        blocks={blocks}
        completions={completions}
        onRemove={row.deltaId ? () => removeDelta(row.deltaId) : undefined}
        onEdit={onEdit}
        edit={row.edit}
        {...sortable}
      />
    );
  }
  if (row.kind === "note") {
    return (
      <NoteRow
        commitment={row.commitment}
        onRemove={removeDelta}
        {...sortable}
      />
    );
  }
  return (
    <AdHocRow
      commitment={row.commitment}
      onToggle={setDone}
      onRemove={removeDelta}
      onEdit={onEdit}
      edit={row.edit}
      {...sortable}
    />
  );
}

// The toolbar "add a one-off task" bar (F58): single-line entry + a block
// selector pulling the current day's blocks (incl. Overnight). Defaults to
// the NOW block (falling back to the day's first); "Anytime" — the app's
// documented no-block landing spot (the edit sheet offers the same) — sits
// LAST, a deliberate choice rather than the default. Replaces the
// per-block foot inputs — a bottom inline input implied the task joined
// the block above it. A specific-time one-off is deferred (James, triage
// 2026-07-01).
function AddTaskBar({ targets, defaultTarget, onAdd, onClose }) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState(defaultTarget ?? "anytime");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t, target === "anytime" ? null : target);
    onClose();
  };
  return (
    <div className="w-full flex flex-wrap items-center gap-2 border border-line bg-surface px-3 py-2 mb-3">
      <Plus size={15} className="shrink-0 text-faint" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") onClose();
        }}
        placeholder="Add a one-off task…"
        className="flex-1 min-w-[140px] bg-transparent text-[13px] text-fg placeholder:text-faint outline-none py-1"
      />
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className={INPUT_CLS + " shrink-0 max-w-[180px]"}
      >
        {targets.map((t) => (
          <option key={t.bucket} value={t.bucket}>{t.label}</option>
        ))}
        <option value="anytime">Anytime</option>
      </select>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-[12px] text-faint hover:text-fg cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className="shrink-0 text-[12px] font-medium text-accent disabled:opacity-40 cursor-pointer"
      >
        Add
      </button>
    </div>
  );
}

// ── NeedsCoverCard (round 5) ─────────────────────────────────────────
// ONE card per scheduled time off (or per event putting the farm a man
// down), covering EVERY block it overlaps. Flush amber (the
// AttentionCard chrome); the "N chores" disclosure lists the affected
// work — grouped under per-block headings when more than one block is
// hit; the button is the single confirmation.
const COVER_KIND_WORD = {
  off_site: "off-site",
  break: "on a break",
  appointment: "out",
  day_off: "off",
};

function coverPhrase(w, allDay) {
  if (allDay) return "all day";
  if ((w.startMin ?? 0) <= 0) {
    return `until ${formatMinutesOfDay(w.endMin)}`;
  }
  if ((w.endMin ?? 0) >= 1440) {
    return `after ${formatMinutesOfDay(w.startMin)}`;
  }
  return `from ${formatMinutesOfDay(w.startMin)}`
    + ` to ${formatMinutesOfDay(w.endMin)}`;
}

function NeedsCoverCard({ unit, dateShort, onCover }) {
  const [open, setOpen] = useState(false);
  const w = unit.window;
  const phrase = coverPhrase(w, unit.allDay);
  // Round 6 — the small mid-dot between time and date, matching every
  // other separator in the app (the heavy bullet read as a third weight).
  const title = unit.allDay
    ? `All day · ${dateShort}`
    : unit.blocks.length === 1
      ? unit.blocks[0].name
      : phrase.charAt(0).toUpperCase() + phrase.slice(1) + ` · ${dateShort}`;
  const body = unit.kind === "event"
    ? `${unit.label} puts us a man down ${phrase}.`
    : `${unit.person} is ${COVER_KIND_WORD[w.kind] ?? "off"} ${phrase}.`;
  const grouped = unit.allDay || unit.blocks.length > 1;
  const action = unit.coverer ? `${unit.coverer} covers` : "Cover accepted";
  return (
    <div
      className="mb-3 border"
      style={{
        borderColor: "color-mix(in srgb, var(--c-warn) 50%, transparent)",
        background: "color-mix(in srgb, var(--c-warn) 7%, var(--c-bg))",
      }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--c-warn) 22%, transparent)",
        }}
      >
        <AlertTriangle size={15} className="shrink-0 text-warn" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
          Needs cover
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="font-heading text-[15px] font-medium text-fg">
          {title}
        </div>
        <div className="text-[12px] text-dim mt-1 leading-snug">
          {body}
        </div>
        {unit.itemCount > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn px-1 py-0.5 cursor-pointer transition-colors hover:bg-row-active active:bg-row-active"
            >
              {unit.itemCount === 1 ? "1 chore" : `${unit.itemCount} chores`}
              <ChevronRight
                size={11}
                className={
                  "transition-transform duration-[140ms] ease-out "
                  + (open ? "rotate-90" : "")
                }
              />
            </button>
            {open && (
              <ul className="mt-1 border-l border-line pl-3 flex flex-col gap-0.5">
                {unit.blocks.map((b) => (
                  <li key={b.bucket} className="text-[12px] leading-snug">
                    {grouped && (
                      <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.12em] text-faint mt-1">
                        {b.name}
                      </div>
                    )}
                    {b.items.map((t, i) => (
                      <div key={i} className="text-dim">{t}</div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onCover}
          className="w-full mt-2.5 bg-warn text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.1em]"
        >
          {action}
        </button>
      </div>
    </div>
  );
}

// ── NobodyCard (round 6) ─────────────────────────────────────────────
// When BOTH of us are out at once, the overlapping needs-cover units
// collapse into ONE card: nobody can cover, so it summarizes the
// overlapping conflicts — who/what, when, and for how long — and the
// only confirmation is "Acknowledged".
function durationText(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

function NobodyCard({ group, dateShort, onAck }) {
  const partName = (u) => u.kind === "event" ? u.label : u.person;
  const partWhen = (u) => u.allDay
    ? "all day"
    : formatMinutesOfDay(u.window.startMin) + "–"
      + formatMinutesOfDay(u.window.endMin);
  return (
    <div
      className="mb-3 border"
      style={{
        borderColor: "color-mix(in srgb, var(--c-warn) 50%, transparent)",
        background: "color-mix(in srgb, var(--c-warn) 7%, var(--c-bg))",
      }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--c-warn) 22%, transparent)",
        }}
      >
        <AlertTriangle size={15} className="shrink-0 text-warn" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
          Nobody at the farm
        </span>
      </div>
      <div className="px-3 py-3">
        {group.spans.map(([s, e], i) => (
          <div
            key={i}
            className="font-heading text-[15px] font-medium text-fg"
          >
            {`From ${formatMinutesOfDay(s)} to ${formatMinutesOfDay(e)}`}
            {` · ${dateShort} · ${durationText(e - s)}`}
          </div>
        ))}
        <div className="text-[12px] text-dim mt-1 leading-snug">
          {group.units.map((u, i) => (
            <div key={i}>
              <b className="text-fg font-semibold">{partName(u)}</b>
              {u.kind === "event" ? " — event, " : " — off "}
              {partWhen(u)}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onAck}
          className="w-full mt-2.5 bg-warn text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.1em]"
        >
          Acknowledged
        </button>
      </div>
    </div>
  );
}

export default function Schedule({ data }) {
  // The day being viewed (defaults to today; tapping a week day opens it).
  const [today, setToday] = useState(() => new Date());
  const { blocks, loading: blocksLoading } = useChoreBlocks();
  const { choreCtx, loading: sitesLoading } = useSites();
  const { rulesByChoreId, rulesByBlockId } = useChoreAssignmentRules();
  const ruleOpts = useMemo(
    () => ({ rulesByChoreId, rulesByBlockId, blocks }),
    [rulesByChoreId, rulesByBlockId, blocks],
  );
  const completions = useChoreCompletions(today);
  const dateISO = useMemo(() => ymdLocal(today), [today]);
  // The real calendar today (the week pane's "today" ring + the jump-to-now
  // target), distinct from `dateISO`, the day being viewed.
  const realTodayISO = useMemo(() => ymdLocal(new Date()), []);

  // (Round 5 — NO-LEGACY) The auto-seeding reflow engine is retired:
  // project steps land on the day ONLY by hand — the ranked queue feeds
  // the "add next task" quick-add instead of an automatic fill.

  // Yesterday's unfinished musts (S12) — when building today, surface the
  // must-do chores that fell due yesterday and weren't completed, so a missed
  // obligation isn't silently lost. Shoulds (deferrable window chores) are
  // excluded — they roll forward by design. Reads yesterday's completions in
  // its own per-date hook.
  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);
  const tomorrow = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);
  const prevISO = useMemo(() => ymdLocal(yesterday), [yesterday]);
  const nextISO = useMemo(() => ymdLocal(tomorrow), [tomorrow]);
  // Neighbor-day timed deltas — the Overnight block's two edges (yesterday
  // evening + tomorrow pre-dawn) live on the adjacent calendar dates.
  const {
    prevDeltas: prevDayDeltas, nextDeltas: nextDayDeltas,
    loading: neighborLoading,
  } = useNeighborDeltas(prevISO, nextISO);
  const yCompletions = useChoreCompletions(yesterday);
  const dayUTC = useMemo(
    () => new Date(Date.UTC(
      today.getFullYear(), today.getMonth(), today.getDate())),
    [today]);
  const {
    deltas, addTask, addNote, addChore, addProject, removeDelta, setDone,
    upsertOverride, updateDelta, addReservation, removeSeries,
    acceptCover, addEventCover,
    addBuffer, toggleBufferItem,
  } = useScheduleDeltas(dateISO);

  // Remove a whole recurring reservation series, with a confirm (S46 follow-up).
  const removeReservationSeries = async (seriesId) => {
    if (typeof window !== "undefined"
      && !window.confirm("Remove this day off on every repeated day?")) return;
    await removeSeries(seriesId);
  };

  // Chore search-to-add: the chore set as searchable items + a resolver.
  const choreById = useMemo(() => {
    const m = new Map();
    for (const c of getAllChoreDefinitions(data)) m.set(c.id, c);
    return m;
  }, [data]);
  const choreDefs = useMemo(() => getAllChoreDefinitions(data), [data]);
  // Chore definition order = the route's chore order (Rounds renders chores in
  // definitions order). Index map so a block's rows can match the route.
  const choreOrder = useMemo(() => {
    const m = new Map();
    choreDefs.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [choreDefs]);
  const [picking, setPicking] = useState(false);
  // Add one (chore, place) onto the day (S33 search-to-add). The search
  // component handles dedup-by-title + place-narrow and calls this per place.
  const addChoreAt = (choreId, placeId, dates = null) => {
    const c = choreById.get(choreId);
    if (!c) return;
    // S37 / F74 — don't duplicate a chore already on the viewed day. Adds to
    // other ticked days still go through; the viewed day is skipped with a
    // warning when it's already present.
    const key = choreId + "|" + (placeId ?? "");
    const targetsViewed = !dates || dates.includes(dateISO);
    if (targetsViewed && presentChoreKeys.has(key)) {
      const others = (dates ?? []).filter((d) => d !== dateISO);
      if (others.length) addChore(c.id, placeId, c.blockId ?? null, others);
      alert(`"${c.title}" is already on this day.`);
      return;
    }
    addChore(c.id, placeId, c.blockId ?? null, dates);
  };

  // Incomplete steps of active projects — the schedulable project "nodes"
  // the search offers (S33 Project category). One row per step.
  const projectNodes = useMemo(() => {
    const out = [];
    for (const p of (data.projects ?? [])) {
      if (!isActiveProject(p, dateISO)) continue;
      for (const s of (p.steps ?? [])) {
        if (s.completedAt) continue;
        out.push({
          projectId: p.id, projectTitle: p.title,
          stepId: s.id, title: s.title,
        });
      }
    }
    return out;
  }, [data, dateISO]);

  // Re-pick the "now" block once a minute as block windows pass.
  const [nowMin, setNowMin] = useState(() => minutesNow());
  useEffect(() => {
    const id = setInterval(() => setNowMin(minutesNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Resolved start minutes + objects for ALL blocks (not just those with
  // chores today) — an override can move a row into an otherwise-empty
  // block, which must then appear in time order.
  const blocksById = useMemo(
    () => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const startMinByBucket = useMemo(() => {
    const m = new Map();
    for (const b of blocks) {
      m.set(b.id, resolveBlockMinutes(today, b.startKind, b.startMinutes)
        ?? b.startMinutes ?? null);
    }
    return m;
  }, [blocks, today]);
  const isRealBlock = (bucket) => bucket !== "anytime" && blocksById.has(bucket);

  // The one derived day (S3): chore rollups + event occurrences + active
  // projects, folded with this day's deltas. Both the accordion (chores)
  // and the event timeline read from it.
  const derived = useMemo(
    () => deriveDay({
      data, dayDate: today, dayUTC, dayISO: dateISO, ruleOpts, deltas,
    }),
    [data, today, dayUTC, dateISO, ruleOpts, deltas]);

  // Every (chore, place) already on the viewed day — derived instances plus
  // pulled-chore deltas — so a re-add can dedupe/warn instead of duplicating
  // (S37 / F74). Keyed "choreId|placeId".
  const presentChoreKeys = useMemo(() => {
    const s = new Set();
    for (const r of derived.choreRollups) {
      for (const inst of r.items) {
        const pids = obligationPlaceIds(inst.chore, choreCtx ?? {});
        for (const pid of (pids.length ? pids : [null])) {
          s.add(inst.chore.id + "|" + (pid ?? ""));
        }
      }
    }
    for (const d of deltas) {
      if (d.source_type === "chore") {
        s.add((d.source_ref?.chore_id ?? "") + "|"
          + (d.source_ref?.place_id ?? ""));
      }
    }
    return s;
  }, [derived, deltas, choreCtx]);

  // The day's tiled segments for time-routing (Project blocks): every real
  // chore-block window + the derived Project gaps. `segmentForStart` walks
  // these to decide which bucket a timed delta lands in (P-B8 catch rule).
  const choreWindows = useMemo(() => {
    const out = [];
    for (const b of blocks) {
      const start = startMinByBucket.get(b.id);
      if (start == null) continue;
      out.push({
        bucket: b.id, start, end: start + (b.durationMinutes ?? 0),
      });
    }
    return out;
  }, [blocks, startMinByBucket]);
  const daySegments = useMemo(
    () => buildDaySegments(choreWindows, derived.projectSegments ?? []),
    [choreWindows, derived]);

  // Project-block contents (the parallel placement path, batch 2): the
  // project_node / ad_hoc deltas whose `clock_time` routes — via the shared
  // segmentForStart — into a Project gap rather than a chore block. Grouped by
  // the "project:<startMin>" bucket; `ids` lets the chore-block fold below drop
  // them so they render once, in the project segment. Untimed project-step adds
  // (the legacy 41.14 path) have no clock_time and stay in "anytime".
  const projectPlacements = useMemo(() => {
    const byBucket = new Map();
    const ids = new Set();
    for (const d of deltas) {
      if (d.source_type !== "project_node" && d.source_type !== "ad_hoc") {
        continue;
      }
      const t = hmToMin(d.clock_time);
      if (t == null) continue;
      const bucket = segmentForStart(t, daySegments);
      if (!bucket.startsWith("project:")) continue;
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push(d);
      ids.add(d.id);
    }
    return { byBucket, ids };
  }, [deltas, daySegments]);

  // Write a project step's completion straight through to project_steps (P14 —
  // one source of truth). The reference-data realtime channel on project_steps
  // refreshes data.projects, so the ranking + any reflow re-derive.
  // Online-only for v1 (offline outbox for steps is deferred).
  const completeProjectStep = (stepId, done) => {
    if (!stepId) return;
    supabase.from("project_steps")
      .update({ completed_at: done ? new Date().toISOString() : null })
      .eq("id", stepId)
      .then(({ error }) => {
        if (error) console.error("completeProjectStep:", error);
      });
  };

  // Overnight windows (batch 3): the night that ENDS this morning (leading,
  // anchored yesterday→today) and the one that STARTS tonight (trailing,
  // today→tomorrow). Pure derivation from occurring block definitions.
  const overnightLeadWin = useMemo(
    () => overnightWindow(yesterday, today, blocks),
    [yesterday, today, blocks]);
  const overnightTrailWin = useMemo(
    () => overnightWindow(today, tomorrow, blocks),
    [today, tomorrow, blocks]);

  // Which of TODAY's deltas the Overnight blocks catch by time — the trailing
  // block's evening edge (time ≥ tonight's last chore end) and the leading
  // block's dawn edge (time < this morning's first chore start). Project gaps
  // win any overlap in the morning band (a project-placed id is skipped here),
  // so these ids are the ones to pull out of the chore-block fold below.
  const overnightCaughtIds = useMemo(() => {
    const ids = new Set();
    for (const d of deltas) {
      if (d.source_type !== "project_node" && d.source_type !== "ad_hoc") {
        continue;
      }
      if (projectPlacements.ids.has(d.id)) continue; // project gap wins overlap
      const t = hmToMin(d.clock_time);
      if (t == null) continue;
      if (inOvernight(overnightTrailWin, t, "evening")
        || inOvernight(overnightLeadWin, t, "dawn")) {
        ids.add(d.id);
      }
    }
    return ids;
  }, [deltas, projectPlacements, overnightTrailWin, overnightLeadWin]);

  // Derive the day (rollups carry .items = chores, .extras = ad-hoc/chore
  // deltas; 'override' deltas are excluded here — applied below at the row
  // level). Then expand each rollup into typed rows.
  const rawBlockRows = useMemo(() => {
    const { choreRollups } = derived;
    const placesById = choreCtx?.placesById;
    return choreRollups.map((r) => {
      const rows = [];
      const seen = new Set();
      // Route convention (match Rounds' per-place view): PLACE-major — you
      // walk to a place and do all its chores there before moving on. So
      // order by place sortOrder, then name, then chore definition order
      // within the place (not chore-major across places).
      const choreRows = [];
      for (const inst of r.items) {
        const placeIds = obligationPlaceIds(inst.chore, choreCtx ?? {});
        const assignee = resolveAssignee(inst.chore, today, ruleOpts);
        for (const pid of placeIds) {
          seen.add(inst.chore.id + "|" + (pid ?? ""));
          const p = pid ? placesById?.get(pid) : null;
          choreRows.push({
            row: {
              kind: "chore",
              key: "c|" + inst.chore.id + "|" + (pid ?? ""),
              chore: inst.chore,
              placeId: pid,
              // R5.13 — every chore row says WHERE: the resolved place,
              // else the chore's anchor description (species/batch —
              // the "animal" fallback).
              placeLabel: p?.name
                ?? describeChoreAnchor(inst.chore, choreCtx ?? {}),
              assignee,
            },
            ps: p?.sortOrder ?? 0,
            pn: p?.name ?? "",
            co: choreOrder.get(inst.chore.id) ?? 1e9,
          });
        }
      }
      choreRows.sort((a, b) =>
        a.ps - b.ps || a.pn.localeCompare(b.pn) || a.co - b.co);
      for (const cr of choreRows) rows.push(cr.row);
      for (const ex of (r.extras ?? [])) {
        // Placed into a Project gap or caught by Overnight — rendered there.
        if (projectPlacements.ids.has(ex.id)) continue;
        if (overnightCaughtIds.has(ex.id)) continue;
        if (ex.source_type === "chore") {
          const chore = choreById.get(ex.source_ref?.chore_id);
          if (!chore) continue; // orphan: chore no longer exists
          const pid = ex.source_ref?.place_id ?? null;
          const k = chore.id + "|" + (pid ?? "");
          if (seen.has(k)) continue; // already due today (dedupe, S37)
          seen.add(k);
          rows.push({
            kind: "chore", key: "cd|" + ex.id, chore, placeId: pid,
            placeLabel: choreCtx?.placesById?.get(pid)?.name
              ?? describeChoreAnchor(chore, choreCtx ?? {}),
            deltaId: ex.id, delta: ex,
            assignee: resolveAssignee(chore, today, ruleOpts),
          });
        } else if (ex.source_type === "project_node") {
          rows.push({ kind: "project", key: "p|" + ex.id, commitment: ex });
        } else if (ex.source_type === "note") {
          rows.push({ kind: "note", key: "n|" + ex.id, commitment: ex });
        } else {
          rows.push({ kind: "adhoc", key: "a|" + ex.id, commitment: ex });
        }
      }
      return { bucket: r.bucket, block: r.block, rows };
    });
  }, [derived, today, ruleOpts, choreCtx, choreById, choreOrder,
    projectPlacements, overnightCaughtIds]);

  // Event occurrences as timeline entries (S9) — time-ordered alongside
  // chore blocks, openable to a panel. Cancelled occurrences are dropped.
  const eventEntries = useMemo(
    () => (derived.events ?? [])
      .filter((o) => o.status !== "cancelled")
      .map((o) => {
        const startMin = hmToMin(o.startTime);
        const endMin = hmToMin(o.endTime)
          ?? (startMin != null ? startMin + 60 : null);
        // R5.23 — the event's spine row sits directly BEFORE the first
        // block it overlaps (an event that overlaps nothing keeps its
        // own start time as its place in the day).
        let sortMin = startMin;
        if (startMin != null) {
          const first = daySegments.find(
            (seg) => seg.start < endMin && seg.end > startMin);
          if (first) sortMin = first.start - 0.5;
        }
        return {
          kind: "event",
          bucket:
            "ev|" + o.instanceId + "|" + o.date + "|" + (o.startTime ?? ""),
          startMin,
          endMin,
          sortMin,
          occ: o,
        };
      }),
    [derived, daySegments]);

  // Project blocks (the derived gaps) as timeline + navigator entries (batch
  // 2 — now with contents). Each carries its placed `items` (project_node /
  // ad_hoc deltas routed here by time, written by the scheduling engine's
  // reflow or a manual add). `startMin` sorts them into the agenda/spine.
  const projectEntries = useMemo(() => {
    // (Round 5) The "continue project above" carry + the engine's auto-
    // fill preview are both retired — placed steps alone drive a block,
    // and the quick-add pulls the next ranked step on demand.
    return (derived.projectSegments ?? []).map((seg) => {
      const bucket = "project:" + seg.startMin;
      const items = projectPlacements.byBucket.get(bucket) ?? [];
      const doneCount = items.filter((d) => d.state === "done").length;
      return {
        kind: "projectblock",
        isProject: true,
        bucket,
        startMin: seg.startMin,
        endMin: seg.endMin,
        durationMin: seg.durationMin,
        who: seg.who,
        // F9 — a gap is PLANNED when a real step occupies it (the engine's
        // reflow or a manual add); unplanned/free gaps wear the cross-hatch
        // on the spine + strip (same language as the LoadSpine bars).
        planned: items.length > 0,
        items,
        count: items.length,
        done: doneCount,
        allDone: items.length > 0 && doneCount === items.length,
      };
    });
  }, [derived, projectPlacements]);

  // Overnight blocks as timeline + navigator entries (batch 3). Two per page:
  // the LEADING shift (last night → this morning, the first segment, continued)
  // and the TRAILING shift (tonight → tomorrow, the last segment). Each
  // assembles its items from two calendar dates — the evening rows of the start
  // date + the pre-dawn rows of the end date — so the one stored row surfaces
  // on both day pages. Hidden when empty (O10), but shown as "syncing…" while
  // the neighbor day is still loading (never a false-empty).
  const overnightEntries = useMemo(() => {
    const isTimed = (d) =>
      d.source_type === "ad_hoc" || d.source_type === "project_node";
    // Sort a night's items chronologically across midnight: evening minutes
    // first, then pre-dawn (offset a day so 4 a.m. follows 11 p.m.).
    const nightMin = (win, d) => {
      const t = hmToMin(d.clock_time) ?? 0;
      return t >= win.startMin ? t : t + 1440;
    };
    const assemble = (win, eveningSrc, dawnSrc) => {
      const pick = (src, side) => (src ?? []).filter((d) =>
        isTimed(d) && !projectPlacements.ids.has(d.id)
        && inOvernight(win, hmToMin(d.clock_time), side));
      return [...pick(eveningSrc, "evening"), ...pick(dawnSrc, "dawn")]
        .sort((a, b) => nightMin(win, a) - nightMin(win, b));
    };
    const mk = (side, win, items, bucket) => ({
      kind: "overnightblock",
      isOvernight: true,
      side, bucket,
      winStart: win.startMin,
      winEnd: win.endMin,
      rangeLabel: formatMinutesOfDay(win.startMin) + "–"
        + formatMinutesOfDay(win.endMin),
      startMin: win.startMin,
      items,
      count: items.length,
      done: items.filter((d) => d.state === "done").length,
      allDone: items.length > 0 && items.every((d) => d.state === "done"),
      loading: neighborLoading,
      countsTonight: side === "trail", // start-day-only count (O-B4 struck)
    });
    const out = [];
    // Leading: yesterday evening (neighbor) + today pre-dawn (own deltas).
    if (overnightLeadWin) {
      const items = assemble(overnightLeadWin, prevDayDeltas, deltas);
      if (items.length > 0 || neighborLoading) {
        out.push(mk("lead", overnightLeadWin, items, OVERNIGHT_LEAD));
      }
    }
    // Trailing: today evening (own deltas) + tomorrow pre-dawn (neighbor).
    if (overnightTrailWin) {
      const items = assemble(overnightTrailWin, deltas, nextDayDeltas);
      if (items.length > 0 || neighborLoading) {
        out.push(mk("trail", overnightTrailWin, items, OVERNIGHT_TRAIL));
      }
    }
    return out;
  }, [overnightLeadWin, overnightTrailWin, deltas, prevDayDeltas,
    nextDayDeltas, projectPlacements, neighborLoading]);

  const overrideDeltas = useMemo(
    () => deltas.filter((d) => d.source_type === "override"), [deltas]);

  // Apply 'override' commitments (relocate/retime/reorder derived rows),
  // then regroup by bucket and sort: blocks by start time, rows by order.
  const blockRows = useMemo(() => {
    const placed = applyOverrides(rawBlockRows, overrideDeltas, isRealBlock);
    const byBucket = new Map();
    for (const e of placed) {
      if (!byBucket.has(e.bucket)) byBucket.set(e.bucket, []);
      byBucket.get(e.bucket).push(e);
    }
    const out = [];
    for (const [bucket, entries] of byBucket) {
      entries.sort((a, b) => a.order - b.order);
      out.push({
        bucket,
        block: bucket === "anytime" ? null : (blocksById.get(bucket) ?? null),
        startMin: bucket === "anytime" ? null : (startMinByBucket.get(bucket) ?? null),
        rows: entries.map((e) => ({ ...e.row, _order: e.order })),
      });
    }
    return out.sort((a, b) => startKey(a) - startKey(b));
  }, [rawBlockRows, overrideDeltas, blocksById, startMinByBucket]);

  // F58 — the toolbar one-off entry's block choices: the day's real chore
  // blocks AND its project gaps (round 4), merged in time order; "Anytime"
  // is the null option the control adds itself. Overnight is excluded
  // (O7 — not pickable for adds). A project-gap choice carries the gap's
  // start as `clockTime` so the add routes by time (segmentForStart lands
  // it back in the gap), not by block id.
  const oneOffTargets = useMemo(() => [
    ...blockRows
      .filter((b) => b.block)
      .map((b) => ({
        bucket: b.bucket,
        startMin: b.startMin,
        label: (b.block.name ?? "Block")
          + (b.startMin != null
            ? " · " + formatMinutesOfDay(b.startMin) : ""),
      })),
    ...projectEntries.map((e) => ({
      bucket: e.bucket,
      startMin: e.startMin,
      label: "Project · " + formatMinutesOfDay(e.startMin),
      clockTime: minToHM(e.startMin),
    })),
  ].sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0)),
  [blockRows, projectEntries]);
  const [addingTask, setAddingTask] = useState(false);
  // The phone toolbar's one "+ Add" menu (42.3 round 3) — the mobile
  // pattern is primary action + a consolidated add menu, not four
  // wrapping text buttons.
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Non-work time (S7) + man-down (S8). Reservations are person/time windows;
  // an assigned row whose block overlaps its assignee's window needs cover.
  const reservations = useMemo(
    () => deltas.filter((d) => d.source_type === "reservation"), [deltas]);
  const windows = useMemo(() => reservationWindows(reservations), [reservations]);

  // Buffers (S53/S55/S57) — reserved adjacent time bound to an activity. The
  // per-day buffers come from this day's deltas (scope-'all' template rows are
  // excluded — they ride the separate template hook and synthesize per day).
  const buffers = useMemo(
    () => deltas.filter((d) =>
      d.source_type === "buffer" && d.source_ref?.scope !== "all"), [deltas]);

  // All-occurrences buffer templates (S53/S54) + their per-day tick / remove.
  const { templates: bufferTemplates, toggleTemplateItem, removeTemplate } =
    useBufferTemplates();
  // The buffers shown on an activity = its per-day buffers + any template's
  // synthesized buffer for the viewed day (window recomputed from `anchor`).
  const buffersForActivity = (kind, id, anchor) => [
    ...buffersForTarget(buffers, kind, id),
    ...buffersForTarget(bufferTemplates, kind, id)
      .map((t) => deriveTemplateBuffer(t, anchor, dateISO))
      .filter(Boolean),
  ];
  // Route a checklist tick / remove to the per-day or the template path.
  const onBufferToggle = (buf, itemId, done) => buf._template
    ? toggleTemplateItem(buf.id, itemId, done, dateISO)
    : toggleBufferItem(buf.id, itemId, done);
  const onBufferRemove = (buf) => buf._template
    ? removeTemplate(buf.id) : removeDelta(buf.id);

  // Block window [start, start+duration) for overlap tests.
  const blockWindow = (bucket) => {
    const start = bucket === "anytime" ? null : (startMinByBucket.get(bucket) ?? null);
    if (start == null) return { start: null, end: null };
    return { start, end: start + (blocksById.get(bucket)?.durationMinutes ?? 0) };
  };

  // done / total per block, across chores (completions) + ad-hoc (state).
  const counts = useMemo(() => blockRows.map((b) => {
    let done = 0;
    let total = 0;
    for (const row of b.rows) {
      if (row.kind === "note") continue; // markers aren't work — don't count
      total++;
      if (row.kind === "chore"
        ? completions.isDone(row.chore.id, row.placeId)
        : row.commitment.state === "done") done++;
    }
    return { done, total };
  }), [blockRows, completions]);

  // done/total keyed by bucket (the render iterates the merged timeline, so
  // index-into-blockRows no longer lines up).
  const countByBucket = useMemo(() => {
    const m = new Map();
    blockRows.forEach((b, i) => m.set(b.bucket, counts[i]));
    return m;
  }, [blockRows, counts]);

  const HORIZON_DAYS = 14;
  // { res: Map<iso, reservation[]>, ovr: Map<iso, override[]> }. Always loaded
  // (not gated on the conflicts panel) so the week pane can mark EVERY day of
  // the displayed week (F17), not just focal/forward days. One read-only query
  // for both reservation + override commitments, spanning the week's Sunday
  // through the forward 14-day horizon. Overrides are needed because a man-down
  // often only exists after a block-move/reassignment override (see
  // `dayConflictCount`). Declared above the `farm` memo — the week identity
  // bars (F40) read `horizon.res` for gap splitting.
  const [horizon, setHorizon] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const from = new Date(today);
    from.setDate(from.getDate() - from.getDay()); // the week's Sunday
    const to = new Date(today);
    to.setDate(to.getDate() + HORIZON_DAYS);
    supabase.from("commitments")
      .select("id, source_type, source_ref, run_date, clock_time, assignee")
      .in("source_type", ["reservation", "override"])
      .gte("run_date", ymdLocal(from)).lte("run_date", ymdLocal(to))
      .then((res) => {
        if (cancelled) return;
        const r = new Map();
        const o = new Map();
        for (const row of res.data ?? []) {
          const m = row.source_type === "override" ? o : r;
          if (!m.has(row.run_date)) m.set(row.run_date, []);
          m.get(row.run_date).push(row);
        }
        setHorizon({ res: r, ovr: o });
      });
    return () => { cancelled = true; };
  }, [today]);

  // The week's timed ad_hoc/project_node commitments (± a day for the
  // overnight wrap's edges), keyed by run_date. Feeds the week-pane Moon
  // scan (round 4) AND the week identity bars' planned-vs-free test (F40).
  const [weekTimedDeltas, setWeekTimedDeltas] = useState(() => new Map());
  useEffect(() => {
    let cancelled = false;
    const ds = weekDays(today);
    const from = new Date(ds[0]);
    from.setDate(from.getDate() - 1);
    const to = new Date(ds[6]);
    to.setDate(to.getDate() + 1);
    supabase.from("commitments")
      .select("id, source_type, source_ref, run_date, clock_time")
      .in("source_type", ["ad_hoc", "project_node"])
      .not("clock_time", "is", null)
      .gte("run_date", ymdLocal(from)).lte("run_date", ymdLocal(to))
      .then((res) => {
        if (cancelled) return;
        const m = new Map();
        for (const r of res.data ?? []) {
          if (r.source_ref?.origin === "removed") continue; // tombstones
          if (!m.has(r.run_date)) m.set(r.run_date, []);
          m.get(r.run_date).push(r);
        }
        setWeekTimedDeltas(m);
      });
    return () => { cancelled = true; };
  }, [today]);

  // The one farmLoad model for the viewed day (Round-3, harvest-remix). The
  // shared day-load read consumed by the LoadSpine and the WeekStrip — folding
  // what were the inline `daySilhouette` / `week` / `shouldHeat` computations
  // into ONE (those are deleted below; NO-LEGACY). It reads the same walks they
  // did, so it can't drift. `nowMin` only flows on a today-view (else block
  // now/future state is meaningless). `weekRes`/`weekTimed` feed the This
  // Week identity bars (F40).
  const farm = useMemo(
    () => farmLoad({
      data, date: today, ruleOpts, choreCtx, completions, deltas,
      nowMin: dateISO === realTodayISO ? nowMin : null,
      weekRes: horizon?.res ?? null,
      weekTimed: weekTimedDeltas,
    }),
    [data, today, ruleOpts, choreCtx, completions, deltas, dateISO,
      realTodayISO, nowMin, horizon, weekTimedDeltas],
  );

  // (Round-3 NO-LEGACY) The inline `personLanes` + `daySilhouette` memos that
  // used to feed the two-lane DayRibbon are GONE — the day-load is the LoadSpine
  // over `farm.blocks`. The two-lane "who's on what" overlay was removed
  // entirely (F27): it leaned on per-chore assignment that the farm doesn't
  // commit to, so it added noise more than signal.

  // The merged day timeline: chore blocks + event entries + project gaps +
  // overnight, in time order (the leading overnight pins first, the trailing
  // last — via startKey). "now"/seal stay on chore blocks; events are lines.
  const timeline = useMemo(
    () => [
      ...blockRows.map((b) => ({ kind: "block", ...b })),
      ...eventEntries,
      ...projectEntries,
      ...overnightEntries,
    ].sort((a, b) => startKey(a) - startKey(b)),
    [blockRows, eventEntries, projectEntries, overnightEntries]);

  // "now" bucket — normally the chore block the clock sits in, but the
  // overnight wrap takes it at the edges of the day: before this morning's
  // first chore block, the LEADING overnight is "now" (the pre-dawn hinge);
  // after tonight's last chore block, the TRAILING one is. Only when that
  // overnight segment actually renders (has items / is syncing).
  // Now at the day's EDGES (42.3 round 3): when now falls before the first
  // block starts or after the last block ends (and no overnight window owns
  // it), NO block is marked "now" — the surfaces draw the now-rule at the
  // edge instead (horizontal above/below the spine rows, a vertical line at
  // the end of the day-load bars / phone strip). Uses farm.spine (it carries
  // endMin for chore AND project bars).
  const nowEdge = useMemo(() => {
    if (dateISO !== realTodayISO) return null;
    const lead = overnightEntries.find((e) => e.side === "lead");
    const trail = overnightEntries.find((e) => e.side === "trail");
    if (lead && nowMin < lead.winEnd) return null;
    if (trail && nowMin >= trail.winStart) return null;
    const bars = farm.spine.filter((b) => b.startMin != null);
    if (!bars.length) return null;
    const first = Math.min(...bars.map((b) => b.startMin));
    const last = Math.max(...bars.map((b) => b.endMin ?? b.startMin));
    if (nowMin < first) return "before";
    if (nowMin >= last) return "after";
    return null;
  }, [dateISO, realTodayISO, overnightEntries, farm, nowMin]);

  const nowBucket = useMemo(() => {
    if (nowEdge) return null;
    const lead = overnightEntries.find((e) => e.side === "lead");
    const trail = overnightEntries.find((e) => e.side === "trail");
    if (lead && nowMin < lead.winEnd) return OVERNIGHT_LEAD;
    if (trail && nowMin >= trail.winStart) return OVERNIGHT_TRAIL;
    return pickNowBucket(blockRows, nowMin);
  }, [blockRows, nowMin, overnightEntries, nowEdge]);

  // The day-spine / phone-strip segments — one per chore block of the viewed
  // day, carrying the load (count), done, time, and the man-down flag so the
  // navigator reads as a labelled time axis (Design Bracket 2).
  const spineBlocks = useMemo(() => blockRows.map((b, i) => {
    // F24b — the same warning the day-load summary shows, attributed to its
    // block (keyed by bucket = farmLoad blockId) so the row repeats the signal.
    const w = farm.warming?.byBucket.get(b.bucket);
    return {
      bucket: b.bucket,
      name: b.block?.name ?? "Anytime",
      block: b.block,
      startMin: b.startMin,
      endMin: b.startMin != null
        ? b.startMin + (b.block?.durationMinutes ?? 0) : null,
      count: counts[i].total,
      done: counts[i].done,
      allDone: counts[i].total > 0 && counts[i].done === counts[i].total,
      warn: w?.warn ?? [],
      due: w?.due ?? [],
    };
  }), [blockRows, counts, farm]);

  // ── Needs-cover UNITS (round 5) ────────────────────────────────────
  // ONE unit per scheduled time off (reservation) that overlaps any of
  // the day's blocks — however many blocks it crosses — plus one per
  // EVENT that overlaps blocks (an event puts the farm a man down).
  // Cover acceptance is a single write: the reservation's
  // source_ref.cover, or an event-keyed override delta.
  const coverUnits = useMemo(() => {
    const segs = [];
    for (const b of blockRows) {
      if (!b.block) continue;
      const w = blockWindow(b.bucket);
      if (w.start == null) continue;
      segs.push({
        bucket: b.bucket, name: b.block.name, start: w.start, end: w.end,
        items: b.rows.filter((r) => r.kind !== "note").map((r) =>
          r.kind === "chore"
            ? r.chore.title
            : (r.commitment.source_ref?.title ?? "task")),
      });
    }
    for (const e of projectEntries) {
      segs.push({
        bucket: e.bucket,
        name: "Project · " + formatMinutesOfDay(e.startMin),
        start: e.startMin, end: e.endMin,
        items: e.items.map((d) => d.source_ref?.title ?? "task"),
      });
    }
    segs.sort((a, b) => a.start - b.start);
    const overlap = (seg, w) => seg.start <= w.endMin && seg.end > w.startMin;

    const units = [];
    for (const w of windows) {
      const hit = segs.filter((seg) => overlap(seg, w));
      if (!hit.length) continue;
      const res = reservations.find((r) => r.id === w.id);
      units.push({
        kind: "timeoff", id: w.id, window: w,
        allDay: w.kind === "day_off",
        person: w.assignee,
        coverer: ADMINS.find((a) => a !== w.assignee) ?? null,
        blocks: hit,
        itemCount: hit.reduce((n, seg) => n + seg.items.length, 0),
        cover: res?.source_ref?.cover ?? null,
      });
    }
    const eventCovers = deltas.filter((d) => d.source_type === "override"
      && d.source_ref?.target?.kind === "event");
    for (const e of eventEntries) {
      if (e.startMin == null) continue;
      const w = { startMin: e.startMin, endMin: e.endMin };
      const hit = segs.filter((seg) => overlap(seg, w));
      if (!hit.length) continue;
      const cov = eventCovers.find((d) =>
        d.source_ref?.target?.instance_id === e.occ.instanceId
        && d.source_ref?.target?.date === e.occ.date);
      units.push({
        kind: "event", id: "evc|" + e.occ.instanceId + "|" + e.occ.date,
        occ: e.occ, window: { ...w, kind: "event" },
        allDay: false, person: null, coverer: null,
        label: e.occ.instanceLabel,
        blocks: hit,
        itemCount: hit.reduce((n, seg) => n + seg.items.length, 0),
        cover: cov?.source_ref?.cover ?? null,
      });
    }
    return units;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockRows, projectEntries, windows, reservations, deltas,
    eventEntries, startMinByBucket, blocksById]);

  const uncoveredUnits = useMemo(
    () => coverUnits.filter((u) => !u.cover), [coverUnits]);
  const coveredUnits = useMemo(
    () => coverUnits.filter((u) => u.cover), [coverUnits]);

  // Round 6 — overlapping uncovered units from DIFFERENT people (an event
  // always counts as its own person: someone must be there) mean nobody
  // can cover: they group into ONE "Nobody at the farm" card. `spans` =
  // the intervals where ≥2 of the group are out at once. Same-person
  // overlaps (an appointment inside a day off) never group.
  const coverGroups = useMemo(() => {
    const units = uncoveredUnits;
    const overlaps = (a, b) =>
      a.window.startMin < b.window.endMin
      && b.window.startMin < a.window.endMin
      && (a.kind === "event" || b.kind === "event"
        || a.person !== b.person);
    const parent = units.map((_, i) => i);
    const find = (i) =>
      parent[i] === i ? i : (parent[i] = find(parent[i]));
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        if (overlaps(units[i], units[j])) parent[find(i)] = find(j);
      }
    }
    const byRoot = new Map();
    units.forEach((u, i) => {
      const r = find(i);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(u);
    });
    const nobody = [];
    const singles = [];
    for (const group of byRoot.values()) {
      if (group.length < 2) {
        singles.push(...group);
        continue;
      }
      const pts = group
        .flatMap((u) => [[u.window.startMin, 1], [u.window.endMin, -1]])
        .sort((a, b) => a[0] - b[0] || b[1] - a[1]);
      let depth = 0;
      let start = null;
      const spans = [];
      for (const [t, d] of pts) {
        depth += d;
        if (depth >= 2 && start == null) start = t;
        else if (depth < 2 && start != null) {
          spans.push([start, t]);
          start = null;
        }
      }
      nobody.push({
        id: "nobody|" + group.map((u) => u.id).join("+"),
        units: group,
        spans,
      });
    }
    return { nobody, singles };
  }, [uncoveredUnits]);

  // Per-bucket flags for the sidebars: conflict stripes/triangle on every
  // block an UNCOVERED unit touches; the muted covered mark elsewhere.
  const needsCoverBuckets = useMemo(() => new Set(
    uncoveredUnits.flatMap((u) => u.blocks.map((b) => b.bucket))),
  [uncoveredUnits]);
  const coveredByBucket = useMemo(() => {
    const m = new Map();
    for (const u of coveredUnits) {
      for (const b of u.blocks) {
        const list = m.get(b.bucket) ?? [];
        list.push({
          by: u.cover?.by ?? null,
          ack: u.cover?.ack ?? false,
          at: u.cover?.at ?? null,
          label: u.kind === "event"
            ? (u.label ?? "Event")
            : `${u.person} — ${u.allDay ? "all day"
              : formatMinutesOfDay(u.window.startMin) + "–"
                + formatMinutesOfDay(u.window.endMin)}`,
        });
        m.set(b.bucket, list);
      }
    }
    return m;
  }, [coveredUnits]);

  // Day-load bars overlapped by an uncovered unit — LoadSpine stripes them
  // in the warn language until cover is accepted (round 5).
  const conflictBarIds = useMemo(() => {
    const out = new Set();
    for (const b of farm.spine) {
      const sMin = b.window?.startMin;
      const eMin = b.window?.endMin;
      if (sMin == null || eMin == null) continue;
      if (uncoveredUnits.some(
        (u) => sMin <= u.window.endMin && eMin > u.window.startMin)) {
        out.add(b.blockId);
      }
    }
    return out;
  }, [farm, uncoveredUnits]);

  // The navigator segments = chore blocks + Project gaps + the Overnight wrap
  // + events, in time order (events pin before their first overlapped
  // block), each carrying its needs-cover / covered flags.
  const navSegments = useMemo(
    () => [...spineBlocks, ...projectEntries, ...overnightEntries,
      ...eventEntries]
      .map((e) => ({
        ...e,
        needsCover: needsCoverBuckets.has(e.bucket),
        covered: coveredByBucket.get(e.bucket) ?? null,
      }))
      .sort((a, b) => startKey(a) - startKey(b)),
    [spineBlocks, projectEntries, overnightEntries, eventEntries,
      needsCoverBuckets, coveredByBucket]);

  // Day-load counters (42.3 round 3): CHORES (chore obligations only — a
  // one-off task or a placed project step isn't a chore), BLOCKS as the
  // spine shows them (chore blocks + project gaps + events + the overnight
  // wrap = navSegments), and DISTINCT projects worked (not gaps).
  const dayLoadCounts = useMemo(() => {
    const chores = blockRows.reduce(
      (s, b) => s + b.rows.filter((r) => r.kind === "chore").length, 0);
    const projectIds = new Set();
    for (const e of projectEntries) {
      for (const d of e.items) {
        const pid = d.source_ref?.project_id;
        if (pid) projectIds.add(pid);
      }
    }
    return {
      chores,
      blocks: navSegments.length,
      projects: projectIds.size,
      events: eventEntries.length,
    };
  }, [blockRows, projectEntries, navSegments, eventEntries]);

  // The one day-load count line, shared verbatim by the desktop header and
  // the phone strip header (they must never disagree). Pluralized per word.
  const nText = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  // A unit's who + when, for the badge tooltips + the conflict list.
  const unitWhen = (u) => u.kind === "event" || !u.allDay
    ? formatMinutesOfDay(u.window.startMin) + "–"
      + formatMinutesOfDay(u.window.endMin)
    : "all day";
  const unitName = (u) => u.kind === "event" ? u.label : u.person;
  const unitTip = (u) => `${unitName(u)} — ${unitWhen(u)}`;
  // (Round 6) `dayLoadSummary` itself is built BELOW the conflicts
  // section — its warn badge counts every today-conflict and opens the
  // conflict list on click (it replaced the toolbar conflicts button).

  // (Round-3 NO-LEGACY) The inline `week` (weekFullness) memo is GONE — it is
  // folded into the one `farm` model (`farm.week`) consumed by the sidebar
  // WeekStrip and the Week zoom. weekFullness is still called — inside
  // farmLoad, not here. (The old `shouldHeat` fold went with the should-heat
  // gradient — warming is now the binary day-load ClockAlert, F24.)

  // The three zooms (S9 tail). "day" = the master-detail surface; "week" /
  // "month" replace the centre with a wider navigator. Desktop only — phone
  // stays the day surface. The month grid is keyed on its year-month so it
  // recomputes only when the viewed month changes, not every day.
  const [viewMode, setViewMode] = useState("day");
  const monthKey = `${today.getFullYear()}-${today.getMonth()}`;
  const month = useMemo(
    () => monthFullness(data, today, ruleOpts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, monthKey, ruleOpts]);

  // Confirmed-day stamps for the visible week/month range — one range query,
  // collected into a Set of YYYY-MM-DD so the zoom grids can flag agreed days.
  const [confirmedDays, setConfirmedDays] = useState(() => new Set());
  useEffect(() => {
    if (viewMode !== "week" && viewMode !== "month") return;
    let cancelled = false;
    const dates = viewMode === "week"
      ? weekDays(today)
      : month.weeks.flat().map((c) => c.date);
    const isos = dates.map(ymdLocal);
    readCaptures("schedule.confirmed_day", {
      subjectType: "schedule_day",
      fromDate: isos[0], toDate: isos[isos.length - 1],
    }).then((rows) => {
      if (!cancelled) setConfirmedDays(new Set(rows.map((r) => r.subject_id)));
    }).catch(() => { /* offline / unauth — no stamps */ });
    return () => { cancelled = true; };
  }, [viewMode, today, month]);

  // Week reservations (S80) — each person's reserved non-work time across the
  // viewed week, one range read collected per day into a Map iso -> windows.
  const [weekReservations, setWeekReservations] = useState(() => new Map());
  useEffect(() => {
    if (viewMode !== "week") return;
    let cancelled = false;
    const ds = weekDays(today).map(ymdLocal);
    supabase.from("commitments")
      .select("id, source_type, source_ref, run_date, clock_time, assignee")
      .eq("source_type", "reservation")
      .gte("run_date", ds[0]).lte("run_date", ds[ds.length - 1])
      .then((res) => {
        if (cancelled) return;
        const m = new Map();
        for (const r of res.data ?? []) {
          const w = reservationWindow(r);
          if (!w || !w.assignee) continue;
          if (!m.has(r.run_date)) m.set(r.run_date, []);
          m.get(r.run_date).push({ ...w, id: r.id });
        }
        setWeekReservations(m);
      });
    return () => { cancelled = true; };
  }, [viewMode, today]);

  // ── Looking back / routine drift (S11 / Epic L) ────────────────────
  // The "Review" zoom reads ACTUALS (commitments exec history) + PLANNED
  // (confirmed-day captures) over a trailing window, and derives block
  // start-time drift + per-day plan-vs-actual (see lookBack.js).
  const REVIEW_DAYS = 30;
  const DRIFT_SPLIT = 14;
  const { runs: historyRuns } = useRunHistory({ days: REVIEW_DAYS });
  const [reviewCaptures, setReviewCaptures] = useState([]);
  useEffect(() => {
    if (viewMode !== "review") return;
    let cancelled = false;
    const from = new Date();
    from.setDate(from.getDate() - REVIEW_DAYS);
    readCaptures("schedule.confirmed_day", {
      subjectType: "schedule_day",
      fromDate: ymdLocal(from), toDate: ymdLocal(new Date()),
    }).then((rows) => {
      if (!cancelled) setReviewCaptures(rows);
    }).catch(() => { /* offline / unauth — empty */ });
    return () => { cancelled = true; };
  }, [viewMode]);
  const drift = useMemo(
    () => blockStartDrift(historyRuns, blocks, DRIFT_SPLIT),
    [historyRuns, blocks]);
  const reviews = useMemo(
    () => dayReviews(reviewCaptures, historyRuns),
    [reviewCaptures, historyRuns]);

  // Master-detail focus (Design Bracket 2). The day is navigated by its shape
  // (the spine / phone strip); the center renders exactly ONE block, or the
  // whole-day overview agenda. `focusSel`: null = follow "now", "overview" =
  // the agenda, or a bucket id. `focus` is the resolved open block (null =
  // overview) — this dissolves the "scroll past the open block" problem.
  const [focusSel, setFocusSel] = useState(null);
  // `"first"` is the landing selector for a day opened from Week/Month/This
  // Week: the day's first block, resolved once its rows exist (the desktop
  // whole-day overview is a toggle state, not a landing — F28 follow-up).
  // Follow-now with nothing current (now is past/before the day's blocks —
  // `nowEdge`): land on the nearest block instead of the retired overview.
  const focus = focusSel === null
    ? (nowBucket
      ?? (nowEdge === "after"
        ? blockRows[blockRows.length - 1]?.bucket
        : blockRows[0]?.bucket)
      ?? null)
    : focusSel === "overview" ? null
    : focusSel === "first" ? (blockRows[0]?.bucket ?? null)
    : focusSel;
  const focusRef = useRef(null);

  // Picking a block opens it; re-picking the open one is a no-op — the
  // desktop whole-day overview is ELIMINATED (round-2 feedback): one block
  // is always open, and the spine tooltips carry what the overview listed
  // (real block name, done count, alerts). The overview state survives
  // only for the phone's Whole-day toggle (and the event-detail close).
  const pickBlock = (bucket) => setFocusSel(bucket);
  const showOverview = () => setFocusSel("overview");

  // Per-day focus memory (F45): remember the open block for each visited day
  // and restore it on return; a day not opened this session lands on its
  // FIRST block (today: follow now). `focusOverride` forces a specific
  // target (e.g. opening straight to a block from Week/Month).
  const focusByDayRef = useRef(new Map());
  const goToDay = (date, focusOverride) => {
    focusByDayRef.current.set(dateISO, focusSel);
    const nextISO = ymdLocal(date);
    const next = focusOverride !== undefined
      ? focusOverride
      : (focusByDayRef.current.has(nextISO)
        ? focusByDayRef.current.get(nextISO)
        : nextISO === realTodayISO ? null : "first");
    setToday(date);
    setFocusSel(next);
  };

  // Zoom navigation: tapping a day (or a day's block) in Week/Month snaps the
  // surface back to the Day zoom on that target.
  const openDay = (date) => {
    goToDay(date);
    setViewMode("day");
  };
  const openDayBlock = (date, bucket) => {
    goToDay(date, bucket);
    setViewMode("day");
  };

  // The "Now" affordance is offered whenever you're not already looking at
  // the now block on the actual current day (a different day, the overview, or
  // a later block). Jumping snaps the viewed day back to today AND follows now.
  const viewingToday = dateISO === realTodayISO;

  // Yesterday's unfinished musts (S12), computed only when building today.
  const yesterdayMusts = useMemo(() => {
    if (!viewingToday) return { count: 0, titles: [] };
    const titles = [];
    let count = 0;
    const seen = new Set();
    for (const r of rollupChoresForDay(data, yesterday, ruleOpts)) {
      for (const inst of r.items) {
        const c = inst.chore;
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        if (!isMustChore(c, yesterday, blocks)) continue;
        const pids = obligationPlaceIds(c, choreCtx ?? {});
        const { done, total } =
          yCompletions.doneCountForChore(c.id, pids.length ? pids : [null]);
        if (done < total) { count += total - done; titles.push(c.title); }
      }
    }
    return { count, titles };
  }, [viewingToday, data, yesterday, ruleOpts, blocks, choreCtx, yCompletions]);

  const showJump = !viewingToday || focus !== nowBucket;
  const jumpToNow = () => {
    if (!viewingToday) setToday(new Date());
    setFocusSel(null);
    focusRef.current?.scrollIntoView?.({
      behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center",
    });
  };

  // tick -> seal: when the focused block flips to fully done, advance focus to
  // the next not-yet-done block (forward focus). Fires only on the transition.
  const sealRef = useRef(null);
  useEffect(() => {
    if (focus == null) { sealRef.current = null; return; }
    const i = blockRows.findIndex((b) => b.bucket === focus);
    if (i < 0) { sealRef.current = null; return; }
    const c = counts[i];
    const isComplete = c.total > 0 && c.done === c.total;
    const wasComplete = sealRef.current?.bucket === focus && sealRef.current.complete;
    if (isComplete && !wasComplete) {
      const next = blockRows.findIndex(
        (b, j) => j > i && counts[j].total > counts[j].done,
      );
      if (next >= 0) setFocusSel(blockRows[next].bucket);
    }
    sealRef.current = { bucket: focus, complete: isComplete };
  }, [counts, focus, blockRows]);

  // ── Confirm (S5) — the day's commitment, written as a versioned
  // schedule.confirmed_day capture (the S2 substrate). ───────────────
  const email = useCurrentUserEmail();

  // The confirmed snapshot for today, if any. null = a draft.
  const [confirmedDoc, setConfirmedDoc] = useState(null);
  const [confirming, setConfirming] = useState(false);
  // Bumped by a realtime captures change so the confirm state re-reads when
  // ANOTHER device confirms/unconfirms the viewed day (F17).
  const [confirmReloadTick, setConfirmReloadTick] = useState(0);
  // Clear the previous day's stamp immediately on a date change so an
  // unconfirmed day never shows a stale "Confirmed" (a realtime refetch swaps
  // in place without this flash).
  useEffect(() => { setConfirmedDoc(null); }, [dateISO]);
  useEffect(() => {
    let cancelled = false;
    readCaptures("schedule.confirmed_day", {
      subjectType: "schedule_day", subjectId: dateISO,
    }).then((rows) => {
      if (!cancelled) setConfirmedDoc(rows.length ? rows[0].doc : null);
    }).catch(() => { /* offline / unauth — stays a draft */ });
    return () => { cancelled = true; };
  }, [dateISO, confirmReloadTick]);
  // Realtime: a captures change (e.g. the other device confirming today)
  // refetches the viewed day's confirm doc, debounced (F17).
  useEffect(() => {
    let scheduled = false;
    const bump = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        setConfirmReloadTick((t) => t + 1);
      }, 150);
    };
    const ch = realtimeChannel(`sched-confirm:${dateISO}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "captures" }, bump)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dateISO]);

  // Placed commitment items that live OUTSIDE the chore blocks — the
  // project-gap items + the TRAILING (start-day) overnight items — folded into
  // the day total + the confirm snapshot + its reconcile so confirming a day
  // agrees the project + tonight's overnight work, not just the chore blocks
  // (O-B4/O-B5). The LEADING overnight is last night's shift; its items count
  // on yesterday (start-day-only), so it's excluded here.
  const placedCommitmentItems = useMemo(() => {
    const seen = new Set();
    const out = [];
    const add = (d) => { if (!seen.has(d.id)) { seen.add(d.id); out.push(d); } };
    for (const e of projectEntries) for (const d of e.items) add(d);
    for (const e of overnightEntries) {
      if (e.side !== "trail") continue;
      for (const d of e.items) add(d);
    }
    return out;
  }, [projectEntries, overnightEntries]);

  const totalRows = useMemo(
    () => counts.reduce((s, c) => s + c.total, 0) + placedCommitmentItems.length,
    [counts, placedCommitmentItems]);

  // One placed commitment -> a confirm-doc entry (reference + label, never a
  // copy of content). Keyed by commitment id, like the in-block ad-hoc rows.
  const commitmentConfirmEntry = (d) => ({
    source_type: d.source_type === "project_node" ? "project_node" : "ad_hoc",
    label: d.source_ref?.title
      ?? (d.source_type === "project_node" ? "project" : "task"),
    block_id: null,
    clock_time: d.clock_time ?? null,
    assignee: d.assignee ?? null,
    source_ref: { commitment_id: d.id },
  });

  // The frozen planned shape (schedule.confirmed_day v1). Reference +
  // labels only — never a copy of source content.
  const buildConfirmedDoc = () => ({
    date: dateISO,
    confirmed_by: email ?? "unknown",
    confirmed_at: new Date().toISOString(),
    blocks: blockRows.filter((b) => b.block).map((b) => ({
      block_id: b.bucket,
      label: b.block.name,
      planned_start: b.startMin != null ? formatMinutesOfDay(b.startMin) : null,
      planned_end: null,
    })),
    entries: blockRows.flatMap((b) => b.rows
      .filter((row) => row.kind !== "note") // notes are markers, not entries
      .map((row) => row.kind === "chore"
      ? ({
        source_type: "chore",
        label: row.chore.title,
        block_id: b.block ? b.bucket : null,
        clock_time: null,
        assignee: null,
        source_ref: { chore_id: row.chore.id, place_id: row.placeId ?? null },
      })
      : ({
        source_type: row.kind === "project" ? "project_node" : "ad_hoc",
        label: row.commitment.source_ref?.title
          ?? (row.kind === "project" ? "project" : "task"),
        block_id: b.block ? b.bucket : null,
        clock_time: null,
        assignee: row.commitment.assignee ?? null,
        source_ref: { commitment_id: row.commitment.id },
      }))).concat(eventEntries.map((e) => ({
        source_type: "event",
        label: e.occ.instanceLabel,
        block_id: null,
        clock_time: e.occ.startTime ?? null,
        assignee: null,
        source_ref: {
          instance_id: e.occ.instanceId,
          occurrence_id: e.occ.occurrenceId ?? null,
          date: e.occ.date,
        },
      }))).concat(placedCommitmentItems.map(commitmentConfirmEntry)),
  });

  const confirmDay = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const doc = buildConfirmedDoc();
      // Validates client-side (ajv) + server-side (pg_jsonschema), rides
      // the outbox. Throws on an invalid doc.
      recordCapture("schedule.confirmed_day", doc, {
        capturedOn: dateISO, subjectType: "schedule_day", subjectId: dateISO,
      });
      setConfirmedDoc(doc);
    } catch (e) {
      console.error("[schedule] confirm failed", e);
    } finally {
      setConfirming(false);
    }
  };

  // Un-confirm (42.3 round 4): tapping the Confirmed chip reverts the day
  // to a draft. Deletes EVERY confirmed_day capture for the date (a
  // re-confirm stacks versions; reverting must clear them all). Online-
  // only, like completeProjectStep — a draft revert must not sit silently
  // in an offline queue while the other device still reads "confirmed".
  // Rides migration 0043's scoped delete policy.
  const unconfirmDay = async () => {
    if (confirming) return;
    if (typeof window !== "undefined"
      && !window.confirm("Revert this day to a draft?")) return;
    setConfirming(true);
    try {
      const { error } = await supabase.from("captures").delete()
        .eq("schema_id", "schedule.confirmed_day")
        .eq("subject_type", "schedule_day")
        .eq("subject_id", dateISO);
      if (error) throw error;
      setConfirmedDoc(null);
    } catch (e) {
      console.error("[schedule] unconfirm failed", e);
    } finally {
      setConfirming(false);
    }
  };

  // Source-changed-after-confirm: today's items vs the confirmed snapshot.
  // Surfaced, never auto-applied.
  const changes = useMemo(() => {
    if (!confirmedDoc) return null;
    const entryKey = (e) => e.source_type === "event"
      ? `e|${e.source_ref?.instance_id ?? ""}|${e.source_ref?.date ?? ""}`
      : e.source_ref?.commitment_id
        ? `a|${e.source_ref.commitment_id}`
        : `c|${e.source_ref?.chore_id ?? ""}|${e.source_ref?.place_id ?? ""}`;
    const rowKey = (row) => row.kind === "chore"
      ? `c|${row.chore.id}|${row.placeId ?? ""}`
      : `a|${row.commitment.id}`;
    const rowLabel = (row) => row.kind === "chore"
      ? row.chore.title : (row.commitment.source_ref?.title ?? "task");
    const confirmedKeys = new Set((confirmedDoc.entries ?? []).map(entryKey));
    const currentKeys = new Set();
    const added = [];
    for (const b of blockRows) {
      for (const row of b.rows) {
        const k = rowKey(row);
        currentKeys.add(k);
        if (!confirmedKeys.has(k)) added.push(rowLabel(row));
      }
    }
    for (const e of eventEntries) {
      const k = `e|${e.occ.instanceId}|${e.occ.date}`;
      currentKeys.add(k);
      if (!confirmedKeys.has(k)) added.push(e.occ.instanceLabel);
    }
    // Project-gap + trailing-overnight items reconcile by commitment id, the
    // same key shape as in-block ad-hoc rows (so a confirmed project/overnight
    // item isn't reported as spuriously removed).
    for (const d of placedCommitmentItems) {
      const k = `a|${d.id}`;
      currentKeys.add(k);
      if (!confirmedKeys.has(k)) {
        added.push(d.source_ref?.title
          ?? (d.source_type === "project_node" ? "project" : "task"));
      }
    }
    const removed = (confirmedDoc.entries ?? [])
      .filter((e) => !currentKeys.has(entryKey(e)))
      .map((e) => e.label);
    const total = added.length + removed.length;
    return total ? { total, added, removed } : null;
  }, [confirmedDoc, blockRows, eventEntries, placedCommitmentItems]);

  // ── Instance overrides + reorder + cross-day move (S6 3/3) ──────────
  // A small drag threshold so a tap on a row never starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // The row currently open in the edit sheet, with the context the sheet +
  // the protection heuristic need. null = closed.
  const [editing, setEditing] = useState(null);
  const openEdit = (row, b, idx) => setEditing({
    row,
    bucket: b.bucket,
    fromBlockName: b.block?.name ?? "Anytime",
    isFirstInBlock: idx === 0,
    currentClockTime: row.edit?.clockTime ?? row.commitment?.clock_time ?? null,
    canMoveDay: row.kind === "adhoc" || row.kind === "project" || !!row.deltaId,
    label: row.kind === "chore"
      ? row.chore.title : (row.commitment.source_ref?.title ?? "task"),
  });

  const bucketName = (id) =>
    id === "anytime" ? "Anytime" : (blocksById.get(id)?.name ?? "a block");

  // Write a change to a row: a DERIVED chore becomes/updates an 'override'
  // commitment (kept in its block unless moved); a commitment-backed row is
  // updated in place. `change` carries only the keys that changed.
  const writeRow = (row, currentBucket, change, entry) => {
    if (row.kind === "chore" && !row.deltaId) {
      const patch = {
        blockId: "toBlockId" in change ? change.toBlockId : currentBucket,
      };
      if ("clockTime" in change) patch.clockTime = change.clockTime;
      if ("order" in change) patch.order = change.order;
      upsertOverride(
        { chore_id: row.chore.id, place_id: row.placeId ?? null }, patch, entry);
    } else {
      const patch = {};
      if ("toBlockId" in change) patch.blockId = change.toBlockId;
      if ("clockTime" in change) patch.clockTime = change.clockTime;
      if ("toDate" in change) patch.runDate = change.toDate;
      if ("order" in change) patch.order = change.order;
      updateDelta(row.deltaId ?? row.commitment.id, patch, entry);
    }
  };

  const applyEdit = (changeIn) => {
    if (!editing) return;
    let change = { ...changeIn };
    // A project-gap target (R5.17) is time-routed: block_id clears and
    // the gap's start rides clockTime, so segmentForStart lands the row
    // in the chosen gap.
    let toLabel = null;
    if (typeof change.toBlockId === "string"
      && change.toBlockId.startsWith("project:")) {
      const t = oneOffTargets.find((x) => x.bucket === change.toBlockId);
      toLabel = t?.label ?? "a project block";
      change.toBlockId = null;
      if (t?.clockTime) change.clockTime = t.clockTime;
    }
    // History copy (round 4): a move reads "Rescheduled from X to Y" —
    // never "Moved"/"Split". X is what the user left (the source block, or
    // the previous set time), Y where it landed; times are 12-hour.
    const parts = [];
    const newTime = change.clockTime ? fmtClock12(change.clockTime) : null;
    if ("toBlockId" in change) {
      parts.push(`Rescheduled from ${editing.fromBlockName} to `
        + (toLabel ?? bucketName(change.toBlockId))
        + (newTime ? ` at ${newTime}` : ""));
    } else if ("clockTime" in change && change.clockTime) {
      const from = editing.currentClockTime
        ? fmtClock12(editing.currentClockTime)
        : editing.fromBlockName;
      parts.push(`Rescheduled from ${from} to ${newTime}`);
    }
    if ("clockTime" in change && !change.clockTime) {
      parts.push("Time cleared");
    }
    if ("toDate" in change) {
      parts.push(`Rescheduled from ${dateISO} to ${change.toDate}`);
    }
    const entry = {
      at: new Date().toISOString(), by: email ?? null,
      summary: parts.join(" · ") || "Edited",
    };
    writeRow(editing.row, editing.bucket, change, entry);
    setEditing(null);
  };

  // (Split block is GONE — 42.3 round 4, NO-LEGACY: the per-block
  // second-sitting bulk move + its sheet were dropped; a per-row Edit
  // covers the rare move, and the history verb is "Rescheduled".)

  // Drag-reorder within a block (silent — no protection): rank the moved row
  // between its new neighbours so only one row is written.
  const onReorder = (b) => ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = b.rows.findIndex((r) => r.key === active.id);
    const to = b.rows.findIndex((r) => r.key === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(b.rows, from, to);
    const a = next[to - 1]?._order;
    const c = next[to + 1]?._order;
    let order;
    if (a != null && c != null) order = (a + c) / 2;
    else if (a != null) order = a + 1;
    else if (c != null) order = c - 1;
    else order = 0;
    const entry = {
      at: new Date().toISOString(), by: email ?? null, summary: "Reordered",
    };
    writeRow(b.rows[from], b.bucket, { order }, entry);
  };

  // ── Non-work time (S7) ─────────────────────────────────────────────
  const [addingTimeOff, setAddingTimeOff] = useState(false);
  const [bufferFor, setBufferFor] = useState(null);

  // ── Edit an event's time from the schedule (S67) ───────────────────
  // The series mutators encode the this/following/all writes; `data.events`
  // is kept live by refdata's realtime channel, so the day re-derives after a
  // write with no local state to thread. `editingEvent` = the occ in the time
  // sheet; `eventScope` = a recurring occ + its patch awaiting a scope pick.
  const { seriesById, updateSeries, splitSeries } = useEventSeries();
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventScope, setEventScope] = useState(null);

  const durationMins = (s, e) => {
    const a = hmToMin(s);
    const b = hmToMin(e);
    return (a == null || b == null || b <= a) ? null : b - a;
  };

  const applyEventTime = async (occ, patch, scope) => {
    const seriesId = occ.instanceId;
    const date = occ.date;
    const s = seriesById.get(seriesId) ?? null;
    const dur = durationMins(patch.startTime, patch.endTime);
    const occRow = {
      series_id: seriesId, occurs_on: date,
      start_time: patch.startTime || null, end_time: patch.endTime || null,
      status: "scheduled",
    };
    try {
      if (scope === "this") {
        await supabase.from("event_occurrences")
          .upsert(occRow, { onConflict: "series_id,occurs_on" });
      } else if (scope === "all") {
        const baseDate = (s?.dtstart ?? `${date}T00:00:00Z`).slice(0, 10);
        const sp = { dtstart: `${baseDate}T${patch.startTime}:00.000Z` };
        if (dur != null) sp.durationMinutes = dur;
        await updateSeries(seriesId, sp);
        if (!s?.rrule) {
          await supabase.from("event_occurrences")
            .upsert(occRow, { onConflict: "series_id,occurs_on" });
        }
      } else if (scope === "following") {
        const sp = { rrule: s?.rrule, dtstart: `${date}T${patch.startTime}:00.000Z` };
        if (dur != null) sp.durationMinutes = dur;
        await splitSeries(seriesId, date, sp);
      }
    } catch (e) { /* surfaced by the offline indicator; refdata re-syncs */ }
  };

  // Save from the time sheet: a recurring occurrence asks for scope first; a
  // one-off (or already-materialised instance) writes its occurrence directly.
  const onEventTimeSave = (patch) => {
    const occ = editingEvent;
    setEditingEvent(null);
    if (occ.recurring) setEventScope({ occ, patch });
    else applyEventTime(occ, patch, "this");
  };

  const rowLabel = (row) => row.kind === "chore"
    ? row.chore.title : (row.commitment.source_ref?.title ?? "task");

  // Accept a needs-cover unit (round 5) — ONE write resolves every block
  // the time off / event overlaps. The card's button is the confirmation.
  const acceptUnitCover = (u) => {
    const at = new Date().toISOString();
    const me = email
      ? (() => {
        const n = String(email).split("@")[0].split("+")[0];
        return n.charAt(0).toUpperCase() + n.slice(1);
      })()
      : null;
    if (u.kind === "event") {
      const entry = {
        at, by: email ?? null,
        summary: `Cover accepted for ${u.label}`,
      };
      addEventCover(u.occ, { by: me, at }, entry);
    } else {
      const entry = {
        at, by: email ?? null,
        summary: `${u.coverer} covers ${u.person}'s time off`,
      };
      acceptCover(u.id, { by: u.coverer, at }, entry);
    }
  };

  // Acknowledge a "Nobody at the farm" group (round 6): nobody can cover,
  // so each underlying unit is marked with an `ack` cover — same write
  // path, no coverer — and every surface reads it as resolved.
  const acknowledgeNobody = (g) => {
    const at = new Date().toISOString();
    for (const u of g.units) {
      const entry = {
        at, by: email ?? null,
        summary: "Nobody at the farm — acknowledged",
      };
      if (u.kind === "event") {
        addEventCover(u.occ, { ack: true, at }, entry);
      } else {
        acceptCover(u.id, { ack: true, at }, entry);
      }
    }
  };

  // Carry-over banner dismissal persists per day on this device (F19) — once
  // dismissed it stays gone across refreshes, re-appearing only on a new day.
  const carryoverKey = `nff:sched:carryover-dismissed:${dateISO}`;
  const [dismissedYesterday, setDismissedYesterday] = useState(false);
  useEffect(() => {
    try {
      setDismissedYesterday(localStorage.getItem(carryoverKey) === "1");
    } catch { setDismissedYesterday(false); }
  }, [carryoverKey]);
  const dismissYesterday = () => {
    setDismissedYesterday(true);
    try { localStorage.setItem(carryoverKey, "1"); } catch { /* ignore */ }
  };
  // The changes-since-confirmed ribbon is dismissible too (F29); dismissing
  // remembers the current change-set signature so it re-surfaces only when the
  // divergence actually changes.
  const [dismissedChangeSig, setDismissedChangeSig] = useState(null);
  // The change-set names are hidden behind an on-demand "Details" toggle (F28)
  // — the strip leads with the count, not an inline list of every name.
  const [showChangeDetail, setShowChangeDetail] = useState(false);

  // ── Conflicts: the one list (S56a/b/c) + double-booking (S58) ───────
  const [showConflicts, setShowConflicts] = useState(false);

  // Every buffer reserving time on the viewed day, with its window — per-day
  // buffers plus templates synthesized onto today's events/blocks (S61 needs
  // the windows to detect a squeeze).
  const activeBufferWindows = useMemo(() => {
    const out = [];
    const labelOf = (buf) => buf.source_ref?.label
      || (buf.source_ref?.target?.label
        ? `${buf.source_ref.target.label} buffer` : "buffer");
    const push = (id, buf, targetBucket) => {
      const w = storedBufferWindow(buf);
      if (w) out.push({ id, label: labelOf(buf), targetBucket, ...w });
    };
    for (const buf of buffers) {
      push(buf.id, buf, buf.source_ref?.target?.kind === "block"
        ? buf.source_ref.target.id : null);
    }
    for (const e of eventEntries) {
      const anchor = {
        startMin: hmToMin(e.occ.startTime), endMin: hmToMin(e.occ.endTime),
      };
      for (const t of buffersForTarget(bufferTemplates, "event", e.occ.instanceId)) {
        const d = deriveTemplateBuffer(t, anchor, dateISO);
        if (d) push(t.id, d, null);
      }
    }
    for (const b of blockRows) {
      if (!b.block) continue;
      const w0 = blockWindow(b.bucket);
      for (const t of buffersForTarget(bufferTemplates, "block", b.bucket)) {
        const d = deriveTemplateBuffer(t, { startMin: w0.start, endMin: w0.end }, dateISO);
        if (d) push(t.id, d, b.bucket);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffers, bufferTemplates, eventEntries, blockRows, dateISO]);

  // Viewed-day conflicts from the real (post-override) block rows: man-down
  // leaks, same-person overlaps, and buffer squeezes. Each carries a jump.
  // Overnight + Project items are EXEMPT (O-B6) by construction: `flat` is
  // built only from `blockRows`, and those items live outside it (project-gap
  // items are pulled from the chore fold; overnight items are their own
  // entries). They never reach man-down / double-book / squeeze.
  const todayConflicts = useMemo(() => {
    const out = [];
    // Round 5 — needs-cover counts as UNITS: one conflict per uncovered
    // time off / event, however many blocks it crosses.
    for (const u of uncoveredUnits) {
      out.push({
        type: "cover", scope: "today",
        bucket: u.blocks[0]?.bucket ?? null, iso: dateISO,
        label: u.kind === "event"
          ? `${u.label} needs cover`
          : `${u.person} off — `
            + `${u.blocks.length} block${u.blocks.length === 1 ? "" : "s"}`
            + " need cover",
        detail: unitTip(u),
      });
    }
    const flat = [];
    for (const b of blockRows) {
      const w = blockWindow(b.bucket);
      for (const row of b.rows) {
        flat.push({
          key: row.key, label: rowLabel(row), assignee: row.assignee ?? null,
          blockStart: w.start, blockEnd: w.end, bucket: b.bucket,
        });
      }
    }
    for (const c of doubleBookConflicts(flat)) {
      out.push({
        type: "double", scope: "today", bucket: c.buckets[0],
        iso: dateISO, assignee: c.assignee,
        label: `${c.assignee} double-booked`,
        detail: c.labels.join(" · "),
      });
    }
    for (const sq of bufferSqueezes(activeBufferWindows, flat)) {
      out.push({
        type: "squeeze", scope: "today", bucket: sq.bucket, iso: dateISO,
        bufferId: sq.bufferId, label: sq.label, detail: sq.detail,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockRows, uncoveredUnits, dateISO, activeBufferWindows]);

  // Buffers squeezed today → an inline warn in their panel (S61).
  const squeezedBufferIds = useMemo(
    () => new Set(todayConflicts.filter((c) => c.type === "squeeze")
      .map((c) => c.bufferId)),
    [todayConflicts]);

  // Horizon scan (next 14 days) for man-down conflicts — driven by reservations
  // read once when the panel opens. Recurring days-off (S46) land here.
  // (Slice 4) `horizon` + `weekTimedDeltas` moved above the `farm` memo —
  // the week identity bars read them.

  const upcomingConflicts = useMemo(() => {
    if (!horizon) return [];
    return scanHorizonConflicts({
      data, fromDate: today, days: HORIZON_DAYS, ruleOpts,
      reservationsByISO: horizon.res, ymd: ymdLocal,
    }).map((c) => ({ ...c, scope: "upcoming", label: c.label }));
  }, [horizon, data, today, ruleOpts]);

  const conflicts = useMemo(
    () => [...todayConflicts, ...upcomingConflicts],
    [todayConflicts, upcomingConflicts]);

  // The one day-load count line (shared verbatim by the desktop header and
  // the phone strip header). Round 6 — the warn badge IS the conflicts
  // entry point now (the toolbar button is gone): it counts every
  // today-conflict, its hover bolds each NAME, and clicking it opens the
  // conflict list.
  const dayLoadSummary = (
    <span className="flex items-center gap-1">
      {nText(dayLoadCounts.chores, "chore")}
      {" · "}{nText(dayLoadCounts.blocks, "block")}
      {dayLoadCounts.projects > 0
        ? ` · ${nText(dayLoadCounts.projects, "project")}` : ""}
      {dayLoadCounts.events > 0
        ? ` · ${nText(dayLoadCounts.events, "event")}` : ""}
      {(farm.warming.warn.length + farm.warming.due.length) > 0 && " · "}
      <WarmingBadge warn={farm.warming.warn} due={farm.warming.due} cue />
      {todayConflicts.length > 0 && (
        <>
          {" · "}
          <Tooltip
            tip={<>
              {uncoveredUnits.map((u, i) => (
                <span key={"u" + i} className="block">
                  <b className="text-fg font-semibold">{unitName(u)}</b>
                  {" — "}{unitWhen(u)}
                </span>
              ))}
              {todayConflicts.filter((c) => c.type !== "cover")
                .map((c, i) => (
                  <span key={"c" + i} className="block">
                    <b className="text-fg font-semibold">{c.label}</b>
                    {c.detail ? ` — ${c.detail}` : ""}
                  </span>
                ))}
            </>}
            className="cursor-pointer"
          >
            <button
              type="button"
              onClick={() => setShowConflicts(true)}
              aria-label="Open the conflict list"
              className="flex flex-col items-center gap-[2px] cursor-pointer"
            >
              <span className="inline-flex items-center gap-0.5 text-warn">
                <AlertTriangle size={14} />
                {todayConflicts.length > 1 && (
                  <span className="font-ui text-[10px] font-semibold leading-none">
                    ×{todayConflicts.length}
                  </span>
                )}
              </span>
              <span className="w-full border-b border-dotted border-faint" />
            </button>
          </Tooltip>
        </>
      )}
      {coveredUnits.length > 0 && (
        <>
          {" · "}
          <CoveredBadge
            size={14}
            cue
            tip={coveredUnits.map((u, i) => (
              <span key={i} className="block">
                <b className="text-fg font-semibold">{unitName(u)}</b>
                {" — "}{unitWhen(u)}
                {u.cover?.by ? ` — ${u.cover.by} covers`
                  : u.cover?.ack ? " — acknowledged" : " — covered"}
                {u.cover?.at ? ` · ${fmtStamp(u.cover.at)}` : ""}
              </span>
            ))}
          />
        </>
      )}
    </span>
  );

  // Per-day conflict counts for the week pane (F17) — for EVERY day of the
  // displayed week, so a triangle shows without first selecting the day. Uses
  // `dayConflictCount` (the focal day's place-expanded rollup engine: man-down
  // against each day's reservations + double-book, with block-move/reassign
  // overrides applied so a relocated chore's conflict is caught), fed the
  // horizon query's reservations + overrides. The focal day is overridden with
  // its live `todayConflicts` count (which additionally catches buffer
  // squeezes — those stay focal-only).
  const weekConflictsByISO = useMemo(() => {
    const m = new Map();
    if (horizon) {
      for (const d of weekDays(today)) {
        const iso = ymdLocal(d);
        const n = dayConflictCount({
          data, date: d, ruleOpts, choreCtx, completions,
          reservations: horizon.res.get(iso) ?? [],
          overrides: horizon.ovr.get(iso) ?? [],
        });
        if (n > 0) m.set(iso, n);
      }
    }
    if (todayConflicts.length) m.set(dateISO, todayConflicts.length);
    else m.delete(dateISO);
    return m;
  }, [horizon, today, data, ruleOpts, choreCtx, completions,
    todayConflicts, dateISO]);

  // Per-day COVERED time offs for the week pane (round 5) — the muted
  // circle-alert beside/instead of the conflict triangle.
  const weekCoveredByISO = useMemo(() => {
    const m = new Map();
    if (horizon) {
      for (const d of weekDays(today)) {
        const iso = ymdLocal(d);
        const units = dayCoveredUnits({
          date: d, blocks,
          reservations: horizon.res.get(iso) ?? [],
        });
        if (units.length) {
          m.set(iso, units.map(
            (u) => ({ by: u.by, ack: u.ack, label: u.label })));
        }
      }
    }
    return m;
  }, [horizon, today, blocks]);

  // Per-day warming (F24/F25) for the week pane — a ClockAlert marker on every
  // day that has a warn/due chore, mirroring `weekConflictsByISO`. Reuses the
  // same `dayWarming` the focal day-load reads, so the week marker can't
  // disagree with the day it opens to. Keyed iso → { warn:[…], due:[…] }.
  const weekWarmingByISO = useMemo(() => {
    const m = new Map();
    for (const d of weekDays(today)) {
      const w = dayWarming({ data, date: d, ruleOpts, choreCtx, completions });
      if (w.warn.length || w.due.length) m.set(ymdLocal(d), w);
    }
    return m;
  }, [today, data, ruleOpts, choreCtx, completions]);

  // Week-pane overnight marker (Moon): a night spans two calendar days, so
  // an overnight marks BOTH days it touches. Round 4 — EVERY night touching
  // the viewed week is scanned (the Moon used to derive from the focal
  // day's loaded entries only, so it appeared once an overnight day was
  // SELECTED, not before). Reads `weekTimedDeltas` (declared above the
  // `farm` memo — the week identity bars share it).
  const weekOvernightISOs = useMemo(() => {
    const s = new Set();
    // The focal day's LIVE overnight entries — instant on edits (the week
    // scan below lags its fetch by a day-change).
    for (const e of overnightEntries) {
      if (!e.count) continue;
      if (e.side === "lead") {
        s.add(ymdLocal(yesterday));
        s.add(ymdLocal(today));
      } else {
        s.add(ymdLocal(today));
        s.add(ymdLocal(tomorrow));
      }
    }
    // Each night (n → n+1) with a timed item in its overnight window Moons
    // both days. (Approximation: a project-gap placement in the dawn band
    // would count here — the focal day's exact overlap rule needs each
    // day's gaps, which aren't derived week-wide. Gaps sit between chore
    // blocks, outside the overnight bands, so in practice they don't hit.)
    const ds = weekDays(today);
    for (let i = -1; i <= 6; i++) {
      const n = new Date(ds[0]);
      n.setDate(n.getDate() + i);
      const n1 = new Date(n);
      n1.setDate(n1.getDate() + 1);
      const win = overnightWindow(n, n1, blocks);
      if (!win) continue;
      const evening = (weekTimedDeltas.get(ymdLocal(n)) ?? []).some((d) =>
        inOvernight(win, hmToMin(d.clock_time), "evening"));
      const dawn = (weekTimedDeltas.get(ymdLocal(n1)) ?? []).some((d) =>
        inOvernight(win, hmToMin(d.clock_time), "dawn"));
      if (evening || dawn) {
        s.add(ymdLocal(n));
        s.add(ymdLocal(n1));
      }
    }
    return s;
  }, [overnightEntries, weekTimedDeltas, blocks, yesterday, today, tomorrow]);

  // Jump to a conflict (S56b): focus its block on the viewed day, or open the
  // day it falls on first. On phones the focused block renders below the
  // day-strip, off-screen, so focusing alone looked like nothing happened
  // (F60) — scroll the focused detail into view once it has committed. Two
  // frames so the newly-focused block has mounted before we scroll to it.
  const jumpToConflict = (c) => {
    if (c.scope === "upcoming" && c.date) {
      goToDay(new Date(c.date), c.bucket ?? "overview");
    } else if (c.bucket) {
      setFocusSel(c.bucket);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        focusRef.current?.scrollIntoView?.({
          behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center",
        });
      }));
    }
    setShowConflicts(false);
  };

  const loading = blocksLoading || sitesLoading || completions.loading;

  // Full month name (round 5) — the subheader date never abbreviates.
  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const dateShort = today.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  // The center column's h2 tracks the zoom: the day, the week's range, or
  // the month (round 4 — the date IS the center heading now; "Schedule" +
  // the zoom tabs live in the one page-header row above the workbench).
  const centerHeading = viewMode === "day" ? dateLabel
    : viewMode === "review" ? "Looking back"
    : viewMode === "month"
      ? today.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : (() => {
        const ds = weekDays(today);
        const a = ds[0], b = ds[6];
        const sameMonth = a.getMonth() === b.getMonth();
        const opt = { month: "short", day: "numeric" };
        return a.toLocaleDateString("en-US", opt) + " – "
          + b.toLocaleDateString("en-US",
            sameMonth ? { day: "numeric" } : opt);
      })();
  // The day's events surface in a sub-line under the date (F15) — e.g. a
  // market day was happening but nothing in the header said so.
  const eventsSub = (() => {
    if (viewMode !== "day" || !eventEntries.length) return null;
    const labels = eventEntries.map((e) => e.occ.instanceLabel);
    const shown = labels.slice(0, 3).join(" · ");
    const more = labels.length > 3 ? ` +${labels.length - 3} more` : "";
    return shown + more;
  })();

  // The focused timeline entry (a block or an event), or null = overview.
  const focusEntry = focus == null
    ? null : (timeline.find((e) => e.bucket === focus) ?? null);

  // Round 4 — the "+ Add" menu (and the desktop toolbar) hold the two
  // context-anchored adds too, so the block card / project block carry no
  // add chrome of their own. Each resolves a default anchor — the OPEN
  // block when it fits, else the day's first eligible — so the menu needs
  // no target-picker step: a step needs a project gap; a buffer needs an
  // activity anchor (a chore block or an event). null = no eligible
  // target today, and the entry doesn't render.
  const addStepTarget = focusEntry?.kind === "projectblock"
    ? focusEntry : (projectEntries[0] ?? null);
  // The quick-add's payload (round 5): the next highest-priority ranked
  // step not already placed on this day. Both the "+ Add" menu's project
  // entry and the project block's in-card button grab exactly this.
  const placedStepIds = useMemo(() => new Set(
    deltas.filter((d) => d.source_type === "project_node")
      .map((d) => d.source_ref?.step_id).filter(Boolean)), [deltas]);
  const nextStep = useMemo(
    () => nextRankedStep(data.projects, placedStepIds),
    [data, placedStepIds]);
  const bufferTarget = (() => {
    if (focusEntry?.kind === "event") {
      const occ = focusEntry.occ;
      return {
        target: { kind: "event", id: occ.instanceId, label: occ.instanceLabel },
        label: occ.instanceLabel,
        startMin: hmToMin(occ.startTime),
        endMin: hmToMin(occ.endTime),
      };
    }
    const b = (focusEntry?.kind === "block" && focusEntry.block
      && focusEntry.startMin != null)
      ? focusEntry
      : blockRows.find((x) => x.block && x.startMin != null);
    if (!b) return null;
    const w = blockWindow(b.bucket);
    return {
      target: { kind: "block", id: b.bucket, label: b.block.name },
      label: b.block.name,
      startMin: w.start, endMin: w.end,
    };
  })();

  return (
    <div className="max-w-2xl lg:max-w-[1120px] mx-auto">
     {/* Page header (round 4): the Schedule h1 and the Day/Week/Month/
         Review tabs share ONE full-width row — above the whole workbench,
         spine included — closed by the page hairline (the PageHeader
         decoration, inlined). Top-level so the tabs stay put when the
         day-spine appears/disappears with the view mode (F20). The date
         is the center column's h2 below. */}
     <div className="flex items-end justify-between gap-3 mb-5 pb-3.5 border-b border-line">
       <h1 className="font-heading text-[32px] font-bold -tracking-[0.02em] m-0 text-fg leading-none">
         Schedule
       </h1>
       <div className="hidden lg:flex items-center gap-1 font-ui text-[12px]">
         {[["day", "Day"], ["week", "Week"], ["month", "Month"],
           ["review", "Review"]].map(([m, label]) => (
           <button
             key={m}
             type="button"
             onClick={() => setViewMode(m)}
             className={
               "px-3 py-1 border border-transparent cursor-pointer transition-colors "
               + (viewMode === m
                 ? "bg-row-active text-fg font-medium"
                 : "text-faint hover:bg-row-hover hover:text-dim")
             }
           >
             {label}
           </button>
         ))}
       </div>
     </div>
     <div className="lg:flex lg:items-start">
      {/* Desktop load-spine — the day's shape AND the navigator (Day zoom). */}
      {viewMode === "day" && (
        <DayRailSpine
          blocks={navSegments}
          focus={focus}
          nowBucket={nowBucket}
          nowMin={viewingToday ? nowMin : null}
          nowEdge={nowEdge}
          onPick={pickBlock}
        />
      )}

      <div className="flex-1 min-w-0 pb-24 lg:px-8">
      {/* The date IS the center heading (round 4) — h2 under the page's
          Schedule h1; the day's events ride its sub-line (F15). */}
      {/* mb-4 (was 5) — round 6: the day load sat too far below this. */}
      <div className="mb-4">
        <h2 className="font-heading text-[22px] font-semibold -tracking-[0.01em] m-0 text-fg">
          {centerHeading}
        </h2>
        {eventsSub && (
          <div className="text-[13px] text-dim mt-1 leading-snug">
            {eventsSub}
          </div>
        )}
        {/* Round 6 — phone day navigation (the desktop has This Week +
            the week arrows; the phone had NO way off today): previous /
            next day arrows + a native date input + a Today jump. */}
        {viewMode === "day" && (
          <div className="lg:hidden mt-2 flex items-center gap-1.5">
            {[[-1, "Previous day", ChevronLeft],
              [1, "Next day", ChevronRight]].map(([d, label, Icon]) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => {
                  const t = new Date(today);
                  t.setDate(t.getDate() + d);
                  goToDay(t);
                }}
                className="p-1.5 border border-line text-dim hover:bg-row-hover hover:text-fg active:bg-row-active cursor-pointer"
              >
                <Icon size={14} />
              </button>
            ))}
            <input
              type="date"
              value={dateISO}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split("-").map(Number);
                if (y && m && d) goToDay(new Date(y, m - 1, d));
              }}
              aria-label="Go to date"
              className="bg-bg border border-line text-fg text-[12px] px-2 py-1 font-[inherit] [font-variant-numeric:tabular-nums]"
            />
            {!viewingToday && (
              <button
                type="button"
                onClick={() => goToDay(new Date())}
                className="text-[12px] font-medium text-accent px-2 py-1 border border-line hover:bg-row-hover active:bg-row-active cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      {viewMode === "week" ? (
        <WeekView
          week={farm.week}
          todayISO={realTodayISO}
          selectedISO={dateISO}
          confirmedDays={confirmedDays}
          reservations={weekReservations}
          ymd={ymdLocal}
          onPickDay={openDay}
          onPickBlock={openDayBlock}
        />
      ) : viewMode === "month" ? (
        <MonthView
          month={month}
          todayISO={realTodayISO}
          selectedISO={dateISO}
          confirmedDays={confirmedDays}
          ymd={ymdLocal}
          onPickDay={openDay}
        />
      ) : viewMode === "review" ? (
        <ScheduleReview drift={drift} reviews={reviews} splitDays={DRIFT_SPLIT} />
      ) : (
       <>
      {/* Day load — the count-driven silhouette, promoted to the shared
          LoadSpine reading farmLoad (Round-3 demote). lg-only. */}
      {/* Chromeless day load (round 4): bg-bg, no horizontal padding (the
          bars stretch the column's full width), separated from what
          follows by the page's standard hairline divider. Round 6 — no
          top padding (the heading's own margin is the whole gap) and the
          divider gets EVEN air: pb-4 above the line, mt-4 on whatever
          follows it. */}
      <div className="hidden lg:block bg-bg pb-4 border-b border-line">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            Day load
          </span>
          {/* F24/F25 — the binary warn/due ClockAlert sits INLINE in the
              count run, after a "·"; hover names each warming/due chore. */}
          <span className="flex items-center gap-1 font-ui text-[10px] text-faint [font-variant-numeric:tabular-nums]">
            {dayLoadSummary}
          </span>
        </div>
        {/* The current bar carries the now-ring (the day-strip's offset
            inset ring). Resolved by WINDOW across kinds (round 4): when
            now sits inside a project gap the PROJECT bar rings —
            nowBucket alone is chore-block-centric and pointed the ring
            at the previous chore bar. */}
        <LoadSpine
          blocks={farm.spine.filter((b) => b.startMin != null)}
          nowId={viewingToday
            ? (farm.spine.find((b) =>
              b.startMin != null && nowMin >= b.startMin
              && nowMin < (b.endMin ?? b.startMin))?.blockId ?? nowBucket)
            : null}
          nowEdge={nowEdge}
          conflictIds={conflictBarIds}
          events={eventEntries
            .filter((e) => e.startMin != null)
            .map((e) => ({
              id: e.bucket,
              label: e.occ.instanceLabel,
              startMin: e.startMin,
              endMin: e.endMin,
              startLabel: fmtClock12(e.occ.startTime),
              endLabel: fmtClock12(e.occ.endTime),
            }))}
        />
      </div>
      {/* Phone day-strip — the navigable time axis (lg:hidden), ABOVE
          the confirm/+ Add row so the phone order matches the desktop
          (round 5). */}
      {!loading && timeline.length > 0 && (
        <DayStrip
          key={dateISO}
          blocks={navSegments}
          focus={focus}
          nowBucket={nowBucket}
          nowEdge={nowEdge}
          summary={dayLoadSummary}
          onPick={pickBlock}
          onWholeDay={showOverview}
        />
      )}

      {/* Source-changed-after-confirm strip — informs, never auto-applies. A
          passive AlertStrip leading with the count; the per-item names sit
          behind an on-demand "Details" toggle, not an inline list (F28).
          Dismiss remembers the current change-set signature so it re-surfaces
          only when the divergence actually changes. */}
      {(() => {
        const sig = changes
          ? `${changes.total}|${changes.added.join(",")}|${changes.removed.join(",")}`
          : null;
        if (!changes || sig === dismissedChangeSig) return null;
        const names = [
          ...changes.added.map((t) => "+ " + t),
          ...changes.removed.map((t) => "− " + t),
        ];
        return (
          <AlertStrip
            className="mt-3 lg:mt-4 mb-3"
            action={names.length > 0 ? (showChangeDetail ? "Hide" : "Details") : undefined}
            onAct={() => setShowChangeDetail((v) => !v)}
            onDismiss={() => setDismissedChangeSig(sig)}
          >
            <span className="font-medium text-fg">
              {changes.total} change{changes.total === 1 ? "" : "s"} since
              you confirmed.
            </span>
            {showChangeDetail && names.length > 0 && (
              <span className="block mt-1 text-faint">
                {names.join(" · ")}
              </span>
            )}
          </AlertStrip>
        );
      })()}

      <div className="px-1 mt-3 lg:mt-4 mb-3 flex items-center justify-between gap-3">
        {/* ONE toolbar for both breakpoints (round 5): the desktop now
            matches the mobile pattern — Confirm (primary) at the left,
            the consolidated "+ Add" menu at the right, space-between.
            Round 6 — the conflicts entry moved into the day-load badge. */}
        {confirmedDoc ? (
          <Tooltip tip="Tap to revert this day to a draft">
            <button
              type="button"
              onClick={unconfirmDay}
              disabled={confirming}
              className="text-[12px] font-medium px-3 py-1.5 border border-resolved text-resolved inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors hover:bg-row-active disabled:opacity-50"
            >
              <Check size={13} strokeWidth={3} /> Confirmed
              {fmtStamp(confirmedDoc.confirmed_at) && (
                <span className="font-normal opacity-80 [font-variant-numeric:tabular-nums]">
                  {fmtStamp(confirmedDoc.confirmed_at)}
                </span>
              )}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={confirmDay}
            disabled={confirming || loading || timeline.length === 0}
            className="text-[12px] font-medium px-3 py-1.5 bg-accent text-on-accent border border-accent disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {viewingToday ? "Confirm today" : `Confirm ${dateLabel}`}
          </button>
        )}
        <div className="flex items-center gap-2">
        <OutboxIndicator />
        {/* Round 6 — the toolbar conflicts button is GONE: the day-load
            summary's warn badge is the one conflicts entry point. */}
        <div className="relative">
          {/* Hover/press must actually READ (round 4): row-hover is a 9%
              tint — imperceptible on the white menu surface — so both the
              button and the items step straight to row-active (16%), and
              the button's border warms to accent on hover. */}
          <button
            type="button"
            onClick={() => setShowAddMenu((s) => !s)}
            aria-expanded={showAddMenu}
            className={
              "text-[12px] font-medium inline-flex items-center gap-1 "
              + "px-3 py-1.5 border cursor-pointer transition-colors "
              + (showAddMenu
                ? "border-accent-deep bg-row-active text-accent"
                : "border-line text-accent hover:bg-row-active "
                  + "hover:border-accent active:bg-row-active")
            }
          >
            <Plus size={14} /> Add
          </button>
          {showAddMenu && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowAddMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-44 border border-line bg-surface shadow-md">
                {[
                  { label: "Add chore", icon: Plus,
                    act: () => setPicking(true) },
                  { label: "Add task", icon: Plus,
                    act: () => setAddingTask(true) },
                  // Round 5 — "Add project step" quick-adds the NEXT
                  // highest-priority ranked step into the anchored gap
                  // (the open project block, else the day's first);
                  // hidden when there's no gap or nothing queued.
                  ...(addStepTarget && nextStep ? [{
                    label: "Add project step", icon: Plus,
                    act: () => addProject(
                      nextStep, null, null,
                      minToHM(addStepTarget.startMin)) }] : []),
                  ...(bufferTarget ? [{
                    label: "Add buffer", icon: Timer,
                    act: () => setBufferFor(bufferTarget) }] : []),
                  { label: "Time off", icon: Ban,
                    act: () => setAddingTimeOff(true) },
                ].map(({ label, icon: Icon, act }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setShowAddMenu(false); act(); }}
                    className="w-full text-left text-[12px] font-medium text-fg inline-flex items-center gap-2 px-3 py-2.5 border-b border-line last:border-b-0 hover:bg-row-active active:bg-row-active cursor-pointer"
                  >
                    <Icon size={14} className="text-accent" /> {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* F58 — the one-off task entry, at the top with a block selector
          defaulting to the now block (today) or the day's first. */}
      {addingTask && (
        <AddTaskBar
          targets={oneOffTargets}
          defaultTarget={
            (viewingToday
              && oneOffTargets.some((t) => t.bucket === nowBucket)
              ? nowBucket : null)
            ?? oneOffTargets[0]?.bucket ?? null
          }
          onAdd={(title, bucket) => {
            // A project-gap target rides clockTime (time-routed into the
            // gap); a chore block rides its block id (round 4).
            const t = oneOffTargets.find((x) => x.bucket === bucket);
            if (t?.clockTime) addTask(title, null, null, null, t.clockTime);
            else addTask(title, bucket);
          }}
          onClose={() => setAddingTask(false)}
        />
      )}

      {/* Yesterday's unfinished musts (S12) — only when building today. A
          passive count strip (F28), no per-item names. */}
      {viewMode === "day" && !dismissedYesterday && yesterdayMusts.count > 0 && (
        <AlertStrip className="mb-3" onDismiss={dismissYesterday}>
          <span className="font-medium text-fg">
            Yesterday — {yesterdayMusts.count} must-do
            {yesterdayMusts.count === 1 ? " chore" : " chores"} unfinished.
          </span>
        </AlertStrip>
      )}

      {/* Non-work time (S7) + buffers (S53) — the day's reserved time as a
          compact strip. Buffers carry a Timer glyph; tapping one opens its
          activity so its checklist is reachable. */}
      {(reservations.length > 0 || buffers.length > 0) && (
        <ul className="px-1 mb-3 flex flex-wrap gap-2">
          {windows.map((w) => (
            <li key={w.id}
              className="inline-flex items-center gap-1.5 text-[11px] text-dim border border-line px-2 py-0.5">
              <Ban size={11} className="shrink-0 text-faint" />
              <span className="font-medium text-fg">{w.assignee}</span>
              <span>
                {w.label
                  ? w.label
                  : (w.kind === "day_off" ? "off all day"
                    : `${formatMinutesOfDay(w.startMin)}–${formatMinutesOfDay(w.endMin)}`)}
              </span>
              {w.series && (
                <Repeat size={10} className="shrink-0 text-faint"
                  aria-label="Recurring" />
              )}
              <button type="button" onClick={() => removeDelta(w.id)}
                className="shrink-0 text-faint hover:text-warn" aria-label="Remove this day">
                <X size={12} />
              </button>
              {w.series && (
                <button type="button"
                  onClick={() => removeReservationSeries(w.series)}
                  className="shrink-0 text-faint hover:text-warn"
                  aria-label="Remove the whole series">
                  <CalendarX size={12} />
                </button>
              )}
            </li>
          ))}
          {buffers.map((buf) => (
            <li key={buf.id}
              className="inline-flex items-center gap-1.5 text-[11px] text-dim border border-line border-dashed px-2 py-0.5">
              <Timer size={11} className="shrink-0 text-faint" />
              <span className="truncate max-w-[160px]">
                {describeBuffer(buf, formatMinutesOfDay)}
              </span>
              <button type="button" onClick={() => removeDelta(buf.id)}
                className="shrink-0 text-faint hover:text-warn" aria-label="Remove buffer">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Needs-cover cards (round 5): ONE per uncovered time off / event,
          above the block header row, below the confirm/+ Add row. The
          button is the single confirmation — accepting covers EVERY
          overlapped block at once. Round 6: units that overlap across
          BOTH of us collapse into one "Nobody at the farm" card whose
          confirmation is just "Acknowledged". */}
      {viewMode === "day" && coverGroups.nobody.map((g) => (
        <NobodyCard
          key={g.id}
          group={g}
          dateShort={dateShort}
          onAck={() => acknowledgeNobody(g)}
        />
      ))}
      {viewMode === "day" && coverGroups.singles.map((u) => (
        <NeedsCoverCard
          key={u.id}
          unit={u}
          dateShort={dateShort}
          onCover={() => acceptUnitCover(u)}
        />
      ))}

      {loading ? (
        <div className="px-4 py-10 text-center text-dim text-sm">Loading the day…</div>
      ) : timeline.length === 0 ? (
        <div className="border border-dashed border-line mt-3">
          <div className="px-4 py-8 text-center text-dim text-sm">
            Nothing on the schedule today. Add a chore or a one-off task
            from the toolbar above.
          </div>
        </div>
      ) : focus == null ? (
        /* ── Whole-day overview agenda (collapse-all / nothing focused) ── */
        <ol className="border border-line divide-y divide-line mt-3 lg:mt-0">
          {timeline.map((entry) => {
            if (entry.kind === "event") {
              const occ = entry.occ;
              const sm = hmToMin(occ.startTime);
              return (
                <li key={entry.bucket}>
                  <button
                    type="button"
                    onClick={() => pickBlock(entry.bucket)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-row-hover cursor-pointer"
                  >
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: T.cat[occ.kindId] || T.cat.default }} />
                    <span className="flex-1 min-w-0 truncate text-[14px] text-fg">
                      {occ.instanceLabel}
                    </span>
                    <span className="shrink-0 text-[12px] text-dim [font-variant-numeric:tabular-nums]">
                      {sm == null ? "all day" : formatMinutesOfDay(sm)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-faint" />
                  </button>
                </li>
              );
            }
            if (entry.kind === "projectblock") {
              const free = whoFreeLabel(entry.who);
              const range = formatMinutesOfDay(entry.startMin)
                + "–" + formatMinutesOfDay(entry.endMin);
              // The sub-line names what's planned: placed items (with a done
              // tally), else the passive "nothing planned" note.
              const sub = entry.items.length
                ? (entry.items[0].source_ref?.title ?? "1 item")
                  + (entry.items.length > 1
                    ? ` +${entry.items.length - 1} more` : "")
                : null;
              return (
                <li key={entry.bucket}>
                  <button
                    type="button"
                    onClick={() => pickBlock(entry.bucket)}
                    className={
                      "w-full flex items-center gap-3 px-4 py-3 text-left "
                      + "hover:bg-row-hover cursor-pointer "
                      + (entry.allDone ? "opacity-60" : "")
                    }
                  >
                    <KindBadge kind="project" size={16} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-fg truncate">
                        Project · {range}
                      </span>
                      {sub ? (
                        <span className="block text-[12px] text-faint truncate">
                          {sub}
                        </span>
                      ) : (
                        <span className="block text-[12px] text-faint italic">
                          free — nothing planned
                        </span>
                      )}
                    </span>
                    {entry.count > 0 && (
                      <span className="shrink-0 text-[12px] text-dim [font-variant-numeric:tabular-nums]">
                        {entry.allDone ? "done" : `${entry.done}/${entry.count}`}
                      </span>
                    )}
                    {free.text && (
                      <span className={
                        "shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full "
                        + "[font-variant-numeric:tabular-nums] "
                        + (free.loud
                          ? "bg-project/20 text-project font-semibold ring-1 ring-project/40"
                          : "border border-project/50 text-project")
                      }>
                        {free.text}
                      </span>
                    )}
                    <ChevronRight size={16} className="shrink-0 text-faint" />
                  </button>
                </li>
              );
            }
            if (entry.kind === "overnightblock") {
              const Icon = entry.side === "lead"
                ? ClockArrowLeft : ClockArrowRight;
              const sub = entry.loading && entry.count === 0
                ? "syncing…"
                : entry.count > 0
                  ? (entry.items[0].source_ref?.title ?? "1 item")
                    + (entry.count > 1 ? ` +${entry.count - 1} more` : "")
                  : null;
              return (
                <li key={entry.bucket}>
                  <button
                    type="button"
                    onClick={() => pickBlock(entry.bucket)}
                    className={
                      "w-full flex items-center gap-3 px-4 py-3 text-left "
                      + "hover:bg-row-hover cursor-pointer "
                      + (entry.allDone ? "opacity-60" : "")
                    }
                  >
                    <Icon size={16} className="shrink-0 text-accent-deep" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-fg truncate">
                        Overnight · {entry.rangeLabel}
                      </span>
                      {sub ? (
                        <span className={
                          "block text-[12px] truncate "
                          + (sub === "syncing…"
                            ? "text-faint italic" : "text-faint")
                        }>
                          {sub}
                        </span>
                      ) : null}
                    </span>
                    {entry.countsTonight && entry.count > 0 && (
                      <span className="shrink-0 text-[11px] text-faint">
                        counts tonight
                      </span>
                    )}
                    {entry.count > 0 && (
                      <span className="shrink-0 text-[12px] text-dim [font-variant-numeric:tabular-nums]">
                        {entry.allDone ? "done" : `${entry.done}/${entry.count}`}
                      </span>
                    )}
                    <ChevronRight size={16} className="shrink-0 text-faint" />
                  </button>
                </li>
              );
            }
            const b = entry;
            const { done, total } = countByBucket.get(b.bucket) ?? { done: 0, total: 0 };
            const allDone = total > 0 && done === total;
            const isNow = b.bucket === nowBucket;
            const nowHere = isNow && viewingToday;
            return (
              <li key={b.bucket} ref={isNow ? focusRef : null}>
                <button
                  type="button"
                  onClick={() => pickBlock(b.bucket)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer "
                    + (nowHere ? "bg-accent/[0.08] " : "hover:bg-row-hover ")
                    + (allDone ? "opacity-60" : "")
                  }
                >
                  <KindBadge kind="chore" size={16} title="Chores" />
                  <span className="flex-1 min-w-0 truncate text-[14px] text-fg">
                    {b.block?.name ?? "Anytime"}
                  </span>
                  {nowHere && <NowTag />}
                  <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                    {allDone ? "done" : `${done}/${total}`}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-faint" />
                </button>
              </li>
            );
          })}
        </ol>
      ) : focusEntry?.kind === "event" ? (
        /* ── One event's detail ── */
        <ol className="border border-line mt-3 lg:mt-0">
          <EventEntry occ={focusEntry.occ} isOpen onToggle={showOverview}
            buffers={buffersForActivity("event", focusEntry.occ.instanceId, {
              startMin: hmToMin(focusEntry.occ.startTime),
              endMin: hmToMin(focusEntry.occ.endTime),
            })}
            onToggleBufferItem={onBufferToggle}
            onRemoveBuffer={onBufferRemove}
            onEditTime={setEditingEvent}
            squeezedIds={squeezedBufferIds} />
        </ol>
      ) : focusEntry?.kind === "overnightblock" ? (
        /* ── The Overnight block's detail — items only, no rounds / seal,
              exempt from conflict chrome; ticking toggles the one shared row
              that shows on both day pages (O11). Not pickable for adds (O7). */
        <div ref={focusRef} className="border border-line mt-3 lg:mt-0">
          {(() => {
            const b = focusEntry;
            const Icon = b.side === "lead" ? ClockArrowLeft : ClockArrowRight;
            // project_node items write through to their step; ad_hoc toggle
            // their own commitment state (each by its kind).
            const toggleItem = (id, done) => {
              setDone(id, done);
              const it = b.items.find((d) => d.id === id);
              const stepId = it?.source_ref?.step_id;
              if (it?.source_type === "project_node" && stepId) {
                completeProjectStep(stepId, done);
              }
            };
            return (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-row-active">
                  <Icon size={18} className="shrink-0 text-accent-deep" />
                  <span className="flex-1 min-w-0 leading-snug font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
                    Overnight · {b.rangeLabel}
                  </span>
                  {b.countsTonight && b.count > 0 && (
                    <span className="shrink-0 text-[11px] text-faint">
                      counts tonight
                    </span>
                  )}
                  {b.count > 0 && (
                    <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                      {b.allDone ? "done" : `${b.done}/${b.count}`}
                    </span>
                  )}
                </div>
                {b.count > 0 ? (
                  <ul>
                    {b.items.map((d) => (
                      <AdHocRow
                        key={d.id}
                        commitment={d}
                        onToggle={toggleItem}
                        onRemove={removeDelta}
                        edit={{ history: d.history }}
                      />
                    ))}
                  </ul>
                ) : b.loading ? (
                  <div className="px-4 py-3 border-b border-line text-[13px] text-faint italic">
                    syncing…
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-line text-[13px] text-faint italic">
                    nothing overnight
                  </div>
                )}
                <div className="px-4 py-2 text-[11px] text-faint">
                  Shows on both nights · ticking syncs the one item.
                </div>
              </>
            );
          })()}
        </div>
      ) : focusEntry?.kind === "projectblock" ? (
        /* ── One Project block's detail (no rounds / seal — items only) ── */
        <div ref={focusRef} className="border border-line mt-3 lg:mt-0">
          {(() => {
            const b = focusEntry;
            const free = whoFreeLabel(b.who);
            const range = formatMinutesOfDay(b.startMin)
              + "–" + formatMinutesOfDay(b.endMin);
            // Complete a placed item — ad_hoc toggles its commitment state;
            // project_node also writes through to the underlying step (P14).
            const toggleItem = (id, done) => {
              setDone(id, done);
              const it = b.items.find((d) => d.id === id);
              const stepId = it?.source_ref?.step_id;
              if (it?.source_type === "project_node" && stepId) {
                completeProjectStep(stepId, done);
              }
            };
            return (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-row-active">
                  {/* P badge, not the folder glyph (round 4) — the same
                      identity mark the sidebars wear; no hover detail in
                      the center pane. */}
                  <KindBadge kind="project" size={18} />
                  {/* Round 6 — headers WRAP (content never truncates). */}
                  <span className="flex-1 min-w-0 leading-snug font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
                    Project · {range}
                  </span>
                  {b.count > 0 && (
                    <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                      {b.allDone ? "done" : `${b.done}/${b.count}`}
                    </span>
                  )}
                  {free.text && (
                    <span className={
                      "shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full "
                      + "[font-variant-numeric:tabular-nums] "
                      + (free.loud
                        ? "bg-project/20 text-project font-semibold ring-1 ring-project/40"
                        : "border border-project/50 text-project")
                    }>
                      {free.text}
                    </span>
                  )}
                </div>
                {b.items.length > 0 && (
                  <ul>
                    {b.items.map((d, di) => (
                      <AdHocRow
                        key={d.id}
                        commitment={d}
                        onToggle={toggleItem}
                        onRemove={removeDelta}
                        onEdit={() => openEdit({
                          kind: d.source_type === "project_node"
                            ? "project" : "adhoc",
                          key: d.id,
                          commitment: d,
                          edit: {
                            clockTime: d.clock_time, history: d.history,
                          },
                        }, {
                          bucket: b.bucket,
                          block: {
                            name: "Project · "
                              + formatMinutesOfDay(b.startMin),
                          },
                        }, di)}
                        edit={{ history: d.history }}
                      />
                    ))}
                  </ul>
                )}
                {b.items.length === 0 && !nextStep && (
                  <div className="px-4 py-3 border-b border-line text-[13px] text-faint italic">
                    free — nothing planned
                  </div>
                )}
                {/* R5.16 — the quick-add: one tap places the next
                    highest-priority ranked step into THIS gap. */}
                {nextStep && (
                  <button
                    type="button"
                    onClick={() => addProject(
                      nextStep, null, null, minToHM(b.startMin))}
                    className="w-full flex items-center gap-2 px-4 py-3 border-b border-line text-[13px] font-medium text-project hover:bg-row-hover cursor-pointer"
                  >
                    <CornerDownRight size={15} className="shrink-0" />
                    {/* Round 6 — the link WRAPS; the step title is
                        content, never chrome. */}
                    <span className="min-w-0 text-left leading-snug">
                      Add next task — {nextStep.title}
                    </span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      ) : focusEntry ? (
        /* ── One block's detail (master-detail; never scroll past others) ── */
        <div ref={focusRef} className="border border-line mt-3 lg:mt-0">
          {(() => {
            const b = focusEntry;
            const { done, total } = countByBucket.get(b.bucket) ?? { done: 0, total: 0 };
            const allDone = total > 0 && done === total;
            const nowHere = b.bucket === nowBucket && viewingToday;
            return (
              <>
                <div className={
                  "flex items-center gap-3 px-4 py-3 border-b border-line "
                  + (nowHere ? "bg-accent/[0.08]" : "bg-row-active")
                }>
                  <KindBadge kind="chore" size={16} title="Chores" />
                  <span className="flex-1 min-w-0 leading-snug font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
                    {b.block?.name ?? "Anytime"}
                  </span>
                  {nowHere && <NowTag />}
                  {b.startMin != null && (
                    <span className="shrink-0 text-[12px] text-faint [font-variant-numeric:tabular-nums]">
                      {formatMinutesOfDay(b.startMin)}
                    </span>
                  )}
                  <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                    {allDone ? "done" : `${done}/${total}`}
                  </span>
                </div>
                {/* Doing rounds is the intended way to work a block, so it's a
                    prominent primary action at the TOP of the block (F47). */}
                {b.block && (
                  <button
                    type="button"
                    onClick={() => navigate(`/rounds/${b.bucket}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-on-accent bg-accent hover:brightness-110 border-b border-line cursor-pointer"
                  >
                    <ListChecks size={15} />
                    Open rounds
                    <ChevronRight size={15} />
                  </button>
                )}
                {b.block && b.startMin != null && (() => {
                  const w = blockWindow(b.bucket);
                  const bufs = buffersForActivity("block", b.bucket, {
                    startMin: w.start, endMin: w.end,
                  });
                  if (!bufs.length) return null;
                  return (
                    <div className="px-4 py-2 border-b border-line">
                      <BufferSection
                        buffers={bufs}
                        onToggleItem={onBufferToggle}
                        onRemove={onBufferRemove}
                        squeezedIds={squeezedBufferIds}
                      />
                    </div>
                  );
                })()}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onReorder(b)}
                >
                  <SortableContext
                    items={b.rows.map((r) => r.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul>
                      {b.rows.map((row, ri) => (
                        <DraggableRow
                          key={row.key}
                          row={row}
                          completions={completions}
                          blocks={blocks}
                          removeDelta={removeDelta}
                          setDone={setDone}
                          onEdit={() => openEdit(row, b, ri)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            );
          })()}
        </div>
      ) : (
        /* focus points at a block that no longer exists — offer the agenda */
        <div className="border border-dashed border-line mt-3 px-4 py-8 text-center text-dim text-sm">
          <button type="button" onClick={showOverview}
            className="text-accent cursor-pointer">
            Show the whole day
          </button>
        </div>
      )}
       </>
      )}
      </div>{/* /center column */}

      {/* Desktop week — the one WeekStrip (folds the old center WeekSpines +
          sidebar WeekList): a row per day · count mini-spine · E/conflict
          symbols. Hidden in the wider zooms (the centre is the navigator).
          Width is CONTENT-sized: the widest day's bar group sets the strip
          track (bars ≥5px, never clipped under the symbols), and the
          sidebar wraps it — the F16 fixed 180px gave way to this rule. */}
      {viewMode === "day" && (
        <aside className="hidden lg:block shrink-0 border-l border-line py-5 px-3">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.16em] text-faint">
              This week
            </div>
            {/* R5.12 — advance the viewed week without leaving the day. */}
            <div className="flex items-center gap-1">
              {[[-7, "Previous week", ChevronLeft],
                [7, "Next week", ChevronRight]].map(([d, label, Icon]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  onClick={() => {
                    const t = new Date(today);
                    t.setDate(t.getDate() + d);
                    goToDay(t);
                  }}
                  className="p-0.5 border border-line text-dim hover:bg-row-hover hover:text-fg cursor-pointer"
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </div>
          <WeekStrip
            week={farm.week}
            todayISO={realTodayISO}
            selectedISO={dateISO}
            ymd={ymdLocal}
            onPickDay={goToDay}
            conflictsByISO={weekConflictsByISO}
            warmingByISO={weekWarmingByISO}
            overnightByISO={weekOvernightISOs}
            coveredByISO={weekCoveredByISO}
          />
        </aside>
      )}
     </div>{/* /lg workbench flex */}

      {picking && (
        <AddToScheduleSearch
          chores={choreDefs}
          choreCtx={choreCtx}
          projectNodes={projectNodes}
          anchorDate={today}
          todayISO={realTodayISO}
          ymd={ymdLocal}
          onAddChore={addChoreAt}
          onAddProject={(node, dates) => addProject(node, null, dates)}
          onAddTask={(title, dates) => addTask(title, null, dates)}
          onAddNote={(text, dates) => addNote(text, null, dates)}
          onClose={() => setPicking(false)}
        />
      )}

      {editing && (
        <ScheduleEditSheet
          label={editing.label}
          fromBucket={editing.bucket}
          fromBlockName={editing.fromBlockName}
          isFirstInBlock={editing.isFirstInBlock}
          currentClockTime={editing.currentClockTime}
          canMoveDay={editing.canMoveDay}
          committed={!!confirmedDoc}
          blocks={blocks}
          gapTargets={editing.row.kind === "chore"
            ? []
            : oneOffTargets.filter((t) => t.clockTime)}
          onApply={applyEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {addingTimeOff && (
        <ReservationSheet
          anchorDate={today}
          ymd={ymdLocal}
          existingWindows={windows}
          onAdd={({ assignees, ...rest }) => {
            // Fan out one reservation per selected person (F70); a shared
            // series id (when repeating) keeps them removable as one group.
            (assignees ?? []).forEach((a) =>
              addReservation({ ...rest, assignee: a }));
            setAddingTimeOff(false);
          }}
          onClose={() => setAddingTimeOff(false)}
        />
      )}

      {bufferFor && (
        <BufferSheet
          activity={bufferFor}
          onAdd={(b) => { addBuffer(b); setBufferFor(null); }}
          onClose={() => setBufferFor(null)}
        />
      )}

      {showConflicts && (
        <ConflictsPanel
          conflicts={conflicts}
          onJump={jumpToConflict}
          onClose={() => setShowConflicts(false)}
        />
      )}

      {editingEvent && (
        <EventTimeSheet
          occ={editingEvent}
          onSave={onEventTimeSave}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {eventScope && (
        <EventScopePrompt
          verb="Save"
          onPick={(scope) => {
            applyEventTime(eventScope.occ, eventScope.patch, scope);
            setEventScope(null);
          }}
          onCancel={() => setEventScope(null)}
        />
      )}

      {/* Jump-to-now: re-open the current block and scroll it into view. */}
      <button
        type="button"
        onClick={jumpToNow}
        className={
          "fixed bottom-5 right-5 z-10 flex items-center gap-1.5 px-3 py-2 " +
          "bg-accent text-on-accent text-[12px] font-medium " +
          "transition-opacity duration-200 " +
          (showJump && viewMode === "day"
            ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        style={{
          // A 2px bg separation ring under the drop shadow (round 4): the
          // floating Now is the same green as the Confirm button it can
          // overlap on a phone — the ring keeps a visible boundary.
          boxShadow: "0 0 0 2px var(--color-bg), "
            + "0 10px 15px -3px rgb(0 0 0 / 0.25), "
            + "0 4px 6px -4px rgb(0 0 0 / 0.25)",
        }}
        aria-hidden={!(showJump && viewMode === "day")}
      >
        <ArrowDownToLine size={14} />
        Now
      </button>
    </div>
  );
}
