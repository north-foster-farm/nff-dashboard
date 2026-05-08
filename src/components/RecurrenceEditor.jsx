import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

// Two-tier recurrence editor (Batch 13.2).
//
//   * Top tier — preset dropdown: None / Daily / Weekly / Monthly /
//     Yearly / Custom. Picking Daily / Weekly / Monthly / Yearly
//     auto-generates a sensible RRULE string from the series's
//     dtstart (e.g. Weekly anchors to dtstart's day-of-week,
//     Monthly to its day-of-month). Picking Custom opens a modal
//     with a full Apple-Calendar-style builder.
//
//   * Bottom tier — Custom modal: frequency + interval + BYDAY
//     toggles (for weekly / monthly) + UNTIL date.
//
// Value shape:
//   { rrule: string | null, until: string | null }
//
// `null` rrule = one-off / no recurrence.
//
// `dtstart` is the ISO timestamp string of the series's start.
// Used to seed defaults — e.g. a Weekly preset reads its day-of-
// week from the dtstart. The editor doesn't write back to dtstart
// directly; the surrounding EventEditor owns that field.

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export default function RecurrenceEditor({ value, onChange, dtstart }) {
  const preset = useMemo(() => detectPreset(value?.rrule), [value?.rrule]);
  const [customOpen, setCustomOpen] = useState(false);

  const setPreset = (p) => {
    if (p === "custom") {
      setCustomOpen(true);
      return;
    }
    onChange?.(presetToRule(p, dtstart, value));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
      >
        <option value="none">Doesn't repeat</option>
        <option value="daily">Every day</option>
        <option value="weekly">Every week</option>
        <option value="monthly">Every month</option>
        <option value="yearly">Every year</option>
        <option value="custom">Custom…</option>
      </select>
      {value?.rrule && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint">
            {summariseRule(value.rrule, value.until)}
          </span>
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="text-[10px] text-dim hover:text-fg uppercase tracking-[0.12em] font-semibold border-0 bg-transparent cursor-pointer"
          >
            Customize
          </button>
        </div>
      )}
      {customOpen && (
        <CustomRecurrenceDialog
          value={value}
          dtstart={dtstart}
          onCancel={() => setCustomOpen(false)}
          onSave={(next) => {
            onChange?.(next);
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Preset detection / generation ───────────────────────────────────
function detectPreset(rrule) {
  if (!rrule) return "none";
  const parts = parseRule(rrule);
  // Daily: FREQ=DAILY, no INTERVAL > 1, nothing else.
  if (parts.FREQ === "DAILY"
    && (parts.INTERVAL == null || parts.INTERVAL === "1")
    && !parts.BYDAY && !parts.BYMONTHDAY && !parts.BYMONTH) return "daily";
  if (parts.FREQ === "WEEKLY"
    && (parts.INTERVAL == null || parts.INTERVAL === "1")
    && (!parts.BYDAY || !parts.BYDAY.includes(","))) return "weekly";
  if (parts.FREQ === "MONTHLY"
    && (parts.INTERVAL == null || parts.INTERVAL === "1")
    && parts.BYMONTHDAY
    && !parts.BYDAY) return "monthly";
  if (parts.FREQ === "YEARLY"
    && (parts.INTERVAL == null || parts.INTERVAL === "1")
    && parts.BYMONTH && parts.BYMONTHDAY) return "yearly";
  return "custom";
}

function presetToRule(preset, dtstart, currentValue) {
  if (preset === "none") return { rrule: null, until: null };
  const d = parseDtstart(dtstart);
  const dow = d ? d.getUTCDay() : 0;
  const dom = d ? d.getUTCDate() : 1;
  const month = d ? d.getUTCMonth() + 1 : 1;
  const until = currentValue?.until ?? null;
  let rrule;
  if (preset === "daily") rrule = "FREQ=DAILY";
  else if (preset === "weekly") rrule = `FREQ=WEEKLY;BYDAY=${DOW_RRULE[dow]}`;
  else if (preset === "monthly") rrule = `FREQ=MONTHLY;BYMONTHDAY=${dom}`;
  else if (preset === "yearly") rrule = `FREQ=YEARLY;BYMONTH=${month};BYMONTHDAY=${dom}`;
  else rrule = null;
  if (rrule && until) {
    rrule = rrule + ";UNTIL=" + isoToRfcUntil(until);
  }
  return { rrule, until };
}

// ── Custom dialog ───────────────────────────────────────────────────
function CustomRecurrenceDialog({ value, dtstart, onCancel, onSave }) {
  const initial = useMemo(() => fromValue(value, dtstart), [value, dtstart]);
  const [freq, setFreq] = useState(initial.freq);
  const [interval, setInterval] = useState(initial.interval);
  const [byday, setByday] = useState(initial.byday);
  const [bymonthday, setBymonthday] = useState(initial.bymonthday);
  const [bymonth, setBymonth] = useState(initial.bymonth);
  const [untilEnabled, setUntilEnabled] = useState(!!initial.until);
  const [until, setUntil] = useState(initial.until ?? "");

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const toggleDow = (d) => {
    setByday((prev) => prev.includes(d)
      ? prev.filter(x => x !== d)
      : [...prev, d].sort((a, b) => a - b));
  };

  const submit = () => {
    const parts = [`FREQ=${freq}`];
    const intN = parseInt(interval, 10);
    if (Number.isFinite(intN) && intN > 1) parts.push(`INTERVAL=${intN}`);
    if (freq === "WEEKLY" && byday.length > 0) {
      parts.push("BYDAY=" + byday.map(i => DOW_RRULE[i]).join(","));
    }
    if (freq === "MONTHLY" && bymonthday) {
      parts.push(`BYMONTHDAY=${bymonthday}`);
    }
    if (freq === "YEARLY" && bymonth && bymonthday) {
      parts.push(`BYMONTH=${bymonth};BYMONTHDAY=${bymonthday}`);
    }
    let untilIso = null;
    if (untilEnabled && until) {
      untilIso = until + "T23:59:59Z";
      parts.push("UNTIL=" + isoToRfcUntil(untilIso));
    }
    onSave({ rrule: parts.join(";"), until: untilIso });
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-bg border border-line w-full max-w-[420px] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-heading text-[18px] font-semibold">
            Custom recurrence
          </div>
          <button
            onClick={onCancel}
            className="text-faint hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <Field label="Frequency">
          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
            className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-full"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </Field>

        <Field label="Every">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-[80px]"
            />
            <span className="text-[12px] text-dim">
              {freqUnit(freq, interval)}
            </span>
          </div>
        </Field>

        {freq === "WEEKLY" && (
          <Field label="On">
            <div className="flex flex-wrap gap-1">
              {DOW_LABELS.map((label, idx) => {
                const on = byday.includes(idx);
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => toggleDow(idx)}
                    aria-pressed={on}
                    className={
                      "inline-flex items-center text-[11px] font-semibold uppercase " +
                      "tracking-[0.08em] px-2 py-1 cursor-pointer border leading-none " +
                      (on
                        ? "bg-row-active border-accent text-fg"
                        : "bg-transparent border-line text-dim hover:border-fg hover:text-fg")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {freq === "MONTHLY" && (
          <Field label="Day of month">
            <input
              type="number"
              min="1"
              max="31"
              value={bymonthday}
              onChange={(e) => setBymonthday(e.target.value)}
              className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-[80px]"
            />
          </Field>
        )}

        {freq === "YEARLY" && (
          <Field label="Month / day">
            <div className="flex items-center gap-2">
              <select
                value={bymonth}
                onChange={(e) => setBymonth(e.target.value)}
                className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit]"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {monthLabel(i)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="31"
                value={bymonthday}
                onChange={(e) => setBymonthday(e.target.value)}
                className="bg-surface border border-line text-fg text-[12px] px-2 py-1.5 outline-none focus:border-accent font-[inherit] w-[80px]"
              />
            </div>
          </Field>
        )}

        <Field label="Ends">
          <div className="flex flex-col gap-1.5">
            <label className="inline-flex items-center gap-2 text-[12px] text-fg">
              <input
                type="radio"
                checked={!untilEnabled}
                onChange={() => setUntilEnabled(false)}
              />
              Never
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-fg">
              <input
                type="radio"
                checked={untilEnabled}
                onChange={() => setUntilEnabled(true)}
              />
              On
              <input
                type="date"
                value={untilEnabled ? until : ""}
                onChange={(e) => { setUntilEnabled(true); setUntil(e.target.value); }}
                className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit]"
              />
            </label>
          </div>
        </Field>

        <div className="flex justify-end gap-2 mt-2">
          <button
            onClick={onCancel}
            className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.12em] text-faint font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

function freqUnit(freq, interval) {
  const n = parseInt(interval, 10);
  const plural = Number.isFinite(n) && n > 1;
  switch (freq) {
    case "DAILY": return plural ? "days" : "day";
    case "WEEKLY": return plural ? "weeks" : "week";
    case "MONTHLY": return plural ? "months" : "month";
    case "YEARLY": return plural ? "years" : "year";
    default: return "";
  }
}

function monthLabel(idx) {
  const d = new Date(Date.UTC(2000, idx, 1));
  return d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

// Parse a flat RRULE string into a key→value map.
function parseRule(rrule) {
  const out = {};
  if (!rrule) return out;
  for (const part of rrule.split(";")) {
    const [k, v] = part.split("=");
    if (k && v != null) out[k] = v;
  }
  return out;
}

function fromValue(value, dtstart) {
  const d = parseDtstart(dtstart);
  const defaults = {
    freq: "WEEKLY",
    interval: "1",
    byday: d ? [d.getUTCDay()] : [1],
    bymonthday: d ? String(d.getUTCDate()) : "1",
    bymonth: d ? String(d.getUTCMonth() + 1) : "1",
    until: value?.until ? isoToInputDate(value.until) : null,
  };
  if (!value?.rrule) return defaults;
  const parts = parseRule(value.rrule);
  return {
    freq: parts.FREQ ?? defaults.freq,
    interval: parts.INTERVAL ?? "1",
    byday: parts.BYDAY
      ? parts.BYDAY.split(",").map(s => DOW_RRULE.indexOf(s)).filter(i => i >= 0)
      : defaults.byday,
    bymonthday: parts.BYMONTHDAY ?? defaults.bymonthday,
    bymonth: parts.BYMONTH ?? defaults.bymonth,
    until: defaults.until,
  };
}

function parseDtstart(dtstart) {
  if (!dtstart) return null;
  const d = new Date(dtstart);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoToRfcUntil(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function isoToInputDate(iso) {
  if (!iso) return null;
  return iso.slice(0, 10);
}

// Human-readable summary of the rule for the read-only line under
// the preset dropdown.
function summariseRule(rrule, until) {
  if (!rrule) return "";
  const p = parseRule(rrule);
  const interval = p.INTERVAL ? parseInt(p.INTERVAL, 10) : 1;
  const intervalStr = interval > 1 ? `every ${interval} ` : "every ";
  let unit;
  if (p.FREQ === "DAILY") unit = interval > 1 ? "days" : "day";
  else if (p.FREQ === "WEEKLY") unit = interval > 1 ? "weeks" : "week";
  else if (p.FREQ === "MONTHLY") unit = interval > 1 ? "months" : "month";
  else if (p.FREQ === "YEARLY") unit = interval > 1 ? "years" : "year";
  else unit = "";
  const days = p.BYDAY
    ? " on " + p.BYDAY.split(",")
      .map(d => DOW_LABELS[DOW_RRULE.indexOf(d)] ?? d)
      .join("/")
    : "";
  const untilStr = until
    ? ", until " + new Date(until).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
      })
    : "";
  return `${intervalStr}${unit}${days}${untilStr}`;
}
