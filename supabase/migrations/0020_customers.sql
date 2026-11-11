-- 0020_customers.sql
-- Customers + Lists (Batch 24).
--
--   customers             — the directory. Deliberately minimal
--                           (James's call at the field workshop):
--                           name, email, phone, notes. Everything
--                           else can come additively later.
--   customer_lists        — named lists (title + purpose) for
--                           segmentation / mailing groups. The
--                           Batch 32 farm-updates email blast will
--                           target one of these.
--   customer_list_members — membership (list ↔ customer).
--
-- Seeded with James's existing email list (65 contacts) gathered from
-- the egg drop / farmers market, all placed on one "Mailing list".

-- ── customers ────────────────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A record needs at least something to identify it by.
  check (name is not null or email is not null)
);

-- One record per email address (case-insensitive); customers without
-- an email aren't constrained.
create unique index if not exists customers_email_unique
  on public.customers (lower(email)) where email is not null;
create index if not exists customers_active_idx
  on public.customers (name) where archived_at is null;

create or replace function public.touch_customers_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_customers_updated_at();

alter table public.customers enable row level security;

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── customer_lists ───────────────────────────────────────────────────
create table if not exists public.customer_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  purpose text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_customer_lists_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists customer_lists_touch_updated_at
  on public.customer_lists;
create trigger customer_lists_touch_updated_at
  before update on public.customer_lists
  for each row execute function public.touch_customer_lists_updated_at();

alter table public.customer_lists enable row level security;

drop policy if exists customer_lists_read on public.customer_lists;
create policy customer_lists_read on public.customer_lists
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customer_lists_write on public.customer_lists;
create policy customer_lists_write on public.customer_lists
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── customer_list_members ────────────────────────────────────────────
create table if not exists public.customer_list_members (
  list_id uuid not null
    references public.customer_lists(id) on delete cascade,
  customer_id uuid not null
    references public.customers(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, customer_id)
);

create index if not exists customer_list_members_customer_idx
  on public.customer_list_members (customer_id);

alter table public.customer_list_members enable row level security;

drop policy if exists customer_list_members_read
  on public.customer_list_members;
create policy customer_list_members_read on public.customer_list_members
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists customer_list_members_write
  on public.customer_list_members;
create policy customer_list_members_write on public.customer_list_members
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'customer_lists', 'customer_list_members'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
