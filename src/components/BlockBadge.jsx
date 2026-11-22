import { Clock, Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { resolveBlockMinutes } from "../lib/sunTimes.js";
import { blockLabel } from "../lib/schedule/placement.js";

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
//   no block (an orphan bucket)              → Clock
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
//
// Deliberately quiet: a small bare icon, no border or padding box. At
// the largest text-density setting (body zoom 1.4+) the old boxed
// treatment read as loudly as the chore title itself; an icon-only
// glyph stays subordinate at every zoom.
function BlockBadge({
  block, tone = "default", size = 11, className = "",
}) {
  const Icon = blockIcon(block);
  const label = blockLabel(block);
  return (
    <span
      title={label}
      aria-label={label}
      className={
        "inline-flex items-center justify-center shrink-0 " +
        (tone === "warn" ? "text-warn " : "text-faint ") +
        className
      }
    >
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}

// A compact block indicator for a chore that may span several blocks
// (e.g. an overdue row missed in more than one block on the Now
// surface). A single block shows its lone time-of-day glyph. Several
// blocks collapse to ONE representative glyph (the earliest) plus a
// "xN" count — a row of three near-identical tiny sun icons read as
// confusing noise (F134), so the cluster becomes one glyph + a number,
// with every block's name still in the tooltip.
export function BlockBadgeList({
  blocks, tone = "default", size = 11, className = "",
}) {
  const today = new Date();
  const sorted = [...(blocks ?? [])].sort((a, b) => {
    const sa = resolveBlockMinutes(today, a.startKind, a.startMinutes) ?? 9999;
    const sb = resolveBlockMinutes(today, b.startKind, b.startMinutes) ?? 9999;
    return sa - sb;
  });
  if (sorted.length === 0) return null;
  if (sorted.length === 1) {
    return (
      <span className={"inline-flex items-center shrink-0 " + className}>
        <BlockBadge block={sorted[0]} tone={tone} size={size} />
      </span>
    );
  }

  const Icon = blockIcon(sorted[0]);
  const names = sorted.map(blockLabel).join(", ");
  const label = `${sorted.length} blocks: ${names}`;
  return (
    <span
      title={label}
      aria-label={label}
      className={
        "inline-flex items-center gap-0.5 shrink-0 " +
        (tone === "warn" ? "text-warn " : "text-faint ") +
        className
      }
    >
      <Icon size={size} strokeWidth={2} />
      <span className="text-[10px] font-semibold leading-none">
        ×{sorted.length}
      </span>
    </span>
  );
}
