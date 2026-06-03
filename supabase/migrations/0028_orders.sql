-- 0028_orders.sql
-- Orders + shipping plumbing (Batch 29). All of Batch 29's schema
-- lands here in one migration so production needs a single push for
-- the whole batch (29.1 CRUD, 29.2 lifecycle + fulfillment, 29.3
-- shipments all read/write these objects).
--
--   orders (extended)  — the 0006 placeholder table grows the real
--                        model: customer FK, lifecycle timestamps
--                        (open → ready → fulfilled, plus cancelled),
--                        payment tracking (paid flag + method),
--                        fulfillment method, ship-to snapshot, and
--                        the shipping charge passed to the customer.
--   order_lines        — one row per line: product × bracket × qty ×
--                        price. Replaces the 0006 line_items jsonb
--                        (left in place, never read). sale_id links a
--                        line to the product_sales row written at
--                        fulfillment (29.2).
--   shipments          — one row per physical shipment of an order.
--                        Shaped after Shippo's object model (shipment
--                        → parcels → label) so the live carrier API
--                        (Batch 30) drops in without a remodel. Until
--                        then James buys labels by hand and pastes
--                        the tracking number in.
--   shipment_parcels   — the boxes: dims, weight, and dry-ice lbs
--                        (cold-chain coolant per the 2026-06-02
--                        workshop).
--   shipping_settings  — singleton row: the state allowlist that caps
--                        how far cold/frozen product may ship.
--   customers.address  — the customer's default ship-to (jsonb).
--   product_sales.order_id
--                      — sales written at fulfillment point back at
--                        their order.

