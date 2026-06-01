-- 0009_chores_overhaul_foundation.sql
-- Place model + chores foundation.
--
-- Originally the chores overhaul (Batch 7) introduced a two-level
-- sites / site_locations / site_residents model. Batch 15 (Farm Map)
-- collapses that — plus the legacy space_kinds / space_items (0003) and
-- the free-text livestock_groups.current_location (0004) — into ONE
-- recursive place tree. This migration is amended in place per the
-- pre-production rule; a fresh `supabase db reset` produces the new
-- model directly.
--
--   places          — one recursive tree (parent_id) of every place on
--                     the farm: farm → zones → areas → structures. The
--                     geographic axis is primary; `kind_tag` is the
--                     secondary axis (so Rounds can "sweep all coops").
--                     `mobile` marks coops / tractors / mobile brooders
--                     that get re-parented when they move pasture.
--
--   placements      — polymorphic occupancy edge. occupant_type +
--                     occupant_id point at a livestock_groups cohort
--                     ('batch'), a machines asset ('machine'), … One
--                     open row per occupant (moved_out IS NULL). Move
--                     history is free. Replaces site_residents.
--
--   place_geometry  — binding between a place and the authored farm-map
--                     SVG (svg_layer_id + centroid/footprint). Shape
--                     only here; the SVG itself lands in Batch 18.
--
--   chore_blocks    — named time windows (Morning, Afternoon, …). Each
--                     block has a start (clock time, sunrise, or sunset)
--                     and a duration; end is derived.
--
--   chore_modifiers — date-bound overrides on a chore. Targets a place
--                     (its subtree) or just the chore. Schema ships now
--                     so Processes (Batch 23) can populate it.
--
--   chore_runs      — one row per (block_id, run_date). Used by Rounds.
--
-- Plus chore_definitions gains place_id (the place whose subtree the
-- chore applies to), block_id, last_chance_block_id, sort_order. The
-- legacy `category` / `period` text columns stay; place_id / block_id
-- are backfilled from them.

-- ── places ────────────────────────────────────────────────────────────
-- Recursive tree. parent_id NULL == the farm root. `kind` is the
-- structural level (farm / zone / area / structure); `kind_tag` is the
-- secondary type used for kind-level grouping ('coop', 'tractor',
-- 'brooder', 'pasture', …). `code` is a short human handle (MC1, CT3).
-- `mobile` marks places that move (re-parented on a move).
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.places(id) on delete cascade,
  name text not null,
  kind text not null default 'structure',
  kind_tag text,
  code text,
  mobile boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_parent_idx
  on public.places (parent_id, sort_order, name);
create index if not exists places_kind_tag_idx
  on public.places (kind_tag) where kind_tag is not null;
create index if not exists places_active_idx
  on public.places (is_active) where is_active = true;
create index if not exists places_code_idx
  on public.places (code) where code is not null;

alter table public.places enable row level security;

drop policy if exists places_read on public.places;
create policy places_read on public.places
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists places_write on public.places;
create policy places_write on public.places
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_places_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists places_updated_at on public.places;
create trigger places_updated_at
  before update on public.places
  for each row execute function public.touch_places_updated_at();


-- ── placements ────────────────────────────────────────────────────────
-- Polymorphic occupancy. occupant_type discriminates the occupant table
-- ('batch' -> livestock_groups, 'machine' -> machines, …); occupant_id
-- is the occupant's text id. No FK because it's polymorphic. moved_out
-- IS NULL == currently here; the partial unique index enforces one open
-- row per occupant. Query with moved_out IS NULL for current occupancy.
create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  occupant_type text not null,
  occupant_id text not null,
  moved_in date not null default current_date,
  moved_out date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists placements_place_idx
  on public.placements (place_id, moved_out nulls first);
create index if not exists placements_occupant_idx
  on public.placements (occupant_type, occupant_id, moved_out nulls first);
create unique index if not exists placements_one_open_per_occupant
  on public.placements (occupant_type, occupant_id) where moved_out is null;

alter table public.placements enable row level security;

drop policy if exists placements_read on public.placements;
create policy placements_read on public.placements
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists placements_write on public.placements;
create policy placements_write on public.placements
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_placements_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists placements_updated_at on public.placements;
create trigger placements_updated_at
  before update on public.placements
  for each row execute function public.touch_placements_updated_at();


