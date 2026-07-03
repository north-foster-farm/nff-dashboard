-- 0046_sun_anchored_availability.sql
-- Batch 42 Phase-1 sweep (F15) — sunrise/sunset as first-class time
-- options on availability windows (additive only).
--
-- Farm work anchors to the sun, not the clock: a working day can run
-- "sunrise to 5 PM" and a break can be "sunset to dark". Each side of
-- a working_hours or breaks window may now carry a sun anchor
-- ('sunrise' | 'sunset'); when set, it wins over the fixed minutes
-- column for that side and the engine
-- (src/lib/schedule/availability.js) resolves it per date at the
-- farm's coordinates via suncalc (src/lib/sunTimes.js) — the same
-- machinery chore_blocks already use.
--
-- Semantics per side: sun anchor set → resolve at the date; null →
-- use the fixed minutes column as before. A working_hours row with
-- null minutes AND null anchors still means a scheduled day off.

alter table public.working_hours
  add column if not exists start_sun text
    check (start_sun in ('sunrise', 'sunset')),
  add column if not exists end_sun text
    check (end_sun in ('sunrise', 'sunset'));

alter table public.breaks
  add column if not exists start_sun text
    check (start_sun in ('sunrise', 'sunset')),
  add column if not exists end_sun text
    check (end_sun in ('sunrise', 'sunset'));
