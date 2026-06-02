-- 0023_metrics_foundation.sql
-- Metrics & analytics foundation (Batch 26.1).
--
--   metrics             — the metric registry: one row per metric the
--                         subsystem knows how to compute (name, formula
--                         description, units, applies-to entity, healthy
--                         target range). The front-end reads this to
--                         render definitions and target bands; the
--                         actual computation lives in src/lib/metrics.js.
--   weight_samples      — one row per weigh-in session: a random 10–20
--                         bird sample captured as an array of individual
--                         weights (individual weights are required for
--                         the uniformity / coefficient-of-variation
--                         metric, so we never store just the average).
--   egg_collections     — one row per egg-count capture for a layer
--                         flock. Distinct from egg_lots (carton
--                         inventory): this is the production record the
--                         hen-housed / feed-per-dozen metrics read.
--   livestock_groups.placed_count
--                       — how many birds the cohort STARTED with.
--                         `count` is live (mortality decrements it), so
--                         metrics need the original denominator.
--                         Backfilled as count + logged mortality.
--   livestock_species.target_process_weeks
--                       — target weeks-on-farm before processing; the
--                         "weeks remaining" metric and dashboard widget
--                         run on this. Seeded to 7 for broilers (top of
--                         the existing "5–7 weeks from arrival"
--                         processing_timeline text).

-- ── metrics registry ─────────────────────────────────────────────────
create table if not exists public.metrics (
  id text primary key,
  name text not null,
  description text,
  unit text,
  applies_to text not null,        -- 'broiler_batch' | 'layer_flock'
  target_low numeric,
  target_high numeric,
  target_note text,
  ordinal integer not null default 0
);

insert into public.metrics
  (id, name, description, unit, applies_to,
   target_low, target_high, target_note, ordinal)
values
  ('broiler_fcr', 'Feed Conversion Ratio',
   'Pounds of feed eaten divided by pounds of liveweight gained. Feed '
     || 'eaten is projected from the batch''s feed schedule; gain is '
     || 'the latest sample average times the live count, less the '
     || 'assumed day-old chick weight. Feed eaten by birds that later '
     || 'died stays in the numerator — mortality makes the ratio worse, '
     || 'which is the honest number.',
   'lb feed / lb gain', 'broiler_batch',
   2.2, 3.0, 'Pasture-raised target 2.2–3.0; commercial confinement '
     || 'runs 1.7–1.9.', 0),
  ('broiler_adg', 'Average Daily Gain',
   'Pounds gained per bird per day, from the weekly random 10–20 bird '
     || 'sample on a hanging or platform scale. With two or more '
     || 'samples this is the slope between them; with one it anchors '
     || 'to day-old chick weight at arrival.',
   'lb/day', 'broiler_batch',
   null, null, null, 1),
  ('broiler_uniformity', 'Uniformity (CV)',
   'Coefficient of variation across the individual weights in the '
     || 'latest sample — standard deviation as a percentage of the '
     || 'mean. Lower is tighter.',
   '%', 'broiler_batch',
   null, 8, 'Under 8% is a tight, uniform batch.', 2),
  ('broiler_mortality', 'Mortality',
   'Cumulative losses logged on the cohort divided by birds placed.',
   '%', 'broiler_batch',
   null, null, null, 3),
  ('broiler_weeks_remaining', 'Weeks remaining',
   'Weeks until the batch''s processing event if one is scheduled, '
     || 'otherwise weeks until the species'' target process week '
     || 'counted from arrival.',
   'weeks', 'broiler_batch',
   null, null, null, 4),
  ('layer_hen_housed', 'Hen-housed production',
   'Cumulative eggs collected divided by the hens originally placed — '
     || 'the honest per-bird production number, since deaths don''t '
     || 'shrink the denominator.',
   'eggs/hen', 'layer_flock',
   280, 320, 'Target 280–320 eggs per hen housed in the first laying '
     || 'year.', 0),
  ('layer_feed_per_dozen', 'Feed per dozen',
   'Pounds of feed eaten per dozen eggs collected over the same '
     || 'window. Needs a metered feed schedule — free-choice stages '
     || 'can''t be projected.',
   'lb/dozen', 'layer_flock',
   null, null, null, 1),
  ('layer_feed_per_lb_egg_mass', 'Feed per lb of egg mass',
   'Pounds of feed per pound of egg mass (egg count × average egg '
     || 'weight). The better denominator for older flocks laying '
     || 'bigger eggs.',
   'lb/lb', 'layer_flock',
   null, null, null, 2),
  ('layer_body_weight_trend', 'Body weight trend',
   'Direction of the flock''s average body weight across weigh-ins, '
     || 'with condition flags: birds dropping weight while laying are '
     || 'burning reserves and will crash; birds gaining fat drop '
     || 'production and risk fatty liver.',
   'lb', 'layer_flock',
   null, null, null, 3),
  ('layer_mortality', 'Mortality',
   'Cumulative losses logged on the flock divided by hens placed.',
   '%', 'layer_flock',
   null, null, null, 4)
