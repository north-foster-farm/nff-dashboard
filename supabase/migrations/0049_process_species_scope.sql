-- 0049_process_species_scope — scope a process to one livestock
-- species (Batch 42.16, F20.1).
--
-- Processes link to event KINDS, but both broiler and layer arrival
-- events share the batch_milestones kind. Until now the "Broiler
-- pasture (lifecycle)" process was only *implicitly* broiler-scoped —
-- it worked because layers had no arrival events. F20 introduces layer
-- arrivals, so the kind link alone would make both species' lifecycle
-- processes fire on both species. A nullable species_id makes the
-- scope explicit; the runner (useProcessRunner) skips a scoped process
-- whose anchor batch is a different species (see processAppliesToSpecies).
--
-- Additive-only. null species_id = applies to any anchor (unchanged
-- behavior for the market/pop-up + generic processing-prep processes).

alter table public.processes
  add column if not exists species_id text
    references public.livestock_species(id) on delete set null;

-- Backfill: the existing broiler processes become explicitly
-- broiler-scoped so a layer arrival can never trigger them. Matches by
-- title (stable in this project); the market/pop-up + generic
-- "Processing day prep" processes stay unscoped.
update public.processes
  set species_id = 'broilers'
  where title ilike 'Broiler %' and species_id is null;
