# NFF Dashboard — Visual Tour of the Remix Propagation

_Generated 2026-06-30. A guided walkthrough of the app-wide design-language
propagation (`main` commits `9290268`→`cbfea96`). Tells you where to go, what
to click, what to look at — and what was left alone on purpose._

Start the app first: `npm run dev`, then open the `localhost` URL it prints
(it picks a free port if 5173 is taken).

---

## How to *read* the change

- **Flush (the new look)** — a card or section is just a **thin hairline border
  sitting directly on the page background**; no grey "lifted" fill behind it.
- **Raised (the old look)** — a **grey `surface` fill** that lifts a box off the
  page. Now reserved *only* for form fields, dropdowns, modals, and
  hairline-separated list rows. Anywhere else, grey-raised = not yet converted.
- **The 4 primitives to spot:** the **28px square checkbox** (fills green + check
  when done), the **uppercase bordered status pills** (Active/Off, Sold out…),
  the **solid-green uppercase buttons**, and **flush sections with a tiny
  uppercase eyebrow title**.

---

## 1. Reference point → **Schedule** (Planning)

Remixed last session — the gold standard everything else now matches. Note the
flush day cards, Lora headings, the **C/P/E identity badges** (teal Chore /
slate Project / periwinkle Event), and the now-marker. Everything below should
feel like *this*.

## 2. The big before/after → **Chores** (Planning) — start here

This page had the most old code; it's the clearest transformation.

- **Today tab:** the checkboxes are now the **big 28px green squares**, identical
  to the Schedule/Rounds boxes. **Check one off** → it fills green with a check
  (same completion path as everywhere else). Block headers, the date, the
  Mine/All toggles are all on the new type system.
- **"All chores" tab:** note the green **"+ ADD CHORE"** button and the
  **By place / A–Z / Time of day** segmented control. Now look at the **search
  box** — it's *still a filled/raised field*. That's **intentional** (form
  controls stay raised). Good contrast to train your eye.
- **⚠️ A real holdout to find:** expand any chore (caret), then click the
  **pencil (edit)**. The inline editor's **input fields** (Title, Description,
  the "belongs to" controls) are still the **older input styling** — that's
  `ChoreFieldsEditor`'s `editInputStyle`, the one inline-style holdout. It sits
  right next to converted stuff, so it's the clearest "not updated yet" example
  on the site.

## 3. Quick circuit of converted pages

For each: cards/sections should be **flush** (hairline border, no grey fill),
buttons solid-green.

- **Processes** (Planning): flush cards, green/grey **ACTIVE / OFF pills**, and
  at the bottom the **"EXPANSIONS"** flush section with an eyebrow title — the
  `Pane` primitive.
- **Projects** (Planning): flush project cards. **Click one** → ProjectPage:
  progress / Notes / Files / Links / phase sections all flush.
- **All products** (Products): flush product rows; expand-carets; the
  **"SOLD OUT" (amber) / "BUNDLE" (grey) pills** and the **"COST FLOOR
  REFERENCE"** flush Pane at the bottom.
- **Inventory** (Products): flush summary tiles + lot cards.
- **Orders** (Sales): flush empty-state, summary tiles, and the order form.
- **Customers** (CRM): flush list; the **search field stays raised**
  (intentional, same as Chores).
- **Layers / Broilers / Sheep** (Animals): one page (SpeciesPage) — 10 sections
  flushed; check the group cards, feed-schedule panel, chores/activity tabs.
- **Feed** (Resources): flush feed cards + the consolidation banner.
- **Calendar** (Planning): flush filters pane + place-context banner (the
  colored event bars are *dynamic* and intentionally kept).
- **Now**, **Inbox**, **Activity**, **What's coming**: flush empty-states/cards.

> Honesty note: I personally eyeballed screenshots of **Chores, Processes,
> Customers, and Products**. The rest passed build + a careful diff audit but I
> haven't seen them rendered — so these are the ones most worth your eyes.

## 4. Deliberately **NOT** changed — not misses

- **Do rounds** (Planning): the full-screen "doing chores" takeover. Still uses
  raised surfaces — **left on purpose** (a full-screen takeover is its own
  raised pattern; it deserves a focused pass, not a blind flip).
- **Hairline-separated list rows** everywhere (Customers directory, Activity
  log…): the rows have a *subtle grey fill* — that's **load-bearing**, it's what
  makes the thin divider lines show. Flushing them would break the separators.
- **All form fields, dropdowns, search boxes, and modals/sheets**: raised by
  design.

## 5. Genuinely old / thin / placeholder (the "second week of dev" flags)

- **Machinery, Suppliers, Trailers** (Resources): real but *very* thin list
  pages (~40 lines each) — basic, never given the design pass.
- **Content calendar** (Communication) and **Equipment** (Resources): literal
  placeholders ("coming soon").
- **Notes, Threads** (Other): bare/early.
- **Component-layer surfaces** I didn't touch this round (only converted
  *pages*): the editor **sheets/modals**, `SitesAdmin`, `PricingGrid`, the
  `CalendarViews` internals. If a *sheet that slides up* looks older than the
  page behind it, that's why.

---

## What shipped (for reference)

20 page surfaces, 7 commits on `main` (not pushed): Chores, Processes, Projects,
Inventory, Customers, Observations, Settings, PlacePage, Products, SpeciesPage,
ProjectPage, Feeds, FeedSchedulesPage, Processing, Calendar, Activity, Roadmap,
Inbox, Now, Orders. View-layer only; zero logic change.

**Remaining tail:** Rounds takeover · `ChoreFieldsEditor` `editInputStyle` ·
the component layer.
