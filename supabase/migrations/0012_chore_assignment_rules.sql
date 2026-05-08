-- 0012_chore_assignment_rules.sql
-- Chore assignment rules engine for Batch 12.
--
--   chore_assignment_rules — small day-of-week DSL captured as data
--   instead of in-James's-head. Two scopes:
--     * 'chore' — applies to one chore_definitions row (scope_id =
--       chore_definitions.id, which is text, not uuid).
--     * 'block' — applies to every chore in one chore_blocks row
--       (scope_id = chore_blocks.id, which is uuid).
--
--   The scope discriminator means we can't FK scope_id back to a
--   single table, so the resolver does the lookups in JS rather
--   than at the DB level. ON DELETE cleanup happens via two
--   matching trigger fns: deleting a chore or block clears any
--   matching rules.
--
--   days_of_week is an int[] of JS-style day numbers (Sun=0…Sat=6).
--   assignees is text[] — plain display names ("James", "Jim") to
--   match the legacy chore_definitions.assignment shape. priority
--   lets two overlapping rules pick a winner (higher wins); within
--   the same scope we tiebreak on created_at desc.

create table if not exists public.chore_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('chore', 'block')),
  scope_id text not null,
  days_of_week int[] not null check (
    array_length(days_of_week, 1) > 0
    and array_length(days_of_week, 1) <= 7
  ),
  assignees text[] not null check (array_length(assignees, 1) > 0),
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chore_assignment_rules_scope_idx
  on public.chore_assignment_rules (scope, scope_id, priority desc)
  where is_active = true;

alter table public.chore_assignment_rules enable row level security;

drop policy if exists chore_assignment_rules_read on public.chore_assignment_rules;
create policy chore_assignment_rules_read on public.chore_assignment_rules
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_assignment_rules_write on public.chore_assignment_rules;
create policy chore_assignment_rules_write on public.chore_assignment_rules
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_chore_assignment_rules_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_assignment_rules_updated_at
  on public.chore_assignment_rules;
create trigger chore_assignment_rules_updated_at
  before update on public.chore_assignment_rules
  for each row execute function public.touch_chore_assignment_rules_updated_at();


-- ── ON DELETE cleanup triggers ───────────────────────────────────────
-- scope_id can't be a real FK because it points at two different
-- tables depending on the scope discriminator. So we mirror the
-- ON DELETE CASCADE behavior with two triggers, one per parent.

create or replace function public.purge_chore_assignment_rules_for_chore()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.chore_assignment_rules
  where scope = 'chore' and scope_id = old.id;
  return old;
end;
$$;

drop trigger if exists chore_definitions_purge_rules
  on public.chore_definitions;
create trigger chore_definitions_purge_rules
  before delete on public.chore_definitions
  for each row execute function public.purge_chore_assignment_rules_for_chore();

create or replace function public.purge_chore_assignment_rules_for_block()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.chore_assignment_rules
  where scope = 'block' and scope_id = old.id::text;
  return old;
end;
$$;

drop trigger if exists chore_blocks_purge_rules
  on public.chore_blocks;
create trigger chore_blocks_purge_rules
  before delete on public.chore_blocks
  for each row execute function public.purge_chore_assignment_rules_for_block();


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'chore_assignment_rules'
  ) then
    execute 'alter publication supabase_realtime add table '
         || 'public.chore_assignment_rules';
  end if;
end $$;
