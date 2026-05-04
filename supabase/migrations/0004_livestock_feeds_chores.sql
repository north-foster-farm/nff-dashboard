-- ============================================================================
-- 0004_livestock_feeds_chores.sql
-- ============================================================================
-- Second slice of the reference-data migration. Covers the operational
-- backbone — the things the daily dashboard depends on most:
--
--   livestock_species       — layers, broilers, sheep
--   livestock_groups        — banded cohorts / batches / individuals, FK species
--   feed_schedules          — per-species feeding plans
--   feed_schedule_stages    — the week-by-week stages inside a schedule
--   chore_definitions       — the full CHORE_SEEDS list from choreSeeds.js
--
-- All five tables are admin-only (RLS) with full read+write policies. The
-- chore_definitions seed is generated from choreSeeds.js via
-- scripts/gen-batch2-seed.mjs — edit the JS source, re-run the generator,
-- re-apply the migration, and the DB catches up.
--
-- Apply: paste into Supabase → SQL Editor → Run.
-- ============================================================================


-- ── livestock_species ───────────────────────────────────────────────────────
-- Top of the livestock hierarchy. Fields that vary per species (lifecycle,
-- constraints, feedRegimen, etc.) are stored as jsonb so we don't end up
-- with 15 nullable columns that only apply to broilers.
create table if not exists public.livestock_species (
  id text primary key,
  name text not null,
  purpose text,
  breed text,
  tracking_model text,
  acquisition text,
  processing_timeline text,
  brooder_to_tractor_transition text,
  feed_regimen jsonb,
  feed_note text,
  lifecycle jsonb,
  constraints jsonb,
  feed_tracking text,
  ordinal integer
);

alter table public.livestock_species enable row level security;

drop policy if exists livestock_species_read on public.livestock_species;
create policy livestock_species_read on public.livestock_species
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists livestock_species_write on public.livestock_species;
create policy livestock_species_write on public.livestock_species
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── livestock_groups ────────────────────────────────────────────────────────
-- Cohorts inside a species — "Orange bands", "Batch 1", "Lily, Ivy, Violet".
-- known_age is jsonb because it's polymorphic ({weeks, asOfDate} | null).
create table if not exists public.livestock_groups (
  id text primary key,
  species_id text not null references public.livestock_species(id) on delete cascade,
  label text not null,
  ordinal integer,
  count integer,
  arrival_date date,
  known_age jsonb,
  current_location text,
  cohabits text
);

create index if not exists livestock_groups_species_idx
  on public.livestock_groups (species_id);

alter table public.livestock_groups enable row level security;

drop policy if exists livestock_groups_read on public.livestock_groups;
create policy livestock_groups_read on public.livestock_groups
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists livestock_groups_write on public.livestock_groups;
create policy livestock_groups_write on public.livestock_groups
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── feed_schedules + feed_schedule_stages ──────────────────────────────────
-- A schedule is a named feeding plan for a species; stages are its ordered
-- steps (starter → grower → finisher for broilers, "ongoing" for layers).
-- assigned_group_ids is jsonb because it's an array reference to
-- livestock_groups.id — no FK table because we want to move groups between
-- schedules freely without DB-level cascades. UI enforces validity.
create table if not exists public.feed_schedules (
  id text primary key,
  name text not null,
  species_id text references public.livestock_species(id) on delete set null,
  description text,
  cycle_anchor_label text,
  assigned_group_ids jsonb not null default '[]'::jsonb
);

alter table public.feed_schedules enable row level security;

drop policy if exists feed_schedules_read on public.feed_schedules;
create policy feed_schedules_read on public.feed_schedules
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists feed_schedules_write on public.feed_schedules;
create policy feed_schedules_write on public.feed_schedules
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create table if not exists public.feed_schedule_stages (
  id text primary key,
  schedule_id text not null references public.feed_schedules(id) on delete cascade,
  name text not null,
  start_day integer,
  end_day integer,
  feed_type_id text references public.feed_types(id) on delete set null,
  consumption jsonb,
  notes text,
  ordinal integer not null
);

create index if not exists feed_schedule_stages_schedule_idx
  on public.feed_schedule_stages (schedule_id, ordinal);

alter table public.feed_schedule_stages enable row level security;

