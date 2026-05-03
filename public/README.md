# Public assets

Anything in this directory is served at the site root.

## Logo

Drop the North Foster Farm logo here as `logo.svg` (preferred) or `logo.png`.

`TopBar.jsx` looks up `/logo.svg` first, falls back to `/logo.png`, and finally renders a generic sprout icon if neither is found.

The logo renders in its natural colors. If you want it to follow the active theme accent (`var(--c-accent)`), provide an SVG that uses `currentColor` for fill/stroke and we'll set the parent `color` to `T.accent` so it auto-tints across light/dark modes.

## Favicon

Optionally add `favicon.ico` or `favicon.svg` here and reference it from `index.html` with `<link rel="icon" href="/favicon.svg" />`.
