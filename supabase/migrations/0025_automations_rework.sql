-- 0025_automations_rework.sql
-- Automations rework (Batch 27.4).
--
-- James's 2026-06-02 feedback on the Batch 19/23 automations:
--
--   1. The broiler-batch lifecycle automation should NOT auto-create a
--      processing event — processing days are created manually (with a
--      batch picker, Batch 27.6) once the real date is known.
--   2. The pasture move is work someone does, not a calendar event — it
--      becomes a one-time CHORE (batch-anchored, with a configurable
--      chore block + optional custom start time).
--   3. "Processing day prep" expansions should create chores, not a
--      project (client-side change in useProcessRunner; this migration
--      adds the chore provenance column).
--   4. Surgical cleanup of what the old behavior already created in
--      production: auto processing / pasture-move events are
--      tombstoned (same semantics as the dismiss RPC), future pasture
--      moves are recreated as chores, the prep projects + their
--      expansions are deleted, and stale active emissions are
--      acknowledged.
--
-- What this migration touches:
--   chore_definitions.process_expansion_id  — new provenance column
--   fire_batch_created_automations()        — replaced
--   automations seed row                     — actions/config updated
--   existing auto-created rows               — cleaned up (section 4)

-- ── 1. chore provenance for process expansions ───────────────────────
-- Mirrors projects.process_expansion_id (0018): process-created chores
-- carry a real FK so dismissal can retire exactly what an expansion
-- created, and the UI can flag them.
alter table public.chore_definitions
  add column if not exists process_expansion_id uuid
    references public.process_expansions(id) on delete set null;

create index if not exists chore_definitions_process_expansion_idx
  on public.chore_definitions (process_expansion_id)
  where process_expansion_id is not null;


-- ── 2. replace the broiler lifecycle trigger ──────────────────────────
-- New shape: arrival EVENT + pasture-move CHORE + brooder cleanout
-- CHORE. No processing event. Both chores are batch-anchored; the
-- pasture-move chore reads block / start-time / period overrides from
-- trigger_config:
--   pasture_move_block_id    uuid of a chore_blocks row (nullable)
--   pasture_move_start_time  "HH:MM" custom time override (nullable)
--   pasture_move_period      fallback period (default 'morning')
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
  cleanout_date date;
  series_id uuid;
  move_chore_id text;
  cleanout_chore_id text;
  batch_label text;
  move_block_id uuid;
  move_start_time text;
  move_period text;
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
    cleanout_date := move_date + coalesce(
      (rule.trigger_config ->> 'cleanout_offset_days')::int, 1);

    move_block_id := nullif(
      rule.trigger_config ->> 'pasture_move_block_id', '')::uuid;
    move_start_time := nullif(
      rule.trigger_config ->> 'pasture_move_start_time', '');
    move_period := coalesce(nullif(
      rule.trigger_config ->> 'pasture_move_period', ''), 'morning');

    insert into public.automation_emissions
      (automation_id, trigger_payload, summary)
    values (
      rule.id,
      jsonb_build_object('batch_id', new.id),
      'New batch "' || batch_label || '" — created its arrival event, '
        || 'a pasture-move chore, and a brooder cleanout chore. Add '
        || 'its processing day from the Schedule once the date is set.'
    )
    returning id into emission_id;

    -- Arrival event (unchanged from the old behavior).
    series_id := public.create_auto_event(
      'batch_milestones', batch_label || ' — arrival', arrival,
      null, emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values (series_id, 'batch', new.id, 'arrival');

    -- Pasture-move chore (was an event pre-0025). Batch-anchored;
    -- block / time come from the rule's config.
    move_chore_id := 'auto_pasture_move_' || new.id;
    insert into public.chore_definitions
      (id, title, category, description, frequency, period, start_time,
       block_id, anchor_type, anchor_batch_id, anchor_species_id,
       automation_emission_id)
    values (
      move_chore_id,
      'Move to pasture — ' || new.label,
      'one_time',
      'Auto-created by the broiler batch lifecycle automation when '
        || batch_label || ' was added. Move the birds out of the '
        || 'brooder and onto pasture.',
      jsonb_build_object('type', 'once',
        'date', to_char(move_date, 'YYYY-MM-DD')),
      move_period,
      move_start_time,
      move_block_id,
      'batch',
      new.id,
      new.species_id,
      emission_id
    )
    on conflict (id) do nothing;

    -- NO processing event — processing days are created manually from
    -- the Schedule (with the batch picker) once the date is real.

    -- Brooder cleanout chore (one-time, day after pasture move). Now
    -- batch-anchored like the pasture-move chore.
    cleanout_chore_id := 'auto_cleanout_' || new.id;
    insert into public.chore_definitions
      (id, title, category, description, frequency, period,
       anchor_type, anchor_batch_id, anchor_species_id,
       automation_emission_id)
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
      'batch',
      new.id,
      new.species_id,
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

-- The trigger itself is unchanged (after insert on livestock_groups);
-- create or replace above swaps the body in place.


-- ── 3. update the seed rule ───────────────────────────────────────────
-- Reflect the new action shape and drop the now-unused processing
-- config. Adds the pasture-move chore's block/time config keys (null =
-- not set; the Automations tab UI edits these).
update public.automations
set
  actions = '[
    {"type": "event", "role": "arrival",
     "kind_id": "batch_milestones", "label": "{batch} — arrival"},
    {"type": "chore", "role": "pasture_move",
     "title": "Move to pasture — {batch}",
     "offset": "arrival + pasture_move_weeks"},
    {"type": "chore", "role": "brooder_cleanout",
     "title": "Brooder cleanout — {batch}",
     "offset": "pasture_move + cleanout_offset_days"}
  ]'::jsonb,
  trigger_config = (trigger_config - 'processing_weeks')
    || jsonb_build_object(
      'pasture_move_block_id',
        coalesce(trigger_config -> 'pasture_move_block_id', 'null'::jsonb),
      'pasture_move_start_time',
        coalesce(trigger_config -> 'pasture_move_start_time', 'null'::jsonb)
    )
