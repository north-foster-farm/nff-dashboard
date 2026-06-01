-- 0015_automations.sql
-- Triggers engine for Batch 19 (GCal push deferred to a later batch).
--
--   feed_types.on_hand       — on-hand amount so the feed-reorder rule
--                              has a number to compare against
--                              reorder_point. Edited from the Feeds
--                              page.
--   chore_definitions        — gains `retired_at` (one-time chores
--                              retire when completed or dismissed) and
--                              `automation_emission_id` (provenance —
--                              drives the sparkle icon).
--   event_series             — gains `automation_emission_id`
--                              (provenance — sparkle icon).
--   automation_emissions     — one row per automation firing. The
--                              dashboard "Heads up" lane reads rows
--                              with status='active'; acknowledging or
--                              dismissing moves them out of the lane.
--                              Dismissal also tombstones everything
--                              the firing created.
--   trigger functions        — fire_batch_created_automations()
--                              (AFTER INSERT on livestock_groups),
--                              fire_feed_reorder_automations()
--                              (AFTER INSERT/UPDATE on feed_types),
--                              retire_once_chores() (AFTER INSERT on
--                              chore_completions).
--   RPCs                     — acknowledge_automation_emission(),
--                              dismiss_automation_emission().
--   seeds                    — 'batch_milestones' event kind + the two
--                              automation rules (broiler batch
--                              lifecycle, feed reorder).
--
-- One-off events created here follow the 0013 convention: an
-- event_series row with rrule=NULL plus one pre-materialized
-- event_occurrences row carrying the canonical date.


-- ── feed_types: on-hand tracking ─────────────────────────────────────
alter table public.feed_types
  add column if not exists on_hand jsonb,
  add column if not exists on_hand_updated_at timestamptz;


-- ── chore_definitions: retirement + provenance ───────────────────────
alter table public.chore_definitions
  add column if not exists retired_at timestamptz,
  add column if not exists automation_emission_id uuid;

create index if not exists chore_definitions_emission_idx
  on public.chore_definitions (automation_emission_id)
  where automation_emission_id is not null;


-- ── event_series: provenance ─────────────────────────────────────────
alter table public.event_series
  add column if not exists automation_emission_id uuid;

create index if not exists event_series_emission_idx
  on public.event_series (automation_emission_id)
  where automation_emission_id is not null;


-- ── automation_emissions ─────────────────────────────────────────────
create table if not exists public.automation_emissions (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null
    references public.automations(id) on delete cascade,
  fired_at timestamptz not null default now(),
  trigger_payload jsonb not null default '{}'::jsonb,
  summary text not null,
  status text not null default 'active'
    check (status in ('active', 'acknowledged', 'dismissed')),
  acknowledged_at timestamptz,
  acknowledged_by_email text,
  dismissed_at timestamptz,
  dismissed_reason text,
  dismissed_by_email text
);

create index if not exists automation_emissions_status_idx
  on public.automation_emissions (status, fired_at desc)
  where status = 'active';
create index if not exists automation_emissions_automation_idx
  on public.automation_emissions (automation_id, fired_at desc);

alter table public.automation_emissions enable row level security;

drop policy if exists automation_emissions_read on public.automation_emissions;
create policy automation_emissions_read on public.automation_emissions
  for select to authenticated using (public.current_user_is_admin());
drop policy if exists automation_emissions_write on public.automation_emissions;
create policy automation_emissions_write on public.automation_emissions
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Provenance FKs (added after the table exists; SET NULL so deleting
-- an emission never deletes user-visible rows).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chore_definitions_emission_fk'
  ) then
    alter table public.chore_definitions
      add constraint chore_definitions_emission_fk
      foreign key (automation_emission_id)
      references public.automation_emissions(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_series_emission_fk'
  ) then
    alter table public.event_series
      add constraint event_series_emission_fk
      foreign key (automation_emission_id)
      references public.automation_emissions(id) on delete set null;
  end if;
