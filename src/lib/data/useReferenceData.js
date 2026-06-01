import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import NFF_DATA from "../../data/nff-data.json";

// Loads every migrated reference table in parallel and returns them keyed
// under the SAME names the UI already uses on the `data` object from
// nff-data.json. That way the merge in App.jsx is a simple spread — every
// downstream component keeps reading `data.suppliers`, `data.machines`,
// etc., and doesn't need to know the data moved to Postgres.
//
// During the initial load each key is `null`. The App-level merge spreads
// only non-null keys over the JSON fallback, so components never see a
// half-loaded state — they see JSON data until the DB pulls in, then flip
// atomically to DB data.
//
// Keys exposed:
//   Batch 1 — suppliers, machines, trailers, feeds
//   Batch 2 — livestock ({species}), feedSchedules, chores ({definitions})
//   Batch 3 — events ({kinds}), productKinds, inventory ({eggLots, chickenLots})
//   Batch 4 — threads, orders, updates, projects
//
// This is the complete migrated reference set. Anything still living in
// nff-data.json (costs, model notes, meta) is intentionally left there:
// it's static config / display prose with no editing surface.
const INITIAL = {
  suppliers: null,
  machines: null,
  trailers: null,
  feeds: null,
  livestock: null,
  feedSchedules: null,
  chores: null,
  events: null,
  productKinds: null,
  inventory: null,
  threads: null,
  orders: null,
  updates: null,
  projects: null
};

export function useReferenceData() {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    // Fire every query in parallel — they're small and mostly unrelated.
    // Promise.all would fail the whole batch if any one query errors; we
    // want per-slice resilience so each promise sets its own key.
    loadSuppliers().then(v => !cancelled && setState(s => ({ ...s, suppliers: v })));
    loadMachines().then(v => !cancelled && setState(s => ({ ...s, machines: v })));
    loadTrailers().then(v => !cancelled && setState(s => ({ ...s, trailers: v })));
    loadFeeds().then(v => !cancelled && setState(s => ({ ...s, feeds: v })));
    loadLivestock().then(v => !cancelled && setState(s => ({ ...s, livestock: v })));
    loadFeedSchedules().then(v => !cancelled && setState(s => ({ ...s, feedSchedules: v })));
    loadChores().then(v => !cancelled && setState(s => ({ ...s, chores: v })));
    loadEvents().then(v => !cancelled && setState(s => ({ ...s, events: v })));
    loadProductKinds().then(v => !cancelled && setState(s => ({ ...s, productKinds: v })));
    loadInventory().then(v => !cancelled && setState(s => ({ ...s, inventory: v })));
    loadThreads().then(v => !cancelled && setState(s => ({ ...s, threads: v })));
    loadOrders().then(v => !cancelled && setState(s => ({ ...s, orders: v })));
    loadUpdates().then(v => !cancelled && setState(s => ({ ...s, updates: v })));
    loadProjects().then(v => !cancelled && setState(s => ({ ...s, projects: v })));
    return () => { cancelled = true; };
  }, []);

  // Keep the events slice live. EventEditor writes through the
  // realtime useEventSeries / useEventOccurrences hooks, but the
  // calendar reads `data.events` from here — so without this
  // subscription, creating / editing / deleting an event only showed
  // up after a hard refresh. Re-run loadEvents (debounced) on any
  // change to either events table.
  useEffect(() => {
    let cancelled = false;
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(async () => {
        scheduled = false;
        const v = await loadEvents();
        if (!cancelled && v) setState(s => ({ ...s, events: v }));
      }, 120);
    };
    const channel = supabase
      .channel("refdata:events:stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_series" },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_occurrences" },
        refresh
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  return state;
}

// ─── Per-table loaders ──────────────────────────────────────────────────────
// Each loader resolves to either the array/object in the JSON shape the UI
// expects, or null on error (so the merge leaves the JSON fallback in place).

async function loadSuppliers() {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, label, category, supplies, notes")
    .order("label");
  if (error) { console.error("loadSuppliers:", error); return null; }
  return data;
}

