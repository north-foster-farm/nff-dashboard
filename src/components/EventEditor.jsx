import { useEffect, useMemo, useState } from "react";
import { X, Trash2, ArrowUpRight, Workflow } from "lucide-react";
import { useEventSeries } from "../lib/data/useEventSeries.js";
import { useEventOccurrences } from "../lib/data/useEventOccurrences.js";
import { supabase } from "../lib/supabase.js";
import { navigate, pathForProject } from "../lib/router.js";
import RecurrenceEditor from "./RecurrenceEditor.jsx";
import EventScopePrompt from "./EventScopePrompt.jsx";

// EventEditor (Batch 13.2). Side-panel on desktop, full-screen
// sheet on mobile. Powers the full event CRUD path:
//
//   * mode === 'new'   — fresh series from a date seed.
//   * mode === 'edit'  — load an existing series + the clicked
//                        occurrence; per-occurrence edits write
//                        an override (first-override
//                        materialization), per-series edits update
//                        the series, "this and following" splits
//                        via useEventSeries.splitSeries.
//
// Props:
//   open       boolean
//   onClose    () => void
//   kinds      event kinds list from data.events.kinds (id + label)
//   seed       { mode: 'new' | 'edit',
//                seriesId?: string,
//                occurrenceId?: string,
//                occursOn?: 'YYYY-MM-DD',
//                kindId?: string }   — what was clicked / launched
//
// The parent owns nothing beyond passing seed + onClose. All DB
// reads + writes live in this component via the hooks.

