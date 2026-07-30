# Processing & broilers

The meat-bird arc: chicks arrive, occupy brooders, move to pasture
tractors, get weighed, eat a measured feed program, and are processed on
a scheduled day into cuts that become sellable inventory. Broiler
batches and the lifecycle page, the processing-day workspace, feeds, and
the metrics foundation.

Reading hazards: a **broiler batch** is a flock of birds, a **commit
batch** is a unit of work — this chapter says which every time. Commit
batch 41 (no decimal) is the chores rebuild, 41.N is the Schedule;
neither is broiler work. Numbers were renumbered six times, so only the
as-shipped table (m1 §2) is trustworthy. Four audit F-numbering
universes exist (2026-06-04, 06-28, 07-01, 07-02); every F-number below
carries its date.

## Evolutions

**2026-05-01 → 05-03 — the seed data knew about processing before the
app did.** The first commits' static `src/data/nff-data.json` already
carried a processing-day schedule and a broiler cost model:
`productKinds` with dressed-weight size brackets, and `costs.broilers`
with slaughter and cut fees plus rule-of-thumb yields (live → dressed
0.70; breast 32% / thighs 17% / drumsticks 11% / wings 11% / frame
29%), annotated "confirm with processor" (1c5289d, bbcbd0b). Two days
later `batch_assignments` — which broiler batch a processing day is
processing — became one of the first Supabase-backed tables (0184cc9,
migration 0002). Still in the schema, still written, no longer
authoritative (see 42.14).

**2026-05-07 — the broiler tracker is superseded before it is built.**
The original roadmap gave broilers a "broiler tracker" inside Animals &
Feed: per-batch weeks on farm, moves, feed, mortality, cuts, "optimized
for cross-batch comparison". The 2026-05-07 renumbering cut it, created
a Metrics & analytics batch to own metric definitions and comparison,
and left Animals & Feed with page shell plus persistence (8790e21; m2
§"Broiler tracker [SUPERSEDED 2026-05-07]"). The benchmark research
gathered that day survives as `docs/research/livestock-metrics.md` —
pasture FCR 2.2–3.0 against a commercial 1.7–1.9, spot-weigh 10–20 birds
weekly, uniformity CV under 8% is tight. It also records James's own
unbuilt wish list: floor space per bird, linear feet of feeder per bird,
feeder-height adjustments correlated against leg problems,
water-temperature variance, and the population of the "brooder mash
unit" partition over time. The water question presumes YoLink sensor
capture, never built.

**2026-05-08 — the processing-day workspace (commit batch 14.2,
371db5f).** `Processing.jsx` at the conceptual route
`/events/processing/:id`, reachable only from the EventEditor's "Open
processing details →" link on a `processing_days` event. It owned four
fields on `event_series.payload` — `cut_sheet`, `packed_crates`,
`final_count`, `notes` — plus `resolved`/`resolved_at`, mirrored onto the
per-occurrence `payload_override` so per-instance edits survive series
saves (`ROADMAP.md:1121`). Explicitly deferred: writing anything back to
`livestock_groups`.

**2026-06-01 — the lifecycle automation, and the production cutover
(commit batch 19, fd1cd2d, migration 0015).** A trigger on broiler-batch
insert created the whole arc — arrival event, pasture-move at +3 weeks,
processing at +8 weeks, brooder-cleanout chore — tied to the batch by
`event_links` rows with roles `arrival` / `pasture_move` / `processing`
(`ROADMAP.md:1615`). This commit put the app into production.

**2026-06-01 — the batch owns its dates (commit batch 20, 11e8350).**
The inversion that still governs the feature. `BatchPage` renders a
lifecycle strip built from `event_links`; editing a milestone date
rewrites the occurrence *and* the series `dtstart`; clicking it opens the
EventEditor. Deleting a batch tombstones rather than cascades — end the
series, skip scheduled occurrences, retire one-time chores, close the
placement, delete the processing assignment, delete the batch, leaving
`event_links` as orphaned history. The processing workspace got its real
batch-assign picker here; verified with a 16-check surgical live-DB test
(`ROADMAP.md:1702`). James three days later: "the batch owns these
dates. Editing one here moves the underlying event. That makes sense."
(`audits/2026-06-04/findings.md`, clip 12). Deferred: species-specific
milestone sets, editing the batch record itself.

