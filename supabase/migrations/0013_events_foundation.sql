-- 0013_events_foundation.sql
-- Events foundation for Batch 13.1.
--
--   event_series      — the rule. One row per recurring or one-off
--                       event. `rrule` is RFC 5545 (replaces the
--                       legacy weekly-only JSONB shape on
--                       event_instances). One-offs have rrule=NULL
--                       and the series's dtstart carries the
--                       single date.
--   event_occurrences — materialized rows for any series that has
--                       been TOUCHED (override, skip, drag-reschedule,
--                       GCal push). Lazy: pure recurring series with
--                       no overrides materialize zero rows. Read-time
--                       expansion of the rule handles them.
--   event_links       — polymorphic glue. Schema lands now so the
--                       trigger automations + animal-lifecycle pages
--                       have a target to populate.
--   automations       — trigger rules (feed reorder, broiler batch
--                       lifecycle). Schema only here; seed rules ship
--                       in Batch 15.
--   gcal_pushes       — audit log for one-way Google Calendar sync.
--                       Schema only; the push job ships in Batch 15.
--   timeline_items    — view union of event_occurrences + chore_runs
--                       with a `kind` discriminator. UI consumes the
--                       view, never the underlying tables.
--
-- Migration of `event_instances`: each row becomes one
-- `event_series` row. Recurring rows convert their JSONB to an RRULE
-- string. One-off rows materialize a single `event_occurrences`
-- pre-populated row.

-- ── event_series ─────────────────────────────────────────────────────
create table if not exists public.event_series (
  id uuid primary key default gen_random_uuid(),
  legacy_instance_id text,
  kind_id text not null references public.event_kinds(id) on delete cascade,
  label text not null,
  subtitle text,
  location jsonb,
  rrule text,
  dtstart timestamptz,
  until timestamptz,
  duration_minutes int,
  season_window jsonb,
  status text not null default 'active'
    check (status in ('active', 'ended')),
  payload jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_series_legacy_instance_unique
  on public.event_series (legacy_instance_id)
  where legacy_instance_id is not null;
create index if not exists event_series_kind_idx
  on public.event_series (kind_id);
create index if not exists event_series_status_idx
  on public.event_series (status) where status = 'active';

alter table public.event_series enable row level security;

drop policy if exists event_series_read on public.event_series;
create policy event_series_read on public.event_series
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists event_series_write on public.event_series;
create policy event_series_write on public.event_series
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_event_series_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists event_series_updated_at on public.event_series;
create trigger event_series_updated_at
  before update on public.event_series
  for each row execute function public.touch_event_series_updated_at();


-- ── event_occurrences ────────────────────────────────────────────────
create table if not exists public.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null
    references public.event_series(id) on delete cascade,
  occurs_on date not null,
  start_time text,
  end_time text,
  location_override jsonb,
  notes_override text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'skipped', 'done')),
  gcal_event_id text,
  payload_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_occurrences_series_date_unique
  on public.event_occurrences (series_id, occurs_on);
create index if not exists event_occurrences_date_idx
  on public.event_occurrences (occurs_on);
create index if not exists event_occurrences_gcal_idx
  on public.event_occurrences (gcal_event_id)
  where gcal_event_id is not null;

alter table public.event_occurrences enable row level security;

drop policy if exists event_occurrences_read on public.event_occurrences;
create policy event_occurrences_read on public.event_occurrences
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists event_occurrences_write on public.event_occurrences;
create policy event_occurrences_write on public.event_occurrences
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_event_occurrences_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists event_occurrences_updated_at on public.event_occurrences;
create trigger event_occurrences_updated_at
  before update on public.event_occurrences
  for each row execute function public.touch_event_occurrences_updated_at();


