// URL slug derivation for projects ("/projects/farm-stand-rebuild").
// Derived from the title ONCE (create / backfill) and then immutable —
// retitling never rewrites it, so shared links keep working. The
// router resolves /projects/<x> against slug OR uuid, so pre-slug
// rows stay reachable by id.

const MAX_LEN = 60;

// Title → slug, unique against `taken` (a Set of existing slugs):
// lowercase, non-alphanumerics collapse to single dashes, trimmed,
// capped at 60 chars (never ending on a dash), with -2/-3… suffixes
// on collision. Returns null when nothing slug-worthy survives.
export function slugify(title, taken = new Set()) {
  let base = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN)
    .replace(/-+$/, "");
  if (!base) return null;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
