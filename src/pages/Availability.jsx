import { useMemo, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import {
  AlertStrip, BTN_ACCENT, BTN_GHOST, Pane,
} from "../components/ui.jsx";
import { useAvailability } from "../lib/data/useAvailability.js";
import { PARTITION_ADMINS } from "../lib/schedule/partition.js";
import { DEFAULT_WORKING_WINDOW } from "../lib/schedule/availability.js";
import {
  formatMinutesOfDay,
  minutesOfDayToTimeInput,
  parseMinutesOfDay,
} from "../lib/data/useChoreBlocks.js";
import { isoDateLocal } from "../lib/calendarMath.js";

// Availability — batch 42 slice 6 (F50 time off, F51 working hours +
// breaks). Three flush panes over useAvailability's CRUD: time off
// (per person, day span, optional partial-day window), working hours
// (per-person weekly defaults + per-date exceptions), and farm-wide
// breaks. The schedule engine (lib/schedule/availability.js) reads
// the same rows to decide who's here; this page only edits them —
// deliberately NOT the events system.

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

const FIELD_LABEL =
  "text-[10px] uppercase tracking-[0.12em] text-faint font-semibold";
const INPUT =
  "bg-surface border border-line text-fg text-[12px] px-2 py-1 " +
  "outline-none focus:border-accent font-[inherit]";
const ROW =
  "bg-surface border border-line px-3 py-2 flex items-center " +
  "gap-x-3 gap-y-1 flex-wrap";
const ICON_BTN =
  "text-faint hover:text-fg border-0 bg-transparent cursor-pointer p-1";
const SUBHEAD =
  "font-ui text-[10px] text-muted uppercase tracking-[0.14em] " +
  "font-semibold";
const FORM_BOX =
  "bg-surface-alt border border-line p-3 flex flex-col gap-2.5 mb-3";

export default function Availability() {
  const {
    timeOff, hours, breaks, loading, error,
    addTimeOff, updateTimeOff, deleteTimeOff,
    setWorkingHours, clearWorkingHours,
    createBreak, updateBreak, deleteBreak,
  } = useAvailability();

  if (loading) {
    return (
      <div
        className={
          "border border-line py-8 text-center text-[12px] " +
          "text-muted uppercase tracking-[0.16em]"
        }
      >
        Loading availability…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-[760px]">
      {error && (
        <AlertStrip>
          Some availability data didn't load — reload to try again.
        </AlertStrip>
      )}
      <TimeOffPane
        timeOff={timeOff}
        onAdd={addTimeOff}
        onUpdate={updateTimeOff}
        onDelete={deleteTimeOff}
      />
      <WorkingHoursPane
        hours={hours}
        onSet={setWorkingHours}
        onClear={clearWorkingHours}
      />
      <BreaksPane
        breaks={breaks}
        onCreate={createBreak}
        onUpdate={updateBreak}
        onDelete={deleteBreak}
      />
    </div>
  );
}

// ── shared bits ─────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <label className="inline-flex flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

// The app's small segmented control (the ChoresBlocksTab SideEditor
// shape, minus the icons).
function Segmented({ options, value, onChange }) {
  return (
    <div className="inline-flex border border-line w-max">
      {options.map((o, i) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={
              "px-2 py-1 text-[10px] uppercase tracking-[0.12em] " +
              "font-semibold cursor-pointer border-0 " +
              "transition-colors duration-100 " +
              (active
                ? "bg-row-active text-fg"
                : "bg-transparent text-dim hover:bg-row-hover " +
                  "hover:text-fg") +
              (i > 0 ? " border-l border-line" : "")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TimeRange({ start, end, onStart, onEnd }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="time"
        value={start}
        onChange={(e) => onStart(e.target.value)}
        className={INPUT}
      />
      <span className="text-[11px] text-faint">to</span>
      <input
        type="time"
        value={end}
        onChange={(e) => onEnd(e.target.value)}
        className={INPUT}
      />
    </span>
  );
}

// F15 — one side of a sun-anchorable window: a clock time, or the
// sun itself. `value` is { sun: null|'sunrise'|'sunset', time: "HH:MM" }.
function TimePoint({ value, onChange, ariaLabel }) {
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={value.sun ?? "clock"}
        onChange={(e) => onChange({
          ...value,
          sun: e.target.value === "clock" ? null : e.target.value,
        })}
        aria-label={ariaLabel}
        className={INPUT}
      >
        <option value="clock">Clock time</option>
        <option value="sunrise">Sunrise</option>
        <option value="sunset">Sunset</option>
      </select>
      {!value.sun && (
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className={INPUT}
        />
      )}
    </span>
  );
}

// Both sides of a sun-anchorable window (working hours, breaks).
function AnchoredRange({ start, end, onStart, onEnd }) {
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <TimePoint value={start} onChange={onStart} ariaLabel="Start" />
      <span className="text-[11px] text-faint">to</span>
      <TimePoint value={end} onChange={onEnd} ariaLabel="End" />
    </span>
  );
}

function FormError({ children }) {
  if (!children) return null;
  return <div className="text-[11px] text-warn">{children}</div>;
}

const PERSON_OPTIONS = PARTITION_ADMINS.map((p) => ({ id: p, label: p }));

// "2026-07-04" → "Sat, Jul 4" (parsed as LOCAL, not UTC).
function dateLabel(iso) {
  const [y, m, d] = (iso ?? "").split("-").map(Number);
  if (!y) return iso ?? "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function windowLabel(startMin, endMin) {
  return `${formatMinutesOfDay(startMin)} – ${formatMinutesOfDay(endMin)}`;
}

// Label a sun-anchorable row's window: "Sunrise – 5 PM" (F15).
function sideText(sun, min) {
  if (sun === "sunrise") return "Sunrise";
  if (sun === "sunset") return "Sunset";
  return formatMinutesOfDay(min);
}
function rowWindowLabel(row) {
  return `${sideText(row.startSun, row.startMin)} – ` +
    sideText(row.endSun, row.endMin);
}

// Form state for one sun-anchorable side.
function sideState(sun, min, fallbackMin) {
  return {
    sun: sun ?? null,
    time: minutesOfDayToTimeInput(min ?? fallbackMin),
  };
}

// Parse + order-check a start/end time-input pair. Returns
// { startMin, endMin } or { err }.
function parseWindow(start, end) {
  const startMin = parseMinutesOfDay(start);
  const endMin = parseMinutesOfDay(end);
  if (startMin == null || endMin == null) {
    return { err: "Set both times." };
  }
  if (endMin <= startMin) {
    return { err: "The end time needs to come after the start." };
  }
  return { startMin, endMin };
}

// Same, for a pair of TimePoint values that may be sun-anchored. Sun
// sides carry no minutes; order is only checkable when both sides are
// clock times (the engine treats a day-inverted window as absent).
function parseAnchoredWindow(start, end) {
  const startMin = start.sun ? null : parseMinutesOfDay(start.time);
  const endMin = end.sun ? null : parseMinutesOfDay(end.time);
  if ((!start.sun && startMin == null) || (!end.sun && endMin == null)) {
    return { err: "Set both times." };
  }
  if (!start.sun && !end.sun && endMin <= startMin) {
    return { err: "The end time needs to come after the start." };
  }
  return { startMin, endMin, startSun: start.sun, endSun: end.sun };
}

// ── Time off (F50) ──────────────────────────────────────────────────

function TimeOffPane({ timeOff, onAdd, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [who, setWho] = useState("all"); // F13 per-person filter
  const [actErr, setActErr] = useState(null);
  const today = isoDateLocal(new Date());

  const sorted = useMemo(
    () => timeOff
      .filter((r) => who === "all" || r.person === who)
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.person.localeCompare(b.person)
          : (a.startDate < b.startDate ? -1 : 1)),
    [timeOff, who]
  );

  const del = async (id) => {
    setActErr(null);
    try { await onDelete(id); }
    catch (e) { setActErr(e?.message ?? "Delete failed."); }
  };

  return (
    <Pane
      title="Time off"
      actions={!adding && (
        <button onClick={() => setAdding(true)} className={BTN_ACCENT}>
          <Plus size={13} className="shrink-0" /> Add time off
        </button>
      )}
    >
      <p className="text-[12px] text-dim m-0 mb-3 leading-relaxed">
        Days or hours a person is away. The schedule reads these to
        know who's here.
      </p>

      {timeOff.length > 0 && (
        <div className="mb-3">
          <Segmented
            options={[
              { id: "all", label: "Everyone" },
              ...PERSON_OPTIONS,
            ]}
            value={who}
            onChange={setWho}
          />
        </div>
      )}

      {adding && (
        <TimeOffForm
          onSave={onAdd}
          onClose={() => setAdding(false)}
        />
      )}

      {sorted.length === 0 && !adding ? (
        <div className="text-[12px] text-faint">
          {who === "all"
            ? "No time off scheduled. Add an entry when someone " +
              "will be away."
            : `No time off for ${who}.`}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((row) => (
            editingId === row.id ? (
              <TimeOffForm
                key={row.id}
                initial={row}
                onSave={(patch) => onUpdate(row.id, patch)}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <TimeOffRow
                key={row.id}
                row={row}
                past={(row.endDate ?? row.startDate) < today}
                onEdit={() => setEditingId(row.id)}
                onDelete={del}
              />
            )
          ))}
        </div>
      )}
      <FormError>{actErr}</FormError>
    </Pane>
  );
}

function TimeOffRow({ row, past, onEdit, onDelete }) {
  const range =
    row.endDate && row.endDate !== row.startDate
      ? `${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}`
      : dateLabel(row.startDate);
  return (
    <div className={ROW + (past ? " opacity-55" : "")}>
      <span className="text-[13px] font-semibold text-fg">
        {row.person}
      </span>
      <span className="text-[12px] text-dim">{range}</span>
      <span className="text-[12px] text-dim">
        {row.startMin == null
          ? "All day"
          : windowLabel(row.startMin, row.endMin)}
      </span>
      {row.note && (
        <span className="text-[11px] text-faint min-w-0">
          {row.note}
        </span>
      )}
      <span className="ml-auto inline-flex items-center">
        <button
          onClick={onEdit}
          className={ICON_BTN}
          aria-label="Edit time off"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(row.id)}
          className={ICON_BTN}
          aria-label="Delete time off"
        >
          <X size={13} />
        </button>
      </span>
    </div>
  );
}

// Create (no `initial`) or edit (F13) a time-off entry. `onSave`
// receives the full field set either way.
function TimeOffForm({ initial, onSave, onClose }) {
  const [person, setPerson] = useState(
    initial?.person ?? PARTITION_ADMINS[0]
  );
  const [fromDate, setFromDate] = useState(
    initial?.startDate ?? isoDateLocal(new Date())
  );
  const [toDate, setToDate] = useState(
    initial && initial.endDate !== initial.startDate
      ? initial.endDate
      : ""
  );
  const [span, setSpan] = useState(
    initial?.startMin != null ? "part" : "all"
  );
  const [start, setStart] = useState(minutesOfDayToTimeInput(
    initial?.startMin ?? DEFAULT_WORKING_WINDOW.startMin
  ));
  const [end, setEnd] = useState(minutesOfDayToTimeInput(
    initial?.endMin ?? DEFAULT_WORKING_WINDOW.endMin
  ));
  const [note, setNote] = useState(initial?.note ?? "");
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null);
    if (!fromDate) { setErr("Pick a first day."); return; }
    if (toDate && toDate < fromDate) {
      setErr("The last day can't come before the first.");
      return;
    }
    let startMin = null;
    let endMin = null;
    if (span === "part") {
      const w = parseWindow(start, end);
      if (w.err) { setErr(w.err); return; }
      ({ startMin, endMin } = w);
    }
    try {
      await onSave({
        person,
        startDate: fromDate,
        endDate: toDate || fromDate,
        startMin,
        endMin,
        note,
      });
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Save failed.");
    }
  };

  return (
    <div className={FORM_BOX}>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Person">
          <Segmented
            options={PERSON_OPTIONS}
            value={person}
            onChange={setPerson}
          />
        </Field>
        <Field label="First day">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Last day">
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>
      <div className="text-[11px] text-faint">
        Leave the last day empty for a single day.
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Hours">
          <Segmented
            options={[
              { id: "all", label: "All day" },
              { id: "part", label: "Part of the day" },
            ]}
            value={span}
            onChange={setSpan}
          />
        </Field>
        {span === "part" && (
          <Field label="Away">
            <TimeRange
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
            />
          </Field>
        )}
      </div>
      <Field label="Note">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — what's taking them away"
          className={INPUT + " w-full"}
        />
      </Field>
      <FormError>{err}</FormError>
      <div className="flex items-center gap-2">
        <button onClick={submit} className={BTN_ACCENT}>
          {initial ? "Save changes" : "Add time off"}
        </button>
        <button onClick={onClose} className={BTN_GHOST}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Working hours (F51) ─────────────────────────────────────────────

function WorkingHoursPane({ hours, onSet, onClear }) {
  const [actErr, setActErr] = useState(null);
  const weekly = hours.filter((r) => r.weekday != null);
  const exceptions = useMemo(
    () => hours
      .filter((r) => r.onDate != null)
      .sort((a, b) => (a.onDate < b.onDate ? -1 : 1)),
    [hours]
  );

  const guard = (fn) => async (...args) => {
    setActErr(null);
    try { await fn(...args); }
    catch (e) {
      setActErr(e?.message ?? "Save failed.");
      throw e;
    }
  };

  return (
    <Pane title="Working hours">
      <p className="text-[12px] text-dim m-0 mb-4 leading-relaxed">
        Each person's usual week. Dimmed days just run the standard{" "}
        {windowLabel(
          DEFAULT_WORKING_WINDOW.startMin,
          DEFAULT_WORKING_WINDOW.endMin
        )}{" "}
        day; edit a day to set its own hours.
      </p>
      <div className="flex flex-col gap-5">
        {PARTITION_ADMINS.map((p) => (
          <PersonWeek
            key={p}
            person={p}
            rows={weekly.filter((r) => r.person === p)}
            onSet={guard(onSet)}
            onClear={guard(onClear)}
          />
        ))}
        <ExceptionList
          rows={exceptions}
          onSet={guard(onSet)}
          onClear={guard(onClear)}
        />
      </div>
      <FormError>{actErr}</FormError>
    </Pane>
  );
}

function PersonWeek({ person, rows, onSet, onClear }) {
  const [editingDay, setEditingDay] = useState(null);
  return (
    <div>
      <div className={SUBHEAD + " mb-1.5"}>{person}</div>
      <div className="flex flex-col gap-px bg-line border border-line">
        {WEEKDAYS.map((name, wd) => {
          const row = rows.find((r) => r.weekday === wd) ?? null;
          return (
            <WeekdayRow
              key={wd}
              name={name}
              row={row}
              editing={editingDay === wd}
              onEdit={() => setEditingDay(wd)}
              onCancel={() => setEditingDay(null)}
              onSave={async (win) => {
                await onSet({ person, weekday: wd, ...win });
                setEditingDay(null);
              }}
              onClear={row && (async () => {
                await onClear(row.id);
                setEditingDay(null);
              })}
            />
          );
        })}
      </div>
    </div>
  );
}

function WeekdayRow({
  name, row, editing, onEdit, onCancel, onSave, onClear,
}) {
  if (editing) {
    return (
      <div className="bg-surface px-3 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-[12px] font-medium text-fg w-20 shrink-0">
          {name}
        </span>
        <WindowEditor
          initial={row}
          onSave={onSave}
          onCancel={onCancel}
          onClear={onClear}
        />
      </div>
    );
  }
  return (
    <div className="bg-surface px-3 py-1.5 flex items-center gap-3 flex-wrap">
      <span className="text-[12px] font-medium text-fg w-20 shrink-0">
        {name}
      </span>
      {row == null ? (
        <span className="text-[12px] text-faint">
          {windowLabel(
            DEFAULT_WORKING_WINDOW.startMin,
            DEFAULT_WORKING_WINDOW.endMin
          )}
        </span>
      ) : (
        <span className="text-[12px] text-dim">
          {row.startMin == null && !row.startSun
            ? "Off"
            : rowWindowLabel(row)}
        </span>
      )}
      <button
        onClick={onEdit}
        className={ICON_BTN + " ml-auto"}
        aria-label={`Edit ${name}`}
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

// Inline hours-or-off editor shared by the weekday rows, exception
// rows, and the exception form. `initial` is a working_hours row (or
// null → default window prefilled). Saves { startMin, endMin,
// startSun, endSun } (all null = off); `onClear` (optional) drops the
// row back to the default.
function WindowEditor({ initial, onSave, onCancel, onClear }) {
  const off = initial != null
    && initial.startMin == null && !initial.startSun;
  const win = off ? null : initial;
  const [mode, setMode] = useState(off ? "off" : "hours");
  const [start, setStart] = useState(sideState(
    win?.startSun, win?.startMin, DEFAULT_WORKING_WINDOW.startMin
  ));
  const [end, setEnd] = useState(sideState(
    win?.endSun, win?.endMin, DEFAULT_WORKING_WINDOW.endMin
  ));
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null);
    let next = {
      startMin: null, endMin: null, startSun: null, endSun: null,
    };
    if (mode === "hours") {
      const w = parseAnchoredWindow(start, end);
      if (w.err) { setErr(w.err); return; }
      next = w;
    }
    try { await onSave(next); }
    catch { /* surfaced by the pane's guard */ }
  };

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Segmented
        options={[
          { id: "hours", label: "Hours" },
          { id: "off", label: "Off" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === "hours" && (
        <AnchoredRange
          start={start}
          end={end}
          onStart={setStart}
          onEnd={setEnd}
        />
      )}
      <button onClick={submit} className={ICON_BTN} aria-label="Save">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className={ICON_BTN} aria-label="Cancel">
        <X size={14} />
      </button>
      {onClear && (
        <button onClick={onClear} className={BTN_GHOST}>
          Use default
        </button>
      )}
      <FormError>{err}</FormError>
    </span>
  );
}

function ExceptionList({ rows, onSet, onClear }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const today = isoDateLocal(new Date());
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className={SUBHEAD}>Exceptions</div>
        {!adding && (
          <button onClick={() => setAdding(true)} className={BTN_GHOST}>
            <Plus size={11} className="shrink-0 inline mr-1" />
            Add exception
          </button>
        )}
      </div>
      {adding && (
        <ExceptionForm onSet={onSet} onClose={() => setAdding(false)} />
      )}
      {rows.length === 0 && !adding ? (
        <div className="text-[12px] text-faint">
          No exceptions. Add one to change a single date's hours.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className={ROW + (row.onDate < today ? " opacity-55" : "")}
            >
              <span className="text-[13px] font-semibold text-fg">
                {row.person}
              </span>
              <span className="text-[12px] text-dim">
                {dateLabel(row.onDate)}
              </span>
              {editingId === row.id ? (
                <WindowEditor
                  initial={row}
                  onCancel={() => setEditingId(null)}
                  onSave={async (win) => {
                    await onSet({
                      person: row.person, onDate: row.onDate, ...win,
                    });
                    setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <span className="text-[12px] text-dim">
                    {row.startMin == null && !row.startSun
                      ? "Off"
                      : rowWindowLabel(row)}
                  </span>
                  <span className="ml-auto inline-flex items-center">
                    <button
                      onClick={() => setEditingId(row.id)}
                      className={ICON_BTN}
                      aria-label="Edit exception"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onClear(row.id)}
                      className={ICON_BTN}
                      aria-label="Delete exception"
                    >
                      <X size={13} />
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExceptionForm({ onSet, onClose }) {
  const [person, setPerson] = useState(PARTITION_ADMINS[0]);
  const [onDate, setOnDate] = useState(isoDateLocal(new Date()));
  const [err, setErr] = useState(null);

  return (
    <div className={FORM_BOX}>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Person">
          <Segmented
            options={PERSON_OPTIONS}
            value={person}
            onChange={setPerson}
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={onDate}
            onChange={(e) => setOnDate(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="That day">
          <WindowEditor
            initial={null}
            onCancel={onClose}
            onSave={async (win) => {
              setErr(null);
              if (!onDate) { setErr("Pick a date."); return; }
              await onSet({ person, onDate, ...win });
              onClose();
            }}
          />
        </Field>
      </div>
      <FormError>{err}</FormError>
    </div>
  );
}

// ── Breaks (F51) ────────────────────────────────────────────────────

function BreaksPane({ breaks, onCreate, onUpdate, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [actErr, setActErr] = useState(null);

  const guard = (fn) => async (...args) => {
    setActErr(null);
    try { await fn(...args); }
    catch (e) { setActErr(e?.message ?? "Save failed."); }
  };

  return (
    <Pane
      title="Breaks"
      actions={!adding && (
        <button onClick={() => setAdding(true)} className={BTN_ACCENT}>
          <Plus size={13} className="shrink-0" /> Add break
        </button>
      )}
    >
      <p className="text-[12px] text-dim m-0 mb-3 leading-relaxed">
        Farm-wide daily windows carved out of everyone's hours — lunch,
        dinner. Pause a break to keep it without applying it.
      </p>
      {adding && (
        <BreakForm onSave={onCreate} onClose={() => setAdding(false)} />
      )}
      {breaks.length === 0 && !adding ? (
        <div className="text-[12px] text-faint">
          No breaks yet. Add one to hold a window every day.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {breaks.map((b) => (
            editingId === b.id ? (
              <BreakForm
                key={b.id}
                initial={b}
                onSave={(patch) => onUpdate(b.id, patch)}
                onClose={() => setEditingId(null)}
              />
            ) : (
            <div
              key={b.id}
              className={ROW + (b.isActive ? "" : " opacity-55")}
            >
              <span className="text-[13px] font-semibold text-fg">
                {b.name}
              </span>
              <span className="text-[12px] text-dim">
                {rowWindowLabel(b)}
              </span>
              {!b.isActive && (
                <span className="text-[11px] text-faint">Paused</span>
              )}
              <span className="ml-auto inline-flex items-center gap-2">
                <button
                  onClick={() => guard(onUpdate)(
                    b.id, { isActive: !b.isActive }
                  )}
                  className={BTN_GHOST}
                >
                  {b.isActive ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => setEditingId(b.id)}
                  className={ICON_BTN}
                  aria-label={`Edit ${b.name}`}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => guard(onDelete)(b.id)}
                  className={ICON_BTN}
                  aria-label={`Delete ${b.name}`}
                >
                  <X size={13} />
                </button>
              </span>
            </div>
            )
          ))}
        </div>
      )}
      <FormError>{actErr}</FormError>
    </Pane>
  );
}

// Create (no `initial`) or edit (F17 — name included) a break.
function BreakForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(sideState(
    initial?.startSun, initial?.startMin, 12 * 60
  ));
  const [end, setEnd] = useState(sideState(
    initial?.endSun, initial?.endMin, 12 * 60 + 30
  ));
  const [err, setErr] = useState(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim()) { setErr("The break needs a name."); return; }
    const w = parseAnchoredWindow(start, end);
    if (w.err) { setErr(w.err); return; }
    try {
      await onSave({ name, ...w });
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Save failed.");
    }
  };

  return (
    <div className={FORM_BOX}>
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="Name">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lunch"
            className={INPUT + " w-40"}
          />
        </Field>
        <Field label="Window">
          <AnchoredRange
            start={start}
            end={end}
            onStart={setStart}
            onEnd={setEnd}
          />
        </Field>
      </div>
      <FormError>{err}</FormError>
      <div className="flex items-center gap-2">
        <button onClick={submit} className={BTN_ACCENT}>
          {initial ? "Save changes" : "Add break"}
        </button>
        <button onClick={onClose} className={BTN_GHOST}>
          Cancel
        </button>
      </div>
    </div>
  );
}
