-- 0038_retire_broiler_lifecycle_chores.sql
-- Phase 3 of processes-as-chore-generators.
--
-- The broiler batch lifecycle's pasture-move + brooder-cleanout CHORES
-- now come from the "Broiler pasture (lifecycle)" PROCESS — authored
-- under the new process editor (Phase 2) and anchored to the batch
-- arrival / chicks-delivery event. This migration retires the
-- chore-creating half of the batch_created automation so the two paths
-- don't both fire.
--
-- What this migration does:
--   1. fire_batch_created_automations() rewritten to create ONLY the
--      arrival event (+ batch link). The arrival event is the process's
--      anchor, so it MUST stay auto-created — only the two chore inserts
--      are dropped. The shared automation mechanism stays in place: the
--      Feed-reorder automation still uses it.
--   2. The 'Broiler batch lifecycle' automation row: actions trimmed to
--      just the arrival event; the now-unused pasture/cleanout config
--      keys removed; renamed to 'Broiler batch arrival' to match its
--      reduced role.
--   3. Activate the seeded 'Broiler pasture (lifecycle)' process so it
--      starts expanding off arrival events.
--
-- Additive + idempotent. No table/column drops:
-- chore_definitions.automation_emission_id is still used by the
-- Feed-reorder automation, and the automations / automation_emissions
-- tables + AutomationsPanel remain in use.

-- ── 1. trigger: create the arrival event only ────────────────────────
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
  series_id uuid;
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

    insert into public.automation_emissions
      (automation_id, trigger_payload, summary)
    values (
      rule.id,
      jsonb_build_object('batch_id', new.id),
      'New batch "' || batch_label || '" — created its arrival event. '
        || 'Its pasture-move and brooder-cleanout chores come from the '
        || 'broiler pasture process.'
    )
    returning id into emission_id;

    -- Arrival event — the broiler pasture process anchors to this.
    -- (Pasture-move + cleanout chores used to be created here; they now
    -- come from the process that expands off this event.)
    series_id := public.create_auto_event(
      'batch_milestones', batch_label || ' — arrival', arrival,
      null, emission_id);
    insert into public.event_links (series_id, target_type, target_id, role)
    values (series_id, 'batch', new.id, 'arrival');

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

-- The trigger itself (after insert on livestock_groups) is unchanged;
-- create or replace above swaps the body in place.


-- ── 2. trim the automation row to arrival-only ───────────────────────
update public.automations
set
  name = 'Broiler batch arrival',
  actions = '[
    {"type": "event", "role": "arrival",
     "kind_id": "batch_milestones", "label": "{batch} — arrival"}
  ]'::jsonb,
  trigger_config = jsonb_build_object(
    'species_id', trigger_config ->> 'species_id')
where trigger_kind = 'batch_created'
  and name = 'Broiler batch lifecycle';


-- ── 3. activate the broiler pasture process ──────────────────────────
-- Seeded via the process editor in Phase 2 (kept off until now so it
-- wouldn't double-fire alongside the automation). Flip it on.
update public.processes
set is_active = true
where title = 'Broiler pasture (lifecycle)';
