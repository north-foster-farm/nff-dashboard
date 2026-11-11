-- 0053_orders_from_site.sql
-- Commerce, step 1 of the 2026-09-19 plan (CLAUDE.md, "How the
-- projects meet"): make Supabase the record of the orders the public
-- site takes, so the Square Dashboard stops being the farm's only
-- view of one. The site pays through Square (cards, wallets) and
-- PayPal (Venmo), and a buying-group member's credit can cover a
-- whole order, so payment_provider and order_events.source allow
-- `square`, `venmo` and `credit`, the values the site writes as
-- payment.via (#471). (Corrected 2026-11-11, #29: it said `stripe`,
-- which the Square launch overtook, and so rejected every Venmo
-- order.)
--
-- Additive-only. Nothing in the app reads the new columns yet; the
-- site's functions write them next (step 2) and the Orders page
-- renders them after that (step 3).
--
--   orders       — site_order_id (the NFF-YYMM-XXXX id the customer
--                  reads), source, the processor as a column
--                  (payment_provider + payment_ref, not an
--                  architecture), the scheduled date, window and
--                  pickup site, discount_cents, and cancel_reason
--                  (a site order that lapses unpaid is `abandoned`
--                  there and `cancelled` here).
--   order_lines  — sku and label, so a site line can land before the
--                  SKU-to-product_kind mapping exists (the site has
--                  37 SKUs; product_kinds covers six of the cuts,
--                  with brackets drawn differently). product_kind_id
--                  becomes nullable under the same "at least one
--                  identifier" check customers uses. Until a line is
--                  mapped, fulfilling it cannot write product_sales;
--                  that is step 3's problem, not this migration's.
--   order_events — append-only log per order: what happened, when,
--                  reported by which system. The columns on orders
--                  are the projection; this is the record. Admins
--                  may insert and read; nothing updates or deletes.
--                  The site writes with the service key, which
--                  bypasses RLS, so the policies bind the app only.
--
-- Status mapping the site will use in step 2:
--   submitted → open              paid → open + paid_at
--   fulfilled → fulfilled         cancelled, abandoned → cancelled
-- Its fulfilment methods onfarm and scituate are both `pickup` here,
-- told apart by fulfillment_site.
--
-- PRE-APPLY PROTOCOL:
--   1. node scripts/backup-db.mjs (fresh full export).
--   2. James authorizes `supabase db push --linked` explicitly.
--   3. Verify after: the queries in the trailing comment.

-- ── orders ────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists site_order_id text,
  add column if not exists source text not null default 'dashboard',
  add column if not exists payment_provider text,
  add column if not exists payment_ref text,
  add column if not exists fulfill_on date,
  add column if not exists fulfillment_window text,
  add column if not exists fulfillment_site text,
  add column if not exists discount_cents integer,
  add column if not exists cancel_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_source_check
      check (source in ('dashboard', 'site', 'pos'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_provider_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_provider_check
      check (payment_provider is null
        or payment_provider in ('square', 'venmo', 'credit'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_fulfillment_window_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_fulfillment_window_check
      check (fulfillment_window is null
        or fulfillment_window in ('morning', 'afternoon'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_fulfillment_site_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_fulfillment_site_check
      check (fulfillment_site is null
        or fulfillment_site in ('farm', 'scituate'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_discount_cents_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_discount_cents_check
      check (discount_cents is null or discount_cents >= 0);
  end if;
end $$;

create unique index if not exists orders_site_order_id_unique
  on public.orders (site_order_id) where site_order_id is not null;
create index if not exists orders_fulfill_on_idx
  on public.orders (fulfill_on) where fulfill_on is not null;
create index if not exists orders_payment_ref_idx
  on public.orders (payment_provider, payment_ref)
  where payment_ref is not null;

-- ── order_lines ───────────────────────────────────────────────────────
alter table public.order_lines
  add column if not exists sku text,
  add column if not exists label text,
  alter column product_kind_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_lines_identity_check'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
      add constraint order_lines_identity_check
      check (product_kind_id is not null or sku is not null);
  end if;
end $$;

create index if not exists order_lines_sku_idx
  on public.order_lines (sku) where sku is not null;

-- ── order_events ──────────────────────────────────────────────────────
-- (order_id, event, at) is unique so a retried write lands once: the
-- site retries anything that fails, and the same event from the same
-- instant is the same event.
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id) on delete cascade,
  at timestamptz not null default now(),
  event text not null,
  source text not null default 'dashboard',
  detail jsonb,
  created_at timestamptz not null default now(),
  check (source in ('dashboard', 'site', 'pos', 'square', 'venmo',
    'credit'))
);

create unique index if not exists order_events_once
  on public.order_events (order_id, event, at);
create index if not exists order_events_order_idx
  on public.order_events (order_id, at);

alter table public.order_events enable row level security;

drop policy if exists order_events_read on public.order_events;
create policy order_events_read on public.order_events
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists order_events_insert on public.order_events;
create policy order_events_insert on public.order_events
  for insert to authenticated
  with check (public.current_user_is_admin());
-- No update or delete policy: the log is append-only from the app.

-- Post-apply verification (prod-read or the SQL editor):
--   select count(*) from orders where source <> 'dashboard';   -- 0
--   select count(*) from order_events;                          -- 0
--   select is_nullable from information_schema.columns
--     where table_name = 'order_lines'
--       and column_name = 'product_kind_id';                    -- YES