-- ── place_geometry ────────────────────────────────────────────────────
-- One row per place that maps onto the authored farm-map SVG. Binding
-- shape only — populated when the SVG lands (Batch 18). centroid /
-- footprint are jsonb so the renderer can store whatever it needs
-- (point, bbox, path) without another schema change.
create table if not exists public.place_geometry (
  place_id uuid primary key references public.places(id) on delete cascade,
  svg_layer_id text,
  centroid jsonb,
  footprint jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.place_geometry enable row level security;

drop policy if exists place_geometry_read on public.place_geometry;
create policy place_geometry_read on public.place_geometry
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists place_geometry_write on public.place_geometry;
create policy place_geometry_write on public.place_geometry
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_place_geometry_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists place_geometry_updated_at on public.place_geometry;
create trigger place_geometry_updated_at
  before update on public.place_geometry
  for each row execute function public.touch_place_geometry_updated_at();


-- ── chore_blocks ──────────────────────────────────────────────────────
-- Named time windows. The block has a single start (clock time or
-- sun event) and a duration. End is derived as start + duration at
-- render time. start_minutes is minutes-of-day (0..1439) only
-- meaningful when start_kind = 'fixed'; sunrise / sunset resolve to
-- actual sunrise / sunset for the date at runtime (client-side via
-- suncalc).
create table if not exists public.chore_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_kind text not null default 'fixed'
    check (start_kind in ('fixed', 'sunrise', 'sunset')),
  start_minutes int
    check (start_minutes is null or (start_minutes >= 0 and start_minutes <= 1439)),
  duration_minutes int not null default 120
    check (duration_minutes > 0 and duration_minutes <= 1440),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Fixed kinds need their minutes; sunrise/sunset can leave them null.
  constraint chore_blocks_fixed_needs_minutes check (
    start_kind <> 'fixed' or start_minutes is not null
  )
);

create index if not exists chore_blocks_sort_idx
  on public.chore_blocks (sort_order, start_minutes nulls last);
create index if not exists chore_blocks_active_idx
  on public.chore_blocks (is_active) where is_active = true;

alter table public.chore_blocks enable row level security;

drop policy if exists chore_blocks_read on public.chore_blocks;
create policy chore_blocks_read on public.chore_blocks
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_blocks_write on public.chore_blocks;
create policy chore_blocks_write on public.chore_blocks
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_chore_blocks_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_blocks_updated_at on public.chore_blocks;
create trigger chore_blocks_updated_at
  before update on public.chore_blocks
  for each row execute function public.touch_chore_blocks_updated_at();


