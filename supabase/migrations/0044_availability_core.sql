-- 0044_availability_core.sql
-- Batch 42 slices 6-7 — the availability core (additive only).
--
-- Three tables that make "who is actually here, when" a first-class
-- fact instead of a hardcoded roster + a magic 8a-6p band:
--
--   time_off      — a person's absence: a date span, either all-day or
--                   a partial-day window. Explicitly NOT an event
--                   (F50) — events are external things happening on
--                   the farm; time off is a person not being here.
--   working_hours — per-person working windows: one row per weekday
--                   default, plus per-date exception rows that win
--                   over the weekday default (early/late chore days,
--                   F51). A row with null start/end minutes means NOT
--                   working (a scheduled day off).
--   breaks        — farm-wide daily windows nobody is expected to work
--                   (breakfast / lunch / evening break, F51). Not
--                   per-person yet, by design.
--
-- The engine (src/lib/schedule/availability.js) derives availability =
-- working hours ∩ not-time-off ∩ not-break, and default assignment
-- falls back to "everyone available" (X3). Working hours also derive
-- the project band that replaces PROJECT_DEFAULT_START/END.
--
-- People are plain text names ('James', 'Jim'), matching assignment
-- rules and reservation windows. Minutes columns are minutes-of-day
-- (0..1440), matching chore_blocks.start_minutes.

-- ── time_off ─────────────────────────────────────────────────────────
create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person text not null,
  -- Inclusive date span; a single day is start_date = end_date.
  start_date date not null,
  end_date date not null,
  -- Partial-day window in minutes-of-day. BOTH null = all-day (the
  -- common case); both set = e.g. "gone 10:00-14:00". Applies to each
  -- day of the span (a multi-day partial is unusual but harmless).
  start_minutes integer,
  end_minutes integer,
  -- Optional free-text detail ("dentist", "county fair").
  note text
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_off_span_chk'
  ) then
    alter table public.time_off
      add constraint time_off_span_chk check (end_date >= start_date);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'time_off_window_chk'
  ) then
    alter table public.time_off
      add constraint time_off_window_chk check (
        (start_minutes is null and end_minutes is null)
        or (
          start_minutes is not null and end_minutes is not null
          and start_minutes >= 0 and end_minutes <= 1440
          and start_minutes < end_minutes
        )
      );
  end if;
end $$;

-- Day lookups scan by span overlap.
create index if not exists time_off_span_idx
  on public.time_off (start_date, end_date);

-- ── working_hours ────────────────────────────────────────────────────
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  person text not null,
  -- Exactly one of these is set:
  --   weekday 0..6 (Sun=0, matching stored frequency/weekday values)
  --     → the person's default window for that weekday.
  --   on_date → an exception for that specific date; wins over the
  --     weekday default.
  weekday integer,
  on_date date,
  -- The working window. BOTH null = not working (a scheduled day
  -- off); both set = working start..end. When a person has no row at
  -- all for a day, the app-level default (9:00-17:00) applies.
  start_minutes integer,
  end_minutes integer
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'working_hours_scope_chk'
  ) then
    alter table public.working_hours
      add constraint working_hours_scope_chk check (
        (weekday is not null and on_date is null
          and weekday between 0 and 6)
        or (weekday is null and on_date is not null)
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'working_hours_window_chk'
  ) then
    alter table public.working_hours
      add constraint working_hours_window_chk check (
        (start_minutes is null and end_minutes is null)
        or (
          start_minutes is not null and end_minutes is not null
          and start_minutes >= 0 and end_minutes <= 1440
          and start_minutes < end_minutes
        )
      );
  end if;
end $$;

-- One default per (person, weekday); one exception per (person, date).
create unique index if not exists working_hours_weekday_uniq
  on public.working_hours (person, weekday) where weekday is not null;
create unique index if not exists working_hours_date_uniq
  on public.working_hours (person, on_date) where on_date is not null;

-- ── breaks ───────────────────────────────────────────────────────────
create table if not exists public.breaks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- 'Breakfast', 'Lunch', 'Evening break' — the label the UI shows.
  name text not null,
  start_minutes integer not null,
  end_minutes integer not null,
  -- Toggle without deleting (seasonal breaks come and go).
  is_active boolean not null default true
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'breaks_window_chk'
  ) then
    alter table public.breaks
      add constraint breaks_window_chk check (
        start_minutes >= 0 and end_minutes <= 1440
        and start_minutes < end_minutes
      );
  end if;
end $$;

-- ── RLS: admin-only, same shape as agent_proposals ───────────────────
alter table public.time_off enable row level security;
alter table public.working_hours enable row level security;
alter table public.breaks enable row level security;

drop policy if exists time_off_all on public.time_off;
create policy time_off_all on public.time_off
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists working_hours_all on public.working_hours;
create policy working_hours_all on public.working_hours
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists breaks_all on public.breaks;
create policy breaks_all on public.breaks
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ── Realtime: availability edits sync across devices instantly ──────
do $$
declare t text;
begin
  foreach t in array array['time_off', 'working_hours', 'breaks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.'
        || t;
    end if;
  end loop;
end $$;