drop policy if exists feed_schedule_stages_read on public.feed_schedule_stages;
create policy feed_schedule_stages_read on public.feed_schedule_stages
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists feed_schedule_stages_write on public.feed_schedule_stages;
create policy feed_schedule_stages_write on public.feed_schedule_stages
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── chore_definitions ──────────────────────────────────────────────────────
-- One row per chore in CHORE_SEEDS. frequency / deadline / assignment /
-- tags are all jsonb because each is a small discriminated-union / array.
-- start_time is text (HH:MM) for simplicity; not a true TIME column because
-- sunrise/sunset-anchored times don't map cleanly.
create table if not exists public.chore_definitions (
  id text primary key,
  title text not null,
  category text not null,
  description text,
  frequency jsonb not null,
  period text,
  start_time text,
  deadline jsonb,
  assignment jsonb,
  tags jsonb not null default '[]'::jsonb
);

create index if not exists chore_definitions_category_idx
  on public.chore_definitions (category);

alter table public.chore_definitions enable row level security;

drop policy if exists chore_definitions_read on public.chore_definitions;
create policy chore_definitions_read on public.chore_definitions
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists chore_definitions_write on public.chore_definitions;
create policy chore_definitions_write on public.chore_definitions
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ============================================================================
-- Seed data — extracted from src/data/nff-data.json and src/data/choreSeeds.js
-- as of 2026-05-01. See scripts/gen-batch2-seed.mjs for the chore block.
-- ============================================================================

-- ── livestock_species ──────────────────────────────────────────────────────
insert into public.livestock_species (
  id, name, purpose, breed, tracking_model, acquisition, processing_timeline,
  brooder_to_tractor_transition, feed_regimen, feed_note, lifecycle,
  constraints, feed_tracking, ordinal
)
select id, name, purpose, breed, tracking_model, acquisition, processing_timeline,
       brooder_to_tractor_transition, feed_regimen, feed_note, lifecycle,
       constraints, feed_tracking, ordinal
from jsonb_to_recordset($seed$
[
  {
    "id": "layers", "name": "Layers", "purpose": "Egg production",
    "breed": "Red Sex Link", "tracking_model": "generation",
    "acquisition": "Acquired as pullets, sourced from a small set of preferred individual suppliers.",
    "processing_timeline": null, "brooder_to_tractor_transition": null,
    "feed_regimen": ["layer feed", "grit", "calcium"],
    "feed_note": "All generations of layers eat the same feed, grit, and calcium.",
    "lifecycle": null, "constraints": null, "feed_tracking": null, "ordinal": 1
  },
  {
    "id": "broilers", "name": "Broilers", "purpose": "Meat",
    "breed": "Cornish Cross (straight run)", "tracking_model": "batch",
    "acquisition": "Day-old chicks shipped via USPS; shipped the same day they hatch.",
    "processing_timeline": "5–7 weeks from arrival on farm",
    "brooder_to_tractor_transition": "All birds are crated and carried from the brooder to the chicken tractors.",
    "feed_regimen": null, "feed_note": null,
    "lifecycle": [
      {"stage": "Brooder", "duration": "Weeks 1–3 (sometimes 4)",
       "graduationCriteria": "Birds must be fully feathered (typically around 3 weeks).",
       "notes": "Brooder temperature starts at 85°F in week 1 and decreases each successive week."},
      {"stage": "Pasture (chicken tractors)", "duration": "From brooder graduation through processing day",
       "notes": "Chicken tractors are mobile pens with feed, water, and fencing. Moved twice daily."}
    ],
    "constraints": [
      "Pasture-raised classification requires 51% of the bird's natural life spent on pasture. App computes this as a soft KPI per batch.",
      "Temperatures below 50°F (day or night) are considered too cold for the birds."
    ],
    "feed_tracking": "Feed amount changes week to week; total batch feed consumption must be tracked.",
    "ordinal": 2
  },
  {
    "id": "sheep", "name": "Sheep", "purpose": "Pets — no production",
    "breed": "Katahdin", "tracking_model": "individual",
    "acquisition": "TBD",
    "processing_timeline": null, "brooder_to_tractor_transition": null,
    "feed_regimen": ["hay"],
    "feed_note": "Sheep receive flakes of hay; the chore 'give sheep a flake of hay' captures the regular feeding.",
    "lifecycle": null, "constraints": null, "feed_tracking": null, "ordinal": 3
  }
]
$seed$::jsonb) as x(
  id text, name text, purpose text, breed text, tracking_model text,
  acquisition text, processing_timeline text, brooder_to_tractor_transition text,
  feed_regimen jsonb, feed_note text, lifecycle jsonb, constraints jsonb,
  feed_tracking text, ordinal integer
)
on conflict (id) do update set
  name = excluded.name,
  purpose = excluded.purpose,
  breed = excluded.breed,
  tracking_model = excluded.tracking_model,
  acquisition = excluded.acquisition,
  processing_timeline = excluded.processing_timeline,
  brooder_to_tractor_transition = excluded.brooder_to_tractor_transition,
  feed_regimen = excluded.feed_regimen,
  feed_note = excluded.feed_note,
  lifecycle = excluded.lifecycle,
  constraints = excluded.constraints,
  feed_tracking = excluded.feed_tracking,
  ordinal = excluded.ordinal;


