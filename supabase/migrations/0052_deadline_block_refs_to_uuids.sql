-- 0052_deadline_block_refs_to_uuids.sql
-- Housekeeping arc, H4 — F5 remedy step 3 (audit item 12). Data-only:
-- no schema change; additive rule satisfied (an UPDATE, not a drop).
--
-- `chore_definitions.deadline.block` stores a chore-block SLUG that the
-- client resolves through CHORE_BLOCK_IDS — a hardcoded snapshot of
-- production primary keys bundled into the app (choreSeeds.js). That
-- map is the un-validated registry F5 indicts: it works until a block
-- is recreated, then every deadline naming that slug silently loses
-- its block. This migration rewrites the refs to the block UUIDs so
-- the client can resolve deadlines against live rows by id and the
-- bundled map can be deleted.
--
-- Verified against prod 2026-07-30 (read-only, scripts/prod-read.sh):
--   * chore_blocks slugs->ids match CHORE_BLOCK_IDS row-for-row.
--   * Exactly 19 rows carry a slug ref, all on LIVE chores:
--     end_of_day x18 (14 kind='block' + 4 'block_on_weekday'),
--     late_afternoon x1 ('block_on_weekday'). Retired rows carry only
--     legacy type-based deadlines (no block refs). process_steps has
--     zero deadlines.
--   * The subselect resolves ids from chore_blocks AT APPLY TIME —
--     nothing here hardcodes a uuid; unmatched slugs are left as-is
--     (and counted by the verify query below, which must return 0).
--
-- PRE-APPLY PROTOCOL:
--   1. node scripts/backup-db.mjs (fresh full export).
--   2. James authorizes `supabase db push --linked` explicitly.
--   3. Verify after: the query in the trailing comment returns 0 rows.

update public.chore_definitions cd
set deadline = jsonb_set(
  cd.deadline,
  '{block}',
  to_jsonb(cb.id::text)
)
from public.chore_blocks cb
where cb.slug = cd.deadline->>'block';

-- Post-apply verification (run via prod-read or SQL editor; expect 0):
--   select id, deadline from chore_definitions
--   where deadline->>'block' is not null
--     and deadline->>'block' not in (select id::text from chore_blocks);
