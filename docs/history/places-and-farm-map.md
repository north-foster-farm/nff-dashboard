# Places & the farm map

How the farm's *where* got a single spine. Three overlapping place
vocabularies collapsed into one recursive tree with a polymorphic
occupancy edge; a five-lens workshop then demoted the map it was named
after. The model is the durable win; the map itself has not been
touched functionally since 2026-06-02.

## Evolutions

**2026-05-05 — the earliest place-shaped ambition is a rotation
planner.** Before any place model existed, James dumped requirements for
a pasture rotation planner: upload pasture GeoJSON, Suscovich vs Salatin
tractor footprints and capacities, right-angle-move rules, minimum
pasture recovery time, "the app calculates how many moves it will take
to get there" (`docs/specs/pasture-rotation-planner.md`). This became
old Batch 34, a standalone map with its own geometry.

**2026-05-06/07 — "sites, not stops," and three place vocabularies.**
Batch 7 (`82fe686`) laid the chores foundation on a two-level model:
`sites` / `site_locations` / `site_residents` — residents already a
time-bounded occupancy edge (`moved_in` / `moved_out`, one open row per
group). The naming decision (sites are first-class, per-instance,
app-wide, shared across chores, observations, broilers and pasture) was
settled at a 2026-05-06 workshop and survives only in memory (m4 §2,
`project_sites_concept.md`). It landed *beside* two vocabularies already
in the schema: text-keyed `space_kinds` / `space_items` from `0003`
(`4a23921`) behind the Resources flyout, and free-text
`livestock_groups.current_location` from `0004` ("MC2", "MC1", null).
Three vocabularies, none authoritative, all drifting.

**2026-05-31 — the workshop, and the map's own demotion.** After a
three-week roadmap silence (m2 §2026-05-08), a five-lens blind workshop
(Cutter, Maximalist, Data-model purist, Field-ergonomics,
First-principles) plus synthesis and a "Dad" reserve lens —
`docs/workshops/scope-workshop/examples/farm-map/workshop-results.md`.
Four-to-five lenses, blind, independently answered the question the
planning doc had deferred: the field landing should be a time-anchored
*Now* surface and the map a desktop renderer over a place tree, "not the
main screen." Three re-derived *place and time are two projections of
one dataset*; three re-derived surrogate-key + geometry-as-binding
identity. Field-ergonomics found the two defects that drove the build:
`chore_completions` has no place dimension (five tractors, one tick),
and the completion toggle is a naked live call that **reverts on
error** — a tick behind the broiler pasture silently un-ticks.

**2026-05-31 — the settled north-star.**
`docs/specs/farm-map-north-star-requirements.md` (promoted into `docs/`
during H1, `063ffb7`; the `.ignored/farm-map/` copy now sits under
`outdated_see-roadmap/`). Seven decisions locked (§1): map demoted,
phone lands on Now; **desktop lands on the map anyway** — James's
deliberate call *against* the workshop majority, logged as risk 1 in §7;
no unified saved-view primitive in v1 (shared shape, separate
renderers); geography primary with `kind_tag` secondary so Rounds can
still sweep "all coops"; recursive tree, shallow UI; offline pragmatic
not CRDT, with **additive merge for counts non-negotiable**; composable
timeline held to saved filters. Plus two Dad-derived hard requirements:
**D1** every label renders `name` + bold parent ("Mobile Coop 1 ·
**Pasture B**") because per-pasture numbering restarts; **D2** a loud
"round in progress — tap to resume" bar, because deleting the sidebar
would orphan the only rejoin path (§9.4, citing `Rounds.jsx:531`).

**2026-05-31 — the biggest roadmap restructure in the repo's history.**
`dadeb03` inserted the overhaul as Batches 15–18 and renumbered
everything out to 38 (m2 §2026-05-31). The displacements matter more
than the numbers: the **Resources rethink (old Batch 21) was absorbed**
into the place-model collapse and its number vanished from the list; the
**pasture simulator (old 34) was re-pointed** into "Batch 37 — Rotation
planner," a sibling on the shared place-geometry substrate where a plan
is a sequence of future `placements` rows (`ROADMAP.md:3348`); and
slices of Offline, app-wide search and the mobile pass were pulled
*forward* into the farm-map MVP.

**2026-05-31 — Batch 15, the collapse (`acfd246`).** The schema-down
spine, and the most consequential single commit in this chapter.
Migrations `0003/0004/0009/0010/0013` were amended in place under the
still-active pre-production rule and the linked DB was **reset and
reimported** — the *last* pre-production reset this project ever did.
`scripts/backup-db.mjs` and `scripts/restore-db.mjs` were born in this
same commit to make that loop survivable, and CLAUDE.md gained its
"Data safety" section here. `places` (recursive; `parent_id` / `kind` /
`kind_tag` / `code` / `mobile` / `sort_order` / `is_active`),
`placements` (polymorphic `occupant_type` + `occupant_id`, one open row
per occupant) and `place_geometry` (binding shape only) landed;
`space_kinds` / `space_items` and `current_location` were deleted;
`chore_definitions`, `activity_log` and `chore_modifiers` repointed to a
single `place_id`. `src/lib/places.js` and a rewritten `useSites`
shipped alongside, `SitesAdmin` became a recursive tree editor, the
orphaned Resources → Spaces page was removed. The re-seed used real
geography — and diverged from the north-star's canonical inventory
(§9.1) on the spot: the Barn got "High tunnel" and "Fred (40'
container)" rather than Feed storage / Sheep paddock / Machinery.

