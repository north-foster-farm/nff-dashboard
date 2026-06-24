-- 0029_schedule_commitments_foundation.sql
-- Schedule feature — S1: the unified `commitments` timeline.
--
-- Generalizes `chore_runs` into `commitments`, the single timeline unit
-- the Schedule feature is built on (per .ignored/schedule-feature/
-- scope-document.md + build-plan.md). A commitment is one claim on a
-- block of someone's time; in this batch the ONLY kind that exists is
-- `chore_block` (a block-run, exactly what chore_runs was). Event /
-- project_node / ad_hoc / note / reservation / buffer kinds arrive in
-- later batches (S6+); their columns are created here, unused for now.
--
-- DATA SAFETY (the app is LIVE; chore_runs is irreplaceable):
--   * This migration is ADDITIVE. It creates `commitments`, COPIES every
--     chore_runs row in uuid-preserving, and repoints the two inbound
--     FKs (chore_run_participants, activity_log) + the timeline_items
--     view to `commitments`. It DROPS NOTHING.
--   * `chore_runs` is intentionally LEFT IN PLACE (now orphaned: no code
--     reads/writes it, no FKs point at it) as a verification/rollback
--     copy. A SEPARATE later migration drops it, only AFTER (a) S3
--     removes the timeline_items view that still names it and (b) prod
--     row-count parity is confirmed.
--   * Run `node scripts/backup-db.mjs` and confirm chore_runs row count
--     before pushing this.
--
-- Folded-in columns keep their chore_runs names verbatim (run_date,
-- state, started_at, …) so the execution-path code repoints with a table
-- name + a source_type filter and ZERO field-mapping churn.

-- ── commitments ────────────────────────────────────────────────────────
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),

  -- what this commitment references (polymorphic; only 'chore_block' in S1)
  source_type text not null
    check (source_type in (
      'chore_block', 'event', 'project_node', 'ad_hoc',
      'note', 'reservation', 'buffer'
    )),
  source_ref jsonb,                 -- generic pointer for non-chore kinds (S6+)

  -- placement
  block_id uuid
    references public.chore_blocks(id) on delete cascade,  -- chore_block path
  run_date date,                    -- the business day (generic; kept name)
  clock_time text,                  -- clock-anchored kinds (events); null for blocks
  assignee text,                    -- person string; null = shared/unassigned

  -- pact (the schedule's commitment layer; unused until S6/S7)
  reason text,                      -- "why today"
  protected boolean not null default false,
  overrides jsonb,                  -- instance time/duration overrides (schedule-scoped)

  -- execution (folded from chore_runs; meaningful for work-type rows)
  state text not null default 'scheduled'
    check (state in ('scheduled', 'in_progress', 'done', 'canceled')),
  started_at timestamptz,
  ended_at timestamptz,
  started_by_email text,
  ended_by_email text,
  notified_at timestamptz,          -- run-done push idempotency marker

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chore-block uniqueness preserved. NON-partial so Supabase upsert
-- ON CONFLICT (block_id, run_date) keeps working; NULL block_id rows
-- (future event/project/reservation kinds) are distinct under a unique
-- index, so non-chore commitments are unconstrained here.
create unique index if not exists commitments_block_date_unique
  on public.commitments (block_id, run_date);
create index if not exists commitments_state_idx
  on public.commitments (state, run_date desc)
  where state in ('scheduled', 'in_progress');
create index if not exists commitments_source_type_idx
  on public.commitments (source_type);

-- ── copy every chore_runs row (uuid-preserving) ────────────────────────
-- id preserved so the existing chore_run_participants.run_id and
-- activity_log.run_id values still resolve after the FK repoint below.
insert into public.commitments
  (id, source_type, block_id, run_date, state, started_at, ended_at,
   started_by_email, ended_by_email, notified_at, created_at, updated_at)
select
  id, 'chore_block', block_id, run_date, state, started_at, ended_at,
  started_by_email, ended_by_email, notified_at, created_at, updated_at
from public.chore_runs
on conflict (id) do nothing;

-- ── RLS (mirror chore_runs: admin read + write) ────────────────────────
alter table public.commitments enable row level security;

drop policy if exists commitments_read on public.commitments;
create policy commitments_read on public.commitments
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists commitments_write on public.commitments;
create policy commitments_write on public.commitments
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ── updated_at trigger ─────────────────────────────────────────────────
create or replace function public.touch_commitments_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commitments_updated_at on public.commitments;
create trigger commitments_updated_at
  before update on public.commitments
  for each row execute function public.touch_commitments_updated_at();

-- ── realtime ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'commitments'
  ) then
    execute 'alter publication supabase_realtime add table public.commitments';
  end if;
end $$;

-- ── repoint inbound FKs from chore_runs → commitments ──────────────────
-- uuids were preserved in the copy above, so every existing child row
-- still references a valid commitments.id. Constraint names looked up
-- (robust to Postgres auto-naming) rather than hard-coded.
do $$
declare fk text;
begin
  -- chore_run_participants.run_id  (was ON DELETE CASCADE)
  select conname into fk from pg_constraint
   where conrelid = 'public.chore_run_participants'::regclass
     and contype = 'f'
     and confrelid = 'public.chore_runs'::regclass;
  if fk is not null then
    execute format(
      'alter table public.chore_run_participants drop constraint %I', fk);
  end if;
  alter table public.chore_run_participants
    add constraint chore_run_participants_run_id_fkey
    foreign key (run_id) references public.commitments(id) on delete cascade;

  -- activity_log.run_id  (was ON DELETE SET NULL)
  select conname into fk from pg_constraint
   where conrelid = 'public.activity_log'::regclass
     and contype = 'f'
     and confrelid = 'public.chore_runs'::regclass;
  if fk is not null then
    execute format('alter table public.activity_log drop constraint %I', fk);
  end if;
  alter table public.activity_log
    add constraint activity_log_run_id_fkey
    foreign key (run_id) references public.commitments(id) on delete set null;
end $$;

-- ── repoint the timeline_items view → commitments ──────────────────────
-- The view is removed entirely in S3 (it + buildTimelineItems are
-- replaced by the JS draft assembler). Repointed here so Overview stays
-- correct in the interim window. Same column mapping; chore half now
-- reads the chore_block commitments.
create or replace view public.timeline_items
  with (security_invoker = on) as
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
    null::timestamptz              as ended_at,
    null::uuid                     as place_id
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
    cr.ended_at                    as ended_at,
    null::uuid                     as place_id
  from public.commitments cr
  where cr.source_type = 'chore_block';

grant select on public.timeline_items to authenticated;
