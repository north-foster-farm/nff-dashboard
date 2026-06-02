-- 0021_feeds_overhaul.sql
-- Feed page group-cards redesign (Batch 25.1).
--
--   feed_types.species_id — which animal the feed is for; the Feed
--                           page groups its cards by this. Nullable:
--                           a feed can be non-animal-specific.
--   feed_types.sort_order — drag-reorder position within a species
--                           group.
--   feed_orders           — past feed orders (date, quantity, total
--                           cost, supplier). The source of "last
--                           price paid" and the order-history view.
--   fire_feed_reorder_automations() — replaced so the auto-created
--                           order chore + delivery event carry a
--                           snapshot of EVERY feed's remaining stock,
--                           encouraging consolidated orders (one
--                           freight charge instead of several).

-- ── feed_types: species + sort order ─────────────────────────────────
alter table public.feed_types
  add column if not exists species_id text
    references public.livestock_species(id) on delete set null,
  add column if not exists sort_order integer not null default 0;

create index if not exists feed_types_species_idx
  on public.feed_types (species_id, sort_order);

-- Backfill the seeded feeds. Only touches rows that haven't been
-- assigned a species yet, so re-running (or running after the user
-- has re-pointed a feed) is harmless.
update public.feed_types set species_id = 'broilers'
  where id in ('broiler_starter', 'broiler_grower', 'broiler_finisher')
    and species_id is null;
update public.feed_types set species_id = 'layers'
  where id = 'layer_feed' and species_id is null;
update public.feed_types set species_id = 'sheep'
  where id = 'sheep_hay' and species_id is null;

-- Default order follows the lifecycle: starter → grower → finisher.
update public.feed_types set sort_order = x.ord
from (values
  ('broiler_starter', 0),
  ('broiler_grower', 1),
  ('broiler_finisher', 2),
  ('layer_feed', 0),
  ('sheep_hay', 0)
) as x(id, ord)
where public.feed_types.id = x.id
  and public.feed_types.sort_order = 0;


-- ── feed_orders ──────────────────────────────────────────────────────
-- One row per order placed. quantity is the same { amount, unit }
-- jsonb shape feed_types uses for on_hand / reorder_point. total_cost
-- is dollars for the whole order; per-unit price is derived
-- (total_cost / quantity.amount) so partial-bag math never drifts.
create table if not exists public.feed_orders (
  id uuid primary key default gen_random_uuid(),
  feed_type_id text not null
    references public.feed_types(id) on delete cascade,
  supplier_id text
    references public.suppliers(id) on delete set null,
  ordered_on date not null default current_date,
  received_on date,
  quantity jsonb not null,
  total_cost numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feed_orders_feed_idx
  on public.feed_orders (feed_type_id, ordered_on desc);

create or replace function public.touch_feed_orders_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists feed_orders_touch_updated_at on public.feed_orders;
create trigger feed_orders_touch_updated_at
  before update on public.feed_orders
  for each row execute function public.touch_feed_orders_updated_at();

alter table public.feed_orders enable row level security;

drop policy if exists feed_orders_read on public.feed_orders;
create policy feed_orders_read on public.feed_orders
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists feed_orders_write on public.feed_orders;
create policy feed_orders_write on public.feed_orders
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());


-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'feed_orders'
  ) then
    alter publication supabase_realtime add table public.feed_orders;
  end if;
end $$;


-- ── feed reorder automation: all-feeds stock snapshot ────────────────
-- Replaces the 0015 version. Behavior is identical (edge-triggered on
-- on_hand crossing at-or-below reorder_point, never stacks emissions)
-- with one addition: the order chore's description and the delivery
-- event's payload now carry a snapshot of every feed's remaining
-- stock, so whoever places the order can fold in anything else that's
-- running low and pay for one delivery instead of two.
create or replace function public.fire_feed_reorder_automations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
  emission_id uuid;
  actor text;
  on_hand_amt numeric;
  reorder_amt numeric;
  old_amt numeric;
  delivery_date date;
  order_chore_id text;
  series_id uuid;
  stock_lines text;
  stock_snapshot jsonb;