export default function EventEditor({ open, onClose, kinds, seed, onOpenProcessing }) {
  const { series, seriesById, createSeries, updateSeries, deleteSeries, splitSeries } = useEventSeries();
  const { occurrences: seriesOccurrences, upsertOverride, deleteOverride } =
    useEventOccurrences({ seriesId: seed?.seriesId });

  const editingSeries = seed?.seriesId ? seriesById.get(seed.seriesId) : null;
  const isRecurring = !!editingSeries?.rrule;
  const isNew = (seed?.mode ?? "new") === "new";

  // The materialized occurrence for the date being edited, if any. The
  // calendar shows the occurrence's override time when present (see
  // recurrence.js `pickTime`), so the editor must read from the same
  // source or its time disagrees with the row that was clicked.
  const editingOccurrence = seed?.seriesId && seed?.occursOn
    ? seriesOccurrences.find(o => o.occursOn === seed.occursOn) ?? null
    : null;

  // Form state. Re-seeded whenever `seed` (or the resolved series /
  // occurrence) changes — e.g. clicking a different event row in
  // Schedule with the editor already open.
  const initial = useMemo(
    () => deriveInitial(seed, editingSeries, editingOccurrence),
    [seed, editingSeries, editingOccurrence]
  );
  const [label, setLabel] = useState(initial.label);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [kindId, setKindId] = useState(initial.kindId);
  const [locationName, setLocationName] = useState(initial.locationName);
  const [locationAddress, setLocationAddress] = useState(initial.locationAddress);
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [notes, setNotes] = useState(initial.notes);
  const [recurrence, setRecurrence] = useState(initial.recurrence);

  const [scopePrompt, setScopePrompt] = useState(null); // 'save' | 'delete' | null
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setLabel(initial.label);
    setSubtitle(initial.subtitle);
    setKindId(initial.kindId);
    setLocationName(initial.locationName);
    setLocationAddress(initial.locationAddress);
    setDate(initial.date);
    setStartTime(initial.startTime);
    setEndTime(initial.endTime);
    setNotes(initial.notes);
    setRecurrence(initial.recurrence);
    setErrorMsg(null);
  }, [initial]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const isOneOff = !isRecurring;

  const handleSaveClick = async () => {
    setErrorMsg(null);
    if (!label.trim()) { setErrorMsg("Title required."); return; }
    if (!kindId) { setErrorMsg("Pick a kind."); return; }
    if (!date) { setErrorMsg("Pick a date."); return; }

    if (isNew) {
      return runSave("all");
    }
    // Editing an existing series. One-off → no prompt; recurring →
    // ask for scope.
    if (isOneOff) {
      return runSave("all");
    }
    setScopePrompt("save");
  };

  const handleDeleteClick = async () => {
    if (isOneOff) {
      const ok = window.confirm("Delete this event?");
      if (!ok) return;
      setPending(true);
      try {
        if (editingSeries?.id) await deleteSeries(editingSeries.id);
        onClose?.();
      } catch (e) {
        setErrorMsg(e?.message ?? "Delete failed.");
      } finally {
        setPending(false);
      }
      return;
    }
    setScopePrompt("delete");
  };

  const runSave = async (scope) => {
    setPending(true);
    setErrorMsg(null);
    try {
      const dtstartIso = composeDtstart(date, startTime);
      const durationMin = computeDurationMinutes(startTime, endTime);
      const seriesPatch = {
        kindId,
        label: label.trim(),
        subtitle: subtitle.trim() || null,
        location: composeLocation(locationName, locationAddress),
        rrule: recurrence?.rrule || null,
        dtstart: dtstartIso,
        until: recurrence?.until || null,
        durationMinutes: durationMin,
        notes: notes.trim() || null,
      };

      if (isNew) {
        const created = await createSeries(seriesPatch);
        // Pre-materialize for one-offs so the read pipeline
        // surfaces them without RRULE expansion.
        if (!seriesPatch.rrule) {
          await upsertOverride({
            seriesId: created.id,
            occursOn: date,
            startTime,
            endTime,
            status: "scheduled",
          });
        }
        onClose?.();
        return;
      }

      if (scope === "all") {
        await updateSeries(editingSeries.id, seriesPatch);
        // For one-offs, the materialized occurrence date / times
        // mirror the series — keep them in lockstep.
        if (!seriesPatch.rrule) {
          await upsertOverride({
            seriesId: editingSeries.id,
            occursOn: date,
            startTime,
            endTime,
            status: "scheduled",
          });
        }
        onClose?.();
        return;
      }

      if (scope === "this") {
        // First-override materialization. Override fields ride on
        // top of the series defaults; null fields fall through.
        await upsertOverride({
          seriesId: editingSeries.id,
          occursOn: date,
          startTime,
          endTime,
          locationOverride: composeLocation(locationName, locationAddress),
          notesOverride: notes.trim() || null,
          status: "scheduled",
        });
        onClose?.();
        return;
      }

      if (scope === "following") {
        // Split the series at `date`. The new series gets the
        // edited rule + label + location etc.
        await splitSeries(editingSeries.id, date, seriesPatch);
        onClose?.();
        return;
      }
    } catch (e) {
      setErrorMsg(e?.message ?? "Save failed.");
    } finally {
      setPending(false);
    }
  };

  const runDelete = async (scope) => {
    setPending(true);
    setErrorMsg(null);
    try {
      if (scope === "all") {
        await deleteSeries(editingSeries.id);
      } else if (scope === "this") {
        // Materialize a "skipped" override on this date.
        await upsertOverride({
          seriesId: editingSeries.id,
          occursOn: date,
          status: "skipped",
        });
      } else if (scope === "following") {
        // Cap the series at the day before — leaves earlier dates
        // intact, ends the rule effective from this date.
        const cap = new Date(`${date}T00:00:00Z`);
        cap.setUTCDate(cap.getUTCDate() - 1);
        cap.setUTCHours(23, 59, 59, 0);
        await updateSeries(editingSeries.id, { until: cap.toISOString() });
      }
      onClose?.();
    } catch (e) {
      setErrorMsg(e?.message ?? "Delete failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/40 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-bg border-l border-line w-full sm:max-w-[460px] flex flex-col h-full"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <div className="font-heading text-[18px] font-semibold">
            {isNew ? "New event" : "Edit event"}
          </div>
          <button
            onClick={onClose}
            className="text-faint hover:text-fg p-1 cursor-pointer bg-transparent border-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <Field label="Title">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="bg-surface border border-line text-fg text-[14px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
              placeholder="Foster Farmers Market"
            />
          </Field>

          <Field label="Subtitle">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
              placeholder="Optional — short note shown under the title"
            />
          </Field>

          <Field label="Kind">
            <select
              value={kindId}
              onChange={(e) => setKindId(e.target.value)}
              className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
            >
              <option value="">— pick a kind —</option>
              {(kinds ?? []).map(k => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
              />
            </Field>
          </div>

          <Field label="Recurrence">
            <RecurrenceEditor
              value={recurrence}
              onChange={setRecurrence}
              dtstart={composeDtstart(date, startTime)}
            />
          </Field>

          <Field label="Location">
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="bg-surface border border-line text-fg text-[13px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full mb-1.5"
              placeholder="Place name"
            />
            <input
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              className="bg-surface border border-line text-fg text-[12px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full"
              placeholder="Address (optional)"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-surface border border-line text-fg text-[12px] px-2.5 py-2 outline-none focus:border-accent font-[inherit] w-full resize-y"
              placeholder="Optional context — load-out checklist, who to call, etc."
            />
          </Field>

          {!isNew && kindId === "processing_days" && (
            <button
              type="button"
              onClick={() => onOpenProcessing?.({ seriesId: editingSeries?.id, occursOn: date })}
              className="inline-flex items-center justify-between gap-2 bg-surface border border-line text-fg font-[inherit] text-[12px] font-semibold px-3 py-2 cursor-pointer hover:border-accent"
            >
              <span>Open processing details</span>
              <ArrowUpRight size={14} className="shrink-0" />
            </button>
          )}

          {/* Process work attached to this event (Batch 23) — the
              event-side view of what a process expansion created. */}
          {!isNew && editingSeries?.id && (
            <ProcessWorkNote
              seriesId={editingSeries.id}
              onNavigateAway={onClose}
            />
          )}

          {errorMsg && (
            <div className="text-[11px] text-warn">{errorMsg}</div>
          )}
        </main>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-line">
          {!isNew ? (
            <button
              onClick={handleDeleteClick}
              disabled={pending}
              className="inline-flex items-center gap-1.5 bg-transparent border border-line text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} className="shrink-0" /> Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={pending}
              className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={pending}
              className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Saving…" : isNew ? "Create" : "Save"}
            </button>
          </div>
        </footer>
      </div>

      {scopePrompt === "save" && (
        <EventScopePrompt
          verb="Save"
          onCancel={() => setScopePrompt(null)}
          onPick={(scope) => { setScopePrompt(null); runSave(scope); }}
        />
      )}
      {scopePrompt === "delete" && (
        <EventScopePrompt
          verb="Delete"
          onCancel={() => setScopePrompt(null)}
          onPick={(scope) => { setScopePrompt(null); runDelete(scope); }}
        />
      )}
    </div>
  );
}

// The event-side view of process work (Batch 23): event_links rows
// with role 'process' (an expanded prep project) or 'process_modifier'
// (chore changes around this event). Quiet — renders nothing when the
// event has no process work.
function ProcessWorkNote({ seriesId, onNavigateAway }) {
  const [links, setLinks] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("event_links")
      .select("id, target_type, target_id, role")
      .eq("series_id", seriesId)
      .in("role", ["process", "process_modifier"])
      .then(({ data }) => { if (!cancelled) setLinks(data ?? []); });
    return () => { cancelled = true; };
  }, [seriesId]);

  if (!links || links.length === 0) return null;
  const projectLinks = links.filter(l => l.target_type === "project");
  const modifierCount = links.filter(l => l.target_type === "chore").length;

  return (
    <div className="bg-surface border border-line px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-deep">
        <Workflow size={12} className="shrink-0" />
        Process work on this event
      </div>
      {projectLinks.map(l => (
        <button
          key={l.id}
          type="button"
          onClick={() => {
            onNavigateAway?.();
            navigate(pathForProject(l.target_id));
          }}
          className="inline-flex items-center justify-between gap-2 bg-transparent border-0 p-0 text-[12px] text-fg hover:text-accent-deep font-[inherit] cursor-pointer text-left"
        >
          <span>Open the prep project</span>
          <ArrowUpRight size={13} className="shrink-0" />
        </button>
      ))}
      {modifierCount > 0 && (
        <div className="text-[11px] text-dim">
          {modifierCount} chore change{modifierCount === 1 ? "" : "s"} scheduled
          around this event — they show as badges in Rounds and the
          Today tab on the day.
        </div>
      )}
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

// ── Form-state derivation ────────────────────────────────────────────
function deriveInitial(seed, series, occurrence) {
  const today = new Date();
  const todayIso = isoDateLocal(today);
  if (!series) {
    // New event seed. Seed `startTime` defaults to "09:00" but can be
    // overridden when the user clicked an empty rail spot — in that
    // case the parent passes the picked HH:MM and we default the end
    // to a one-hour block.
    const seedStart = seed?.startTime ?? "09:00";
    return {
      // label / notes seeds let other surfaces (e.g. the Inbox's
      // "promote to event" action, Batch 21) prefill the form.
      label: seed?.label ?? "",
      subtitle: "",
      kindId: seed?.kindId ?? "",
      locationName: "",
      locationAddress: "",
      date: seed?.occursOn ?? todayIso,
      startTime: seedStart,
      endTime: hhmmAfter(seedStart, 60),
      notes: seed?.notes ?? "",
      recurrence: { rrule: null, until: null },
    };
  }
  const dtstart = series.dtstart ? new Date(series.dtstart) : null;
  // Series-default time from dtstart (UTC components, matching how
  // loadEvents reads it).
  const seriesStart = dtstart && !Number.isNaN(dtstart.getTime())
    ? `${pad(dtstart.getUTCHours())}:${pad(dtstart.getUTCMinutes())}`
    : null;
  // The occurrence override wins over the series default — this is the
  // exact precedence the calendar uses, so the time shown here matches
  // the row that was clicked.
  const startTime = trimHHMM(occurrence?.startTime) ?? seriesStart ?? "09:00";
  const overrideEnd = trimHHMM(occurrence?.endTime);
  const endTime = overrideEnd
    ?? (seriesStart && typeof series.durationMinutes === "number"
        ? hhmmAfter(seriesStart, series.durationMinutes)
        : hhmmAfter(startTime, 60));
  return {
    label: series.label ?? "",
    subtitle: series.subtitle ?? "",
    kindId: series.kindId ?? "",
    locationName: occurrence?.locationOverride?.name ?? series.location?.name ?? "",
    locationAddress: occurrence?.locationOverride?.address ?? series.location?.address ?? "",
    date: seed?.occursOn ?? (dtstart ? isoDateLocalFromUtc(dtstart) : todayIso),
    startTime,
    endTime,
    notes: occurrence?.notesOverride ?? series.notes ?? "",
    recurrence: { rrule: series.rrule ?? null, until: series.until ?? null },
  };
}

// Trim "08:00:00" → "08:00"; pass null/undefined through. Mirrors
// recurrence.js `pickTime` so the editor and calendar agree.
function trimHHMM(t) {
  if (typeof t !== "string" || t.length < 5) return null;
  return t.slice(0, 5);
}

function composeDtstart(dateIso, hhmm) {
  if (!dateIso) return null;
  const [h = 0, m = 0] = (hhmm || "00:00").split(":").map(Number);
  // Treat as UTC to match the convention loadEvents uses on read.
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCHours(h, m, 0, 0);
  return d.toISOString();
}

function computeDurationMinutes(start, end) {
  if (!start || !end) return null;
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return null;
  return endMin - startMin;
}

function composeLocation(name, address) {
  const n = (name ?? "").trim();
  const a = (address ?? "").trim();
  if (!n && !a) return null;
  return { name: n, address: a };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function hhmmAfter(start, minutes) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

function isoDateLocal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoDateLocalFromUtc(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
