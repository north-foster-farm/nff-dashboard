// Shared UI kit (Batch 39 — design-system consolidation).
//
// Tailwind-native home for the class strings and tiny components that
// were being copy-pasted across pages. This supersedes the old
// inline-`style={{T.*}}` primitives.jsx; new shared UI lands here.
//
// Class constants are exported as strings so call sites can append
// per-use tweaks (`INPUT_CLS + " w-full"`), exactly how the inlined
// copies were used.

import { useLayoutEffect, useRef, useState } from "react";
import {
  Check, AlertTriangle, CircleCheck, ClockAlert, Moon, UserX, X,
} from "lucide-react";

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
// One canonical now-marker, today-views only (gate at the call site). The
// label + dot sit INLINE at the left and the green hairline fills the rest of
// the row to the right (the rule is "broken" by the text — matches the style
// guide). Pass a preformatted `time` string (keeps this kit free of the
// schedule time utils); `label` overrides the whole "Now · time" text;
// `children` land AFTER the hairline as a trailing annotation. Spacing is
// the caller's — no baked padding — and the root is a span (flex) so the
// rule can sit inside the spine's row button. Used by the phone Today
// glance (a divider between rows) and the desktop DayRailSpine, where it
// IS the current block's time line (F5); `NowTag` remains the inline word
// for center-pane rows.
// `size="sm"` is the in-list variant (the day-spine rows): 8px/0.1em text,
// 6px dot with a 2px glow — the rule scaled to sit under a 13px row title.
export function NowRule({ time, label, size, children, className = "" }) {
  const sm = size === "sm";
  return (
    <span className={"flex items-center gap-2 " + className}>
      <span
        className={"shrink-0 rounded-full "
          + (sm ? "w-[6px] h-[6px]" : "w-[7px] h-[7px]")}
        style={{
          background: "var(--c-resolved)",
          boxShadow: sm
            ? "0 0 0 2px rgba(76,186,133,0.22)"
            : "0 0 0 3px rgba(76,186,133,0.22)",
        }}
      />
      <span className={
        "shrink-0 font-ui font-semibold uppercase text-resolved "
        + (sm ? "text-[8px] tracking-[0.1em]" : "text-[10px] tracking-[0.14em]")
      }>
        {label ?? "Now" + (time != null ? " · " + time : "")}
      </span>
      <span className="flex-1 border-t border-resolved" />
      {children}
    </span>
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
// Viewport guardrails (round 6): a tip near a screen edge (the This Week
// sidebar especially) used to run off it. On open, the tip is measured
// and shifted horizontally so neither edge passes the viewport (8px
// margin); the centered position stays the default.
export function Tooltip({ tip, side = "top", className = "", children }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const tipRef = useRef(null);
  useLayoutEffect(() => {
    if (!open) { setShift(0); return; }
    const el = tipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const maxRight = document.documentElement.clientWidth - pad;
    let dx = 0;
    if (r.right > maxRight) dx = maxRight - r.right;
    if (r.left + dx < pad) dx = pad - r.left;
    if (dx !== 0) setShift(dx);
  }, [open]);
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
          ref={tipRef}
          role="tooltip"
          style={{ transform: `translateX(calc(-50% + ${shift}px))` }}
          className={
            "absolute left-1/2 z-50 pointer-events-none " +
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

// ── BadgeHint: the sidebar glyph's hover-detail cue ─────────────────────
// The `abbr` convention (the affordance standard, 42.1/42.3): a dotted
// underline beneath a glyph says "details on hover" without a word of
// instruction, and the badge (not the whole row) owns the Tooltip. The
// wrapper carries cursor-pointer; a badge click still falls through to
// its row (Tooltip never eats it). Sidebars only (day-spine + This Week)
// — center-pane badges are labels, not hover targets.
export const BadgeHint = ({ tip, children }) => (
  <Tooltip tip={tip} className="shrink-0 cursor-pointer">
    <span className="flex flex-col items-center gap-[2px]">
      {children}
      <span className="w-full border-b border-dotted border-faint" />
    </span>
  </Tooltip>
);

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
// `cue` (sidebars only): the BadgeHint dotted underline + pointer, so the
// glyph advertises its hover detail like every other sidebar badge.
export function WarmingBadge({
  warn = [], due = [], size = 14, showCount = true, cue = false,
  className = "",
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
  const glyph = (
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
  );
  return (
    <Tooltip
      tip={tip}
      className={(cue ? "cursor-pointer " : "") + className}
    >
      {cue ? (
        <span className="flex flex-col items-center gap-[2px]">
          {glyph}
          <span className="w-full border-b border-dotted border-faint" />
        </span>
      ) : glyph}
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
// The planned/unplanned fill language (F9/F26), shared app-wide: a project
// surface is SOLID when planned and this 45° blue cross-hatch (the
// wash-eggs ribbon pattern in project slate) when unplanned. `strength`
// scales the stripe ink — bare bars take the full-strength default; row
// backgrounds with text on top take a light wash (the gaps stay
// transparent, so hover/active row tints show through).
export const hatchUnplanned = (strength = 60) =>
  "repeating-linear-gradient(45deg," +
  `color-mix(in srgb, var(--c-project) ${strength}%, transparent) 0 4px,` +
  "transparent 4px 8px)";

// The needs-cover fill (round 5): the same diagonal-stripe language as the
// open project blocks, in the WARN color — a block overlapped by an
// uncovered time off / event wears it (spine rows at a light strength,
// day-load bars at full). Accepting cover removes it.
export const hatchCover = (strength = 60) =>
  "repeating-linear-gradient(45deg," +
  `color-mix(in srgb, var(--c-warn) ${strength}%, transparent) 0 4px,` +
  "transparent 4px 8px)";

// The ALTERNATING conflict stripes (round 6): warn / kind-color, one
// cadence everywhere. This is THE needs-cover treatment when the surface
// underneath is itself striped or a solid bar — two overlaid hatch sets
// used to stack into mud. The duty cycle is deliberately UNEVEN (3px warn
// tick / 7px kind): a 50/50 alternation of two saturated mid-luminance
// hues strobes at bar size, while thin amber ticks over the dominant
// identity color read as "warning ON the bar", not a third color. Spine
// rows take light strengths (text sits on top); bars take full color.
export const hatchConflict = (cssVar, warnStrength = 100, kindStrength = 100) =>
  "repeating-linear-gradient(45deg," +
  `color-mix(in srgb, var(--c-warn) ${warnStrength}%, transparent) 0 3px,` +
  `color-mix(in srgb, var(${cssVar}) ${kindStrength}%, transparent) 3px 10px)`;

// The "covered" mark (round 5; restyled F10): a conflict whose cover
// was accepted turns from the warn triangle into a quiet accent
// circle-check — a small success cue, not another alert. `tip` carries
// what was covered + who accepted; sidebars wrap it in the BadgeHint
// cue via `cue`.
export function CoveredBadge({ tip, size = 13, cue = false, className = "" }) {
  const glyph = (
    <CircleCheck size={size} className={"shrink-0 text-accent " + className} />
  );
  if (!tip) return glyph;
  return (
    <Tooltip tip={tip} className={cue ? "cursor-pointer" : ""}>
      {cue ? (
        <span className="flex flex-col items-center gap-[2px]">
          {glyph}
          <span className="w-full border-b border-dotted border-faint" />
        </span>
      ) : glyph}
    </Tooltip>
  );
}

// The kind-tinted list row (the spine's group language): every row in a
// kinded list wears a light wash of its identity color — chore teal,
// project slate, event periwinkle. Authored as an alpha background-IMAGE
// (a constant two-stop gradient), NOT a background-color, so the row
// shell's hover/active/now background-color tints still show through.
export const kindTint = (cssVar, strength = 11) => {
  const c = `color-mix(in srgb, var(${cssVar}) ${strength}%, transparent)`;
  return `linear-gradient(${c}, ${c})`;
};

// `nowId` (today-views only, gate at the call site): the bar whose block is
// CURRENT carries the now-ring — the same offset inset ring as the phone
// day-strip (2px accent-deep + a bg-colored separation line, inverse-zoom-
// compensated so it rasterizes true at any density). `nowEdge`
// ("before"|"after"): now falls outside the day's blocks, so no bar rings —
// the now-marker is a VERTICAL green rule at the start/end of the group.
export function NowEdgeLine({ className = "" }) {
  return (
    <span
      className={"relative self-stretch shrink-0 w-[2px] " + className}
      style={{ background: "var(--c-resolved)" }}
    >
      <span
        className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full"
        style={{
          background: "var(--c-resolved)",
          boxShadow: "0 0 0 2px rgba(76,186,133,0.22)",
        }}
      />
    </span>
  );
}

// `events` (round 5, the event-rail mockup): [{ id, label, startMin,
// endMin }] — each draws a horizontal rail BELOW the bars, spanning from
// the left edge of the first bar it overlaps to the right edge of the
// last (bars + rails share one CSS grid so the edges align). The rail
// carries the E badge (dotted hover cue → the event's name) and the
// NowRule language adapted into a start—end timeline. `conflictIds`: bar
// ids overlapped by an UNCOVERED time off / event — those bars wear the
// warn diagonal stripes + a warn border until cover is accepted.
export function LoadSpine({
  blocks = [], summary, nowId, nowEdge, events = [], conflictIds,
  className = "",
}) {
  const bars = blocks.filter(
    (b) => (b.total ?? 0) > 0 || b.state === "hole" || b.kind === "project");
  // Chore bars scale to the heaviest count; project bars scale to the longest
  // gap (two metrics: chores carry no duration, projects carry no count).
  const maxCount = Math.max(
    1, ...bars.filter((b) => b.kind !== "project").map((b) => b.total ?? 0));
  const dur = (b) => b.durationMin ?? ((b.endMin ?? 0) - (b.startMin ?? 0));
  const maxDur = Math.max(
    1, ...bars.filter((b) => b.kind === "project").map(dur));
  // Bars + event rails share ONE grid template so a rail's left/right
  // edges land exactly on the first/last overlapped bar's edges.
  const gridStyle = {
    gridTemplateColumns:
      `repeat(${Math.max(1, bars.length)}, minmax(3px, 1fr))`,
  };
  const barWin = (b) => ({
    s: b.window?.startMin ?? b.startMin ?? null,
    e: b.window?.endMin ?? b.endMin ?? null,
  });
  const railSpan = (ev) => {
    const evEnd = ev.endMin ?? (ev.startMin ?? 0) + 60;
    let first = -1;
    let last = -1;
    bars.forEach((b, i) => {
      const w = barWin(b);
      if (w.s == null || w.e == null || ev.startMin == null) return;
      if (w.s < evEnd && w.e > ev.startMin) {
        if (first < 0) first = i;
        last = i;
      }
    });
    return first < 0 ? null : { first, last };
  };
  return (
    <div className={"flex items-center gap-3 " + className}>
      {/* No overflow-hidden: bar heights are already clamped (B2), and the
          clip was cutting the NowEdgeLine's glow dot (round 4). No baseline
          border either — the day load is fully chromeless. */}
      <div className="flex-1 min-w-0">
      <div className="flex items-stretch gap-0.5">
        {nowEdge === "before" && <NowEdgeLine className="mr-0.5 my-1" />}
        {bars.length === 0 ? (
          <span className="self-center text-[10px] text-faint">—</span>
        ) : (
         <div
           className="grid items-end gap-0.5 h-10 flex-1 min-w-0"
           style={gridStyle}
         >
          {bars.map((b) => {
            const isProject = b.kind === "project";
            const h = isProject
              ? Math.min(100, Math.max(8, (dur(b) / maxDur) * 100))
              : Math.min(100, Math.max(8, ((b.total ?? 0) / maxCount) * 100));
            const style = { height: h + "%" };
            if (isProject) {
              if (b.planned) {
                style.backgroundColor = "var(--c-project)";
              } else {
                style.backgroundImage = hatchUnplanned();
                style.boxShadow =
                  "inset 0 0 0 1px color-mix(in srgb," +
                  " var(--c-project) 45%, transparent)";
              }
            } else {
              style.backgroundColor = "var(--c-chore)";
            }
            // Round 6 — overlapped by an uncovered time off / event: the
            // bar's fill BECOMES the alternating warn/kind stripes (the
            // same 4px cadence as the spine rows) — never a second stripe
            // set stacked over the first, never a border. Cover accepted
            // → plain.
            if (conflictIds?.has?.(b.blockId ?? b.id)) {
              delete style.backgroundColor;
              style.backgroundImage = hatchConflict(
                isProject ? "--c-project" : "--c-chore");
              style.boxShadow = undefined;
            }
            const isNow = nowId != null && (b.blockId ?? b.id) === nowId;
            return (
              <div
                key={b.blockId ?? b.id}
                className="relative flex-1 min-w-[3px]"
                title={b.name ?? b.label ?? ""}
                style={style}
              >
                {isNow && (
                  // bg | accent | bg sandwich (round 4): accent-deep and
                  // the project slate share luminance, so a single inner
                  // separation line wasn't enough on project fills — a
                  // bg-colored line on BOTH flanks of the 2px ring does
                  // the contrast work on any fill, any theme.
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      boxShadow:
                        "inset 0 0 0 calc(1px * var(--inv-zoom)) var(--color-bg), "
                        + "inset 0 0 0 calc(3px * var(--inv-zoom)) var(--color-accent-deep), "
                        + "inset 0 0 0 calc(4px * var(--inv-zoom)) var(--color-bg)",
                    }}
                  />
                )}
                {/* (Round 5) The per-bar man-down triangle is gone — the
                    warn stripes + border carry the needs-cover state on
                    the bar, and the stat row's conflict badge carries
                    the count. */}
              </div>
            );
          })}
         </div>
        )}
        {nowEdge === "after" && <NowEdgeLine className="ml-0.5 my-1" />}
      </div>
      {/* Event rails (round 5): one per event, below the bars, spanning
          first-overlapped to last-overlapped bar. The E badge wears the
          hover cue (the tip = the event's name); the start—end timeline
          adapts the NowRule language into the event's periwinkle. */}
      {events.map((ev) => {
        const span = railSpan(ev);
        if (!span) return null;
        return (
          <div key={ev.id} className="grid gap-0.5 mt-1" style={gridStyle}>
            {/* Round 6 — a SHORT event must not overflow its rail: the
                rail's floor is its own content + padding (min-w-max),
                and when that beats the bar span it aligns with, it
                CENTERS over the span (the flex wrapper lets it overflow
                both flanks equally) instead of stretching the grid. */}
            <div
              className="flex justify-center min-w-0"
              style={{ gridColumn: `${span.first + 1} / ${span.last + 2}` }}
            >
              <div
                className="flex items-center gap-1.5 border px-1.5 py-1 w-full min-w-max"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--c-event) 55%, transparent)",
                  background:
                    "color-mix(in srgb, var(--c-event) 8%, transparent)",
                }}
              >
                <BadgeHint
                  tip={<>
                    <b className="text-fg">{ev.label ?? "Event"}</b>
                    {"\n"}{ev.startLabel}
                    {ev.endLabel ? ` — ${ev.endLabel}` : ""}
                  </>}
                >
                  <KindBadge kind="event" size={14} />
                </BadgeHint>
                <span className="shrink-0 font-ui text-[10px] font-semibold text-event [font-variant-numeric:tabular-nums]">
                  {ev.startLabel}
                </span>
                <span
                  className="flex-1 border-t"
                  style={{ borderColor: "var(--c-event)" }}
                />
                {ev.endLabel && (
                  <span className="shrink-0 font-ui text-[10px] font-semibold text-event [font-variant-numeric:tabular-nums]">
                    {ev.endLabel}
                  </span>
                )}
                {/* F47 — event coverage: a quiet "N of M here" when
                    anyone is out during the event's window; warn when
                    nobody is. Hover names who's here and who's out. */}
                {(ev.away?.length ?? 0) > 0 && (
                  <Tooltip
                    tip={<>
                      {(ev.here ?? []).map((p) => (
                        <span key={p} className="block">
                          <b className="text-fg font-semibold">{p}</b>
                          {" — here"}
                        </span>
                      ))}
                      {ev.away.map((p) => (
                        <span key={p} className="block">
                          <b className="text-fg font-semibold">{p}</b>
                          {" — out"}
                        </span>
                      ))}
                    </>}
                  >
                    <span
                      className={
                        "shrink-0 inline-flex items-center gap-1 "
                        + "font-ui text-[10px] "
                        + "[font-variant-numeric:tabular-nums] "
                        + ((ev.here?.length ?? 0) === 0
                          ? "text-warn font-semibold"
                          : "text-muted")
                      }
                    >
                      <UserX size={12} />
                      {(ev.here?.length ?? 0)} of{" "}
                      {(ev.here?.length ?? 0) + ev.away.length} here
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        );
      })}
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
// WeekSpines (center) + WeekList (sidebar). Bar HEIGHTS clamp to the track
// (B1); bar WIDTHS never clip — the widest day sets one fixed track width
// for every row (and thereby the sidebar's width). The old should-heat
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
  coveredByISO,
  outByISO,
  className = "",
}) {
  if (!week?.days?.length || !ymd) return null;
  const max = week.max || 1;

  // The bar track is a FIXED width shared by every row — the widest day's
  // bar count sets it (bars ≥5px + gap-1), so no day's bars ever clip
  // under the symbol cell and the whole sidebar sizes to fit. A lighter
  // day's bars flex a little wider inside the same track.
  const maxBars = Math.max(
    1, ...week.days.map((d) => (d.bars ?? []).length));
  const trackW = maxBars * 5 + (maxBars - 1) * 4;

  // Two height scales, mirroring the day-load LoadSpine: chore bars scale
  // to the week's heaviest block COUNT; project bars to its longest gap
  // DURATION (chores carry no duration, projects no count). Events take a
  // fixed mid height — presence, not magnitude.
  const maxDur = Math.max(1, ...week.days.flatMap((d) =>
    (d.bars ?? []).filter((b) => b.kind === "project")
      .map((b) => b.durationMin ?? 0)));
  const barPct = (b) => b.kind === "event" ? 50
    : b.kind === "project"
      ? Math.min(100, Math.max(12, ((b.durationMin ?? 0) / maxDur) * 100))
      : Math.min(100, Math.max(12, ((b.count ?? 0) / max) * 100));

  // F40 — identity colors, the same fill language as the day-load and the
  // phone strip: chore teal; project slate, solid when planned and the
  // blue cross-hatch when free (F9); event periwinkle wash + ring.
  const barStyle = (b) => {
    const s = { height: barPct(b) + "%" };
    if (b.kind === "project") {
      if (b.planned) s.background = "var(--c-project)";
      else {
        s.backgroundImage = hatchUnplanned();
        s.boxShadow = "inset 0 0 0 1px color-mix(in srgb,"
          + " var(--c-project) 45%, transparent)";
      }
    } else if (b.kind === "event") {
      s.background = "color-mix(in srgb, var(--c-event) 45%, transparent)";
      s.boxShadow = "inset 0 0 0 1px color-mix(in srgb,"
        + " var(--c-event) 55%, transparent)";
    } else {
      s.background = "color-mix(in srgb, var(--c-chore) 85%, transparent)";
    }
    return s;
  };

  // F42 — each bar hovers to its detail (a real Tooltip, never the native
  // `title`): chore block → name + count + window; project → planned/free
  // + who's free; event → name + time.
  const barTip = (b) => (
    <>
      <b className="text-fg font-semibold">{b.name}</b>
      {"\n"}
      {b.kind === "chore" && (
        b.count + (b.count === 1 ? " chore" : " chores")
        + (b.windowLabel ? " · " + b.windowLabel : "")
      )}
      {b.kind === "project" && (
        (b.windowLabel ?? "")
        + (b.whoLabel ? " · " + b.whoLabel : "")
      )}
      {b.kind === "event" && (b.windowLabel ?? "all day")}
    </>
  );

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
        const covered = coveredByISO?.get?.(iso);
        const out = outByISO?.get?.(iso);
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onPickDay?.(day.date)}
            className={
              "w-full flex items-end gap-2 px-1.5 py-2 text-left border cursor-pointer " +
              (isSel ? "bg-row-active " : "hover:bg-row-hover ") +
              (isToday ? "border-resolved" : "border-transparent")
            }
          >
            {/* F11 (settled) — the day label matches the spine block names:
                body sans at 12px, one weight whether selected or not;
                selection speaks through color + fill. */}
            {/* Round 4 (F37 re-open) — ONE baseline grid: the row is
                items-end, so the label's baseline, the bar bottoms, and
                the symbol column all sit on the track's bottom edge
                instead of three different center lines. */}
            <span
              className={
                "w-11 shrink-0 text-[12px] font-medium leading-none " +
                "[font-variant-numeric:tabular-nums] " +
                (isSel ? "text-fg" : "text-dim")
              }
            >
              {WEEK_DOW[day.date.getDay()]} {day.date.getDate()}
            </span>
            <span
              className="relative shrink-0 flex items-end gap-1 h-7"
              style={{ width: trackW + "px" }}
            >
              {(day.bars ?? []).map((b) => (
                <Tooltip
                  key={b.id}
                  tip={barTip(b)}
                  className="flex-1 min-w-[5px] self-stretch items-end"
                >
                  <span className="w-full" style={barStyle(b)} />
                </Tooltip>
              ))}
            </span>
            {/* Fixed-width symbol cell so EVERY day's mini-spine is the same
                width and the badges line up in a column down the page (the
                busiest row — up to warming + event + conflict — sets it).
                Left-aligned so the FIRST badge of every row shares one column
                (an E under an E), not pinned to the right edge. w-14 fits 3
                14px badges; the sidebar's total width follows the bar
                track (widest day sets it), not a fixed panel px. */}
            {/* F41 — each symbol carries a real Tooltip (instant, formatted)
                instead of the laggy native `title`. Event names / richer
                detail land with the This Week deepening slice. */}
            {/* Round 4 — every symbol wears the full affordance standard
                (BadgeHint: Tooltip + dotted hover cue + pointer), not a
                bare Tooltip. */}
            <span className="w-14 shrink-0 flex items-end justify-start gap-1">
              {overnight && (
                <BadgeHint tip="Overnight chores">
                  <Moon size={14} className="text-chore" />
                </BadgeHint>
              )}
              {warm && (
                <WarmingBadge
                  warn={warm.warn} due={warm.due} size={14} showCount={false}
                  cue
                />
              )}
              {day.events > 0 && (
                <BadgeHint
                  tip={(day.eventList?.length ?? 0) > 0
                    ? day.eventList.map((ev, i) => (
                      <span key={i} className="block">
                        <b className="text-fg font-semibold">{ev.label}</b>
                        {ev.timeLabel ? ` — ${ev.timeLabel}` : ""}
                      </span>
                    ))
                    : (day.events === 1
                      ? "Event today" : day.events + " events")}
                >
                  <KindBadge kind="event" size={14} />
                </BadgeHint>
              )}
              {confCount > 0 && (
                <BadgeHint
                  tip={confCount === 1
                    ? "1 conflict"
                    : confCount + " conflicts"}
                >
                  <AlertTriangle size={14} className="text-warn" />
                </BadgeHint>
              )}
              {/* F46 — someone is out the WHOLE day: the muted out
                  icon; hover names who. Quiet on purpose — a needs-
                  cover conflict already speaks in warn. */}
              {(out?.length ?? 0) > 0 && (
                <BadgeHint
                  tip={out.map((p, i) => (
                    <span key={i} className="block">
                      <b className="text-fg font-semibold">{p}</b>
                      {" — out all day"}
                    </span>
                  ))}
                >
                  <UserX size={14} className="text-muted" />
                </BadgeHint>
              )}
              {/* Round 5 — a day whose time off has ACCEPTED cover wears
                  the muted circle-alert beside (or instead of) the
                  conflict triangle; hover says what was covered. */}
              {(covered?.length ?? 0) > 0 && (
                <CoveredBadge
                  size={14}
                  cue
                  tip={covered.map((c, i) => (
                    <span key={i} className="block pl-3 -indent-3">
                      <b className="text-fg font-semibold">
                        {c.by ? `${c.by} covers`
                          : c.ack ? "Acknowledged" : "Covered"}
                      </b>
                      {` — ${c.label}`}
                    </span>
                  ))}
                />
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
