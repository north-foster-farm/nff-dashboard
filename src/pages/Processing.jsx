import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, Save, CheckCircle2, Bird, ArrowUpRight,
} from "lucide-react";
import { useEventSeries } from "../lib/data/useEventSeries.js";
import { useEventOccurrences } from "../lib/data/useEventOccurrences.js";
import { useBatchAssignments } from "../lib/data/useBatchAssignments.js";
import { useSites } from "../lib/data/useSites.js";
import { supabase } from "../lib/supabase.js";
import { navigate, pathForBatch } from "../lib/router.js";

// Processing-day workspace (Batch 14.2). Reachable only from the
// EventEditor's "Open processing details →" link on a processing_days
// kind event. The route concept is `/events/processing/:id` even
// though the app is single-page — App.jsx state holds the active
// series id.
//
// Owns four fields stored on `event_series.payload` for the series:
//   * cut_sheet           free-text instructions for the
//                         processor (cut sizes, packaging notes)
//   * packed_crates       number of crates packed
//   * final_count         number of birds processed
//   * notes               free-text post-processing notes
// Plus a `resolved` toggle (with `resolved_at` timestamp) marking
// the day's batch close. Resolution doesn't yet touch
// livestock_groups directly — that integration ships with the
// animal-lifecycle pages in Batch 16.
//
// On the same date, an event_occurrences override carrying the
// payload_override is upserted alongside so per-instance edits
// persist (the recurrence reader prefers override fields).

