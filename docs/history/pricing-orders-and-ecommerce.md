# Pricing, orders & e-commerce

The commerce arc has been in the plan since the roadmap's first
revision, and more of it is built than anyone remembers. What does not
exist is the part the name points at: **nothing customer-facing, and
no batch anywhere that would build it** (`6bda622`).

The honest one-line summary, verified against production on
2026-07-29: the internal half of e-commerce is fully modelled, styled,
tested and deployed — and it has never been used. Six product kinds
and a 65-contact mailing list are the only commerce rows in the
database. No prices. No sales. No inventory lots. No orders.

That gap between built and used is the most important fact in this
chapter, and it changes what the e-commerce arc is. It is not a
"connect the storefront to the existing pipeline" project, because
there is no data flowing through the pipeline to connect to.

## Evolutions

**2026-05-03 (`1c5289d`) — commerce arrives before the roadmap does.**
The Products and Inventory sections, the `productKinds` schema, a cost
model and broiler yield shares all land in a single pre-batch commit,
two days before `ROADMAP.md` exists. The cost model born here is
static reference data in `src/data/nff-data.json`, and it is still
static reference data today — see Current state.

**2026-05-04 (`4a8ed2c`, `records/more-stuff.md`) — the whole arc is
named on day one.** The roadmap's reconstructed first revision carries
a "Round 2" dump that lists the commerce sequence essentially as it
was eventually built: Resources, Products, Inventory, Pricing, Orders,
Point of sale, Ecomm/Stripe/Venmo, QuickBooks (m3 §4 item 5). The same
revision seeds a lessons entry — "Memorial Day is the start of
meat-selling season" — the earliest selling-season reference in the
repo (m2 §4).

The ordering in that dump has never been revised: manual plumbing
first, integrations after. Every subsequent renumbering preserved it
(m2 §4, "Sequencing signal").

**2026-05-31 (`markets-and-popups-2026.md`) — the physical channels get
written down.** Three weekly farmers markets (Tilted Barn Exeter among
them) plus six Warwick-area pop-ups, extracted from the production
database. This is the channel reality any online layer has to coexist
with, and it predates every commerce batch. Promoted to
`docs/ecommerce/markets-and-popups-2026.md` in H1.

**2026-06-02 (`4afcda6`, batch 24) — CRM, deliberately thin.**
Migration 0020 adds `customers`, `customer_lists` and members. The
customer model is minimal by design; the notable act is the seed — a
65-contact mailing list assembled from the egg-drop and farmers-market
contacts, with its stated purpose written into the row itself: "Email
list for farm updates and announcements." That list was seeded for the
farm-updates email blast, which has never been built (see
`parked-and-abandoned.md`). The contacts have been sitting in
production, unused, since 2026-06-02.

Deferred the same day and never picked up: customer address/tags/
referral fields, customer↔order linking UI, dedup tooling
(`4afcda6`).

**2026-06-02 — the pricing workshop.** The single most consequential
commerce session, recorded in the shipped roadmap entry for batch 27.1
(m2 §4 cites `ROADMAP.md` HEAD 2175–2210). Its decisions:

- **Fixed price per weight bracket, not true $/lb catch-weight.** The
  reasoning was empirical: no pastured-poultry storefront researched
  does real catch-weight pricing. The exemplars are named
  inconsistently across the record — m2 §4 credits "Pat's Pastured /
  White Oak", `docs/ecommerce/PREP.md:13` credits "the Ora Oak
  pattern", and `ba9a659` names Pat's Pastured, Polyface and White Oak
  as the content-pattern research. Same decision, three spellings of
  the evidence; treat the bracket decision as settled and the
  attribution as unreliable.
- **`product_prices` append-only.** The current price is the newest
  row for a SKU; price history is a free consequence rather than a
  feature. `compare_at_cents` gives strike-through pricing.
- **One sales table.** `product_sales` is written by manual entry,
  POS, and order fulfillment alike — "the same table Batch 28 POS /
  Batch 29 Orders will write" (`6bda622`) — so the sales chart never
  changes its source when a new channel appears.
- **A four-slot description template** (what-it-is / cooking /
  sourcing / nutrition), written explicitly for future public-facing
  use.
- **Live margin in the admin UI**, the Shopify-admin pattern: price
  minus cost floor, shown while you type. Quick-fill by target margin
  adapts Faire's keystone rule; below-floor prices warn (`323601f`).

Research references on record for the UI itself: Shopify admin,
Square, Faire, and the GoodEggs vendor portal (m2 §4).

