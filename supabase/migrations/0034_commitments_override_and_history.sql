-- 0034_commitments_override_and_history.sql
-- Schedule feature — 41.8 (S6 3/3: instance overrides + protection +
-- modification history). Two additive changes, no data touched:
--
--   1. Adds 'override' to the commitments.source_type enum. An override is
--      a schedule-local edit of a DERIVED instance (a chore that fans out
--      onto the day but has no row of its own): it targets that instance
--      via source_ref.target = {chore_id, place_id} and carries the new
--      placement (source_ref.block_id, clock_time) + ordering
--      (overrides.order). The day assembler suppresses the derived row and
--      renders the override in its place. Edits to commitment-backed rows
--      (ad_hoc / chore / note) update those rows directly and need no new
--      enum value.
--
--   2. Adds commitments.history (jsonb, default '[]') — an append-only log
--      of edits to a scheduled instance: [{at, by, field, from, to}].
--      Satisfies S74 (every scheduled instance carries a viewable
--      modification history). Written read-modify-write from the client
--      overlay through the outbox, so it stays offline-safe; a never-edited
--      instance simply has no row and no history.
--
-- ADDITIVE — widens a CHECK constraint and adds a defaulted column.
alter table public.commitments
  drop constraint commitments_source_type_check;
alter table public.commitments
  add constraint commitments_source_type_check
  check (source_type in (
    'chore_block', 'chore', 'override', 'event', 'project_node',
    'ad_hoc', 'note', 'reservation', 'buffer'
  ));

alter table public.commitments
  add column if not exists history jsonb not null default '[]'::jsonb;
