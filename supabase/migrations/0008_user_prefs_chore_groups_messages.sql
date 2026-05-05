-- 0008_user_prefs_chore_groups_messages.sql
-- Three new domains:
--   1. user_preferences  — per-user theme / density / auto-expand-groups
--   2. chore_groups + chore_group_members — assemble chores into named
--      sets that render as accordion groups everywhere chores appear
--   3. chore_messages    — sticky-note style notes pinned to a chore;
--      the unaddressed subset surfaces in a global inbox

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
  auto_expand_chore_groups boolean not null default false,
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


-- ── chore_groups ───────────────────────────────────────────────────────
-- A named, ordered collection of chore_definitions that get done at the
-- same time and place. Membership is enforced one-to-one via the unique
-- constraint on chore_group_members.chore_id below.
create table if not exists public.chore_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sort_order int not null default 0,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chore_groups_sort_idx
  on public.chore_groups (sort_order, name);

alter table public.chore_groups enable row level security;

drop policy if exists chore_groups_read on public.chore_groups;
create policy chore_groups_read on public.chore_groups
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_groups_write on public.chore_groups;
create policy chore_groups_write on public.chore_groups
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create or replace function public.touch_chore_groups_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chore_groups_updated_at on public.chore_groups;
create trigger chore_groups_updated_at
  before update on public.chore_groups
  for each row execute function public.touch_chore_groups_updated_at();


-- ── chore_group_members ────────────────────────────────────────────────
-- chore_id is unique across the table — a chore lives in at most one
-- group at a time. Re-grouping is a delete-then-insert (or upsert).
create table if not exists public.chore_group_members (
  group_id uuid not null references public.chore_groups(id) on delete cascade,
  chore_id text not null,
  sort_order int not null default 0,
  added_by_email text,
  added_at timestamptz not null default now(),
  primary key (group_id, chore_id)
);

create unique index if not exists chore_group_members_chore_unique
  on public.chore_group_members (chore_id);
create index if not exists chore_group_members_group_idx
  on public.chore_group_members (group_id, sort_order);

alter table public.chore_group_members enable row level security;

drop policy if exists chore_group_members_read on public.chore_group_members;
create policy chore_group_members_read on public.chore_group_members
  for select to authenticated
  using (public.current_user_is_admin());

drop policy if exists chore_group_members_write on public.chore_group_members;
create policy chore_group_members_write on public.chore_group_members
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


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
    where pubname = 'supabase_realtime' and tablename = 'chore_groups'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_groups';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_group_members'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_group_members';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chore_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chore_messages';
  end if;
end $$;