**2026-06-02 (`ba9a659` 27.1 → `323601f` 27.2 → `6bda622` 27.3) — the
catalog ships.** Migration 0024 brings product content and photos,
append-only `product_prices`, and `product_sales`. Bundles arrive with
summed cost floors. 27.3's commit body carries the line that defines
the entire remaining arc: **"E-comm publishing of the catalog has no
batch yet."** It was true when written and it is still true.

**2026-06-02 (`1aef072` 28.1, `683977d` 28.2) — inventory and POS.**
Migration 0027 makes inventory lot-based with sale-linked movements.
FIFO allocation (`allocateToSale`, now in `src/lib/data/useInventory.js`)
draws down the oldest lot first; shortfalls warn and never block — a
recurring stance in this codebase, matching the metrics layer's
"caveats, never wrong numbers" philosophy. 28.2 adds the POS Sell tab
and the family-sale channel: $0 lines that still decrement inventory,
because eating your own chicken is a real inventory event even when it
is not revenue. Reversing a sale restores the lot. `847564b` later
fixed a stale-read bug in the FIFO draw.

The legacy `egg_lots` / `chicken_lots` placeholder tables from
migrations 0005/0006 were deliberately left alone here, per the
additive-only rule.

**2026-06-02 (`60c10c8`) — the orders scope workshop, and a
graveyard.** Batch 29 is scoped in detail, batch 30 (commerce
integrations) is defined, and a Graveyard section appears in the
roadmap, retiring bookmarking and voice control. The orders decisions:

- **An order is a promise.** Nothing touches `product_sales` or
  inventory until fulfillment; cancelling an open order costs nothing.
  This is stated as a design principle in `src/lib/orders.js`'s header
  comment, which is worth reading — it is the clearest surviving
  statement of the model.
- Lifecycle open → ready → fulfilled (+cancelled); fulfilled orders
  freeze.
- Payment as a flag plus method plus date, capturable at any point;
  live payment APIs explicitly deferred to batch 30.
- Customer default ship-to with a per-order snapshot override.
- A **cold-chain constraint** expressed as a state allowlist capping
  transit time, with a per-order override — it warns, never blocks.

**2026-06-03 (`93f55ed` 29.1, `847564b` 29.2, `faecbf5` 29.3) — orders,
fulfillment, shipments.** Migration 0028 extends `orders` and adds
`order_lines`, `shipments`, `shipment_parcels` and `shipping_settings`.
Two details matter for the next arc. Fulfillment writes
`product_sales` and draws inventory FIFO, with `order_lines.sale_id`
as the backlink — so order revenue stays separable from POS revenue
while both land in one table. And the shipment model is deliberately
**shaped after Shippo's objects** (shipment → parcels → label) so the
live API can drop in without a remodel; until then labels are bought
manually through PirateShip or Shippo's web UI. `orders.line_items`
jsonb from migration 0006 was superseded by `order_lines` and left in
place.

The best surviving prose description of this flow is not in the repo's
docs but in the walkthrough narration: `audits/walkthrough-guide.md`
clips 08–09 (m4 §5).

**2026-06-03 (`87a5178`) — the credentials and handoff pass.**
`docs/integrations-and-credentials.md` sequences Stripe (pk/sk/whsec),
Shippo (cold-chain labels plus tracking webhooks), QuickBooks (OAuth
plus realm), and SendGrid/Mailgun — all server-side via Netlify env,
test mode until solid, and commerce integrations explicitly "gated on
the e-comm push". The same day's feature handoff
(`docs/handoffs/2026-06-03-feature-handoff.md`) adds four commerce
extensions that were never built: lots/bins/FIFO with a fulfillment
ticket showing the physical pull location (§11), file storage for
product photos and cut sheets (§12), guest access for a helper working
markets or fulfillment (§13), and transactional email as the named
blocker for order emails.

**2026-06-04 (`47620bd`) — the Venmo finding.** Venmo has no
acceptance API. A deep-link or QR pre-fill plus a manual mark-paid is
the only Venmo path; real programmatic acceptance means
PayPal/Braintree. Stripe stays the named card path. This is a closed
question — do not re-open it in the e-commerce arc without new
evidence.

**2026-06-04 (`f2e08f7`) — the forcing decision, still unmade.** The
blog/CMS commit settles that the dashboard is the authoring surface
(dashboard-as-CMS, with a three-gate publish pipeline) and then names
the thing nobody has decided: the public-site redesign "introduces
ecommerce — a large JS surface", leaving open whether the site stays
on Hugo or moves to a JS framework, whether it lives in this monorepo
or a separate one, and what triggers the build. The commit's own
recommendation is to hold a site-architecture session **before**
building the blog, because the two are entangled. This is the
roadmap's only direct statement about the storefront itself (m2 §4).