**2026-05-31 — Batch 16.1, the completion-grain fix (`dd941ed`).**
`chore_completions` gained `place_id`; the natural key became
(chore × place × date), expressed as *two* partial unique indexes
because a plain constraint would treat NULL `place_id` as distinct
(`supabase/migrations/0009_chores_overhaul_foundation.sql:399-409`).
Occupancy-driven fan-out was the design decision of the batch
(`ROADMAP.md:1236`).

**2026-06-01 — Batch 16.2, the outbox (`547ca44`).** `src/lib/outbox.js`
— IndexedDB, append-only, FIFO sync under a Web Lock, conflict policy in
the file header: completions are idempotent row-presence inserts (a
unique violation on replay *is* success), mortality counts carry a delta
and merge additively, run events are at-least-once appends. North-star
§2.6, delivered close to literally.

**2026-06-01 — Batch 18.1, the anchors detour (`f7df449`).** Shipped out
of order for a reason worth remembering: the place-only model proved a
rollout blocker, because chores vanished from Pasture B when the coops
moved (m1 §1.1). `0014` added `anchor_type` over six kinds — the repo's
first additive-only migration — so a chore could belong to a place, a
place *kind*, a species or a batch, and "chores follow the animals"
became true.

**2026-06-01 — Batch 17, Now and the status projection (`b21e892`).**
The Now surface (phone landing, D2 resume bar) plus `place_status` — but
built as **pure functions, "no table, no view"** (`ROADMAP.md:1367`),
not the materialized projection §2.7 specified. Rounded out by
`8a798a3` (place-grouped Now) and `30c0678` (Today place-tree grouping).

**2026-06-01 — Batch 18.2, the map itself (`b1e2a81`).** `farm-map_v1.svg`
committed to `public/`, fetched and parsed at runtime; layers bound to
places by explicit `place_geometry` row first, then slug match, with
slug-derived bindings **persisted back** so the table reflects reality;
zones tinted by the `place_status` rollup; click-to-zoom into
auto-laid-out structure pins. Plus place pages, place search (names,
codes, occupants — typing "gold band" finds Mobile Coop 1), and the IA
overhaul: sidebar slimmed to Now · Farm map · Dashboard, records moved
into a new `RecordsDrawer`, the Resources flyout's place-type
placeholders deleted, desktop landing switched to the map
(`ROADMAP.md:1527-1595`).

**2026-06-02 — half the IA overhaul is undone the next day
(`0b4d003`).** In a grab-bag of field-use fixes: "the records groups …
move back into the left sidebar from the avatar drawer;
`RecordsDrawer.jsx` is deleted and the avatar now opens Settings."
North-star §5.1 — the single change that *started* the project — lasted
one day. Surrounding fixes: `a611ec0` (URL routing for place pages),
`b9f27f2` (per-mount realtime topics — map → place page crashed),
`9614564` (map exempt from text scaling), `aa101d4` (pinch zoom +
on-screen controls), `6d867cd` (map text and pins enlarged).

**2026-06-04 — the walkthrough audit puts eyes on it.** Clip 2 is Now +
Farm map, findings **F9–F13 of the 2026-06-04 numbering**
(`audits/2026-06-04/findings.md:150-215`). The map's look, the "quiet"
swatch, the EDIT PLACES placement and the zoom-aware help text were all
explicitly endorsed. F11 (done vs to-do tints too similar), F12
(`align-items: start` in the map header) and F13 (opaque "code" in the
search placeholder) were real, and all three are still open in code.

