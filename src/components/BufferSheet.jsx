import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ADMINS } from "../lib/schedule/manDown.js";
import { buildBuffer } from "../lib/schedule/buffers.js";

// Add a buffer to an activity (S53/S55/S57, BD23). The "bufferable interface":
// any activity with a time anchor (an event, or a chore block with a start +
// duration) opens this sheet from its detail panel. The sheet configures the
// side (before / after / both), the length, an optional label, and an optional
// setup/cleanup checklist (the market-equipment list). The window is resolved
// from the activity's anchor by buildBuffer — the buffer never moves the thing
// it buffers (S61), it only reserves adjacent time.
const SIDES = [
  { id: "before", label: "Before" },
  { id: "after", label: "After" },
  { id: "both", label: "Both" },
];
const LENGTHS = [15, 30, 45, 60, 90, 120];

export default function BufferSheet({ activity, onAdd, onClose }) {
  // A "before" buffer needs a start; "after" needs an end. Default the side to
  // whichever the activity can support, preferring before (the market case).
  const canBefore = activity.startMin != null;
  const canAfter = (activity.endMin ?? activity.startMin) != null;
  const [side, setSide] = useState(canBefore ? "before" : "after");
  const [mins, setMins] = useState(60);
  const [label, setLabel] = useState("");
  const [assignee, setAssignee] = useState(null);
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState("");

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

  const addItem = () => {
    const t = draft.trim();
    if (!t) return;
    setItems((xs) => [...xs, t]);
    setDraft("");
  };

  const sideOk = side === "before" ? canBefore
    : side === "after" ? canAfter : (canBefore && canAfter);
  const valid = sideOk && mins > 0;

  const submit = () => {
    if (!valid) return;
    const built = buildBuffer({
      target: activity.target,
      anchor: { startMin: activity.startMin, endMin: activity.endMin },
      side, mins, label, checklist: items,
    });
    if (!built) return;
    onAdd({ ...built, assignee });
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
        aria-label="Add a buffer"
      >
        <div>
          <div className="font-heading text-[18px] font-semibold">Add a buffer</div>
          <div className="text-[12px] text-dim mt-0.5 truncate">
            around {activity.label}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Side
          </span>
          <div className="flex gap-2">
            {SIDES.map((s) => {
              const ok = s.id === "before" ? canBefore
                : s.id === "after" ? canAfter : (canBefore && canAfter);
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => setSide(s.id)}
                  className={"text-[13px] px-3 py-1.5 border disabled:opacity-30 "
                    + (side === s.id
                      ? "border-accent text-accent" : "border-line text-dim")}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Length
          </span>
          <select
            value={mins}
            onChange={(e) => setMins(Number(e.target.value))}
            className="bg-surface border border-line text-[14px] text-fg px-2 py-2"
          >
            {LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} hr${m === 60 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Label (optional)
          </span>
          <input value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Market setup…"
            className="bg-surface border border-line text-[14px] text-fg px-2 py-2 placeholder:text-faint" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Checklist (optional)
          </span>
          {items.length > 0 && (
            <ul className="flex flex-col gap-1 mb-1">
              {items.map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-dim">
                  <span className="w-3.5 h-3.5 border border-line inline-block shrink-0" />
                  <span className="flex-1 truncate">{t}</span>
                  <button type="button"
                    onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                    className="shrink-0 text-faint hover:text-warn"
                    aria-label="Remove item">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder="Tent & tables…"
              className="flex-1 bg-surface border border-line text-[14px] text-fg px-2 py-2 placeholder:text-faint" />
            <button type="button" onClick={addItem}
              className="bg-transparent border border-line text-dim text-[13px] px-3">
              Add
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Reserve for (optional)
          </span>
          <div className="flex gap-2">
            {ADMINS.map((a) => (
              <button key={a} type="button"
                onClick={() => setAssignee(assignee === a ? null : a)}
                className={"text-[13px] px-3 py-1.5 border " + (assignee === a
                  ? "border-accent text-accent" : "border-line text-dim")}>
                {a}
              </button>
            ))}
          </div>
        </label>

        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose}
            className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5">
            Cancel
          </button>
          <button onClick={submit} disabled={!valid}
            className="bg-accent text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 disabled:opacity-40">
            Add buffer
          </button>
        </div>
      </div>
    </div>
  );
}
