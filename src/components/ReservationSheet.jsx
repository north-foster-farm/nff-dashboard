import { useEffect, useState } from "react";
import { ADMINS } from "../lib/schedule/manDown.js";

// Add non-work time (S7) — an off-site / break / appointment / day-off
// window for one person. Stored as a `reservation` commitment; it's what
// makes a clashing assigned chore show as man-down (S8). A day-off spans the
// whole day, so it hides the time fields.
const KINDS = [
  { id: "off_site", label: "Off-site" },
  { id: "break", label: "Break" },
  { id: "appointment", label: "Appointment" },
  { id: "day_off", label: "Day off" },
];

export default function ReservationSheet({ onAdd, onClose }) {
  const [assignee, setAssignee] = useState(ADMINS[0]);
  const [kind, setKind] = useState("off_site");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");

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

  const isDayOff = kind === "day_off";
  const valid = isDayOff || start;

  const submit = () => {
    if (!valid) return;
    onAdd({
      assignee, kind,
      start: isDayOff ? null : start,
      end: isDayOff ? null : (end || null),
      label: label.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-line w-full max-w-[420px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Add non-work time"
      >
        <div className="font-heading text-[18px] font-semibold">Add time off</div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Who
          </span>
          <div className="flex gap-2">
            {ADMINS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAssignee(a)}
                className={"text-[13px] px-3 py-1.5 border " + (assignee === a
                  ? "border-accent text-accent" : "border-line text-dim")}
              >
                {a}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Kind
          </span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-surface border border-line text-[14px] text-fg px-2 py-2"
          >
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>

        {!isDayOff && (
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                From
              </span>
              <input type="time" value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-surface border border-line text-[14px] text-fg px-2 py-2" />
            </label>
            <label className="flex flex-col gap-1 flex-1">
              <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                Until
              </span>
              <input type="time" value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-surface border border-line text-[14px] text-fg px-2 py-2" />
            </label>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Label (optional)
          </span>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="At the farmers market…"
            className="bg-surface border border-line text-[14px] text-fg px-2 py-2 placeholder:text-faint" />
        </label>

        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose}
            className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5">
            Cancel
          </button>
          <button onClick={submit} disabled={!valid}
            className="bg-accent text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 disabled:opacity-40">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
