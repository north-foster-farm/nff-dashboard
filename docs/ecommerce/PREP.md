# E-commerce preparation guide

Everything the e-commerce rollout needs to know, gathered during the
2026-07 housekeeping arc. E-commerce is the next major arc; scope and
requirements will be re-litigated fresh, and this document is the
brief for that conversation. Every housekeeping phase appends what it
learns here.

## What already exists (seeded 2026-07-29, pre-mining)

Prior decisions on record (ROADMAP.md):

- 2026-06-02 pricing workshop: weight-bracket pricing (the Ora Oak
  pattern — no farm storefront does true $/lb catch-weight);
  Shopify-style live margin (price − cost floor) in the admin UI.
- Orders scope settled at the same workshop: manual order creation
  first.
- Named future integrations: Stripe (cards / online payments), Venmo,
  QuickBooks (accounting sync).
- E-commerce / storefront publishing of the catalog has been
  explicitly OUT of scope for everything shipped so far.

Built assets the rollout can stand on:

- Products page: catalog, SKUs, weight brackets, bundles, price maps,
  cost floors (`src/lib/productCost.js`, `src/lib/productCatalog.js`,
  `src/components/PricingGrid.jsx`, `src/pages/Products.jsx`).
- Point of sale: on-the-spot sale recording, drains inventory FIFO
  (Products page Sell tab; sidebar action `point_of_sale`).
- Processing pipeline produces the sellable inventory the store would
  publish.

Planning material, promoted into this directory at the end of H1:

- `proposed-prices-summer-2026.md` — the authoritative proposed price
  list (2026-07-22); still proposed, not confirmed.
- `markets-and-popups-2026.md` — the 2026 season's three weekly
  farmers markets and six pop-ups; the sales channels a store would
  complement.
- `google-business-profile-description.md` — live customer-facing copy
  work, drafts ranked, two open items.

Assessed in H1: `.ignored/nacelle/` is a font package, not platform
research — the name is a typeface (already tracked at
`public/fonts/`), so there is **no prior headless-commerce research**
to build on. `pricing-worksheets/` (beside this file, promoted in H3)
keeps the interactive worksheet HTML and its localStorage dump; the
summary that matters is the promoted price list above.

## What H1's mining established (2026-07-29)

From the five evidence dossiers (`.ignored/housekeeping/mining/`). The
short version: **the internal half of e-commerce is built and running
in prod; the external half exists only as intent.**

### The commerce schema already in production

- **Catalog** (mig 0024, `ba9a659`): product kinds with a `content`
  jsonb carrying four description slots written *for future public
  use*, photo storage, `sold_out`, bundles + `bundle_contents`, size
  brackets, `archived_at`.
- **Pricing** (`323601f`): append-only `product_prices` — current
  price plus full history, with `compare_at_cents` for strike-through.
  Live margin against per-SKU and per-bundle cost floors
  (`src/lib/productCatalog.js`), quick-fill by target margin.
- **Sales converge on one table.** `product_sales` is written by
  manual entry (27.3), POS (28.2) and order fulfillment (29.2) — a
  deliberate design so every channel lands in the same place
  (`6bda622`). Channels include shipping and family ($0 lines that
  still decrement inventory, `683977d`).
- **Inventory** (mig 0027): lot-based with FIFO allocation and
  sale-linked movements; shortfalls warn and never block; reversing a
  sale restores the lot (`1aef072`, `683977d`, and `847564b` which
  fixed a stale-read FIFO bug).
- **Orders** (mig 0028, batches 29.1–29.3): open → ready → fulfilled →
  cancelled, with `paid_at`/`payment_method` capturable at any point;
  customer FK plus per-order `ship_to` jsonb; `order_lines` backlink
  to `sale_id`; `shipments` + `shipment_parcels` deliberately
  **Shippo-shaped** so the live API drops in without a remodel;
  `shipping_settings` holds a state allowlist for the cold chain
  (warns, never blocks).
- **CRM** (mig 0020, `4afcda6`): deliberately minimal customers +
  lists, seeded with a 65-contact mailing list aimed at the
  never-built farm-updates blast.
- **Production → catalog linkage exists**: "cuts ordered" joins
  inventory lots on processing date (`e48d90d`, `1aef072`).

### Prices, channels and positioning

