import { useEffect, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { useChoreMessages } from "../lib/data/useChoreMessages.js";
import { useChoreLookup } from "../lib/data/useChoreLookup.js";

// Top-bar inbox affordance. Shows a bell with a count badge of unaddressed
// chore messages. Click to open a small dropdown listing the unaddressed
// items with quick "address" / dismiss actions.
export default function InboxBell() {
  const { messages, address } = useChoreMessages({ unaddressedOnly: true });
  const choreTitleFor = useChoreLookup();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside-click or Escape.
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

  const count = messages.length;
  const hasMessages = count > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={hasMessages
          ? `${count} unaddressed chore message${count === 1 ? "" : "s"}`
          : "No chore messages"}
        title={hasMessages ? `${count} unaddressed` : "No unaddressed messages"}
        className="bg-transparent border-0 text-dim p-1.5 cursor-pointer flex items-center justify-center relative"
      >
        <Bell size={16} />
        {hasMessages && (
          <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-glow-500 text-[9px] font-bold text-bg flex items-center justify-center leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-[340px] max-h-[420px] overflow-y-auto bg-surface border border-line shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-50 no-scrollbar"
          role="dialog"
          aria-label="Unaddressed chore messages"
        >
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
              Unaddressed messages
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            >
              <X size={14} />
            </button>
          </div>
          {messages.length === 0 ? (
            <div className="px-4 py-6 text-[12px] text-dim text-center italic">
              Nothing needs attention right now.
            </div>
          ) : (
            <ul className="m-0 p-0 list-none">
              {messages.map((m) => (
                <li key={m.id} className="px-4 py-3 border-b border-line last:border-b-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[12px] text-fg truncate">
                        {choreTitleFor(m.chore_id) ?? m.chore_id}
                      </div>
                      <div className="text-[12px] text-dim mt-0.5 break-words">
                        {m.body}
                      </div>
                      <div className="text-[10px] text-faint mt-1 uppercase tracking-[0.12em]">
                        {actorOf(m.author_email)} · {formatRelative(m.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => address(m.id).catch(reportErr)}
                      title="Mark addressed"
                      aria-label="Mark addressed"
                      className="shrink-0 text-muted hover:text-resolved p-1 cursor-pointer bg-transparent border-0"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
  console.error("[inbox]", err);
  alert("That action failed. See console for details.");
}
