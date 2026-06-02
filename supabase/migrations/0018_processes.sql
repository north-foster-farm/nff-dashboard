-- 0018_processes.sql
-- Processes (Batch 23): templates tied to event kinds that expand into
-- real work when a matching event lands on the schedule.
--
--   processes                 — one row per template ("Processing day
--                               prep"). is_active gates expansion;
--                               lookahead_days is how far ahead of an
--                               occurrence the expansion happens.
--   process_steps             — ordered steps. kind='task' steps become
--                               project_steps in the expanded project;
--                               kind='chore_modifier' steps write
--                               chore_modifiers rows (the table from
--                               Batch 7, finally getting its writer).
--                               offset_days is relative to the anchor
--                               event date (negative = before).
--   process_event_kind_links  — which event kinds trigger which
--                               process (many-to-many).
--   process_expansions        — one row per (process, series,
--                               occurrence date) that has been
--                               expanded. The unique constraint IS the
--                               idempotency guard; `created` records
--                               what the expansion wrote so dismissal
--                               can tombstone it. Mirrors
--                               automation_emissions' active /
--                               acknowledged / dismissed lifecycle so
--                               expansions ride the same Heads-up lane.
--
-- The expansion engine is client-side (lib/data/useProcessRunner.js) —
-- event occurrences are lazily materialized from RRULEs in the client,
-- so "an occurrence is now within the lookahead window" is a condition
-- only the client can see. Concurrent clients are raced-safely by the
-- unique constraint on process_expansions.

-- ── processes ────────────────────────────────────────────────────────
create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_active boolean not null default true,
  lookahead_days int not null default 60,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_processes_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists processes_touch_updated_at on public.processes;
create trigger processes_touch_updated_at
  before update on public.processes
  for each row execute function public.touch_processes_updated_at();

alter table public.processes enable row level security;

drop policy if exists processes_read on public.processes;
create policy processes_read on public.processes
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists processes_write on public.processes;
create policy processes_write on public.processes
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── process_steps ────────────────────────────────────────────────────
create table if not exists public.process_steps (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null
    references public.processes(id) on delete cascade,
  title text not null,
  body_md text,
  -- Days relative to the anchor event date. -7 = a week before,
  -- 0 = the day of, +1 = the day after.
  offset_days int not null default 0,
  kind text not null default 'task'
    check (kind in ('task', 'chore_modifier')),
  -- chore_modifier fields (null for task steps). set null on chore
  -- delete so the step survives as inert config rather than vanishing.
  target_chore_id text
    references public.chore_definitions(id) on delete set null,
  modifier_action text
    check (modifier_action in ('skip', 'replace', 'prepend',
                               'restrict_until')),
  modifier_text text,
  -- Process modifiers default above manual ones (manual default is 0)
  -- so a process can override a hand-placed note deterministically.
  modifier_priority int not null default 10,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'chore_modifier' or modifier_action is not null)
);

create index if not exists process_steps_process_idx
  on public.process_steps (process_id, sort_order);

create or replace function public.touch_process_steps_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists process_steps_touch_updated_at
  on public.process_steps;
create trigger process_steps_touch_updated_at
  before update on public.process_steps
  for each row execute function public.touch_process_steps_updated_at();

alter table public.process_steps enable row level security;

drop policy if exists process_steps_read on public.process_steps;
create policy process_steps_read on public.process_steps
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists process_steps_write on public.process_steps;
create policy process_steps_write on public.process_steps
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── process_event_kind_links ─────────────────────────────────────────
create table if not exists public.process_event_kind_links (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null
    references public.processes(id) on delete cascade,
  event_kind_id text not null
    references public.event_kinds(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (process_id, event_kind_id)
);

create index if not exists process_event_kind_links_kind_idx
  on public.process_event_kind_links (event_kind_id);

alter table public.process_event_kind_links enable row level security;

drop policy if exists process_event_kind_links_read
  on public.process_event_kind_links;
create policy process_event_kind_links_read
  on public.process_event_kind_links
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists process_event_kind_links_write
  on public.process_event_kind_links;
create policy process_event_kind_links_write
  on public.process_event_kind_links
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── process_expansions ───────────────────────────────────────────────
-- One row per expansion. The unique (process_id, series_id, occurs_on)
-- constraint makes expansion idempotent: the runner inserts this row
-- FIRST, and a conflict means another client already expanded it.
--
-- `created` records what the expansion wrote, so dismissal can
-- tombstone exactly that:
--   { "project_id": uuid, "modifier_ids": [uuid], "link_ids": [uuid] }
create table if not exists public.process_expansions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null
    references public.processes(id) on delete cascade,
  series_id uuid not null
    references public.event_series(id) on delete cascade,
  occurs_on date not null,
  summary text not null,
  status text not null default 'active'
    check (status in ('active', 'acknowledged', 'dismissed')),
  created jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by_email text,
  dismissed_at timestamptz,
  dismissed_reason text,
  dismissed_by_email text,
  expanded_at timestamptz not null default now(),
  unique (process_id, series_id, occurs_on)
);