on conflict (id) do nothing;

alter table public.metrics enable row level security;

drop policy if exists metrics_read on public.metrics;
create policy metrics_read on public.metrics
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists metrics_write on public.metrics;
create policy metrics_write on public.metrics
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── weight_samples ───────────────────────────────────────────────────
-- `weights` is a jsonb array of numbers — the individual bird weights
-- from one sampling session. Average, standard deviation, and CV are
-- all derived client-side so corrections (edit/delete a sample) never
-- leave stale aggregates behind.
create table if not exists public.weight_samples (
  id uuid primary key default gen_random_uuid(),
  group_id text not null
    references public.livestock_groups(id) on delete cascade,
  sampled_on date not null default current_date,
  weights jsonb not null,
  unit text not null default 'lb',
  notes text,
  recorded_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists weight_samples_group_idx
  on public.weight_samples (group_id, sampled_on desc);

alter table public.weight_samples enable row level security;

drop policy if exists weight_samples_read on public.weight_samples;
create policy weight_samples_read on public.weight_samples
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists weight_samples_write on public.weight_samples;
create policy weight_samples_write on public.weight_samples
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── egg_collections ──────────────────────────────────────────────────
-- One row per capture (a flock can have several per day — AM and PM
-- collection chores both log). `count` is individual eggs, not cartons.
-- `avg_egg_weight_oz` is optional; the egg-mass metric falls back to a
-- 2.0 oz USDA-large default when it's null.
--
-- The id is supplied by the client when the row comes through the
-- offline outbox (Rounds quick action) so replays are idempotent on
-- the primary key.
create table if not exists public.egg_collections (
  id uuid primary key default gen_random_uuid(),
  group_id text not null
    references public.livestock_groups(id) on delete cascade,
  collected_on date not null default current_date,
  count integer not null check (count >= 0),
  avg_egg_weight_oz numeric,
  notes text,
  recorded_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists egg_collections_group_idx
  on public.egg_collections (group_id, collected_on desc);

alter table public.egg_collections enable row level security;

drop policy if exists egg_collections_read on public.egg_collections;
create policy egg_collections_read on public.egg_collections
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists egg_collections_write on public.egg_collections;
create policy egg_collections_write on public.egg_collections
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── livestock_groups.placed_count ────────────────────────────────────
alter table public.livestock_groups
  add column if not exists placed_count integer;

-- Backfill: the birds a cohort started with = its live count today
-- plus every loss already logged against it. Only touches rows that
-- have a live count and no placed_count yet, so re-running is a no-op
-- and a user-corrected placed_count is never clobbered.
update public.livestock_groups g
set placed_count = g.count + coalesce((
  select sum((al.payload ->> 'count')::integer)
  from public.activity_log al
  where al.kind = 'mortality_observed'
    and al.payload ->> 'livestock_group_id' = g.id
), 0)
where g.placed_count is null
  and g.count is not null;


-- ── livestock_species.target_process_weeks ───────────────────────────
alter table public.livestock_species
  add column if not exists target_process_weeks integer;

update public.livestock_species
set target_process_weeks = 7
where id = 'broilers' and target_process_weeks is null;


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['metrics', 'weight_samples', 'egg_collections']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