async function loadMachines() {
  const { data, error } = await supabase
    .from("machines")
    .select("id, label, category, manufacturer, model, uses, notes")
    .order("label");
  if (error) { console.error("loadMachines:", error); return null; }
  return data;
}

async function loadTrailers() {
  const { data, error } = await supabase
    .from("trailers")
    .select("id, label, category, uses, notes")
    .order("label");
  if (error) { console.error("loadTrailers:", error); return null; }
  return data;
}

// The DB table is `feed_types`; the JSON key is `feeds`. We also remap
// snake_case columns to the camelCase keys the UI expects so the caller
// never has to care about the DB naming convention.
async function loadFeeds() {
  const { data, error } = await supabase
    .from("feed_types")
    .select(
      "id, name, description, supplier_id, unit, package_size, cost_per_unit, reorder_point, reorder_quantity, lead_time_days, notes"
    )
    .order("name");
  if (error) { console.error("loadFeeds:", error); return null; }
  return data.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    supplierId: row.supplier_id,
    unit: row.unit,
    packageSize: row.package_size,
    costPerUnit: row.cost_per_unit,
    reorderPoint: row.reorder_point,
    reorderQuantity: row.reorder_quantity,
    leadTimeDays: row.lead_time_days,
    notes: row.notes
  }));
}

// Livestock species + groups joined in-memory. Two queries are cheaper than
// the PostgREST nested-resource syntax here because we want full control
// over the shape (UI expects groups nested inside each species).
async function loadLivestock() {
  const [speciesRes, groupsRes] = await Promise.all([
    supabase
      .from("livestock_species")
      .select(
        "id, name, purpose, breed, tracking_model, acquisition, processing_timeline, brooder_to_tractor_transition, feed_regimen, feed_note, lifecycle, constraints, feed_tracking, ordinal"
      )
      .order("ordinal"),
    supabase
      .from("livestock_groups")
      .select("id, species_id, label, ordinal, count, arrival_date, known_age, cohabits")
      .order("ordinal", { nullsLast: true })
  ]);
  if (speciesRes.error) { console.error("loadLivestock:species", speciesRes.error); return null; }
  if (groupsRes.error) { console.error("loadLivestock:groups", groupsRes.error); return null; }

  const groupsBySpecies = new Map();
  for (const g of groupsRes.data) {
    const arr = groupsBySpecies.get(g.species_id) ?? [];
    arr.push({
      id: g.id,
      label: g.label,
      ordinal: g.ordinal,
      count: g.count,
      arrivalDate: g.arrival_date,
      knownAge: g.known_age,
      // current_location was dropped in Batch 15 (place-model collapse);
      // a cohort's location now lives in `placements`. SpeciesPage still
      // reads this field, so keep it defined as null until that page is
      // repointed to placements (Batch 16+).
      currentLocation: null,
      cohabits: g.cohabits
    });
    groupsBySpecies.set(g.species_id, arr);
  }

  return {
    species: speciesRes.data.map(s => ({
      id: s.id,
      name: s.name,
      purpose: s.purpose,
      breed: s.breed,
      trackingModel: s.tracking_model,
      acquisition: s.acquisition,
      processingTimeline: s.processing_timeline,
      brooderToTractorTransition: s.brooder_to_tractor_transition,
      feedRegimen: s.feed_regimen,
      feedNote: s.feed_note,
      lifecycle: s.lifecycle,
      constraints: s.constraints,
      feedTracking: s.feed_tracking,
      groups: groupsBySpecies.get(s.id) ?? []
    }))
  };
}

