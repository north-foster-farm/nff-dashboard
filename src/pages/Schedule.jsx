import { useMemo, useState, useEffect, useRef } from "react";
import {
  ChevronRight, ArrowDownToLine, ListChecks, Check, Plus, X, CloudOff,
  GripVertical, MoreHorizontal, AlertTriangle, Ban, CalendarClock, MapPin,
  Repeat, StickyNote, Timer, Scissors, CalendarX, FolderKanban,
  ClockArrowRight, ClockArrowLeft,
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
  computeManDown, reservationWindows, reservationWindow, pickCoverPerson,
  ADMINS,
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
  choreDaysRemaining,
} from "../lib/chores.js";
import AddToScheduleSearch from "../components/AddToScheduleSearch.jsx";
import ChoreCheckRow from "../components/ChoreCheckRow.jsx";
import ScheduleEditSheet from "../components/ScheduleEditSheet.jsx";
import ReservationSheet from "../components/ReservationSheet.jsx";
import BufferSheet from "../components/BufferSheet.jsx";
import EventTimeSheet from "../components/EventTimeSheet.jsx";
import SplitBlockSheet from "../components/SplitBlockSheet.jsx";
import EventScopePrompt from "../components/EventScopePrompt.jsx";
import { useEventSeries } from "../lib/data/useEventSeries.js";
import CoverSheet from "../components/CoverSheet.jsx";
import EditedHistory from "../components/EditedHistory.jsx";
import { DayRailSpine, DayStrip, WeekList } from "../components/ScheduleSidebars.jsx";
import { WeekView, MonthView } from "../components/ScheduleZoom.jsx";
import { ScheduleReview } from "../components/ScheduleReview.jsx";
import { weekFullness, weekDays } from "../lib/schedule/weekView.js";
import { monthFullness } from "../lib/schedule/monthView.js";
import { blockStartDrift, dayReviews } from "../lib/schedule/lookBack.js";
import { useRunHistory } from "../lib/data/useRunHistory.js";
import { isActiveProject, nextProjectStep } from "../lib/projects.js";
import { segmentForStart, buildDaySegments } from "../lib/schedule/placement.js";
import {
  overnightWindow, inOvernight, OVERNIGHT_LEAD, OVERNIGHT_TRAIL,
} from "../lib/schedule/partition.js";
import { useNeighborDeltas } from "../lib/data/useNeighborDeltas.js";
import BlockBadge from "../components/BlockBadge.jsx";
import OutboxIndicator from "../components/OutboxIndicator.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { navigate } from "../lib/router.js";
import { useCurrentUserEmail } from "../lib/data/useCurrentUserEmail.js";
import { recordCapture, readCaptures } from "../lib/capture/capture.js";
import { supabase, realtimeChannel } from "../lib/supabase.js";
import { formatMinutesOfDay, resolveBlockMinutes } from "../lib/sunTimes.js";
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
// The reserved time + setup/cleanup checklist a buffer carries (S53/S57), plus
// the "Add buffer" affordance (the bufferable interface — BD23). Rendered
// inside an activity's detail panel (an event, or a focused chore block).
// `activity` = { target, label, startMin, endMin } — the anchor a new buffer
// resolves its window from.
function BufferSection({
  buffers, activity, onToggleItem, onRemove, onAddBuffer, squeezedIds,
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
      <button type="button" onClick={() => onAddBuffer(activity)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent cursor-pointer">
        <Timer size={13} /> Add buffer
      </button>
    </div>
  );
}

function EventEntry({
  occ, isOpen, onToggle,
  buffers, onToggleBufferItem, onRemoveBuffer, onAddBuffer, onEditTime,
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
          {onAddBuffer && (
            <BufferSection
              buffers={buffers ?? []}
              activity={{
                target: { kind: "event", id: occ.instanceId, label: occ.instanceLabel },
                label: occ.instanceLabel,
                startMin: hmToMin(occ.startTime),
                endMin: hmToMin(occ.endTime),
              }}
              onToggleItem={onToggleBufferItem}
              onRemove={onRemoveBuffer}
              onAddBuffer={onAddBuffer}
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

// The now-marker (Rethinker §3.4): a green hairline rule with a 7px dot +
// soft glow and a "Now · <time>" eyebrow. Leads the now-block in both the
// whole-day overview and the focused block detail.
function NowMarker({ startMin }) {
  return (
    <div className="px-4 pt-2">
      <div className="relative border-t border-resolved">
        <span
          className="absolute -top-1 left-0 w-[7px] h-[7px] rounded-full"
          style={{
            background: "var(--c-resolved)",
            boxShadow: "0 0 0 3px rgba(76,186,133,0.22)",
          }}
        />
      </div>
      <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.14em] text-resolved mt-1">
        Now{startMin != null ? " · " + formatMinutesOfDay(startMin) : ""}
      </div>
    </div>
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
          "text-[14px] flex items-center gap-2 " +
          (done ? "text-muted line-through" : "text-fg font-medium")
        }>
          <span className="truncate">
            {commitment.source_ref?.title ?? (isProject ? "(project)" : "(task)")}
          </span>
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint border border-line px-1">
            {isProject ? "project" : "task"}
          </span>
          {edit?.clockTime && (
            <span className="shrink-0 text-[11px] font-medium text-accent [font-variant-numeric:tabular-nums]">
              {edit.clockTime}
            </span>
          )}
          {edit?.history?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHist((s) => !s)}
              className="shrink-0 text-[10px] uppercase tracking-wide text-faint border border-line px-1 hover:text-fg cursor-pointer"
            >
              edited
            </button>
          )}
          {queued && (
            <CloudOff size={12} className="shrink-0 text-warn"
              aria-label="Saved on this device — not synced yet" />
          )}
        </div>
        {isProject && commitment.source_ref?.project_title && (
          <div className="text-[12px] text-faint italic mt-0.5 truncate">
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
        showPriority
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

// The inline "add a one-off task" input at the foot of a block.
function AddTaskRow({ onAdd }) {
  // Collapsed to a button by default (F61) — it reads as an action, not a raw
  // input sitting open; clicking expands the field.
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2 border-t border-line text-[13px] text-dim hover:bg-row-hover hover:text-fg cursor-pointer"
      >
        <Plus size={15} className="shrink-0 text-faint" />
        Add a one-off task
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-line">
      <Plus size={15} className="shrink-0 text-faint" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          else if (e.key === "Escape") { setText(""); setOpen(false); }
        }}
        placeholder="Add a one-off task…"
        className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint outline-none py-1"
      />
      <button type="button"
        onClick={() => { setText(""); setOpen(false); }}
        className="shrink-0 text-[12px] text-faint hover:text-fg">
        Cancel
      </button>
      {text.trim() && (
        <button type="button" onClick={submit}
          className="shrink-0 text-[12px] font-medium text-accent">
          Add
        </button>
      )}
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
  // The Project segment a "+ add" / "swap" affordance is targeting — opens the
  // add-to-day search with its handlers bound to the segment's start time, so
  // whatever's added routes into this block (P12/P13). null = closed.
  const [projectAddFor, setProjectAddFor] = useState(null);
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
  // refreshes data.projects, so the occupant re-derives. Online-only for v1
  // (offline outbox for steps is deferred).
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
        const multi = placeIds.length > 1;
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
              placeLabel: multi ? p?.name ?? null : null,
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
            placeLabel: choreCtx?.placesById?.get(pid)?.name ?? null,
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
      .map((o) => ({
        kind: "event",
        bucket: "ev|" + o.instanceId + "|" + o.date + "|" + (o.startTime ?? ""),
        startMin: hmToMin(o.startTime),
        occ: o,
      })),
    [derived]);

  // Project blocks (the derived gaps) as timeline + navigator entries (batch
  // 2 — now with contents). Each carries its placed `items` (project_node /
  // ad_hoc deltas routed here by time) and, for the FIRST gap only when it has
  // no items, the auto-pulled `occupant` (the top project's next step —
  // display-only, swappable). `startMin` sorts them into the agenda/spine.
  const projectEntries = useMemo(
    () => (derived.projectSegments ?? []).map((seg, idx) => {
      const bucket = "project:" + seg.startMin;
      const items = projectPlacements.byBucket.get(bucket) ?? [];
      // Auto-pull the top project's next step into the first gap, and keep
      // pulling the NEXT one once placed steps are done — appended below the
      // completed rows, never overwriting them (F69). A manual swap places an
      // INCOMPLETE project step, which suppresses the auto-pull (the swap
      // "overrides" the default). Already-placed steps aren't re-pulled.
      const placedStepIds = new Set(
        items.map((d) => d.source_ref?.step_id).filter(Boolean));
      const hasIncompleteProj = items.some(
        (d) => d.source_type === "project_node" && d.state !== "done");
      let occupant = (idx === 0 && !hasIncompleteProj)
        ? nextProjectStep(data.projects, dateISO) : null;
      if (occupant && placedStepIds.has(occupant.stepId)) occupant = null;
      const doneCount = items.filter((d) => d.state === "done").length;
      return {
        kind: "projectblock",
        isProject: true,
        bucket,
        startMin: seg.startMin,
        endMin: seg.endMin,
        durationMin: seg.durationMin,
        who: seg.who,
        items,
        occupant,
        count: items.length,
        done: doneCount,
        allDone: items.length > 0 && doneCount === items.length,
      };
    }),
    [derived, projectPlacements, data, dateISO]);

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

  const manDown = useMemo(() => {
    const flat = [];
    for (const b of blockRows) {
      const w = blockWindow(b.bucket);
      for (const row of b.rows) {
        flat.push({
          key: row.key, assignee: row.assignee ?? null,
          blockStart: w.start, blockEnd: w.end,
        });
      }
    }
    return computeManDown(flat, windows);
  }, [blockRows, windows, startMinByBucket, blocksById]);

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
  const nowBucket = useMemo(() => {
    const lead = overnightEntries.find((e) => e.side === "lead");
    const trail = overnightEntries.find((e) => e.side === "trail");
    if (lead && nowMin < lead.winEnd) return OVERNIGHT_LEAD;
    if (trail && nowMin >= trail.winStart) return OVERNIGHT_TRAIL;
    return pickNowBucket(blockRows, nowMin);
  }, [blockRows, nowMin, overnightEntries]);

  // The day-spine / phone-strip segments — one per chore block of the viewed
  // day, carrying the load (count), done, time, and the man-down flag so the
  // navigator reads as a labelled time axis (Design Bracket 2).
  const spineBlocks = useMemo(() => blockRows.map((b, i) => ({
    bucket: b.bucket,
    name: b.block?.name ?? "Anytime",
    block: b.block,
    startMin: b.startMin,
    count: counts[i].total,
    done: counts[i].done,
    allDone: counts[i].total > 0 && counts[i].done === counts[i].total,
    hasManDown: b.rows.some((r) => manDown.has(r.key)),
  })), [blockRows, counts, manDown]);

  // The navigator segments = chore blocks + Project gaps + the Overnight wrap,
  // in time order, so the spine/strip read as one tiled time axis (the leading
  // overnight pins first, the trailing last — via startKey).
  const navSegments = useMemo(
    () => [...spineBlocks, ...projectEntries, ...overnightEntries]
      .sort((a, b) => startKey(a) - startKey(b)),
    [spineBlocks, projectEntries, overnightEntries]);

  // Desktop week list (S9) — seven days of fullness silhouettes by count.
  const week = useMemo(
    () => weekFullness(data, today, ruleOpts), [data, today, ruleOpts]);

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
  const focus = focusSel === null
    ? nowBucket
    : focusSel === "overview" ? null : focusSel;
  const focusRef = useRef(null);

  // Picking the already-open block collapses to the overview (closable);
  // picking another opens it.
  const pickBlock = (bucket) => setFocusSel((cur) => {
    const resolved = cur === null ? nowBucket : cur === "overview" ? null : cur;
    return resolved === bucket ? "overview" : bucket;
  });
  const showOverview = () => setFocusSel("overview");

  // Per-day focus memory (F45): remember the open block for each visited day
  // and restore it on return; a day not opened this session defaults to the
  // whole-day overview, so a block selected on one day never carries onto a
  // day where it doesn't exist. `focusOverride` forces a specific target
  // (e.g. opening straight to a block from Week/Month).
  const focusByDayRef = useRef(new Map());
  const goToDay = (date, focusOverride) => {
    focusByDayRef.current.set(dateISO, focusSel);
    const nextISO = ymdLocal(date);
    const next = focusOverride !== undefined
      ? focusOverride
      : (focusByDayRef.current.has(nextISO)
        ? focusByDayRef.current.get(nextISO) : "overview");
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

  const applyEdit = (change) => {
    if (!editing) return;
    const parts = [];
    if ("toBlockId" in change) parts.push(`Moved to ${bucketName(change.toBlockId)}`);
    if ("clockTime" in change) {
      parts.push(change.clockTime ? `Time set ${change.clockTime}` : "Time cleared");
    }
    if ("toDate" in change) parts.push(`Moved to ${change.toDate}`);
    const entry = {
      at: new Date().toISOString(), by: email ?? null,
      summary: parts.join(" · ") || "Edited",
    };
    writeRow(editing.row, editing.bucket, change, entry);
    setEditing(null);
  };

  // Split a block for one day (S72): bulk-apply a second-sitting clock time to
  // the chosen rows, reusing the per-row write (derived chores → override,
  // commitment rows → updateDelta). The global block is untouched.
  const [splitting, setSplitting] = useState(null);
  const doSplit = (keys, time) => {
    const b = splitting;
    if (!b) return;
    const set = new Set(keys);
    const entry = {
      at: new Date().toISOString(), by: email ?? null,
      summary: `Split — moved to ${time}`,
    };
    for (const row of b.rows) {
      if (set.has(row.key)) writeRow(row, b.bucket, { clockTime: time }, entry);
    }
    setSplitting(null);
  };

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

  // ── Non-work time (S7) + man-down cover (S8) ───────────────────────
  const [addingTimeOff, setAddingTimeOff] = useState(false);
  const [bufferFor, setBufferFor] = useState(null);
  const [covering, setCovering] = useState(null);

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

  // The prose reason a row's assignee can't do it — "James is off-site until
  // 1:00." Shared by the cover sheet and the needs-cover card.
  const coverReason = (row) => {
    const res = manDown.get(row.key);
    if (!res) return null;
    if (res.kind === "day_off") return `${row.assignee} is off for the day.`;
    const until = formatMinutesOfDay(res.endMin);
    const where = res.kind === "break" ? "on a break"
      : res.kind === "appointment" ? "out" : "off-site";
    return `${row.assignee} is ${where} until ${until}.`;
  };

  const openCover = (row, b) => {
    const w = blockWindow(b.bucket);
    const reason = coverReason(row);
    setCovering({
      row, bucket: b.bucket,
      label: rowLabel(row),
      placeLabel: row.placeLabel ?? null,
      blockName: b.block?.name ?? "Anytime",
      timeLabel: w.start != null ? formatMinutesOfDay(w.start) : null,
      assignee: row.assignee,
      reason,
      cover: pickCoverPerson(row.assignee, windows, w.start, w.end),
    });
  };

  const doCover = () => {
    const who = covering?.cover?.person;
    if (!who) return;
    const entry = {
      at: new Date().toISOString(), by: email ?? null,
      summary: `Covered by ${who}`,
    };
    writeRow(covering.row, covering.bucket,
      { assignee: who, cover: { by: who, ack: false } }, entry);
    setCovering(null);
  };

  const acknowledgeCover = (row, bucket) => {
    const by = row.edit?.cover?.by;
    const entry = {
      at: new Date().toISOString(), by: email ?? null,
      summary: `${by} acknowledged cover`,
    };
    writeRow(row, bucket, { cover: { by, ack: true } }, entry);
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
    const flat = [];
    for (const b of blockRows) {
      const w = blockWindow(b.bucket);
      for (const row of b.rows) {
        flat.push({
          key: row.key, label: rowLabel(row), assignee: row.assignee ?? null,
          blockStart: w.start, blockEnd: w.end, bucket: b.bucket,
        });
        const hit = manDown.get(row.key);
        if (hit) {
          out.push({
            type: "manDown", scope: "today", bucket: b.bucket,
            iso: dateISO, assignee: row.assignee,
            label: `${rowLabel(row)} needs cover`,
            detail: hit.label
              ? `${row.assignee} — ${hit.label}` : `${row.assignee} unavailable`,
          });
        }
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
  }, [blockRows, manDown, dateISO, activeBufferWindows]);

  // Buffers squeezed today → an inline warn in their panel (S61).
  const squeezedBufferIds = useMemo(
    () => new Set(todayConflicts.filter((c) => c.type === "squeeze")
      .map((c) => c.bufferId)),
    [todayConflicts]);

  // Horizon scan (next 14 days) for man-down conflicts — driven by reservations
  // read once when the panel opens. Recurring days-off (S46) land here.
  const HORIZON_DAYS = 14;
  const [horizonRes, setHorizonRes] = useState(null);
  useEffect(() => {
    if (!showConflicts) return;
    let cancelled = false;
    const to = new Date(today);
    to.setDate(to.getDate() + HORIZON_DAYS);
    supabase.from("commitments")
      .select("id, source_type, source_ref, run_date, clock_time, assignee")
      .eq("source_type", "reservation")
      .gt("run_date", dateISO).lte("run_date", ymdLocal(to))
      .then((res) => {
        if (cancelled) return;
        const m = new Map();
        for (const r of res.data ?? []) {
          if (!m.has(r.run_date)) m.set(r.run_date, []);
          m.get(r.run_date).push(r);
        }
        setHorizonRes(m);
      });
    return () => { cancelled = true; };
  }, [showConflicts, dateISO, today]);

  const upcomingConflicts = useMemo(() => {
    if (!horizonRes) return [];
    return scanHorizonConflicts({
      data, fromDate: today, days: HORIZON_DAYS, ruleOpts,
      reservationsByISO: horizonRes, ymd: ymdLocal,
    }).map((c) => ({ ...c, scope: "upcoming", label: c.label }));
  }, [horizonRes, data, today, ruleOpts]);

  const conflicts = useMemo(
    () => [...todayConflicts, ...upcomingConflicts],
    [todayConflicts, upcomingConflicts]);

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

  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  // The header subtitle tracks the zoom: a day, the week's range, or the month.
  // Surface the day's events in the sub-line (F15) — e.g. a market day was
  // happening but nothing in the header said so. Append up to three event
  // labels after the date.
  const daySubtitle = (() => {
    if (!eventEntries.length) return dateLabel;
    const labels = eventEntries.map((e) => e.occ.instanceLabel);
    const shown = labels.slice(0, 3).join(" · ");
    const more = labels.length > 3 ? ` +${labels.length - 3} more` : "";
    return `${dateLabel} · ${shown}${more}`;
  })();
  const subtitle = viewMode === "day" ? daySubtitle
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

  // The focused timeline entry (a block or an event), or null = overview.
  const focusEntry = focus == null
    ? null : (timeline.find((e) => e.bucket === focus) ?? null);

  // Man-down leak + awaiting-ack lines for a block entry — shared by the
  // overview rows and the open detail. `pad` sets the left indent.
  const blockAlerts = (b, pad) => (
    <>
      {b.rows.filter((r) => manDown.has(r.key)).map((r) => {
        const coverer = ADMINS.find((a) => a !== r.assignee);
        return (
          <div key={"leak|" + r.key} className={"pr-4 pb-3 -mt-1 " + pad}>
            {/* Needs-cover card (Rethinker): a flush, amber-bordered card on
                the page — the ⚠ eyebrow + work + reason + a single amber
                action that opens the cover sheet. */}
            <div
              className="border"
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
                <div className="text-[14px] font-medium text-fg">
                  {rowLabel(r)}{r.placeLabel ? ` · ${r.placeLabel}` : ""}
                </div>
                <div className="text-[12px] text-dim mt-1 leading-snug">
                  {coverReason(r)}
                </div>
                <div className="font-ui text-[12px] text-dim mt-2.5">
                  Who can cover?
                </div>
                <button
                  type="button"
                  onClick={() => openCover(r, b)}
                  className="w-full mt-2 bg-warn text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.1em]"
                >
                  {coverer} covers — I've got it
                </button>
                <div className="font-ui text-[11px] text-faint mt-2.5 leading-snug">
                  The acknowledgment is the record — the hole closes green in
                  {" "}{coverer}'s lane.
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {b.rows.filter((r) => r.edit?.cover && !r.edit.cover.ack
        && !manDown.has(r.key)).map((r) => (
        <div key={"ack|" + r.key}
          className={"flex items-center gap-2 pr-4 pb-3 -mt-1 " + pad}>
          <Check size={13} className="shrink-0 text-resolved" />
          <span className="flex-1 text-[12px] text-dim">
            {rowLabel(r)} covered by {r.edit.cover.by} · awaiting ack
          </span>
          <button
            type="button"
            onClick={() => acknowledgeCover(r, b.bucket)}
            className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-accent border border-line px-1.5 py-0.5 hover:border-accent cursor-pointer"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </>
  );

  return (
    <div className="max-w-2xl lg:max-w-[1120px] mx-auto">
     {/* Day/Week/Month/Review lives at the TOP LEVEL (above the spine+pane
         split) so it stays put when the day-spine appears/disappears with the
         view mode — it never shuffles under the cursor (F20). */}
     <div className="hidden lg:flex items-center justify-end gap-1 font-ui text-[12px] mb-2">
       {[["day", "Day"], ["week", "Week"], ["month", "Month"],
         ["review", "Review"]].map(([m, label]) => (
         <button
           key={m}
           type="button"
           onClick={() => setViewMode(m)}
           className={
             "px-3 py-1 border cursor-pointer transition-colors "
             + (viewMode === m
               ? "bg-surface-alt border-line text-fg font-medium"
               : "border-transparent text-faint hover:text-dim")
           }
         >
           {label}
         </button>
       ))}
     </div>
     <div className="lg:flex lg:items-start">
      {/* Desktop load-spine — the day's shape AND the navigator (Day zoom). */}
      {viewMode === "day" && (
        <DayRailSpine
          blocks={navSegments}
          focus={focus}
          nowBucket={nowBucket}
          onPick={pickBlock}
          onWholeDay={showOverview}
          totalItems={totalRows}
        />
      )}

      <div className="flex-1 min-w-0 pb-24 lg:px-8">
      <PageHeader title="Schedule" subtitle={subtitle} />

      {viewMode === "week" ? (
        <WeekView
          week={week}
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
      {/* Source-changed-after-confirm ribbon — informs, never auto-applies.
          Standardised to the carry-over banner shape (F22) and dismissible
          (F29). */}
      {(() => {
        const sig = changes
          ? `${changes.total}|${changes.added.join(",")}|${changes.removed.join(",")}`
          : null;
        if (!changes || sig === dismissedChangeSig) return null;
        return (
          <div
            className="px-3 py-2 mb-3 border flex items-start gap-2"
            style={{
              borderColor: "color-mix(in srgb, var(--c-warn) 45%, transparent)",
              background: "color-mix(in srgb, var(--c-warn) 6%, var(--c-bg))",
            }}
          >
            <AlertTriangle size={14} className="shrink-0 text-warn mt-0.5" />
            <div className="flex-1 min-w-0 text-[12px] text-dim">
              <span className="font-medium text-fg">
                {changes.total} change{changes.total === 1 ? "" : "s"} since
                you confirmed.
              </span>{" "}
              <span className="text-faint">
                {[
                  ...changes.added.map((t) => "+ " + t),
                  ...changes.removed.map((t) => "− " + t),
                ].slice(0, 4).join(" · ")}
              </span>
            </div>
            <button type="button" onClick={() => setDismissedChangeSig(sig)}
              className="shrink-0 text-faint hover:text-fg cursor-pointer"
              aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })()}

      <div className="px-1 mb-3 flex flex-wrap items-start gap-x-3 gap-y-2">
        {confirmedDoc ? (
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-resolved border border-resolved px-2 py-0.5 inline-flex items-center gap-1">
            <Check size={12} strokeWidth={3} /> Confirmed
            {fmtStamp(confirmedDoc.confirmed_at) && (
              <span className="normal-case tracking-normal font-medium opacity-80">
                {fmtStamp(confirmedDoc.confirmed_at)}
              </span>
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={confirmDay}
            disabled={confirming || loading || timeline.length === 0}
            className="text-[12px] font-medium px-3 py-1.5 bg-accent text-on-accent disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed text-left leading-tight"
          >
            {viewingToday ? "Confirm today" : `Confirm ${dateLabel}`}
            {(totalRows > 0 || eventEntries.length > 0) && (
              <span className="block text-[11px] font-normal opacity-80">
                {blockRows.filter((b) => b.block).length} blocks · {totalRows} items
                {eventEntries.length > 0
                  && ` · ${eventEntries.length} event${eventEntries.length === 1 ? "" : "s"}`}
              </span>
            )}
          </button>
        )}
        <OutboxIndicator />
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowConflicts(true)}
            className={"text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer "
              + (todayConflicts.length > 0
                ? "text-warn hover:brightness-110" : "text-faint hover:text-dim")}
          >
            <AlertTriangle size={14} />
            {`${todayConflicts.length} conflict${todayConflicts.length === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={() => setAddingTimeOff(true)}
            className="text-[12px] font-medium text-dim hover:text-fg inline-flex items-center gap-1 cursor-pointer"
          >
            <Ban size={14} /> Time off
          </button>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="text-[12px] font-medium text-accent hover:brightness-110 inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} /> Add chore
          </button>
        </div>
      </div>

      {/* Yesterday's unfinished musts (S12) — only when building today. */}
      {viewMode === "day" && !dismissedYesterday && yesterdayMusts.count > 0 && (
        <div
          className="px-3 py-2 mb-3 border flex items-start gap-2"
          style={{
            borderColor: "color-mix(in srgb, var(--c-warn) 45%, transparent)",
            background: "color-mix(in srgb, var(--c-warn) 6%, var(--c-bg))",
          }}
        >
          <AlertTriangle size={14} className="shrink-0 text-warn mt-0.5" />
          <div className="flex-1 min-w-0 text-[12px] text-dim">
            <span className="font-medium text-fg">
              Yesterday — {yesterdayMusts.count} must-do
              {yesterdayMusts.count === 1 ? "" : "s"} unfinished.
            </span>
          </div>
          <button type="button" onClick={dismissYesterday}
            className="shrink-0 text-faint hover:text-fg cursor-pointer"
            aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
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

      {/* Phone day-strip — the navigable time axis (lg:hidden). */}
      {!loading && timeline.length > 0 && (
        <DayStrip
          blocks={navSegments}
          focus={focus}
          nowBucket={nowBucket}
          onPick={pickBlock}
          onWholeDay={showOverview}
        />
      )}

      {loading ? (
        <div className="px-4 py-10 text-center text-dim text-sm">Loading the day…</div>
      ) : timeline.length === 0 ? (
        <div className="border border-dashed border-line mt-3">
          <div className="px-4 py-8 text-center text-dim text-sm">
            Nothing on the schedule today.
          </div>
          <AddTaskRow onAdd={(title) => addTask(title, null)} />
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
              // tally), else the auto-pulled occupant, else the passive note.
              const sub = entry.items.length
                ? (entry.items[0].source_ref?.title ?? "1 item")
                  + (entry.items.length > 1
                    ? ` +${entry.items.length - 1} more` : "")
                : entry.occupant
                  ? entry.occupant.title
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
                    <FolderKanban size={16} className="shrink-0 text-project" />
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
            return (
              <li key={b.bucket} ref={isNow ? focusRef : null}>
                {isNow && viewingToday && <NowMarker startMin={b.startMin} />}
                <button
                  type="button"
                  onClick={() => pickBlock(b.bucket)}
                  className={
                    "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-row-hover cursor-pointer "
                    + (allDone ? "opacity-60" : "")
                  }
                >
                  {b.block && <BlockBadge block={b.block} />}
                  <span className="flex-1 min-w-0 truncate text-[14px] text-fg">
                    {b.block?.name ?? "Anytime"}
                  </span>
                  <span className="shrink-0 text-[12px] [font-variant-numeric:tabular-nums] text-dim">
                    {allDone ? "done" : `${done}/${total}`}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-faint" />
                </button>
                {blockAlerts(b, "pl-[18px]")}
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
            onAddBuffer={setBufferFor}
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
                  <span className="flex-1 min-w-0 truncate font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
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
            // Ticking the auto-pulled occupant materialises it as a placed,
            // done row so it persists; the next step then auto-pulls and
            // appends below it (F69) instead of swapping it out.
            const completeOccupant = (occ) => {
              const id = addProject(occ, null, null, minToHM(b.startMin));
              setDone(id, true);
              completeProjectStep(occ.stepId, true);
            };
            return (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-row-active">
                  <FolderKanban size={18} className="shrink-0 text-project" />
                  <span className="flex-1 min-w-0 truncate font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
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
                )}
                {b.occupant ? (
                  /* The auto-pulled occupant (display-only; not yet a row),
                     appended below any placed items. Checking it persists it as
                     a done row and pulls the next step (F69); "Swap" places a
                     different one, which overrides the auto-pull. */
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
                    <button
                      type="button"
                      onClick={() => completeOccupant(b.occupant)}
                      className="shrink-0 w-7 h-7 border-2 bg-bg border-line text-transparent hover:border-fg inline-flex items-center justify-center cursor-pointer"
                      aria-label="Mark done"
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-fg flex items-center gap-2">
                        <span className="truncate">{b.occupant.title}</span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint border border-line px-1">
                          auto
                        </span>
                      </div>
                      {b.occupant.projectTitle && (
                        <div className="text-[12px] text-faint italic mt-0.5 truncate">
                          {b.occupant.projectTitle}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setProjectAddFor(b)}
                      className="shrink-0 text-[12px] font-medium text-accent hover:underline cursor-pointer"
                    >
                      Swap
                    </button>
                  </div>
                ) : b.items.length === 0 ? (
                  <div className="px-4 py-3 border-b border-line text-[13px] text-faint italic">
                    free — nothing planned
                  </div>
                ) : null}
                <AddTaskRow
                  onAdd={(title) =>
                    addTask(title, null, null, null, minToHM(b.startMin))}
                />
                <button
                  type="button"
                  onClick={() => setProjectAddFor(b)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-accent hover:bg-row-hover border-t border-line cursor-pointer"
                >
                  <Plus size={15} />
                  Add a project step
                </button>
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
            return (
              <>
                {b.bucket === nowBucket && viewingToday && (
                  <NowMarker startMin={b.startMin} />
                )}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-row-active">
                  {b.block && <BlockBadge block={b.block} />}
                  <span className="flex-1 min-w-0 truncate font-heading text-[15px] font-semibold text-fg -tracking-[0.01em]">
                    {b.block?.name ?? "Anytime"}
                  </span>
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
                {blockAlerts(b, "pl-4")}
                {b.block && b.startMin != null && (() => {
                  const w = blockWindow(b.bucket);
                  return (
                    <div className="px-4 py-2 border-b border-line">
                      <BufferSection
                        buffers={buffersForActivity("block", b.bucket, {
                          startMin: w.start, endMin: w.end,
                        })}
                        activity={{
                          target: { kind: "block", id: b.bucket, label: b.block.name },
                          label: b.block.name,
                          startMin: w.start, endMin: w.end,
                        }}
                        onToggleItem={onBufferToggle}
                        onRemove={onBufferRemove}
                        onAddBuffer={setBufferFor}
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
                <AddTaskRow
                  onAdd={(title) => addTask(title, b.block ? b.bucket : null)}
                />
                {b.block && b.rows.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setSplitting(b)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-medium text-dim hover:bg-row-hover hover:text-fg border-t border-line cursor-pointer"
                  >
                    <Scissors size={15} />
                    Split block
                  </button>
                )}
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

      {/* Desktop week list — today = ring, viewed day = fill; tap to open.
          Hidden in the wider zooms (the centre is the navigator there). */}
      {viewMode === "day" && (
        <WeekList week={week} todayISO={realTodayISO} selectedISO={dateISO}
          ymd={ymdLocal} onPickDay={goToDay} />
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

      {projectAddFor && (
        /* Add into a Project block — same search, but every add carries the
           segment's start time so segmentForStart routes it back here. A
           placed step overrides the auto-pulled occupant (the "swap"). */
        <AddToScheduleSearch
          chores={choreDefs}
          choreCtx={choreCtx}
          projectNodes={projectNodes}
          scope="project"
          anchorDate={today}
          todayISO={realTodayISO}
          ymd={ymdLocal}
          onAddChore={addChoreAt}
          onAddProject={(node, dates) =>
            addProject(node, null, dates, minToHM(projectAddFor.startMin))}
          onAddTask={(title, dates) =>
            addTask(title, null, null, dates, minToHM(projectAddFor.startMin))}
          onAddNote={(text, dates) => addNote(text, null, dates)}
          onClose={() => setProjectAddFor(null)}
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

      {splitting && (
        <SplitBlockSheet
          blockName={splitting.block?.name ?? "this block"}
          items={splitting.rows.map((row) => ({
            key: row.key, label: rowLabel(row),
          }))}
          onApply={doSplit}
          onClose={() => setSplitting(null)}
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

      {covering && (
        <CoverSheet
          label={covering.label}
          placeLabel={covering.placeLabel}
          blockName={covering.blockName}
          timeLabel={covering.timeLabel}
          assignee={covering.assignee}
          reason={covering.reason}
          cover={covering.cover}
          onCover={doCover}
          onClose={() => setCovering(null)}
        />
      )}

      {/* Jump-to-now: re-open the current block and scroll it into view. */}
      <button
        type="button"
        onClick={jumpToNow}
        className={
          "fixed bottom-5 right-5 z-10 flex items-center gap-1.5 px-3 py-2 " +
          "bg-accent text-on-accent text-[12px] font-medium shadow-lg " +
          "transition-opacity duration-200 " +
          (showJump && viewMode === "day"
            ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        aria-hidden={!(showJump && viewMode === "day")}
      >
        <ArrowDownToLine size={14} />
        Now
      </button>
    </div>
  );
}
