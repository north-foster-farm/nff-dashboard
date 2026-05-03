# Fonts

This directory hosts custom font files served at `/fonts/...`.

## Nacelle

Download from <http://dotcolon.net/font/nacelle/> and unzip. Place these files here so the names match the `@font-face` rules in `index.html`:

```text
public/fonts/Nacelle-Regular.otf      (required)
public/fonts/Nacelle-Bold.otf         (optional but recommended)
public/fonts/Nacelle-Regular.woff2    (optional, faster load if you have it)
public/fonts/Nacelle-Bold.woff2       (optional)
```

The dotcolon distribution ships OTF only. To produce WOFF2 (better compression, faster page load), run any one of:

```bash
# Option A: brew install woff2, then:
woff2_compress public/fonts/Nacelle-Regular.otf
woff2_compress public/fonts/Nacelle-Bold.otf

# Option B: drop the OTFs into https://transfonter.org and download woff2.
```

If only the OTFs are present, the app will still work — just a touch heavier on initial download.

## Fallback

If no Nacelle file is present at all, the app falls back to system sans-serif (`system-ui`). The layout will still look correct, just less branded.
