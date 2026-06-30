import { Fragment } from "react";
import {
  LayoutList, AlertTriangle, FolderKanban,
  ClockArrowRight, ClockArrowLeft, Moon,
} from "lucide-react";
import { blockIcon } from "./BlockBadge.jsx";
import { KindBadge, NowTag, WarmingBadge } from "./ui.jsx";
import { formatMinutesOfDay } from "../lib/sunTimes.js";

// Schedule navigators (Design Bracket 2 — the day-spine + accordion rework).
// The day is navigated by its SHAPE: a load-spine (desktop, vertical) / a
// day-strip (phone, horizontal) is the primary control; selecting a segment
// drives the center to that one block (master-detail). Both read as a labelled
// TIME AXIS — each segment carries the block's sun-position glyph + start time,
// over a faint dawn->night wash — so tapping reads as "pick a time of day,"
// not "poke a box."
//
// Two coordinated markers everywhere a "current vs chosen" split exists:
//   the CLOCK's pick gets a RING (now);  YOUR pick gets a FILL (focus/selected).
// Same rule on the spine, the strip, and the week pane (today=ring, viewed=fill).

// Scale an item count to a bar size in px, between min and min+span.
function barSize(count, max, min, span) {
  if (!count) return min;
  return Math.round(min + (count / Math.max(1, max)) * span);
}

// Coarse-duration sizing for Project gaps — three steps (short / mid / long),
// not pixel-accurate (the duration-to-height navigator rewrite is deferred).
function projSize(durationMin, min, span) {
  const t = durationMin == null ? 0.25
    : durationMin >= 150 ? 1 : durationMin >= 60 ? 0.55 : 0.25;
  return Math.round(min + t * span);
}

// Short who's-free tag for a Project gap's structured availability.
function freeShort(who) {
  const n = who?.freeCount ?? 0;
  if (n >= 2) return "both";
  if (n === 1) return who?.who?.[0] ?? "";
  return "";
}

// The heaviest chore-block load on the day (Project gaps carry no count).
function maxLoad(blocks) {
  return blocks.reduce((m, b) => Math.max(m, b.count ?? 0), 1);
}

// Compact clock label ("6a", "8:30a", "1p") — the time axis.
function compactTime(min) {
  if (min == null) return "";
  return formatMinutesOfDay(min).replace(":00", "");
}

// Split a strip time into its numeric part and am/pm period so the phone
// strip can stack them on two fixed lines. Without this the inline
// "5:15 AM" wraps where it likes, giving some columns one tier and others
// three — F41. The number line never wraps; am/pm always sits on its own
// line; every column is exactly two tiers tall.
function StripTime({ min, className }) {
  const full = compactTime(min);
  const sp = full.lastIndexOf(" ");
  const num = sp === -1 ? full : full.slice(0, sp);
  const period = sp === -1 ? "" : full.slice(sp + 1);
  return (
    <span className={className}>
      <span className="block leading-tight whitespace-nowrap">{num}</span>
      <span className="block leading-tight text-[8px] tracking-wider">
        {period}
      </span>
    </span>
  );
}

