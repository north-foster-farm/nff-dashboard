import { useEffect, useRef, useState } from "react";
import {
  Bell, Check, Lightbulb, Sparkles, Trash2, X, ArrowUpRight,
} from "lucide-react";
import { useChoreMessages } from "../lib/data/useChoreMessages.js";
import { useChoreLookup } from "../lib/data/useChoreLookup.js";
import { useInboxItems } from "../lib/data/useInboxItems.js";
import { useAutomationEmissions } from "../lib/data/useAutomations.js";
import { navigate } from "../lib/browser/router.js";

// Top-bar notifications affordance. Shows a bell with a count badge of
// automation firings + unaddressed chore messages + unread inbox
// thoughts (Batch 21; automations added in Batch 27.5 when the Heads
// Up lane retired). Click to open a dropdown listing all three, with
// quick triage actions.
export default function InboxBell() {
  const { messages, address } = useChoreMessages({ unaddressedOnly: true });
  const inbox = useInboxItems();
  const choreTitleFor = useChoreLookup();
  // Active automation firings — "the system did something for you."
  // Clear = acknowledge (keeps what was created); Delete = dismiss
  // (tombstones the created events / chores via the dismiss RPC).
  const { emissions, acknowledge, dismiss } = useAutomationEmissions();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const unreadThoughts = inbox.items.filter(i => !inbox.isRead(i.id));

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

  const count =
    messages.length + unreadThoughts.length + (emissions?.length ?? 0);
  const hasMessages = count > 0;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={hasMessages
          ? `${count} notification${count === 1 ? "" : "s"}`
          : "No notifications"}
        title={hasMessages ? `${count} to look at` : "Nothing needs attention"}
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
              Notifications
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            >
              <X size={14} />
            </button>
          </div>
          {/* Automation firings (Batch 27.5 — replaces the Heads Up
              lane). Clear keeps what was created; the trash dismisses
              and removes the created events / chores. */}
          {(emissions?.length ?? 0) > 0 && (
            <div className="border-b border-line">
              <div className="px-4 pt-3 pb-1 font-ui text-[10px] text-faint uppercase tracking-[0.14em] font-semibold">
                Automations
              </div>
              <ul className="m-0 p-0 list-none">
                {emissions.map((em) => (
                  <li key={em.id}
                    className="px-4 py-2.5 border-b border-line last:border-b-0">
                    <div className="flex items-start gap-2">
                      <Sparkles size={13}
                        className="shrink-0 text-accent-deep translate-y-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-fg break-words leading-relaxed">
                          {em.summary}
                        </div>
                        <div className="text-[10px] text-faint mt-1 uppercase tracking-[0.12em]">
                          {formatRelative(em.firedAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => acknowledge(em.id).catch(reportErr)}
                        title="Clear — keep what it created"
                        aria-label="Clear"
                        className="shrink-0 text-muted hover:text-resolved p-1 cursor-pointer bg-transparent border-0"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(
                            "Delete this firing and everything it "
                            + "created (its events and chores)?")) return;
                          dismiss(em.id, null).catch(reportErr);
                        }}
                        title="Delete — remove what it created"
                        aria-label="Delete"
                        className="shrink-0 text-muted hover:text-warn p-1 cursor-pointer bg-transparent border-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {unreadThoughts.length > 0 && (
            <div className="border-b border-line">
              <div className="px-4 pt-3 pb-1 font-ui text-[10px] text-faint uppercase tracking-[0.14em] font-semibold flex items-center justify-between">
                <span>New thoughts</span>
                <button
                  onClick={() => { setOpen(false); navigate("/inbox"); }}
                  className="inline-flex items-center gap-0.5 bg-transparent border-0 p-0 text-accent-deep cursor-pointer font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em]"
                >
                  Inbox <ArrowUpRight size={11} />
                </button>
              </div>
              <ul className="m-0 p-0 list-none">
                {unreadThoughts.slice(0, 5).map((t) => (
                  <li key={t.id} className="px-4 py-2.5 border-b border-line last:border-b-0">
                    <div className="flex items-start gap-2">
                      <Lightbulb size={13} className="shrink-0 text-accent-deep translate-y-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-fg break-words leading-relaxed">
                          {t.body.length > 120 ? t.body.slice(0, 117) + "…" : t.body}
                        </div>
                        <div className="text-[10px] text-faint mt-1 uppercase tracking-[0.12em]">
                          {actorOf(t.createdBy)} · {formatRelative(t.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => inbox.markRead(t.id).catch(reportErr)}
                        title="Mark read"
                        aria-label="Mark read"
                        className="shrink-0 text-muted hover:text-resolved p-1 cursor-pointer bg-transparent border-0"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </li>
                ))}
                {unreadThoughts.length > 5 && (
                  <li className="px-4 py-2 text-[11px] text-dim">
                    +{unreadThoughts.length - 5} more in the Inbox
                  </li>
                )}
              </ul>
            </div>
          )}
          {messages.length === 0 && unreadThoughts.length === 0
            && (emissions?.length ?? 0) === 0 ? (
            <div className="px-4 py-6 text-[12px] text-dim text-center italic">
              Nothing needs attention right now.
            </div>
          ) : messages.length === 0 ? null : (
            <ul className="m-0 p-0 list-none">
              {(unreadThoughts.length > 0
                || (emissions?.length ?? 0) > 0) && (
                <li className="px-4 pt-3 pb-1 font-ui text-[10px] text-faint uppercase tracking-[0.14em] font-semibold">
                  Chore messages
                </li>
              )}
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
