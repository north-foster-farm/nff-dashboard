import { useState } from "react";
import { Check, TriangleAlert, Search } from "lucide-react";

// RethinkerKit — the Rethinker mockup's components, ported 1:1 into our
// architecture (React + our Tailwind tokens) so the whole pattern POOL
// sits next to our real components. We then map these onto our own
// schedule UI (see DESIGN-SYSTEM.md). Faithful to
// examples/schedule/mockups/rethinker.html; colours are the dark-theme
// literals the mockup used — we're matching the dark mockup first.
//
// Nothing here is wired to data; these are presentational specimens.

// ── shared bits ─────────────────────────────────────────────────────
export function Eyebrow({ children, className = "" }) {
  return (
    <span className={"font-ui text-[11px] font-semibold uppercase tracking-[0.14em] " + className}>
      {children}
    </span>
  );
}

// segment fills for the load-meter lanes / silhouettes
const HATCH_ACCENT =
  "repeating-linear-gradient(45deg,rgba(173,200,173,0.55) 0 3px,rgba(173,200,173,0.16) 3px 7px)";
const HATCH_EVENT =
  "repeating-linear-gradient(45deg,#5dd585 0 7px,#4cc278 7px 9px)";
const HATCH_HOLE =
  "repeating-linear-gradient(45deg,rgba(230,184,90,0.18) 0 4px,transparent 4px 8px)";

function segStyle(kind) {
  switch (kind) {
    case "done":      return { background: "var(--c-resolved)" };
    case "committed": return { background: "var(--c-accent-deep)" };
    case "open":      return { background: HATCH_ACCENT };
    case "event":     return { background: HATCH_EVENT };
    case "hole":
      return {
        boxShadow: "inset 0 0 0 1.5px var(--c-warn)",
        backgroundImage: HATCH_HOLE,
      };
    default:          return {};
  }
}

// ── 1 · LoadMeter (the lane) ────────────────────────────────────────
export function LoadTrack({ segments, height = 13, className = "" }) {
  return (
    <div
      className={"relative flex overflow-hidden bg-surface-alt " + className}
      style={{ height, boxShadow: "inset 0 0 0 1px #2a322a" }}
    >
      {segments.map((s, i) => (
        <div key={i} className="h-full" style={{ width: s.pct + "%", ...segStyle(s.kind) }} />
      ))}
    </div>
  );
}

export function LoadMeter({ lanes }) {
  return (
    <div className="flex flex-col gap-1">
      {lanes.map((lane, i) => (
        <div key={lane.name ?? i} className="flex items-center gap-2">
          <span className="w-[42px] shrink-0 font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
            {lane.name}
          </span>
          <LoadTrack segments={lane.segments} className="flex-1" />
          <span className={"shrink-0 min-w-[30px] text-right font-ui text-[11px] font-semibold "
            + (lane.metaTone === "warn" ? "text-warn"
              : lane.metaFaint ? "text-faint" : "text-dim")}>
            {lane.meta}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 2 · Now-marker (hairline rule + dot) ────────────────────────────
export function NowRule({ label = "NOW 9:40" }) {
  return (
    <div className="relative py-2">
      <div className="relative h-0" style={{ borderTop: "1.5px solid var(--c-resolved)" }}>
        <span
          className="absolute -top-1 left-0 w-[7px] h-[7px] rounded-full"
          style={{ background: "var(--c-resolved)", boxShadow: "0 0 0 3px rgba(76,186,133,0.22)" }}
        />
      </div>
      {label && (
        <Eyebrow className="text-resolved text-[9px] mt-1 block tracking-[0.08em]">{label}</Eyebrow>
      )}
    </div>
  );
}

// ── 3 · Seal stamp (a sealed block's worked-window stamp) ───────────
export function SealStamp({ children = "Sealed · Jim 6:08–8:10 · 7/7" }) {
  return (
    <span className="inline-flex items-center gap-[7px] font-ui text-[11px] font-semibold tracking-[0.02em] text-resolved">
      <Check size={12} strokeWidth={3} />
      {children}
    </span>
  );
}

// ── 4 · Rounds checkbox (the 28px tap target) ───────────────────────
export function RoundsCheckbox({ defaultChecked = false, label }) {
  const [done, setDone] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setDone((d) => !d)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={"shrink-0 w-7 h-7 inline-flex items-center justify-center border-2 transition-colors "
          + (done ? "bg-resolved border-resolved text-on-accent" : "bg-bg border-line text-transparent")}
      >
        <Check size={16} strokeWidth={3} className={done ? "opacity-100" : "opacity-0"} />
      </span>
      {label && (
        <span className={"text-[14px] " + (done ? "text-faint line-through" : "text-fg")}>{label}</span>
      )}
    </button>
  );
}

// ── 5 · Day-load silhouette (per-block two-stacks; height = load) ────
export function DaySilhouette({ blocks }) {
  return (
    <div className="flex items-end gap-1 h-9">
      {blocks.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end gap-px" title={b.title}>
          <div style={{ height: b.top.h, ...segStyle(b.top.kind) }} />
          <div style={{ height: b.bottom.h, ...segStyle(b.bottom.kind) }} />
        </div>
      ))}
    </div>
  );
}

// ── 6 · Event band (left colour bar + bordered card) ────────────────
export function EventBand({ kindColor = "var(--c-cat-fm)", title, time, sub }) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="w-1 shrink-0" style={{ background: kindColor }} />
      <div className="flex-1 border px-3 py-2" style={{ borderColor: "color-mix(in srgb, var(--c-cat-fm) 40%, transparent)", background: "var(--c-surface)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[14px] font-semibold text-fg">{title}</span>
          <span className="font-ui text-[11px] text-cat-fm font-semibold">{time}</span>
        </div>
        {sub && <div className="text-[12px] text-dim mt-1 leading-snug">{sub}</div>}
      </div>
    </div>
  );
}

// ── 7 · Needs-cover card (man-down → cover) ─────────────────────────
export function NeedsCoverCard({
  work = "Wash eggs · House",
  detail = "Assigned to James, off-site at the market until 1:00p. The window opens 1:00–4:00.",
  coverLabel = "Jim covers — I've got it",
}) {
  return (
    <div className="border" style={{ borderColor: "color-mix(in srgb, var(--c-warn) 50%, transparent)", background: "var(--c-surface-alt)" }}>
      <div className="px-3 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--c-warn) 25%, transparent)" }}>
        <TriangleAlert size={16} className="text-warn shrink-0" />
        <span className="text-[14px] font-semibold text-fg">Needs cover</span>
      </div>
      <div className="px-3 py-3">
        <div className="text-[14px] text-fg font-medium">{work}</div>
        <div className="text-[12px] text-dim mt-1 leading-snug">{detail}</div>
        <div className="font-ui text-[12px] text-dim mt-2.5">Who can cover?</div>
        <button className="w-full mt-2 bg-warn text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.1em]">
          {coverLabel}
        </button>
        <div className="font-ui text-[11px] text-faint mt-2.5 leading-snug">
          The acknowledgment is the record — the hole closes green in the
          coverer's lane.
        </div>
      </div>
    </div>
  );
}

