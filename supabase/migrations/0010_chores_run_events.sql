-- 0010_chores_run_events.sql
-- Run Events: typed activity_log rows written by Rounds quick actions.
--
--   * activity_log gains run_id / place_id columns so a Run Event can
--     carry the chore_run + place context that produced it. Existing
--     rows (chore_completed, batch_assigned…) leave them null and keep
--     working unchanged. (place_id replaces the original site_id /
--     location_id pair as of the Batch 15 place-model collapse.)
--
--   * activity_log_condition_states — child rows for the multi-select
--     MASH-intake quick action. One activity_log row per intake,
--     N child rows for the chips picked. (Originally named for the
--     pre-Batch-10 "Condition" framing; kept the same physical table
--     so the data migration is just a kind-name change.)
--
--   * log_run_event RPC — security definer wrapper that inserts into
--     activity_log + the optional child table in a single transaction.
--     Replaces the trigger-only invariant for these new kinds: the
--     RPC is the single client-callable entry point, so direct INSERT
--     into activity_log stays denied by RLS.

-- ── activity_log: add run / place columns ────────────────────────────
alter table public.activity_log
  add column if not exists run_id uuid
    references public.chore_runs(id) on delete set null;
alter table public.activity_log
  add column if not exists place_id uuid
    references public.places(id) on delete set null;

create index if not exists activity_log_run_idx
  on public.activity_log (run_id) where run_id is not null;
create index if not exists activity_log_place_idx
  on public.activity_log (place_id) where place_id is not null;


-- ── activity_log_condition_states ────────────────────────────────────
-- One row per chip selected on a `mash_intake` entry. Cascades on
-- parent delete so removing the activity_log row cleans up its chips
-- automatically.
create table if not exists public.activity_log_condition_states (
  id uuid primary key default gen_random_uuid(),
  activity_log_id uuid not null
    references public.activity_log(id) on delete cascade,
  state text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_condition_states_log_idx
  on public.activity_log_condition_states (activity_log_id);
create index if not exists activity_log_condition_states_state_idx
  on public.activity_log_condition_states (state);

alter table public.activity_log_condition_states enable row level security;

drop policy if exists alcs_read on public.activity_log_condition_states;
create policy alcs_read on public.activity_log_condition_states
  for select to authenticated
  using (public.current_user_is_admin());

-- No insert/update/delete policies — only the RPC writes here.


-- ── log_run_event RPC ────────────────────────────────────────────────
-- Single client-callable entry point for Rounds quick actions. Inserts
-- one activity_log row + optional condition_states rows in a single
-- transaction. Returns the new activity_log id so the UI can do
-- optimistic-style follow-ups if it wants to.
--
-- Conditions array is only meaningful when kind = 'mash_intake';
-- for any other kind it's ignored.
create or replace function public.log_run_event(
  p_kind text,
  p_payload jsonb,
  p_run_id uuid default null,
  p_place_id uuid default null,
  p_conditions text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  new_id uuid;
  c text;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');
  if caller_email is null then
    raise exception 'caller has no email claim';
  end if;
  if p_kind is null or btrim(p_kind) = '' then
    raise exception 'kind required';
  end if;

  insert into public.activity_log
    (actor_email, kind, payload, run_id, place_id)
  values
    (caller_email, p_kind, coalesce(p_payload, '{}'::jsonb),
     p_run_id, p_place_id)
  returning id into new_id;

  if p_kind = 'mash_intake' and p_conditions is not null then
    foreach c in array p_conditions loop
      if c is not null and btrim(c) <> '' then
        insert into public.activity_log_condition_states
          (activity_log_id, state)
        values (new_id, btrim(c));
      end if;
    end loop;
  end if;

  return new_id;
end;
$$;

revoke all on function public.log_run_event(
  text, jsonb, uuid, uuid, text[]
) from public;
revoke execute on function public.log_run_event(
  text, jsonb, uuid, uuid, text[]
) from anon;
grant execute on function public.log_run_event(
  text, jsonb, uuid, uuid, text[]
) to authenticated;


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'activity_log_condition_states'
  ) then
    execute 'alter publication supabase_realtime add table '
         || 'public.activity_log_condition_states';
  end if;
end $$;


-- ── Chore completion triggers: place awareness (Batch 16.1) ──────────
-- chore_completions gained a place_id column in 0009 (per-place
-- completion grain) and activity_log gained its place_id column above.
-- Redefine both completion trigger functions — last defined in 0002
-- (log_chore_completion) and 0007 (log_chore_uncompletion, debounce) —
-- so the feed rows carry the place that was completed:
--
--   * activity_log.place_id is populated from the completion row.
--   * payload gains place_id + a denormalized place_name so renderers
--     need no join ("completed Feed mobile coops · MC1").
--   * the 10s check↔uncheck debounce from 0007 now also matches on
--     place (NULL-safe), so un-checking MC1 never cancels the feed
--     entry for a fresh MC2 check.

create or replace function public.log_chore_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_name text;
begin
  select name into v_place_name
  from public.places where id = new.place_id;

  insert into public.activity_log
    (actor_email, kind, payload, place_id, occurred_at)
  values (
    new.completed_by_email,
    'chore_completed',
    jsonb_build_object(
      'chore_id', new.chore_id,
      'completion_date', new.completion_date,
      'notes', new.notes,
      'place_id', new.place_id,
      'place_name', v_place_name
    ),
    new.place_id,
    new.completed_at
  );
  return new;
end;
$$;

create or replace function public.log_chore_uncompletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
  v_place_name text;
  recent_completion_id uuid;
begin
  actor := coalesce((auth.jwt() ->> 'email')::text, old.completed_by_email);

  -- Debounce: a matching chore_completed row (same chore, same place,
  -- same day) logged within the last 10 seconds means this was a
  -- misclick — strip both legs of the pair instead of logging.
  select id into recent_completion_id
  from public.activity_log
  where kind = 'chore_completed'
    and (payload ->> 'chore_id') = old.chore_id
    and (payload ->> 'completion_date') = old.completion_date::text
    and (payload ->> 'place_id') is not distinct from (old.place_id::text)
    and occurred_at > now() - interval '10 seconds'
  order by occurred_at desc
  limit 1;

  if recent_completion_id is not null then
    delete from public.activity_log where id = recent_completion_id;
    return old;
  end if;

  select name into v_place_name
  from public.places where id = old.place_id;

  insert into public.activity_log (actor_email, kind, payload, place_id)
  values (
    actor,
    'chore_uncompleted',
    jsonb_build_object(
      'chore_id', old.chore_id,
      'completion_date', old.completion_date,
      'originally_completed_by', old.completed_by_email,
      'place_id', old.place_id,
      'place_name', v_place_name
    ),
    old.place_id
  );
  return old;
end;
$$;

-- Re-bind the triggers (function names unchanged, but re-issue for
-- clarity, matching the 0007 precedent).
drop trigger if exists chore_completion_logged on public.chore_completions;
create trigger chore_completion_logged
  after insert on public.chore_completions
  for each row execute function public.log_chore_completion();

drop trigger if exists chore_uncompletion_logged on public.chore_completions;
create trigger chore_uncompletion_logged
  after delete on public.chore_completions
  for each row execute function public.log_chore_uncompletion();

-- Trigger-only functions; re-revoke EXECUTE after redefinition so they
-- aren't exposed as PostgREST RPCs.
revoke execute on function public.log_chore_completion()
  from public, anon, authenticated;
revoke execute on function public.log_chore_uncompletion()
  from public, anon, authenticated;
