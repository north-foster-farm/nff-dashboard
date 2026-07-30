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

Still untracked, assessed in H1: `.ignored/nacelle/` is a font
package, not platform research — the name is a typeface (already
tracked at `public/fonts/`), so there is **no prior headless-commerce
research** to build on. `.ignored/pricing-worksheets/` keeps the
interactive worksheet HTML and its localStorage dump; the summary that
matters is the promoted price list above.

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
  were all empty as of the June audits. A storefront cannot publish
  what the admin side has never been used to record — check current
  row counts (H4's A4 does this) before scoping.
- **Legacy stubs still in the schema**: `egg_lots`/`chicken_lots`
  placeholders from migs 0005/0006, and `orders.line_items` jsonb
  superseded by `order_lines` (`93f55ed`) — kept under the
  additive-only rule, but they will confuse anyone reading the schema
  fresh.
- **Guest access** (a helper working markets or fulfillment) is
  designed but unbuilt, and becomes relevant the moment orders need
  handling by someone other than James or Jim.

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
