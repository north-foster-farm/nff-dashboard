-- 0019_chore_run_participants.sql
-- Who is actually doing a round (chore-ux fix batch, 2026-06).
--
-- chore_runs has always been a single shared row per (block, day) —
-- fine for one person, but with two people doing chores together the
-- run lifecycle needs to know who has joined and who has finished:
--
--   * Opening the Rounds doing surface for an in-progress run joins it
--     (upsert; re-opening is a no-op).
--   * The new "Finish" button marks the participant finished. The run
--     itself only ends when EVERY joined participant has finished (or
--     ended the round another way) — one person finishing early
--     doesn't yank the round away from the other.
--   * Cancel follows the same gating.
--
-- Participant writes go straight to Supabase (not through the offline
-- outbox): multi-person coordination is only meaningful online, and a
-- solo offline run ends through the existing run_end outbox op without
-- ever touching this table.

create table if not exists public.chore_run_participants (
  run_id uuid not null
    references public.chore_runs(id) on delete cascade,
  user_email text not null,
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (run_id, user_email)
);

create index if not exists chore_run_participants_run_idx
  on public.chore_run_participants (run_id);

alter table public.chore_run_participants enable row level security;

-- Any admin can read who's in a run; each user only writes their own
-- participation row (same per-user pattern as inbox_item_reads).
drop policy if exists chore_run_participants_read
  on public.chore_run_participants;
create policy chore_run_participants_read on public.chore_run_participants
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists chore_run_participants_insert
  on public.chore_run_participants;
create policy chore_run_participants_insert on public.chore_run_participants
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );

drop policy if exists chore_run_participants_update
  on public.chore_run_participants;
create policy chore_run_participants_update on public.chore_run_participants
  for update to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );

drop policy if exists chore_run_participants_delete
  on public.chore_run_participants;
create policy chore_run_participants_delete on public.chore_run_participants
  for delete to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'chore_run_participants'
  ) then
    execute 'alter publication supabase_realtime add table '
      || 'public.chore_run_participants';
  end if;
end $$;