**2026-06-02 — feeds become a projection engine (commit batches 25.1
`51618f1` / migration 0021 and 25.2 `01ba96d` / migration 0022).** The
governing rule is James's: every batch is on a feed program, so
consumption is *calculated, never guessed*. Daily consumption is derived
by walking each assigned group's age into its schedule stage;
`projectReorder` walks stock forward day by day (consumption changes as
batches age through stages) until it crosses the reorder point, then
snaps the trigger to the closest business day on or before it — no
weekend orders. Anything unmeterable — free-choice, TBD, a missing
arrival date, hay tracked in bales but fed in flakes — surfaces as an
explicit caveat instead of reading as zero (`ROADMAP.md:1963`).
`feed_orders` became the price history behind "last price paid". That
caveats-never-a-wrong-number discipline is the direct ancestor of the
metrics philosophy that shipped a day later.

**2026-06-02 — the metrics foundation (commit batches 26.1 `48583ee` /
migration 0023 and 26.2 `e48d90d`).** Three tables: a `metrics` registry
seeded with ten definitions and target bands, `weight_samples` storing a
jsonb array of *individual* bird weights (uniformity needs the spread,
not the mean), and `egg_collections`. Two columns mattered as much:
`livestock_groups.placed_count`, because `count` is live and mortality
decrements it so metrics need the original denominator, and
`livestock_species.target_process_weeks`, seeded to 7. `lib/metrics.js`
is pure functions returning `{ value, …, caveats }`: FCR keeps feed eaten
by birds that died in the numerator because that is the honest number;
ADG uses the sample slope, or anchors a lone sample to a 40 g day-old
chick weight. 26.2 added the cross-batch comparison sheet, the dashboard
`BroilerWeeksCard`, and `useProcessingDates`.

**2026-06-02 — the automation loses its processing event (commit batch
27.4, `3cbd183`, migrations 0025 + 0026).** Pasture-move became a
*chore*, and the auto-created processing event was dropped — processing
days are calendar-driven and placed by hand. The prod cleanup was split
into 0026 as deliberate DML because a DO-block silently no-ops under the
CLI migration role, a lesson recorded in that migration's header. Commit
batch 27.6 (`6d4828c`) put the batch picker on processing events in the
EventEditor and made event titles batch-referencing.

**2026-06-03 — batch state stops being a schema problem (commit batch
40.1, `e1ab77a`).** `batchLifecycle()` derives `arriving` / `active` /
`processed` from arrival date plus the scheduled processing occurrence,
no new column. It killed the "week -4" artifacts, collapsed processed
batches into "Past batches", and dropped them off the dashboard. One
prod data fix rode along: Batch 1's stale open placement, still
reporting the flock "in" Chicken tractor 1 weeks after processing, was
closed by exact id (`ROADMAP.md:2648`). Four data-readiness items were
parked that day — catalog prices, inventory lots, feed on-hand, batch
arrival dates — and are still parked.

**2026-06-04 — the walkthrough audit sets the agenda (F-numbers here
are the 2026-06-04 universe).** Three of twelve clips are this
chapter's: Broilers widget (F14–F27), Metrics (F28–F42), Animals & Feed
(F112–F132), in `audits/2026-06-04/findings.md`. The durable asks:
**F25** flag conflicts *across* broiler batches (two deliveries in a
short window; brooder birds needing pasture while pasture still holds
unprocessed birds); **F41** layer mortality should use the cohabit-group
denominator, with the seeded definition text changing alongside;
**F112** flocks are wrappers around batches derived from cohabitation —
name them, don't number them; **F115** weigh-in capture belongs in the
Rounds active-round screen; **F120/F121** a feed is an exact product
name + pellet/mash form + a vendor from Suppliers, and one stage should
hold several feeds (layer pellet *and* grit *and* oyster shell);
**F123** track free-choice consumption by logging each 50-lb bag as it
empties and fitting a line through the log. Treat the file as a mined
idea source, not a live bug list — its checkbox ledger stopped being
maintained that evening (m4 §1c).

