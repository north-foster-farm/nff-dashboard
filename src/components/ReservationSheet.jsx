import { useEffect, useMemo, useState } from "react";
import { ADMINS } from "../lib/schedule/manDown.js";

// Add non-work time (S7) — an off-site / break / appointment / day-off
// window for one person. Stored as a `reservation` commitment; it's what
// makes a clashing assigned chore show as man-down (S8). A day-off spans the
// whole day, so it hides the time fields.
//
// Repeat (S45 multi-day / S46 recurring): a reservation can cover several
// days in one action. "Repeat" mode reserves the chosen weekdays across a
// horizon (e.g. every Sunday for 8 weeks, or Mon–Fri this week) by
// materialising one reservation per matching date from the viewed day
// forward — keeping each as a plain per-day commitment the existing read +
// man-down logic already handles.
const KINDS = [
  { id: "off_site", label: "Off-site" },
  { id: "break", label: "Break" },
  { id: "appointment", label: "Appointment" },
  { id: "day_off", label: "Day off" },
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const HORIZONS = [
  { weeks: 1, label: "1 wk" },
  { weeks: 4, label: "4 wks" },
  { weeks: 8, label: "8 wks" },
  { weeks: 12, label: "12 wks" },
];

export default function ReservationSheet({ onAdd, onClose, anchorDate, ymd }) {
  const [assignee, setAssignee] = useState(ADMINS[0]);
  const [kind, setKind] = useState("off_site");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [repeat, setRepeat] = useState(false);
  // Preselect the viewed day's weekday so "Repeat" defaults to "this weekday".
  const anchorDow = anchorDate ? anchorDate.getDay() : 0;
  const [dows, setDows] = useState(() => new Set([anchorDow]));
  const [weeks, setWeeks] = useState(8);
  const canRepeat = Boolean(anchorDate && ymd);

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

  const toggleDow = (i) => setDows((s) => {
    const n = new Set(s);
    if (n.has(i)) { if (n.size > 1) n.delete(i); } else n.add(i);
    return n;
  });

  // The materialised date list when repeating — every matching weekday from
  // the viewed day through the horizon (inclusive of the anchor day).
  const repeatDates = useMemo(() => {
    if (!repeat || !canRepeat) return null;
    const base = new Date(anchorDate);
    base.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (dows.has(d.getDay())) out.push(ymd(d));
    }
    return out;
  }, [repeat, canRepeat, anchorDate, ymd, dows, weeks]);

  const isDayOff = kind === "day_off";
  const valid = (isDayOff || start)
    && (!repeat || (repeatDates && repeatDates.length > 0));

  const submit = () => {
    if (!valid) return;
    onAdd({
      assignee, kind,
      start: isDayOff ? null : start,
      end: isDayOff ? null : (end || null),
      label: label.trim() || null,
      dates: repeat ? repeatDates : null,
      series: repeat ? crypto.randomUUID() : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-line w-full max-w-[420px] p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
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

        {canRepeat && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <label className="flex items-center gap-2 text-[13px] text-dim cursor-pointer">
              <input type="checkbox" checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)} />
              Repeat across days
            </label>
            {repeat && (
              <>
                <div className="flex gap-1">
                  {WEEKDAYS.map((w, i) => (
                    <button key={i} type="button" onClick={() => toggleDow(i)}
                      aria-pressed={dows.has(i)}
                      className={"flex-1 py-1.5 border text-[12px] " + (dows.has(i)
                        ? "border-accent text-accent" : "border-line text-faint")}>
                      {w}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                    For
                  </span>
                  <div className="flex gap-1.5">
                    {HORIZONS.map((h) => (
                      <button key={h.weeks} type="button"
                        onClick={() => setWeeks(h.weeks)}
                        className={"text-[12px] px-2.5 py-1 border " + (weeks === h.weeks
                          ? "border-accent text-accent" : "border-line text-dim")}>
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-[12px] text-faint">
                  {repeatDates?.length
                    ? `Reserves ${repeatDates.length} day${repeatDates.length === 1 ? "" : "s"}.`
                    : "Pick at least one weekday."}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose}
            className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5">
            Cancel
          </button>
          <button onClick={submit} disabled={!valid}
            className="bg-accent text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 disabled:opacity-40">
            {repeat && repeatDates?.length > 1 ? `Add ${repeatDates.length}` : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
