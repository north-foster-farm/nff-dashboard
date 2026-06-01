import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useOutbox } from "../lib/data/useOutbox.js";

// "Queued / not synced" indicator (Batch 16.2). Hidden when the outbox
// is empty and the device is online; otherwise a tinted pill saying
// exactly what's still sitting on this device. Mounted in the TopBar
// (global) and the Rounds status bar (the field surface where offline
// capture actually happens).

export default function OutboxIndicator({ className = "" }) {
  const {
    online, syncing, pendingCount, failedCount, flush, retryFailed,
    discardFailed,
  } = useOutbox();

  if (online && !syncing && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  // Permanent failures: loud, with retry / discard affordances. These
  // are RLS / constraint errors, not connectivity — retrying forever
  // on its own would never succeed.
  if (failedCount > 0) {
    return (
      <div className={"flex items-center gap-2 " + className}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-warn whitespace-nowrap">
          <AlertTriangle size={12} className="shrink-0" />
          {failedCount} couldn&rsquo;t sync
        </span>
        <PillButton onClick={retryFailed}>Retry</PillButton>
        <PillButton onClick={discardFailed}>Discard</PillButton>
      </div>
    );
  }

  // Offline: everything queued waits for signal. CloudOff + count.
  if (!online) {
    return (
      <span
        className={
          "inline-flex items-center gap-1.5 text-[11px] font-semibold " +
          "text-warn whitespace-nowrap " + className
        }
        title="Saved on this device — will sync when you're back online"
      >
        <CloudOff size={12} className="shrink-0" />
        {pendingCount > 0 ? `Offline · ${pendingCount} queued` : "Offline"}
      </span>
    );
  }

  // Online with work in flight (or waiting on a retry timer).
  return (
    <button
      onClick={flush}
      className={
        "inline-flex items-center gap-1.5 text-[11px] font-semibold " +
        "text-dim hover:text-fg bg-transparent border-0 cursor-pointer " +
        "p-0 whitespace-nowrap " + className
      }
      title="Tap to sync now"
    >
      <RefreshCw
        size={12}
        className={"shrink-0 " + (syncing ? "animate-spin" : "")}
      />
      {syncing
        ? `Syncing ${pendingCount}…`
        : `${pendingCount} not synced`}
    </button>
  );
}

function PillButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center font-[inherit] text-[10px] font-semibold " +
        "uppercase tracking-[0.12em] px-2 py-1 cursor-pointer border " +
        "border-line bg-transparent text-dim leading-none " +
        "hover:border-fg hover:text-fg transition-colors duration-100"
      }
    >
      {children}
    </button>
  );
}