begin
  if new.on_hand is null or new.reorder_point is null then
    return new;
  end if;

  on_hand_amt := (new.on_hand ->> 'amount')::numeric;
  reorder_amt := (new.reorder_point ->> 'amount')::numeric;
  if on_hand_amt is null or reorder_amt is null
     or on_hand_amt > reorder_amt then
    return new;
  end if;

  -- Edge trigger: if the previous on_hand was already at/below the
  -- reorder point, this is not a new crossing.
  if tg_op = 'UPDATE' and old.on_hand is not null then
    old_amt := (old.on_hand ->> 'amount')::numeric;
    if old_amt is not null and old_amt <= reorder_amt then
      return new;
    end if;
  end if;

  -- Snapshot of every feed's stock level (Batch 25.1). Two shapes
  -- from one pass: a human-readable line list for the chore
  -- description, and a jsonb array for the delivery event's payload
  -- so future UI can render it structurally.
  select
    string_agg(
      '• ' || ft.name || ': '
        || case
             when ft.on_hand is null then 'on-hand not tracked'
             else coalesce(ft.on_hand ->> 'amount', '?') || ' '
               || coalesce(ft.on_hand ->> 'unit', ft.unit, '')
               || case
                    when ft.reorder_point is not null
                      and (ft.on_hand ->> 'amount')::numeric
                        <= (ft.reorder_point ->> 'amount')::numeric
                    then ' — AT/BELOW reorder point ('
                      || (ft.reorder_point ->> 'amount') || ')'
                    else ''
                  end
           end,
      e'\n' order by ft.species_id nulls last, ft.sort_order, ft.name
    ),
    jsonb_agg(
      jsonb_build_object(
        'feed_type_id', ft.id,
        'name', ft.name,
        'on_hand', ft.on_hand,
        'reorder_point', ft.reorder_point
      ) order by ft.species_id nulls last, ft.sort_order, ft.name
    )
  into stock_lines, stock_snapshot
  from public.feed_types ft;

  for rule in
    select * from public.automations
    where trigger_kind = 'inventory_reorder' and enabled
  loop
    -- Never stack emissions for the same feed.
    if exists (
      select 1 from public.automation_emissions
      where automation_id = rule.id and status = 'active'
        and trigger_payload ->> 'feed_type_id' = new.id
    ) then
      continue;
    end if;

    insert into public.automation_emissions
      (automation_id, trigger_payload, summary)
    values (
      rule.id,
      jsonb_build_object('feed_type_id', new.id),
      '"' || new.name || '" is at or below its reorder point ('
        || on_hand_amt || ' / ' || reorder_amt || ' '
        || coalesce(new.reorder_point ->> 'unit', '') || ') — created '
        || 'a feed-order chore and a delivery event.'
    )
    returning id into emission_id;

    -- "Place feed order" chore (one-time, today). The description
    -- closes with the all-feeds stock snapshot so the order can be
    -- consolidated.
    order_chore_id := 'auto_feed_order_' || new.id || '_'
      || to_char(current_date, 'YYYYMMDD');
    insert into public.chore_definitions
      (id, title, category, description, frequency, period,
       anchor_type, automation_emission_id)
    values (
      order_chore_id,
      'Place feed order — ' || new.name,
      'one_time',
      'Auto-created by the feed reorder automation: on-hand stock '
        || 'dropped to or below the reorder point.'
        || e'\n\n'
        || 'Stock across all feeds right now — anything else running '
        || 'low is worth adding to the same order to avoid paying for '
        || 'a second delivery:'
        || e'\n' || coalesce(stock_lines, '(no other feeds tracked)'),
      jsonb_build_object('type', 'once',
        'date', to_char(current_date, 'YYYY-MM-DD')),
      'anytime',
      'none',
      emission_id
    )
    on conflict (id) do nothing;

    -- "Receive feed delivery" event (today + lead time). Payload
    -- carries the structured stock snapshot.
    delivery_date := current_date + coalesce(new.lead_time_days, 7);
    series_id := public.create_auto_event(
      'deliveries', 'Receive feed delivery — ' || new.name,
      delivery_date,
      jsonb_build_object('feed_stock_snapshot', stock_snapshot),
      emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values
      (series_id, 'inventory_item', new.id, 'feed_delivery'),
      (series_id, 'chore', order_chore_id, 'feed_order_chore');

    update public.automations set last_fired_at = now()
      where id = rule.id;

    actor := coalesce(auth.jwt() ->> 'email', 'automation@system');
    insert into public.activity_log (actor_email, kind, payload)
    values (actor, 'automation_fired', jsonb_build_object(
      'automation_id', rule.id,
      'automation_name', rule.name,
      'emission_id', emission_id,
      'feed_type_id', new.id,
      'feed_name', new.name
    ));
  end loop;

  return new;
end;
$$;

-- The trigger itself is unchanged from 0015; recreate it defensively
-- in case this migration ever runs against a database where 0015's
-- trigger was dropped.
drop trigger if exists feed_reorder_automations on public.feed_types;
create trigger feed_reorder_automations
  after insert or update of on_hand on public.feed_types
  for each row execute function public.fire_feed_reorder_automations();