// ── 8 · Confirm card ("Ready to plan", draft → confirm) ─────────────
export function ConfirmCard({
  title = "Ready to plan Tuesday?",
  body = "42 items across 5 blocks. 6 musts are non-negotiable; the rest is today's discretionary work. Confirming drops the accountability anchor.",
  cta = "Confirm the day",
}) {
  return (
    <div className="border border-accent-deep p-3.5" style={{ background: "color-mix(in srgb, var(--c-accent-deep) 12%, transparent)" }}>
      <div className="text-[14px] text-fg font-semibold leading-snug">{title}</div>
      <div className="text-[12px] text-dim mt-1.5 leading-snug">{body}</div>
      <button className="w-full mt-3 bg-accent text-on-accent border-0 py-2.5 cursor-pointer font-ui text-[12px] font-bold uppercase tracking-[0.12em]">
        {cta}
      </button>
    </div>
  );
}

// ── 9 · Source-change strip ("N changes since you confirmed") ───────
export function SourceChangeStrip({
  summary = "1 change since you confirmed",
  body = "Feed delivery moved to today, ~2:00p (was Thu). It lands in James's Early-afternoon lane.",
}) {
  return (
    <div className="border" style={{ borderColor: "color-mix(in srgb, var(--c-warn) 50%, transparent)", background: "var(--c-surface-alt)" }}>
      <div className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
        <TriangleAlert size={14} className="text-warn shrink-0" />
        <span className="text-[12.5px] text-fg font-medium flex-1">{summary}</span>
        <Eyebrow className="text-[10px] text-warn">Review</Eyebrow>
      </div>
      <div className="px-3 pb-3 pt-0.5 border-t" style={{ borderColor: "color-mix(in srgb, var(--c-warn) 25%, transparent)" }}>
        <div className="text-[12px] text-dim leading-snug mt-2">{body}</div>
        <div className="flex gap-2 mt-2.5">
          <button className="bg-accent text-on-accent border-0 px-3 py-1.5 cursor-pointer font-ui text-[10px] uppercase tracking-[0.12em] font-semibold">Add to today</button>
          <button className="border border-line text-dim bg-transparent px-3 py-1.5 cursor-pointer font-ui text-[10px] uppercase tracking-[0.12em] font-semibold">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

// ── 10 · Block card (the spine's unit; sealed / now-open shells) ────
export function BlockCard({ name, note, state = "default", children }) {
  const sealed = state === "sealed";
  const now = state === "now";
  return (
    <div
      className={"px-3 py-2.5 " + (now ? "border-2" : "border ") + (sealed ? " opacity-70" : "")}
      style={{
        borderColor: now ? "color-mix(in srgb, var(--c-resolved) 55%, transparent)" : "var(--c-border)",
        background: sealed ? "color-mix(in srgb, var(--c-surface) 40%, transparent)" : "var(--c-surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className={"font-heading text-[15px] font-semibold flex-1 -tracking-[0.01em] "
          + (sealed ? "text-dim" : "text-fg")}>{name}</span>
        {note && !sealed && <Eyebrow className="text-[10px] text-muted">{note}</Eyebrow>}
        {sealed && <SealStamp />}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ── 11 · Search-to-add (dedup field + result) ───────────────────────
export function SearchToAdd() {
  return (
    <div className="bg-bg p-3.5 border border-line">
      <div className="flex items-center gap-2.5 border border-accent/40 bg-surface px-3 py-2.5">
        <Search size={16} className="text-accent shrink-0" />
        <span className="text-[15px] text-fg flex-1">Fill waterer</span>
        <Eyebrow className="text-[10px] text-faint tracking-[0.08em]">esc</Eyebrow>
      </div>
      <Eyebrow className="text-[10px] text-faint block px-1 pt-3 pb-1">Chore · dedup'd</Eyebrow>
      <button className="w-full flex items-center gap-3 px-3 py-2.5 bg-surface border border-line text-left">
        <Check size={15} className="text-resolved shrink-0" />
        <span className="flex-1">
          <span className="block text-[14px] text-fg">Fill waterer</span>
          <span className="block text-[11px] text-faint">appears at 5 places — pick one</span>
        </span>
      </button>
    </div>
  );
}
