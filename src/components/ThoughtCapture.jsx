import { useEffect, useRef, useState } from "react";
import { SquarePen, Send } from "lucide-react";
import { useInboxItems } from "../lib/data/useInboxItems.js";

// Top-bar "just a thought…" capture (Batch 21). A lightbulb button
// that drops a small textarea for on-the-fly thought-dumping; saving
// writes an inbox_items row. Quiet by design — no push, no fanfare,
// the thought just lands in the Inbox.
export default function ThoughtCapture() {
  const { create } = useInboxItems();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside-click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await create(trimmed);
      setBody("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Capture a thought"
        title="Just a thought…"
        className="bg-transparent border-0 text-dim p-1.5 cursor-pointer flex items-center justify-center"
      >
        <SquarePen size={16} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[320px] bg-surface border border-line shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-50 p-3 flex flex-col gap-2"
          role="dialog"
          aria-label="Capture a thought"
        >
          <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
            Just a thought…
          </div>
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            rows={3}
            placeholder="Anything worth not forgetting. It lands in the Inbox — not a project, not a chore, just captured."
            className="bg-bg border border-line text-fg text-[13px] px-3 py-2 outline-none focus:border-accent font-[inherit] w-full resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-faint">
              {savedFlash ? "Captured ✓" : "⌘↵ to save"}
            </span>
            <button
              onClick={submit}
              disabled={saving || !body.trim()}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={12} className="shrink-0" />
              {saving ? "Saving…" : "Capture"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
