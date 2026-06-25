import { useState } from "react";
import { Check, CloudOff, X, GripVertical, MoreHorizontal } from "lucide-react";
import ChoreRemainingPill from "./ChoreRemainingPill.jsx";
import ModifierBadges from "./ModifierBadge.jsx";
import EditedHistory from "./EditedHistory.jsx";
import { useChoreModifiers } from "../lib/data/useChoreModifiers.js";
import { resolveModifiers, applyModifier } from "../lib/modifiers.js";
import { formatISODate, todayUTC } from "../lib/dates.js";

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
export default function ChoreCheckRow({
  chore, placeId, placeLabel, blocks, completions, onRemove,
  onEdit, edit, sortableRef, sortableStyle, dragHandleProps, isDragging,
}) {
  const done = completions.isDone(chore.id, placeId);
  // True while this row's tick is sitting in the device-local outbox
  // waiting for connectivity.
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;
  const [pending, setPending] = useState(false);
  const [showHist, setShowHist] = useState(false);

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

  return (
    <li
      ref={sortableRef}
      style={sortableStyle}
      className={
        "flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
        (done ? "bg-row-active-dim" : "bg-transparent") +
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
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
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
          (done || effects.skipped
            ? "text-muted line-through"
            : "text-fg font-medium")
        }>
          <span className="truncate">
            {effects.replaceText ?? chore.title}
          </span>
          <ChoreRemainingPill chore={chore} blocks={blocks} />
          <ModifierBadges resolved={resolved} compact />
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
        {placeLabel && (
          <div className="text-[11px] text-faint mt-0.5">{placeLabel}</div>
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
      {showHist && edit?.history?.length > 0 && (
        <EditedHistory history={edit.history} />
      )}
    </li>
  );
}
