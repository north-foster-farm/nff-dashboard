# NFF // Daily Ops — Roadmap Addendum
## Login screen + Quote-of-the-day widget

### Feature Overview
A unified content rotation system that surfaces a single piece of content per day, alternating between farming quotes and American/New England farm artwork. The same item appears on the login screen (large, immersive) and on a dashboard widget (compact).

---

### Data Model

A unified content set in `nff_content.json` containing:
- **44 quotes** from 25 voices in pastured poultry, regenerative ag, agrarian writing, and pastoral poetry (Salatin, Berry, Herriot, Leopold, E.B. White, Pollan, Mary Oliver, Frost, Wendell Berry, Temple Grandin, Beatrix Potter, etc.)
- **54 artworks** with verified open-access status from The Met and the National Gallery of Art (Homer, Eastman Johnson, Durrie, Inness, Cole, Cropsey, Heade, Kensett, Twachtman, Hassam, plus anonymous American 19th-century folk paintings)
- **Author/artist biographies** shared between content items — every person a quote references and every painter has a `name`, `lifespan`, `role`, and `bio` field

98 total rotation items → roughly one repeat per item every 3+ months on a daily rotation.

---

### Daily Rotation Logic

A deterministic seeded shuffle so the same item appears on login and dashboard the same day, and so the rotation is stable across sessions:

```js
function getDailyContentId(curatedItems, date = new Date()) {
  // Number of days since arbitrary epoch (e.g., 2026-01-01)
  const epoch = new Date('2026-01-01').getTime();
  const dayIndex = Math.floor((date.getTime() - epoch) / 86400000);
  // Stable shuffle seeded on a season offset so we don't keep getting alphabetically-near items
  return curatedItems[dayIndex % curatedItems.length];
}
```

`curatedItems` should be a re-shuffled-once array (e.g. seeded by year) so consecutive days don't always show the same artist or quote source clustered together.

---

### Login Screen UX

- Artwork item: full-bleed background image, dark semi-transparent overlay (`bg-stone-950/60` or similar) so quote/login form text remains readable
- Quote item: warm dark background with a subtle texture or gradient; quote stylized with a display serif (Playfair Display, Cormorant, or similar)
- **Constant** across both: attribution block (name · lifespan · role · 1–2 sentence bio) tucked in a corner or bottom strip
- **"View artwork" toggle button**: temporarily removes the dark overlay AND hides all text/UI to display the painting in full clarity. Toggle back to restore the login UI.
- For artwork: button to open the full-resolution image in a new tab (deep-links to `image_full` URL)

---

### Dashboard Widget UX

- Small card (~300×200) showing either:
  - Quote: text + small attribution
  - Artwork: thumbnail image (use `image_thumb`) + title/artist
- Click to expand or open the full-resolution version in a new tab
- Position: probably the Today tab, top-right or as a sidebar element

---

### Curation Flow

`artwork_curator.jsx` (delivered alongside this doc) is a standalone artifact for browsing the 54 artwork candidates one at a time and marking each Include / Exclude / Skip. Decisions persist to `window.storage` so progress survives reloads. Final export is a JSON file listing the included artwork IDs to filter the dataset down to the curated set.

After curating, filter `nff_content.json` to keep only:
- All quotes (already curated)
- Artwork where `id` is in the exported `included` list

---

### Implementation Tasks

1. **Curate the artwork list** using the curator tool (estimated 15–20 min)
2. **Filter `nff_content.json`** to the curated subset → save as `nff_content.curated.json`
3. **Build the daily rotation utility** (`src/lib/daily-content.js` or similar)
4. **Update login screen component**:
   - Add `<DailyContent />` provider that resolves today's item
   - Background image / quote layout switching based on `item.type`
   - "View artwork" overlay toggle
   - Open-in-new-tab link for full-res
5. **Build dashboard widget** (`<QuoteOfTheDayWidget />`) on the Today tab
6. **Add image preloading** so the login screen background loads quickly (Met images run 1–7 MB at full res; consider serving `image_thumb` first, swapping to `image_full` once loaded)
7. **Test attribution display** for accessibility (alt text on images, semantic markup for quotes)

---

### Files Delivered

| File | Purpose |
|---|---|
| `nff_content.json` | The full unified dataset (quotes + artwork + people) |
| `artwork_curator.jsx` | React tool for browsing and marking artwork inclusion |
| `roadmap_addendum.md` | This document |

---

### Notes on Sources & Licensing

All artwork is **public domain (CC0)** sourced from institutions with explicit open-access programs:

- **The Met Open Access** — no permission, no attribution required, commercial use allowed
- **National Gallery of Art** — CC0, no fees, attribution encouraged but not required (suggested credit: "Courtesy National Gallery of Art, Washington")

Both institutions provide stable image URLs that should remain valid indefinitely. If any URL ever breaks, the `object_url` field links to the institution's permanent record where current image URLs can be fetched.