-- ── livestock_groups ───────────────────────────────────────────────────────
insert into public.livestock_groups (
  id, species_id, label, ordinal, count, arrival_date, known_age,
  current_location, cohabits
)
select id, species_id, label, ordinal, count, arrival_date, known_age,
       current_location, cohabits
from jsonb_to_recordset($seed$
[
  {"id": "layers_no_band", "species_id": "layers", "label": "No bands", "ordinal": 1,
   "count": null, "arrival_date": null, "known_age": null,
   "current_location": "MC2", "cohabits": "Shares MC2 with blue bands and orange bands."},
  {"id": "layers_blue_band", "species_id": "layers", "label": "Blue bands", "ordinal": 2,
   "count": null, "arrival_date": null, "known_age": null,
   "current_location": "MC2", "cohabits": "Shares MC2 with no bands and orange bands."},
  {"id": "layers_orange_band", "species_id": "layers", "label": "Orange bands", "ordinal": 3,
   "count": null, "arrival_date": "2025-10-14", "known_age": null,
   "current_location": "MC2", "cohabits": "Shares MC2 with no bands and blue bands."},
  {"id": "layers_gold_band", "species_id": "layers", "label": "Gold bands", "ordinal": 4,
   "count": 200, "arrival_date": "2026-04-01",
   "known_age": {"weeks": 16, "asOfDate": "2026-05-03"},
   "current_location": "MC1",
   "cohabits": "Kept separate. Future generations will also be kept separate from older generations."},
  {"id": "broilers_batch_1", "species_id": "broilers", "label": "Batch 1", "ordinal": 1,
   "count": 275, "arrival_date": null, "known_age": null,
   "current_location": null, "cohabits": null},
  {"id": "broilers_batch_2", "species_id": "broilers", "label": "Batch 2", "ordinal": 2,
   "count": 275, "arrival_date": null, "known_age": null,
   "current_location": null, "cohabits": null},
  {"id": "sheep_pets", "species_id": "sheep", "label": "Lily, Ivy, and Violet", "ordinal": null,
   "count": null, "arrival_date": null, "known_age": null,
   "current_location": null, "cohabits": null}
]
$seed$::jsonb) as x(
  id text, species_id text, label text, ordinal integer, count integer,
  arrival_date date, known_age jsonb, current_location text, cohabits text
)
on conflict (id) do update set
  species_id = excluded.species_id,
  label = excluded.label,
  ordinal = excluded.ordinal,
  count = excluded.count,
  arrival_date = excluded.arrival_date,
  known_age = excluded.known_age,
  current_location = excluded.current_location,
  cohabits = excluded.cohabits;


-- ── feed_schedules ─────────────────────────────────────────────────────────
insert into public.feed_schedules (
  id, name, species_id, description, cycle_anchor_label, assigned_group_ids
)
select id, name, species_id, description, cycle_anchor_label, assigned_group_ids
from jsonb_to_recordset($seed$
[
  {"id": "broiler_standard", "name": "Standard broiler schedule", "species_id": "broilers",
   "description": "Day-old chick to processing day, 5–7 weeks total. Anchored to batch arrival.",
   "cycle_anchor_label": "Days from arrival",
   "assigned_group_ids": ["broilers_batch_1", "broilers_batch_2"]},
  {"id": "layer_standard", "name": "Standard layer feed", "species_id": "layers",
   "description": "Layer feed available free choice. Grit and oyster shell supplemented separately.",
   "cycle_anchor_label": "Ongoing",
   "assigned_group_ids": ["layers_no_band", "layers_blue_band", "layers_orange_band", "layers_gold_band"]},
  {"id": "sheep_hay_regimen", "name": "Sheep hay regimen", "species_id": "sheep",
   "description": "One flake of hay daily for the trio.",
   "cycle_anchor_label": "Ongoing",
   "assigned_group_ids": ["sheep_pets"]}
]
$seed$::jsonb) as x(
  id text, name text, species_id text, description text,
  cycle_anchor_label text, assigned_group_ids jsonb
)
on conflict (id) do update set
  name = excluded.name,
  species_id = excluded.species_id,
  description = excluded.description,
  cycle_anchor_label = excluded.cycle_anchor_label,
  assigned_group_ids = excluded.assigned_group_ids;


