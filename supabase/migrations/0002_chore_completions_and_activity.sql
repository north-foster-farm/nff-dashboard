-- ============================================================================
-- 0002_chore_completions_and_activity.sql
-- ============================================================================
-- Adds the three mutation-bearing tables for the dashboard's day-to-day work:
--
--   1. chore_completions   — checkbox state for each chore on each day
--   2. batch_assignments   — which broiler batch is tied to each processing event
--   3. activity_log        — append-only audit trail, populated by triggers
--
-- All three are admin-only (no anon access). Every policy delegates to
-- public.current_user_is_admin(), the SECURITY DEFINER helper from migration
-- 0001 that checks the JWT email against the admins allowlist.
--
-- Apply: paste this whole file into Supabase → SQL Editor → Run.
-- Idempotent: safe to re-run.
-- ============================================================================


-- ── chore_completions ───────────────────────────────────────────────────────
-- One row per (chore, place, day). Re-checking after un-checking creates a
-- new row with a new completed_at timestamp; we don't keep history of
-- toggles (the activity_log captures that anyway).
--
-- Uniqueness is NOT defined here: the per-place grain needs a `place_id`
-- FK to `places`, which doesn't exist until migration 0009. That migration
-- adds the column and the partial unique indexes that key completions to
-- (chore_id, place_id, completion_date).
create table if not exists public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id text not null,
  completion_date date not null,
  completed_by_email text not null,
  completed_at timestamptz not null default now(),
  notes text
);

create index if not exists chore_completions_date_idx
  on public.chore_completions (completion_date desc);
create index if not exists chore_completions_chore_idx
  on public.chore_completions (chore_id);

alter table public.chore_completions enable row level security;

-- Read: any admin sees every completion (the dashboard shows everyone's work).
drop policy if exists chore_completions_read on public.chore_completions;
create policy chore_completions_read on public.chore_completions
  for select to authenticated
  using (public.current_user_is_admin());

-- Insert: an admin can only insert a row claiming THEIR own email did it.
-- Stops one admin from spoofing completions on behalf of the other.
drop policy if exists chore_completions_insert on public.chore_completions;
create policy chore_completions_insert on public.chore_completions
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and completed_by_email = (auth.jwt() ->> 'email')
  );

-- Delete (uncheck): any admin can revert any completion. Two-person team,
-- mutual trust — keeping the door open for "I checked the wrong row".
drop policy if exists chore_completions_delete on public.chore_completions;
create policy chore_completions_delete on public.chore_completions
  for delete to authenticated
  using (public.current_user_is_admin());

-- (No update policy. Edits are delete + re-insert by design — keeps the
-- activity log clean and avoids partial-update ambiguity.)


-- ── batch_assignments ───────────────────────────────────────────────────────
-- Maps a processing-day event-instance ID to a broiler-batch ID. Schema-only
-- for now; the picker UI lands later. event_instance_id is the primary key
-- so re-assigning is just an upsert.
create table if not exists public.batch_assignments (
  event_instance_id text primary key,
  batch_id text not null,
  assigned_by_email text not null,
  assigned_at timestamptz not null default now()
);

alter table public.batch_assignments enable row level security;

drop policy if exists batch_assignments_read on public.batch_assignments;
create policy batch_assignments_read on public.batch_assignments
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists batch_assignments_insert on public.batch_assignments;
create policy batch_assignments_insert on public.batch_assignments
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and assigned_by_email = (auth.jwt() ->> 'email')
  );

drop policy if exists batch_assignments_update on public.batch_assignments;
create policy batch_assignments_update on public.batch_assignments
  for update to authenticated
  using (public.current_user_is_admin())
  with check (
    public.current_user_is_admin()
    and assigned_by_email = (auth.jwt() ->> 'email')
  );


