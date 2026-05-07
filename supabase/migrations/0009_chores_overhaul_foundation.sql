-- 0009_chores_overhaul_foundation.sql
-- Schema foundation for the chores overhaul (Batch 7 of the roadmap).
--
--   sites              — user-creatable categories of place on the
--                        farm (Brooders, Mobile coops, Sheep paddocks,
--                        Wash & pack, Barn…). Sites group locations.
--                        Editing a site renames the whole category.
--
--   site_locations     — specific named instances within a site
--                        (Brooder #1, Hay room, Ram shed, Mobile
--                        coop A). Locations are where chores actually
--                        happen and where residents live.
--                        `has_residents` overrides the parent site's
--                        default per-location.
--
--   site_residents     — which livestock_groups (cohorts/batches)
--                        live at which location with `moved_in` /
--                        `moved_out` dates. Powers the cohort-aware
--                        quick actions in Rounds (Batch 8).
--
--   chore_blocks       — named time windows (Morning, Afternoon,
--                        Evening, Mid-day…). Start and end can each
--                        be a fixed clock time, sunrise, or sunset.
--                        Editing a block propagates to every chore
--                        in it.
--
--   chore_modifiers    — date-bound overrides on a chore. Schema
--                        ships now so Processes (Batch 16) can
--                        populate it; the conflict-stack UI ships
--                        with that batch.
--
--   chore_runs         — one row per (block_id, run_date). Mostly
--                        unused until Rounds ships in Batch 8.
--
-- Plus chore_definitions gains site_id, location_id, block_id,
-- sort_order. Backfill maps the legacy `category` text values to
-- seeded site rows, the legacy `period` text values to block_id, and
-- pulls sort_order from chore_group_members. The old `category` and
-- `period` columns stay in place for now.

-- ── sites ─────────────────────────────────────────────────────────────
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sites_sort_idx
  on public.sites (sort_order, name);
create index if not exists sites_active_idx
  on public.sites (is_active) where is_active = true;

alter table public.sites enable row level security;

drop policy if exists sites_read on public.sites;
create policy sites_read on public.sites
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists sites_write on public.sites;
create policy sites_write on public.sites
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_sites_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_updated_at on public.sites;
create trigger sites_updated_at
  before update on public.sites
  for each row execute function public.touch_sites_updated_at();


-- ── site_locations ────────────────────────────────────────────────────
-- Specific named places within a site. Brooders → Brooder #1,
-- Brooder #2. Mobile coops → Coop A, Coop B. Barn → Hay room,
-- Ram shed. has_residents overrides the parent site's default.
create table if not exists public.site_locations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  has_residents boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_locations_site_idx
  on public.site_locations (site_id, sort_order, name);
create index if not exists site_locations_active_idx
  on public.site_locations (is_active) where is_active = true;

alter table public.site_locations enable row level security;

drop policy if exists site_locations_read on public.site_locations;
create policy site_locations_read on public.site_locations
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists site_locations_write on public.site_locations;
create policy site_locations_write on public.site_locations
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_site_locations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_locations_updated_at on public.site_locations;
create trigger site_locations_updated_at
  before update on public.site_locations
  for each row execute function public.touch_site_locations_updated_at();


