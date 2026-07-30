# Handoff: Daily Quote / Artwork Rotation Feature

**Status:** Spec + dataset complete. Implementation not yet started.
**Owner:** James (NFF // Daily Ops)
**Last updated:** May 6, 2026

---

## What this is

A daily-rotating piece of content (alternating quotes and artwork) that surfaces in two places in the NFF // Daily Ops app:

1. **Login screen** — full-immersive treatment. Quotes get a stylized typographic display; artworks become a full-bleed background image with a dark overlay so the login UI stays readable.
2. **Dashboard widget** — a compact card on the Today tab showing the same content as the login screen for that day.

Both surfaces always show **the same item on the same day**. The rotation is daily and deterministic.

The constant UX element across both content types is **attribution + biography** — author/artist name, lifespan, role, and a 1–2 sentence bio. The visual treatment of the content itself (quote vs. artwork) varies, but attribution is the through-line.

---

## Why this exists

The login screen and dashboard had nothing besides functional UI. This adds a small daily moment of inspiration / orientation tied to the farm's identity — voices and visual heritage of American agriculture and the romanticized countryside tradition. Pastured poultry pioneers, regenerative ag thinkers, agrarian writers, and 19th-century American farm painters all in rotation.

---

## Files in this handoff

| File | What it is |
|---|---|
| `nff_content.json` | Master content dataset — quotes, artwork, and people (authors + artists) |
| `artwork_curator.jsx` | Standalone React tool for reviewing artwork candidates and marking include/exclude |
| `roadmap_addendum.md` | Feature spec with data model, UX details, and implementation tasks |
| `handoff.md` | This document |

---

## Current state of content

- **44 quotes** from 25 authors (pastured poultry pioneers, regenerative ag voices, agrarian writers, pastoral poets)
- **54 artwork candidates** awaiting curation, all verified public domain (CC0) from the Met or National Gallery of Art
- **48 people records** with bios (25 authors + 23 artists) — shared between quotes and artwork

The artwork list is intentionally over-sized so it can be pruned. The plan is to curate it down using `artwork_curator.jsx` to whatever the final selection looks like.

98 total items right now, expected to drop to 70–85 after curation. At one item per day, that puts repeats roughly 2.5–3 months apart, which clears the "no repeat for at least 2 months" target.

---

## Next steps (in order)

### 1. Curate the artwork set (~20 min)
- Open `artwork_curator.jsx` as a React artifact in Claude
- Click through each of the 54 images, marking **Include** / **Exclude** / **Skip**
- Decisions persist automatically via `window.storage`, so you can stop and resume
- When finished, hit **Export JSON** on the summary screen — produces `nff_artwork_curation.json`
- Send the export back to Claude to regenerate `nff_content.json` filtered to only the included artwork

### 2. Build the daily rotation utility
Create `src/lib/daily-content.js` (or wherever app utilities live):
```js
import content from "./nff_content.json";

const EPOCH = new Date("2026-01-01").getTime();

// Combine quotes + artwork into one alternating-friendly array
function buildRotation() {
  // Strategy: interleave quotes and artwork so they alternate roughly evenly
  // (could also just concat and shuffle once with a fixed seed)
  const quotes = content.quotes;
  const artwork = content.artwork;
  const combined = [];
  const max = Math.max(quotes.length, artwork.length);
  for (let i = 0; i < max; i++) {
    if (i < quotes.length) combined.push(quotes[i]);
    if (i < artwork.length) combined.push(artwork[i]);
  }
  return combined;
}

const ROTATION = buildRotation();

export function getDailyContent(date = new Date()) {
  const dayIndex = Math.floor((date.getTime() - EPOCH) / 86400000);
  const item = ROTATION[((dayIndex % ROTATION.length) + ROTATION.length) % ROTATION.length];
  const personId = item.author_id || item.artist_id;
  const person = content.people[personId];
  return { item, person };
}
```

The `(x % n + n) % n` pattern handles negative day indexes (in case the user's clock predates the epoch).

### 3. Login screen integration
- Add a `<DailyContent />` provider at the top of the login screen that resolves today's item
- Branch on `item.type`:
  - `"quote"` → centered typography treatment (display serif, large, with attribution below)
  - `"artwork"` → full-bleed `background-image` set to `item.image_url_full`, with a dark overlay (`bg-stone-950/60` or similar) so the login form text stays readable
- Both treatments share an attribution block (name · lifespan · role · bio) — design this component once, reuse it

**For artworks specifically:**
- Add a "View artwork" button (eye icon, bottom corner). When pressed:
  - Removes the dark overlay
  - Hides all login UI (form, buttons, attribution block, etc.) — fade them out
  - Pressing again restores them
- Add an "Open full size" link → opens `item.image_url_full` in a new tab

**Performance note:** Met images run 1–7 MB at full resolution. Load `image_url_thumb` first as a placeholder, then swap to `image_url_full` once it's loaded. Use a CSS transition for the swap. Met thumbs are at `/web-large/` paths (~80–100 KB), NGA thumbs are 200×200 IIIF crops.

### 4. Dashboard widget
- New `<QuoteOfTheDayWidget />` component on the Today tab
- Calls `getDailyContent()` — same item the login screen showed
- Compact card, ~300×200, containing:
  - For quotes: text + small attribution
  - For artwork: `image_url_thumb` + title + artist
- Click → opens full-resolution image in new tab (artwork) or expands inline (quote)

### 5. Polish
- Alt text on images (use `item.title` plus artist name)
- Semantic markup for quotes (`<blockquote>` + `<cite>`)
- Test with very long quotes (Berry has some long ones) and very short ones (Pollan's "Eat food. Not too much. Mostly plants.")
- Test artwork display at typical desktop and mobile breakpoints — Met images are mostly landscape but some are tall portraits (the Currier & Ives prints especially)

---

## Data model reference

```
nff_content.json
├── version          (string)
├── people           (object) — id → person
│   └── {id}
│       ├── name          "Joel Salatin"
│       ├── lifespan      "b. 1957"
│       ├── role          "Farmer, author, regenerative agriculture pioneer"
│       └── bio           "Operator of Polyface Farm in Virginia and the godfather..."
├── quotes           (array)
│   └── {item}
│       ├── id            "salatin-01"
│       ├── type          "quote"
│       ├── text          "The animals are happy, the land is happy..."
│       └── author_id     "salatin"  → people.salatin
└── artwork          (array)
    └── {item}
        ├── id                "met-11145"
        ├── type              "artwork"
        ├── title             "The Veteran in a New Field"
        ├── date              "1865"
        ├── medium            "Oil on canvas"
        ├── artist_id         "homer"  → people.homer
        ├── credit_line       "Bequest of Miss Adelaide..."
        ├── image_url_full    "https://images.metmuseum.org/.../DP102298.jpg"
        ├── image_url_thumb   "https://images.metmuseum.org/.../web-large/..."
        ├── object_url        "https://www.metmuseum.org/art/collection/search/11145"
        ├── source            "The Metropolitan Museum of Art"
        ├── source_short      "Met"
        └── license           "Public Domain (CC0)"
```

Both `quotes[]` and `artwork[]` items share `id` and `type` fields, so you can union them into a single rotation array. The `type` field tells the renderer which template to use.

---

## Sources & licensing

All artwork is **public domain (CC0)**:

- **The Met Open Access** — no permission, no attribution required, commercial use allowed. URLs at `images.metmuseum.org/CRDImages/...`
- **National Gallery of Art** — CC0, no fees, attribution encouraged but not required. Suggested credit: "Courtesy National Gallery of Art, Washington". URLs are IIIF format at `api.nga.gov/iiif/{uuid}/full/full/0/default.jpg`

The `credit_line` field on each artwork is the institution's official credit text — display it on the attribution block where appropriate. Don't strictly need to, but it's good practice and costs nothing.

If any image URL ever breaks (institutions occasionally rearrange their image servers), `object_url` links to the institution's permanent record where current image URLs can be retrieved.

Quotes are quoted briefly enough to fall within fair use; most are widely-circulated public statements. No attribution-linked image rights or licensing concerns for the quotes.

---

## Open questions / decisions deferred

- **Rotation ordering**: simple alternation (Q-A-Q-A-Q-A) vs. random shuffle vs. seasonally-themed grouping (winter farm scenes in winter, etc.). Current spec is simple alternation. Seasonal grouping is a nice-to-have for v2.
- **Multiple quotes per day**: should the dashboard widget ever show a *different* item from the login screen? Currently spec says no — same item both places. Could revisit if dashboard real estate feels redundant.
- **Adding new content over time**: the data file is hand-edited JSON. Fine for v1. If it grows past ~200 items it might warrant a small CMS or admin UI.
- **User favorites / "show me this again"**: not in scope for v1, easy to add later via `window.storage` keyed by item id.

---

## Estimated effort

- Curating artwork: 20 minutes
- Daily rotation utility: 15 minutes
- Login screen integration: 1.5–2 hours (most of the work is the polished overlay + view-artwork-fullscreen interaction)
- Dashboard widget: 30–45 minutes
- Polish, testing, edge cases: 1 hour

**Total: ~4 hours of focused work** once curation is done.
