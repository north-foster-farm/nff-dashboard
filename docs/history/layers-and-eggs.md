# Layers and eggs

The layer flock is the farm's only year-round product line and the
least-built feature in the app. Eggs get counted; nothing after the
count exists. This is how the counting got good and why the carton
never arrived.

## Evolutions

**2026-05-01 — layers precede the app.** `7352c0b` brings
`src/data/nff-data.json`, already describing species `layers`
(`purpose: "Egg production"`), four band-named groups, and a
`productKinds` entry `eggs` with `saleUnit: "dozen"` and exactly one
size bracket: `{ id: "default", label: "1 dozen" }` — the decision
constraining everything downstream. Three threads ride along, all
still open: `thread_egg_inventory_model` (count cartons before market
vs log as collected), `thread_packaging_cost`,
`thread_seasonal_availability`.

**2026-05-04 — FIFO stubs that never filled.** Migration `0005`
(`4a23921`) creates `egg_lots` (collection_date, carton_count,
eggs_per_carton, location) and `chicken_lots`, both "schema only,
empty", with a header promising "the egg-lot editor". No batch ever
claimed it, and `nff-data.json` still says egg inventory "is currently
created by counting cartons just before going to a market."

**2026-05-05 — the research that fixed the metric list.**
`docs/research/livestock-metrics.md` (promoted from
`.ignored/roadmap-updates.md` in H1 — m3-ignored.md
§roadmap-updates.md) sets the vocabulary: hen-housed production is
"the more honest economic number, because it bakes in mortality and
culls", 280–320 eggs/hen for Red Sex-Links; feed per dozen 3.5–4.5 lb
confined; egg mass beats count as a denominator because older hens lay
bigger eggs; body-weight sampling every 4–6 weeks with two named
failure modes. Every layer metric in the app transcribes this page.

**2026-05-06 — "Wash & pack" exists as a place, briefly.** Migration
`0009` seeds it as a *site* with "Egg station" as an example location
(`ROADMAP.md:266`). Batch 15 (`acfd246`) collapsed sites into `places`
and the node did not survive — prod has no `*wash*` place today
(verified). Egg handling reattached to generic `House`/`Cold storage`.

**2026-06-02 — the one big build: batch 26.1** (`48583ee`,
`v0.10.24-alpha`, `ROADMAP.md:2061`). Migration `0023` adds the
`metrics` registry (10 definitions, `applies_to` = `broiler_batch` |
`layer_flock`), `weight_samples`, and `egg_collections` — "one row per
egg-count capture per flock. Distinct from egg_lots (carton
inventory): this is the production record", with a client-suppliable
uuid so offline replays are idempotent and an optional
`avg_egg_weight_oz` behind a 2.0 oz fallback. It also adds
`livestock_groups.placed_count`, because `count` is live and
hen-housed needs the original denominator. `lib/metrics.js` lands as
pure functions under a stated philosophy: anything uncomputable
returns a *caveat*, never a wrong number. Capture arrives twice — the
**Eggs quick action** as Rounds' fourth tray button (place → layer
group → count, queued through the offline outbox as both an
`eggs_collected` activity row and an `egg_collections` insert) and a
desktop **Egg log card** on the layer batch page. Batch 26.2
(`e48d90d`, `ROADMAP.md:2148`) adds the Metrics page's layer flock
comparison sheet.

**2026-06-02 — inventory supersedes the stubs without deleting them.**
Batch 28.1 (`1aef072`, migration `0027`) builds real `inventory_lots`;
its header records that the Batch-4 placeholders "are superseded by
inventory_lots but left untouched per the additive-only rule"
(`useReferenceData.js:27` agrees). `0027` treats eggs as the
non-bracketed case — "null means the lot is of a non-bracketed product
(eggs …)".

**2026-06-04 — the egg day becomes chores** (`b0ff48f`; `batch 41`
alone = the chores rebuild, *not* the `41.N` Schedule series). The
clean-slate set from `docs/specs/nff-chores-spec.md` encodes the
workflow as ordinary chores: Collect eggs twice (mid-morning and late
afternoon, deadline = following block), Wash eggs, Pack eggs into
cartons, Add cartons to inventory, Refrigerate eggs, plus Clean egg
washer (quarterly) and Compost discarded eggs. The rebuild "dropped
the layers owner" — house egg work became place-scoped, not
flock-owned (m2-roadmap.md:213; `nff-chores-spec.md:414`). Three carry
`tags: ["data-capture"]` in `src/data/choreSeeds.js`, "Add cartons to
inventory" among them — the tag is inert, appearing nowhere else in
`src/`.

