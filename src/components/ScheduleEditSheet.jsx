import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { assessEdit } from "../lib/schedule/overrides.js";

// The per-row edit sheet for the Schedule (S6 3/3 — S63/S70/S73). Lets a
// row be moved to another block, given a clock time, or (commitment-backed
// rows only) moved to another day. A "risky" change — a different block or
// another day — passes through a protection double-confirm that explains
// WHY (assessEdit), so it's never a generic "are you sure".
//
// Props:
//   label            - the row's display name
//   fromBucket       - its current block bucket id ("anytime" if none)
//   fromBlockName    - its current block's name (for the "why")
//   isFirstInBlock   - is it first in its block (sharpens the "why")
//   currentClockTime - existing clock time, or null
//   canMoveDay       - true for commitment-backed rows (ad_hoc/chore/note)
//   blocks           - [{ id, name }] for the block picker
//   onApply(change)  - change = { toBlockId, clockTime, toDate }
//   onClose()
const ANYTIME = "anytime";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ScheduleEditSheet({
  label, fromBucket, fromBlockName, isFirstInBlock, currentClockTime,
  canMoveDay, committed, blocks, onApply, onClose,
}) {
  const [toBlockId, setToBlockId] = useState(fromBucket ?? ANYTIME);
  const [clockTime, setClockTime] = useState(currentClockTime ?? "");
  const [toDate, setToDate] = useState(""); // "" = stay today
  const [confirming, setConfirming] = useState(false);

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

  // Only the keys that actually changed are present; a present `clockTime:
  // null` means "cleared" (distinct from "unchanged" = absent).
  const change = {};
  if (toBlockId !== fromBucket) change.toBlockId = toBlockId;
  if ((clockTime || null) !== (currentClockTime ?? null)) {
    change.clockTime = clockTime || null;
  }
  if (canMoveDay && toDate) change.toDate = toDate;
  const dirty = Object.keys(change).length > 0;

  const assessment = assessEdit({
    label, fromBucket, fromBlockName, isFirstInBlock,
    toBlockId: change.toBlockId, toDate: change.toDate, committed,
  });

  const submit = () => {
    if (!dirty) return;
    if (assessment.protected && !confirming) { setConfirming(true); return; }
    onApply(change);
  };

  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); })();

  return (
    <div
      className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-line w-full max-w-[420px] p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit schedule item"
      >
        {confirming ? (
          <>
            <div className="flex items-center gap-2 text-warn">
              <ShieldAlert size={20} className="shrink-0" />
              <span className="font-heading text-[17px] font-semibold">
                Protected — are you sure?
              </span>
            </div>
            <p className="text-[13px] text-fg m-0 leading-relaxed">
              {assessment.why}
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={() => setConfirming(false)}
                className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5"
              >
                Back
              </button>
              <button
                onClick={() => onApply(change)}
                className="bg-warn text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5"
              >
                Move anyway
              </button>
            </div>
          </>
        ) : (
          <>
            {/* A clear action title so the sheet says what it does, not just
                the row name (F52). */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted">
                Move or edit
              </div>
              <div className="font-heading text-[18px] font-semibold truncate">
                {label}
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                Block
              </span>
              <select
                value={toBlockId}
                onChange={(e) => setToBlockId(e.target.value)}
                className="bg-surface border border-line text-[14px] text-fg px-2 py-2"
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
                <option value={ANYTIME}>Anytime</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                Time (optional)
              </span>
              <input
                type="time"
                value={clockTime}
                onChange={(e) => setClockTime(e.target.value)}
                className="bg-surface border border-line text-[14px] text-fg px-2 py-2"
              />
            </label>

            {canMoveDay && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
                  Day
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setToDate("")}
                    className={"text-[12px] px-2 py-1 border " + (!toDate
                      ? "border-accent text-accent" : "border-line text-dim")}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDate(tomorrow)}
                    className={"text-[12px] px-2 py-1 border " + (toDate === tomorrow
                      ? "border-accent text-accent" : "border-line text-dim")}
                  >
                    Tomorrow
                  </button>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-surface border border-line text-[13px] text-fg px-2 py-1 ml-auto"
                  />
                </div>
              </label>
            )}

            {assessment.protected && (
              <div className="flex items-center gap-1.5 text-[12px] text-warn">
                <ShieldAlert size={13} className="shrink-0" />
                <span>Protected change.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-1">
              <button
                onClick={onClose}
                className="bg-transparent border border-line text-dim text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!dirty}
                className="bg-accent text-on-accent text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 disabled:opacity-40"
              >
                {assessment.protected ? "Review" : "Apply"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
