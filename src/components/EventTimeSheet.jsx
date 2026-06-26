import { useEffect, useState } from "react";

// Edit an event's start / end time from the Schedule (S67). Time-only — date
// moves and full recurrence edits stay in the Calendar's EventEditor. On save
// the caller decides scope: a recurring occurrence pops the this/following/all
// prompt; a one-off applies straight to its occurrence.
export default function EventTimeSheet({ occ, onSave, onClose }) {
  const [start, setStart] = useState(occ.startTime ?? "");
  const [end, setEnd] = useState(occ.endTime ?? "");

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

  const valid = Boolean(start) && (!end || end > start);

  return (
    <div
      className="fixed inset-0 z-[205] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-line w-full max-w-[400px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit event time"
      >
        <div>
          <div className="font-heading text-[18px] font-semibold">Edit time</div>
          <div className="text-[12px] text-dim mt-0.5 truncate">
            {occ.instanceLabel}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
              Start
            </span>
            <input type="time" value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-surface border border-line text-[14px] text-fg px-2 py-2" />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
              End
            </span>
            <input type="time" value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-surface border border-line text-[14px] text-fg px-2 py-2" />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose}
            className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={() => valid && onSave({ startTime: start, endTime: end || null })}
            disabled={!valid}
            className="bg-accent text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
