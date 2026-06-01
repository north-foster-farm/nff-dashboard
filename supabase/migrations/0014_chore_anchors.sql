-- 0014_chore_anchors.sql
-- Chore ownership model ("anchors") for Batch 18.
--
-- A chore doesn't just belong to a place — it belongs to *something*,
-- and that something determines where its obligations surface:
--
--   anchor_type        what the chore belongs to
--   ─────────────      ──────────────────────────────────────────────
--   'none'             nothing in particular (whole-farm chore)
--   'place'            a specific place, occupied or not (mow Pasture
--                      B). Obligation always at that place.
--   'occupied_place'   a place subtree, but only where animals
--                      currently live (the pre-0014 fan-out behavior;
--                      kept for brooder-style "whoever is brooding"
--                      chores). place_id is the subtree root.
--   'place_kind'       every active place with a kind_tag (power-wash
--                      nest boxes -> every coop, occupied or not).
--   'species'          all active batches of a species — obligations
--                      follow the animals wherever they live. Optional
--                      anchor_kind_tag narrows to batches housed in a
--                      tagged place ("broilers, in tractors").
--                      Optional at_place_id pins the work to a fixed
--                      place ("wash eggs" belongs to layers but
--                      happens at the House).
--   'batch'            one specific livestock_groups row, same
--                      location-following + at_place semantics.
--
-- This is additive (rollout began 2026-06-01 — no more amend-in-place /
-- DB resets): new columns + FKs + a data backfill keyed off the legacy
-- `category` text. place_id keeps its role as the place-anchor column
-- for 'place' / 'occupied_place'; it's nulled for animal-anchored rows.
--
-- Relational integrity: the anchor id columns are real FKs. Deleting a
-- species/batch/place sets the reference null rather than deleting the
-- chore; the client surfaces those rows as "needs re-anchoring" instead
-- of silently losing them.

alter table public.chore_definitions
  add column if not exists anchor_type text not null default 'none',
  add column if not exists anchor_kind_tag text,
  add column if not exists anchor_species_id text
    references public.livestock_species(id) on delete set null,
  add column if not exists anchor_batch_id text
    references public.livestock_groups(id) on delete set null,
  add column if not exists at_place_id uuid
    references public.places(id) on delete set null;

-- Enum guard only. Deliberately NOT a hard "anchor_type implies its id
-- column is non-null" check: the FKs above use ON DELETE SET NULL, and
-- a hard check would turn every species/batch/place delete into an
-- error when chores still point at it. A null anchor id under a
-- non-'none' anchor_type reads as "needs re-anchoring" in the client.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chore_definitions_anchor_type_check'
  ) then
    alter table public.chore_definitions
      add constraint chore_definitions_anchor_type_check check (
        anchor_type in
          ('none', 'place', 'occupied_place', 'place_kind',
           'species', 'batch')
      );
  end if;
end $$;

create index if not exists chore_definitions_anchor_species_idx
  on public.chore_definitions (anchor_species_id)
  where anchor_species_id is not null;
create index if not exists chore_definitions_anchor_batch_idx
  on public.chore_definitions (anchor_batch_id)
  where anchor_batch_id is not null;
create index if not exists chore_definitions_at_place_idx
  on public.chore_definitions (at_place_id)
  where at_place_id is not null;


-- ── backfill: anchor from the legacy category text ────────────────────
-- Maps the seeded/live chores onto the ownership James described.
-- Idempotent: every statement guards on anchor_type = 'none' so re-runs
-- (or rows added between writing and applying this migration) never
-- clobber an anchor that has already been set.

-- Chicken-tractor chores belong to broiler batches housed in tractors.
-- They follow the broilers; no broilers on pasture -> dormant.
update public.chore_definitions set
  anchor_type = 'species',
  anchor_species_id = 'broilers',
  anchor_kind_tag = 'tractor',
  place_id = null
where anchor_type = 'none' and category = 'chicken_tractors';

-- Coop equipment chores (power washing, deep cleans) belong to the
-- coops themselves — they exist whether or not hens are inside.
update public.chore_definitions set
  anchor_type = 'place_kind',
  anchor_kind_tag = 'coop',
  place_id = null
where anchor_type = 'none'
  and category = 'mobile_coops'
  and (
    title ilike '%power wash%'
    or title ilike '%deep clean%'
    or title ilike '%dust%'
  );

-- The rest of the mobile-coop chores belong to layer batches housed in
-- coops (feed, water, eggs, perches, open/close). They follow the hens.
update public.chore_definitions set
  anchor_type = 'species',
  anchor_species_id = 'layers',
  anchor_kind_tag = 'coop',
  place_id = null
where anchor_type = 'none' and category = 'mobile_coops';

-- Sheep chores belong to the sheep, wherever they live.
update public.chore_definitions set
  anchor_type = 'species',
  anchor_species_id = 'sheep',
  place_id = null
where anchor_type = 'none' and category = 'sheep';

-- Egg-washing chores belong to the layers (no layers -> no eggs) but
-- the work happens at the House, where no layers are ever kept.
update public.chore_definitions set
  anchor_type = 'species',
  anchor_species_id = 'layers',
  at_place_id = (
    select id from public.places
    where kind_tag = 'house' and is_active
    order by sort_order limit 1
  )
where anchor_type = 'none' and category = 'wash_eggs';

-- Anything still place-scoped (the brooder chores) keeps the pre-0014
-- occupancy fan-out: the chore belongs to the place subtree but only
-- demands doing where animals currently live.
update public.chore_definitions set
  anchor_type = 'occupied_place'
where anchor_type = 'none' and place_id is not null;
