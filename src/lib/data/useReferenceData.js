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
// Keys exposed (Batch 1):
//   - suppliers   (array)
//   - machines    (array)
//   - trailers    (array)
//   - feeds       (array; DB table is `feed_types`)
//   - spaces      ({ kinds, items })
//
// Later batches will add keys to INITIAL / the final return without
// touching App.jsx again.
const INITIAL = {
  suppliers: null,
  machines: null,
  trailers: null,
  feeds: null,
  spaces: null
};

export function useReferenceData() {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    // Fire all six queries in parallel — they're small and unrelated.
    // Promise.all would fail the whole batch if any one query errors; we
    // want per-slice resilience so each promise sets its own key.
    loadSuppliers().then(v => !cancelled && setState(s => ({ ...s, suppliers: v })));
    loadMachines().then(v => !cancelled && setState(s => ({ ...s, machines: v })));
    loadTrailers().then(v => !cancelled && setState(s => ({ ...s, trailers: v })));
    loadFeeds().then(v => !cancelled && setState(s => ({ ...s, feeds: v })));
    loadSpaces().then(v => !cancelled && setState(s => ({ ...s, spaces: v })));
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