- `proposed-prices-summer-2026.md` is the seed catalog for any
  checkout build: eggs by size, whole chicken across 9 weight bands,
  Cornish hen 2-packs, parts by weight band, sausage, livers; bulk
  discounts at $100/$150/$200; and a delivery policy (weekly
  Thursday, $10 fee waived over $150, $50 minimum, prepaid,
  cooler-out, CT = meat only) with an explicit CT+RI service area.
  Two-party negotiated 2026-07-02; still **proposed**.
- `markets-and-popups-2026.md` defines the physical channels an online
  layer has to coexist with: three weekly markets plus six pop-ups.
- `google-business-profile-description.md` is decision-ready customer
  positioning (Draft C recommended, founding year 2024 documented,
  APPPA the only third-party affiliation). It also surfaces a live
  defect: the public site's `company.yaml` still carries a placeholder
  phone number.
- The brand-collateral workstream a storefront would inherit is
  in-flight, not finished: `docs/specs/theme-color-handoff-brief.md`
  is an unimplemented decision (turf-green 550 `#37ad7c` as
  `--c-brandmark-inverse`).

### Decisions already made (don't re-litigate)

- **Venmo has no acceptance API** (`47620bd`). Deep-link/QR pre-fill
  plus manual mark-paid is the only Venmo path; real acceptance means
  PayPal/Braintree. Stripe is the named card path.
- **Integrations are documented and sequenced** in
  `docs/integrations-and-credentials.md`: Stripe, Shippo, QuickBooks,
  SendGrid/Mailgun, Meta Graph, all server-side via Netlify env, test
  mode until solid — and commerce integrations are explicitly "gated
  on the e-comm push".
- **Lots/bins/FIFO is the settled inventory model** (lot per
  processing batch, bin assignment, fulfillment ticket shows the pull
  location). James wants physical freezer-organization advice handled
  separately from the app.
- Weight-bracket pricing over true $/lb catch-weight, and
  manual-order-creation-first, both stand.

### Never scheduled, never built

- **E-commerce publishing of the catalog has no batch anywhere**
  (`6bda622`) — the arc's core gap.
- Batch 30 (live Shippo labels/rates/tracking, Stripe, Venmo,
  QuickBooks) was scoped (`60c10c8`) and never built.
- Batch 32 (farm updates, email blast, social, blog-as-CMS) was scoped
  three times (`5fe6451`, `47620bd`, `f2e08f7`) and never built.
- Per-customer and per-product/order detail routes (`70296d4`,
  `4afcda6`) — search jumps to list pages only; CRM thinness is a
  standing audit finding.
- Event time footprint / travel time (`14663e7`, `38aeedd`) — "a
  market costs more than its hours"; needs a maps key.
- Transactional email (SendGrid/Mailgun) is the unbuilt blocker for
  order emails as well as notifications.

### The forcing decision nobody has made

`f2e08f7` is the roadmap's only direct statement about the storefront
itself: the public-site redesign "introduces ecommerce — a large JS
surface", leaving open **stay on Hugo vs move to a JS framework**,
**monorepo vs separate repos**, and the build trigger. That commit
recommends a site-architecture session *before* building the blog,
because the two are entangled. That session is the natural first move
of the e-commerce arc.

### Preconditions and cautions

- **Secrets hygiene** (also logged under H0): the Google OAuth client
  secret JSON and `vapid-keys.txt` sit loose in `.ignored/`;
  `docs/integrations-and-credentials.md` §0 confirms the OAuth JSON
  "is stashed in .ignored/". Both must leave the repo tree before
  payment credentials or customer PII enter the picture.
