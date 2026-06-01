import { Clock, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { resolveBlockMinutes } from "../lib/sunTimes.js";

// Compact, icon-only time-of-day indicator for chore rows. Replaces
// the old text block label ("Morning", "Afternoon", …) which ate too
// much horizontal room on phone-width rows — especially once a row
// needs to show *several* blocks (a chore missed in more than one
// block on the Now surface).
//
// The icon follows the block's resolved start time for today:
//   sunrise-anchored or starts before 11 AM  → Sunrise
//   11 AM – 3:59 PM                          → Sun
//   sunset-anchored or 4 PM – 8:59 PM        → Sunset
//   9 PM onward / pre-dawn                   → Moon
//   no block ("anytime")                     → Clock
//
// The block name stays available as a tooltip + aria-label, so the
// label is discoverable without paying for its width.

export function blockIcon(block, date = new Date()) {
  if (!block) return Clock;
  if (block.startKind === "sunrise") return Sunrise;
  if (block.startKind === "sunset") return Sunset;
  const start = resolveBlockMinutes(date, block.startKind, block.startMinutes);
  if (start == null) return Clock;
  const m = ((start % 1440) + 1440) % 1440;
  if (m < 5 * 60) return Moon;
  if (m < 11 * 60) return Sunrise;
  if (m < 16 * 60) return Sun;
  if (m < 21 * 60) return Sunset;
  return Moon;
}

// One badge. tone: "default" | "warn" (warn = the block was missed).
export default function BlockBadge({
  block, tone = "default", size = 13, className = "",
}) {
  const Icon = blockIcon(block);
  const label = block?.name ?? "Anytime";
  return (
    <span
      title={label}
      aria-label={label}
      className={
        "inline-flex items-center justify-center shrink-0 p-1 border " +
        (tone === "warn"
          ? "border-warn/50 text-warn "
          : "border-line text-dim ") +
        className
      }
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}

// A row of badges — one per block, sorted by today's resolved start
// time. Used by consolidated overdue rows on the Now surface, where
// each badge marks one missed block.
export function BlockBadgeList({ blocks, tone = "default", size = 13 }) {
  const today = new Date();
  const sorted = [...(blocks ?? [])].sort((a, b) => {
    const sa = resolveBlockMinutes(today, a.startKind, a.startMinutes) ?? 9999;
    const sb = resolveBlockMinutes(today, b.startKind, b.startMinutes) ?? 9999;
    return sa - sb;
  });
  if (sorted.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      {sorted.map((b, i) => (
        <BlockBadge key={b?.id ?? i} block={b} tone={tone} size={size} />
      ))}
    </span>
  );
}
