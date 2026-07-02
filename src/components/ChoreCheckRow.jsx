import { useState } from "react";
import {
  ChevronRight, ClockAlert, CloudOff, X, GripVertical, MoreHorizontal,
} from "lucide-react";
import { CheckTarget } from "./ui.jsx";
import ChoreRemainingPill from "./ChoreRemainingPill.jsx";
import ModifierBadges from "./ModifierBadge.jsx";
import EditedHistory, { EditedTag, fmtClock12 } from "./EditedHistory.jsx";
import { useChoreModifiers } from "../lib/data/useChoreModifiers.js";
import { resolveModifiers, applyModifier } from "../lib/modifiers.js";
import { formatISODate, todayUTC } from "../lib/dates.js";
import { choreDaysRemaining, computeDeadline } from "../lib/chores.js";

// One checkable chore row, keyed by (chore, place) — the single completion
// truth. Extracted from Rounds (Schedule S4) so the Rounds takeover and the
// Schedule accordion render an identical row and write through the same
// `completions.toggle` -> outbox path. Pulls its own date-bound modifiers
// (the should->must "prepend"/deadline effects), so it's self-contained.
//
// The Schedule (S6 3/3) passes optional editing props — `onEdit` (an edit
// affordance), `edit` (this instance's clock time + modification history),
// and sortable props (`sortableRef`/`sortableStyle`/`dragHandleProps`/
// `isDragging`) — to make the row movable/reorderable. Rounds passes none,
// so its rows are unchanged.
//
// Round 5: the chore NAME wraps (never truncates); the WHERE line always
// renders (placeLabel — the caller resolves place, falling back to the
// chore's anchor description); the old "FRI · N DAYS LEFT" pill +
// "optional today" collapse into a quiet "N DAYS LEFT" dropdown on the
// where line (EditedTag language) whose panel carries the due date +
// time; the edited dropdown relocates beside it.

// The days-left disclosure (round 5): same tag language as EditedTag —
// colored semibold, chevron rotates open. Sits on the where line.
// F21 (slice 4): when the deadline lands THIS week the tag IS the row's
// warning state — warn amber + the ClockAlert glyph, the same binary
// signal the day-load summary and block rows repeat. Runway beyond the
// week stays the quiet accent tag.
function DaysLeftTag({ days, warm, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={
        "shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold "
        + "uppercase tracking-wide px-1 py-0.5 "
        + (warm ? "text-warn " : "text-accent-deep ")
        + "cursor-pointer transition-colors hover:bg-row-active "
        + "active:bg-row-active"
      }
    >
      {warm && <ClockAlert size={11} className="shrink-0" />}
      {days === 1 ? "1 day left" : `${days} days left`}
      <ChevronRight
        size={11}
        className={
          "transition-transform duration-[140ms] ease-out "
          + (open ? "rotate-90" : "")
        }
      />
    </button>
  );
}