-- ── activity_log ────────────────────────────────────────────────────────────
-- Append-only. Populated by triggers on the mutation tables; never written
-- to from the client. The payload is jsonb so we can add new "kinds" of
-- activity over time without further migrations — just write whatever
-- fields the new kind needs and have the renderer key off `kind`.
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_email text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists activity_log_occurred_idx
  on public.activity_log (occurred_at desc);
create index if not exists activity_log_actor_idx
  on public.activity_log (actor_email);
create index if not exists activity_log_kind_idx
  on public.activity_log (kind);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log
  for select to authenticated
  using (public.current_user_is_admin());

-- No insert/update/delete policies for clients. The trigger functions below
-- run as SECURITY DEFINER so they bypass RLS and can write the log without
-- needing a client-facing insert policy. This guarantees every activity_log
-- row was authored by a trigger, not directly by a user.


-- ── Triggers: chore completion → activity_log ──────────────────────────────
-- INSERT into chore_completions logs `chore_completed`.
-- DELETE from chore_completions logs `chore_uncompleted`.
create or replace function public.log_chore_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (actor_email, kind, payload, occurred_at)
  values (
    new.completed_by_email,
    'chore_completed',
    jsonb_build_object(
      'chore_id', new.chore_id,
      'completion_date', new.completion_date,
      'notes', new.notes
    ),
    new.completed_at
  );
  return new;
end;
$$;

drop trigger if exists chore_completion_logged on public.chore_completions;
create trigger chore_completion_logged
  after insert on public.chore_completions
  for each row execute function public.log_chore_completion();

create or replace function public.log_chore_uncompletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  -- Prefer the JWT email (the admin who unchecked) but fall back to the
  -- original completer if the call is somehow running without a JWT.
  actor := coalesce((auth.jwt() ->> 'email')::text, old.completed_by_email);
  insert into public.activity_log (actor_email, kind, payload)
  values (
    actor,
    'chore_uncompleted',
    jsonb_build_object(
      'chore_id', old.chore_id,
      'completion_date', old.completion_date,
      'originally_completed_by', old.completed_by_email
    )
  );
  return old;
end;
$$;

drop trigger if exists chore_uncompletion_logged on public.chore_completions;
create trigger chore_uncompletion_logged
  after delete on public.chore_completions
  for each row execute function public.log_chore_uncompletion();


-- ── Triggers: batch assignment → activity_log ──────────────────────────────
create or replace function public.log_batch_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_log (actor_email, kind, payload)
  values (
    new.assigned_by_email,
    case when tg_op = 'INSERT' then 'batch_assigned' else 'batch_reassigned' end,
    jsonb_build_object(
      'event_instance_id', new.event_instance_id,
      'batch_id', new.batch_id,
      'previous_batch_id', case when tg_op = 'UPDATE' then old.batch_id else null end
    )
  );
  return new;
end;
$$;

drop trigger if exists batch_assignment_logged on public.batch_assignments;
create trigger batch_assignment_logged
  after insert or update on public.batch_assignments
  for each row execute function public.log_batch_assignment();


-- ── Lock down trigger functions ────────────────────────────────────────
-- These are invoked by triggers (which run as the table owner), so no
-- role needs EXECUTE. Revoke it so they aren't exposed as PostgREST RPCs
-- (Supabase grants anon/authenticated execute by default; `revoke from
-- public` alone doesn't remove those explicit grants).
-- log_chore_uncompletion is redefined + revoked in 0007; both completion
-- trigger functions are redefined again in 0010 (place awareness).
revoke execute on function public.log_chore_completion()
  from public, anon, authenticated;
revoke execute on function public.log_batch_assignment()
  from public, anon, authenticated;


-- ── Realtime: enable change broadcasts for the read tables ─────────────────
-- Lets the JS client subscribe to chore_completions / activity_log changes
-- via supabase.channel(...).on('postgres_changes', ...) so two admins on
-- two phones see each other's checkboxes update live.
alter publication supabase_realtime add table public.chore_completions;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.batch_assignments;