**2026-06-28 — the placement fork, and James overrules the safe
option.** Broiler batches routinely run split across 5+ chicken tractors,
which the one-open-row-per-occupant constraint made unrepresentable, and
brooder cleanout resolved to wherever the batch *now* is (the pasture)
instead of the brooder it left. The design doc
(`records/broiler-brooder-placement-design.md`) recommended Option B —
no migration, resolve cleanout from placement history. James chose
**Option A**: "Brooders aren't the only place a batch can be split …
one batch is split across 5+ chicken tractors." `0039` (`9aa027e`)
swapped the constraint to one open row per (occupant, place); `2a7d43e`
applied it and turned the BatchPage "Where" card into a set-of-places
editor; `cc72b04` added the `former_occupancy` anchor and `0040`. The
same investigation diagnosed **F50 of the 2026-06-28 round** as not a
code bug: the dormant logic was right, the *data* was stale — batch 4
still held an open Mobile Brooder placement 31 days after arrival
because nothing closed it on the move to pasture.

**2026-06-26 — the place-anchored time substrate is dropped.** Migration
`0036` (`b4c217d`) dropped `timeline_items`, the view Batch 15 had
carefully given a `place_id`. §2.4's "one place-anchored unified
occurrence shape" no longer exists anywhere; Schedule reads `commitments`
instead, and the map/timeline duality that justified the whole design
now holds only conceptually.

**2026-06-30 → 2026-07-29 — cosmetic only.** `19fe487` / `de92adf` swept
`PlaceTree` and `SitesAdmin` onto the remix vocabulary; `f230327` (42.22)
changed a glyph. Nothing functional has changed on any place or map
surface since 2026-06-02.

## Current state

**Schema** (all applied to prod, verified by read): `places`,
`placements`, `place_geometry` in
`supabase/migrations/0009_chores_overhaul_foundation.sql:50-170`;
`chore_completions.place_id` + the two partial unique indexes at
`:399-409`; `0039_placements_multi_occupancy.sql` (constraint swap);
`0040_anchor_type_former_occupancy.sql`.

**Migration 0040 IS on prod** — the H1 hazard flag is resolved.
`scripts/prod-read.sh` returns two `process_steps` rows and one
`chore_definitions` row with `anchor_type = 'former_occupancy'` (all
"Brooder cleanout"), which the pre-`0040` CHECK constraints from `0014`
and `0037` would have rejected on insert. The brooder-cleanout step
write is not 400ing.