export default function ChoreCheckRow({
  chore, placeId, placeLabel, blocks, completions, onRemove,
  onEdit, edit, sortableRef, sortableStyle, dragHandleProps, isDragging,
}) {
  const done = completions.isDone(chore.id, placeId);

  // must vs should (S13–S15). "should" = a genuine window chore — one
  // deferrable across multiple days, deadline-anchored. Round 5: the
  // runway ("N days left") reads as the quiet dropdown below; due-today /
  // overran keep the loud inline pill. choreDaysRemaining self-gates
  // (returns null for non-windowy chores), the same rule the old pill
  // applied — no extra frequency filter here or `once` chores drop out.
  const rem = choreDaysRemaining(chore, new Date(), blocks);
  const escalating = rem?.kind === "today" || rem?.kind === "overran";
  const hasRunway = rem?.kind === "days";
  // F21 — runway that lands THIS week = the binary warning state (the tag
  // warms). Same Sun-first rule as farmLoad's dayWarming.
  const warmWeek = hasRunway && rem.days <= 6 - new Date().getDay();
  // Escalation chrome is flush (DESIGN principle 1): a flat fill, no raised
  // left-rail. F21 binary: due-today and overran are ONE "due" state — the
  // same red wash (the old accent/warn split was a third tone).
  const escalateClass = !done && escalating
    ? " bg-cat-processing/[0.06]"
    : "";
  // True while this row's tick is sitting in the device-local outbox
  // waiting for connectivity.
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;
  const [pending, setPending] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const [showDue, setShowDue] = useState(false);

  const { modifiers } = useChoreModifiers();
  const resolved = resolveModifiers(
    modifiers, chore.id, formatISODate(todayUTC()), placeId,
  );
  const effects = applyModifier(resolved);

  const onToggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      await completions.toggle(chore.id, placeId, done);
    } finally {
      setPending(false);
    }
  };

  // The due panel's date + time — computeDeadline resolves the chore's
  // real deadline instant (block-anchored or offset).
  const dueText = (() => {
    if (!showDue) return null;
    const d = computeDeadline(chore, new Date(), blocks);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  })();

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={
        "flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
        (done ? "bg-row-active-dim" : "bg-transparent") +
        escalateClass +
        (effects.skipped ? " opacity-60" : "") +
        (isDragging ? " opacity-60 relative z-10" : "")
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
      <CheckTarget
        done={done}
        queued={queued}
        pending={pending}
        onToggle={onToggle}
      />
      <div className="flex-1 min-w-0">
        <div className={
          "text-[14px] flex flex-wrap items-center gap-x-2 gap-y-0.5 " +
          (done || effects.skipped
            ? "text-muted line-through"
            : "text-fg font-medium")
        }>
          {/* The name WRAPS (round 5) — a long chore title is content,
              not chrome; nothing here may truncate it. */}
          <span className="min-w-0">
            {effects.replaceText ?? chore.title}
          </span>
          {escalating && (
            <ChoreRemainingPill chore={chore} blocks={blocks} />
          )}
          <ModifierBadges resolved={resolved} compact />
          {/* Rescheduled treatment (round 4) — 12-hour time in 10px
              tabular faint. */}
          {edit?.clockTime && (
            <span className="shrink-0 text-[10px] leading-tight text-faint [font-variant-numeric:tabular-nums]">
              {fmtClock12(edit.clockTime)}
            </span>
          )}
          {queued && (
            <CloudOff
              size={12}
              className="shrink-0 text-warn"
              aria-label="Saved on this device — not synced yet"
            />
          )}
        </div>
        {effects.prependText && (
          <div className="text-[12px] text-accent-deep font-medium mt-0.5">
            {effects.prependText}
          </div>
        )}
        {effects.deadlineText && (
          <div className="text-[11px] text-warn mt-0.5">
            Deadline today: {effects.deadlineText}
          </div>
        )}
        {/* The WHERE line (round 5): always present when the caller can
            name a place (or the chore's anchor as the fallback). The
            days-left + edited dropdowns ride to its right. */}
        {(placeLabel || hasRunway || edit?.history?.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-faint mt-0.5">
            {placeLabel && <span>{placeLabel}</span>}
            {hasRunway && !done && (
              <>
                {placeLabel && <span>·</span>}
                <DaysLeftTag
                  days={rem.days}
                  warm={warmWeek}
                  open={showDue}
                  onToggle={() => setShowDue((s) => !s)}
                />
              </>
            )}
            {edit?.history?.length > 0 && (
              <>
                {(placeLabel || (hasRunway && !done)) && <span>·</span>}
                <EditedTag
                  open={showHist}
                  onToggle={() => setShowHist((s) => !s)}
                />
              </>
            )}
          </div>
        )}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-faint hover:text-fg cursor-pointer"
          aria-label="Edit this item"
        >
          <MoreHorizontal size={16} />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-faint hover:text-warn cursor-pointer"
          aria-label="Remove from today"
        >
          <X size={16} />
        </button>
      )}
      {/* Round 6 — the indent lives INSIDE the full-width row (ml on a
          basis-full item overflowed the container by the margin: the
          phone's horizontal page-scroll bug). */}
      {showDue && dueText && (
        <div className="basis-full min-w-0 mt-1">
          <div className="ml-10 border-l border-line pl-3 text-[11px] text-dim leading-snug">
            Due {dueText}
          </div>
        </div>
      )}
      {showHist && edit?.history?.length > 0 && (
        <EditedHistory history={edit.history} />
      )}
    </li>
  );
}
