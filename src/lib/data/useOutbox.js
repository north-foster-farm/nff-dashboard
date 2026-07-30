import { useEffect, useState } from "react";
import {
  initOutbox, subscribeOutbox, outboxOps, outboxSyncing, flushOutbox,
  retryFailedOps, discardFailedOps,
} from "./outbox.js";

// React binding for the device-local outbox (Batch 16.2). Surfaces
// queue counts + connectivity so the "queued / not synced" indicator
// (and any per-row affordances) can render live state. The outbox
// itself is a module-level singleton — this hook is just a subscriber.

export function useOutbox() {
  const [, setTick] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );

  useEffect(() => {
    initOutbox();
    const unsub = subscribeOutbox(() => setTick((t) => t + 1));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const ops = outboxOps();
  let pendingCount = 0;
  let failedCount = 0;
  for (const op of ops) {
    if (op.status === "pending") pendingCount += 1;
    else if (op.status === "failed") failedCount += 1;
  }

  return {
    online,
    syncing: outboxSyncing(),
    pendingCount,
    failedCount,
    ops,
    flush: flushOutbox,
    retryFailed: retryFailedOps,
    discardFailed: discardFailedOps,
  };
}
