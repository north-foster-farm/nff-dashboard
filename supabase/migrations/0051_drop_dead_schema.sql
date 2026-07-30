-- 0051_drop_dead_schema.sql
-- Housekeeping arc, H4 — the dead-schema batch James deferred out of
-- H3 on 2026-07-30 ("batch the drops into H4 with one fresh backup").
--
-- DESTRUCTIVE — drops four never-used tables and two dead columns.
-- This deliberately departs from the additive-only default; apply only
-- with the backup + row-count protocol below. Every object was
-- verified empty and unreferenced on 2026-07-30 (backup
-- .backups/2026-07-30T09-49-37-247Z/ — all four tables are `[]`):
--
--   * `gcal_pushes` (0013) — audit log for a Google Calendar push job
--     that was never wired. Zero rows, zero src references.
--   * `egg_lots` (0005) — the Batch-4 egg inventory model, superseded
--     by the layer-lifecycle work; the entry UI never existed. Zero
--     rows; comment-only mentions in src.
--   * `chicken_lots` (0005) — broiler batch-close inventory, same
--     era, never populated. Zero rows; comment-only mentions in src.
--     Dropping it also removes its on-delete-restrict FK into
--     product_kinds (the useProducts.js hard-delete comment about it
--     is updated in this commit).
--   * `chore_checklist_items` (0033) — chores-rebuild Phase A
--     scaffold; the rebuild pivoted (see docs/history/) and nothing
--     ever wrote it. Zero rows; comment-only mentions in src.
--   * `orders.line_items` (0006) — jsonb column superseded by the
--     order_lines table (0028). orders itself has zero rows.
--   * `project_attachments.phase_id` (0045) — attachments never grew
--     the hang-off-a-phase UI; both live rows have phase_id null and
--     no code selects or writes it. Its index drops with it.
--
-- `event_instances` deliberately STAYS (18 live rows, still read by
-- useReferenceData.js) — James, 2026-07-30.
--
-- The drops use RESTRICT (the default) on purpose: if any unforeseen
-- dependent still exists, the push FAILS LOUDLY rather than silently
-- cascade-dropping something. Re-run after resolving the dependent.
--
-- PRE-APPLY PROTOCOL (each step):
--   1. node scripts/backup-db.mjs   (full read-only export; confirm
--      the events/chores tables are non-empty in its summary).
--   2. Confirm all four tables still report zero rows and both
--      columns are all-null in that backup.
--   3. James authorizes `supabase db push --linked` explicitly.
--      Verify the objects are gone afterwards.

-- Tables: RESTRICT by default — fails if any dependent remains. Each
-- table's indexes / RLS policies drop with it.
drop table if exists public.gcal_pushes;
drop table if exists public.egg_lots;
drop table if exists public.chicken_lots;
drop table if exists public.chore_checklist_items;

-- Dead columns. project_attachments_phase_idx drops with its column.
alter table public.orders
  drop column if exists line_items;
alter table public.project_attachments
  drop column if exists phase_id;
