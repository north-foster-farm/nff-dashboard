-- 0047_project_slugs.sql
-- Projects get a human URL slug (additive only): /projects/<slug>
-- instead of a bare uuid. The slug derives from the title ONCE
-- (client-side src/lib/slug.js at create; SQL backfill below) and is
-- then immutable — retitling never rewrites it, so shared links keep
-- working. The router resolves /projects/<x> against slug OR uuid, so
-- any pre-slug link stays live.

alter table public.projects
  add column if not exists slug text unique;

-- Backfill: title → lowercase, non-alphanumeric runs → single dashes,
-- trimmed, capped at 60. Collisions (same-titled projects) get a
-- -2/-3… suffix by created_at order, matching the client rule.
with derived as (
  select
    id,
    left(
      trim(both '-' from
        regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')),
      60
    ) as base,
    row_number() over (
      partition by left(
        trim(both '-' from
          regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')),
        60
      )
      order by created_at, id
    ) as nth
  from public.projects
  where slug is null
)
update public.projects p
set slug = case
  when d.base = '' then null
  when d.nth = 1 then trim(both '-' from d.base)
  else trim(both '-' from d.base) || '-' || d.nth
end
from derived d
where p.id = d.id;
