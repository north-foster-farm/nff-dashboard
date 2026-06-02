import { useEffect, useRef, useState } from "react";
import { Workflow } from "lucide-react";
import {
  MODIFIER_ACTION_LABEL, describeModifierSource,
} from "../lib/modifiers.js";

// Stacked modifier badges (Batch 23) — the chores-overhaul UI that was
// deferred until something could write chore_modifiers rows.
//
// Renders one small badge per modifier on a chore row: the winning
// modifier solid, the losers ghosted behind it. Tapping opens an
// explain popover listing winner + losers with what each one does and
// where it came from ("Process: Processing day prep" / "Added by
// James"). Conflict resolution itself is deterministic and lives in
// lib/modifiers.js — this component only displays the result.
//
// Props:
//   resolved   — resolveModifiers() result: { winner, losers, all }
//   processTitleById — Map<expansionId, processTitle> for source labels
//   compact    — smaller treatment for dense rows (Rounds)

export default function ModifierBadges({
  resolved, processTitleById, compact = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!resolved) return null;
  const { winner, losers } = resolved;

  return (
    <span className="relative inline-flex items-center shrink-0" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        title="This chore is modified today — tap to see why"
        className="bg-transparent border-0 p-0 cursor-pointer inline-flex items-center"
      >
        {/* losers stack behind the winner, ghosted */}
        {losers.slice(0, 2).map((m, i) => (
          <span
            key={m.id}
            className={
              "inline-flex items-center border px-1.5 font-semibold uppercase " +
              "tracking-[0.08em] border-line text-faint bg-surface opacity-50 " +
              "-mr-1.5 " +
              (compact ? "text-[8px] py-px" : "text-[9px] py-0.5")
            }
            style={{ transform: `translateX(${-2 * (i + 1)}px)` }}
          >
            {MODIFIER_ACTION_LABEL[m.action] ?? m.action}
          </span>
        ))}
        {/* winner — solid */}
        <span
          className={
            "inline-flex items-center gap-1 border px-1.5 font-semibold uppercase " +
            "tracking-[0.08em] border-accent-deep bg-accent text-on-accent " +
            "relative " +
            (compact ? "text-[8px] py-px" : "text-[9px] py-0.5")
          }
        >
          <Workflow size={compact ? 8 : 9} className="shrink-0" />
          {MODIFIER_ACTION_LABEL[winner.action] ?? winner.action}
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 top-full left-0 mt-1.5 w-[280px] bg-bg border border-line shadow-[0_4px_24px_rgba(0,0,0,0.25)] p-3 flex flex-col gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="font-ui text-[10px] uppercase tracking-[0.14em] font-bold text-fg">
            Modified today
          </div>
          <ExplainRow
            modifier={winner}
            isWinner
            processTitleById={processTitleById}
          />
          {losers.map(m => (
            <ExplainRow
              key={m.id}
              modifier={m}
              processTitleById={processTitleById}
            />
          ))}
          {losers.length > 0 && (
            <div className="text-[10px] text-faint leading-relaxed">
              When modifiers conflict, the highest priority wins
              (newest breaks ties).
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function ExplainRow({ modifier, isWinner = false, processTitleById }) {
  return (
    <div className={
      "flex flex-col gap-0.5 border-l-2 pl-2.5 " +
      (isWinner ? "border-l-accent" : "border-l-line opacity-60")
    }>
      <div className="text-[11px] font-semibold text-fg">
        {MODIFIER_ACTION_LABEL[modifier.action] ?? modifier.action}
        {!isWinner && (
          <span className="font-normal text-faint"> · overridden</span>
        )}
      </div>
      {modifier.replacementText && (
        <div className="text-[11px] text-dim leading-relaxed">
          {modifier.replacementText}
        </div>
      )}
      <div className="text-[10px] text-faint">
        {describeModifierSource(modifier, processTitleById)}
      </div>
    </div>
  );
}