end $$;


-- ── automations: updated_at touch trigger ────────────────────────────
-- The table shipped in 0013 without one; the triggers below update
-- last_fired_at and the Settings UI updates trigger_config/enabled.
create or replace function public.touch_automations_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists automations_updated_at on public.automations;
create trigger automations_updated_at
  before update on public.automations
  for each row execute function public.touch_automations_updated_at();


-- ── seed: batch_milestones event kind ────────────────────────────────
insert into public.event_kinds (id, label, description, ordinal)
values (
  'batch_milestones',
  'Batch milestones',
  'Auto-created livestock batch lifecycle events (arrival, pasture '
    || 'move). Processing days keep their own kind.',
  8
)
on conflict (id) do nothing;


-- ── seed: the two automation rules ───────────────────────────────────
-- Idempotent by trigger_kind + name (automations.id is a generated
-- uuid, so name is the natural key for seeding).
insert into public.automations (name, trigger_kind, trigger_config, actions)
select 'Broiler batch lifecycle', 'batch_created',
  '{
    "species_id": "broilers",
    "pasture_move_weeks": 3,
    "processing_weeks": 8,
    "cleanout_offset_days": 1
  }'::jsonb,
  '[
    {"type": "event", "role": "arrival",
     "kind_id": "batch_milestones", "label": "{batch} — arrival"},
    {"type": "event", "role": "pasture_move",
     "kind_id": "batch_milestones", "label": "{batch} — pasture move",
     "offset": "arrival + pasture_move_weeks"},
    {"type": "event", "role": "processing",
     "kind_id": "processing_days", "label": "{batch} — processing",
     "offset": "arrival + processing_weeks"},
    {"type": "chore", "role": "brooder_cleanout",
     "title": "Brooder cleanout — {batch}",
     "offset": "pasture_move + cleanout_offset_days"}
  ]'::jsonb
where not exists (
  select 1 from public.automations where name = 'Broiler batch lifecycle'
);

insert into public.automations (name, trigger_kind, trigger_config, actions)
select 'Feed reorder', 'inventory_reorder',
  '{}'::jsonb,
  '[
    {"type": "chore", "role": "feed_order",
     "title": "Place feed order — {feed}"},
    {"type": "event", "role": "feed_delivery",
     "kind_id": "deliveries",
     "label": "Receive feed delivery — {feed}",
     "offset": "today + lead_time_days"}
  ]'::jsonb
where not exists (
  select 1 from public.automations where name = 'Feed reorder'
);