-- ── site_residents ────────────────────────────────────────────────────
-- Which livestock_groups currently (or historically) live at which
-- location. moved_out IS NULL means "currently here." A group can have
-- multiple historical rows; query with moved_out IS NULL for current.
create table if not exists public.site_residents (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null
    references public.site_locations(id) on delete cascade,
  livestock_group_id text not null
    references public.livestock_groups(id) on delete cascade,
  moved_in date not null default current_date,
  moved_out date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_residents_location_idx
  on public.site_residents (location_id, moved_out nulls first);
create index if not exists site_residents_group_idx
  on public.site_residents (livestock_group_id, moved_out nulls first);
create unique index if not exists site_residents_one_current_per_group
  on public.site_residents (livestock_group_id) where moved_out is null;

alter table public.site_residents enable row level security;

drop policy if exists site_residents_read on public.site_residents;
create policy site_residents_read on public.site_residents
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists site_residents_write on public.site_residents;
create policy site_residents_write on public.site_residents
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_site_residents_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_residents_updated_at on public.site_residents;
create trigger site_residents_updated_at
  before update on public.site_residents
  for each row execute function public.touch_site_residents_updated_at();


-- ── chore_blocks ──────────────────────────────────────────────────────
-- Named time windows. start_minutes / end_minutes are minutes-of-day
-- (0..1439) only meaningful when the corresponding *_kind = 'fixed'.
-- start_kind / end_kind = 'sunrise' or 'sunset' resolves to the
-- actual sunrise / sunset for the date at runtime (computed on the
-- client via suncalc).
create table if not exists public.chore_blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_kind text not null default 'fixed'
    check (start_kind in ('fixed', 'sunrise', 'sunset')),
  start_minutes int
    check (start_minutes is null or (start_minutes >= 0 and start_minutes <= 1439)),
  end_kind text not null default 'fixed'
    check (end_kind in ('fixed', 'sunrise', 'sunset')),
  end_minutes int
    check (end_minutes is null or (end_minutes >= 0 and end_minutes <= 1439)),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Fixed kinds need their minutes; sunrise/sunset can leave them null.
  constraint chore_blocks_fixed_needs_minutes check (
    (start_kind <> 'fixed' or start_minutes is not null) and
    (end_kind <> 'fixed' or end_minutes is not null)
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
returns trigger language plpgsql as $$
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
  -- A modifier can target a specific location or, more broadly, an
  -- entire site (every location under it). Both null means the
  -- modifier applies wherever the chore lives.
  target_location_id uuid
    references public.site_locations(id) on delete cascade,
  target_site_id uuid
    references public.sites(id) on delete cascade,
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
create index if not exists chore_modifiers_location_idx
  on public.chore_modifiers (target_location_id, occurs_on)
  where target_location_id is not null;
create index if not exists chore_modifiers_site_idx
  on public.chore_modifiers (target_site_id, occurs_on)
  where target_site_id is not null;

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
returns trigger language plpgsql as $$
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
    check (state in ('scheduled', 'in_progress', 'done')),
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
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_runs_updated_at on public.chore_runs;
create trigger chore_runs_updated_at
  before update on public.chore_runs
  for each row execute function public.touch_chore_runs_updated_at();


-- ── chore_definitions: add site_id, location_id, block_id, sort_order
-- A chore can target a parent site (fans out to every active
-- location under it) or a specific location (instance-scoped).
-- Exactly at most one of those two should be set.
alter table public.chore_definitions
  add column if not exists site_id uuid
    references public.sites(id) on delete set null;
alter table public.chore_definitions
  add column if not exists location_id uuid
    references public.site_locations(id) on delete set null;
alter table public.chore_definitions
  add column if not exists block_id uuid
    references public.chore_blocks(id) on delete set null;
alter table public.chore_definitions
  add column if not exists sort_order int not null default 0;

alter table public.chore_definitions
  drop constraint if exists chore_definitions_site_xor;
alter table public.chore_definitions
  add constraint chore_definitions_site_xor
  check (site_id is null or location_id is null);

create index if not exists chore_definitions_site_id_idx
  on public.chore_definitions (site_id) where site_id is not null;
create index if not exists chore_definitions_location_id_idx
  on public.chore_definitions (location_id) where location_id is not null;
create index if not exists chore_definitions_block_idx
  on public.chore_definitions (block_id, sort_order)
  where block_id is not null;


-- ── seed: chore_blocks ────────────────────────────────────────────────
-- Three plain fixed-time blocks. Editable in the new Blocks tab on
-- the Chores page. Seed values don't matter much — what matters is
-- having something here so the existing `period` column has a target
-- to backfill against.
insert into public.chore_blocks (id, name, start_kind, start_minutes, end_kind, end_minutes, sort_order)
values
  (gen_random_uuid(), 'Morning',   'fixed', 360,  'fixed', 480,  1),  -- 06:00 – 08:00
  (gen_random_uuid(), 'Afternoon', 'fixed', 780,  'fixed', 900,  2),  -- 13:00 – 15:00
  (gen_random_uuid(), 'Evening',   'fixed', 1020, 'fixed', 1140, 3)   -- 17:00 – 19:00
on conflict do nothing;


-- ── seed: sites + site_locations ──────────────────────────────────────
-- Create five seed sites (the parent categories) plus one location
-- under each so the app has something to render on first load. Wash
-- & pack defaults to no residents — an egg / wash station hosts no
-- birds.
do $$
declare
  brooder_id uuid := gen_random_uuid();
  mobile_coop_id uuid := gen_random_uuid();
  chicken_tractor_id uuid := gen_random_uuid();
  sheep_paddock_id uuid := gen_random_uuid();
  wash_pack_id uuid := gen_random_uuid();
begin
  insert into public.sites (id, name, sort_order) values
    (brooder_id,         'Brooders',         1),
    (mobile_coop_id,     'Mobile coops',     2),
    (chicken_tractor_id, 'Chicken tractors', 3),
    (sheep_paddock_id,   'Sheep paddocks',   4),
    (wash_pack_id,       'Wash & pack',      5)
  on conflict do nothing;

  insert into public.site_locations (site_id, name, sort_order, has_residents) values
    (brooder_id,         'Brooder #1',       1, true),
    (mobile_coop_id,     'Mobile coop A',    1, true),
    (chicken_tractor_id, 'Chicken tractor 1',1, true),
    (sheep_paddock_id,   'Main paddock',     1, true),
    (wash_pack_id,       'Egg station',      1, false)
  on conflict do nothing;
end $$;


-- ── backfill: chore_definitions.site_id from category ─────────────────
-- The existing `category` text column maps cleanly to a seed site.
-- Lookup by site name (case-insensitive) — re-running is safe since
-- we only update rows where site_id is still null.
update public.chore_definitions cd
set site_id = s.id
from public.sites s
where cd.site_id is null
  and cd.location_id is null
  and case cd.category
    when 'mobile_coops'     then 'Mobile coops'
    when 'sheep'            then 'Sheep paddocks'
    when 'chicken_tractors' then 'Chicken tractors'
    when 'brooders'         then 'Brooders'
    when 'wash_eggs'        then 'Wash & pack'
    else null
  end = s.name;


-- ── backfill: chore_definitions.block_id from period ──────────────────
update public.chore_definitions cd
set block_id = b.id
from public.chore_blocks b
where cd.block_id is null
  and lower(cd.period) = lower(b.name);


-- ── backfill: chore_definitions.sort_order from chore_group_members ───
update public.chore_definitions cd
set sort_order = m.sort_order
from public.chore_group_members m
where m.chore_id = cd.id
  and cd.sort_order = 0;


-- ── Realtime ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sites'
  ) then
    execute 'alter publication supabase_realtime add table public.sites';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'site_locations'
  ) then
    execute 'alter publication supabase_realtime add table public.site_locations';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'site_residents'
  ) then
    execute 'alter publication supabase_realtime add table public.site_residents';
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