-- ── event_links (polymorphic) ────────────────────────────────────────
create table if not exists public.event_links (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.event_series(id) on delete cascade,
  occurrence_id uuid
    references public.event_occurrences(id) on delete cascade,
  target_type text not null
    check (target_type in (
      'batch', 'project', 'project_phase',
      'chore', 'inventory_item', 'automation'
    )),
  target_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  -- Exactly one of series_id / occurrence_id is set.
  constraint event_links_one_anchor
    check ((series_id is not null) <> (occurrence_id is not null))
);

create index if not exists event_links_series_idx
  on public.event_links (series_id) where series_id is not null;
create index if not exists event_links_occurrence_idx
  on public.event_links (occurrence_id) where occurrence_id is not null;
create index if not exists event_links_target_idx
  on public.event_links (target_type, target_id);

alter table public.event_links enable row level security;

drop policy if exists event_links_read on public.event_links;
create policy event_links_read on public.event_links
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists event_links_write on public.event_links;
create policy event_links_write on public.event_links
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── automations (schema only — Batch 15 seeds two rules) ─────────────
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_kind text not null
    check (trigger_kind in ('inventory_reorder', 'batch_created')),
  trigger_config jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automations enable row level security;

drop policy if exists automations_read on public.automations;
create policy automations_read on public.automations
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists automations_write on public.automations;
create policy automations_write on public.automations
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── gcal_pushes (schema only — Batch 15 wires the push job) ──────────
create table if not exists public.gcal_pushes (
  occurrence_id uuid primary key
    references public.event_occurrences(id) on delete cascade,
  gcal_event_id text not null,
  last_synced_at timestamptz not null default now(),
  last_action text not null
    check (last_action in ('create', 'update', 'cancel'))
);

alter table public.gcal_pushes enable row level security;

drop policy if exists gcal_pushes_read on public.gcal_pushes;
create policy gcal_pushes_read on public.gcal_pushes
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists gcal_pushes_write on public.gcal_pushes;
create policy gcal_pushes_write on public.gcal_pushes
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── timeline_items view ──────────────────────────────────────────────
-- Unions event_occurrences + chore_runs with a `kind` discriminator
-- so the calendar UI consumes one source. event rows that exist only
-- as rule expansions (no materialized override) don't appear here —
-- the view is the materialized half. Read-time expansion of the rule
-- happens in JS (lib/recurrence.js wrapper).
create or replace view public.timeline_items as
  select
    'event'::text                  as kind,
    eo.id                          as id,
    eo.series_id::text             as series_id,
    eo.occurs_on                   as occurs_on,
    eo.start_time                  as start_time,
    eo.end_time                    as end_time,
    eo.status                      as status,
    es.kind_id                     as event_kind_id,
    es.label                       as label,
    null::uuid                     as block_id,
    null::timestamptz              as started_at,
    null::timestamptz              as ended_at
  from public.event_occurrences eo
  join public.event_series es on es.id = eo.series_id
  union all
  select
    'chore_run'::text              as kind,
    cr.id                          as id,
    null::text                     as series_id,
    cr.run_date                    as occurs_on,
    null::text                     as start_time,
    null::text                     as end_time,
    cr.state                       as status,
    null::text                     as event_kind_id,
    null::text                     as label,
    cr.block_id                    as block_id,
    cr.started_at                  as started_at,
    cr.ended_at                    as ended_at
  from public.chore_runs cr;

grant select on public.timeline_items to authenticated;


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_series'
  ) then
    execute 'alter publication supabase_realtime add table public.event_series';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_occurrences'
  ) then
    execute 'alter publication supabase_realtime add table public.event_occurrences';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'event_links'
  ) then
    execute 'alter publication supabase_realtime add table public.event_links';
  end if;
end $$;