-- ── chore_modifiers ───────────────────────────────────────────────────
create table if not exists public.chore_modifiers (
  id uuid primary key default gen_random_uuid(),
  target_chore_id text not null
    references public.chore_definitions(id) on delete cascade,
  -- A modifier can target a place (applies to that place's whole
  -- subtree). Null means the modifier applies wherever the chore lives.
  target_place_id uuid
    references public.places(id) on delete cascade,
  occurs_on date not null,
  action text not null
    check (action in ('skip', 'replace', 'prepend', 'restrict_until')),
  replacement_text text,
  priority int not null default 0,
  source text not null default 'manual',
  expires_at timestamptz,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chore_modifiers_target_idx
  on public.chore_modifiers (target_chore_id, occurs_on);
create index if not exists chore_modifiers_place_idx
  on public.chore_modifiers (target_place_id, occurs_on)
  where target_place_id is not null;

alter table public.chore_modifiers enable row level security;

drop policy if exists chore_modifiers_read on public.chore_modifiers;
create policy chore_modifiers_read on public.chore_modifiers
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_modifiers_write on public.chore_modifiers;
create policy chore_modifiers_write on public.chore_modifiers
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_chore_modifiers_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_modifiers_updated_at on public.chore_modifiers;
create trigger chore_modifiers_updated_at
  before update on public.chore_modifiers
  for each row execute function public.touch_chore_modifiers_updated_at();


-- ── chore_runs ────────────────────────────────────────────────────────
create table if not exists public.chore_runs (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null
    references public.chore_blocks(id) on delete cascade,
  run_date date not null,
  state text not null default 'scheduled'
    check (state in ('scheduled', 'in_progress', 'done', 'canceled')),
  started_at timestamptz,
  ended_at timestamptz,
  started_by_email text,
  ended_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chore_runs_block_date_unique
  on public.chore_runs (block_id, run_date);
create index if not exists chore_runs_state_idx
  on public.chore_runs (state, run_date desc)
  where state in ('scheduled', 'in_progress');

alter table public.chore_runs enable row level security;

drop policy if exists chore_runs_read on public.chore_runs;
create policy chore_runs_read on public.chore_runs
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_runs_write on public.chore_runs;
create policy chore_runs_write on public.chore_runs
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_chore_runs_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_runs_updated_at on public.chore_runs;
create trigger chore_runs_updated_at
  before update on public.chore_runs
  for each row execute function public.touch_chore_runs_updated_at();


-- ── chore_definitions: add place_id, block_id, last_chance_block_id,
--    sort_order
-- A chore is scoped to a place (place_id); it applies to that place and
-- its whole subtree (fan-out computed client-side via lib/places.js).
-- place_id NULL == not place-scoped.
--
-- last_chance_block_id (Batch 11.1) is the deadline-block for chores
-- whose window spans multiple blocks or days. NULL means the chore's
-- normal block window is the deadline (matches pre-11.1 behavior).
alter table public.chore_definitions
  add column if not exists place_id uuid
    references public.places(id) on delete set null;
alter table public.chore_definitions
  add column if not exists block_id uuid
    references public.chore_blocks(id) on delete set null;
alter table public.chore_definitions
  add column if not exists last_chance_block_id uuid
    references public.chore_blocks(id) on delete set null;
alter table public.chore_definitions
  add column if not exists sort_order int not null default 0;

create index if not exists chore_definitions_place_id_idx
  on public.chore_definitions (place_id) where place_id is not null;
create index if not exists chore_definitions_block_idx
  on public.chore_definitions (block_id, sort_order)
  where block_id is not null;
create index if not exists chore_definitions_last_chance_block_idx
  on public.chore_definitions (last_chance_block_id)
  where last_chance_block_id is not null;


-- ── chore_completions: per-place grain (Batch 16.1) ──────────────────
-- A chore scoped to a parent place fans out into one obligation per
-- occupied descendant place (computed client-side via
-- lib/chores.js → obligationPlaceIds). Each obligation completes
-- independently, so "tractor 3 fed, tractor 4 not" is representable.
--
-- The table is created in 0002 (before `places` exists) WITHOUT a
-- uniqueness constraint; the place column + uniqueness land here.
--
-- place_id NULL == a chore-level completion (chores with no place, or
-- legacy rows restored from a pre-16.1 backup). Two partial unique
-- indexes express "one completion per chore+place+day" with NULL-safe
-- semantics — a plain unique constraint would treat NULL place_ids as
-- distinct and allow duplicate chore-level rows.
alter table public.chore_completions
  add column if not exists place_id uuid
    references public.places(id) on delete set null;

create unique index if not exists chore_completions_uniq_placed
  on public.chore_completions (chore_id, place_id, completion_date)
  where place_id is not null;
create unique index if not exists chore_completions_uniq_unplaced
  on public.chore_completions (chore_id, completion_date)
  where place_id is null;
create index if not exists chore_completions_place_idx
  on public.chore_completions (place_id) where place_id is not null;


-- ── seed: chore_blocks ────────────────────────────────────────────────
-- Three plain fixed-time blocks. Editable in the Blocks tab on the
-- Chores page. What matters is having something here so the legacy
-- `period` column has a target to backfill against.
insert into public.chore_blocks (id, name, start_kind, start_minutes, duration_minutes, sort_order)
values
  (gen_random_uuid(), 'Morning',   'fixed', 360,  120, 1),  -- 06:00, 2h
  (gen_random_uuid(), 'Afternoon', 'fixed', 780,  120, 2),  -- 13:00, 2h
  (gen_random_uuid(), 'Evening',   'fixed', 1020, 120, 3)   -- 17:00, 2h
on conflict do nothing;


-- ── seed: places + placements + chore backfill ────────────────────────
-- The real North Foster Farm geography. Inserted level-by-level so each
-- child's parent already exists (immediate FK checks). Then current
-- occupants (livestock cohorts + machinery) and the chore_definitions
-- place_id backfill, all keyed off the declared uuid vars.
do $$
declare
  nff_id            uuid := gen_random_uuid();
  house_id          uuid := gen_random_uuid();
  barn_id           uuid := gen_random_uuid();
  high_tunnel_id    uuid := gen_random_uuid();
  fred_id           uuid := gen_random_uuid();
  brooders_id       uuid := gen_random_uuid();
  brooder1_id       uuid := gen_random_uuid();
  mobile_brooder_id uuid := gen_random_uuid();
  pastures_id       uuid := gen_random_uuid();
  pasture_a_id      uuid := gen_random_uuid();
  pasture_b_id      uuid := gen_random_uuid();
  pasture_c_id      uuid := gen_random_uuid();
  ct1_id            uuid := gen_random_uuid();
  ct2_id            uuid := gen_random_uuid();
  ct3_id            uuid := gen_random_uuid();
  ct4_id            uuid := gen_random_uuid();
  ct5_id            uuid := gen_random_uuid();
  mc1_id            uuid := gen_random_uuid();
  mc2_id            uuid := gen_random_uuid();
begin
  -- Don't double-seed: if a farm root already exists, assume the tree
  -- is present and skip the whole block.
  if exists (select 1 from public.places where kind = 'farm') then
    return;
  end if;

  -- Root.
  insert into public.places (id, parent_id, name, kind, kind_tag, code, mobile, sort_order)
  values (nff_id, null, 'North Foster Farm', 'farm', null, null, false, 0);

  -- Level 1 — under the farm.
  insert into public.places (id, parent_id, name, kind, kind_tag, code, mobile, sort_order)
  values
    (house_id,    nff_id, 'House',    'structure', 'house', null, false, 1),
    (barn_id,     nff_id, 'Barn',     'structure', 'barn',  null, false, 2),
    (brooders_id, nff_id, 'Brooders', 'zone',      null,    null, false, 3),
    (pastures_id, nff_id, 'Pastures', 'zone',      null,    null, false, 4);

  -- Level 2 — under Barn / Brooders / Pastures.
  insert into public.places (id, parent_id, name, kind, kind_tag, code, mobile, sort_order)
  values
    (high_tunnel_id,    barn_id,     'High tunnel',          'structure', 'high_tunnel', null, false, 1),
    (fred_id,           barn_id,     'Fred (40'' container)', 'structure', 'container',  null, false, 2),
    (brooder1_id,       brooders_id, 'Brooder 1',            'structure', 'brooder',     null, false, 1),
    (mobile_brooder_id, brooders_id, 'Mobile Brooder',       'structure', 'brooder',     null, true,  2),
    (pasture_a_id,      pastures_id, 'Pasture A',            'area',      'pasture',     null, false, 1),
    (pasture_b_id,      pastures_id, 'Pasture B',            'area',      'pasture',     null, false, 2),
    (pasture_c_id,      pastures_id, 'Pasture C',            'area',      'pasture',     null, false, 3);

  -- Level 3 — chicken tractors (Pasture A) + mobile coops (Pasture C).
  insert into public.places (id, parent_id, name, kind, kind_tag, code, mobile, sort_order)
  values
    (ct1_id, pasture_a_id, 'Chicken tractor 1', 'structure', 'tractor', 'CT1', true, 1),
    (ct2_id, pasture_a_id, 'Chicken tractor 2', 'structure', 'tractor', 'CT2', true, 2),
    (ct3_id, pasture_a_id, 'Chicken tractor 3', 'structure', 'tractor', 'CT3', true, 3),
    (ct4_id, pasture_a_id, 'Chicken tractor 4', 'structure', 'tractor', 'CT4', true, 4),
    (ct5_id, pasture_a_id, 'Chicken tractor 5', 'structure', 'tractor', 'CT5', true, 5),
    (mc1_id, pasture_c_id, 'Mobile Coop 1',     'structure', 'coop',    'MC1', true, 1),
    (mc2_id, pasture_c_id, 'Mobile Coop 2',     'structure', 'coop',    'MC2', true, 2);

  -- Current occupants (placements). Cohorts map from the old free-text
  -- current_location: gold band -> MC1; no/blue/orange bands -> MC2.
  -- Broilers were unplaced (null) — seeded to plausible spots James can
  -- edit in-app. Sheep live in the barn. Machinery parks in the barn
  -- (demonstrates occupant_type='machine').
  insert into public.placements (place_id, occupant_type, occupant_id)
  values
    (mc1_id,      'batch',   'layers_gold_band'),
    (mc2_id,      'batch',   'layers_no_band'),
    (mc2_id,      'batch',   'layers_blue_band'),
    (mc2_id,      'batch',   'layers_orange_band'),
    (ct1_id,      'batch',   'broilers_batch_1'),
    (brooder1_id, 'batch',   'broilers_batch_2'),
    (barn_id,     'batch',   'sheep_pets'),
    (barn_id,     'machine', 'kubota_tractor'),
    (barn_id,     'machine', 'jd_backhoe'),
    (barn_id,     'machine', 'jd_excavator');

  -- Backfill chore_definitions.place_id from the legacy `category` text.
  -- Subtree fan-out means a chore on Pasture C reaches its coops, etc.
  -- wash_eggs has no place in this geography -> left null.
  update public.chore_definitions set place_id = pasture_c_id
    where place_id is null and category = 'mobile_coops';
  update public.chore_definitions set place_id = pasture_a_id
    where place_id is null and category = 'chicken_tractors';
  update public.chore_definitions set place_id = brooders_id
    where place_id is null and category = 'brooders';
  update public.chore_definitions set place_id = barn_id
    where place_id is null and category = 'sheep';
end $$;


-- ── backfill: chore_definitions.block_id from period ──────────────────
update public.chore_definitions cd
set block_id = b.id
from public.chore_blocks b
where cd.block_id is null
  and lower(cd.period) = lower(b.name);


-- ── Realtime ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'places'
  ) then
    execute 'alter publication supabase_realtime add table public.places';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'placements'
  ) then
    execute 'alter publication supabase_realtime add table public.placements';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'place_geometry'
  ) then
    execute 'alter publication supabase_realtime add table public.place_geometry';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_blocks'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_blocks';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_modifiers'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_modifiers';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_runs'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_runs';
  end if;
end $$;
