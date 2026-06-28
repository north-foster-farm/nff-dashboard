-- 0039 — placements: allow multi-place (split) occupancy
--
-- A batch does not live in exactly one place. Broiler batches routinely
-- run split across 5+ chicken tractors out on pasture at the same time;
-- a brooder batch can sit in two brooders at once. The original model
-- (migration 0009) enforced ONE open placement per occupant via
--   placements_one_open_per_occupant  UNIQUE(occupant_type, occupant_id)
--   WHERE moved_out IS NULL
-- which makes "split across N places" unrepresentable.
--
-- Relax that to ONE open placement per occupant PER PLACE: a batch may
-- hold many concurrent open placements (one per place it occupies), but
-- never two open rows in the same place. This is the correct domain
-- model and is what every downstream lookup (which tractors/brooders a
-- batch occupies, and therefore which need work / cleanout) needs.
--
-- Additive + safe: a pure constraint swap, no data is touched. No
-- existing row can violate the new index because the old index already
-- guaranteed at most one open row per occupant in total.

drop index if exists public.placements_one_open_per_occupant;

create unique index if not exists placements_one_open_per_occupant_place
  on public.placements (occupant_type, occupant_id, place_id)
  where moved_out is null;