- **Data readiness**: catalog prices, inventory lots and feed on-hand
  were all empty as of the June audits — and **still are**, verified
  against prod 2026-07-29 (see H2's counts below). A storefront cannot
  publish what the admin side has never been used to record.
- **Legacy stubs still in the schema**: `egg_lots`/`chicken_lots`
  placeholders from migs 0005/0006, and `orders.line_items` jsonb
  superseded by `order_lines` (`93f55ed`) — kept under the
  additive-only rule, but they will confuse anyone reading the schema
  fresh.
- **Guest access** (a helper working markets or fulfillment) is
  designed but unbuilt, and becomes relevant the moment orders need
  handling by someone other than James or Jim.

## What H2's chapters established (2026-07-29)

From the twelve chapters of `docs/history/`, each verified against the
code and against read-only production queries. H1 established that the
internal half is built; H2 establishes something sharper: **it has
never been used, and the chain from a live bird to a sellable SKU has
a hole in the middle.**

### The substrate is unexercised, not merely under-populated

Row counts read from production on 2026-07-29 via
`scripts/prod-read.sh`:

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
| `shipping_settings` | 1, `allowed_states` **empty** |

Every code path in Products / Orders / Inventory is unit-tested and has
never run against real data. **Treat "run one real sales cycle through
the admin side" as a candidate first batch**, ahead of any storefront
work — it will surface first-use bugs while the blast radius is still
two people.

Two schema corrections while we are here: `is_bundle` and
`bundle_contents` are **columns on `product_kinds`**, not tables (no
`bundles` table exists), and all six product kinds have an empty
`content` jsonb and no `photo_path` — the four storefront description
slots have never been filled.

### The catalog does not match the price list

Production's brackets predate `proposed-prices-summer-2026.md` and
disagree on nearly every SKU. Full comparison in
`docs/history/pricing-orders-and-ecommerce.md`; the load-bearing
items:

- **Absent SKUs**: Cornish hens, tenders, chicken sausage (two), livers.
- **A hole in production**: whole chicken jumps 4.5–5.0 → 5.5–6.0 lb, so
  a 5.2 lb bird matches no bracket and has no price.
- **A hole in the price list**: wings are priced ≤2.0, 2.0–2.5 and
  ≥3.0 lb — nothing covers 2.5–3.0.
- **Eggs cannot be expressed at all** — see below.
- **No model for two published commitments**: bulk discount tiers
  ($10/$15/$20 off at $100/$150/$200) — `orderTotalCents(lines,
  shippingCents)` takes no discount argument — and the delivery policy
  ($10 fee waived over $150, $50 minimum, Thursday-only, prepaid). The
  policy's service area is zip-level; `stateAllowed()` checks states,
  and the allowlist is empty.

### Egg grading is the highest-value schema gap

`product_kinds.eggs` has a single `default` / "1 dozen" bracket while
the price list has three tiers (Large $7, Medium $5, Pullet $3). Egg
grading exists in no layer of the system. Worse, nothing converts eggs
to dozens: `egg_collections.count` is individual eggs, no cracked/
discarded quantity is captured, and no code path creates an egg
inventory lot — the FIFO machinery is built with no producer feeding
it. The chore that would do it ("Add cartons to inventory",
`eod-add-cartons-inventory`) is a bare checkbox, and it is the app's
only live egg→inventory integration point.

Order of operations, from `docs/history/layers-and-eggs.md`: capture
cartons at pack time (dozens by grade → `inventory_lots`) → egg
brackets in `product_kinds` → egg rows in `product_prices` →
storefront. Eggs are the only product sellable every week of the year,
so this is the arc's most valuable single fix.

### The production → lot link is a date-string coincidence

Nothing creates inventory lots from a processing day. The workspace
records `packed_crates` / `final_count` on the event payload and stops;
lots are typed by hand on the Inventory page. Metrics' "cuts ordered"
column then joins the two by **string-equal dates**
(`lotDate === processingISO`, `src/pages/Metrics.jsx:125`) — the app's
one production↔catalog linkage breaks the moment a lot date is typed
wrong or entered a day late. Two user-facing strings currently promise
automation that does not exist ("Chicken lots get created as the final
step of a processing day").

Build **"resolve the day → create the lots"** as a real write carrying
the batch id, per `docs/handoffs/2026-06-03-feature-handoff.md` §11,
before building a storefront: on-hand, FIFO allocation, shortfall
warnings and sellable stock all inherit from it. Today the link is a
*human* step — the active legacy "Processing day prep" process carries
a chore literally titled "Create inventory lots from processed birds",
which makes this a well-defined build rather than a design question.
The rebuild's own equivalents (`proc-sort-freezers`,
`proc-log-inventory`, `mkt-return-inventory`) are landmark-triggered
and deferred, so no engine prompts them. `mkt-prep-preorders`
(−3 days) is the natural online-order hook and its process is
currently disabled.

### Margin is currently uncomputable

Pricing's below-floor warnings call
`productCost.computeBroilerCostPerBird`, which reads
`src/data/nff-data.json` — static, git-tracked, deliberately excluded
from the JSON→Postgres migration. In it: `chickPurchasePerBird` null,
both packaging figures null, `eggs.packagingPerDozen` null, yields an
"industry rule-of-thumb… confirm with processor", and target margin
"not yet defined". Only slaughter ($7.50) and cut-extra ($4.00) are
real. The library behaves correctly (it returns a `missing: [...]`
list rather than a wrong total) but **the live-margin feature, the
headline outcome of the 2026-06-02 pricing workshop, has never had a
complete floor to measure against.**

There are also **two feed-cost engines**: `metrics.feedConsumedForGroup`
computes a real per-batch cost with caveats, while the pricing path
divides a schedule-derived estimate by a hard-coded default batch size.
Reconcile them before making pricing decisions, and decide whether the
`costs` block moves into Postgres with an editing surface.

**A dependency that outranks all of this:** James said on 2026-07-02
(F24, 07-02 audit) that the **feed-schedule substrate is being phased
out**, "Replacement TBD". Reorder dates, feed-eaten, feed cost, FCR's
numerator *and* the pricing cost floor all derive from it. Any margin
or pricing work scheduled before that replacement is decided will be
built twice.

Prices in practice are **negotiated, not derived** — the 2026-07-02
two-party worksheet is the actual mechanism, and migration 0045 exists
to hold it. Any pricing UI should assume negotiation and history.

### Platform posture must change for a public surface

From `docs/history/platform-and-infra.md` — nearly every platform
decision so far was made *because* the app is private:

- **No anonymous path exists.** All 79 tables have RLS on; every
  policy targets `authenticated`; zero `anon` policies. A storefront
  needs anonymous read of a narrow published surface and anonymous
  write of nothing beyond an order intent — an RPC or edge function,
  not table grants. Note that "current price" must be a view or
  function, because `product_prices` is append-only.
- **A second identity model.** `admins` + `current_user_is_admin()`
  cannot express "a customer who may see their own orders". Either
  customers never authenticate (magic-link order lookup) or per-row
  ownership arrives for the first time.
- **The app is de-indexed at three layers**, including a site-wide
  response header. A storefront must be indexable, so it cannot sit
  behind the same headers — an argument for a separate Netlify site,
  and an input to the Hugo-vs-JS decision.
- **`main` auto-deploys in ~2 minutes with no CI and no staging.**
  Today a bad push means two farmers reload; with checkout it means
  broken payments in front of customers. Checkout is also the one flow
  that cannot be tested by writing a marked row to prod and deleting
  it. **Solve staging before writing payment code.**
- **Backups are manual and push-coupled.** Losing a day of chore
  completions is annoying; losing a day of paid orders is not
  recoverable by re-entry. Scheduled backups plus a rehearsed restore
  are a precondition.
- **Webhooks are a new operational posture.** Three trivial Netlify
  functions exist today; Stripe and Shippo callbacks mean signature
  verification, idempotency and real error paths.

### Reusable patterns the arc should inherit, not reinvent

- **Storage locations are places.** `inventory_lots.place_id` FKs to
  `places` by deliberate design ("freezers/fridges get added to the
  place tree, not as free text", `0027_inventory.sql:20-22,38`). The
  tree currently holds one generic "Cold storage" container — seeding
  real freezers/fridges is minutes of work and blocks nothing else.
  Note the asymmetry: `orders.fulfillment_method` has **no**
  `place_id`, so pickup locations are *not* places; decide that
  deliberately if the storefront needs to name them.
- **One file-upload convention**: the `project-files` bucket plus
  `src/lib/attachments.js`, already copied for cut sheets in migration
  0048. Product photos should extend it, not add a third layout.
- **Live HTML doc attachments** (42.8, migration 0045) are a
  prod-proven shared-tool pattern and the pricing worksheet's home.
  Caveat: no same-key conflict banner.
- **`project_links.target_kind` is unconstrained text** — linking
  projects to products, orders or customers needs **no migration**.
- **Express selling work as event kinds with buffers**, not a new
  scheduling concept: markets and pop-ups already are event kinds,
  41.21's market buffer carries the equipment checklist, `event_links`
  links an event to arbitrary rows, and `commitments` accepts an
  `event` source type. Pickup windows, delivery runs and fulfilment
  days belong in that shape.
- **Availability gates fulfilment promises.** `working_hours` /
  `time_off` / `breaks` (0044/0046) via
  `src/lib/schedule/availability.js` are the only honest answer to
  "can we ship on Thursday?" — do not invent a second capacity
  calendar.
- **The capture substrate is an underused KPI freezer.**
  `docs/specs/versioned-capture-substrate.md` §2.1 names
  `telemetry.daily_kpi` and `metrics.*` as intended schema ids; only
  `schedule.confirmed_day` exists. Daily sales / margin / fulfilment
  snapshots are its natural second consumer.
- **Do not model e-commerce work as ranked projects** expecting the
  Schedule to absorb it — reflow auto-seeding was deleted in 42.4.

### The agent bridge and money

The MCP bridge is propose-only by design and that rail should cover any
future agent-initiated commerce write — never direct writes to
products, prices, orders or sales. But **forbid proposals for prices,
orders and payment/fulfilment/refund state** outright: money plus
customer PII would sit in proposal payloads and in chat context, and
approval fatigue is the failure mode. The sharper risk is the *read*
side — a chat that can read prices will quote them, so any
`list_products` / `list_prices` tool must return the live current price
with an effective date, or not exist. Note also that the approve path
has **never executed in production** (zero applied rows; the one
proposal ever made was rejected), so verify it end-to-end before
extending it.

### Surfaces, copy and sequencing

- **The open-orders glanceable already exists.** `OpenOrdersCard`
  counts open + ready orders and shares its selector with the sidebar
  badge. F14 (06-04 audit) struck it as unearned *because the data was
  empty* — a real order stream reverses that premise, but the question
  must be answered inside the Dashboard-retirement decision, not
  around it. Metrics has no revenue view at all; extend the pure,
  tested `src/lib/metrics.js` rather than computing in the page.
- **The email half of farm updates is not blocked** on the site
  architecture and could ship first — the 65-contact list has been
  waiting since 2026-06-02, and transactional email is the shared
  blocker for order confirmations too.
- **Buy the maps key once.** Travel-time/event-footprint, the mileage
  tracker, and any delivery-route or pickup-window feature all need
  the same geocoding.
- **Land the F11 palette reconfiguration before customer-facing
  surfaces**, or they get restyled twice — and it is time-sensitive
  against Jim's learned habits. New surfaces inherit
  `public/style-guide/DESIGN-SYSTEM.md` + `src/components/ui.jsx`.
- **Storefront copy is brand voice, not product-UI voice.** Four
  description slots × six products is an unstarted content task on the
  customer-facing side of the voice guide.
- **Physical channels come first in the business and last in the
  code.** Three weekly markets, six pop-ups and a weekly Scituate egg
  drop are where sales happen; POS exists for exactly that and has
  recorded nothing. That argues for pickup and local delivery before
  shipping.

## Open questions for the re-scoping conversation

- Platform: headless vs hosted (Shopify) vs custom on the existing
  stack. Note there is no prior research to lean on — this is an open
  evaluation, not a decision to revisit.
- Initial scope: online ordering for pickup? Shipping? Deposits on
  future processing dates? Which products first?
- Data boundary: does the storefront read the dashboard's Supabase
  (inventory, brackets, prices) directly, or via a published feed?
- Payments: Stripe vs Venmo-first; how much of QuickBooks sync is in
  scope.
- Where it lives: the dashboard is admin.northfosterfarm.com; a
  storefront is presumably northfosterfarm.com — separate surface,
  shared data.

## Findings log (appended per phase)

- H0 (2026-07-29): secrets hygiene needs fixing before any
  payments/customer-data work — a Google OAuth client secret JSON and
  `vapid-keys.txt` sit loose in `.ignored/`; relocation is on H3/H4's
  list. Customer PII and payment credentials raise the bar on the
  whole repo's secret handling.
- H1 (2026-07-29): the five dossiers' e-commerce findings are folded
  into "What H1's mining established" above. Headline: the internal
  half is built and in prod, the external half is unscheduled intent,
  and the unmade site-architecture decision (Hugo vs JS framework,
  monorepo vs split) gates the rest.