**2026-06-28 — one broiler batch, many places.** The investigation in
`.ignored/broiler-brooder-placement/DESIGN.md` found the real bug: the
brooder-cleanout chore anchored to "the event's batch", so at +22 days
it resolved to wherever the batch *now* was — the pasture — never the
brooder it had left. The doc recommended the conservative option; James
overruled it: "I would prefer to add a migration if the resulting schema
is a better domain model. Brooders aren't the only place a batch can be
split — one batch is split across 5+ chicken tractors out in the field."
Multi-place occupancy became the *general* model. Migration 0039
(`9aa027e`) swapped one-open-placement-per-occupant for
one-open-per-(occupant, place); `2a7d43e` turned BatchPage's read-only
"Where" card into a set editor where adding a place is a split, not a
move; `cc72b04` added the `former_occupancy` anchor resolving to places a
batch *has occupied*, open or closed, kind-filtered. The same work
root-caused 2026-06-28 F50 ("dormant brooder chores still appear"): not a
code bug — the placement was stale, because nothing closes it when a
batch moves to pasture.

**2026-06-28 — the broiler lifecycle retires into the process model
(migration 0038, `ba8849a`).** Phase 3 of processes-as-chore-generators
rewrote the batch-created trigger to create *only* the arrival event —
which must stay auto-created, since it is the process's anchor — and
handed pasture-move and brooder-cleanout to a user-authored "Broiler
pasture (lifecycle)" process. The automation row was renamed "Broiler
batch arrival"; the `automations` table stayed because the feed-reorder
rule still uses it. See
`docs/history/records/processes-as-chore-generators-plan.md`.