// Feed schedules + their ordered stages, joined in-memory (same reasoning
// as loadLivestock). Stages are sorted by `ordinal` within each schedule.
async function loadFeedSchedules() {
  const [schedRes, stageRes] = await Promise.all([
    supabase
      .from("feed_schedules")
      .select("id, name, species_id, description, cycle_anchor_label, assigned_group_ids")
      .order("id"),
    supabase
      .from("feed_schedule_stages")
      .select("id, schedule_id, name, start_day, end_day, feed_type_id, consumption, notes, ordinal")
      .order("ordinal")
  ]);
  if (schedRes.error) { console.error("loadFeedSchedules:schedules", schedRes.error); return null; }
  if (stageRes.error) { console.error("loadFeedSchedules:stages", stageRes.error); return null; }

  const stagesBySchedule = new Map();
  for (const st of stageRes.data) {
    const arr = stagesBySchedule.get(st.schedule_id) ?? [];
    arr.push({
      id: st.id,
      name: st.name,
      startDay: st.start_day,
      endDay: st.end_day,
      feedTypeId: st.feed_type_id,
      consumption: st.consumption,
      notes: st.notes
    });
    stagesBySchedule.set(st.schedule_id, arr);
  }

  return schedRes.data.map(s => ({
    id: s.id,
    name: s.name,
    speciesId: s.species_id,
    description: s.description,
    cycleAnchorLabel: s.cycle_anchor_label,
    assignedGroupIds: s.assigned_group_ids,
    stages: stagesBySchedule.get(s.id) ?? []
  }));
}

// Chore definitions. UI accesses these as `data.chores.definitions` (the
// JSON wraps them in a `chores` object) so we preserve that shape. The
// `completions` array is left empty — it lived there as a placeholder in
// the JSON and is now served by chore_completions + activity_log.
async function loadChores() {
  const { data, error } = await supabase
    .from("chore_definitions")
    .select(
      "id, title, category, description, frequency, period, start_time, " +
      "deadline, assignment, tags, place_id, block_id, sort_order"
    )
    .order("sort_order")
    .order("category");
  if (error) { console.error("loadChores:", error); return null; }
  return {
    definitions: data.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      frequency: c.frequency,
      period: c.period,
      startTime: c.start_time,
      deadline: c.deadline,
      assignment: c.assignment,
      tags: c.tags,
      placeId: c.place_id,
      blockId: c.block_id,
      sortOrder: c.sort_order ?? 0,
    })),
    completions: [],
    modelNotes: []
  };
}