**2026-06-04 — the walkthrough audit says layers are wrong** (all
F-numbers here are 06-04 audit numbers). F112: drop the `#N` ordinals,
make cohabitation the organizing concept, allow flock *names* ("the
oldies") — "flocks are just wrappers around batches". F113 is
load-bearing: "layers arrive… **There's no pasture move, no
processing, no brooder cleanup for layers**… we only need to care about
arrival. And if there's an event that causes them to leave in a large
group, we need a move out button… culled or sold." F36/F41: the
comparison unit is the coop — "the real comparison isn't between
flocks, it's among roommates." F114: two layer groups have no arrival
date. F115: egg and sample logging belong on the active-round screen.

**2026-07-02 — the 07-02 walkthrough reverses F113.** F20 (07-02
audit) asks for what F113 forbade: "**Lifecycle rules → processes:**
pasture-move day ≈ 20 days post-arrival (calculated); processing day
comes from a calendar (manual input); brooder clean-out … within ~a
week", plus the undisputed part — "Egg data must average across batches
cohabiting a coop." The newer directive won and shipped as-specified;
F113's move-out action was neither built nor retired.

**2026-07-02 — 42.16, species-scoped processes** (`5bdf362`, migration
`0049`, `ROADMAP.md:4657`). Foundation, not feature: processes link to
event *kinds*, and broiler and layer arrivals share
`batch_milestones`, so "Broiler pasture (lifecycle)" was only
*implicitly* broiler-scoped — safe only while layers had no arrival
events. `0049` adds nullable `processes.species_id` and backfills
`Broiler %`; the pure predicate `processAppliesToSpecies()` plus a
hoisted `resolveSpecies` in `useProcessRunner` skip a mis-scoped
process before writing any expansion. Without it, layer arrivals would
have cross-fired both lifecycles onto both species.

**2026-07-02 — 42.17, the layer lifecycle** (`bd41834`, migration
`0050`, `ROADMAP.md:4676`). Layers get the post-`0038` broiler pattern
exactly: an automation ("Layer batch arrival", `batch_created`,
`species_id: layers`) whose only job is the arrival *event* as anchor,
and a species-scoped process ("Layer pasture (lifecycle)") hanging two
chore steps off it — Move to pasture +20d (batch anchor), Brooder
cleanout +27d (`former_occupancy` anchor, tag `brooder`). The gate on
BatchPage's lifecycle strip widens to `isMeatSpecies ||
isLayerSpecies`; sheep stay out. It fires on insert only, so the four
existing layer groups never populated.

**2026-07-02 — 42.18, cohabiting egg averages** (`a40d0ec`,
`ROADMAP.md:4693`). Eggs from a shared coop can't be attributed to one
band, so `coopMateIds(groupId, placements)` reads current occupants off
the `placements` model (the structured cohabitation source, per James)
and `aggregateLayerCohort(members)` sums hen counts and concatenates
collections into a synthetic group `henHousedProduction` /
`layingRate` consume unchanged. Feed efficiency deliberately stays
per-flock; both helpers are TDD'd in `src/lib/metrics.test.js`.

**2026-07-02 — 42.19, close-out plus a retirement** (`da2f414`,
`ROADMAP.md:4712`). `AddBatchForm`'s doubly-stale copy is fixed, and
**F26 (07-02 audit) — rename "Automations" to process language — was
retired rather than done**: post-`0038` the two are distinct
subsystems changing for different reasons (automations = DB-trigger
rules on data events; processes = user-authored, calendar-anchored
chore generators), so a blanket rename would mislabel the feed-reorder
rule. Decided with James; both terms stay.

**2026-07-29 — verified against prod.** Both migrations are live: prod
carries `Layer pasture (lifecycle)` (`species_id: layers`, active) with
both steps at +20/+27 and the `former_occupancy` anchor, plus an
enabled `Layer batch arrival` automation. That incidentally settles a
dependency question — `0050` references `chore_blocks.slug` (`0033`)
and the `former_occupancy` CHECK widening (`0040`), both flagged
authored-not-pushed in m1 §3, so both must in fact be applied.

## Current state

**Schema.** `egg_collections` (mig `0023`): `group_id`,
`collected_on`, `count`, `avg_egg_weight_oz`, `notes`,
`recorded_by_email`; admin RLS + realtime.
`livestock_groups.placed_count` is the hen-housed denominator.
`metrics` holds 5 seeded `layer_flock` definitions.
`processes.species_id` (`0049`) plus the `0050` seed rows give layers
their lifecycle. The `0005` stubs **`egg_lots` and `chicken_lots` are
still in the schema and still empty on prod** (verified), kept under
the additive-only rule.

**Lib.** `src/lib/metrics.js`: `henHousedProduction`, `layingRate`
(trailing 14 days), `layerFeedEfficiency` (feed/dozen + feed/lb egg
mass over the first→last collection window), `bodyWeightTrend` with
`burning_reserves` / `getting_fat` flags, `coopMateIds`,
`aggregateLayerCohort`, `DEFAULT_EGG_WEIGHT_OZ = 2.0`, and the species
predicates `isLayerSpecies` / `isMeatSpecies` — both **regexes over
the species' free-text `purpose`** (`/egg/i`, `/meat/i`), not IDs.

**Hooks, capture, surfaces.** `useEggCollections(groupId | null)`
(CRUD + realtime); `logEggCollection` (`useRunEvents.js`) enqueues a
`run_event` row plus an idempotent `egg_collection_insert` dated with
`localDateString`. `EggsSheet` (`QuickActionsTray.jsx`) scopes
candidates to the picked place's subtree but falls back to every layer
group ("eggs get carried around; don't make the user fight the
picker"). `BatchMetrics.jsx` → `ProductionCard` + `EggLogCard`;
`pages/Metrics.jsx` → flock comparison sheet + definitions registry;
`Observations.jsx:19` → `eggs_collected` filter chip;
`BatchPage.jsx:422` → the lifecycle gate.

**Where the code disagrees with the dossiers.**

- **42.18's pooling landed on one surface of two.** `ProductionCard`
  pools; the Metrics flock sheet still calls
  `henHousedProduction(flock, …)` / `layingRate(flock, …)`
  (`src/pages/Metrics.jsx:216–217`). The same two numbers read pooled
  on the batch page and unpooled on Metrics. F36 (06-04) is open.
- **Mortality pools nowhere.** `ProductionCard` calls
  `mortalityStats(batch, …)`, and prod's `layer_mortality` definition
  still reads "losses logged on the **flock**" against the broiler
  definition's "cohort" — precisely the inconsistency F41 (06-04)
  named. Both halves open.
- **`avg_egg_weight_oz` is never captured.** Neither sheet offers the
  field; `logEggCollection` never sends it. "Feed per lb egg mass" is
  therefore always exactly feed-per-dozen ÷ 1.5 — a unit conversion
  posing as a second metric, and the research's "better denominator"
  is unreachable.
- **`egg_collections` has no place.** Only the activity row carries
  `placeId`, so pooling uses *today's* placements (`coopMateIds`
  filters `movedOut == null`) and historical hen-housed silently
  re-pools when birds move coops.
- **The UTC-date bug fixed as F22g (07-02) survives here.**
  `EggLogCard` defaults to `new Date().toISOString().slice(0, 10)`
  (`BatchMetrics.jsx:477`, and `:340` for weigh-ins) while
  `isoDateLocal` exists for exactly this. An evening entry logs
  tomorrow.
- **Prod has no egg data at all.** `egg_collections` is empty;
  `layers_no_band`, `layers_blue_band` and `layers_orange_band` have
  `count`, `placed_count` **and** `arrival_date` null — F114 (06-04)
  never backfilled — leaving only `layers_gold_band` (200 hens)
  computable. Coop layout matches 42.18's claim: no/blue/orange share
  Mobile Coop 2, gold is alone in Mobile Coop 1.
- **F112 (06-04) is untouched.** `SpeciesPage.jsx:395` still renders
  `#{group.ordinal}` and `:447` a `cohabits` string; no flock naming.

**Wash/pack and egg inventory are not first-class steps** — verified
both ways. Washing, packing, refrigerating and "Add cartons to
inventory" exist *only* as chore definitions (live on prod,
`retired_at` null): a checkbox each, no quantity, no carton count, no
grading, no lot. `inventory_lots` is empty on prod and nothing writes
an egg lot; `egg_lots` is empty and referenced by no code. No egg
grading exists anywhere — `product_kinds.eggs` still has the single
`default` / "1 dozen" bracket, and prod has no `product_prices` or
`product_sales` row for eggs.

