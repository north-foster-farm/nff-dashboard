# Public assets

Anything in this directory is served at the site root.

## Logo

Drop the North Foster Farm logo here as `logo.svg` (preferred) or `logo.png`.

`TopBar.jsx` looks up `/logo.svg` first, falls back to `/logo.png`, and finally renders a generic sprout icon if neither is found.

The logo renders in its natural colors. If you want it to follow the active theme accent (`var(--c-accent)`), provide an SVG that uses `currentColor` for fill/stroke and we'll set the parent `color` to `T.accent` so it auto-tints across light/dark modes.

## Favicon

Optionally add `favicon.ico` or `favicon.svg` here and reference it from `index.html` with `<link rel="icon" href="/favicon.svg" />`.

## Every SVG is cleaned

Every tracked SVG is stored exactly as `npm run svg:clean` writes it: SVGO with James's SVGOMG settings (`svgo.config.mjs`, copied from `~/.bin/svgomg`), then a step that drops any class the app does not use, Lucide's included. `npm run check:svg` fails on an SVG that differs, and `npm run check` runs it, so the pre-commit hook and CI do too. The site holds its SVGs to the same config (north-foster-farm#295).

To add an SVG, save it here and run `npm run svg:clean`. If it stops on a class or an id the app names, give the file an override in `OVERRIDES` (`svgo.config.mjs`) with the reason, or refer to the element another way: SVGO keeps no id that nothing inside the file uses unless an override turns `cleanupIds` off. Comments go too, so notes about a file belong in a README beside it.

An override turns any of the SVGOMG features off for one file, or keeps named classes there, each with its reason; the clean-up and the check run that file with its override. `farm-map_v1.svg` has one: `cleanupIds` stays off, because its ids are the layer names that bind the map to places (`place_geometry.svg_layer_id`, or a layer id matching a place's name). Run `node scripts/check-consistency.mjs` after editing it.