**2026-06-04 (F14, 06-04 audit) — open orders struck off the
Dashboard.** The walkthrough audit judged an "open orders" glanceable
unearned, given there were no orders. Re-introducing it is a
storefront-era decision (m4 §5).

**2026-07-02 (`828088c`, batch 42.8) — the pricing worksheet becomes
app infrastructure.** Live HTML doc attachments (migration 0045)
persist a localStorage-backed document to the database with advisory
locks. The driving use case was the pricing worksheet: a two-person
price-negotiation tool between James and Jim, which ran the same day
and produced a localStorage dump preserving both parties' price
vectors with timestamps (m3 §4 item 2). Prices in this farm are
negotiated, not calculated — and the app grew a feature to hold that
negotiation.

**2026-07-22 (`proposed-prices-summer-2026.md`) — a real price list
exists.** Eggs by size, whole chicken across nine weight bands,
Cornish hen 2-packs, parts by band, tenders, sausage, livers; bulk
discounts at $100/$150/$200; and a full delivery policy (weekly
Thursday, $10 fee waived over $150, $50 minimum, prepaid, coolers left
out, CT is meat-only) with a zip-level service area covering six CT
towns and roughly 25 RI zips. Still labelled proposed, not confirmed.
Promoted to `docs/ecommerce/` in H1; the `_proposed` suffix was
dropped from the filename but the document's own caveat stands.

**2026-07-29 (H1 of the housekeeping arc) — the commerce planning
material becomes tracked.** `docs/ecommerce/` now holds the price
list, the markets calendar, and the Google Business Profile
description work (Draft C recommended, founding year 2024 documented,
APPPA the only third-party affiliation). The GBP work also surfaced a
live defect outside this repo: the public site's `company.yaml` still
carries a placeholder phone number.

## Current state

Verified 2026-07-29 by reading the code and by read-only queries
against production (`scripts/prod-read.sh`).

### What is built

The commerce surface is four pages plus a shared sales view:

- `src/pages/Products.jsx` (908 lines) — four tabs: Catalog, Pricing,
  Sell, Sales.
  * Catalog edits product kinds, size brackets, content slots
    (`CONTENT_SLOTS` in `src/lib/productCatalog.js`) and photos.
  * Pricing is `PricingGrid` with live margin against cost floors.
  * Sell is `src/components/SellTab.jsx` — POS, bundles expanded,
    inventory drawn FIFO through `inv.allocateToSale`.
  * Sales is `src/components/SalesTab.jsx` (267 lines) — channel
    grouping and `salesByMonth`.