## Unresolved threads

- **Reconcile F113 (06-04) with F20 (07-02).** F20's lifecycle
  shipped; F113's model never did. Layers still lack a **move-out
  action recording culled vs sold** with an end date — the only way a
  flock leaves. 42.17 substituted "set a processing date manually
  (retired-cohort)", a broiler affordance wearing a layer label.
- **Finish the pooling story.** Port `coopMateIds` /
  `aggregateLayerCohort` into `pages/Metrics.jsx` (F36, 06-04); pool
  mortality (F41a); land the additive migration correcting the
  `layer_mortality` definition text (F41b — prod-parked in the 06-04
  HANDOFF, never executed; m4-audits-memory.md §4).
- **Give collections a place and a weight:** `place_id` on
  `egg_collections` so historical pooling is stable; periodic
  `avg_egg_weight_oz` so egg mass stops being a constant.
- **Backfill the three layer groups** (arrival, placed, live count).
  F114 (06-04) is an hour of data work blocking the whole surface.
- **The flock model (F112, 06-04):** named, cohabitation-derived
  flocks wrapping batches; drop the `#N` ordinals. Blocks the
  "roommates" comparison unit James keeps asking for.
- **Replace the `purpose`-regex species test** with a column or role
  enum before an innocuous copy edit disables egg capture.
