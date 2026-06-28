-- 0037_process_steps_chore_template.sql
-- Phase 0 of "processes as event-anchored chore generators"
-- (.ignored/processes-as-chore-generators/PLAN.md). Purely ADDITIVE —
-- no drops, no truncates, no data deletes.
--
-- The model (memory project_chores_vs_projects_model): everything a
-- process emits is a CHORE, schema-identical to a user-defined chore.
-- A process step is therefore a chore *template* — a full chore
-- definition — plus an `offset_days` from the process's anchoring event
-- date. Today a step only carries title/body/offset, and the expansion
-- (lib/processes.js -> processChoreRow) hardcodes period='morning' and
-- leaves block_id null — exactly the bug that produced 39 invalid
-- block_id=null "Anytime" chores.
--
-- This migration does two things:
--   1. Gives process_steps the chore-template field-set that
--      chore_definitions already has, so a step can author the real
--      chore it should become (Phase 1 then carries these through and
--      resolves frequency.date from eventDate + offset_days).
--   2. Renames the chore-kind `kind` value 'task' -> 'chore'. These
--      steps emit chores, not project tasks — the 'task' name is the
--      last of the legacy framing (audit F85). No-legacy: rename the
--      data + tighten the enum here; the two code writers
--      (pages/Processes.jsx add-step, data/processSeeds.js) move to
--      'chore' in the same change. splitSteps / the editor branch on
--      'chore_modifier' (else = chore), so nothing else changes.
--
-- The two animal-anchor ids are deliberately NOT added —
-- anchor_species_id / anchor_batch_id are EVENT-derived (the bound
-- batch / processing-day event supplies them at expansion time), not
-- authored per step. frequency and category are likewise computed at
-- expansion, and `period` is omitted entirely: block_id is canonical
-- and period derives from it.
--
-- Decision (PLAN "extra columns vs separate table"): columns on
-- process_steps. It mirrors chore_definitions one-to-one, needs no join,
-- and a step IS one chore template — a child table would be a 1:1 with
-- nothing to gain.
--
-- block_id policy (soft, not a hard CHECK): a FK to chore_blocks with
-- ON DELETE SET NULL, like every other place/block reference in this
-- schema (0009/0014). We do NOT add a "kind='chore' implies block_id is
-- not null" CHECK — those FKs null on delete, so a hard check would turn
-- a block delete into an error (the trap 0014 calls out for anchors),
-- and it would reject a half-authored draft step. The "never a silent
-- null" guarantee lives where it matters: the step editor seeds a new
-- step with the morning block, and the Phase 1 expansion floors any null
-- to morning before it writes a chore. The existing rows are backfilled
-- to morning below so they already conform.


-- ── 1. chore-template columns on process_steps ───────────────────────
-- Mirrors chore_definitions: block_id, last_chance_block_id, start_time,
-- deadline, assignment, and the place-anchor set (anchor_type,
-- anchor_kind_tag, place_id, at_place_id). offset_days / kind /
-- modifier_* (already present) stay as the event-anchor + modifier
-- config.
alter table public.process_steps
  add column if not exists block_id uuid
    references public.chore_blocks(id) on delete set null,
  add column if not exists last_chance_block_id uuid
    references public.chore_blocks(id) on delete set null,
  add column if not exists start_time text,
  add column if not exists deadline jsonb,
  add column if not exists assignment jsonb,
  add column if not exists anchor_type text not null default 'none',
  add column if not exists anchor_kind_tag text,
  add column if not exists place_id uuid
    references public.places(id) on delete set null,
  add column if not exists at_place_id uuid
    references public.places(id) on delete set null;

-- Same enum guard as chore_definitions (0014). Animal anchors
-- ('species'/'batch') are allowed: the step authors the anchor *type*;
-- the concrete species/batch id is filled from the bound event at
-- expansion. Enum-only — no "type implies id" check, matching 0014.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'process_steps_anchor_type_check'
  ) then
    alter table public.process_steps
      add constraint process_steps_anchor_type_check check (
        anchor_type in
          ('none', 'place', 'occupied_place', 'place_kind',
           'species', 'batch')
      );
  end if;
end $$;

create index if not exists process_steps_block_idx
  on public.process_steps (block_id, sort_order)
  where block_id is not null;
create index if not exists process_steps_place_idx
  on public.process_steps (place_id)
  where place_id is not null;
create index if not exists process_steps_at_place_idx
  on public.process_steps (at_place_id)
  where at_place_id is not null;


-- ── 2. rename kind 'task' -> 'chore' ─────────────────────────────────
-- Retire the legacy 'task' framing. Drop the old enum CHECK FIRST (it
-- only allows 'task'/'chore_modifier'), then rename the rows, then add
-- the tightened CHECK and swap the column default. The other CHECK
-- (kind <> 'chore_modifier' or modifier_action is not null) is unchanged
-- — it never referenced 'task'.
alter table public.process_steps
  drop constraint if exists process_steps_kind_check;

update public.process_steps set kind = 'chore' where kind = 'task';

alter table public.process_steps
  add constraint process_steps_kind_check
    check (kind in ('chore', 'chore_modifier'));

alter table public.process_steps
  alter column kind set default 'chore';


-- ── 3. backfill existing chore steps to the morning block ────────────
-- Authoring default only (never a silent null): every chore-kind step
-- that predates the block_id column gets the morning block, so the
-- eventual expansion always has a real block to emit. Guarded so it is a
-- no-op if the morning block is somehow absent, and never clobbers a
-- block a step already carries.
update public.process_steps
  set block_id = (
    select id from public.chore_blocks where slug = 'morning'
  )
  where kind = 'chore'
    and block_id is null
    and exists (
      select 1 from public.chore_blocks where slug = 'morning'
    );
