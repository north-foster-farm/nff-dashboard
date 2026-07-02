import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, LockOpen, Pencil, RefreshCw, X } from "lucide-react";
import { useDocData } from "../lib/data/useDocData.js";
import { injectShim } from "../lib/docdata/liveDoc.js";

// LiveDocViewer — an attached .html file opened as a WORKING page
// (batch 42.8). The doc renders in a sandboxed iframe (allow-scripts
// only: an opaque origin, so the page can't reach the app session or
// real storage); the injected shim swaps its localStorage for our
// per-attachment key/value store, so data persists to the database
// and syncs realtime between editors.
//
// Locking: the doc opens READ-ONLY. "Edit" claims the advisory lock
// (attachment_doc_locks) and reloads the page writable; "Done"
// releases it. While the other editor holds a fresh lock the button
// is disabled ("Jim is editing"); a stale heartbeat (>90s) is
// claimable. A 30s heartbeat keeps a live editing session fresh.
//
// External saves (the other person's writes) arrive via realtime and
// are diffed into the iframe as "nff-doc-update" messages — the shim
// re-dispatches them as storage events.

const HEARTBEAT_MS = 30 * 1000;

export function LiveDocViewer({ attachment, getUrl, me, onClose }) {
  const doc = useDocData(attachment.id, me);
  const [html, setHtml] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const iframeRef = useRef(null);
  const sentRef = useRef({});

  // The raw HTML, once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = await getUrl(attachment);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed (${res.status}).`);
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.message ?? "Could not load the file.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [attachment, getUrl]);

  const writable = editing && doc.state === "mine";

  // srcdoc builds once per (html ready, writable flip) — data changes
  // do NOT rebuild it (that would reload the page mid-edit); they
  // stream in via postMessage below.
  const srcdoc = useMemo(() => {
    if (html == null || doc.loading) return null;
    sentRef.current = { ...doc.data };
    return injectShim(html, doc.data, { readOnly: !writable });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, doc.loading, writable]);

  // Page → host: persist shim writes (only ever sent when writable —
  // the read-only shim swallows them).
  useEffect(() => {
    const onMessage = (ev) => {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const m = ev.data;
      if (m?.type !== "nff-doc-write") return;
      sentRef.current[m.key] = m.value;
      doc.writeKey(m.key, m.value);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [doc.writeKey]);

  // Host → page: diff realtime data into the live iframe. Our own
  // writes fold optimistically into doc.data, so they no-op here.
  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame || srcdoc == null) return;
    const sent = sentRef.current;
    const keys = new Set([
      ...Object.keys(sent), ...Object.keys(doc.data),
    ]);
    for (const key of keys) {
      const value = doc.data[key] ?? null;
      if ((sent[key] ?? null) === value) continue;
      sent[key] = value;
      frame.postMessage({ type: "nff-doc-update", key, value }, "*");
    }
  }, [doc.data, srcdoc]);

  // Heartbeat while editing; release on unmount/close.
  useEffect(() => {
    if (!writable) return undefined;
    const t = setInterval(() => doc.heartbeat(), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [writable, doc.heartbeat]);

  const releaseRef = useRef(doc.release);
  releaseRef.current = doc.release;
  const stateRef = useRef(doc.state);
  stateRef.current = doc.state;
  useEffect(() => () => {
    if (stateRef.current === "mine") releaseRef.current();
  }, []);

  const startEditing = async () => {
    await doc.claim();
    setEditing(true);
  };
  const stopEditing = async () => {
    setEditing(false);
    await doc.release();
  };

  const holder = doc.lock?.lockedBy?.split("@")[0] ?? null;
  const lockChip = (() => {
    if (writable) {
      return { icon: LockOpen, text: "You're editing", cls: "text-accent" };
    }
    if (doc.state === "theirs") {
      return { icon: Lock, text: `${holder} is editing`, cls: "text-warn" };
    }
    if (doc.state === "stale") {
      return {
        icon: Lock, text: `${holder} left it locked`, cls: "text-dim",
      };
    }
    return { icon: LockOpen, text: "Read-only", cls: "text-dim" };
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <span className="font-ui text-[13px] font-semibold text-fg truncate">
          {attachment.fileName}
        </span>
        <span className={
          "inline-flex items-center gap-1 font-ui text-[11px] "
          + lockChip.cls
        }>
          <lockChip.icon size={12} />
          {lockChip.text}
        </span>
        <span className="flex-1" />
        {writable ? (
          <button
            onClick={stopEditing}
            className="inline-flex items-center gap-1.5 bg-accent text-white border-0 px-3 py-1.5 font-[inherit] text-[11px] font-semibold cursor-pointer"
          >
            Done editing
          </button>
        ) : (
          <button
            onClick={startEditing}
            disabled={doc.state === "theirs" || doc.loading}
            title={doc.state === "theirs"
              ? `${holder} is editing right now`
              : "Claim the doc and edit"}
            className="inline-flex items-center gap-1.5 bg-transparent border border-line text-fg hover:border-accent px-3 py-1.5 font-[inherit] text-[11px] font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            <Pencil size={12} /> Edit
          </button>
        )}
        <button
          onClick={onClose}
          className="bg-transparent border-0 p-1 text-muted hover:text-fg cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>
      {loadError && (
        <div className="px-4 py-3 text-[12px] text-warn">{loadError}</div>
      )}
      {!loadError && srcdoc == null && (
        <div className="flex flex-1 items-center justify-center gap-2 text-[12px] text-dim">
          <RefreshCw size={13} className="animate-spin" /> Loading doc…
        </div>
      )}
      {srcdoc != null && (
        <iframe
          ref={iframeRef}
          title={attachment.fileName}
          sandbox="allow-scripts allow-forms"
          srcDoc={srcdoc}
          className="flex-1 w-full border-0 bg-white"
        />
      )}
    </div>
  );
}

// Is this attachment a live-openable HTML doc?
export function isLiveDoc(att) {
  return att.contentType === "text/html"
    || /\.html?$/i.test(att.fileName ?? "");
}