create index if not exists process_expansions_status_idx
  on public.process_expansions (status, expanded_at desc)
  where status = 'active';
create index if not exists process_expansions_series_idx
  on public.process_expansions (series_id, occurs_on);

alter table public.process_expansions enable row level security;

drop policy if exists process_expansions_read on public.process_expansions;
create policy process_expansions_read on public.process_expansions
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists process_expansions_write on public.process_expansions;
create policy process_expansions_write on public.process_expansions
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── Provenance columns on what expansions create ─────────────────────
-- A project created by an expansion carries the expansion id (sparkle
-- treatment + "from process" labeling, same idea as
-- chore_definitions.automation_emission_id from Batch 19). Set null on
-- expansion delete — the project survives as a normal project.
alter table public.projects
  add column if not exists process_expansion_id uuid
    references public.process_expansions(id) on delete set null;

create index if not exists projects_process_expansion_idx
  on public.projects (process_expansion_id)
  where process_expansion_id is not null;

-- Modifiers created by an expansion. source='process' distinguishes
-- them from 'manual' rows; the FK lets dismissal find + delete them
-- and the badge UI explain where a modifier came from.
alter table public.chore_modifiers
  add column if not exists process_expansion_id uuid
    references public.process_expansions(id) on delete set null;

create index if not exists chore_modifiers_process_expansion_idx
  on public.chore_modifiers (process_expansion_id)
  where process_expansion_id is not null;


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'processes', 'process_steps', 'process_event_kind_links',
    'process_expansions', 'chore_modifiers'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;


-- ── Seed: "Processing day prep" ──────────────────────────────────────
-- The process from the workshop example ("1 week before processing day
-- → check trailer hitch and tires"). Seeded DISABLED so it expands
-- nothing until James reviews it on the Processes page and switches it
-- on — there are real processing-day events on the schedule.
do $$
declare
  proc_id uuid;
begin
  if exists (
    select 1 from public.processes where title = 'Processing day prep'
  ) then
    return; -- already seeded (re-run safety)
  end if;

  insert into public.processes (title, description, is_active, created_by)
  values (
    'Processing day prep',
    'Everything that has to happen around a broiler processing day, '
    || 'from confirming the appointment a week out to creating '
    || 'inventory lots the day after.',
    false,
    'seed'
  )
  returning id into proc_id;

  insert into public.process_event_kind_links (process_id, event_kind_id)
  values (proc_id, 'processing_days');

  insert into public.process_steps
    (process_id, title, offset_days, kind, sort_order, body_md)
  values
    (proc_id, 'Confirm processor appointment', -7, 'task', 0,
     'Call the processor and confirm the drop-off time and bird count.'),
    (proc_id, 'Check trailer hitch and tires', -7, 'task', 1, null),
    (proc_id, 'Stage crates and catch equipment', -2, 'task', 2, null),
    (proc_id, 'Pull feed from the birds (evening before)', -1, 'task', 3,
     'Feed withdrawal ~12 hours before processing; water stays.'),
    (proc_id, 'Load and transport birds to processor', 0, 'task', 4, null),
    (proc_id, 'Create inventory lots from processed birds', 1, 'task', 5,
     'Whole birds + cuts into chicken_lots; record per-bird weights '
     || 'while they are fresh.');
end $$;
