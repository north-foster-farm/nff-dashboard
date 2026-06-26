-- 0036_drop_dead_timeline_items_and_chore_runs.sql
-- Schedule feature — 41.28 (DB cleanup). The final coverage-tail item.
--
-- DESTRUCTIVE — drops a dead view + an orphaned table. This deliberately
-- departs from the additive-only default; apply only with the backup +
-- row-count protocol below. Both objects have been dead since the S1/S3
-- Schedule work and are verified unreferenced by any live code path:
--
--   * `timeline_items` (view) — the old Overview day-timeline. Replaced by
--     the JS draft assembler (`src/lib/schedule/deriveDay.js`) in S3.
--     `buildTimelineItems` + `useTimelineItems` are already deleted; the
--     only remaining mentions are a comment and the restore script's
--     NOT_TABLES guard. Nothing reads it.
--
--   * `chore_runs` (table) — generalised into `commitments` in 0029
--     (uuid-preserving copy; parity verified at push time: chore_runs 10 ->
--     commitments(chore_block) 10). Every live query (`useChoreRuns`,
--     `useRunHistory`, `outbox`, `notify-run-done`) now reads `commitments`;
--     the two inbound FKs (chore_run_participants.run_id, activity_log.run_id)
--     were repointed to commitments in 0029. The remaining "chore_runs"
--     mentions in code are comments only. The table is fully orphaned.
--
-- The drops use RESTRICT (the default) on purpose: if any unforeseen
-- dependent still exists, the push FAILS LOUDLY rather than silently
-- cascade-dropping something. Re-run after resolving the dependent.
--
-- PRE-APPLY PROTOCOL (each step):
--   1. node scripts/backup-db.mjs   (full read-only export; confirm the
--      events/chores tables are non-empty in its summary).
--   2. Confirm commitments(source_type='chore_block') count == the live
--      chore_runs count before applying (parity must already hold from
--      0029; this is a final sanity check, not a data move).
--   3. James runs `supabase db push --linked` himself (auto-mode blocks a
--      scripted push). Verify both objects are gone afterwards.

-- Drop the view first (independent of the table since 0029 repointed it).
drop view if exists public.timeline_items;

-- Drop the orphaned table. RESTRICT by default — fails if any dependent
-- remains. Its own indexes / RLS policies / updated-at trigger drop with it.
drop table if exists public.chore_runs;

-- The table's updated-at trigger function is now orphaned — drop it too.
drop function if exists public.touch_chore_runs_updated_at();
