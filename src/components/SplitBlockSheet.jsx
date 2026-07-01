import { useEffect, useState } from "react";
import { BTN_ACCENT, BTN_GHOST } from "./ui.jsx";

// Split a chore block for one day (S72) — divide a block's work into a second
// sitting at a later time. You pick which rows move and the time they move to;
// each selected row gets a clock-time override for today only (the global
// block is untouched). The moved rows then show their new time in the block,
// reading as a second sitting. Instance-local, like every other schedule edit.
export default function SplitBlockSheet({ blockName, items, onApply, onClose }) {
  const [time, setTime] = useState("");
  const [picked, setPicked] = useState(() => new Set());

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

  const toggle = (key) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const valid = time && picked.size > 0;

  return (
    <div
      className="fixed inset-0 z-[205] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg border border-line w-full max-w-[420px] p-5 flex flex-col gap-4 max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Split block"
      >
        <div>
          <div className="font-heading text-[18px] font-semibold">Split block</div>
          <div className="text-[12px] text-dim mt-0.5">
            Move some of {blockName}'s work to a second sitting today.
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Second sitting at
          </span>
          <input type="time" value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-surface border border-line text-[14px] text-fg px-2 py-2" />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
            Move which?
          </span>
          <ul className="border border-line divide-y divide-line max-h-[40vh] overflow-y-auto">
            {items.map((it) => (
              <li key={it.key}>
                <button type="button" onClick={() => toggle(it.key)}
                  aria-pressed={picked.has(it.key)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-row-hover cursor-pointer">
                  <span className={"shrink-0 w-5 h-5 border-2 inline-flex items-center justify-center "
                    + (picked.has(it.key)
                      ? "bg-accent border-accent" : "border-line")}>
                    {picked.has(it.key) && (
                      <span className="w-2 h-2 bg-on-accent" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[14px] text-fg">
                    {it.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2 mt-1">
          <button onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button onClick={() => valid && onApply([...picked], time)}
            disabled={!valid}
            className={BTN_ACCENT}>
            {picked.size > 0 ? `Move ${picked.size}` : "Move"}
          </button>
        </div>
      </div>
    </div>
  );
}
