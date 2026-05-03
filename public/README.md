# Public assets

Anything in this directory is served at the site root.

## Logo

Drop the North Foster Farm logo here as `logo.svg` (preferred) or `logo.png`.

`TopBar.jsx` looks up `/logo.svg` first, falls back to `/logo.png`, and finally renders a generic sprout icon if neither is found.

The logo is tinted to the accent green via a CSS `filter` in `TopBar.jsx`. If your logo is already full-color and you want to preserve its colors, remove the `filter` line from the `<img>` style.

## Favicon

Optionally add `favicon.ico` or `favicon.svg` here and reference it from `index.html` with `<link rel="icon" href="/favicon.svg" />`.