-- ── feed_schedule_stages ───────────────────────────────────────────────────
insert into public.feed_schedule_stages (
  id, schedule_id, name, start_day, end_day, feed_type_id, consumption, notes, ordinal
)
select id, schedule_id, name, start_day, end_day, feed_type_id, consumption, notes, ordinal
from jsonb_to_recordset($seed$
[
  {"id": "stage_starter", "schedule_id": "broiler_standard", "ordinal": 1,
   "name": "Starter (free choice)", "start_day": 0, "end_day": 14,
   "feed_type_id": "broiler_starter",
   "consumption": {"type": "free_choice"},
   "notes": "Chicks have unlimited access for the first two weeks."},
  {"id": "stage_grower_w3", "schedule_id": "broiler_standard", "ordinal": 2,
   "name": "Week 3", "start_day": 14, "end_day": 21,
   "feed_type_id": "broiler_grower",
   "consumption": {"type": "metered", "amount": 100, "unit": "lb", "per": "day", "basis": "batch"},
   "notes": "100 lb/day for a batch of 275 birds."},
  {"id": "stage_grower_w4", "schedule_id": "broiler_standard", "ordinal": 3,
   "name": "Week 4", "start_day": 21, "end_day": 28,
   "feed_type_id": "broiler_grower",
   "consumption": {"type": "metered", "amount": 75, "unit": "lb", "per": "day", "basis": "batch"},
   "notes": "75 lb/day. Decreasing pattern unusual — see thread_broiler_feed_pattern."},
  {"id": "stage_finisher", "schedule_id": "broiler_standard", "ordinal": 4,
   "name": "Weeks 5–7 (TBD)", "start_day": 28, "end_day": 49,
   "feed_type_id": "broiler_finisher",
   "consumption": {"type": "tbd"},
   "notes": "Specific amounts not yet captured."},
  {"id": "stage_layer_main", "schedule_id": "layer_standard", "ordinal": 1,
   "name": "Layer feed (ongoing)", "start_day": 0, "end_day": null,
   "feed_type_id": "layer_feed",
   "consumption": {"type": "free_choice"},
   "notes": "Free choice; grit and calcium also provided."},
  {"id": "stage_sheep_hay", "schedule_id": "sheep_hay_regimen", "ordinal": 1,
   "name": "Daily flake", "start_day": 0, "end_day": null,
   "feed_type_id": "sheep_hay",
   "consumption": {"type": "metered", "amount": 1, "unit": "flake", "per": "day", "basis": "group"},
   "notes": "One flake (~4 lb) for the trio per day."}
]
$seed$::jsonb) as x(
  id text, schedule_id text, name text, start_day integer, end_day integer,
  feed_type_id text, consumption jsonb, notes text, ordinal integer
)
on conflict (id) do update set
  schedule_id = excluded.schedule_id,
  name = excluded.name,
  start_day = excluded.start_day,
  end_day = excluded.end_day,
  feed_type_id = excluded.feed_type_id,
  consumption = excluded.consumption,
  notes = excluded.notes,
  ordinal = excluded.ordinal;


