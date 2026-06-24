import { useState } from "react";
import { Check, CloudOff } from "lucide-react";
import ChoreRemainingPill from "./ChoreRemainingPill.jsx";
import ModifierBadges from "./ModifierBadge.jsx";
import { useChoreModifiers } from "../lib/data/useChoreModifiers.js";
import { resolveModifiers, applyModifier } from "../lib/modifiers.js";
import { formatISODate, todayUTC } from "../lib/dates.js";

// One checkable chore row, keyed by (chore, place) — the single completion
// truth. Extracted from Rounds (Schedule S4) so the Rounds takeover and the
// Schedule accordion render an identical row and write through the same
// `completions.toggle` -> outbox path. Pulls its own date-bound modifiers
// (the should->must "prepend"/deadline effects), so it's self-contained.
export default function ChoreCheckRow({
  chore, placeId, placeLabel, blocks, completions,
}) {
  const done = completions.isDone(chore.id, placeId);
  // True while this row's tick is sitting in the device-local outbox
  // waiting for connectivity.
  const queued = completions.isQueued?.(chore.id, placeId) ?? false;
  const [pending, setPending] = useState(false);

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
      className={
        "flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 " +
        (done ? "bg-row-active-dim" : "bg-transparent") +
        (effects.skipped ? " opacity-60" : "")
      }
    >
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
    </li>
  );
}
