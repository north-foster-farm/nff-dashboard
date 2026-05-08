import { useEffect } from "react";

// Universal "This event / This and following / All events" scope
// prompt. Pops before saving an edit (or deleting) on a recurring
// series's per-occurrence date.
//
// Props:
//   verb        - the action verb shown in the title ("Save" /
//                 "Delete"). Buttons stay generic.
//   onPick      - (scope: 'this' | 'following' | 'all') => void
//   onCancel    - close without picking.
//
// Renders a small centered dialog over a backdrop. Clicking outside
// or pressing Escape cancels.

export default function EventScopePrompt({ verb = "Save", onPick, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-bg border border-line w-full max-w-[400px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Choose edit scope"
      >
        <div className="font-heading text-[18px] font-semibold">
          {verb} which events?
        </div>
        <p className="text-[12px] text-dim m-0 leading-relaxed">
          This is part of a recurring series. Pick which dates the
          change should apply to.
        </p>
        <div className="flex flex-col gap-2 mt-1">
          <ScopeButton
            onClick={() => onPick?.("this")}
            label="This event"
            sub="Affects only the date you opened."
          />
          <ScopeButton
            onClick={() => onPick?.("following")}
            label="This and following events"
            sub="Splits the series at this date and applies the change going forward."
          />
          <ScopeButton
            onClick={() => onPick?.("all")}
            label="All events"
            sub="Updates the series rule for every past and future date."
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeButton({ onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-surface hover:bg-surface-alt border border-line p-3 cursor-pointer flex flex-col gap-0.5"
    >
      <span className="text-[13px] font-semibold text-fg">{label}</span>
      <span className="text-[11px] text-dim leading-relaxed">{sub}</span>
    </button>
  );
}
