-- 0016_inbox.sql
-- Inbox / "just a thought…" capture for Batch 21.
--
--   inbox_items       — one row per captured thought. Pinned items
--                       stick to the top of the Inbox page; archiving
--                       moves an item to the Archived tab (and back).
--                       sort_order is the drag-and-drop position
--                       within its group (pinned / unpinned spaces
--                       are independent).
--   inbox_item_reads  — per-user read receipts. A row means that user
--                       has read that item; explicit mark-unread just
--                       deletes the row.
--
-- Quiet by design: no push notifications. New items surface in the
-- top-bar bell dropdown and on the Inbox page.

-- ── inbox_items ──────────────────────────────────────────────────────
create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  pinned boolean not null default false,
  archived_at timestamptz,
  sort_order int not null default 0
);

create index if not exists inbox_items_active_idx
  on public.inbox_items (pinned desc, sort_order, created_at desc)
  where archived_at is null;
create index if not exists inbox_items_archived_idx
  on public.inbox_items (archived_at desc)
  where archived_at is not null;

alter table public.inbox_items enable row level security;

drop policy if exists inbox_items_read on public.inbox_items;
create policy inbox_items_read on public.inbox_items
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists inbox_items_write on public.inbox_items;
create policy inbox_items_write on public.inbox_items
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── inbox_item_reads ─────────────────────────────────────────────────
create table if not exists public.inbox_item_reads (
  item_id uuid not null
    references public.inbox_items(id) on delete cascade,
  user_email text not null,
  read_at timestamptz not null default now(),
  primary key (item_id, user_email)
);

alter table public.inbox_item_reads enable row level security;

-- Any admin can see who has read what; each user only writes / removes
-- their own read receipts.
drop policy if exists inbox_item_reads_read on public.inbox_item_reads;
create policy inbox_item_reads_read on public.inbox_item_reads
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists inbox_item_reads_insert on public.inbox_item_reads;
create policy inbox_item_reads_insert on public.inbox_item_reads
  for insert to authenticated
  with check (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );
drop policy if exists inbox_item_reads_delete on public.inbox_item_reads;
create policy inbox_item_reads_delete on public.inbox_item_reads
  for delete to authenticated
  using (
    public.current_user_is_admin()
    and user_email = (auth.jwt() ->> 'email')
  );


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array['inbox_items', 'inbox_item_reads'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
