-- 0027_inventory.sql
-- Inventory foundation (Batch 28.1). The real, DB-backed inventory
-- replacing the Batch-4 static stubs. Lot-based by design decision
-- (2026-06-02): a lot is "12 whole chickens, 3.5–4 lb, processed
-- Jun 23, in the Fred freezer" — provenance and freshness stay
-- attached to the count, and sales (Batch 28.2 POS) decrement lots
-- oldest-first.
--
--   inventory_lots      — one row per lot: product kind × bracket ×
--                         lot date × place, with the current on-hand
--                         quantity. On-hand by SKU/location is a
--                         GROUP BY away.
--   inventory_movements — append-only audit of every quantity change:
--                         creation, manual adjustment, spoilage, and
--                         (28.2) the sale that drew it down. sale_id
--                         links a movement to its product_sales row.
--
-- The Batch-4 placeholder tables (egg_lots, chicken_lots — both empty
-- in production) are superseded by inventory_lots but left untouched
-- per the additive-only rule. Storage locations are places
-- (places.id FK) — freezers/fridges get added to the place tree via
-- the existing Edit-places page, not as free text.

-- ── inventory_lots ────────────────────────────────────────────────────
-- bracket_id references product_kinds.size_brackets[].id; null means
-- the lot is of a non-bracketed product (eggs, bundles' components are
-- never lotted). quantity is numeric so by-weight lots (e.g. 12.4 lb
-- of stew meat) stay representable, mirroring product_sales.quantity.
create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  product_kind_id text not null
    references public.product_kinds(id) on delete restrict,
  bracket_id text,
  lot_date date not null default current_date,
  quantity numeric not null default 0 check (quantity >= 0),
  initial_quantity numeric not null default 0
    check (initial_quantity >= 0),
  place_id uuid references public.places(id) on delete set null,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_lots_sku_idx
  on public.inventory_lots (product_kind_id, bracket_id, lot_date);
create index if not exists inventory_lots_place_idx
  on public.inventory_lots (place_id) where place_id is not null;
-- Open lots (quantity > 0) are what the on-hand rollup and the FIFO
-- sale allocation (28.2) read.
create index if not exists inventory_lots_open_idx
  on public.inventory_lots (product_kind_id, lot_date)
  where quantity > 0;

alter table public.inventory_lots enable row level security;

drop policy if exists inventory_lots_read on public.inventory_lots;
create policy inventory_lots_read on public.inventory_lots
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists inventory_lots_write on public.inventory_lots;
create policy inventory_lots_write on public.inventory_lots
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── inventory_movements ───────────────────────────────────────────────
-- Append-only. delta is signed: positive in (lot created, recount up),
-- negative out (sale, spoilage, recount down). The lot's quantity
-- column is the running total; movements are the audit trail that
-- explains it.
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null
    references public.inventory_lots(id) on delete cascade,
  delta numeric not null,
  reason text not null default 'adjustment'
    check (reason in ('created', 'sale', 'adjustment', 'spoilage')),
  sale_id uuid references public.product_sales(id) on delete set null,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_lot_idx
  on public.inventory_movements (lot_id, created_at desc);
create index if not exists inventory_movements_sale_idx
  on public.inventory_movements (sale_id) where sale_id is not null;

alter table public.inventory_movements enable row level security;

drop policy if exists inventory_movements_read
  on public.inventory_movements;
create policy inventory_movements_read on public.inventory_movements
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists inventory_movements_write
  on public.inventory_movements;
create policy inventory_movements_write on public.inventory_movements
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── realtime ──────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'inventory_lots', 'inventory_movements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