-- ── orders: the real model, layered onto the 0006 placeholder ────────
-- All additive. ship_to shape (mirrors Shippo's address object):
--   { "name": "...", "street1": "...", "street2": "...",
--     "city": "...", "state": "RI", "zip": "02825", "phone": "..." }
alter table public.orders
  add column if not exists customer_id uuid
    references public.customers(id) on delete set null,
  add column if not exists ready_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists fulfillment_method text not null
    default 'pickup',
  add column if not exists ship_to jsonb,
  add column if not exists shipping_cents integer,
  add column if not exists created_by text,
  add column if not exists updated_at timestamptz not null default now();

-- Lifecycle + enum checks. The table is empty in production (0006
-- created it schema-only and nothing has ever written it), so adding
-- constraints is safe; if that ever turns out false the push fails
-- loudly and nothing is lost.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_status_check
      check (status in ('open', 'ready', 'fulfilled', 'cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_payment_method_check
      check (payment_method is null or payment_method in
        ('cash', 'check', 'venmo', 'card', 'other'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_fulfillment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_fulfillment_method_check
      check (fulfillment_method in ('pickup', 'delivery', 'shipping'));
  end if;
end $$;

create index if not exists orders_customer_idx
  on public.orders (customer_id) where customer_id is not null;

create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_orders_updated_at();

-- RLS on orders already exists from 0006 (admin read/write).


-- ── order_lines ───────────────────────────────────────────────────────
-- One row per line: what was ordered, how many, at what price.
-- quantity is numeric so by-weight lines (1.5 dozen, 12.4 lb) stay
-- representable, mirroring product_sales.quantity. unit_price_cents is
-- the catalog price at order time (null when the total was typed by
-- hand); total_cents is what the customer actually pays for the line.
create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id) on delete cascade,
  product_kind_id text not null
    references public.product_kinds(id) on delete restrict,
  bracket_id text,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_cents integer check (unit_price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  notes text,
  sort_order integer not null default 0,
  -- Set at fulfillment (29.2): the product_sales row this line became.
  sale_id uuid references public.product_sales(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_lines_order_idx
  on public.order_lines (order_id, sort_order);
create index if not exists order_lines_sale_idx
  on public.order_lines (sale_id) where sale_id is not null;

alter table public.order_lines enable row level security;

drop policy if exists order_lines_read on public.order_lines;
create policy order_lines_read on public.order_lines
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists order_lines_write on public.order_lines;
create policy order_lines_write on public.order_lines
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── shipments ─────────────────────────────────────────────────────────
-- One row per physical shipment of an order. Statuses follow the
-- manual workflow (and map cleanly onto Shippo transaction states for
-- Batch 30):
--   draft           — being put together; nothing bought yet
--   label_purchased — label bought (on PirateShip/Shippo by hand for
--                     now), tracking number pasted in
--   shipped         — handed to the carrier
--   delivered       — confirmed arrived
--   cancelled       — shipment scrapped (label refunded / voided)
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders(id) on delete cascade,
  status text not null default 'draft'
    check (status in
      ('draft', 'label_purchased', 'shipped', 'delivered', 'cancelled')),
  -- Snapshot of the order's ship_to at shipment creation (the order's
  -- copy can be edited while the order is open; the shipment's copy is
  -- what the label was actually bought for).
  ship_to jsonb not null default '{}'::jsonb,
  carrier text,
  service_level text,
  ship_date date,
  label_cost_cents integer check (label_cost_cents >= 0),
  tracking_number text,
  tracking_url text,
  delivered_at timestamptz,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipments_order_idx
  on public.shipments (order_id, created_at desc);

create or replace function public.touch_shipments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists shipments_touch_updated_at on public.shipments;
create trigger shipments_touch_updated_at
  before update on public.shipments
  for each row execute function public.touch_shipments_updated_at();

alter table public.shipments enable row level security;

drop policy if exists shipments_read on public.shipments;
create policy shipments_read on public.shipments
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists shipments_write on public.shipments;
create policy shipments_write on public.shipments
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── shipment_parcels ──────────────────────────────────────────────────
-- The boxes inside a shipment: dimensions, weight, and the dry-ice
-- coolant load (the cold-chain constraint from the workshop — frozen
-- product ships with dry ice, which caps transit time and distance).
create table if not exists public.shipment_parcels (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null
    references public.shipments(id) on delete cascade,
  length_in numeric check (length_in > 0),
  width_in numeric check (width_in > 0),
  height_in numeric check (height_in > 0),
  weight_lb numeric check (weight_lb > 0),
  dry_ice_lb numeric check (dry_ice_lb >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists shipment_parcels_shipment_idx
  on public.shipment_parcels (shipment_id);

alter table public.shipment_parcels enable row level security;

drop policy if exists shipment_parcels_read on public.shipment_parcels;
create policy shipment_parcels_read on public.shipment_parcels
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists shipment_parcels_write on public.shipment_parcels;
create policy shipment_parcels_write on public.shipment_parcels
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── shipping_settings ─────────────────────────────────────────────────
-- Singleton row (id is a bool primary key locked to true). The state
-- allowlist caps how far cold/frozen product ships: an order whose
-- ship-to state isn't listed gets a warning with a per-order override
-- (29.3 UI). Empty array = not configured yet, no warnings.
create table if not exists public.shipping_settings (
  id boolean primary key default true check (id),
  allowed_states text[] not null default '{}',
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.shipping_settings (id) values (true)
on conflict (id) do nothing;

create or replace function public.touch_shipping_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists shipping_settings_touch_updated_at
  on public.shipping_settings;
create trigger shipping_settings_touch_updated_at
  before update on public.shipping_settings
  for each row execute function public.touch_shipping_settings_updated_at();

alter table public.shipping_settings enable row level security;

drop policy if exists shipping_settings_read on public.shipping_settings;
create policy shipping_settings_read on public.shipping_settings
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists shipping_settings_write on public.shipping_settings;
create policy shipping_settings_write on public.shipping_settings
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── customers: default ship-to ────────────────────────────────────────
-- Same address shape as orders.ship_to. The order form prefills from
-- here; each order keeps its own snapshot so editing a customer's
-- address never rewrites order history.
alter table public.customers
  add column if not exists address jsonb;


-- ── product_sales: link back to the order ─────────────────────────────
-- Sales written at order fulfillment (29.2) carry their order id, so
-- the sales chart can split order revenue from POS / market revenue
-- and an order's money is traceable both directions.
alter table public.product_sales
  add column if not exists order_id uuid
    references public.orders(id) on delete set null;

create index if not exists product_sales_order_idx
  on public.product_sales (order_id) where order_id is not null;


-- ── realtime ──────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'order_lines', 'shipments', 'shipment_parcels',
    'shipping_settings'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
