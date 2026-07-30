# The Design — how to best leverage the Rethinker arc additions

_Output of the Harvest-Remix Design Bracket, 2026-06-29. Premise: the arc
components were added as RAW MATERIAL to be harvested + remixed into the real
app, not finished components to keep as-is._

## The answer in one line

**Re-home the harvested signals to where decisions happen (Operator's product
IA — phone Today glance + live Rounds), and land them with Systematizer's
discipline (one promoted primitive vocabulary, cheapest-first migration).** The
two finalists are complementary: Operator decides *where* the value lives;
Systematizer decides *how* to build it cheaply and consistently. Both judges
converged on this hybrid (criteria judge: "hybrid"; Dad judge: "operator" with
Systematizer's primitives as internal structure).

## How the bracket ran

- 4 blind harvesting strategies → 3-lens gate → 2 survivors → 2 coded mockups →
  final criteria + "Dad" field-comprehension judging.
- **Survivors:** Systematizer (one app-wide vocabulary) + Operator (re-home
  signals to phone). **Eliminated, grafted:** Recombiner (the `farmLoad` data
  collapse — kept; its god-component `LoadStrip` — dropped) and Editor (the
  cost-discipline guardrail — kept).
- Mockups: `mockups/operator/index.html`, `mockups/systematizer/index.html`
  (open in a browser; theme + state toggles are live). Screenshots:
  `operator-light.png`, `operator-mandown.png`, `operator-dark.png`,
  `systematizer-light.png`.

## Final scores (avg of criteria + Dad lens, 1–5)

| | glance | tap | state | fits | comp | dist |
|---|---|---|---|---|---|---|
| Operator | **5** | **5** | 3.5 | 4 | **5** | 3.5 |
| Systematizer | 3 | 2.5 | 4.5 | 4.5 | 3 | 4 |

Operator wins the field-use axes (glanceability, tap-cost, comprehension);
Systematizer wins the build axes (state coverage, fits-system, distinctiveness).
That split is exactly why the Design takes Operator's IA on Systematizer's rails.

## The Design (what to build)

### Product shape — from Operator
- **Phone Today glance is the lead surface.** Top-to-bottom in tap-priority:
  NowRule → (man-down) AttentionCard → count-driven day-load strip → block
  groups → deep-link into Rounds.
- **Live Rounds is the doing surface.** Flush `PlaceSection`s; the AttentionCard
  surfaces *inside* the running round, not only on Schedule; `SealStamp` reveals
  on completion. **No "confirm the day" affordance** — a block is sealed by
  completion.
- **Man-down re-homes to where it's seen** — the one `AttentionCard` jumps to
  the top of the glance AND into the running round; the day-load burns the
  affected block warn; "N uncovered" count.
- **Desktop is the de-emphasized scan/plan tier.** The two-lane person ribbon is
  **cut** (desktop-only + empty in production). The week is drawn **once** — in
  the sidebar list, each row carrying an inline mini-spine + a single
  should-heat tick (amber = warming, red = processing-deadline).

### Build method — from Systematizer
Promote ONE shared vocabulary into `ui.jsx` (+ `lib/load/farmLoad.js`), used by
phone, desktop, Rounds, Chores, Dashboard alike, never surfaced as the mockup's
documentation scaffolding (drop the primitive-index rail + superscript chips —
those were presentation only):

`Pane` (flush) · `Eyebrow` · `Heading` · `NowRule` · `AttentionCard`/Hole ·
`SealStamp` · `LoadSpine` (count-driven) · `EventRow` · `CheckTarget` ·
`WeekStrip`.

### Grafts baked in
- **`farmLoad` data-walk** (Recombiner): collapse `weekFullness` +
  `weekShouldHeat` + `personLoad` into one model + a shared `heatColor()`. Keep
  completion-fraction (Rounds) vs item-count-load (Dashboard/week) visually kin
  but semantically distinct — NOT one polymorphic widget.
- **Person-lane as conditional overlay** (Recombiner/Systematizer): draws only
  on days with real reservation/hole data; never the base layer. (Operator cut
  it outright; the overlay is the honest middle — keep man-down lane context for
  free without empty lanes on normal days.)
- **`model(state)` full re-render** (Systematizer): fixes Operator's weakest
  point so dense/sparse/overdue change the whole phone body, not just the strip.
- **Always show the count next to any bar** (Dad lens): "N items · M blocks"
  beside the LoadSpine; ideally a per-bar count — never height-alone.

## The settled shared floor (true regardless — all 4 strategies agreed)
1. Flush, not raised — panes are `border` on `--c-bg`; attention =
   `color-mix(--c-warn N%, --c-bg)`. (Floating overlays/sheets/modals stay
   raised.)
2. `ChoreCheckRow`'s raised `border-l-2 bg-warn/5` escalation → the flush
   AttentionCard/Hole treatment.
3. One `NowRule` (collapse `NowMarker` + the pool copy), today-views only.
4. Lora headings + Inter eyebrows fold into the card header.
5. Delete the duplicate center `WeekSpines`; the wired sidebar `WeekList`
   survives and absorbs the week silhouette.
6. `SealStamp` anchors the Rounds wrap card.
7. Cut the sparse two-lane ribbon; cut `personLoad.js` (man-down hole already
   derives from `manDown.js`) — except keep its `hole` derivation if the
   conditional overlay is built.
8. Promote-then-delete the `/rethinker` scratch (RethinkerKit + RethinkerGallery
   + the 2 nav lines: `sections.jsx` item + `SectionContent.jsx` case) IN-BATCH,
   no soak (NO-LEGACY).

## Migration ledger (cheapest-first — Editor's guardrail)
- **Step 1 (cheap, low-risk, do first):** `Card → Pane` flush-flip (~1 line);
  `ChoreCheckRow` escalation → Hole; `NowMarker`/pool → one `NowRule`.
- **Step 2:** promote `AttentionCard`/`SealStamp`/`CheckTarget`/`LoadSpine` into
  `ui.jsx`; add `lib/load/farmLoad.js`; wire the phone Today glance + in-run
  AttentionCard.
- **Step 3:** fold the week into the sidebar `WeekList` (spine + heat tick);
  delete center `WeekSpines` + `DayRibbon`.
- **Deferrable follow-ups (not big-bang):** `StatTile` → flush stat grid;
  `PlaceSection` `bg-surface` → `Pane`; full Overview/Metrics migration.
- **Last:** delete the `/rethinker` scratch + nav wiring.

## Open questions for James
1. **Proceed to build?** This bracket's deliverable is the Design above + the two
   mockups. Implementation (the migration ledger) is the next phase if you want
   it.
2. **Person-lane overlay — keep or cut?** Operator cuts it; the graft keeps it as
   a conditional overlay. Cheap either way; your call on whether man-down lane
   context earns the small extra complexity.
3. **Theme:** dark verified to translate cleanly (see `operator-dark.png`) — no
   blocker; light stays the default.
