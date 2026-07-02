// Shared UI kit (Batch 39 — design-system consolidation).
//
// Tailwind-native home for the class strings and tiny components that
// were being copy-pasted across pages. This supersedes the old
// inline-`style={{T.*}}` primitives.jsx; new shared UI lands here.
//
// Class constants are exported as strings so call sites can append
// per-use tweaks (`INPUT_CLS + " w-full"`), exactly how the inlined
// copies were used.

import { useState } from "react";
import { Check, AlertTriangle, ClockAlert, Moon, X } from "lucide-react";

// ── form controls ──────────────────────────────────────────────────────
// LABEL_CLS was byte-identical in 4 files. The two input roots differ
// only by surface (bg-bg sits on a card; bg-surface sits on the page).
export const LABEL_CLS =
  "text-[9px] text-faint uppercase tracking-[0.12em] mb-1";

export const INPUT_CLS =
  "bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none " +
  "focus:border-accent font-[inherit]";

export const INPUT_SURFACE_CLS =
  "bg-surface border border-line text-fg text-[13px] px-2.5 py-2 " +
  "outline-none focus:border-accent font-[inherit]";

// ── buttons ─────────────────────────────────────────────────────────────
export const BTN_ACCENT =
  "inline-flex items-center gap-1.5 bg-accent text-on-accent border " +
  "border-accent font-[inherit] text-[11px] font-semibold uppercase " +
  "tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50";

export const BTN_GHOST =
  "bg-transparent border border-line text-dim font-[inherit] text-[10px] " +
  "font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 cursor-pointer " +
  "hover:text-fg hover:bg-row-hover transition-colors disabled:opacity-50";

export const BTN_GHOST_WARN = BTN_GHOST + " text-warn hover:text-warn";

// ── KindBadge: lettered identity box (C / P / E) ────────────────────────
// The Schedule identity system (F8): every chore / project / event block is
// marked by a single Inter-600 letter in a tight bordered square, tinted to
// the kind's color token (chore = amber-glow, project = slate-blue, event =
// periwinkle). Replaces the per-block Lucide glyphs and reads the same in
// the block list, the week-pane day symbols, and the day-load. `size` is the
// square's px edge; the letter scales with it.
//
// Each kind carries a faint background WASH in its own hue (chore=teal,
// project=slate, event=periwinkle) on top of the bordered letter — the colored
// fill is what tells C/P/E apart at a glance when they sit adjacent (the three
// hues are close enough that border+letter alone read as "three blue boxes").
const KIND_BADGE = {
  chore:   { letter: "C", cls: "text-chore border-chore bg-chore/[0.16]" },
  project: { letter: "P", cls: "text-project border-project bg-project/[0.16]" },
  event:   { letter: "E", cls: "text-event border-event bg-event/[0.16]" },
};

export function KindBadge({ kind, size = 16, title, className = "" }) {
  const k = KIND_BADGE[kind];
  if (!k) return null;
  return (
    <span
      title={title}
      aria-label={title || kind}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
      className={
        "inline-flex items-center justify-center shrink-0 border font-ui " +
        "font-semibold leading-none [font-variant-numeric:tabular-nums] " +
        k.cls + (className ? " " + className : "")
      }
    >
      {k.letter}
    </span>
  );
}