-- ── chore_definitions seed ─────────────────────────────────────────────────
-- This block is appended by scripts/gen-batch2-seed.mjs (concatenated into
-- the migration file at generation time). See the bottom of this file.
insert into public.chore_definitions (
  id, title, category, description, frequency, period, start_time, deadline, assignment, tags
)
select id, title, category, description, frequency, period, start_time, deadline, assignment, tags
from jsonb_to_recordset($seed$
[
  {
    "id": "mc_open_am",
    "title": "Open coops",
    "category": "mobile_coops",
    "description": "Open the doors of the mobile coops to release layers for the day.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_dump_feed_am",
    "title": "Dump leftover feed",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_fill_feeders_am",
    "title": "Fill feeders",
    "category": "mobile_coops",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "feed"
    ]
  },
  {
    "id": "mc_fill_water_am",
    "title": "Fill waterers / water reservoir",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_collect_eggs_am",
    "title": "Collect eggs",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "mc_log_obs_am",
    "title": "Log mortalities and observations",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "sheep_feed_am",
    "title": "Feed — 1 flake of hay",
    "category": "sheep",
    "description": "Currently 1 flake of hay in the morning. See feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "sheep",
      "feed"
    ]
  },
  {
    "id": "sheep_water_am",
    "title": "Check / fill waterer",
    "category": "sheep",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "sheep"
    ]
  },
  {
    "id": "ct_move_am",
    "title": "Move to fresh grass",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "pasture"
    ]
  },
  {
    "id": "ct_dump_feed_am",
    "title": "Dump leftover feed",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_fill_feeders_am",
    "title": "Fill feeders",
    "category": "chicken_tractors",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "feed"
    ]
  },
  {
    "id": "ct_dump_waterers_am",
    "title": "Dump / rinse waterers",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_fill_water_am",
    "title": "Fill water reservoir",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_log_obs_am",
    "title": "Log mortalities and observations",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "data-capture"
    ]
  },
  {
    "id": "brooder_dump_feed_am",
    "title": "Dump leftover feed",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "brooder_fill_feeders_am",
    "title": "Fill feeders",
    "category": "brooders",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "feed"
    ]
  },
  {
    "id": "brooder_dump_waterers_am",
    "title": "Dump / rinse waterers",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "brooder_fill_water_am",
    "title": "Fill water reservoir",
    "category": "brooders",
    "description": "If chicks are 10 days or younger, fill with 95°F water.",
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder"
    ]
  },
  {
    "id": "brooder_check_bedding_am",
    "title": "Check bedding",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder"
    ]
  },
  {
    "id": "brooder_log_temp_am",
    "title": "Log temperature, mortalities, and observations",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "morning",
    "start_time": "08:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder",
      "data-capture"
    ]
  },
  {
    "id": "mc_dump_feed_pm",
    "title": "Dump leftover feed",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_fill_feeders_pm",
    "title": "Fill feeders",
    "category": "mobile_coops",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "feed"
    ]
  },
  {
    "id": "mc_fill_water_pm",
    "title": "Fill waterers / water reservoir",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_collect_eggs_pm",
    "title": "Collect eggs",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "mc_raise_perches_pm",
    "title": "Raise perches",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_log_obs_pm",
    "title": "Log mortalities and observations",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "sheep_feed_pm",
    "title": "Feed — half scoop of grain",
    "category": "sheep",
    "description": "Currently a half scoop of grain in the afternoon. See feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "sheep",
      "feed"
    ]
  },
  {
    "id": "sheep_water_pm",
    "title": "Check / fill waterer",
    "category": "sheep",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "sheep"
    ]
  },
  {
    "id": "ct_move_pm",
    "title": "Move to fresh grass",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "pasture"
    ]
  },
  {
    "id": "ct_dump_feed_pm",
    "title": "Dump leftover feed",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_fill_feeders_pm",
    "title": "Fill feeders",
    "category": "chicken_tractors",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "feed"
    ]
  },
  {
    "id": "ct_dump_waterers_pm",
    "title": "Dump / rinse waterers",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_fill_water_pm",
    "title": "Fill water reservoir",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_log_obs_pm",
    "title": "Log mortalities and observations",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "data-capture"
    ]
  },
  {
    "id": "brooder_dump_feed_pm",
    "title": "Dump leftover feed",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "brooder_fill_feeders_pm",
    "title": "Fill feeders",
    "category": "brooders",
    "description": "Amount per feed schedule.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "feed"
    ]
  },
  {
    "id": "brooder_dump_waterers_pm",
    "title": "Dump / rinse waterers",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "brooder_fill_water_pm",
    "title": "Fill water reservoir",
    "category": "brooders",
    "description": "If chicks are 10 days or younger, fill with 95°F water.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder"
    ]
  },
  {
    "id": "brooder_check_bedding_pm",
    "title": "Check bedding",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder"
    ]
  },
  {
    "id": "brooder_log_temp_pm",
    "title": "Log temperature, mortalities, and observations",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder",
      "data-capture"
    ]
  },
  {
    "id": "wash_eggs_pm",
    "title": "Wash eggs collected during the day",
    "category": "wash_eggs",
    "description": "Wash all eggs collected during the day, leave out to dry.",
    "frequency": {
      "type": "daily"
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "offset_hours",
      "hours": 2
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_close_eve",
    "title": "Close coops",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_lower_perches_eve",
    "title": "Lower perches",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "mc_log_obs_eve",
    "title": "Log mortalities and observations",
    "category": "mobile_coops",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "sheep_water_eve",
    "title": "Check / fill waterer",
    "category": "sheep",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "sheep"
    ]
  },
  {
    "id": "ct_move_eve",
    "title": "Move to fresh grass",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "broilers",
      "pasture"
    ]
  },
  {
    "id": "ct_check_water_eve",
    "title": "Check / fill water reservoir",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "broilers"
    ]
  },
  {
    "id": "ct_log_obs_eve",
    "title": "Log mortalities and observations",
    "category": "chicken_tractors",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "broilers",
      "data-capture"
    ]
  },
  {
    "id": "brooder_check_water_eve",
    "title": "Check / fill water reservoir",
    "category": "brooders",
    "description": "If chicks are 10 days or younger, fill with 95°F water.",
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder"
    ]
  },
  {
    "id": "brooder_log_temp_eve",
    "title": "Log temperature, mortalities, and observations",
    "category": "brooders",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "broilers",
      "brooder",
      "data-capture"
    ]
  },
  {
    "id": "eggs_pack_eve",
    "title": "Pack eggs into cartons",
    "category": "wash_eggs",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "eggs_refrigerate_eve",
    "title": "Refrigerate eggs",
    "category": "wash_eggs",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers"
    ]
  },
  {
    "id": "eggs_inventory_eve",
    "title": "Add cartons to inventory",
    "category": "wash_eggs",
    "description": null,
    "frequency": {
      "type": "daily"
    },
    "period": "evening",
    "start_time": "20:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers",
      "data-capture"
    ]
  },
  {
    "id": "move_mobile_coops",
    "title": "Move coops",
    "category": "mobile_coops",
    "description": "Relocate mobile coops within the layer pasture using the tractor.",
    "frequency": {
      "type": "specific_days",
      "days": [
        2,
        5
      ]
    },
    "period": "morning",
    "start_time": "09:00",
    "deadline": {
      "type": "end_of_day"
    },
    "assignment": null,
    "tags": [
      "layers",
      "tractor"
    ]
  },
  {
    "id": "weekly_grit",
    "title": "Check / fill grit",
    "category": "mobile_coops",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "layers",
      "weekly"
    ]
  },
  {
    "id": "weekly_oyster_shell",
    "title": "Check / fill oyster shell",
    "category": "mobile_coops",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "layers",
      "weekly"
    ]
  },
  {
    "id": "weekly_sheep_minerals",
    "title": "Check / fill minerals",
    "category": "sheep",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "sheep",
      "weekly"
    ]
  },
  {
    "id": "weekly_clean_nest_grate",
    "title": "Clean dust from nest box grate",
    "category": "mobile_coops",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "layers",
      "weekly"
    ]
  },
  {
    "id": "weekly_powerwash_waterers",
    "title": "Power wash waterers",
    "category": "mobile_coops",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "weekly"
    ]
  },
  {
    "id": "weekly_powerwash_feeders",
    "title": "Power wash feeders",
    "category": "mobile_coops",
    "frequency": {
      "type": "weekly_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_week_friday"
    },
    "assignment": null,
    "tags": [
      "weekly"
    ]
  },
  {
    "id": "monthly_mc_powerwash",
    "title": "Interior power wash",
    "category": "mobile_coops",
    "frequency": {
      "type": "monthly_last_week_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_month_week_friday"
    },
    "assignment": null,
    "tags": [
      "layers",
      "monthly"
    ]
  },
  {
    "id": "monthly_nest_deep_clean",
    "title": "Nest box deep clean",
    "category": "mobile_coops",
    "frequency": {
      "type": "monthly_last_week_window",
      "preferredDay": 1,
      "latestDay": 5
    },
    "period": "afternoon",
    "start_time": "14:00",
    "deadline": {
      "type": "end_of_month_week_friday"
    },
    "assignment": null,
    "tags": [
      "layers",
      "monthly"
    ]
  }
]
$seed$::jsonb) as x(
  id text, title text, category text, description text,
  frequency jsonb, period text, start_time text,
  deadline jsonb, assignment jsonb, tags jsonb
)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  frequency = excluded.frequency,
  period = excluded.period,
  start_time = excluded.start_time,
  deadline = excluded.deadline,
  assignment = excluded.assignment,
  tags = excluded.tags;
