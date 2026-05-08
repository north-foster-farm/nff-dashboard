-- 0008_user_prefs_chore_groups_messages.sql
-- Two new domains:
--   1. user_preferences  — per-user theme / density.
--   2. chore_messages    — sticky-note style notes pinned to a chore;
--      the unaddressed subset surfaces in a global inbox.
--
-- Originally also shipped chore_groups + chore_group_members, retired
-- in Batch 10 (2026-05-07) once site- and block-driven partitioning
-- subsumed the manual grouping. Pre-production phase, so the
-- migration is amended in place rather than chained.

-- ── user_preferences ───────────────────────────────────────────────────
-- A row per signed-in user. Email is the natural key (admins table is
-- keyed the same way). Theme and density mirror what the boot script in
-- index.html reads from localStorage; storing them in the DB lets a
-- preference follow the user across devices.
create table if not exists public.user_preferences (
  user_email text primary key,
  theme text not null default 'dark'
    check (theme in ('dark', 'light')),
  density text not null default 'compact'
    check (density in ('compact', 'comfortable', 'spacious')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_read on public.user_preferences;
create policy user_preferences_self_read on public.user_preferences
  for select to authenticated
  using (user_email = (auth.jwt() ->> 'email'));

drop policy if exists user_preferences_self_insert on public.user_preferences;
create policy user_preferences_self_insert on public.user_preferences
  for insert to authenticated
  with check (
    user_email = (auth.jwt() ->> 'email')
    and public.current_user_is_admin()
  );

drop policy if exists user_preferences_self_update on public.user_preferences;
create policy user_preferences_self_update on public.user_preferences
  for update to authenticated
  using (user_email = (auth.jwt() ->> 'email'))
  with check (user_email = (auth.jwt() ->> 'email'));

create or replace function public.touch_user_preferences_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_user_preferences_updated_at();


-- ── chore_messages ─────────────────────────────────────────────────────
-- Sticky notes left on a chore. The set with addressed_at IS NULL forms
-- the global "needs attention" inbox surfaced in the top bar.
create table if not exists public.chore_messages (
  id uuid primary key default gen_random_uuid(),
  chore_id text not null,
  body text not null check (length(btrim(body)) > 0),
  author_email text not null,
  created_at timestamptz not null default now(),
  addressed_at timestamptz,
  addressed_by_email text
);

create index if not exists chore_messages_unaddressed_idx
  on public.chore_messages (created_at desc) where addressed_at is null;
create index if not exists chore_messages_chore_idx
  on public.chore_messages (chore_id, created_at desc);

alter table public.chore_messages enable row level security;

drop policy if exists chore_messages_read on public.chore_messages;
create policy chore_messages_read on public.chore_messages
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_messages_insert on public.chore_messages;
create policy chore_messages_insert on public.chore_messages
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and author_email = (auth.jwt() ->> 'email')
  );

-- Any admin can mark a message addressed (or unaddressed) — the inbox is
-- a team-wide queue. Authors can edit / delete their own message body.
drop policy if exists chore_messages_update on public.chore_messages;
create policy chore_messages_update on public.chore_messages
  for update to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists chore_messages_delete on public.chore_messages;
create policy chore_messages_delete on public.chore_messages
  for delete to authenticated
  using (
    public.current_user_is_admin()
    and author_email = (auth.jwt() ->> 'email')
  );


-- ── Realtime ───────────────────────────────────────────────────────────
-- Add the new tables to the supabase_realtime publication so the client
-- gets push updates for chore-group changes and incoming messages
-- without polling.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_preferences'
  ) then
    execute 'alter publication supabase_realtime add table public.user_preferences';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_messages';
  end if;
end $$;
