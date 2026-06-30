-- 0041_projects_rework_foundation.sql
-- Projects rework — structural-core foundation (additive only).
--
-- The reframe: priority becomes a SINGLE forced rank (every queued
-- project ranked against every other — no plural "high priority"
-- flags), with two escape hatches and a backlog:
--
--   queue_state   — where a project sits in the system:
--                     'ranked'        → on the forced-ranked list, its
--                                       rank carried by the existing
--                                       projects.sort_order.
--                     'unprioritized' → the backlog bucket: scoped-but-
--                                       -not-yet-actionable / one-line
--                                       ideas. Explicitly REPLACES any
--                                       "on hold" concept (no dup).
--                   Done is completed_at (not a queue state); archived
--                   is archived_at. Both already exist.
--   timing_note   — optional plain-text timing for an unprioritized
--                   project ("when it cools off, ~September"). Pure
--                   metadata — NEVER fed into scheduling (that would
--                   defeat the forced ranking); a date proper would, so
--                   timing stays free text here.
--   locked_date   — the lock-to-date escape hatch, available at EVERY
--                   level (project / phase / step / checklist item). A
--                   locked item jumps the queue and stays put; the
--                   schedule (a later batch) flows around it.
--
-- No column is dropped: status stays physically for now (the app stops
-- treating it as priority; a later cleanup migration may retire it once
-- nothing reads it). Every change here is `add column if not exists` /
-- guarded, so re-applying is a no-op.

-- ── projects: queue placement + timing + project-level lock ──────────
alter table public.projects
  add column if not exists queue_state text not null default 'ranked',
  add column if not exists timing_note text,
  add column if not exists locked_date date;

-- Constrain queue_state to the two valid placements (idempotent guard so
-- a re-run never errors on a duplicate constraint). Existing rows all
-- carry the 'ranked' default, so the check is satisfied on add.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'projects_queue_state_chk'
  ) then
    alter table public.projects
      add constraint projects_queue_state_chk
        check (queue_state in ('ranked', 'unprioritized'));
  end if;
end $$;

-- The active forced-ranked list: not archived, not done, on the ranked
-- queue, ordered by rank. Mirrors the existing projects_active_idx.
create index if not exists projects_ranked_idx
  on public.projects (queue_state, sort_order)
  where archived_at is null and completed_at is null;

-- ── lock-to-date at every lower level ────────────────────────────────
-- The schedule flows around a locked item wherever the lock sits.
alter table public.project_phases
  add column if not exists locked_date date;

alter table public.project_steps
  add column if not exists locked_date date;

alter table public.project_checklist_items
  add column if not exists locked_date date;
