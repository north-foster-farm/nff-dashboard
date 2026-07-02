import { useEffect, useState } from "react";
import { ClockAlert } from "lucide-react";
import {
  choreDaysRemaining, displayDeadlineDateShort,
} from "../lib/chores.js";

// Small inline pill that surfaces the deadline date + countdown — e.g.
// "Fri Jun 6 · 4 days left" / "due today" / "overran" — for chores whose
// window spans multiple days. Returns null when the pill doesn't apply
// (single-block daily chores).
//
// F21 (slice 4) — warming is BINARY, matching the WarmingBadge everywhere
// else (day-load summary, block rows, week pane). The old three-tone ramp
// is collapsed to two states + a neutral:
//   due  — due today OR overran → the deadline red (--c-cat-processing)
//          + the ClockAlert glyph (the row-level repeat of the signal);
//   warn — deadline lands later THIS week → warn amber + ClockAlert;
//   else — runway beyond this week → quiet neutral, no glyph.
//
// Re-ticks once per minute so "due today" can flip to "overran" the
// instant the deadline block ends without anyone refreshing.
export default function ChoreRemainingPill({ chore, blocks, className = "" }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const r = choreDaysRemaining(chore, now, blocks);
  if (!r) return null;

  let label;
  let tone;
  if (r.kind === "today") {
    label = "due today";
    tone = "due";
  } else if (r.kind === "overran") {
    label = "overran";
    tone = "due";
  } else if (r.kind === "days") {
    const days = r.days === 1 ? "1 day left" : `${r.days} days left`;
    const date = displayDeadlineDateShort(chore, now, blocks);
    label = date ? `${date} · ${days}` : days;
    // Sun-first week; Sat = 0 left — the same due-this-week rule as
    // farmLoad's dayWarming, so the pill can't disagree with the badges.
    tone = r.days <= 6 - now.getDay() ? "warn" : "days";
  } else {
    return null;
  }

  const base =
    "inline-flex items-center gap-1 text-[10px] font-semibold uppercase " +
    "tracking-[0.12em] px-1.5 py-0.5 leading-none border ";
  const toneClass =
    tone === "due"
      ? "bg-surface-alt border-cat-processing text-cat-processing"
      : tone === "warn"
      ? "bg-surface-alt border-warn text-warn"
      : "bg-surface-alt border-line text-dim";

  return (
    <span className={`${base}${toneClass} ${className}`}>
      {tone !== "days" && <ClockAlert size={11} className="shrink-0" />}
      {label}
    </span>
  );
}
