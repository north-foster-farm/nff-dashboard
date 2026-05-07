-- 0010_chores_run_events.sql
-- Run Events: typed activity_log rows written by Rounds quick actions.
--
--   * activity_log gains run_id / site_id / location_id columns so a
--     Run Event can carry the chore_run + site context that produced
--     it. Existing rows (chore_completed, batch_assigned…) leave them
--     null and keep working unchanged.
--
--   * activity_log_condition_states — child rows for the multi-select
--     Condition quick action. One activity_log row per "condition
--     observation," N child rows for the chips picked.
--
--   * log_run_event RPC — security definer wrapper that inserts into
--     activity_log + the optional child table in a single transaction.
--     Replaces the trigger-only invariant for these new kinds: the
--     RPC is the single client-callable entry point, so direct INSERT
--     into activity_log stays denied by RLS.

-- ── activity_log: add run / site / location columns ──────────────────
alter table public.activity_log
  add column if not exists run_id uuid
    references public.chore_runs(id) on delete set null;
alter table public.activity_log
  add column if not exists site_id uuid
    references public.sites(id) on delete set null;
alter table public.activity_log
  add column if not exists location_id uuid
    references public.site_locations(id) on delete set null;

create index if not exists activity_log_run_idx
  on public.activity_log (run_id) where run_id is not null;
create index if not exists activity_log_site_idx
  on public.activity_log (site_id) where site_id is not null;
create index if not exists activity_log_location_idx
  on public.activity_log (location_id) where location_id is not null;


-- ── activity_log_condition_states ────────────────────────────────────
-- One row per condition chip selected on a `condition_observed` entry.
-- Cascades on parent delete so removing the activity_log row cleans up
-- its chips automatically.
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
-- Conditions array is only meaningful when kind = 'condition_observed';
-- for any other kind it's ignored.
create or replace function public.log_run_event(
  p_kind text,
  p_payload jsonb,
  p_run_id uuid default null,
  p_site_id uuid default null,
  p_location_id uuid default null,
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
    (actor_email, kind, payload, run_id, site_id, location_id)
  values
    (caller_email, p_kind, coalesce(p_payload, '{}'::jsonb),
     p_run_id, p_site_id, p_location_id)
  returning id into new_id;

  if p_kind = 'condition_observed' and p_conditions is not null then
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
  text, jsonb, uuid, uuid, uuid, text[]
) from public;
grant execute on function public.log_run_event(
  text, jsonb, uuid, uuid, uuid, text[]
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
