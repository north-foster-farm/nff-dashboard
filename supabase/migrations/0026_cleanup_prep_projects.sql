-- 0026_cleanup_prep_projects.sql
-- Completes the surgical cleanup that 0025 intended (Batch 27.4).
--
-- 0025's cleanup ran inside a `do $$ ... $$` block; under the Supabase
-- CLI's migration login role, the block's DML silently affected zero
-- rows while plain top-level statements in the same migration (the
-- `automations` UPDATE) applied fine. Lesson recorded here: data
-- cleanup in migrations must be plain top-level SQL, not plpgsql
-- blocks.
--
-- What this deletes (verified against production 2026-06-02):
--   - the 3 "Processing day prep" projects (created by pre-0025
--     process expansions; phases / steps / links cascade)
--   - the 3 process_expansions rows + the event_links they created
--   - any chore_modifiers those expansions created (none in prod)
--
-- After this, the upcoming processing-day events re-expand under the
-- new client behavior — as one-time chores, which is the point of the
-- 27.4 rework. Scoping note: every pre-0025 expansion is
-- project-shaped, so targeting all of them is exact, not approximate.

-- Projects created by process expansions (their phases, steps,
-- checklists, links, and attachments all cascade).
delete from public.projects
where process_expansion_id is not null;

-- Chore modifiers created by process expansions.
delete from public.chore_modifiers
where process_expansion_id is not null;

-- Event links written by expansions (series → project / chore).
delete from public.event_links
where role in ('process', 'process_modifier')
  and series_id in (select series_id from public.process_expansions);

-- The expansion rows themselves. With these gone, the process runner
-- re-plans the upcoming linked occurrences and expands them as chores.
delete from public.process_expansions;

-- Stale ACTIVE automation emissions (none expected in prod — the old
-- broiler automation never fired — but kept for parity with 0025's
-- intent on any environment where it did).
update public.automation_emissions
set status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by_email = 'migration-0026@system'
where status = 'active';

-- Tombstone any automation-created processing / pasture-move event
-- series (also a no-op in prod — kept for environment parity). Plain
-- statements, same semantics as the dismiss RPC.
update public.event_occurrences
set status = 'skipped'
where status = 'scheduled'
  and series_id in (
    select es.id
    from public.event_series es
    join public.event_links el on el.series_id = es.id
    where es.automation_emission_id is not null
      and el.target_type = 'batch'
      and el.role in ('processing', 'pasture_move')
  );

update public.event_series
set status = 'ended'
where status is distinct from 'ended'
  and automation_emission_id is not null
  and id in (
    select el.series_id from public.event_links el
    where el.target_type = 'batch'
      and el.role in ('processing', 'pasture_move')
  );