-- ── helper: create a one-off auto event ──────────────────────────────
-- Returns the new series id. Internal — not exposed to clients.
create or replace function public.create_auto_event(
  p_kind_id text,
  p_label text,
  p_date date,
  p_payload jsonb,
  p_emission_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_series_id uuid;
begin
  insert into public.event_series
    (kind_id, label, rrule, dtstart, payload, automation_emission_id)
  values
    (p_kind_id, p_label, null, p_date::timestamptz, p_payload,
     p_emission_id)
  returning id into new_series_id;

  insert into public.event_occurrences (series_id, occurs_on, status)
  values (new_series_id, p_date, 'scheduled');

  return new_series_id;
end;
$$;

revoke all on function public.create_auto_event(
  text, text, date, jsonb, uuid
) from public;
revoke execute on function public.create_auto_event(
  text, text, date, jsonb, uuid
) from anon, authenticated;


-- ── trigger: broiler batch lifecycle ─────────────────────────────────
-- Fires on livestock_groups INSERT. Skips firing when an emission for
-- this batch already exists (makes restore-db re-inserts idempotent).
create or replace function public.fire_batch_created_automations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
  species record;
  emission_id uuid;
  actor text;
  arrival date;
  move_date date;
  processing_date date;
  cleanout_date date;
  series_id uuid;
  cleanout_chore_id text;
  batch_label text;
begin
  for rule in
    select * from public.automations
    where trigger_kind = 'batch_created' and enabled
      and trigger_config ->> 'species_id' = new.species_id
  loop
    -- Idempotence guard (restore-db re-inserts, double-fires).
    if exists (
      select 1 from public.automation_emissions
      where automation_id = rule.id
        and trigger_payload ->> 'batch_id' = new.id
    ) then
      continue;
    end if;

    select * into species
      from public.livestock_species where id = new.species_id;
    batch_label := coalesce(species.name || ' — ', '') || new.label;

    arrival := coalesce(new.arrival_date, current_date);
    move_date := arrival + (coalesce(
      (rule.trigger_config ->> 'pasture_move_weeks')::int, 3) * 7);
    processing_date := arrival + (coalesce(
      (rule.trigger_config ->> 'processing_weeks')::int, 8) * 7);
    cleanout_date := move_date + coalesce(
      (rule.trigger_config ->> 'cleanout_offset_days')::int, 1);

    insert into public.automation_emissions
      (automation_id, trigger_payload, summary)
    values (
      rule.id,
      jsonb_build_object('batch_id', new.id),
      'New batch "' || batch_label || '" — created arrival, pasture '
        || 'move, and processing events plus a brooder cleanout chore.'
    )
    returning id into emission_id;

    -- Arrival event.
    series_id := public.create_auto_event(
      'batch_milestones', batch_label || ' — arrival', arrival,
      null, emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values (series_id, 'batch', new.id, 'arrival');

    -- Pasture-move event.
    series_id := public.create_auto_event(
      'batch_milestones', batch_label || ' — pasture move', move_date,
      null, emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values (series_id, 'batch', new.id, 'pasture_move');

    -- Processing event (kind = processing_days).
    series_id := public.create_auto_event(
      'processing_days', batch_label || ' — processing',
      processing_date,
      jsonb_build_object('processing', jsonb_build_object(
        'batchId', new.id,
        'batchSize', new.count,
        'breed', species.breed
      )),
      emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values (series_id, 'batch', new.id, 'processing');

    -- Brooder cleanout chore (one-time, day after pasture move).
    cleanout_chore_id := 'auto_cleanout_' || new.id;
    insert into public.chore_definitions
      (id, title, category, description, frequency, period,
       anchor_type, automation_emission_id)
    values (
      cleanout_chore_id,
      'Brooder cleanout — ' || new.label,
      'one_time',
      'Auto-created by the broiler batch lifecycle automation when '
        || batch_label || ' was added. Clean out the brooder the day '
        || 'after the birds move to pasture.',
      jsonb_build_object('type', 'once',
        'date', to_char(cleanout_date, 'YYYY-MM-DD')),
      'morning',
      'none',
      emission_id
    )
    on conflict (id) do nothing;

    update public.automations set last_fired_at = now()
      where id = rule.id;

    actor := coalesce(auth.jwt() ->> 'email', 'automation@system');
    insert into public.activity_log (actor_email, kind, payload)
    values (actor, 'automation_fired', jsonb_build_object(
      'automation_id', rule.id,
      'automation_name', rule.name,
      'emission_id', emission_id,
      'batch_id', new.id,
      'batch_label', batch_label
    ));
  end loop;

  return new;
end;
$$;

drop trigger if exists batch_created_automations on public.livestock_groups;
create trigger batch_created_automations
  after insert on public.livestock_groups
  for each row execute function public.fire_batch_created_automations();


-- ── trigger: feed reorder ────────────────────────────────────────────
-- Fires when on_hand crosses at-or-below reorder_point. Edge-triggered:
-- only fires on the crossing (or when on_hand is set at/below with no
-- prior value), and never while an active emission for the same feed
-- exists.
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

    -- "Place feed order" chore (one-time, today).
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
        || 'dropped to or below the reorder point.',
      jsonb_build_object('type', 'once',
        'date', to_char(current_date, 'YYYY-MM-DD')),
      'anytime',
      'none',
      emission_id
    )
    on conflict (id) do nothing;

    -- "Receive feed delivery" event (today + lead time).
    delivery_date := current_date + coalesce(new.lead_time_days, 7);
    series_id := public.create_auto_event(
      'deliveries', 'Receive feed delivery — ' || new.name,
      delivery_date, null, emission_id);
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

drop trigger if exists feed_reorder_automations on public.feed_types;
create trigger feed_reorder_automations
  after insert or update of on_hand on public.feed_types
  for each row execute function public.fire_feed_reorder_automations();


-- ── trigger: retire one-time chores when completed ───────────────────
create or replace function public.retire_once_chores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chore_definitions
    set retired_at = now()
    where id = new.chore_id
      and (frequency ->> 'type') = 'once'
      and retired_at is null;
  return new;
end;
$$;

drop trigger if exists retire_once_chore_on_completion
  on public.chore_completions;
create trigger retire_once_chore_on_completion
  after insert on public.chore_completions
  for each row execute function public.retire_once_chores();


-- ── RPC: acknowledge an emission ─────────────────────────────────────
create or replace function public.acknowledge_automation_emission(
  p_emission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');

  update public.automation_emissions
    set status = 'acknowledged',
        acknowledged_at = now(),
        acknowledged_by_email = caller_email
    where id = p_emission_id and status = 'active';
end;
$$;

revoke all on function public.acknowledge_automation_emission(uuid)
  from public;
revoke execute on function public.acknowledge_automation_emission(uuid)
  from anon;
grant execute on function public.acknowledge_automation_emission(uuid)
  to authenticated;


-- ── RPC: dismiss an emission (tombstones what it created) ────────────
create or replace function public.dismiss_automation_emission(
  p_emission_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
  emission record;
begin
  if not public.current_user_is_admin() then
    raise exception 'not authorized';
  end if;
  caller_email := (auth.jwt() ->> 'email');

  select * into emission from public.automation_emissions
    where id = p_emission_id;
  if not found then
    raise exception 'emission not found';
  end if;

  update public.automation_emissions
    set status = 'dismissed',
        dismissed_at = now(),
        dismissed_reason = p_reason,
        dismissed_by_email = caller_email
    where id = p_emission_id;

  -- End emitted event series and skip their occurrences so they
  -- disappear from the calendar (rows are kept for the audit trail).
  update public.event_occurrences set status = 'skipped'
    where series_id in (
      select id from public.event_series
      where automation_emission_id = p_emission_id
    ) and status = 'scheduled';
  update public.event_series set status = 'ended'
    where automation_emission_id = p_emission_id;

  -- Retire emitted one-time chores.
  update public.chore_definitions set retired_at = now()
    where automation_emission_id = p_emission_id and retired_at is null;

  insert into public.activity_log (actor_email, kind, payload)
  values (
    coalesce(caller_email, 'automation@system'),
    'automation_dismissed',
    jsonb_build_object(
      'emission_id', p_emission_id,
      'summary', emission.summary,
      'reason', p_reason
    )
  );
end;
$$;

revoke all on function public.dismiss_automation_emission(uuid, text)
  from public;
revoke execute on function public.dismiss_automation_emission(uuid, text)
  from anon;
grant execute on function public.dismiss_automation_emission(uuid, text)
  to authenticated;


-- ── Realtime ─────────────────────────────────────────────────────────
-- automations / automation_emissions are new. feed_types,
-- chore_definitions, and livestock_groups were never added to the
-- publication — automations write to all three out-of-band, so the
-- client subscriptions (useReferenceData, useChoreDefinitions) need
-- them live to surface auto-created rows without a hard refresh.
do $$
declare
  t text;
begin
  foreach t in array array[
    'automations', 'automation_emissions',
    'feed_types', 'chore_definitions', 'livestock_groups'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute 'alter publication supabase_realtime add table public.' || t;
    end if;
  end loop;
end $$;