// Events: kinds + flat instance list, re-nested into kind.instances to
// match the JSON shape the UI reads from. We preserve the `modelNotes`
// array by returning it from the static JSON via the merge fallback — it
// isn't migrated because it's display-only prose.
// Read events through the new event_series + event_occurrences shape
// (Batch 13.1). The migration in 0013 backfills every legacy
// event_instances row into a series with either an RRULE string
// (recurring) or a pre-materialized occurrence (one-off). The UI-
// facing shape this function emits is back-compat with the pre-13.1
// callers, so Schedule.jsx / AllEvents.jsx / EventKindPage / Overview
// keep rendering unchanged. The new fields (`rrule`, `dtstart`,
// `until`, `seasonWindow`, `durationMinutes`, `occurrences`) are
// surfaced for the rrule-based recurrence wrapper to consume.
async function loadEvents() {
  const [kindsRes, seriesRes, occurrencesRes] = await Promise.all([
    supabase
      .from("event_kinds")
      .select("id, label, description, ordinal")
      .order("ordinal"),
    supabase
      .from("event_series")
      .select(
        "id, legacy_instance_id, kind_id, label, subtitle, location, " +
        "rrule, dtstart, until, duration_minutes, season_window, " +
        "status, payload, notes"
      )
      .eq("status", "active"),
    supabase
      .from("event_occurrences")
      .select(
        "id, series_id, occurs_on, start_time, end_time, " +
        "location_override, notes_override, status, " +
        "gcal_event_id, payload_override"
      )
  ]);
  if (kindsRes.error) { console.error("loadEvents:kinds", kindsRes.error); return null; }
  if (seriesRes.error) { console.error("loadEvents:series", seriesRes.error); return null; }
  if (occurrencesRes.error) { console.error("loadEvents:occurrences", occurrencesRes.error); return null; }

  // Group occurrences under their series, sorted by occurs_on so the
  // first entry is the earliest — important for one-off series whose
  // sole occurrence carries the canonical date.
  const occurrencesBySeries = new Map();
  for (const o of occurrencesRes.data ?? []) {
    const arr = occurrencesBySeries.get(o.series_id) ?? [];
    arr.push({
      id: o.id,
      occursOn: o.occurs_on,
      startTime: o.start_time,
      endTime: o.end_time,
      locationOverride: o.location_override,
      notesOverride: o.notes_override,
      status: o.status,
      gcalEventId: o.gcal_event_id,
      payloadOverride: o.payload_override,
    });
    occurrencesBySeries.set(o.series_id, arr);
  }
  for (const arr of occurrencesBySeries.values()) {
    arr.sort((a, b) => (a.occursOn ?? "").localeCompare(b.occursOn ?? ""));
  }

  // Map series → UI-facing instance shape. One-off series surface
  // their pre-materialized occurrence's date / times in the legacy
  // top-level fields so existing list / kind-page rendering stays
  // identical. Recurring series carry rrule + dtstart + duration so
  // the rrule.js wrapper can expand them.
  const instancesByKind = new Map();
  for (const s of seriesRes.data ?? []) {
    const occurrences = occurrencesBySeries.get(s.id) ?? [];
    const isRecurring = !!s.rrule;
    // For one-offs the canonical anchor is the first non-skipped
    // occurrence — drag-to-reschedule (Batch 14.2) can leave the
    // original row tombstoned `skipped` and a new row at a fresh
    // date.
    const oneOff = !isRecurring
      ? (occurrences.find(o => o?.status !== "skipped") ?? occurrences[0])
      : null;
    const inst = {
      id: s.id,
      legacyInstanceId: s.legacy_instance_id,
      label: s.label,
      subtitle: s.subtitle,
      location: s.location,
      rrule: s.rrule,
      dtstart: s.dtstart,
      until: s.until,
      durationMinutes: s.duration_minutes,
      seasonWindow: s.season_window,
      payload: s.payload,
      notes: s.notes,
      occurrences,
      // Back-compat: pre-13.1 callers read `date` / `startTime` /
      // `endTime` / `processing` directly off the instance.
      date: oneOff?.occursOn ?? null,
      startTime: oneOff?.startTime
        ?? extractStartTime(s.dtstart),
      endTime: oneOff?.endTime
        ?? extractEndTime(s.dtstart, s.duration_minutes),
      processing: s.payload ?? null,
    };
    const arr = instancesByKind.get(s.kind_id) ?? [];
    arr.push(inst);
    instancesByKind.set(s.kind_id, arr);
  }

  return {
    kinds: kindsRes.data.map(k => ({
      id: k.id,
      label: k.label,
      description: k.description,
      instances: instancesByKind.get(k.id) ?? []
    })),
    // modelNotes is display-only prose; carry it forward from the JSON
    // so the merge at App.jsx replaces `data.events` wholesale without
    // losing the notes section on Schedule / AllEvents.
    modelNotes: NFF_DATA.events?.modelNotes ?? []
  };
}

// "2026-05-09T08:00:00+00:00" → "08:00" (UTC components — the migration
// stored series dtstart in the same TZ the legacy date column lived in,
// so reading UTC components gives the wall-clock time the user
// originally saved).
function extractStartTime(dtstart) {
  if (!dtstart) return null;
  const d = new Date(dtstart);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function extractEndTime(dtstart, durationMin) {
  const start = extractStartTime(dtstart);
  if (!start || typeof durationMin !== "number") return null;
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + durationMin;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Product-kind catalog — trivial shape remap.
async function loadProductKinds() {
  const { data, error } = await supabase
    .from("product_kinds")
    .select(
      "id, name, category, sale_unit, source_species_id, source_material, yield_share_of_dressed_weight, size_brackets, ordinal"
    )
    .order("ordinal");
  if (error) { console.error("loadProductKinds:", error); return null; }
  return data.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    saleUnit: p.sale_unit,
    sourceSpeciesId: p.source_species_id,
    sourceMaterial: p.source_material,
    yieldShareOfDressedWeight: p.yield_share_of_dressed_weight,
    sizeBrackets: p.size_brackets
  }));
}

