-- 0032_commitments_add_chore_type.sql
-- Schedule feature — 41.7 (search-to-add). Adds 'chore' to the
-- commitments.source_type enum so an existing chore can be pulled onto a
-- day as a placement delta (source_ref = {chore_id, place_id, block_id}),
-- distinct from a 'chore_block' run. ADDITIVE — widens a CHECK constraint;
-- no data is touched.
alter table public.commitments
  drop constraint commitments_source_type_check;
alter table public.commitments
  add constraint commitments_source_type_check
  check (source_type in (
    'chore_block', 'chore', 'event', 'project_node',
    'ad_hoc', 'note', 'reservation', 'buffer'
  ));
