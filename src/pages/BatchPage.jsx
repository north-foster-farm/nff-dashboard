import { useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, CalendarRange, Check, MapPin, Pencil, Plus,
  Sparkles, Trash2, TriangleAlert, X,
} from "lucide-react";
import { useSites } from "../lib/data/useSites.js";
import { placeSelectOptions } from "../components/ChoreFieldsEditor.jsx";
import { useChoreDefinitions } from "../lib/data/useChoreDefinitions.js";
import { useEventLinks } from "../lib/data/useEventLinks.js";
import { supabase } from "../lib/supabase.js";
import { computeAge, formatDate } from "../lib/dates.js";
import {
  batchLifecycle, BATCH_STATES, isMeatSpecies, isLayerSpecies,
  liveProcessingISO,
} from "../lib/metrics.js";
import { navigate, pathForSection } from "../lib/router.js";
import BatchMetricsSection from "../components/BatchMetrics.jsx";
import BatchStatePill from "../components/BatchStatePill.jsx";
import { Pane } from "../components/ui.jsx";

// The batch lifecycle page (Batch 20) — everything the dashboard knows
// about one livestock batch: its lifespan timeline (arrival → pasture
// move → processing → cleanout) read from event_links, where it lives
// right now, the events linked to it, and the delete-with-tombstone
// flow.
//
// The relationship inversion this page ships: the batch owns its
// dates. Editing a milestone date here rewrites the underlying event
// (occurrence + series dtstart); clicking a milestone opens the full
// EventEditor for that event.

// Display order + labels for the lifecycle strip. Roles come from
// event_links; "cleanout" is the one-time chore the automation
// created (chores aren't events, so it renders as a chore pill).
const MILESTONES = [
  { role: "arrival", label: "Arrival" },
  { role: "pasture_move", label: "Pasture move" },
  { role: "processing", label: "Processing" },
];

