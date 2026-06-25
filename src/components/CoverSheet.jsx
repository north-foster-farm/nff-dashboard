import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

// The man-down cover sheet (S8 / S60a). Opens from the "needs cover" leak:
// names the clashing chore, explains why its assignee can't do it, and lets
// the other person take it — assign + notify them to acknowledge. A
// bottom-anchored sheet, per the minimalist mockup.
//
// Props:
//   label, placeLabel - the chore
//   blockName, timeLabel, assignee - where/when/who it's on
//   reason            - why the assignee is unavailable (the leak text)
//   cover             - { person, free } from pickCoverPerson
//   onCover()         - assign the cover person + mark awaiting-ack
//   onClose()
export default function CoverSheet({
  label, placeLabel, blockName, timeLabel, assignee, reason, cover, onCover,
  onClose,
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const who = cover?.person;
  const canSend = !!who;

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface border-t sm:border border-line w-full sm:max-w-[420px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Cover this chore"
      >
        <div className="flex items-start justify-between">
          <h4 className="font-heading text-[18px] font-semibold">
            Cover this chore?
          </h4>
          <button onClick={onClose} className="text-faint hover:text-fg"
            aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 py-3 bg-surface-alt border border-line">
          <AlertTriangle size={16} className="shrink-0 text-warn" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium truncate">
              {label}{placeLabel ? ` · ${placeLabel}` : ""}
            </div>
            <div className="text-[12px] text-dim">
              {blockName}{timeLabel ? `, ${timeLabel}` : ""} · assigned {assignee}
            </div>
          </div>
        </div>

        <p className="text-[13px] text-dim leading-relaxed m-0">
          {reason}{" "}
          {who
            ? (cover.free
              ? `${who} is on and free — assign ${who} and notify them to acknowledge.`
              : `${who} is also committed then, but can still take it if needed.`)
            : "No one else is available to cover right now."}
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCover}
            disabled={!canSend}
            className="flex-1 py-3 bg-accent-deep text-on-accent font-semibold text-[14px] hover:brightness-110 disabled:opacity-40"
          >
            {who ? `${who} covers — send` : "No one available"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 border border-line text-[13px] text-dim hover:text-fg"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
