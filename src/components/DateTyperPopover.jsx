import { useEffect, useRef, useState } from "react";

// Date-typer popover (Notion Calendar pattern). Click a date header,
// type into the input, hit Enter — the parent's date jumps. Accepts:
//   * "today" / "tomorrow" / "yesterday"
//   * "Aug 2027" / "August 2027" / "8/2027"
//   * "Sep 14" / "Sep 14, 2026" / "September 14 2026"
//   * "9/14" / "9/14/2026" / "9-14-2026"
//   * ISO "2026-09-14"
//
// Reasonable mistakes parse: "Aug 32" or unknown month name → null.
// The Schedule consumer ignores null returns and shows a small
// "didn't recognise" hint.

export default function DateTyperPopover({
  initial,
  onPick,
  onCancel,
  anchorRef,
}) {
  const inputRef = useRef(null);
  const [value, setValue] = useState(() => formatInitial(initial));
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Position the popover under its anchor (the clicked header).
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [anchorRef]);

  const submit = () => {
    const d = parseDateInput(value);
    if (!d) { setWarn(true); return; }
    onPick?.(d);
  };

  return (
    <div
      className="fixed inset-0 z-[180]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bg-bg border border-line p-2 flex items-center gap-2 shadow-lg"
        style={{ top: pos.top, left: pos.left }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setWarn(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="e.g. Sep 14, today"
          className={
            "bg-surface border text-fg text-[12px] px-2 py-1.5 outline-none " +
            "font-[inherit] w-[220px] " +
            (warn ? "border-warn" : "border-line focus:border-accent")
          }
        />
        <button
          onClick={submit}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1 cursor-pointer"
        >
          Go
        </button>
      </div>
    </div>
  );
}

function formatInitial(date) {
  if (!(date instanceof Date)) return "";
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_PREFIX = MONTHS.map(m => m.slice(0, 3));

function monthFromName(name) {
  const lc = name.toLowerCase();
  const full = MONTHS.indexOf(lc);
  if (full >= 0) return full;
  const pre = MONTH_PREFIX.indexOf(lc.slice(0, 3));
  return pre;
}

// Top-level parser. Returns a Date anchored to local midnight, or
// null when nothing matches. Tries each shape in order; the first
// match wins. Year defaults to today's when omitted.
export function parseDateInput(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Reserved keywords.
  const lc = trimmed.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (lc === "today") return today;
  if (lc === "tomorrow") {
    const t = new Date(today); t.setDate(t.getDate() + 1); return t;
  }
  if (lc === "yesterday") {
    const t = new Date(today); t.setDate(t.getDate() - 1); return t;
  }

  // ISO YYYY-MM-DD.
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (m) return safeDate(+m[1], +m[2], +m[3]);

  // Month-only: "Aug 2027", "Aug2027", "August 2027", "8/2027".
  m = /^([A-Za-z]+)\s*[,]?\s*(\d{4})$/.exec(trimmed);
  if (m) {
    const month = monthFromName(m[1]);
    if (month >= 0) return safeDate(+m[2], month + 1, 1);
  }
  m = /^(\d{1,2})\s*[/]\s*(\d{4})$/.exec(trimmed);
  if (m) return safeDate(+m[2], +m[1], 1);

  // Month + day, optional year: "Sep 14", "Sep 14, 2026",
  // "September 14 2026", "Sept 14, '26".
  m = /^([A-Za-z]+)\s+(\d{1,2})(?:[,\s]+(\d{2,4}))?$/.exec(trimmed);
  if (m) {
    const month = monthFromName(m[1]);
    const day = +m[2];
    if (month >= 0 && Number.isFinite(day)) {
      const year = m[3] ? expandYear(+m[3]) : today.getFullYear();
      const candidate = safeDate(year, month + 1, day);
      // If they typed just "Sep 14" today is past, jump forward a year so
      // the picker lands on the *next* Sep 14, mirroring Notion Calendar.
      if (candidate && !m[3] && candidate < today) {
        return safeDate(year + 1, month + 1, day);
      }
      return candidate;
    }
  }

  // M/D, M/D/YYYY, M-D, M-D-YYYY.
  m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(trimmed);
  if (m) {
    const month = +m[1];
    const day = +m[2];
    const year = m[3] ? expandYear(+m[3]) : today.getFullYear();
    const candidate = safeDate(year, month, day);
    if (candidate && !m[3] && candidate < today) {
      return safeDate(year + 1, month, day);
    }
    return candidate;
  }

  return null;
}

function expandYear(y) {
  if (y < 100) return 2000 + y;
  return y;
}

function safeDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  // Reject overflow ("Aug 32" → Sep 1).
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