-- ── Migration: event_instances → event_series + occurrences ──────────
-- Recurring rows: convert legacy { dayOfWeek, startTime, endTime,
-- seasonStart, seasonEnd } → RRULE FREQ=WEEKLY;BYDAY=<DOW>;UNTIL=...
-- with dtstart at the season start at start_time. season_window mirrors
-- {start, end} as MM-DD strings so a future "every year May 14 → Sept
-- 21" can attach a yearly rule without the until cap.
--
-- One-off rows: rrule=NULL, dtstart=date+start_time, until=NULL.
-- Pre-materialize a single event_occurrences row at that date.
do $$
declare
  inst record;
  dow text;
  iso_dtstart timestamptz;
  iso_until timestamptz;
  rrule_str text;
  series_id uuid;
  duration_min int;
  start_minutes int;
  end_minutes int;
begin
  for inst in
    select * from public.event_instances
  loop
    -- Skip rows we've already migrated (re-running the migration).
    if exists (
      select 1 from public.event_series
      where legacy_instance_id = inst.id
    ) then
      continue;
    end if;
    duration_min := null;
    if inst.start_time is not null and inst.end_time is not null then
      start_minutes := (split_part(inst.start_time, ':', 1)::int * 60
                       + split_part(inst.start_time, ':', 2)::int);
      end_minutes := (split_part(inst.end_time, ':', 1)::int * 60
                     + split_part(inst.end_time, ':', 2)::int);
      if end_minutes > start_minutes then
        duration_min := end_minutes - start_minutes;
      end if;
    end if;

    if inst.recurrence is not null then
      -- Recurring (legacy weekly-only).
      dow := case (inst.recurrence ->> 'dayOfWeek')::int
               when 0 then 'SU' when 1 then 'MO' when 2 then 'TU'
               when 3 then 'WE' when 4 then 'TH' when 5 then 'FR'
               when 6 then 'SA' else null end;
      iso_dtstart := (
        (inst.recurrence ->> 'seasonStart')::date::timestamptz
        + coalesce((inst.recurrence ->> 'startTime'), '00:00')::time
      );
      iso_until := (
        (inst.recurrence ->> 'seasonEnd')::date::timestamptz
        + interval '1 day' - interval '1 second'
      );
      rrule_str := 'FREQ=WEEKLY';
      if dow is not null then
        rrule_str := rrule_str || ';BYDAY=' || dow;
      end if;
      if iso_until is not null then
        rrule_str := rrule_str || ';UNTIL='
                     || to_char(iso_until at time zone 'UTC',
                                'YYYYMMDD"T"HH24MISS"Z"');
      end if;
      insert into public.event_series (
        id, legacy_instance_id, kind_id, label, subtitle, location,
        rrule, dtstart, until, duration_minutes, season_window,
        payload, notes
      ) values (
        gen_random_uuid(), inst.id, inst.kind_id, inst.label,
        inst.subtitle, inst.location,
        rrule_str, iso_dtstart, iso_until, duration_min,
        jsonb_build_object(
          'start', inst.recurrence ->> 'seasonStart',
          'end',   inst.recurrence ->> 'seasonEnd'
        ),
        inst.processing, inst.notes
      );
    else
      -- One-off (date set, recurrence null).
      iso_dtstart := inst.date::timestamptz
                     + coalesce(inst.start_time, '00:00')::time;
      insert into public.event_series (
        id, legacy_instance_id, kind_id, label, subtitle, location,
        rrule, dtstart, until, duration_minutes, season_window,
        payload, notes
      ) values (
        gen_random_uuid(), inst.id, inst.kind_id, inst.label,
        inst.subtitle, inst.location,
        null, iso_dtstart, null, duration_min, null,
        inst.processing, inst.notes
      ) returning id into series_id;

      -- Pre-materialize the single occurrence so one-offs already
      -- live in the materialized half (matches the lazy-for-recurring
      -- contract).
      insert into public.event_occurrences (
        series_id, occurs_on, start_time, end_time, status
      ) values (
        series_id, inst.date, inst.start_time, inst.end_time,
        'scheduled'
      ) on conflict do nothing;
    end if;
  end loop;
end $$;
