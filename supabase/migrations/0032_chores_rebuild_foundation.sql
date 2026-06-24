-- 0032_chores_rebuild_foundation.sql
-- Phase A of the chores rebuild (spec: .ignored/nff-chores-spec.md,
-- plan: .ignored/chores-rebuild-reconciliation.md). Purely ADDITIVE —
-- no drops, no truncates, no data deletes. Two foundation pieces the
-- spec needs before the definitions can be reseeded:
--
--   1. A stable `slug` on chore_blocks, so deadlines can reference a
--      block by a rename-proof key (the spec's BlockEnum) instead of a
--      uuid or a display name. This is the anchor for the new
--      block-reference deadline encoding (kept in the existing
--      `chore_definitions.deadline` jsonb — no DDL needed for that;
--      app-level).
--   2. A `chore_checklist_items` table, mirroring the project checklist
--      pattern (0017), for chores that carry a packing/loading list
--      (e.g. the farmers-market load-out). Template-level: the checklist
--      belongs to the chore definition; per-day completion is runtime
--      state handled elsewhere.
--
-- Deliberately NOT here (see the reconciliation doc):
--   * deadline jsonb variants, generalized every_n_{unit} frequency —
--     app-level jsonb, no schema change.
--   * cold_storage place row — live `places` data; a guarded, attended
--     data step in the cutover phase, not a schema migration.
--   * F85 (drop process_steps.kind = 'task') — would break existing
--     'task' rows; tightened in a later migration once processes are
--     reseeded.


-- ── 1. chore_blocks.slug ──────────────────────────────────────────────
-- Nullable for now: the live blocks were created in-app with unknown
-- exact names, so we backfill only the unambiguous spec names below and
-- leave anything else null to be set deliberately against the real rows
-- before deadlines rely on it.
alter table public.chore_blocks
  add column if not exists slug text;

-- Unique among non-null slugs (a slug names exactly one block).
create unique index if not exists chore_blocks_slug_unique
  on public.chore_blocks (slug)
  where slug is not null;

-- Conservative backfill: only set a slug where it's currently null AND
-- the normalized name is an exact, unambiguous match for a spec block.
-- Bare "Afternoon"/"Evening" bootstrap rows are intentionally left null
-- (ambiguous vs early/late afternoon and end_of_day).
update public.chore_blocks set slug = case
    when lower(btrim(name)) in ('morning', 'early morning')        then 'morning'
    when lower(btrim(name)) in ('midmorning', 'mid-morning',
                                'mid morning')                     then 'midmorning'
    when lower(btrim(name)) = 'early afternoon'                    then 'early_afternoon'
    when lower(btrim(name)) = 'late afternoon'                     then 'late_afternoon'
    when lower(btrim(name)) in ('end of day', 'end-of-day')        then 'end_of_day'
    else slug
  end
  where slug is null;


-- ── 2. chore_checklist_items ──────────────────────────────────────────
-- Mirrors project_checklist_items (0017): one flat level, admin-scoped
-- RLS. Scoped to a chore definition; cascades if the definition is
-- deleted. `optional` distinguishes nice-to-have packing items.
create table if not exists public.chore_checklist_items (
  id uuid primary key default gen_random_uuid(),
  chore_id text not null
    references public.chore_definitions(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  optional boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chore_checklist_items_chore_idx
  on public.chore_checklist_items (chore_id, sort_order);

alter table public.chore_checklist_items enable row level security;

drop policy if exists chore_checklist_items_read
  on public.chore_checklist_items;
create policy chore_checklist_items_read on public.chore_checklist_items
  for select to authenticated using (public.current_user_is_admin());

drop policy if exists chore_checklist_items_write
  on public.chore_checklist_items;
create policy chore_checklist_items_write on public.chore_checklist_items
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());