- **Collection is decoupled from the collect-eggs chore.** Ticking
  "Collect eggs" prompts nothing; the inert `data-capture` tag is the
  obvious hook, and would properly close the eggs half of F115 (06-04)
  — the weigh-in half has no tray button at all.
- **Never scheduled:** the egg-lot / carton editor `0005` promised in
  May, and `thread_egg_inventory_model` — the count-before-market vs
  log-as-collected decision everything below depends on.
- **Deliberately closed, don't reopen:** F26 (07-02), the
  Automations→processes rename (`da2f414`).

## E-commerce relevance

Eggs are the only product sellable every week of the year, and the app
stops at "how many eggs came out of the coop."

- **No unit conversion.** `egg_collections.count` is individual eggs.
  Nothing divides by 12 and nothing records cracked/discarded (the
  "Compost discarded eggs" chore captures no quantity), so no
  saleable-dozens number exists anywhere.
- **No egg inventory.** `inventory_lots` supports eggs (bracket null)
  but no code path creates an egg lot, and the chore that would
  ("Add cartons to inventory") is a bare checkbox. The
  FIFO/allocation/reversal machinery from 28.1–29.2 is built and would
  work — it has no egg producer feeding it.
- **The catalog cannot express the intended price list.**
  `docs/ecommerce/proposed-prices-summer-2026.md` prices eggs in three
  tiers (Large $7, Medium $5, Pullet $3) while `product_kinds.eggs`
  has one bracket, `default` / "1 dozen". Egg **grading** exists in no
  layer of the system. This is the highest-value schema gap for the
  arc: brackets already carry `minLb`/`maxLb` for chicken, so eggs
  need a size enum or weight-banded bracket set plus a grading step at
  pack time. Prod has zero egg `product_prices` rows.
- **Cost floor unknown.** `nff-data.json` has eggs
  `packagingPerDozen: null` (`thread_packaging_cost`) and calls the
  feed-cost share "derivable … once tracked". The derivation exists
  (`layerFeedEfficiency` returns lb/dozen) but caveats out on empty
  data, so egg margin is uncomputable until collections and carton
  cost both land.
- **Channels already assume eggs.** The `egg_drop` event kind and the
  Scituate Egg Drop series (Saturdays 10–11, Nov 2–Apr 30) are seeded
  in `0005`; the market packing checklist includes "Coolers of eggs"
  (`choreSeeds.js:150`); the seeded 65-contact list is the egg-drop
  list. Online ordering must coexist with a weekly in-person drop and
  three markets, not replace them. And per
  `thread_seasonal_availability` (open since May) eggs are the
  year-round line while meat is available only after a processing day
  — so a storefront needs an on-hand dozens figure, exactly what
  doesn't exist.
- **Order of operations:** capture cartons at pack time (dozens by
  grade → `inventory_lots`) → egg brackets in `product_kinds` → egg
  rows in `product_prices` → storefront. Skipping the first leaves
  eggs sellable only as an untracked flat SKU.
