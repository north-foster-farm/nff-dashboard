import { useEffect, useState } from "react";
import {
  X, AlertTriangle, Users, Timer, ChevronUp, ChevronDown, ChevronRight,
} from "lucide-react";

// The conflicts list (S56a) — every man-down + double-book on the viewed day
// and across the horizon, in one place. From here you jump straight to a
// conflict in context (S56b) and step through them next/previous without
// returning to the list each time (S56c). Man-downs carry an AlertTriangle;
// double-bookings (S58) a Users glyph.
export default function ConflictsPanel({ conflicts, onJump, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowDown") setI((n) => Math.min(conflicts.length - 1, n + 1));
      if (e.key === "ArrowUp") setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, conflicts.length]);

  const today = conflicts.filter((c) => c.scope !== "upcoming");
  const upcoming = conflicts.filter((c) => c.scope === "upcoming");
  const cur = conflicts[i] ?? null;

  const Glyph = ({ type }) => type === "double"
    ? <Users size={15} className="shrink-0 text-warn" />
    : type === "squeeze"
      ? <Timer size={15} className="shrink-0 text-warn" />
      : <AlertTriangle size={15} className="shrink-0 text-warn" />;

  const row = (c, idx) => (
    <li key={idx}>
      <button
        type="button"
        onClick={() => { setI(idx); onJump(c); }}
        className={"w-full flex items-center gap-3 px-4 py-3 text-left border-b border-line hover:bg-row-hover cursor-pointer "
          + (idx === i ? "bg-row-active" : "")}
      >
        <Glyph type={c.type} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-fg truncate">{c.label}</div>
          <div className="text-[12px] text-faint truncate">
            {c.scope === "upcoming" && c.date
              ? `${c.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${c.detail}`
              : c.detail}
          </div>
        </div>
        <ChevronRight size={14} className="shrink-0 text-faint" />
      </button>
    </li>
  );

  let n = -1;
  return (
    <div
      className="fixed inset-0 z-[210] bg-black/40 flex items-start justify-center p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface border border-line shadow-xl flex flex-col max-h-full"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Conflicts"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <span className="flex-1 text-[14px] font-semibold text-fg">
            {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
          </span>
          {conflicts.length > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous conflict"
                onClick={() => { const p = Math.max(0, i - 1); setI(p); onJump(conflicts[p]); }}
                className="text-faint hover:text-fg cursor-pointer p-1">
                <ChevronUp size={16} />
              </button>
              <button type="button" aria-label="Next conflict"
                onClick={() => { const p = Math.min(conflicts.length - 1, i + 1); setI(p); onJump(conflicts[p]); }}
                className="text-faint hover:text-fg cursor-pointer p-1">
                <ChevronDown size={16} />
              </button>
            </div>
          )}
          <button type="button" onClick={onClose}
            className="shrink-0 text-faint hover:text-fg cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="overflow-y-auto">
          {conflicts.length === 0 && (
            <li className="px-4 py-8 text-center text-dim text-[13px]">
              No conflicts — the day and the next two weeks look clear.
            </li>
          )}
          {today.length > 0 && (
            <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              Today
            </li>
          )}
          {today.map((c) => row(c, ++n))}
          {upcoming.length > 0 && (
            <li className="px-4 py-1.5 mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              Coming up
            </li>
          )}
          {upcoming.map((c) => row(c, ++n))}
        </ul>
        {cur && (
          <div className="px-4 py-2 border-t border-line text-[12px] text-dim">
            {i + 1} of {conflicts.length} — ↑/↓ to step, tap to jump.
          </div>
        )}
      </div>
    </div>
  );
}
