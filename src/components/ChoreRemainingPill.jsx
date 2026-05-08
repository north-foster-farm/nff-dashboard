import { useEffect, useState } from "react";
import { choreDaysRemaining } from "../lib/chores.js";

// Small inline pill that surfaces "(N days left)" / "due today" /
// "overran" for chores whose window spans multiple blocks or days.
// Returns null when the pill doesn't apply (single-block daily chores).
//
// Style variants follow the urgency:
//   days      — neutral (textDim on surfaceAlt)
//   today     — warm accent (warn-tinted)
//   overran   — red-ish (warn / strong)
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
    tone = "today";
  } else if (r.kind === "overran") {
    label = "overran";
    tone = "overran";
  } else if (r.kind === "days") {
    label = r.days === 1 ? "1 day left" : `${r.days} days left`;
    tone = "days";
  } else {
    return null;
  }

  const base =
    "inline-flex items-center text-[10px] font-semibold uppercase " +
    "tracking-[0.12em] px-1.5 py-0.5 leading-none border ";
  const toneClass =
    tone === "overran"
      ? "bg-surface-alt border-warn text-warn"
      : tone === "today"
      ? "bg-surface-alt border-accent text-accent"
      : "bg-surface-alt border-line text-dim";

  return <span className={`${base}${toneClass} ${className}`}>{label}</span>;
}
