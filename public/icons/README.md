# App icons

`icon.svg` is the master: the rooster mark from `/logo.svg` (cream)
on a brand-green radial-gradient field. Every PNG here is exported
from it.

Regenerate after editing `icon.svg` (requires Inkscape):

    inkscape -w 180 -h 180 public/icons/icon.svg -o public/apple-touch-icon.png
    inkscape -w 192 -h 192 public/icons/icon.svg -o public/icons/icon-192.png
    inkscape -w 512 -h 512 public/icons/icon.svg -o public/icons/icon-512.png
    inkscape -w 512 -h 512 public/icons/icon.svg -o public/icons/icon-maskable-512.png

Where each one is used:

- `/apple-touch-icon.png` (180×180) — iOS home-screen icon, linked
  from `index.html`. Full-bleed square; iOS rounds the corners itself.
- `icon-192.png` / `icon-512.png` — PWA manifest icons (`purpose:
  any`) and the web-push notification icon (`public/sw.js`).
- `icon-maskable-512.png` — manifest `purpose: maskable` icon. The
  mark sits at ~62% of the canvas, inside the 80% maskable safe zone,
  so the same art works for both purposes.