where trigger_kind = 'batch_created'
  and name = 'Broiler batch lifecycle';


-- ── 4. surgical cleanup of old auto-created rows ─────────────────────
-- Production already has rows from the old behavior. Tombstone /
-- replace them so the dashboard reflects the new model without losing
-- anything that still matters. Same tombstone semantics as the
-- dismiss_automation_emission RPC.
do $$
declare
  mv record;
  new_chore_id text;
begin
  -- 4a. Replace FUTURE auto-created pasture-move events with chores.
  -- Past ones just get tombstoned below (the move already happened).
  for mv in
    select es.id as series_id, el.target_id as batch_id,
           eo.occurs_on, lg.label as batch_label, lg.species_id,
           es.automation_emission_id
    from public.event_series es
    join public.event_links el
      on el.series_id = es.id
      and el.target_type = 'batch' and el.role = 'pasture_move'
    join public.event_occurrences eo on eo.series_id = es.id
    join public.livestock_groups lg on lg.id = el.target_id
    where es.automation_emission_id is not null
      and es.status is distinct from 'ended'
      and eo.occurs_on >= current_date
  loop
    new_chore_id := 'auto_pasture_move_' || mv.batch_id;
    insert into public.chore_definitions
      (id, title, category, description, frequency, period,
       anchor_type, anchor_batch_id, anchor_species_id,
       automation_emission_id)
    values (
      new_chore_id,
      'Move to pasture — ' || mv.batch_label,
      'one_time',
      'Converted from the auto-created pasture-move event by the '
        || '0025 automations rework. Move the birds out of the '
        || 'brooder and onto pasture.',
      jsonb_build_object('type', 'once',
        'date', to_char(mv.occurs_on, 'YYYY-MM-DD')),
      'morning',
      'batch',
      mv.batch_id,
      mv.species_id,
      mv.automation_emission_id
    )
    on conflict (id) do nothing;
  end loop;

  -- 4b. Delete the prep projects the old expansions created (their
  -- phases / steps / links cascade). EVERY pre-0025 expansion is
  -- project-shaped — that's exactly what this rework retires — so this
  -- targets all of them, not just automation-linked ones. (In prod the
  -- three "Processing day prep" projects hang off the JSON-seeded
  -- processing days, which carry no automation_emission_id.)
  -- Do this BEFORE deleting the expansions so the FK lookup works.
  delete from public.projects p
  using public.process_expansions px
  where p.process_expansion_id = px.id;

  -- 4c. Delete chore_modifiers + event_links those expansions created,
  -- then the expansion rows themselves. Upcoming linked events will
  -- re-expand under the new client behavior — as chores, which is the
  -- point of this rework.
  delete from public.chore_modifiers cm
  using public.process_expansions px
  where cm.process_expansion_id = px.id;

  delete from public.event_links el
  where el.role in ('process', 'process_modifier')
    and el.series_id in (
      select px.series_id from public.process_expansions px
    );

  delete from public.process_expansions;

  -- 4d. Tombstone ALL auto-created processing + pasture-move event
  -- series (the new model: processing days are manual; pasture moves
  -- are chores). Arrival events stay.
  update public.event_occurrences eo
  set status = 'skipped'
  from public.event_series es
  join public.event_links el on el.series_id = es.id
  where eo.series_id = es.id
    and es.automation_emission_id is not null
    and el.target_type = 'batch'
    and el.role in ('processing', 'pasture_move')
    and eo.status = 'scheduled';

  update public.event_series es
  set status = 'ended'
  from public.event_links el
  where el.series_id = es.id
    and es.automation_emission_id is not null
    and el.target_type = 'batch'
    and el.role in ('processing', 'pasture_move')
    and es.status is distinct from 'ended';

  -- 4e. Acknowledge stale ACTIVE emissions — their summaries describe
  -- the old behavior, and the Heads Up lane they lived in is going
  -- away (Batch 27.5 moves emissions to the bell).
  update public.automation_emissions
  set status = 'acknowledged',
      acknowledged_at = now(),
      acknowledged_by_email = 'migration-0025@system'
  where status = 'active';
end $$;
