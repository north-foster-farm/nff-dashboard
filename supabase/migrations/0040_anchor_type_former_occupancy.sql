-- 0040 — allow the 'former_occupancy' anchor type
--
-- A chore can now anchor to the places a batch HAS OCCUPIED (open or
-- closed placements), kind-filtered — e.g. a brooder cleanout that fires
-- on the brooder(s) a broiler batch sat in, even after the batch has
-- moved to pasture. The resolver (obligationPlaceIds, lib/chores.js) and
-- the process expansion already understand 'former_occupancy'; the
-- anchor_type CHECK constraints (0014 chore_definitions, 0037
-- process_steps) just need to admit the new value.
--
-- Additive + safe: the allowed set only widens; no existing row changes.

alter table public.chore_definitions
  drop constraint if exists chore_definitions_anchor_type_check;
alter table public.chore_definitions
  add constraint chore_definitions_anchor_type_check check (
    anchor_type in
      ('none', 'place', 'occupied_place', 'place_kind',
       'species', 'batch', 'former_occupancy')
  );

alter table public.process_steps
  drop constraint if exists process_steps_anchor_type_check;
alter table public.process_steps
  add constraint process_steps_anchor_type_check check (
    anchor_type in
      ('none', 'place', 'occupied_place', 'place_kind',
       'species', 'batch', 'former_occupancy')
  );
