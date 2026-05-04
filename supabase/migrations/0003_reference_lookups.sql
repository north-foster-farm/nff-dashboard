-- ============================================================================
-- 0003_reference_lookups.sql
-- ============================================================================
-- First slice of the nff-data.json → Postgres migration. Covers the flat
-- reference tables — catalog data that everything else points at but that
-- rarely changes in its own right:
--
--   suppliers, machines, trailers, feed_types, space_kinds, space_items
--
-- Seeds are embedded via `jsonb_to_recordset` — compact, re-runnable, and
-- obviously matches what the frontend JSON contained on the day of
-- migration. Upserts via `on conflict` so re-running the migration is
-- idempotent and won't clobber any future hand edits (except on the
-- seeded columns themselves, which is the whole point).
--
-- RLS: admin-only read and write. Editing UIs for these entities don't
-- exist yet, but the write policies are in place so a future admin form
-- can just call .insert() / .update() / .delete() without further SQL.
--
-- Apply: paste into Supabase → SQL Editor → Run.
-- ============================================================================


-- ── suppliers ───────────────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id text primary key,
  label text not null,
  category text,
  supplies jsonb not null default '[]'::jsonb,
  notes text
);

alter table public.suppliers enable row level security;

drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── machines ────────────────────────────────────────────────────────────────
create table if not exists public.machines (
  id text primary key,
  label text not null,
  category text,
  manufacturer text,
  model text,
  uses jsonb not null default '[]'::jsonb,
  notes text
);

alter table public.machines enable row level security;

drop policy if exists machines_read on public.machines;
create policy machines_read on public.machines
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists machines_write on public.machines;
create policy machines_write on public.machines
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── trailers ────────────────────────────────────────────────────────────────
create table if not exists public.trailers (
  id text primary key,
  label text not null,
  category text,
  uses jsonb not null default '[]'::jsonb,
  notes text
);

alter table public.trailers enable row level security;

