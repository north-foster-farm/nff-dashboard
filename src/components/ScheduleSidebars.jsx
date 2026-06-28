import {
  LayoutList, AlertTriangle, FolderKanban,
  ClockArrowRight, ClockArrowLeft,
} from "lucide-react";
import { blockIcon } from "./BlockBadge.jsx";
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

// The day's light as a token wash: dawn warm -> midday neutral -> night cool.
// (Vertical only — the desktop spine. The phone strip dropped its
// horizontal wash: at strip scale the gradient cut across the icons/labels
// and never sat flush, so it's plain surface now. F38.)
const WASH_V = "linear-gradient(180deg,rgba(230,184,90,0.085) 0%,"
  + "rgba(173,200,173,0.04) 40%,rgba(120,140,175,0.04) 72%,"
  + "rgba(70,92,135,0.11) 100%)";

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

// ── Desktop load-spine (the primary navigator) ──────────────────────────
export function DayRailSpine({
  blocks, focus, nowBucket, onPick, onWholeDay, totalItems,
}) {
  const max = maxLoad(blocks);
  const overview = focus == null;
  return (
    <div className="hidden lg:flex flex-col w-[180px] shrink-0 border-r border-line bg-surface relative pt-2">
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{ background: WASH_V }} />
      {/* Whole-day overview affordance — the explicit way back to the agenda. */}
      <button
        type="button"
        onClick={onWholeDay}
        title="Show the whole day (overview)"
        className={
          "relative z-[1] w-full flex items-center gap-2.5 px-3 py-2.5 text-left "
          + "border-b border-line cursor-pointer transition-colors "
          + (overview ? "bg-row-active text-fg" : "text-dim hover:bg-row-hover hover:text-fg")
        }
      >
        <LayoutList size={16}
          className={"shrink-0 " + (overview ? "text-accent" : "")} />
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block text-[13px] font-medium">Whole day</span>
          <span className="block text-[10px] text-faint">
            overview · {totalItems} items
          </span>
        </span>
        {overview && (
          <span className="eyebrow text-[9px] text-accent">open</span>
        )}
      </button>

      {blocks.map((b) => {
        if (b.isProject) {
          const free = freeShort(b.who);
          const h = projSize(b.durationMin, 16, 34);
          const isFocus = b.bucket === focus;
          return (
            <button
              key={b.bucket}
              type="button"
              onClick={() => onPick(b.bucket)}
              title={`Project${free ? " · " + free + " free" : ""}`}
              className={
                "relative z-[1] w-full flex items-center gap-2.5 px-3 py-2 "
                + "text-left min-h-[52px] border-b border-line cursor-pointer "
                + "transition-colors "
                + (isFocus ? "bg-row-active" : "hover:bg-row-hover")
                + (b.allDone ? " opacity-55" : "")
              }
            >
              {/* soft slate-blue gap gauge — coarse-duration sized, de-hatched */}
              <span
                className="shrink-0 w-[16px] bg-project/25 ring-1 ring-inset ring-project/40"
                style={{ height: h + "px" }}
              />
              <FolderKanban size={15} className="shrink-0 text-project" />
              <span className="flex-1 min-w-0">
                <span className={
                  "block text-[12px] truncate font-medium text-project "
                  + (isFocus ? "font-semibold" : "")
                }>
                  Project{b.count > 0 ? ` · ${b.done}/${b.count}` : ""}
                </span>
                <span className="block text-[10px] [font-variant-numeric:tabular-nums]">
                  <span className="text-faint">{compactTime(b.startMin)}</span>
                  {free && (
                    <span className="text-project font-semibold"> · {free} free</span>
                  )}
                </span>
              </span>
              {isFocus && (
                <span className="absolute right-0 top-0 bottom-0 w-[2px] bg-project" />
              )}
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
                "relative z-[1] w-full flex items-center gap-2.5 px-3 py-2 "
                + "text-left min-h-[52px] border-b border-line cursor-pointer "
                + "transition-colors "
                + (isFocus ? "bg-row-active" : "hover:bg-row-hover")
                + (b.allDone ? " opacity-55" : "")
              }
            >
              <span
                className="shrink-0 w-[16px] h-[20px]"
                style={{
                  background: "var(--accent-deep)", opacity: 0.55,
                  boxShadow: isNow ? "0 0 0 2px var(--resolved)" : "none",
                }}
              />
              <Icon size={15}
                className={"shrink-0 "
                  + (isNow ? "text-resolved" : "text-accent-deep")} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1 text-[12px] font-medium text-fg">
                  <span className="truncate">
                    Overnight{b.count > 0 ? ` · ${b.done}/${b.count}` : ""}
                  </span>
                  {/* "now" rides the title line as a shrink-0 marker so it's
                      never clipped by the range label's truncation (F63). */}
                  {isNow && (
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-resolved font-bold">
                      now
                    </span>
                  )}
                </span>
                <span className="block text-[10px] [font-variant-numeric:tabular-nums] text-faint truncate">
                  {b.rangeLabel}
                </span>
              </span>
              {isFocus && (
                <span className="absolute right-0 top-0 bottom-0 w-[2px] bg-accent-deep" />
              )}
            </button>
          );
        }
        const isNow = b.bucket === nowBucket;
        const isFocus = b.bucket === focus;
        const Icon = blockIcon(b.block);
        const h = barSize(b.count, max, 16, 34);
        const fillH = b.count ? Math.round(h * (b.done / b.count)) : 0;
        const remH = b.count ? h - fillH : 0;
        return (
          <button
            key={b.bucket}
            type="button"
            onClick={() => onPick(b.bucket)}
            title={`${b.name} · ${b.done}/${b.count}`}
            className={
              "relative z-[1] w-full flex items-center gap-2.5 px-3 py-2 text-left "
              + "min-h-[52px] border-b border-line cursor-pointer "
              + "transition-colors "
              + (isFocus ? "bg-row-active" : "hover:bg-row-hover")
              + (b.allDone ? " opacity-55" : "")
            }
          >
            {/* the gauge: height = load; done (resolved) rises from the bottom
                over the committed load (accent-deep); ring = now. */}
            <span
              className="relative shrink-0 w-[16px] flex flex-col-reverse"
              style={{
                height: h + "px",
                background: "var(--surface-alt)",
                boxShadow: isNow
                  ? "0 0 0 2px var(--resolved)"
                  : "inset 0 0 0 1px var(--line)",
              }}
            >
              <span style={{ height: fillH + "px", background: "var(--resolved)" }} />
              <span style={{ height: remH + "px", background: "var(--accent-deep)", opacity: 0.85 }} />
            </span>
            <Icon
              size={15}
              className={"shrink-0 "
                + (isNow ? "text-resolved" : isFocus ? "text-accent" : "text-faint")}
            />
            <span className="flex-1 min-w-0">
              <span className={
                "block text-[13px] truncate "
                + (isFocus ? "font-semibold text-fg" : "text-fg")
              }>
                {b.name}
              </span>
              <span className="block text-[10px] [font-variant-numeric:tabular-nums]">
                <span className="text-faint">{compactTime(b.startMin)}</span>
                {isNow && <span className="text-resolved font-semibold"> · now</span>}
              </span>
            </span>
            {b.hasManDown && (
              <AlertTriangle size={13} className="shrink-0 text-warn" />
            )}
            {isFocus && (
              <span className="absolute right-0 top-0 bottom-0 w-[2px] bg-accent" />
            )}
          </button>
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
                  <span className={
                    "mt-0.5 pb-0.5 text-[10.5px] [font-variant-numeric:tabular-nums] "
                    + "border-b-2 text-project font-medium "
                    + (isFocus ? "border-project font-bold" : "border-transparent")
                  }>
                    {compactTime(b.startMin)}
                  </span>
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
                <span className={
                  "mt-0.5 pb-0.5 text-[10.5px] [font-variant-numeric:tabular-nums] "
                  + "border-b-2 transition-colors "
                  + (isFocus
                    ? "text-accent font-bold border-accent"
                    : isNow
                      ? "text-resolved font-bold border-transparent"
                      : "text-faint border-transparent")
                }>
                  {compactTime(b.startMin)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Week pane: today = ring, viewed = fill (the dual-marker graft) ──────
export function WeekList({ week, todayISO, selectedISO, ymd, onPickDay }) {
  return (
    <div className="hidden lg:block border-l border-line py-5 px-4 bg-surface w-[300px]">
      <div className="text-[10px] font-ui font-semibold uppercase tracking-[0.16em] text-faint mb-4">
        This week
      </div>
      <div className="flex flex-col gap-1">
        {week.days.map((day) => {
          const iso = ymd(day.date);
          const isToday = iso === todayISO;
          const isSel = iso === selectedISO;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay?.(day.date)}
              className={
                "w-full flex items-center gap-3 px-2 py-2 text-left border cursor-pointer "
                + (isSel ? "bg-row-active " : "hover:bg-row-hover ")
                + (isToday ? "border-resolved" : "border-transparent")
              }
            >
              <span className={
                "w-12 shrink-0 text-[12px] [font-variant-numeric:tabular-nums] "
                + (isSel ? "font-semibold text-fg" : "text-dim")
              }>
                {day.date.toLocaleDateString("en-US", {
                  weekday: "short",
                }).slice(0, 3)}{" "}
                {day.date.getDate()}
              </span>
              <span className="flex-1 flex items-end gap-1 h-7">
                {day.blocks.map((b) => (
                  <span
                    key={b.bucket}
                    title={`${b.name} · ${b.count}`}
                    style={{ height: barSize(b.count, week.max, 3, 25) + "px" }}
                    className={
                      "flex-1 min-w-[3px] "
                      + (b.count ? "bg-accent/70" : "bg-line")
                    }
                  />
                ))}
              </span>
              <span className="w-10 shrink-0 text-right text-[11px] text-faint [font-variant-numeric:tabular-nums] inline-flex items-center justify-end gap-1">
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-resolved"
                    title="Today" />
                )}
                {day.total}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 pt-4 border-t border-line text-[11px] text-faint font-ui space-y-1">
        <div>Taller bar = heavier block. Tap a day to open it.</div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 border border-resolved inline-block" /> today
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 bg-[color:var(--row-active)] inline-block" /> viewing
          </span>
        </div>
      </div>
    </div>
  );
}
