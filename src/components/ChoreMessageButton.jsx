import { useEffect, useRef, useState } from "react";
import { MessageSquare, Check, Trash2, X } from "lucide-react";
import { useChoreMessages } from "../lib/data/useChoreMessages.js";
import { useChoreLookup } from "../lib/data/useChoreLookup.js";

// Small icon-button next to a chore that opens a popover for posting a
// sticky-note message + reviewing the existing thread on this chore.
//
// Props:
//   choreId        — the chore to post against
//   choreTitle     — used for the popover header (optional fallback)
//   compact        — smaller button for dense rows (default true)
//   currentUserEmail — used to gate "delete my message"
export default function ChoreMessageButton({
  choreId, choreTitle, currentUserEmail, compact = true,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lookup = useChoreLookup();
  const titleForHeader = choreTitle ?? lookup(choreId) ?? choreId;

  const sz = compact ? 13 : 14;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Sticky notes"
        aria-label="Sticky notes"
        className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
      >
        <MessageSquare size={sz} />
      </button>
      {open && (
        <ChoreMessagePopover
          choreId={choreId}
          choreTitle={titleForHeader}
          currentUserEmail={currentUserEmail}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function ChoreMessagePopover({ choreId, choreTitle, currentUserEmail, onClose }) {
  const { messages, loading, post, address, unaddress, remove } =
    useChoreMessages({ choreId });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      await post(choreId, body);
      setDraft("");
    } catch (err) {
      reportErr(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute right-0 top-full mt-1 w-[320px] max-h-[420px] flex flex-col bg-surface border border-line shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-50"
      role="dialog"
      aria-label={`Sticky notes for ${choreTitle}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <header className="px-3 py-2 border-b border-line flex items-center justify-between gap-2">
        <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold truncate">
          {choreTitle}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0 shrink-0"
        >
          <X size={13} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-2">
        {loading ? (
          <div className="text-[12px] text-faint italic">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-[12px] text-dim italic">
            No sticky notes yet. Add the first one below.
          </div>
        ) : (
          messages.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              currentUserEmail={currentUserEmail}
              onAddress={address}
              onUnaddress={unaddress}
              onRemove={remove}
            />
          ))
        )}
      </div>
      <footer className="border-t border-line p-2 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Leave a sticky note… (⌘↵ to post)"
          className="flex-1 bg-surface-alt text-fg border border-line px-2 py-1.5 outline-none focus:border-accent text-[12px] font-[inherit] resize-none"
        />
        <button
          onClick={submit}
          disabled={busy || !draft.trim()}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold px-3 py-1.5 cursor-pointer uppercase tracking-[0.12em] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          Post
        </button>
      </footer>
    </div>
  );
}

function MessageItem({ message, currentUserEmail, onAddress, onUnaddress, onRemove }) {
  const isAuthor = !!currentUserEmail && message.author_email === currentUserEmail;
  const addressed = message.addressed_at != null;

  const handleAddress = async () => {
    try {
      if (addressed) await onUnaddress(message.id);
      else await onAddress(message.id);
    } catch (err) { reportErr(err); }
  };

  const handleRemove = async () => {
    if (!confirm("Delete this sticky note?")) return;
    try { await onRemove(message.id); } catch (err) { reportErr(err); }
  };

  return (
    <div className={`px-3 py-2 ${addressed ? "bg-row-active-dim opacity-70" : "bg-amber-glow-50 dark:bg-amber-glow-950/40"} border-l-2 ${addressed ? "border-line" : "border-amber-glow-500"}`}>
      <div className="text-[12px] text-fg break-words">{message.body}</div>
      <div className="text-[10px] text-faint mt-1.5 uppercase tracking-[0.12em] flex items-center gap-2 flex-wrap">
        <span>{actorOf(message.author_email)}</span>
        <span>·</span>
        <span>{formatRelative(message.created_at)}</span>
        {addressed && (
          <>
            <span>·</span>
            <span className="text-resolved">addressed</span>
          </>
        )}
        <span className="ml-auto inline-flex items-center gap-1">
          <button
            onClick={handleAddress}
            title={addressed ? "Mark unaddressed" : "Mark addressed"}
            aria-label={addressed ? "Mark unaddressed" : "Mark addressed"}
            className="text-muted hover:text-resolved p-0.5 cursor-pointer bg-transparent border-0"
          >
            <Check size={12} />
          </button>
          {isAuthor && (
            <button
              onClick={handleRemove}
              title="Delete"
              aria-label="Delete"
              className="text-muted hover:text-warn p-0.5 cursor-pointer bg-transparent border-0"
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

function actorOf(email) {
  if (!email) return "Someone";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function formatRelative(iso) {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  const m = Math.floor(dt / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function reportErr(err) {
  // eslint-disable-next-line no-console
  console.error("[chore-message]", err);
  alert("That action failed. See console for details.");
}