drop policy if exists trailers_read on public.trailers;
create policy trailers_read on public.trailers
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists trailers_write on public.trailers;
create policy trailers_write on public.trailers
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── feed_types ──────────────────────────────────────────────────────────────
-- Named `feed_types` on the DB side (clearer than the JSON's "feeds") but
-- the hook layer will expose it back to the UI under the `feeds` key to
-- match the existing component contracts. Rename the DB column later if
-- we ever want to fully unify; low priority.
create table if not exists public.feed_types (
  id text primary key,
  name text not null,
  description text,
  supplier_id text references public.suppliers(id) on delete set null,
  unit text,
  package_size jsonb,
  cost_per_unit jsonb,
  reorder_point jsonb,
  reorder_quantity jsonb,
  lead_time_days integer,
  notes text
);

alter table public.feed_types enable row level security;

drop policy if exists feed_types_read on public.feed_types;
create policy feed_types_read on public.feed_types
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists feed_types_write on public.feed_types;
create policy feed_types_write on public.feed_types
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── spaces: kinds + items ───────────────────────────────────────────────────
create table if not exists public.space_kinds (
  id text primary key,
  label text not null,
  description text,
  movement_method text,
  used_by text
);

alter table public.space_kinds enable row level security;

drop policy if exists space_kinds_read on public.space_kinds;
create policy space_kinds_read on public.space_kinds
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists space_kinds_write on public.space_kinds;
create policy space_kinds_write on public.space_kinds
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create table if not exists public.space_items (
  id text primary key,
  label text not null,
  kind_id text references public.space_kinds(id) on delete restrict,
  current_residents text,
  notes text
);

alter table public.space_items enable row level security;

drop policy if exists space_items_read on public.space_items;
create policy space_items_read on public.space_items
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists space_items_write on public.space_items;
create policy space_items_write on public.space_items
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ============================================================================
-- Seed data — lifted verbatim from src/data/nff-data.json as of 2026-05-01.
-- Uses `jsonb_to_recordset` to expand a single JSON literal into tabular
-- form, then upserts with `on conflict do update`.
-- ============================================================================

insert into public.suppliers (id, label, category, supplies, notes)
select id, label, category, supplies, notes
from jsonb_to_recordset($seed$
[
  {"id": "supplier_pullet_sources", "label": "Pullet sources (preferred)", "category": "pullet_source",
   "supplies": ["pullets — juvenile female layers"],
   "notes": "Names, contacts, and terms TBD."},
  {"id": "supplier_chick_hatchery", "label": "Broiler chick hatchery", "category": "hatchery",
   "supplies": ["day-old broiler chicks (Cornish Cross, straight run)"],
   "notes": "Specific hatchery TBD."},
  {"id": "supplier_feed_mill", "label": "Feed mill", "category": "feed_supplier",
   "supplies": ["broiler starter", "broiler grower", "broiler finisher", "layer feed"],
   "notes": "Specific mill TBD."},
  {"id": "supplier_hay", "label": "Hay supplier", "category": "hay_supplier",
   "supplies": ["sheep hay"],
   "notes": "Specific supplier TBD."}
]
$seed$::jsonb) as x(id text, label text, category text, supplies jsonb, notes text)
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  supplies = excluded.supplies,
  notes = excluded.notes;


insert into public.machines (id, label, category, manufacturer, model, uses, notes)
select id, label, category, manufacturer, model, uses, notes
from jsonb_to_recordset($seed$
[
  {"id": "kubota_tractor", "label": "Tractor", "category": "agricultural_tractor",
   "manufacturer": "Kubota", "model": "TBD",
   "uses": ["Move mobile coops within the layer pasture via drawbar hitch."],
   "notes": "The farm's primary agricultural utility vehicle."},
  {"id": "jd_backhoe", "label": "Backhoe", "category": "backhoe",
   "manufacturer": "John Deere", "model": "TBD", "uses": [], "notes": null},
  {"id": "jd_excavator", "label": "Excavator", "category": "excavator",
   "manufacturer": "John Deere", "model": "TBD", "uses": [], "notes": null}
]
$seed$::jsonb) as x(id text, label text, category text, manufacturer text, model text, uses jsonb, notes text)
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  manufacturer = excluded.manufacturer,
  model = excluded.model,
  uses = excluded.uses,
  notes = excluded.notes;


insert into public.trailers (id, label, category, uses, notes)
select id, label, category, uses, notes
from jsonb_to_recordset($seed$
[
  {"id": "flatbed_trailer", "label": "Flatbed trailer", "category": "flatbed",
   "uses": ["Transport broiler crates to Pat's Pastured on processing days."],
   "notes": null}
]
$seed$::jsonb) as x(id text, label text, category text, uses jsonb, notes text)
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  uses = excluded.uses,
  notes = excluded.notes;


-- feed_types must come after suppliers because of the FK on supplier_id.
insert into public.feed_types (
  id, name, description, supplier_id, unit,
  package_size, cost_per_unit, reorder_point, reorder_quantity,
  lead_time_days, notes
)
select id, name, description, supplier_id, unit,
       package_size, cost_per_unit, reorder_point, reorder_quantity,
       lead_time_days, notes
from jsonb_to_recordset($seed$
[
  {"id": "broiler_starter", "name": "Broiler starter",
   "description": "High-protein crumbles for chicks weeks 1–3.",
   "supplier_id": "supplier_feed_mill", "unit": "lb",
   "package_size": {"amount": 50, "unit": "lb", "label": "50-lb bag"},
   "cost_per_unit": {"amount": 0.55, "currency": "USD", "unit": "lb"},
   "reorder_point": {"amount": 100, "unit": "lb"},
   "reorder_quantity": {"amount": 500, "unit": "lb"},
   "lead_time_days": 7, "notes": "Costs illustrative — see thread_feed_specifics."},
  {"id": "broiler_grower", "name": "Broiler grower",
   "description": "Medium-protein pellets for weeks 3–4.",
   "supplier_id": "supplier_feed_mill", "unit": "lb",
   "package_size": {"amount": 50, "unit": "lb", "label": "50-lb bag"},
   "cost_per_unit": {"amount": 0.50, "currency": "USD", "unit": "lb"},
   "reorder_point": {"amount": 200, "unit": "lb"},
   "reorder_quantity": {"amount": 1500, "unit": "lb"},
   "lead_time_days": 7, "notes": "Illustrative figures."},
  {"id": "broiler_finisher", "name": "Broiler finisher",
   "description": "Lower-protein pellets for weeks 5–7 leading into processing.",
   "supplier_id": "supplier_feed_mill", "unit": "lb",
   "package_size": {"amount": 50, "unit": "lb", "label": "50-lb bag"},
   "cost_per_unit": {"amount": 0.48, "currency": "USD", "unit": "lb"},
   "reorder_point": {"amount": 200, "unit": "lb"},
   "reorder_quantity": {"amount": 1500, "unit": "lb"},
   "lead_time_days": 7, "notes": "Illustrative figures."},
  {"id": "layer_feed", "name": "Layer feed",
   "description": "Layer pellets, supplemented with grit and oyster shell.",
   "supplier_id": "supplier_feed_mill", "unit": "lb",
   "package_size": {"amount": 50, "unit": "lb", "label": "50-lb bag"},
   "cost_per_unit": {"amount": 0.45, "currency": "USD", "unit": "lb"},
   "reorder_point": {"amount": 100, "unit": "lb"},
   "reorder_quantity": {"amount": 500, "unit": "lb"},
   "lead_time_days": 7, "notes": "Illustrative figures."},
  {"id": "sheep_hay", "name": "Sheep hay",
   "description": "Square bales of grass hay for the sheep trio.",
   "supplier_id": "supplier_hay", "unit": "bale",
   "package_size": {"amount": 1, "unit": "bale", "label": "Square bale (~40 lb, ~10 flakes)"},
   "cost_per_unit": {"amount": 5.00, "currency": "USD", "unit": "bale"},
   "reorder_point": {"amount": 5, "unit": "bale"},
   "reorder_quantity": {"amount": 20, "unit": "bale"},
   "lead_time_days": 5, "notes": "Illustrative figures."}
]
$seed$::jsonb) as x(
  id text, name text, description text, supplier_id text, unit text,
  package_size jsonb, cost_per_unit jsonb, reorder_point jsonb, reorder_quantity jsonb,
  lead_time_days integer, notes text
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  supplier_id = excluded.supplier_id,
  unit = excluded.unit,
  package_size = excluded.package_size,
  cost_per_unit = excluded.cost_per_unit,
  reorder_point = excluded.reorder_point,
  reorder_quantity = excluded.reorder_quantity,
  lead_time_days = excluded.lead_time_days,
  notes = excluded.notes;


insert into public.space_kinds (id, label, description, movement_method, used_by)
select id, label, description, movement_method, used_by
from jsonb_to_recordset($seed$
[
  {"id": "mobile_coop", "label": "Mobile coop",
   "description": "Wooden chicken coop on running gear, moved on rotation within the layer pasture.",
   "movement_method": "Towed by the tractor via drawbar hitch.",
   "used_by": "layers"},
  {"id": "brooder", "label": "Brooder",
   "description": "Heated enclosure where broiler chicks spend their first 3–4 weeks. Temperature starts at 85°F in week 1 and decreases weekly.",
   "movement_method": null,
   "used_by": "broilers"},
  {"id": "pasture", "label": "Pasture",
   "description": "Outdoor grazing/foraging land. The layer pasture houses mobile coops on rotation; broilers rotate via chicken tractors.",
   "movement_method": null, "used_by": null},
  {"id": "chicken_tractor", "label": "Chicken tractor",
   "description": "Mobile pen with feed, water, and fencing. Houses broilers from brooder graduation through processing. Moved twice daily.",
   "movement_method": null, "used_by": "broilers"}
]
$seed$::jsonb) as x(id text, label text, description text, movement_method text, used_by text)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  movement_method = excluded.movement_method,
  used_by = excluded.used_by;


insert into public.space_items (id, label, kind_id, current_residents, notes)
select id, label, kind_id, current_residents, notes
from jsonb_to_recordset($seed$
[
  {"id": "mc1", "label": "MC1", "kind_id": "mobile_coop",
   "current_residents": "Gold bands",
   "notes": "Houses the newest layer generation; kept separate."},
  {"id": "mc2", "label": "MC2", "kind_id": "mobile_coop",
   "current_residents": "No bands, blue bands, and orange bands (cohabit)",
   "notes": null},
  {"id": "b1", "label": "B1", "kind_id": "brooder",
   "current_residents": null, "notes": "Specs TBD."},
  {"id": "b2", "label": "B2", "kind_id": "brooder",
   "current_residents": null, "notes": "Specs TBD."},
  {"id": "layer_pasture", "label": "Layer pasture", "kind_id": "pasture",
   "current_residents": "Mobile coops MC1 and MC2 rotate through this pasture.",
   "notes": "Dimensions and satellite-image boundary pending."}
]
$seed$::jsonb) as x(id text, label text, kind_id text, current_residents text, notes text)
on conflict (id) do update set
  label = excluded.label,
  kind_id = excluded.kind_id,
  current_residents = excluded.current_residents,
  notes = excluded.notes;
