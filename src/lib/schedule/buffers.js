// Buffers (Epic E — S53/S54/S55/S57/S61, BD22/BD23).
//
// A buffer is *a reservation bound to an activity* — it reserves the time
// adjacent to something on the day (a market needs an hour beforehand to
// load and set up; processing might need cleanup time after). It is NOT a
// property the activity's source subsystem carries (BD22) and not a field on
// chores/events (keeps BD3 — chores stay lean). Instead a buffer is its own
// `buffer` commitment whose `source_ref.target` names what it buffers.
//
// BD23 — where buffer config lives — settled here: any *bufferable* activity
// (one with a time anchor: an event, or a chore block with a start + a
// duration) exposes an "Add buffer" affordance in its detail panel. A shared
// BufferSheet configures side + length + an optional setup/cleanup checklist.
// The buffer reserves adjacent time and surfaces the squeeze; it never moves
// or deletes the thing it buffers (S61).
//
// Pure + tolerant: malformed times yield null, never throw.

import { parseHHMM } from "./manDown.js";

// minutes-of-day -> "HH:MM"
function toHHMM(min) {
  if (min == null || !Number.isFinite(min)) return null;
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":"
    + String(m % 60).padStart(2, "0");
}

// Resolve the reserved window for a buffer of `mins` on `side` of an activity
// spanning [startMin, endMin). Returns { startMin, endMin } in minutes, or
// null if the anchor times can't support the chosen side.
//   before -> [start - mins, start)
//   after  -> [end, end + mins)
//   both   -> [start - mins, end + mins)
export function bufferWindow({ startMin, endMin }, side, mins) {
  const len = Number(mins);
  if (!Number.isFinite(len) || len <= 0) return null;
  const s = startMin;
  const e = endMin ?? startMin;
  if (side === "before") {
    if (s == null) return null;
    return { startMin: Math.max(0, s - len), endMin: s };
  }
  if (side === "after") {
    if (e == null) return null;
    return { startMin: e, endMin: Math.min(1440, e + len) };
  }
  // both
  if (s == null || e == null) return null;
  return { startMin: Math.max(0, s - len), endMin: Math.min(1440, e + len) };
}

// The window a stored buffer commitment reserves (from its resolved
// clock_time / source_ref.end). null on garbage.
export function storedBufferWindow(buf) {
  const startMin = parseHHMM(buf.clock_time);
  const endMin = parseHHMM(buf.source_ref?.end);
  if (startMin == null || endMin == null) return null;
  return { startMin, endMin };
}

// Build the source_ref + clock_time for a new buffer commitment. `target` =
// { kind:'event'|'block', id, label }; `anchor` = the activity's
// { startMin, endMin }; `checklist` = [{ text }]. Returns null if the window
// can't be resolved (no usable time anchor for the chosen side).
export function buildBuffer({ target, anchor, side, mins, label, checklist }) {
  const win = bufferWindow(anchor, side, mins);
  if (!win) return null;
  return {
    clockTime: toHHMM(win.startMin),
    sourceRef: {
      target,
      side,
      mins: Number(mins),
      end: toHHMM(win.endMin),
      label: label?.trim() || null,
      checklist: (checklist ?? [])
        .map((c) => (typeof c === "string" ? c : c.text))
        .map((t) => (t ?? "").trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `c${i}`, text, done: false })),
    },
  };
}

// Synthesize the per-day buffer an all-occurrences template (S53/S54) yields
// for one day's occurrence of its activity. The window is recomputed from THAT
// day's anchor (occurrences can shift time), and the checklist's done-state is
// read from the template's per-day state map (`checklistState[iso]`) — so the
// "load the truck" list resets each market day. Returns a buffer-shaped object
// (id = the template's, `_template` flagged) BufferSection renders like any
// stored buffer. null if the day's anchor can't support the configured side.
export function deriveTemplateBuffer(template, anchor, dateISO) {
  const sr = template.source_ref ?? {};
  const win = bufferWindow(anchor, sr.side, sr.mins);
  if (!win) return null;
  const state = sr.checklistState?.[dateISO] ?? {};
  return {
    id: template.id,
    _template: true,
    assignee: template.assignee ?? null,
    clock_time: toHHMM(win.startMin),
    source_ref: {
      ...sr,
      end: toHHMM(win.endMin),
      checklist: (sr.checklist ?? []).map((c) => ({ ...c, done: !!state[c.id] })),
    },
  };
}

// All buffers targeting a given activity.
export function buffersForTarget(buffers, kind, id) {
  return (buffers ?? []).filter((b) =>
    b.source_ref?.target?.kind === kind
    && String(b.source_ref?.target?.id) === String(id));
}

// A one-line human description: "Buffer 8:00a–9:00a · before". Uses the
// caller's minute formatter so it matches the rest of the surface.
export function describeBuffer(buf, fmt) {
  const win = storedBufferWindow(buf);
  if (!win) return buf.source_ref?.label ?? "Buffer";
  const range = `${fmt(win.startMin)}–${fmt(win.endMin)}`;
  return buf.source_ref?.label
    ? `${buf.source_ref.label} · ${range}`
    : `Buffer ${range}`;
}