export default function Processing({ seriesId, occursOn, data, onClose }) {
  const { seriesById, updateSeries } = useEventSeries();
  const { occurrences, upsertOverride } = useEventOccurrences({ seriesId });
  const series = seriesId ? seriesById.get(seriesId) : null;
  const occurrence = useMemo(
    () => (occurrences ?? []).find(o => o.occursOn === occursOn) ?? null,
    [occurrences, occursOn]
  );

  const initial = useMemo(
    () => deriveFields(series, occurrence),
    [series, occurrence]
  );
  const [cutSheet, setCutSheet] = useState(initial.cutSheet);
  const [packedCrates, setPackedCrates] = useState(initial.packedCrates);
  const [finalCount, setFinalCount] = useState(initial.finalCount);
  const [notes, setNotes] = useState(initial.notes);
  const [resolved, setResolved] = useState(initial.resolved);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    setCutSheet(initial.cutSheet);
    setPackedCrates(initial.packedCrates);
    setFinalCount(initial.finalCount);
    setNotes(initial.notes);
    setResolved(initial.resolved);
    setSavedAt(null);
  }, [initial]);

  if (!series) {
    return (
      <div className="bg-surface border border-line p-8 text-center">
        <div className="text-[12px] text-faint uppercase tracking-[0.16em] mb-2">
          Processing day
        </div>
        <div className="text-[13px] text-muted">Loading event…</div>
      </div>
    );
  }

  const save = async ({ resolveOnSave = false } = {}) => {
    setErrorMsg(null);
    setPending(true);
    try {
      const payload = composePayload({
        existing: series.payload,
        cutSheet,
        packedCrates,
        finalCount,
        notes,
        resolved: resolveOnSave ? true : resolved,
        resolvedAt: resolveOnSave
          ? (resolved ? series.payload?.resolved_at : new Date().toISOString())
          : (resolved ? series.payload?.resolved_at ?? new Date().toISOString() : null),
      });
      await updateSeries(seriesId, { payload });
      // Mirror the payload onto the per-occurrence override so
      // future drag / per-instance edits survive series-level edits.
      if (occursOn) {
        await upsertOverride({
          seriesId,
          occursOn,
          status: "scheduled",
          payloadOverride: payload,
        });
      }
      if (resolveOnSave) setResolved(true);
      setSavedAt(new Date());
    } catch (e) {
      setErrorMsg(e?.message ?? "Save failed.");
    } finally {
      setPending(false);
    }
  };

  const dateLabel = occursOn
    ? new Date(`${occursOn}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <div className="max-w-[720px] mx-auto flex flex-col gap-5 py-2">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 bg-transparent border border-line text-dim hover:text-fg font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 cursor-pointer"
          >
            <ChevronLeft size={13} className="shrink-0" /> Back
          </button>
          <div>
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-faint font-semibold">
              Processing day
            </div>
            <h2 className="font-heading text-[26px] font-bold -tracking-[0.02em] m-0 leading-tight">
              {series.label}
            </h2>
            {dateLabel && (
              <div className="text-[12px] text-dim mt-0.5">{dateLabel}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resolved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-resolved bg-surface border border-resolved px-2 py-1">
              <CheckCircle2 size={12} className="shrink-0" />
              Resolved
            </span>
          )}
          {savedAt && (
            <span className="text-[10px] text-faint uppercase tracking-[0.12em]">
              Saved {savedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
      </header>

      <BatchAssignSection seriesId={seriesId} data={data} />

      <Section title="Cut sheet" subtitle="Cut sizes, packaging, anything the processor needs ahead of the day.">
        <textarea
          value={cutSheet}
          onChange={(e) => setCutSheet(e.target.value)}
          rows={5}
          className="bg-surface border border-line text-fg text-[13px] px-3 py-2 outline-none focus:border-accent font-[inherit] w-full resize-y"
          placeholder="e.g. Whole birds vs. cut-up split 60/40. Wing tips off. Vacuum seal in 1lb bags. Two heads in the trailer cooler."
        />
      </Section>

      <Section title="Packing">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Packed crates">
            <NumericInput value={packedCrates} onChange={setPackedCrates} />
          </Field>
          <Field label="Final count">
            <NumericInput value={finalCount} onChange={setFinalCount} />
          </Field>
        </div>
      </Section>

      <Section title="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="bg-surface border border-line text-fg text-[12px] px-3 py-2 outline-none focus:border-accent font-[inherit] w-full resize-y"
          placeholder="Anything that mattered today: weather, processor remarks, mortality during transport, etc."
        />
      </Section>

      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <button
          onClick={() => save({ resolveOnSave: false })}
          disabled={pending}
          className="inline-flex items-center gap-1.5 bg-surface border border-line text-fg font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={13} className="shrink-0" /> Save
        </button>
        {!resolved ? (
          <button
            onClick={() => save({ resolveOnSave: true })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 bg-resolved text-on-accent border border-resolved font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={13} className="shrink-0" /> Resolve batch
          </button>
        ) : (
          <button
            onClick={() => { setResolved(false); save({ resolveOnSave: false }); }}
            disabled={pending}
            className="inline-flex items-center gap-1.5 bg-transparent border border-line text-dim hover:text-fg font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reopen
          </button>
        )}
      </footer>
    </div>
  );
}

// ── Batch assignment (Batch 20) ───────────────────────────────────────
// The real picker replacing the old EventKindPage stub. Lists every
// batch of batch-tracked species with its current location; assigning
// writes batch_assignments (keyed by series id) AND keeps the
// event_links row in sync so the batch's lifecycle page shows this
// processing day.
function BatchAssignSection({ seriesId, data }) {
  const { getBatchId, assign, loading } = useBatchAssignments();
  const { placesById, placements } = useSites();
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Candidate batches: batch-tracked species (broilers today; any
  // future batch-tracked species shows up automatically).
  const candidates = useMemo(() => {
    const out = [];
    for (const sp of data?.livestock?.species ?? []) {
      if (sp.trackingModel !== "batch") continue;
      for (const g of sp.groups ?? []) {
        const placement = (placements ?? []).find(
          (p) => p.occupantType === "batch"
            && p.occupantId === g.id
            && !p.movedOut
        );
        const place = placement ? placesById?.get(placement.placeId) : null;
        out.push({
          id: g.id,
          label: `${sp.name} — ${g.label}`,
          speciesId: sp.id,
          count: g.count,
          placeName: place?.name ?? null,
        });
      }
    }
    return out;
  }, [data, placements, placesById]);

  const assignedBatchId = getBatchId(seriesId);
  const assigned = candidates.find((c) => c.id === assignedBatchId) ?? null;

  const onAssign = async (batchId) => {
    setPending(true);
    setErrorMsg(null);
    try {
      if (batchId) {
        const err = await assign(seriesId, batchId);
        if (err) throw err;
        // Keep event_links in sync: one batch link per processing
        // series — retarget the existing link or create it.
        const { data: existing, error: qErr } = await supabase
          .from("event_links")
          .select("id, target_id")
          .eq("series_id", seriesId)
          .eq("target_type", "batch");
        if (qErr) throw qErr;
        if (existing && existing.length > 0) {
          const { error: uErr } = await supabase
            .from("event_links")
            .update({ target_id: batchId, role: "processing" })
            .eq("id", existing[0].id);
          if (uErr) throw uErr;
        } else {
          const { error: iErr } = await supabase
            .from("event_links")
            .insert({
              series_id: seriesId,
              target_type: "batch",
              target_id: batchId,
              role: "processing",
            });
          if (iErr) throw iErr;
        }
      }
    } catch (e) {
      setErrorMsg(e?.message ?? "Assignment failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Section
      title="Batch"
      subtitle="Which batch is being processed this day. Assigning links the event to the batch's lifecycle page."
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Bird size={15} className="text-dim shrink-0" />
        <select
          value={assignedBatchId ?? ""}
          onChange={(e) => onAssign(e.target.value || null)}
          disabled={pending || loading}
          className="bg-surface border border-line text-fg text-[13px] px-3 py-2 outline-none focus:border-accent font-[inherit] disabled:opacity-50 min-w-[220px]"
        >
          <option value="">— no batch assigned —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.count != null ? ` (${c.count} birds)` : ""}
              {c.placeName ? ` · ${c.placeName}` : ""}
            </option>
          ))}
        </select>
        {assigned && (
          <button
            onClick={() =>
              navigate(pathForBatch(assigned.speciesId, assigned.id))}
            className="inline-flex items-center gap-1 bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-deep cursor-pointer font-[inherit]"
          >
            Lifecycle page
            <ArrowUpRight size={12} className="shrink-0" />
          </button>
        )}
      </div>
      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
    </Section>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="bg-surface border border-line p-4 flex flex-col gap-3">
      <header>
        <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
        {subtitle && (
          <p className="text-[12px] text-dim m-0 mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </header>
      {children}
    </section>
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

function NumericInput({ value, onChange }) {
  return (
    <input
      type="number"
      min="0"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") { onChange(null); return; }
        const n = parseInt(raw, 10);
        onChange(Number.isFinite(n) ? n : null);
      }}
      className="bg-surface border border-line text-fg text-[14px] px-3 py-2 outline-none focus:border-accent font-[inherit] w-full"
    />
  );
}

function deriveFields(series, occurrence) {
  // Override fields win over series-level payload, mirroring the
  // recurrence reader's precedence rules.
  const seriesPl = series?.payload ?? {};
  const overridePl = occurrence?.payloadOverride ?? {};
  const merged = { ...seriesPl, ...overridePl };
  return {
    cutSheet: merged.cut_sheet ?? "",
    packedCrates: typeof merged.packed_crates === "number" ? merged.packed_crates : null,
    finalCount: typeof merged.final_count === "number" ? merged.final_count : null,
    notes: merged.notes ?? "",
    resolved: !!merged.resolved,
  };
}

function composePayload({
  existing, cutSheet, packedCrates, finalCount, notes, resolved, resolvedAt,
}) {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    cut_sheet: cutSheet?.trim() || null,
    packed_crates: typeof packedCrates === "number" ? packedCrates : null,
    final_count: typeof finalCount === "number" ? finalCount : null,
    notes: notes?.trim() || null,
    resolved: !!resolved,
    resolved_at: resolved ? (resolvedAt ?? new Date().toISOString()) : null,
  };
}