export default function BatchPage({
  batch, species, data, onOpenEvent, onNavigate,
}) {
  const {
    places, placesById, placements, addPlacement, moveOutOccupant,
    loading: sitesLoading,
  } = useSites();
  const { definitions } = useChoreDefinitions();
  const { links, loading: linksLoading, refresh } = useEventLinks({
    targetType: "batch",
    targetId: batch?.id,
  });
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);
  const [addPlaceId, setAddPlaceId] = useState("");
  const [placeBusy, setPlaceBusy] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);

  // F27 — the batch's own record (name / count / arrival / age) is
  // editable. A raw update; the livestock_groups realtime channel in
  // useReferenceData refreshes `data` (and this `batch`) in place.
  const saveDetails = async (patch) => {
    setError(null);
    const { error: err } = await supabase
      .from("livestock_groups").update(patch).eq("id", batch.id);
    if (err) { setError(err); return false; }
    return true;
  };

  // Current placements → "where is this batch right now". A batch can
  // occupy several places at once (a broiler batch split across the
  // chicken tractors; a brooder batch across two brooders), so this is
  // a SET, not a single place (migration 0039).
  const activePlacements = useMemo(
    () => (placements ?? [])
      .filter(
        (p) => p.occupantType === "batch"
          && p.occupantId === batch?.id
          && !p.movedOut
      )
      .map((p) => ({ placement: p, place: placesById?.get(p.placeId) }))
      .sort((a, b) =>
        (a.place?.name ?? "").localeCompare(b.place?.name ?? "")),
    [placements, placesById, batch?.id]
  );

  // Places the batch isn't already in — the "add a place" picker.
  const addOptions = useMemo(() => {
    const occupied = new Set(activePlacements.map((a) => a.placement.placeId));
    return placeSelectOptions(places).filter((o) => !occupied.has(o.id));
  }, [places, activePlacements]);

  const addAtPlace = async () => {
    if (!addPlaceId) return;
    setPlaceBusy(true);
    setError(null);
    try {
      await addPlacement(addPlaceId, "batch", batch.id);
      setAddPlaceId("");
    } catch (err) {
      setError(err?.message ?? "Couldn't add the place.");
    } finally {
      setPlaceBusy(false);
    }
  };

  const moveOutOf = async (placementId) => {
    setPlaceBusy(true);
    setError(null);
    try {
      await moveOutOccupant(placementId);
    } catch (err) {
      setError(err?.message ?? "Couldn't move out.");
    } finally {
      setPlaceBusy(false);
    }
  };

  // The batch's brooder-cleanout chore drives the lifecycle strip's
  // cleanout pill. (The per-batch chore LIST was retired — chores live
  // in Chores, F25 — but the cleanout milestone is a lifecycle date,
  // not a chore listing, so we still resolve it here.)
  const batchChores = useMemo(
    () => (definitions ?? []).filter(
      (c) => c.id === `auto_cleanout_${batch?.id}`
        || c.anchorBatchId === batch?.id
    ),
    [definitions, batch?.id]
  );
  const cleanoutChore = batchChores.find(
    (c) => c.frequency?.type === "once"
  ) ?? null;

  // Milestone strip entries: one per known role, in lifecycle order.
  const milestoneLinks = useMemo(() => {
    const byRole = new Map();
    for (const l of links ?? []) {
      if (!byRole.has(l.role)) byRole.set(l.role, l);
    }
    return MILESTONES.map((m) => ({
      ...m,
      link: byRole.get(m.role) ?? null,
    }));
  }, [links]);

  // The LIVE processing date (if any) — the metrics section uses it for
  // FCR's feed window and the weeks-remaining countdown, and it decides
  // processed/active. A removed processing event (skipped occurrence)
  // resolves to null so weeks-remaining falls back to the species
  // target instead of counting toward a deleted day (F22f).
  const processingISO = useMemo(() => {
    const link = milestoneLinks.find((m) => m.role === "processing")?.link;
    return liveProcessingISO(link?.series);
  }, [milestoneLinks]);

  // Links that aren't lifecycle milestones (e.g. a processing event
  // assigned via the workspace picker gets role 'processing' too, so
  // in practice this is rare — but anything else linked shows here).
  const otherLinks = useMemo(() => {
    const seen = new Set();
    const milestone = new Set(MILESTONES.map((m) => m.role));
    const out = [];
    for (const l of links ?? []) {
      if (milestone.has(l.role) && !seen.has(l.role)) {
        seen.add(l.role);
        continue;
      }
      out.push(l);
    }
    return out;
  }, [links]);

  if (!batch) {
    return (
      <div className="bg-surface border border-line px-5 py-8 text-center">
        <div className="text-[13px] text-muted">
          This batch doesn't exist (it may have been deleted).
        </div>
        <BackToSpecies species={species} onNavigate={onNavigate} />
      </div>
    );
  }

  const age = computeAge(batch.knownAge)
    ?? ageFromArrival(batch.arrivalDate);

  // Derived lifecycle (processed / arriving / active) — drives the
  // status pill and tells the metrics section to hold performance
  // numbers until the birds are actually on the farm.
  const life = batchLifecycle(batch, processingISO);

  // ── milestone date edit: the batch owns its dates ──────────────────
  const rescheduleMilestone = async (link, newDate) => {
    if (!link?.series || !newDate) return;
    setError(null);
    try {
      const series = link.series;
      // A REMOVED milestone (its series was ended / its only occurrence
      // skipped) comes back when you give it a new date — that's how you
      // re-edit a "removed" processing day (F22a).
      const removed = series.status === "ended"
        || (series.occurrences ?? []).every((o) => o.status === "skipped");
      const live = series.occurrences.find((o) => o.status !== "skipped")
        ?? series.occurrences[0];
      if (live) {
        const patch = { occurs_on: newDate };
        // Revive a skipped occurrence — but never downgrade a done one.
        if (live.status === "skipped") patch.status = "scheduled";
        const { error: err } = await supabase
          .from("event_occurrences").update(patch).eq("id", live.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("event_occurrences")
          .insert({
            series_id: link.seriesId,
            occurs_on: newDate,
            status: "scheduled",
          });
        if (err) throw err;
      }
      // Keep the series anchor consistent (one-off events derive
      // display fields from the occurrence, but dtstart shouldn't
      // contradict it); un-end it if it was removed.
      const seriesPatch = { dtstart: `${newDate}T00:00:00+00:00` };
      if (removed) seriesPatch.status = "active";
      const { error: sErr } = await supabase
        .from("event_series").update(seriesPatch).eq("id", link.seriesId);
      if (sErr) throw sErr;
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  const rescheduleCleanout = async (chore, newDate) => {
    if (!chore || !newDate) return;
    setError(null);
    const { error: err } = await supabase
      .from("chore_definitions")
      .update({ frequency: { type: "once", date: newDate } })
      .eq("id", chore.id);
    if (err) setError(err);
  };

  // ── create a missing milestone event (2026-06 chore-ux fixes) ──────
  // Batches created before the lifecycle automation existed (or whose
  // events were deleted) have milestone slots with nothing linked.
  // Picking a date in an empty pill creates the event series + its
  // one-off occurrence + the event_links row, right from this screen.
  const createMilestone = async (role, milestoneLabel, date) => {
    if (!date) return;
    setError(null);
    try {
      const kindId = role === "processing"
        ? "processing_days"
        : "batch_milestones";
      const { data: series, error: sErr } = await supabase
        .from("event_series")
        .insert({
          kind_id: kindId,
          label: `${batch.label} — ${milestoneLabel.toLowerCase()}`,
          dtstart: `${date}T00:00:00+00:00`,
          status: "active",
        })
        .select("id")
        .single();
      if (sErr) throw sErr;
      const { error: oErr } = await supabase
        .from("event_occurrences")
        .insert({
          series_id: series.id,
          occurs_on: date,
          status: "scheduled",
        });
      if (oErr) throw oErr;
      const { error: lErr } = await supabase
        .from("event_links")
        .insert({
          series_id: series.id,
          target_type: "batch",
          target_id: batch.id,
          role,
        });
      if (lErr) throw lErr;
      await refresh();
    } catch (e) {
      setError(e);
    }
  };

  // ── delete with tombstone ───────────────────────────────────────────
  const linkedSeriesIds = (links ?? [])
    .map((l) => l.seriesId)
    .filter(Boolean);

  const deleteBatch = async () => {
    setDeleting(true);
    setError(null);
    try {
      // 1. Tombstone linked events: end the series, skip scheduled
      //    occurrences (rows are kept — calendar + audit history).
      if (linkedSeriesIds.length > 0) {
        const { error: oErr } = await supabase
          .from("event_occurrences")
          .update({ status: "skipped" })
          .in("series_id", linkedSeriesIds)
          .eq("status", "scheduled");
        if (oErr) throw oErr;
        const { error: sErr } = await supabase
          .from("event_series")
          .update({ status: "ended" })
          .in("id", linkedSeriesIds);
        if (sErr) throw sErr;
      }
      // 2. Retire one-time chores tied to the batch; recurring chores
      //    anchored to it go dormant on their own once the batch row
      //    is gone (their anchor resolves to nothing).
      for (const chore of batchChores) {
        if (chore.frequency?.type === "once" && !chore.retiredAt) {
          const { error: cErr } = await supabase
            .from("chore_definitions")
            .update({ retired_at: new Date().toISOString() })
            .eq("id", chore.id);
          if (cErr) throw cErr;
        }
      }
      // 3. Close the open placement (history stays).
      if (activePlacement) {
        await moveOutOccupant(activePlacement.id);
      }
      // 4. Remove processing-workspace assignments pointing at the
      //    batch — a dangling assignment on a future processing day
      //    would silently reference a deleted batch.
      const { error: aErr } = await supabase
        .from("batch_assignments")
        .delete()
        .eq("batch_id", batch.id);
      if (aErr) throw aErr;
      // 5. Delete the batch row itself. event_links rows survive as
      //    orphaned history (target_id is plain text, not an FK).
      const { error: bErr } = await supabase
        .from("livestock_groups")
        .delete()
        .eq("id", batch.id);
      if (bErr) throw bErr;

      navigate(pathForSection(`livestock_${species.id}`), { replace: true });
    } catch (e) {
      setError(e);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── header ── */}
      <div>
        <BackToSpecies species={species} onNavigate={onNavigate} />
        <div className="flex items-start justify-between gap-4 flex-wrap mt-3">
          <div>
            <div className="font-ui text-[10px] uppercase tracking-[0.16em] text-faint font-semibold">
              {species.name} batch
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-heading text-[28px] font-bold -tracking-[0.02em] m-0 leading-tight">
                {batch.label}
              </h2>
              <BatchStatePill state={life.state} />
            </div>
            {life.state === "arriving" && (
              <div className="text-[12px] text-accent-deep mt-1">
                Arrives {formatDate(life.arrivalISO)} — not on the farm yet.
              </div>
            )}
            {life.state === "processed" && (
              <div className="text-[12px] text-dim mt-1">
                Processed {formatDate(life.processingISO)}.
              </div>
            )}
            {species.breed && (
              <div className="text-[12px] text-dim mt-1">{species.breed}</div>
            )}
          </div>
          <div className="flex items-start gap-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <HeaderStat label="Count" value={batch.count ?? "—"} />
              <HeaderStat label="Age" value={age ?? "—"} />
              <HeaderStat
                label="Arrived"
                value={formatDate(batch.arrivalDate) || "—"}
              />
            </div>
            {!editingDetails && (
              <button
                onClick={() => setEditingDetails(true)}
                title="Edit this batch's details"
                className="shrink-0 bg-transparent border-0 p-1 text-dim hover:text-accent-deep cursor-pointer"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>
        {editingDetails && (
          <BatchDetailsForm
            batch={batch}
            onSave={saveDetails}
            onClose={() => setEditingDetails(false)}
          />
        )}
      </div>

      {/* ── lifecycle strip ── */}
      {/* The arrival→pasture→processing→cleanout arc applies to both
          meat birds (F27) and layers (F20): layers get arrival +
          pasture-move + brooder-cleanout from their own lifecycle
          process, and set a processing date manually when a cohort is
          retired. Pet species (sheep) don't get processed, so it stays
          hidden for them. */}
      {(isMeatSpecies(species) || isLayerSpecies(species)) && (
      <Pane title="Lifecycle" icon={CalendarRange}>
        {linksLoading ? (
          <div className="text-[12px] text-dim italic">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {milestoneLinks.map((m) => (
              <MilestonePill
                key={m.role}
                label={m.label}
                link={m.link}
                onOpen={() => {
                  if (!m.link?.series) return;
                  const occ = m.link.series.occurrences.find(
                    (o) => o.status !== "skipped"
                  ) ?? m.link.series.occurrences[0];
                  onOpenEvent?.({
                    mode: "edit",
                    seriesId: m.link.seriesId,
                    occursOn: occ?.occursOn ?? null,
                    kindId: m.link.series.kindId,
                  });
                }}
                onReschedule={(newDate) =>
                  rescheduleMilestone(m.link, newDate)}
                onCreate={(date) =>
                  createMilestone(m.role, m.label, date)}
              />
            ))}
            <CleanoutPill
              chore={cleanoutChore}
              onReschedule={(newDate) =>
                rescheduleCleanout(cleanoutChore, newDate)}
            />
          </div>
        )}
        <p className="text-[11px] text-faint leading-relaxed m-0 mt-3">
          The batch owns these dates — editing one here moves the
          underlying event. Click a milestone name to open it in the
          event editor.
        </p>
      </Pane>
      )}

      {/* ── metrics: performance / production + capture (Batch 26.1) ── */}
      <BatchMetricsSection
        batch={batch}
        species={species}
        data={data}
        processingISO={processingISO}
        lifecycle={life}
      />

      {/* ── where ── */}
      <div>
        <Pane title="Where" icon={MapPin}>
          {sitesLoading ? (
            <div className="text-[12px] text-dim italic">Loading…</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {activePlacements.length === 0 ? (
                <div className="text-[12px] text-dim italic">
                  Not placed anywhere right now.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {activePlacements.map(({ placement, place }) => (
                    <div
                      key={placement.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <button
                          onClick={() => place && navigate(`/place/${place.id}`)}
                          disabled={!place}
                          className="bg-transparent border-0 p-0 cursor-pointer text-left font-[inherit] text-[14px] font-medium text-fg hover:text-accent-deep inline-flex items-center gap-1.5 disabled:cursor-default"
                        >
                          {place?.name ?? "Unknown place"}
                          {place && <ArrowUpRight size={12} className="shrink-0" />}
                        </button>
                        {placement.movedIn && (
                          <div className="text-[11px] text-dim">
                            since {formatDate(placement.movedIn)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => moveOutOf(placement.id)}
                        disabled={placeBusy}
                        title="Move the batch out of this place"
                        className="shrink-0 bg-transparent border-0 p-1 cursor-pointer text-dim hover:text-warn disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add another place — a batch can occupy several at once. */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-hair">
                <select
                  value={addPlaceId}
                  onChange={(e) => setAddPlaceId(e.target.value)}
                  disabled={placeBusy}
                  className="flex-1 min-w-0 text-[12px] bg-surface border border-hair rounded px-1.5 py-1 text-fg"
                >
                  <option value="">— add a place —</option>
                  {addOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={addAtPlace}
                  disabled={placeBusy || !addPlaceId}
                  className="shrink-0 inline-flex items-center gap-1 text-[12px] bg-accent text-white rounded px-2 py-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>
          )}
        </Pane>
      </div>

      {/* ── other linked events ── */}
      {otherLinks.length > 0 && (
        <Pane title="Also linked" icon={CalendarRange}>
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {otherLinks.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => {
                    if (!l.series) return;
                    const occ = l.series.occurrences.find(
                      (o) => o.status !== "skipped"
                    ) ?? l.series.occurrences[0];
                    onOpenEvent?.({
                      mode: "edit",
                      seriesId: l.seriesId,
                      occursOn: occ?.occursOn ?? null,
                      kindId: l.series.kindId,
                    });
                  }}
                  className="bg-transparent border-0 p-0 cursor-pointer text-left font-[inherit] text-[13px] text-fg hover:text-accent-deep inline-flex items-baseline gap-2"
                >
                  <span>{l.series?.label ?? "(deleted event)"}</span>
                  <span className="text-[11px] text-dim">{l.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </Pane>
      )}

      {error && (
        <div className="text-[11px] text-warn">
          {error.message ?? String(error)}
        </div>
      )}

      {/* ── danger zone ── */}
      <Pane title="Danger zone" icon={TriangleAlert}>
        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="self-start inline-flex items-center gap-1.5 bg-transparent border border-warn/60 text-warn font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            <Trash2 size={13} className="shrink-0" /> Delete this batch
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] text-fg leading-relaxed">
              Delete <strong>{batch.label}</strong>? This will:
            </div>
            <ul className="m-0 pl-5 text-[12px] text-dim leading-relaxed">
              <li>
                end {linkedSeriesIds.length} linked event
                {linkedSeriesIds.length === 1 ? "" : "s"} (they disappear
                from the calendar but stay in the database)
              </li>
              <li>
                retire {batchChores.filter(
                  (c) => c.frequency?.type === "once").length} one-time
                chore(s) tied to it
              </li>
              {activePlacement && (
                <li>close its placement at {currentPlace?.name}</li>
              )}
              <li>remove its processing-day assignment (if any)</li>
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={deleteBatch}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 bg-warn text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={13} className="shrink-0" />
                {deleting ? "Deleting…" : "Delete batch"}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Pane>
    </div>
  );
}

// ── pieces ────────────────────────────────────────────────────────────

function BackToSpecies({ species, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate?.(`livestock_${species.id}`)}
      className="inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim hover:text-fg cursor-pointer font-[inherit]"
    >
      <ArrowLeft size={12} className="shrink-0" />
      All {species.name.toLowerCase()}
    </button>
  );
}

function HeaderStat({ label, value }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-0.5">
        {label}
      </div>
      <div className="font-heading text-[18px] font-semibold text-fg">
        {value}
      </div>
    </div>
  );
}

const DETAIL_INPUT =
  "bg-surface-alt border border-line px-2 py-1.5 text-[13px] text-fg " +
  "font-[inherit] outline-none focus:border-accent";

// F27 — edit the batch's own record: name, live count, arrival date,
// and an optional known-age snapshot (N weeks as of a date; blank =
// age derives from arrival). Saving persists to livestock_groups and
// realtime refreshes the page.
function BatchDetailsForm({ batch, onSave, onClose }) {
  const [label, setLabel] = useState(batch.label ?? "");
  const [count, setCount] = useState(
    batch.count == null ? "" : String(batch.count));
  const [arrival, setArrival] = useState(batch.arrivalDate ?? "");
  const [ageWeeks, setAgeWeeks] = useState(
    batch.knownAge?.weeks == null ? "" : String(batch.knownAge.weeks));
  const [ageAsOf, setAgeAsOf] = useState(batch.knownAge?.asOfDate ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) { setErr("The batch needs a name."); return; }
    const weeksNum = ageWeeks === "" ? null : Number(ageWeeks);
    if (weeksNum != null && (Number.isNaN(weeksNum) || !ageAsOf)) {
      setErr("For a known age, set both the weeks and the as-of date.");
      return;
    }
    const countNum = count === "" ? null : Number(count);
    const patch = {
      label: trimmed,
      count: countNum,
      arrival_date: arrival || null,
      known_age: weeksNum == null
        ? null
        : { weeks: weeksNum, asOfDate: ageAsOf },
    };
    // A group that never had a starting count adopts this one, so the
    // egg / performance metrics have a denominator (placed_count is
    // otherwise the immutable as-placed count).
    if (batch.placedCount == null && countNum != null) {
      patch.placed_count = countNum;
    }
    setErr(null);
    setSaving(true);
    const ok = await onSave(patch);
    setSaving(false);
    if (ok) onClose();
    else setErr("Couldn't save — try again.");
  };

  return (
    <div className="border border-line px-4 py-4 mt-3">
      <div className="flex items-end gap-4 flex-wrap">
        <DetailField label="Name">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={DETAIL_INPUT + " w-[180px]"}
          />
        </DetailField>
        <DetailField label="Count">
          <input
            type="number"
            min={0}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="—"
            className={DETAIL_INPUT + " w-[90px]"}
          />
        </DetailField>
        <DetailField label="Arrival date">
          <input
            type="date"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            className={DETAIL_INPUT}
          />
        </DetailField>
      </div>
      <div className="flex items-end gap-4 flex-wrap mt-3">
        <DetailField label="Known age">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={ageWeeks}
              onChange={(e) => setAgeWeeks(e.target.value)}
              placeholder="—"
              className={DETAIL_INPUT + " w-[70px]"}
            />
            <span className="text-[11px] text-dim">weeks as of</span>
            <input
              type="date"
              value={ageAsOf}
              onChange={(e) => setAgeAsOf(e.target.value)}
              className={DETAIL_INPUT}
            />
          </div>
        </DetailField>
      </div>
      {err && <div className="text-[11px] text-warn mt-2.5">{err}</div>}
      <div className="text-[11px] text-faint mt-3 leading-relaxed">
        Leave the age blank to show age counted from the arrival date.
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={submit}
          disabled={saving || !label.trim()}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3.5 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={13} /> {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onClose}
          className="bg-transparent text-dim border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3.5 py-1.5 cursor-pointer hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DetailField({ label, children }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

// One lifecycle milestone: name (click → EventEditor), the date as an
// editable input, a relative time label, and status treatment (done /
// skipped / ended events render dimmed).
function MilestonePill({ label, link, onOpen, onReschedule, onCreate }) {
  const series = link?.series;
  const occ = series?.occurrences.find((o) => o.status !== "skipped")
    ?? series?.occurrences[0];
  const date = occ?.occursOn ?? null;
  const tombstoned = series?.status === "ended"
    || (occ && occ.status === "skipped");
  const done = occ?.status === "done";

  return (
    <div
      className={
        "border px-3.5 py-3 flex flex-col gap-1.5 " +
        (tombstoned
          ? "border-dashed border-line bg-surface-alt"
          : done
            ? "border-resolved/50 bg-surface-alt"
            : "border-line bg-surface-alt")
      }
    >
      <button
        onClick={onOpen}
        disabled={!series}
        className={
          "bg-transparent border-0 p-0 text-left font-[inherit] " +
          "text-[11px] font-bold uppercase tracking-[0.1em] " +
          (series
            ? "text-fg hover:text-accent-deep cursor-pointer"
            : "text-faint cursor-default")
        }
      >
        {label}
        {series?.automationEmissionId && (
          <Sparkles size={10} className="inline ml-1 -translate-y-px text-accent-deep" />
        )}
      </button>
      {series ? (
        <>
          {/* A removed milestone stays editable — setting a date
              restores it (F22a). */}
          <input
            type="date"
            value={date ?? ""}
            onChange={(e) => {
              if (e.target.value) onReschedule(e.target.value);
            }}
            className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit] w-full"
          />
          <div className="text-[10px] text-dim">
            {tombstoned
              ? "removed — set a date to restore"
              : done ? "done" : relativeDays(date)}
          </div>
        </>
      ) : (
        <>
          {/* No event yet — picking a date creates the milestone event
              and links it to this batch right here. */}
          <input
            type="date"
            value=""
            onChange={(e) => {
              if (e.target.value) onCreate?.(e.target.value);
            }}
            className="bg-surface border border-dashed border-line text-dim text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit] w-full"
            title={`Pick a date to create the ${label.toLowerCase()} event`}
          />
          <div className="text-[10px] text-faint">
            pick a date to create this event
          </div>
        </>
      )}
    </div>
  );
}

// The cleanout milestone is a chore, not an event — same pill shape,
// but rescheduling rewrites the chore's `once` date and there's no
// event editor to open.
function CleanoutPill({ chore, onReschedule }) {
  const date = chore?.frequency?.type === "once"
    ? chore.frequency.date
    : null;
  return (
    <div
      className={
        "border border-line bg-surface-alt px-3.5 py-3 flex flex-col gap-1.5 " +
        (chore?.retiredAt ? "opacity-50" : "")
      }
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg">
        Brooder cleanout
        {(chore?.automationEmissionId || chore?.processExpansionId) && (
          <Sparkles size={10} className="inline ml-1 -translate-y-px text-accent-deep" />
        )}
        <span className="ml-1.5 text-[9px] font-semibold text-faint normal-case tracking-normal">
          chore
        </span>
      </div>
      {chore ? (
        <>
          <input
            type="date"
            value={date ?? ""}
            disabled={!!chore.retiredAt}
            onChange={(e) => {
              if (e.target.value) onReschedule(e.target.value);
            }}
            className="bg-surface border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit] w-full disabled:opacity-60"
          />
          <div className="text-[10px] text-dim">
            {chore.retiredAt ? "done" : relativeDays(date)}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-faint italic">no chore</div>
      )}
    </div>
  );
}

// "today" / "in 12 days" / "23 days ago"
function relativeDays(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return "";
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return `in ${diff} days`;
  return `${-diff} days ago`;
}

// Fallback age when known_age isn't recorded: weeks since arrival.
function ageFromArrival(arrivalDate) {
  if (!arrivalDate) return null;
  const [y, m, d] = arrivalDate.split("-").map(Number);
  if (!y) return null;
  const arrived = new Date(y, m - 1, d);
  const days = Math.floor((Date.now() - arrived.getTime()) / 86400000);
  if (days < 0) return null;
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  return `${Math.floor(days / 7)} weeks`;
}
