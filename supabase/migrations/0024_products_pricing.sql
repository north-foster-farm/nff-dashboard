-- 0024_products_pricing.sql
-- Products + pricing foundation (Batch 27). All of Batch 27's schema
-- lands here in one migration so production needs a single push for
-- the whole batch (27.1 CRUD/content, 27.2 pricing UI, 27.3 sales +
-- bundles all read/write these objects).
--
--   product_kinds (extended)
--                     — catalog/content columns layered onto the
--                       existing SKU table: photo, the four-slot
--                       description content (what-it-is / cooking /
--                       sourcing / nutrition — the structure every
--                       researched farm storefront converges on),
--                       sold-out flag, bundle support, soft archive.
--   product_prices    — append-only price log. The current price of a
--                       SKU (product kind × size bracket) is simply
--                       the newest row for that pair; price history
--                       falls out of the schema for free. compare_at
--                       is the strike-through "was" price.
--   product_sales     — manual sales records (Batch 27.3's "record a
--                       sale" form writes here). Point of sale (Batch
--                       28) and Orders (Batch 29) will write the same
--                       table so the sales-over-time chart never needs
--                       to change its source.
--   product-photos    — Storage bucket for staged product shots, same
--                       conventions as the project-files bucket (0017).

-- ── product_kinds: catalog + content columns ─────────────────────────
-- All additive. `content` carries the four description slots as jsonb:
--   { "whatItIs": "...", "cooking": "...", "sourcing": "...",
--     "nutrition": "..." }
-- `bundle_contents` (only read when is_bundle) is an array of
-- components:
--   [{ "productKindId": "whole_chicken", "bracketId": "wc_35_4",
--      "quantity": 2 }, ...]
-- `average_per_package` is the optional "Average 8 feet per package"
-- note observed on Pat's listings, for SKUs that aren't bracketed.
alter table public.product_kinds
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists photo_path text,
  add column if not exists sold_out boolean not null default false,
  add column if not exists is_bundle boolean not null default false,
  add column if not exists bundle_contents jsonb not null default '[]'::jsonb,
  add column if not exists average_per_package text,
  add column if not exists archived_at timestamptz,
  add column if not exists created_at timestamptz not null default now();


-- ── product_prices ────────────────────────────────────────────────────
-- Append-only: every price change inserts a new row; nothing updates
-- or deletes rows (the UI never exposes it). bracket_id references
-- product_kinds.size_brackets[].id; null means the price applies to
-- the product as a whole (eggs' single "default" bracket, bundles).
create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_kind_id text not null
    references public.product_kinds(id) on delete cascade,
  bracket_id text,
  price_cents integer not null check (price_cents >= 0),
  compare_at_cents integer check (compare_at_cents >= 0),
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists product_prices_sku_idx
  on public.product_prices (product_kind_id, bracket_id, created_at desc);

alter table public.product_prices enable row level security;

drop policy if exists product_prices_read on public.product_prices;
create policy product_prices_read on public.product_prices
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists product_prices_write on public.product_prices;
create policy product_prices_write on public.product_prices
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── product_sales ─────────────────────────────────────────────────────
-- One row per sale line: what sold, how many, for how much, through
-- which channel. quantity is numeric so by-weight quantities (e.g.
-- 1.5 dozen, 12.4 lb wholesale) stay representable.
create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  sold_on date not null default current_date,
  product_kind_id text not null
    references public.product_kinds(id) on delete restrict,
  bracket_id text,
  quantity numeric not null default 1,
  total_cents integer not null check (total_cents >= 0),
  channel text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists product_sales_sold_on_idx
  on public.product_sales (sold_on desc);
create index if not exists product_sales_kind_idx
  on public.product_sales (product_kind_id, sold_on desc);

alter table public.product_sales enable row level security;

drop policy if exists product_sales_read on public.product_sales;
create policy product_sales_read on public.product_sales
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists product_sales_write on public.product_sales;
create policy product_sales_write on public.product_sales
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── realtime ──────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'product_kinds', 'product_prices', 'product_sales'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;


-- ── Storage: the product-photos bucket ───────────────────────────────
-- Bucket creation is a plain insert (works under the postgres role).
-- Policies on storage.objects need table ownership, which newer hosted
-- Supabase projects reserve for supabase_storage_admin — so they're
-- attempted in a guarded block. If the block raises a warning, add the
-- four policies by hand: Dashboard → Storage → product-photos →
-- Policies → "give admins full access" (select/insert/update/delete
-- for authenticated, USING bucket_id = 'product-photos' AND
-- public.current_user_is_admin()).
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', false)
on conflict (id) do nothing;

do $$
begin
  begin
    execute $pol$
      create policy product_photos_select on storage.objects
        for select to authenticated
        using (
          bucket_id = 'product-photos'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy product_photos_insert on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'product-photos'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy product_photos_update on storage.objects
        for update to authenticated
        using (
          bucket_id = 'product-photos'
          and public.current_user_is_admin()
        )
    $pol$;
    execute $pol$
      create policy product_photos_delete on storage.objects
        for delete to authenticated
        using (
          bucket_id = 'product-photos'
          and public.current_user_is_admin()
        )
    $pol$;
  exception
    when insufficient_privilege then
      raise warning
        'storage.objects policies not created (insufficient privilege) — add them via the Dashboard';
    when duplicate_object then
      null; -- policies already exist (re-run)
  end;
end $$;