- `src/pages/Orders.jsx` (1,818 lines — the largest page in the app,
  and a size flag for H4's structure audit) over `src/lib/orders.js`
  and `src/lib/data/useOrders.js`.
- `src/pages/Inventory.jsx` (558 lines) over `src/lib/data/useInventory.js`.
- `src/pages/Customers.jsx` (508 lines) over `src/lib/data/useCustomers.js`.
- Pure logic with unit tests: `src/lib/productCatalog.js` (295 lines),
  `src/lib/productCost.js` (120), `src/lib/orders.js` (165), each with
  a `.test.js` sibling in the vitest suite.

### What is in production

| Table | Rows |
|---|---|
| `product_kinds` | 6 |
| `product_prices` | 0 |
| `product_sales` | 0 |
| `inventory_lots` | 0 |
| `inventory_movements` | 0 |
| `orders` | 0 |
| `order_lines` | 0 |
| `shipments` | 0 |
| `customers` | 65 |
| `customer_lists` | 1 |
| `egg_lots`, `chicken_lots` (legacy stubs) | 0 |
| `shipping_settings` | 1, with `allowed_states` **empty** |

The six product kinds are `whole_chicken`, `boneless_breast`,
`bone_in_thighs`, `drumsticks`, `wings`, `eggs`. Every one has an
empty `content` jsonb (no description slots filled), no `photo_path`,
and `is_bundle` false — so no bundle has ever been created either.

A correction to the dossiers while we are here: m1 §4 and
`docs/ecommerce/PREP.md` both describe "bundles + `bundle_contents`"
as if they were tables. They are not. `is_bundle` (boolean) and
`bundle_contents` (jsonb) are **columns on `product_kinds`**; there is
no `bundles` table in the schema.

### The catalog does not match the price list

The brackets configured in production predate the 2026-07-22 price
list and disagree with it on almost every SKU. This is the concrete
work item hiding behind the phrase "seed the catalog":

| SKU | In production | In the price list |
|---|---|---|
| Eggs | one bracket, "1 dozen" | three sizes: Large, Medium, Pullet |
| Whole chicken | 7 bands, 2.0–6.0 lb | 9 bands, 2.0–8.0 lb |
| Boneless breast | 0.5–1, 1–1.5, 1.5–2 | ≤1.25, 1.25–1.5, 1.5–1.75, ≥1.75 |
| Bone-in thighs | 1–1.5, 1.5–2, 2–2.5 | ≤1.5, 1.5–2, ≥2 |
| Drumsticks | 0.75–1, 1–1.5, 1.5–2 | ≤1.5, >1.5 |
| Wings | 1–2, 2–3 | ≤2, 2–2.5, ≥3 |
| Cornish hens, tenders, sausage, livers | absent | priced |

Two defects fall out of that comparison, both worth fixing before
anything reads these brackets:

- **Production has a hole.** Whole chicken jumps from a 4.5–5.0 lb
  bracket to a 5.5–6.0 lb bracket. A 5.2 lb bird matches no bracket
  and therefore has no price.
- **The price list has a hole too.** Wings are priced at ≤2.0 lb,
  2.0–2.5 lb, and ≥3.0 lb — nothing covers 2.5–3.0 lb.

The catalog also has no model for two things the price list commits
to: **bulk discount tiers** ($10/$15/$20 off at $100/$150/$200) —
`orderTotalCents(lines, shippingCents)` in `src/lib/orders.js` takes
no discount argument — and the **delivery policy** ($10 fee waived
over $150, $50 minimum, Thursday-only, prepaid). `shipping_settings`
holds a state allowlist and `stateAllowed(state, allowedStates)`
checks at state granularity; the price list's service area is defined
by zip code, and the allowlist is currently empty anyway.

### The cost floor cannot currently be computed

`src/lib/productCost.js` reads costs from `data.costs.broilers`, which
resolves to the static `costs` block in `src/data/nff-data.json` —
deliberately left out of the JSON→Postgres migration because it is
"static config with no editing surface"
(`src/lib/data/useReferenceData.js` header). Inside that block:

- `chickPurchasePerBird`: null
- `packagingPerWholeBird`, `packagingPerCutPackage`: null
- `eggs.packagingPerDozen`: null
- `yieldLiveToDressed` 0.70 and the dressed breakdown are labelled
  "industry rule-of-thumb for Cornish Cross — confirm with processor"
- `pricingTargets.marginNote`: target gross margin per SKU "not yet
  defined"

Only `processingSlaughterPerBird` (7.50) and
`processingCutAdditionalPerBird` (4.00) are real numbers. The library
handles this correctly — `computeBroilerCostPerBird` returns a
`missing: [...]` list rather than a wrong total — but the practical
consequence is that the live-margin feature, the headline outcome of
the pricing workshop, has never had a complete floor to measure
against. Three open threads in `nff-data.json` track exactly this
(`thread_chick_cost`, `thread_packaging_cost`,
`thread_processing_yields`).

## Unresolved threads

Ordered by what blocks what.

1. **The site-architecture decision** (`f2e08f7`). Hugo vs a JS
   framework, monorepo vs separate repos, build trigger. Nothing else
   in this chapter can be sequenced until this is settled, and the
   commit that raised it recommends a dedicated session. This is the
   e-commerce arc's first move.
2. **E-commerce publishing of the catalog has no batch** (`6bda622`).
   The core gap, unscheduled for two months. Re-scoping it is the
   arc's substance.
3. **Cost inputs are missing** — chick cost, packaging (three ways),
   confirmed processor yields, and a target margin. Until these
   exist, pricing decisions are negotiation output (the 2026-07-02
   worksheet) rather than margin-driven. Decide also whether the
   `costs` block moves into Postgres with an editing surface, or stays
   static config.
4. **Seed and reconcile the catalog.** Confirm the proposed price
   list, then bring production's brackets into line with it, add the
   four missing SKUs, fix the 5.0–5.5 lb hole and the wings 2.5–3.0 lb
   hole, and enter prices. Zero `product_prices` rows means the
   pricing grid has never been exercised on real data.
5. **Bulk discounts and the delivery policy are unmodelled.** Order
   totals have no discount concept; the service area is zip-level in
   the policy and state-level in the schema; the fee, minimum and
   Thursday-only cadence live nowhere in code.
6. **Batch 30 — live integrations** (`60c10c8`): Shippo labels/rates/
   tracking, Stripe, QuickBooks. Scoped, never built. The shipment
   model is Shippo-shaped and waiting.
7. **Payments provider.** Stripe for cards is decided; Venmo can only
   ever be deep-link plus manual mark-paid (`47620bd`); PayPal or
   Braintree is the only path to programmatic Venmo acceptance. Decide
   whether that matters enough to change providers.
8. **Transactional email** (SendGrid/Mailgun) is the named blocker for
   order confirmations as well as for the never-built farm-updates
   blast — and 65 contacts have been waiting for that blast since
   2026-06-02.
9. **CRM thinness.** No per-customer detail page; no customer↔order
   linking UI; no address/tags/referral fields; no dedup. Deferred at
   `4afcda6` and again at `70296d4`, flagged in the 06-03 and 06-04
   audits (m4 §5).
10. **Guest access** (handoff §13) becomes real the moment someone
    other than James or Jim handles a market or a fulfillment.
11. **Lots and bins** (handoff §11) — the settled inventory model
    extends to physical storage: a lot per processing batch, a bin
    assignment, and a fulfillment ticket that shows where to pull
    from. Unbuilt. James wants the physical freezer-organization
    advice handled outside the app.
12. **Slice 8, "order work" on the Schedule**, awaits re-scope
    (`project_schedule_redesign_b42` memory, m4 §3).
13. **Legacy schema noise.** `egg_lots` / `chicken_lots` from
    migrations 0005/0006 and `orders.line_items` jsonb superseded by
    `order_lines` — all empty, all kept under the additive-only rule.
    They will mislead anyone reading the schema fresh. Candidates for
    a documented deprecation note rather than a drop.
14. **Secrets hygiene, as a precondition.** The Google OAuth client
    secret JSON and `vapid-keys.txt` sit loose in the repo tree
    (`docs/integrations-and-credentials.md` §0 admits it). Both must
    leave before payment credentials or customer PII enter the
    picture. H3 owns the move.
15. **Re-introducing an orders glanceable** on Overview, struck as
    unearned by F14 (06-04 audit), is a storefront-era call.

## E-commerce relevance

This chapter *is* the e-commerce brief in narrative form;
`docs/ecommerce/PREP.md` is its checklist form and stays the working
document for the re-scoping conversation. What this chapter adds to
PREP.md, and what H2 should fold in:

- **The substrate is unexercised, not just underpopulated.** PREP.md's
  H1 note said catalog prices and lots "were all empty as of the June
  audits". They are still empty on 2026-07-29 — zero prices, zero
  sales, zero lots, zero orders across the whole commerce schema.
  Every code path in Products/Orders/Inventory is tested but has never
  run against real data. Expect first-use bugs, and treat "use the
  admin side for one real sales cycle" as a candidate first batch
  ahead of any storefront work.
- **Pricing is negotiated between two people, not derived.** The
  2026-07-02 worksheet and its localStorage dump are the actual
  price-setting mechanism, and migration 0045 exists to hold it. Any
  pricing UI in the arc should assume negotiation and history, not
  optimization.
- **The catalog↔price-list reconciliation is real, sized work** with
  two concrete data defects (the 5.0–5.5 lb whole-chicken hole, the
  2.5–3.0 lb wings hole) and four absent SKUs. It is a prerequisite
  for publishing anything.
- **Two commitments in the price list have no schema at all**: bulk
  discount tiers and the delivery policy (fee, waiver, minimum,
  Thursday cadence, zip-level service area vs the schema's
  state-level allowlist, which is empty).
- **The description slots were built for the storefront** and are all
  empty. Four slots × six products is a content task nobody has
  started, and it is the storefront's copy — so it lands on the brand
  voice side of the voice guide, not the product-UI side (see
  `design-system.md`).
- **The mailing list is a channel already paid for.** 65 contacts,
  seeded 2026-06-02 for a blast that was never built. Transactional
  email unblocks both it and order confirmations.
- **Physical channels come first in the business and last in the
  code.** Three weekly markets and six pop-ups
  (`docs/ecommerce/markets-and-popups-2026.md`) are where sales
  actually happen; POS exists for exactly that and has recorded
  nothing. An online layer coexists with them rather than replacing
  them, which argues for pickup-and-local-delivery before shipping.