// Inventory: egg_lots + chicken_lots, empty at launch. Shape matches what
// Inventory.jsx reads (`data.inventory.eggLots`, `data.inventory.chickenLots`).
// `modelNotes` stays JSON-only like events.
async function loadInventory() {
  const [eggRes, chickenRes] = await Promise.all([
    supabase
      .from("egg_lots")
      .select("id, collection_date, carton_count, eggs_per_carton, location, notes")
      .order("collection_date", { ascending: false }),
    supabase
      .from("chicken_lots")
      .select("id, product_kind_id, size_bracket_id, processing_date, quantity, location, notes")
      .order("processing_date", { ascending: false })
  ]);
  if (eggRes.error) { console.error("loadInventory:eggs", eggRes.error); return null; }
  if (chickenRes.error) { console.error("loadInventory:chicken", chickenRes.error); return null; }

  return {
    eggLots: eggRes.data.map(e => ({
      id: e.id,
      collectionDate: e.collection_date,
      cartonCount: e.carton_count,
      eggsPerCarton: e.eggs_per_carton,
      location: e.location,
      notes: e.notes
    })),
    chickenLots: chickenRes.data.map(c => ({
      id: c.id,
      productKindId: c.product_kind_id,
      sizeBracketId: c.size_bracket_id,
      processingDate: c.processing_date,
      quantity: c.quantity,
      location: c.location,
      notes: c.notes
    })),
    // Same pattern as events.modelNotes — carry forward display prose
    // from the JSON since we didn't migrate it.
    modelNotes: NFF_DATA.inventory?.modelNotes ?? []
  };
}

// Threads — open questions / decision records. Status is "open" or
// "resolved" today; future statuses just work without schema changes.
async function loadThreads() {
  const { data, error } = await supabase
    .from("threads")
    .select("id, title, question, status, resolution, notes, ordinal")
    .order("ordinal");
  if (error) { console.error("loadThreads:", error); return null; }
  // Threads.jsx reads each thread directly with t.status, t.title, etc.
  // Existing JSON entries have no `notes` key on most rows; we strip
  // null `notes`/`resolution` to keep the shape identical to JSON.
  return data.map(t => {
    const out = {
      id: t.id,
      title: t.title,
      question: t.question,
      status: t.status
    };
    if (t.resolution !== null) out.resolution = t.resolution;
    if (t.notes !== null) out.notes = t.notes;
    return out;
  });
}

// Orders / updates / projects — empty at launch, but we still surface
// them as empty arrays so downstream filters / map calls Just Work.
async function loadOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, status, total_cents, notes, placed_at, fulfilled_at, line_items")
    .order("placed_at", { ascending: false });
  if (error) { console.error("loadOrders:", error); return null; }
  return data.map(o => ({
    id: o.id,
    customerName: o.customer_name,
    status: o.status,
    totalCents: o.total_cents,
    notes: o.notes,
    placedAt: o.placed_at,
    fulfilledAt: o.fulfilled_at,
    lineItems: o.line_items
  }));
}

async function loadUpdates() {
  const { data, error } = await supabase
    .from("updates")
    .select("id, title, body, status, author_email, created_at, updated_at, published_at")
    .order("created_at", { ascending: false });
  if (error) { console.error("loadUpdates:", error); return null; }
  return data.map(u => ({
    id: u.id,
    title: u.title,
    body: u.body,
    status: u.status,
    authorEmail: u.author_email,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    publishedAt: u.published_at
  }));
}

async function loadProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, description, status, owner_email, started_at, target_date, completed_at, notes, created_at")
    .order("created_at", { ascending: false });
  if (error) { console.error("loadProjects:", error); return null; }
  return data.map(p => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    ownerEmail: p.owner_email,
    startedAt: p.started_at,
    targetDate: p.target_date,
    completedAt: p.completed_at,
    notes: p.notes,
    createdAt: p.created_at
  }));
}