// ── Pane: flush bordered in-page section ────────────────────────────────
// The default content container (DESIGN principle 1: flush, not raised). A
// hairline `border` on `--c-bg` — never `bg-surface`; only floating elements
// over a scrim (sheets/modals/trays) stay raised. Supersedes the old raised
// `Card`, folded in here (NO-LEGACY). `title` renders as the Inter uppercase
// eyebrow header, name-compatible with the four former Card call sites;
// `eyebrow` is an alias. `tone="warn"` tints the whole pane with a flat warn
// fill (color-mix, not a raised tint). `subtitle` floats to the header right;
// `actions` sit at the header right when there is no subtitle.
export function Pane({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  children,
  className = "",
  tone,
}) {
  const label = title ?? eyebrow;
  const style =
    tone === "warn"
      ? { background: "color-mix(in srgb, var(--c-warn) 7%, var(--c-bg))" }
      : undefined;
  return (
    <section
      className={"border border-line py-4 px-5 flex flex-col " + className}
      style={style}
    >
      {(label || subtitle || actions) && (
        <header className="flex items-baseline gap-2.5 mb-3">
          {Icon && <Icon size={14} className="text-dim translate-y-0.5" />}
          {label && (
            <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
              {label}
            </div>
          )}
          {subtitle && (
            <div className="text-[12px] text-dim ml-auto">{subtitle}</div>
          )}
          {actions && <div className="ml-auto">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

// ── NowRule: the now-marker (dot + "Now · time" + green hairline) ───────
// One canonical now-divider, today-views only (gate at the call site). The
// label + dot sit INLINE at the left and the green hairline fills the rest of
// the row to the right (the rule is "broken" by the text — matches the style
// guide). Pass a preformatted `time` string (keeps this kit free of the
// schedule time utils); `label` overrides the whole "Now · time" text.
// Used by the phone Today glance (a divider, no block row to highlight); the
// desktop Schedule marks now on the block row itself via `NowTag` instead.
export function NowRule({ time, label, className = "" }) {
  return (
    <div className={"flex items-center gap-2 px-4 pt-2 " + className}>
      <span
        className="shrink-0 w-[7px] h-[7px] rounded-full"
        style={{
          background: "var(--c-resolved)",
          boxShadow: "0 0 0 3px rgba(76,186,133,0.22)",
        }}
      />
      <span className="shrink-0 text-[10px] font-ui font-semibold uppercase tracking-[0.14em] text-resolved">
        {label ?? "Now" + (time != null ? " · " + time : "")}
      </span>
      <span className="flex-1 border-t border-resolved" />
    </div>
  );
}

// ── NowTag: the inline "Now" word for the current block row ─────────────
// The desktop Schedule marks the current block by a green-accent row fill +
// this small "Now" word in primary green, rather than a separate divider rule
// (a rule above a row read as belonging to the gap, not the block). Drop it
// into the row that is "now".
export function NowTag({ className = "" }) {
  return (
    <span
      className={
        "shrink-0 inline-flex items-center font-ui text-[10px] font-bold " +
        "uppercase tracking-[0.12em] text-accent " + className
      }
    >
      Now
    </span>
  );
}

// ── Tooltip: the real hover tip (F41) ───────────────────────────────────
// Replaces native `title` wherever the tip should be instant or formatted
// (multi-line, bold lead-ins, mixed color) — native tooltips lag ~1s and
// are plain text. Hover shows it; a tap toggles it (touch has no hover —
// the a11y trade-off is accepted for this internal app). `tip` takes a
// string (newlines become line breaks) or JSX. The tip ignores pointer
// events so it never steals the hover from its trigger, and the wrapper
// deliberately does NOT stopPropagation — a badge inside a clickable row
// must not eat the row's click.
export function Tooltip({ tip, side = "top", className = "", children }) {
  const [open, setOpen] = useState(false);
  if (!tip) return children ?? null;
  const pos = side === "bottom"
    ? "top-full mt-1.5"
    : "bottom-full mb-1.5";
  return (
    <span
      className={"relative inline-flex " + className}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={
            "absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none " +
            pos + " w-max max-w-[240px] px-2.5 py-1.5 " +
            "bg-surface border border-line shadow-md " +
            "font-ui text-[11px] font-normal leading-snug text-dim " +
            "text-left whitespace-pre-line normal-case tracking-normal"
          }
        >
          {tip}
        </span>
      )}
    </span>
  );
}

// ── CheckTarget: the one 28px completion box, app-wide ──────────────────
// Factored out of ChoreCheckRow so the Schedule accordion, the Rounds doing
// surface, and anything else checkable share ONE tap target writing through
// the same `completions.toggle` -> outbox path (the completion path itself is
// untouched). `queued` (a tick sitting in the device-local outbox) warms the
// box border so the unsynced state reads on the target, not only the row.
export function CheckTarget({
  done,
  queued,
  pending,
  onToggle,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      className={
        "shrink-0 w-7 h-7 border-2 inline-flex items-center justify-center " +
        "cursor-pointer transition-colors duration-100 " +
        (done
          ? "bg-resolved border-resolved text-on-accent"
          : queued
          ? "bg-bg border-warn text-transparent hover:border-fg"
          : "bg-bg border-line text-transparent hover:border-fg") +
        " " + className
      }
      aria-pressed={done}
      aria-label={done ? "Mark not done" : "Mark done"}
    >
      <Check size={16} strokeWidth={3} />
    </button>
  );
}

// ── AttentionCard: the one amber obligation surface ─────────────────────
// The single emphatic needs-cover / overdue card (C6). Flush — a flat warn
// `color-mix` body fill + a 50%-warn border, NOT a raised tint; the hatch
// texture lives only in the text-free LoadSpine man-down bar (C4), never
// behind this prose. `kind` swaps the eyebrow word; `work` is the Lora work
// line; `action` (+ `onAct`) is a solid-amber button. Absorbs Schedule's
// `blockAlerts` man-down card. The compact one-line `AttentionCard.Row`
// (Hole.row) absorbs ChoreCheckRow's escalation chrome for inline use.
export function AttentionCard({
  kind = "cover",
  work,
  where,
  reason,
  action,
  onAct,
  note,
  className = "",
}) {
  const eyebrow = kind === "overdue" ? "Overdue" : "Needs cover";
  return (
    <div
      className={"border " + className}
      style={{
        borderColor: "color-mix(in srgb, var(--c-warn) 50%, transparent)",
        background: "color-mix(in srgb, var(--c-warn) 7%, var(--c-bg))",
      }}
    >
      <div
        className="px-3 py-2 flex items-center gap-2 border-b"
        style={{
          borderColor: "color-mix(in srgb, var(--c-warn) 22%, transparent)",
        }}
      >
        <AlertTriangle size={15} className="shrink-0 text-warn" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-warn">
          {eyebrow}
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="font-heading text-[15px] font-medium text-fg">
          {work}{where ? ` · ${where}` : ""}
        </div>
        {reason && (
          <div className="text-[12px] text-dim mt-1 leading-snug">
            {reason}
          </div>
        )}
        {action && (
          <button
            type="button"
            onClick={onAct}
            className="w-full mt-2.5 bg-warn text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.1em]"
          >
            {action}
          </button>
        )}
        {note && (
          <div className="font-ui text-[11px] text-faint mt-2.5 leading-snug">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

// The compact one-line variant — a flush amber row for inline escalation
// (e.g. an overdue chore in a list) where a full card would be too loud.
AttentionCard.Row = function AttentionRow({
  kind = "overdue",
  work,
  where,
  action,
  onAct,
  className = "",
}) {
  return (
    <div
      className={"flex items-center gap-2 px-3 py-2 " + className}
      style={{
        background: "color-mix(in srgb, var(--c-warn) 7%, var(--c-bg))",
      }}
    >
      <AlertTriangle size={14} className="shrink-0 text-warn" />
      <span className="flex-1 min-w-0 text-[13px] text-fg truncate">
        {work}
        {where && <span className="text-dim"> · {where}</span>}
      </span>
      {action && (
        <button
          type="button"
          onClick={onAct}
          className="shrink-0 font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-warn border border-warn/50 px-2 py-1 cursor-pointer hover:bg-warn hover:text-on-accent"
        >
          {action}
        </button>
      )}
    </div>
  );
};

// ── FinishStamp: the whole-run completion stamp ─────────────────────────
// Replaces the "Sealed"/"the seal" language (C5) with a plain celadon ✓ in a
// square + a "Finished · who · window · N/N" line. Applies to a whole run,
// never a sub-bucket. Block completion auto-derives; this is the read-out.
export function FinishStamp({
  who,
  window,
  ratio,
  label = "Finished",
  className = "",
}) {
  return (
    <div className={"flex items-center gap-3 " + className}>
      <span className="shrink-0 w-7 h-7 bg-resolved text-on-accent inline-flex items-center justify-center">
        <Check size={16} strokeWidth={3} />
      </span>
      <div className="font-ui text-[12px] font-semibold uppercase tracking-[0.12em] text-resolved">
        {[label, who, window, ratio].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

// ── WarmingBadge: the binary warn/due signal (F24/F25) ──────────────────
// The ClockAlert that replaces the old continuous should-heat tick. Reads a
// farmLoad warming bucket `{ warn:[…], due:[…] }` (entries name the chore +
// days-left). Color is binary: any DUE-today chore → red (`--c-cat-processing`,
// the deadline red); otherwise WARN amber (`--c-warn`). `×N` appears when more
// than one chore is warm; the hover names each chore + when it's due (F25). It
// sits INLINE — just the colored glyph, no background fill or padding — so it
// reads as part of the line it's on (the day-load summary, a block row, the
// week pane). Reused across all three surfaces.
export function WarmingBadge({
  warn = [], due = [], size = 14, showCount = true, className = "",
}) {
  const total = warn.length + due.length;
  if (!total) return null;
  const color = due.length ? "var(--c-cat-processing)" : "var(--c-warn)";
  // F41 — a real Tooltip, not the native `title`: instant, and each chore
  // name reads bold against its deadline text.
  const tip = (
    <>
      {due.map((c) => (
        <span key={"d" + c.title} className="block">
          <b className="text-fg font-semibold">{c.title}</b> — due today
        </span>
      ))}
      {warn.map((c) => (
        <span key={"w" + c.title} className="block">
          <b className="text-fg font-semibold">{c.title}</b>
          {" — "}
          {c.daysLeft === 1 ? "1 day" : c.daysLeft + " days"} left
        </span>
      ))}
    </>
  );
  return (
    <Tooltip tip={tip} className={className}>
      <span
        className={
          "inline-flex items-center gap-0.5 shrink-0 " +
          "[font-variant-numeric:tabular-nums]"
        }
        style={{ color }}
      >
        <ClockAlert size={size} />
        {showCount && total > 1 && (
          <span className="font-ui text-[10px] font-semibold leading-none">
            ×{total}
          </span>
        )}
      </span>
    </Tooltip>
  );
}

// ── LoadSpine: the day-load silhouette ──────────────────────────────────
// One bar per block, interleaved with the day's project gaps (B2: clamped to
// the track + an `overflow-hidden` frame so a heavy day can't bleed). Reads
// `farmLoad` spine bars directly. Color is by KIND, not a load-state ramp
// (F23/F26): a chore bar is `--c-chore` (amber, height ∝ item count); a
// man-down `hole` bar keeps the chore color and carries a conflict triangle
// (F23 — a symbol, not a hatch, replaces the old warn fill); a project bar is
// `--c-project` (slate, height ∝ block duration), solid when PLANNED and a blue
// cross-hatch when UNPLANNED (F26/F11). No per-bar counts (F23). The summary
// read sits BESIDE the spine. Absorbs the DayRibbon silhouette + DaySilhouette.
// Rounds keeps its own completion-fraction bar; this is the day-shape glance.
const HATCH_UNPLANNED =
  "repeating-linear-gradient(45deg," +
  "color-mix(in srgb, var(--c-project) 60%, transparent) 0 4px," +
  "transparent 4px 8px)";

export function LoadSpine({ blocks = [], summary, className = "" }) {
  const bars = blocks.filter(
    (b) => (b.total ?? 0) > 0 || b.state === "hole" || b.kind === "project");
  // Chore bars scale to the heaviest count; project bars scale to the longest
  // gap (two metrics: chores carry no duration, projects carry no count).
  const maxCount = Math.max(
    1, ...bars.filter((b) => b.kind !== "project").map((b) => b.total ?? 0));
  const dur = (b) => b.durationMin ?? ((b.endMin ?? 0) - (b.startMin ?? 0));
  const maxDur = Math.max(
    1, ...bars.filter((b) => b.kind === "project").map(dur));
  return (
    <div className={"flex items-center gap-3 " + className}>
      <div className="flex items-end gap-0.5 h-10 flex-1 min-w-0 border-b border-line overflow-hidden">
        {bars.length === 0 ? (
          <span className="self-center text-[10px] text-faint">—</span>
        ) : (
          bars.map((b) => {
            const isProject = b.kind === "project";
            const isHole = b.state === "hole";
            const h = isProject
              ? Math.min(100, Math.max(8, (dur(b) / maxDur) * 100))
              : Math.min(100, Math.max(8, ((b.total ?? 0) / maxCount) * 100));
            const style = { height: h + "%" };
            if (isProject) {
              if (b.planned) {
                style.background = "var(--c-project)";
              } else {
                style.backgroundImage = HATCH_UNPLANNED;
                style.boxShadow =
                  "inset 0 0 0 1px color-mix(in srgb," +
                  " var(--c-project) 45%, transparent)";
              }
            } else {
              style.background = "var(--c-chore)";
            }
            return (
              <div
                key={b.blockId ?? b.id}
                className="relative flex-1 min-w-[3px]"
                title={b.name ?? b.label ?? ""}
                style={style}
              >
                {isHole && (
                  // A conflict triangle reads as the man-down signal (F23). It
                  // sits in a tiny `--c-bg` chip so the warn glyph stays legible
                  // on the amber chore fill (amber-on-amber otherwise).
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 inline-flex items-center justify-center rounded-full"
                    style={{ background: "var(--c-bg)", padding: 1 }}
                  >
                    <AlertTriangle size={9} className="text-warn" />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {summary && (
        <div className="shrink-0 text-[11px] font-ui text-faint [font-variant-numeric:tabular-nums] whitespace-nowrap">
          {summary}
        </div>
      )}
    </div>
  );
}

// ── EventRow: one left-color-bar timeline row ───────────────────────────
// The shared timeline line — an inset 3px left bar in the category color +
// a faint color-mix wash (an inset shadow, not a real border, so rows stay
// column-aligned). Absorbs Overview's TimelineRow + Schedule's left-bar /
// EventEntry. `cat` is the resolved category color from the one token map;
// chore-time blue stays reserved for chore rows (C7).
export function EventRow({
  time,
  title,
  meta,
  cat,
  italic,
  metaIcon: MetaIcon,
  className = "",
}) {
  const style = cat
    ? {
        boxShadow: `inset 3px 0 0 0 ${cat}`,
        background: `color-mix(in srgb, ${cat} 9%, transparent)`,
      }
    : undefined;
  return (
    <div
      className={"flex items-center gap-3 py-1.5 px-3 text-[13px] " + className}
      style={style}
    >
      {time && (
        <span className="shrink-0 [font-variant-numeric:tabular-nums] text-dim whitespace-nowrap">
          {time}
        </span>
      )}
      <span
        className={"flex-1 min-w-0 truncate text-fg" + (italic ? " italic" : "")}
      >
        {title}
      </span>
      {meta && (
        <span className="shrink-0 text-dim text-[12px] whitespace-nowrap inline-flex items-center gap-1">
          {MetaIcon && <MetaIcon size={12} className="mb-[1px]" />}
          {meta}
        </span>
      )}
    </div>
  );
}

// ── WindowBar: the window-of-time track for one obligation ──────────────
// The L5 "should/must" signal kept as a visual, with the WORDS dropped
// (C3): a thin track whose fill = how much of the window is still open and
// whose color warms amber -> `--c-cat-processing` as it narrows. `remaining`
// (0..1) is the open fraction; `urgency` (0..1, 1 = closing) drives color.
// (The shared-curve aggregation that feeds it lands in Step 4.)
export function WindowBar({
  remaining = 1,
  urgency = 0,
  width = 64,
  className = "",
}) {
  const u = Math.max(0, Math.min(1, urgency));
  const color =
    u >= 1
      ? "var(--c-cat-processing)"
      : `color-mix(in srgb, var(--c-cat-processing) ${Math.round(u * 100)}%, var(--c-warn))`;
  return (
    <span
      className={"inline-flex items-center h-1.5 bg-surface-alt overflow-hidden " + className}
      style={{ width }}
      aria-hidden="true"
    >
      <span
        style={{
          width: Math.round(Math.max(0, Math.min(1, remaining)) * 100) + "%",
          height: "100%",
          background: color,
        }}
      />
    </span>
  );
}

// ── AlertStrip: one flush passive warn strip ────────────────────────────
// A flush, never-a-gate strip for ambient context — offline, "N changes
// since confirmed," yesterday's-unfinished. Absorbs the Schedule banner +
// the source-change ribbon. Passive: it informs, it doesn't block (the
// confirm-day affordance is separate). `tone` defaults to warn; `icon`
// overrides the leading glyph; `action` is an optional inline link (e.g. an
// on-demand "Details" toggle); `onDismiss`, when given, adds a trailing ✕ so
// an ambient strip can be cleared until its signal changes (F28).
export function AlertStrip({
  children,
  icon: Icon = AlertTriangle,
  tone = "warn",
  action,
  onAct,
  onDismiss,
  className = "",
}) {
  const toneColor = tone === "info" ? "var(--c-accent)" : "var(--c-warn)";
  return (
    <div
      className={"flex items-center gap-2 px-3 py-2 text-[12px] " + className}
      style={{
        background: `color-mix(in srgb, ${toneColor} 7%, var(--c-bg))`,
        boxShadow: `inset 3px 0 0 0 ${toneColor}`,
      }}
    >
      {Icon && (
        <Icon
          size={14}
          className={"shrink-0 " + (tone === "info" ? "text-accent" : "text-warn")}
        />
      )}
      <span className="flex-1 min-w-0 text-dim">{children}</span>
      {action && (
        <button
          type="button"
          onClick={onAct}
          className="shrink-0 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-dim hover:text-fg cursor-pointer"
        >
          {action}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-faint hover:text-fg cursor-pointer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

// ── WeekStrip: the week, drawn ONCE ─────────────────────────────────────
// The desktop week sidebar: a row per day — day label · count mini-spine · the
// per-day identity symbols (an "E" KindBadge when the day has an event, a
// conflict triangle when it has man-down conflicts; F17). Collapses the old
// WeekSpines (center) + WeekList (sidebar). Bars are capped + `overflow-hidden`;
// an overbooked day clamps rather than overflowing (B1). The old should-heat
// tick is gone (F24 — warming is the day-load ClockAlert now). `ymd` is passed
// in to keep this kit free of the date utils.
// (Round-3 NO-LEGACY) The phone `layout="header"` variant + `weekHeatColor`
// were deleted — only the desktop sidebar consumes WeekStrip.
const WEEK_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekStrip({
  week,
  todayISO,
  selectedISO,
  ymd,
  onPickDay,
  conflictsByISO,
  warmingByISO,
  overnightByISO,
  className = "",
}) {
  if (!week?.days?.length || !ymd) return null;
  const max = week.max || 1;

  // Sidebar: a row per day.
  return (
    <div className={"flex flex-col gap-1 " + className}>
      {week.days.map((day) => {
        const iso = ymd(day.date);
        const isToday = iso === todayISO;
        const isSel = iso === selectedISO;
        // F17 — the right cell carries identity symbols, not a number + heat
        // box: an "E" badge when the day has an event, a conflict triangle
        // when it has man-down conflicts, and a warn/due ClockAlert when the
        // day has a warming chore (F24/F25). Each hovers to its detail.
        const confCount = conflictsByISO?.get(iso) ?? 0;
        const warm = warmingByISO?.get(iso);
        const overnight = overnightByISO?.has?.(iso);
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onPickDay?.(day.date)}
            className={
              "w-full flex items-center gap-2 px-1.5 py-2 text-left border cursor-pointer " +
              (isSel ? "bg-row-active " : "hover:bg-row-hover ") +
              (isToday ? "border-resolved" : "border-transparent")
            }
          >
            <span
              className={
                "w-11 shrink-0 text-[12px] [font-variant-numeric:tabular-nums] " +
                (isSel ? "font-semibold text-fg" : "text-dim")
              }
            >
              {WEEK_DOW[day.date.getDay()]} {day.date.getDate()}
            </span>
            <span className="relative flex-1 flex items-end gap-1 h-7 overflow-hidden">
              {(day.blocks ?? []).map((b) => (
                <span
                  key={b.bucket}
                  title={`${b.name} · ${b.count}`}
                  style={{
                    height:
                      Math.min(100, Math.max(12, (b.count / max) * 100)) + "%",
                  }}
                  className={
                    "flex-1 min-w-[3px] " + (b.count ? "bg-accent/70" : "bg-line")
                  }
                />
              ))}
            </span>
            {/* Fixed-width symbol cell so EVERY day's mini-spine is the same
                width and the badges line up in a column down the page (the
                busiest row — up to warming + event + conflict — sets it).
                Left-aligned so the FIRST badge of every row shares one column
                (an E under an E), not pinned to the right edge. w-14 fits 3
                14px badges at the 180px panel width (F16). */}
            {/* F41 — each symbol carries a real Tooltip (instant, formatted)
                instead of the laggy native `title`. Event names / richer
                detail land with the This Week deepening slice. */}
            <span className="w-14 shrink-0 flex items-center justify-start gap-1">
              {overnight && (
                <Tooltip tip="Overnight chores">
                  <Moon size={14} className="text-chore" />
                </Tooltip>
              )}
              {warm && (
                <WarmingBadge
                  warn={warm.warn} due={warm.due} size={14} showCount={false}
                />
              )}
              {day.events > 0 && (
                <Tooltip
                  tip={day.events === 1
                    ? "Event today"
                    : day.events + " events"}
                >
                  <KindBadge kind="event" size={14} />
                </Tooltip>
              )}
              {confCount > 0 && (
                <Tooltip
                  tip={confCount === 1
                    ? "1 conflict"
                    : confCount + " conflicts"}
                >
                  <AlertTriangle size={14} className="text-warn" />
                </Tooltip>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── StatusPill: tiny uppercase bordered status chip ────────────────────
// Tones map to semantic colors. Backs BatchStatePill, order payment
// chips, and similar one-word state labels.
const PILL_TONES = {
  done: "text-dim border-line bg-surface-alt",
  future: "text-accent-deep border-accent/40",
  live: "text-resolved border-resolved/40",
  resolved: "text-resolved border-resolved/40",
  warn: "text-warn border-warn/40",
  muted: "text-faint border-line",
};

export function StatusPill({ tone = "muted", children, className = "" }) {
  return (
    <span
      className={
        "inline-flex items-center text-[9px] font-semibold uppercase " +
        "tracking-[0.12em] px-1.5 py-0.5 border " +
        (PILL_TONES[tone] ?? PILL_TONES.muted) + " " + className
      }
    >
      {children}
    </span>
  );
}

// ── StatTile: big-number + label box ───────────────────────────────────
export function StatTile({ label, value, className = "" }) {
  return (
    <div
      className={"bg-surface border border-line px-4 py-3 min-w-[110px] " + className}
    >
      <div className="font-heading text-[26px] font-semibold leading-none text-fg">
        {value}
      </div>
      <div className="text-[10px] text-faint uppercase tracking-[0.12em] mt-1.5">
        {label}
      </div>
    </div>
  );
}