**2026-07-02 — the second walkthrough, then the processing slice.** The
2026-07-02 round (`audits/2026-07-02/findings.md` §4)
restated the animals asks as F20–F27 in a *new* numbering universe;
commit batches 42.11–42.19 answered them. 42.11 (`81b74be`) made the
batch record editable, removed the per-animal chore lists ("chores should
really just live in chores"), gated the arrival→pasture→processing arc to
meat species, and gave sheep a house glyph. 42.12 (`ad7ae6a`) fixed the
date bugs: `liveProcessingISO()` ignores a skipped occurrence so a
*deleted* processing day stops driving the countdown (the bogus "4.7
weeks remaining"), and a removed milestone renders dashed and revives
when given a date. Then the processing slice, all on 2026-07-02:
**42.13** (`782d78c`) split the process-work badge, because a real prod
expansion of 6 prep chores + 1 modifier had rendered "7 chore changes";
**42.14** (`275d4e0`) made `event_links` the authoritative batch source —
the workspace read `batch_assignments`, which
`BatchPage.createMilestone` never writes, so 5 of 8 linked processing
days on prod showed "no batch assigned" — and enforced that a processing
day *is* the processing of some batch, blocking creation and resolve
without one; **42.15** (`9a842ff`, migration 0048) turned the cut sheet
from a textarea into real file uploads on a new `event_attachments`
table, sharing the `project-files` bucket under an `events/<seriesId>/`
prefix, and folded-and-deleted `payload.cut_sheet` (all prod values were
already null).

**2026-07-29 — commit batch 42.22 (`f230327`).** Broilers get the house
`Chicken` glyph; lucide's `Bird` is reserved elsewhere. The most recent
change in this chapter.

## Current state

Verified against the tree at `063ffb7` (v0.10.99-alpha).

**Schema.** `livestock_groups` (label, live `count`, `placed_count`,
`arrival_date`, optional known-age snapshot) plus
`livestock_species.target_process_weeks` carry the batch; location lives
entirely in `placements` under 0039's one-open-per-(occupant, place)
index; the lifecycle arc lives in `event_series` / `event_occurrences` /
`event_links`; `weight_samples` and `egg_collections` hold capture;
`metrics` holds the definitions registry; `event_attachments` (0048)
holds cut sheets; `batch_assignments` is still written for cross-device
realtime but no longer read as truth; feeds span `feed_types`
(+`species_id`, `sort_order`), `feed_orders`, `feed_schedules`,
`feed_schedule_stages`.

**Pure lib.** `src/lib/metrics.js` (630 lines) is the engine —
`summarizeSample`, `averageDailyGain`, `uniformity` via
`coefficientOfVariation`, `mortalityStats`, `feedConsumedForGroup`,
`feedConversionRatio`, `liveProcessingISO`, `weeksTimeline`,
`coopMateIds`/`aggregateLayerCohort`, `isMeatSpecies`/`isLayerSpecies`,
`BATCH_STATES`, `batchLifecycle` — every metric returning caveats rather
than a wrong number. Also `feedConsumption.js`
(`dailyConsumptionForFeed`, `projectReorder`, `consolidationSummary`,
`businessDayOnOrBefore`), `feedCost.js` (`computeStageCost`),
`attachments.js` (the sanitizing `attachmentStoragePath`),
`processes.js` (`processingBatchMissing`, `classifyProcessWork`) and the
`former_occupancy` case in `chores.js` (~:893, :993). Coverage is real:
`metrics.test.js` 1022 lines, `feedConsumption.test.js` 504,
`processes.test.js` 466, `attachments.test.js` 37.

**Surfaces.** `pages/BatchPage.jsx` (949) — `BatchStatePill` header,
inline detail editor, multi-place "Where" editor, milestone strip with
create/reschedule/restore, cleanout chore pill, danger zone.
`components/BatchMetrics.jsx` (642) — Performance card for meat batches,
Production card for layers, weigh-in and egg-log capture; holds all
performance numbers while a batch reads `arriving`.
`pages/Processing.jsx` (380) — batch section gated by
`processingBatchMissing`, cut-sheet uploads via `AttachmentsBlock`,
packed crates, final count, notes, resolve/reopen. Plus `Feeds.jsx`
(810, consolidation banner + order recording), `FeedSchedulesPage.jsx`
(596, stage editor), `SpeciesPage.jsx` (827), `Metrics.jsx` (407,
broiler + layer comparison sheets and the definitions registry), and
`BroilerWeeksCard` in `Overview.jsx`. Hooks: `useProcessingDates`,
`useEventAttachments`, `useWeightSamples`, `useEggCollections`,
`useMortalityLog`, `useFeeds`, `useFeedSchedules`,
`useBatchAssignments`, and `useSites` (which exposes the
`placementsByOccupant` history index `former_occupancy` needs).

**Where the code contradicts the record.**

- **`BatchPage.jsx` references two variables that do not exist.** Lines
  330–331 and 608–609 use `activePlacement` and `currentPlace`; the
  multi-place rewrite (`2a7d43e`) renamed the memo to
  `activePlacements` and never updated them. Reading an undeclared
  binding throws in strict mode, so clicking "Delete this batch" raises
  a `ReferenceError` while rendering the confirm panel — the
  delete-with-tombstone flow, a headline feature of commit batch 20, is
  unreachable on every batch page. In no dossier or audit.
- **`former_occupancy` is further along than the record says.**
  `cc72b04`'s body says migration 0040 was unpushed and the live
  cleanout step therefore unwired. Prod read 2026-07-29 contradicts
  both: the "Broiler pasture (lifecycle)" step "Brooder cleanout"
  (+22d) carries `anchor_type = 'former_occupancy'`,
  `anchor_kind_tag = 'brooder'`, updated 2026-06-28T15:03 — a write the
  pre-0040 CHECK would have rejected — and the layer lifecycle's
  equivalent step (+27d) was created the same way on 2026-07-03. So
  0040 **is** applied and the wiring **did** happen. What is genuinely
  unverified is the expansion: the only expanded cleanout chore on prod
  (from a 2026-06-28 `[QA-TEST]` arrival) has `anchor_batch_id = null`,
  and `obligationPlaceIds` returns `[]` for a `former_occupancy` chore
  without a batch id — so that chore resolves to no place at all.
- **Two prod process facts worth knowing.** The species-scoped "Broiler
  processing day" process — which carries the three pre-processing
  feed-withhold `chore_modifier` steps that empty the birds' guts — is
  `is_active = false` on prod, so the withhold never fires. And the
  active, species-agnostic "Processing day prep" process contains a
  step titled "Create inventory lots from processed birds": the
  production → inventory link exists today as a human chore.
- **Nothing connects a resolved processing day to inventory.** The
  Processing page's header comment still promises the
  `livestock_groups` write-back "with the animal-lifecycle pages in
  Batch 16" — a roadmap-era number that never shipped under that name
  (the pages shipped as commit batch 20). Resolving sets
  `resolved`/`resolved_at` and nothing else: no batch close-out, no
  inventory lots. Yet `src/pages/Inventory.jsx:95` tells the user
  "Chicken lots get created as the final step of a processing day" —
  they are created by hand, with a typed lot date.
- **Stale Metrics copy.** The comparison footnote says "Cuts ordered
  joins chicken lots", naming the static stub retired in commit batch
  28.1; the code joins `inventory_lots`.
- **Date drift.** `ROADMAP.md` dates 42.13–42.15 to 2026-07-03; the
  commits are authored 2026-07-02 (m1 §1.6 is right).

## Unresolved threads

1. **Fix `BatchPage`'s undefined `activePlacement`/`currentPlace`**
   (lines 330, 608–609) — batch deletion is broken. Tiny fix, highest
   severity in this chapter.
2. **Live-verify the brooder cleanout.** 0040 is applied and both
   lifecycle steps are wired (above), but the one expanded cleanout
   chore on prod carries no `anchor_batch_id`, so it resolves nowhere.
   Confirm on a real batch that an arrival expansion writes the batch
   id and the obligation lands on the brooder the birds left, not the
   pasture (`cc72b04`; DESIGN.md Phase 2). Also activate the "Broiler
   processing day" process, or decide the feed-withhold steps are dead.
3. **Nothing closes a placement when a batch moves to pasture** — the
   root cause behind 2026-06-28 F50 and the hand-fixed Batch 1
   placement (`ROADMAP.md:2648`). DESIGN.md Phase 1 named a bulk "move
   to pasture" (close brooders, open tractors) action; never built. So
   "where is this batch" silently rots.
4. **Production → inventory is manual and unlinked** — resolving a
   processing day should create the lots, keyed on the batch, not
   joined by date. See E-commerce relevance.
5. **The feed schedule substrate is being phased out** (2026-07-02 F24:
   "Feed schedule is being phased out. Replacement TBD"). Reorder
   dates, feed eaten, feed cost, FCR's numerator and the pricing cost
   floor all read from it — nothing should be built on feeds until the
   replacement is decided. Adjacent and blocked on the same decision:
   free-choice consumption via 50-lb-bag logging (2026-06-04 F123, and
   James says more birds are moving to free choice, so the
   unprojectable share is growing), multiple feeds per stage (F121),
   and feed identity as product name + pellet/mash + vendor (F120).
6. **Cross-batch conflict detection** (2026-06-04 F25): overlapping
   deliveries, brooder-needs-pasture while pasture is occupied,
   compressed move/process windows. Never scoped.
7. **Capture belongs in Rounds** (2026-06-04 F115): sample weights,
   temperatures and egg counts as top-level actions in the
   active-round screen, not only on the batch page.
8. **Verify the broiler process end-to-end** (2026-07-02 F26/F29:
   "super super suspicious that this actually works"). The
   chore-generators build closed with an explicit open item —
   live-verify arrival event → process expansion on the next real
   broiler batch (m4 §4 item 20). No verification on record.
9. **Presentation debt, all 2026-06-04**: hover-for-definition on column
   headers (F28), overflow / sidebar width / main-pane cap on a
   data-dense desktop page (F32–F34), stacked definition columns (F40),
   target bands behind an info icon (F42), per-card definitions links
   (F39); and on the batch page, colour `BatchStatePill` by state,
   weeks+days instead of a decimal, restate "week 4 of scheduled
   processing", make milestone links look clickable (F130–F132 — folded
   into the colour-bracket pass, itself unrun; `design-system.md`).
10. **Layer mortality should use the cohabit-group denominator**
    (2026-06-04 F41) — computation plus the seeded definition text,
    which needs an additive migration. The pooling machinery exists
    (`coopMateIds`, `aggregateLayerCohort`, commit batch 42.18) but
    mortality was never moved onto it. Layers' chapter owns it; noted
    here because the broiler definition text is the correct model.
11. **`BroilerWeeksCard` needs a new home** — the Dashboard is expected
    to die (2026-07-02 F30: "broiler mini-tracker needs a home
    eventually").
12. **Real numbers were never entered** (parked at commit batch 40.1,
    never closed): catalog prices, inventory lots, feed on-hand, batch
    arrival dates. Still true on prod 2026-07-29 — Batch 1 and Batch 2
    both have `arrival_date = null`, so neither can compute an age, a
    lifecycle state or any per-batch metric. Batch 4's actual spread
    across "5+ tractors" was also left for James after `2a7d43e`.
13. **Sheep get a dedicated barn → stall → sheep pass** (2026-07-02
    F27), deferred; sheep are pets, so no lifecycle strip and no
    metrics by design.
14. **Fix the three stale strings** above: Processing's "Batch 16"
    comment, Inventory's "lots get created as the final step of a
    processing day", Metrics' "joins chicken lots".

## E-commerce relevance

High — this chapter is the supply side of the catalogue. The
production → inventory → catalogue chain exists as three working pieces
with one missing link in the middle.

**The missing link is the whole story.** Selling chicken requires lots;
lots come from a processing day; nothing connects the two. The workspace
records `packed_crates`, `final_count` and notes on the event payload
plus a `resolved` flag, and stops. `inventory_lots` rows are created by
hand on the Inventory page with a typed lot date. Metrics' "cuts
ordered" column then joins those two *by date* — `lotDate ===
processingISO`, filtered to the species' products
(`src/pages/Metrics.jsx:125`) — so the one existing
production↔catalogue linkage in the app is a date-string coincidence
that breaks the moment a lot date is mistyped or lots are entered a day
late. The right shape is already agreed in
`docs/handoffs/2026-06-03-feature-handoff.md` §11: one lot per
processing batch, with a storage location / bin, a fulfilment ticket
showing the pull location, and the pull decrementing the lot. The farm
already treats this as a step — prod's active "Processing day prep"
process has a chore literally titled "Create inventory lots from
processed birds" — so the work is being done by hand into a form that
does not know which batch it came from. Build "resolve the day → create
the lots" as a real write keyed on batch id before building a
storefront: on-hand, FIFO allocation, shortfall warnings and sellable
stock all inherit from it.

**Cost floors read from a static file, not the farm.** Pricing's
below-floor warnings call `productCost.computeBroilerCostPerBird`, which
reads `data.costs` straight out of the git-tracked
`src/data/nff-data.json` and divides a schedule-derived feed cost by a
hard-coded default batch size. On prod today `chickPurchasePerBird` and
both packaging figures are `null`, and the yield breakdown is a rule of
thumb annotated "confirm with processor". Meanwhile
`metrics.feedConsumedForGroup` already computes a *real* per-batch feed
cost with caveats. There are two feed-cost engines and pricing uses the
weaker one; any price set before they are reconciled is priced against
a guess. Highest-leverage e-commerce prerequisite in this chapter.

**What the arc inherits that is genuinely solid.** Weight brackets are
the pricing unit on both sides — the catalogue prices per dressed-weight
bracket (no true catch-weight `$/lb`), and `weight_samples` plus
`uniformity` are exactly the instruments that predict *in advance*
which brackets a batch will fill. A tight CV means a predictable bracket
mix; a wide one means being short on the sizes you promised. Nobody has
wired uniformity or ADG into a bracket-yield forecast — and that
forecast is what makes pre-orders safe to take.

**Cut sheets are now real files.** `event_attachments` (0048) plus
`useEventAttachments` and `attachmentStoragePath` give the app a working
series-scoped upload pattern sharing the `project-files` bucket; the
handoff's file-storage wish list (product photos, cut sheets) should
extend this rather than start over.

**Timing and copy.** A storefront cannot launch on empty data — catalog
prices, inventory lots and feed on-hand have been flagged empty since
2026-06-03 and are still parked. And two user-facing strings currently
promise automation that does not exist; fix those before a second
person reads them.
