import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";

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
// Keys exposed (growing over batches):
//   Batch 1 — suppliers, machines, trailers, feeds, spaces
//   Batch 2 — livestock ({species}), feedSchedules, chores ({definitions})
//
// Later batches will add keys to INITIAL / the final return without
// touching App.jsx again.
const INITIAL = {
  suppliers: null,
  machines: null,
  trailers: null,
  feeds: null,
  spaces: null,
  livestock: null,
  feedSchedules: null,
  chores: null
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
    loadSpaces().then(v => !cancelled && setState(s => ({ ...s, spaces: v })));
    loadLivestock().then(v => !cancelled && setState(s => ({ ...s, livestock: v })));
    loadFeedSchedules().then(v => !cancelled && setState(s => ({ ...s, feedSchedules: v })));
    loadChores().then(v => !cancelled && setState(s => ({ ...s, chores: v })));
    return () => { cancelled = true; };
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

// Two tables, one UI shape: { kinds: [...], items: [...] }.
async function loadSpaces() {
  const [kinds, items] = await Promise.all([
    supabase
      .from("space_kinds")
      .select("id, label, description, movement_method, used_by")
      .order("label"),
    supabase
      .from("space_items")
      .select("id, label, kind_id, current_residents, notes")
      .order("label")
  ]);
  if (kinds.error) { console.error("loadSpaces:kinds", kinds.error); return null; }
  if (items.error) { console.error("loadSpaces:items", items.error); return null; }
  return {
    kinds: kinds.data.map(k => ({
      id: k.id,
      label: k.label,
      description: k.description,
      movementMethod: k.movement_method,
      usedBy: k.used_by
    })),
    items: items.data.map(i => ({
      id: i.id,
      label: i.label,
      kindId: i.kind_id,
      currentResidents: i.current_residents,
      notes: i.notes
    }))
  };
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
      .select("id, species_id, label, ordinal, count, arrival_date, known_age, current_location, cohabits")
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
      currentLocation: g.current_location,
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
    .select("id, title, category, description, frequency, period, start_time, deadline, assignment, tags")
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
      tags: c.tags
    })),
    completions: [],
    modelNotes: []
  };
}