**Live place tree**: 20 rows, four levels deep — North Foster Farm
(`farm`) → Pastures / Brooders (`zone`) → Pasture A/B/C (`area`) →
Chicken tractors 1–5, Mobile Coops 1–2, Brooder 1, Mobile Brooder
(`structure`), plus House, Barn, High tunnel, Fred (40' container),
Cold storage. `kind` is `farm/zone/area/structure`, **not** the
north-star's `farm/zone/structure/unit`. `place_geometry` holds six
self-persisted rows with centroids (House, Barn, Brooders,
Pasture-A/B/C) — and binds at *both* `area` and `structure` kinds, so
`kind` does not determine map zone-ness; binding does.

**Live placements**: 14 rows. `occupant_type` is exercised for `batch`
*and* `machine` (Kubota tractor, JD backhoe, JD excavator in the Barn);
`equipment` and `feed_lot` from §2.2 never got tables, and Resources →
Equipment is still a `comingSoon` placeholder (`src/sections.jsx:131`).
Multi-occupancy is available but unused in anger — batch 4 sits in one
tractor, not five.

**Lib layer**: `src/lib/places.js` (`buildPlaceTree`, `descendantIds`,
`placePath`, `displayPlace`, `childrenOf`), `src/lib/placeStatus.js`
(`obligationStatus`, `computePlaceStatus` → obligations + `byPlace`
rollup + `flagOf`), `src/lib/farmMap.js` (`parseFarmMapSvg`,
`bindLayersToPlaces`, `zoomTransform`, `layoutPins`, `FLAG_TINTS`),
`src/lib/outbox.js` (756 lines), and the anchor resolver
`obligationPlaceIds` (`src/lib/chores.js:818-915`) covering `none` /
`place` / `occupied_place` / `place_kind` / `species` / `batch` /
`former_occupancy`. Tests cover `places`, `placeStatus`, `farmMap`;
**none cover `outbox.js`**.

**Hooks / UI**: `useSites` (places + placements CRUD, `choreCtx`,
`placementsByOccupant` history index), `usePlaceGeometry`, `MapPage`
(desktop landing via `App.jsx:33 defaultPath()`), `FarmMap` +
`MapLegend`, `PlacePage`, `PlaceSearch`, `PlaceTag`, `PlaceTree` (reused
by Chores' "By place" tree and by Rounds), `SitesAdmin` behind
`SitesPage`, and `Now` with the D2 `ResumeBar`.

**Where the code contradicts the design record**: m4 §3 lists the
farm-map remainder as "place-tree consolidation of the three place
models, per-(chore × place × date) completion grain, map renderer / nav
restructure" — all four of those *shipped* in Batches 15–18.2. What
actually remains is narrower and different: `place_status` is a
client-side projection rather than the materialized table §2.7
required; the records-drawer IA was reverted a day after landing; the
place-anchored occurrence view was dropped by `0036`; Rounds got a
kind-tag *filter* (`Rounds.jsx:112, 1004-1028`) rather than the
group-by-zone-or-kind toggle of §3.3; and the SVG still has zone
geometry only.

## Unresolved threads

- **Placement data goes stale silently, and that poisons everything
  downstream.** `broilers_batch_3` (arrived 2026-05-13) still holds an
  *open* placement in Brooder 1 opened 2026-06-02; `broilers_batch_5`
  (arrived 2026-07-01) has **no placement row at all**. Map tint,
  dormant-chore hiding and `occupied_place` fan-out all read current
  occupancy, so the map is lying right now. This is the F50-class
  failure (2026-06-28 round) recurring *after* its fix. Needs either an
  automated "move to pasture closes brooder placements" step or a
  placement-staleness warning — and a data cleanup either way.
- **`outbox.js` has zero unit coverage** — 756 lines carrying the
  additive-merge guarantee James called non-negotiable, in a repo where
  TDD is the standing rule. Highest-value test gap in the codebase.
- **`place_status` correctness has no guard.** Risk 3 of the north-star
  said "if the projection drifts, the map lies." Being pure removes
  drift risk but adds no caching: every place surface re-derives the
  whole fan-out on mount. Decide deliberately — keep pure, or promote to
  the materialized table §2.7 specified.
- **F11 / F12 / F13 (2026-06-04) still open**, and F11 is worse than the
  audit knew: in the light theme `--c-accent` and `--c-resolved` are the
  *same* hex (`#297d5a`, `public/style-guide/assets/ds.css:67-70`), so
  "to do" and "all done" zones differ only by fill opacity (0.55 vs 0.40
  in `FLAG_TINTS`). F12 is literally `items-start` at
  `src/pages/MapPage.jsx:152`; F13 is the "Find a place, code, or animal
  batch…" placeholder at `src/components/PlaceSearch.jsx:124`.
- **F10 (2026-06-04) — overdue rollover semantics — never settled.**
  Block-anchored chores flip to overdue only after today's window ends,
  but window/deadline chores stay `overran` indefinitely
  (`src/lib/chores.js:638-650`), so yesterday's miss still reads as
  overdue at 4am. A design question, not a bug.
- **The records-drawer IA question is open, not closed.** `0b4d003`
  reverted it as a field-use fix without revisiting the argument. Either
  re-adopt §5.1 deliberately or retire it from the north-star.
- **The geometry tail is untouched.** Structure-level SVG geometry stays
  deferred (`ROADMAP.md:1590`) so pins are grid-laid-out, and §8's
  CI-validated SVG↔place drift invariant was never built — with bindings
  self-persisting, a renamed layer silently degrades to background art.
- **Batch 37 rotation planner is unbuilt** and now has two records:
  `ROADMAP.md:3348` (re-pointed onto the place substrate) and
  `docs/specs/pasture-rotation-planner.md` (2026-05-05 requirements,
  including a GeoJSON path pointing into James's Downloads folder).
  Reconcile before scoping.
- **Asset occupants never got real tables.** §2.2/§5.2 required
  equipment, machinery, feed and containers to become typed occupants;
  only `machine` placements exist, seeded once, and Machinery / Trailers
  / Feed remain `0003` reference lookups.
- **Multi-occupancy is unexercised.** `0039` bought split occupancy for
  the 5+ tractor case and no live batch uses it — verify on the next real
  broiler batch, alongside the chore-generator verify queued in m4 §3.

## E-commerce relevance

Small but real, and easy to miss:

- **`inventory_lots.place_id` is a FK to `places`** — storage locations
  are places by deliberate design: "freezers/fridges get added to the
  place tree via the existing Edit-places page, not as free text"
  (`supabase/migrations/0027_inventory.sql:20-22, 38`). The table is
  **empty on prod**, and the tree holds one generic "Cold storage"
  container under House — no freezers, no fridges. Stock-on-hand-by-
  location reporting needs those places seeded first: minutes of work in
  Edit places, but nothing works until it happens.
- **Pickup/fulfillment locations are *not* places.** `orders` (`0028`)
  carries `fulfillment_method` in `('pickup','delivery','shipping')`
  with no `place_id`. If pickup points ever need naming on the
  storefront, decide then whether they are places or a commerce-side
  concept; don't assume the tree covers it.
- Nothing else: the place tree, the map renderer, occupancy and
  `place_status` are farm-operations-internal and carry no
  customer-facing surface.
