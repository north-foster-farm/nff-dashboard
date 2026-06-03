// Shared UI kit (Batch 39 — design-system consolidation).
//
// Tailwind-native home for the class strings and tiny components that
// were being copy-pasted across pages. This supersedes the old
// inline-`style={{T.*}}` primitives.jsx; new shared UI lands here.
//
// Class constants are exported as strings so call sites can append
// per-use tweaks (`INPUT_CLS + " w-full"`), exactly how the inlined
// copies were used.

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
  "hover:text-fg disabled:opacity-50";

export const BTN_GHOST_WARN = BTN_GHOST + " text-warn hover:text-warn";

// ── Card: titled bordered surface box ──────────────────────────────────
// One canonical version replacing the four near-identical copies in
// Overview / Metrics / BatchMetrics / BatchPage. `subtitle` floats to
// the right of the header; `icon` is a lucide component.
export function Card({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <section
      className={"bg-surface border border-line py-4 px-5 flex flex-col " + className}
    >
      <header className="flex items-baseline gap-2.5 mb-3">
        {Icon && <Icon size={14} className="text-dim translate-y-0.5" />}
        <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] text-dim ml-auto">{subtitle}</div>
        )}
      </header>
      {children}
    </section>
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
