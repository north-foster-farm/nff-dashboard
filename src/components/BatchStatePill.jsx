import { BATCH_STATES } from "../lib/metrics.js";
import { StatusPill } from "./ui.jsx";

// A small status chip for a batch's derived lifecycle state
// (arriving / on farm / processed). Used on the species Groups cards
// and the batch detail header so a processed or not-yet-arrived batch
// reads as such at a glance instead of looking like a live flock.
// Thin wrapper over the shared StatusPill — maps the lifecycle state to
// a tone + label (Batch 39: tone styling lives in ui.jsx).
export default function BatchStatePill({ state, className = "" }) {
  const meta = BATCH_STATES[state] ?? BATCH_STATES.unknown;
  if (state === "unknown") return null;
  return (
    <StatusPill tone={meta.tone} className={className}>
      {meta.label}
    </StatusPill>
  );
}