// ── Desktop load-spine (the primary navigator) ──────────────────────────
// Restyled to the WeekStrip visual language (findings slice B): no dividers,
// an outlined active row (the border IS the indicator), lighter-on-hover,
// equal heights, lettered KindBadge identity, and the canonical NowRule in
// the list. Block names collapse to "Chores" (F12) — the C badge + time
// carry the identity, like every project reads "Project".
export function DayRailSpine({
  blocks, focus, nowBucket, nowMin, onPick, onWholeDay,
}) {
  const overview = focus == null;
  const nowTime = nowMin != null ? compactTime(nowMin) : null;

  // One row shell (F1/F2/F3): a border that stays transparent until the row
  // is the focus (the active bounding box); equal heights — the load rail
  // self-stretches now, so item count no longer drives the row height. The
  // CURRENT block reads as a green-accent fill + a "Now" tag (no divider rule).
  const rowCls = (isFocus, allDone, isNow) =>
    "relative z-[1] w-full flex items-center gap-2 px-2 py-2 text-left "
    + "min-h-[46px] border cursor-pointer transition-colors "
    + (isFocus
      ? "bg-row-active border-resolved "
      : (isNow ? "bg-accent/[0.08] " : "") + "border-transparent hover:bg-row-hover ")
    + (allDone ? "opacity-55" : "");

  return (
    <div className="hidden lg:flex flex-col gap-1 w-[180px] shrink-0 border-r border-line bg-bg relative px-2 pt-2">
      {/* Whole-day overview affordance (F4 — no "overview · N items" subtext;
          F5 — icon normalized to the row rhythm, neutral until active). */}
      <button
        type="button"
        onClick={onWholeDay}
        title="Show the whole day (overview)"
        className={rowCls(overview, false)}
      >
        <span className="w-1 shrink-0" />
        <LayoutList size={16}
          className={"shrink-0 " + (overview ? "text-fg" : "text-faint")} />
        <span className="flex-1 min-w-0 text-[13px] font-medium leading-tight">
          Whole day
        </span>
      </button>

      {blocks.map((b) => {
        const isFocus = b.bucket === focus;
        const isNow = nowTime != null && b.bucket === nowBucket;

        if (b.isProject) {
          const free = freeShort(b.who);
          return (
            <Fragment key={b.bucket}>
              <button
                type="button"
                onClick={() => onPick(b.bucket)}
                title={`Project${free ? " · " + free + " free" : ""}`}
                className={rowCls(isFocus, b.allDone, isNow)}
              >
                {/* thin slate gap rail — full height; the P badge carries the
                    identity now, so the title is plain text (F10). */}
                <span className="w-1 self-stretch shrink-0 bg-project/25 ring-1 ring-inset ring-project/40" />
                <KindBadge kind="project" size={16} title="Project" />
                <span className="flex-1 min-w-0">
                  <span className={
                    "block text-[13px] truncate leading-tight text-fg "
                    + (isFocus ? "font-semibold" : "font-medium")
                  }>
                    Project
                  </span>
                  <span className="block text-[10px] [font-variant-numeric:tabular-nums] leading-tight">
                    {isNow && <><NowTag /><span className="text-faint"> · </span></>}
                    <span className="text-faint">{compactTime(b.startMin)}</span>
                    {free && (
                      <span className="text-project font-semibold"> · {free} free</span>
                    )}
                  </span>
                </span>
              </button>
            </Fragment>
          );
        }

        // Events ride the block list too, where present — a periwinkle E badge
        // + the event title + its start time (a thin periwinkle gap rail).
        if (b.kind === "event") {
          const occ = b.occ;
          return (
            <Fragment key={b.bucket}>
              <button
                type="button"
                onClick={() => onPick(b.bucket)}
                title={occ?.instanceLabel ?? "Event"}
                className={rowCls(isFocus, false, isNow)}
              >
                <span className="w-1 self-stretch shrink-0 bg-event/25 ring-1 ring-inset ring-event/40" />
                <KindBadge kind="event" size={16} title="Event" />
                <span className="flex-1 min-w-0">
                  <span className={
                    "block text-[13px] truncate leading-tight text-fg "
                    + (isFocus ? "font-semibold" : "font-medium")
                  }>
                    {occ?.instanceLabel ?? "Event"}
                  </span>
                  <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint leading-tight truncate">
                    {isNow && <><NowTag /><span> · </span></>}
                    {b.startMin != null ? compactTime(b.startMin) : "All day"}
                  </span>
                </span>
              </button>
            </Fragment>
          );
        }

        // Every remaining block is a chore block. Regular blocks read "Chores"
        // (F12); the overnight wrap reads "Overnight" + a Moon badge on the
        // right edge (teal). The C badge + time carry the identity (F6: no
        // done/count suffix in the title).
        const count = b.count ?? 0;
        const doneFrac = count ? (b.done ?? 0) / count : 0;
        // F14 — overnight reads "Until <end>" (lead, rode in from yesterday)
        // or "After <start>" (trail, runs into tomorrow); else the start time.
        const timeText = b.isOvernight
          ? (b.side === "lead"
            ? "Until " + compactTime(b.winEnd)
            : "After " + compactTime(b.winStart))
          : compactTime(b.startMin);
        return (
          <Fragment key={b.bucket}>
            <button
              type="button"
              onClick={() => onPick(b.bucket)}
              title={`${b.isOvernight ? "Overnight" : "Chores"} · ${b.done ?? 0}/${count}`}
              className={rowCls(isFocus, b.allDone, isNow)}
            >
              {/* load rail: done (resolved green) rises from the bottom over the
                  committed remainder in the chore identity color (teal); full
                  row height (F3). */}
              <span className="w-1 self-stretch shrink-0 flex flex-col-reverse bg-surface-alt ring-1 ring-inset ring-line">
                <span style={{
                  height: (count ? Math.round(doneFrac * 100) : 0) + "%",
                  background: "var(--c-resolved)",
                }} />
                <span style={{
                  height: (count ? Math.round((1 - doneFrac) * 100) : 0) + "%",
                  background: "var(--c-chore)", opacity: 0.9,
                }} />
              </span>
              <KindBadge kind="chore" size={16} title="Chores" />
              <span className="flex-1 min-w-0">
                <span className={
                  "block text-[13px] truncate leading-tight text-fg "
                  + (isFocus ? "font-semibold" : "font-medium")
                }>
                  {b.isOvernight ? "Overnight" : "Chores"}
                </span>
                <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint leading-tight truncate">
                  {isNow && <><NowTag /><span> · </span></>}
                  {timeText}
                </span>
              </span>
              {b.hasManDown && (
                <AlertTriangle size={13} className="shrink-0 text-warn" />
              )}
              {/* F24b — the day-load's warn/due ClockAlert repeats on the
                  block that owns the warming chore (count hidden; the row is
                  one block, so the hover detail carries the names). */}
              <WarmingBadge
                warn={b.warn} due={b.due} size={13} showCount={false}
              />
              {/* Overnight wrap: a teal Moon on the right edge of the block. */}
              {b.isOvernight && (
                <Moon size={14} className="shrink-0 text-chore" title="Overnight" />
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Phone day-strip (the navigable time axis — James's tweak) ───────────
export function DayStrip({
  blocks, focus, nowBucket, onPick, onWholeDay,
}) {
  const max = maxLoad(blocks);
  const overview = focus == null;
  return (
    <div className="lg:hidden border-b border-line bg-surface">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="eyebrow text-[10px] text-faint">Day · tap a time</span>
        <button
          type="button"
          onClick={onWholeDay}
          className={
            "inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 "
            + "border cursor-pointer transition-colors "
            + (overview
              ? "border-accent-deep bg-[color:var(--row-active)] text-accent"
              : "border-line text-muted hover:text-dim")
          }
        >
          <LayoutList size={12} /> Whole day
        </button>
      </div>
      <div className="px-4 pb-2">
        <div className="flex items-end gap-1.5 border-b border-line">
          {blocks.map((b) => {
            if (b.isProject) {
              const free = freeShort(b.who);
              const h = projSize(b.durationMin, 14, 40);
              const isFocus = b.bucket === focus;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  onClick={() => onPick(b.bucket)}
                  title={`Project${free ? " · " + free + " free" : ""}`}
                  className={
                    "flex-1 min-w-0 flex flex-col items-center cursor-pointer "
                    + (b.allDone ? "opacity-60" : "")
                  }
                >
                  <span className="relative w-full h-[56px] flex items-end justify-center">
                    <span
                      className={
                        "w-full bg-project/25 ring-1 ring-inset "
                        + (isFocus ? "ring-project" : "ring-project/40")
                      }
                      style={{ height: h + "px" }}
                    />
                  </span>
                  <FolderKanban size={14} className="mt-1.5 text-project" />
                  <StripTime
                    min={b.startMin}
                    className={
                      "mt-0.5 pb-0.5 text-center text-[10.5px] "
                      + "[font-variant-numeric:tabular-nums] "
                      + "border-b-2 text-project font-medium "
                      + (isFocus ? "border-project font-bold" : "border-transparent")
                    }
                  />
                </button>
              );
            }
            if (b.isOvernight) {
              const isFocus = b.bucket === focus;
              const isNow = b.bucket === nowBucket;
              const Icon = b.side === "lead" ? ClockArrowLeft : ClockArrowRight;
              return (
                <button
                  key={b.bucket}
                  type="button"
                  onClick={() => onPick(b.bucket)}
                  title={`Overnight · ${b.rangeLabel}`}
                  className={
                    "flex-1 min-w-0 flex flex-col items-center cursor-pointer "
                    + (b.allDone ? "opacity-60" : "")
                  }
                >
                  <span className="relative w-full h-[56px] flex items-end justify-center">
                    <span
                      className="w-full h-[20px]"
                      style={{
                        background: "var(--accent-deep)", opacity: 0.55,
                        boxShadow: isNow ? "0 0 0 2px var(--resolved)"
                          : isFocus ? "inset 0 0 0 1px var(--accent-deep)" : "none",
                      }}
                    />
                  </span>
                  <Icon size={14}
                    className={"mt-1.5 " + (isNow ? "text-resolved" : "text-accent-deep")} />
                  <span className={
                    "mt-0.5 pb-0.5 text-[10.5px] [font-variant-numeric:tabular-nums] "
                    + "border-b-2 truncate max-w-full "
                    + (isFocus ? "text-accent-deep font-bold border-accent-deep"
                      : isNow ? "text-resolved font-bold border-transparent"
                        : "text-faint border-transparent")
                  }>
                    o/n
                  </span>
                </button>
              );
            }
            const isNow = b.bucket === nowBucket;
            const isFocus = b.bucket === focus;
            const Icon = blockIcon(b.block);
            const h = barSize(b.count, max, 14, 40);
            const fillH = b.count ? Math.round(h * (b.done / b.count)) : 0;
            const remH = b.count ? h - fillH : 0;
            return (
              <button
                key={b.bucket}
                type="button"
                onClick={() => onPick(b.bucket)}
                title={`${b.name} · ${b.done}/${b.count}`}
                className={
                  "flex-1 min-w-0 flex flex-col items-center cursor-pointer "
                  + (b.allDone ? "opacity-60" : "")
                }
              >
                <span className="relative w-full h-[56px] flex items-end justify-center">
                  {b.hasManDown && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-warn"
                      style={{ boxShadow: "0 0 0 2px var(--bg)" }} />
                  )}
                  <span
                    className="relative w-full flex flex-col-reverse"
                    style={{
                      height: h + "px",
                      background: "var(--surface-alt)",
                      boxShadow: isNow
                        ? "0 0 0 2px var(--resolved)"
                        : isFocus
                          ? "inset 0 0 0 1px var(--accent)"
                          : "inset 0 0 0 1px var(--line)",
                    }}
                  >
                    <span style={{ height: fillH + "px", background: "var(--resolved)" }} />
                    <span style={{ height: remH + "px", background: "var(--accent-deep)", opacity: 0.85 }} />
                  </span>
                </span>
                <Icon size={14}
                  className={"mt-1.5 " + (isNow ? "text-resolved" : "text-faint")} />
                <StripTime
                  min={b.startMin}
                  className={
                    "mt-0.5 pb-0.5 text-center text-[10.5px] "
                    + "[font-variant-numeric:tabular-nums] "
                    + "border-b-2 transition-colors "
                    + (isFocus
                      ? "text-accent font-bold border-accent"
                      : isNow
                        ? "text-resolved font-bold border-transparent"
                        : "text-faint border-transparent")
                  }
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// (Round-3 NO-LEGACY) `WeekList` was deleted — the desktop week sidebar is now
// the one `WeekStrip` (ui.jsx), reading the shared farmLoad week/heat. It folded
// in this pane + the old center `WeekSpines`.
