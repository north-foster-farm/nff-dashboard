import { BATCH_STATES } from "../lib/metrics.js";

// A small status chip for a batch's derived lifecycle state
// (arriving / on farm / processed). Used on the species Groups cards
// and the batch detail header so a processed or not-yet-arrived batch
// reads as such at a glance instead of looking like a live flock.
//
// Tones map to the theme's semantic colors; "live" is intentionally
// quiet (it's the normal case), "done" and "future" stand out.
const TONE_CLS = {
  done: "text-dim border-line bg-surface-alt",
  future: "text-accent-deep border-accent/40",
  live: "text-resolved border-resolved/40",
  muted: "text-faint border-line",
};

export default function BatchStatePill({ state, className = "" }) {
  const meta = BATCH_STATES[state] ?? BATCH_STATES.unknown;
  if (state === "unknown") return null;
  return (
    <span
      className={
        "inline-flex items-center text-[9px] font-semibold uppercase " +
        "tracking-[0.12em] px-1.5 py-0.5 border " +
        (TONE_CLS[meta.tone] ?? TONE_CLS.muted) + " " + className
      }
    >
      {meta.label}
    </span>
  );
}
