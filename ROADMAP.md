# Roadmap v2

Written 2026-07-30 at the close of the housekeeping arc (H6).
Forward-looking only: everything shipped lives in `docs/history/`
(one chapter per feature), and this file never grows a history
section. `docs/ecommerce/PREP.md` is the standing brief for the
e-commerce arc; this file is the sequence.

## How to read this file

- ONE linear sequence. Items execute top to bottom; lettered
  sub-items execute in order; a part's exit criterion gates the next
  part. There are no parallel tracks. Two appendices — Standing
  rules and the Graveyard — are not sequence positions.
- Markers: **[batch]** = agent-executable unit of work (TDD, green
  `npm run check`, lands as a PR). **[session]** = James working
  live with an agent; output is written decisions, not code.
  **[James]** = only James can do it (physical, legal, or data
  authorization). A batch's *Accept:* line is its falsifiable
  done-condition.
- Prod writes stay under the data-safety rules in `CLAUDE.md`:
  agent stages read-only, James executes; backup before every push.

## Decision record (James, 2026-07-30, H6)

1. Storefront stack: **Tailwind UI + Tailwind CSS**; payments:
   **Stripe**; the Hugo public site is **rewritten** onto a new
   framework. Framework itself chosen at the architecture session
   (Astro is a candidate, not a commitment).
2. **Now survives; the Dashboard retires** (rehoming batch below).
3. **Agent bridge continues, deprioritized** to the tail.
4. **Chores fully parked** (speculative; dormant since 07-11).
   Commerce batches pull specific chore hooks in per-need; each
   pull is decided at that batch's kickoff.
5. **Lessons killed** outright; no seeds recorded.
6. Killed: **GCal push, ntfy, bookmarking/voice**;
   **Resources rethink confirmed absorbed** by the place model
   (2026-05-31) — recorded here because nothing else records it.
7. Revived small: **quote/artwork rotation v1, mileage tracker,
   YoLink-small, pasture planner re-scoped** (slotted below).
8. **F32** (proportional timeline bars) is decided inside the
   design session, with mockups — not before.
9. **Backups stay fully manual.** No scheduling item anywhere in
   this roadmap. Accepted consequence, recorded: an order book
   without scheduled backups + a rehearsed restore is a risk that
   payments work (4.5c) will re-surface as a precondition.
10. **Forced-rank dies**: the drag-rank surface goes; projects keep
    buckets/queue states; the Now card reads bucket order.
11. **Zero-row tables** (audit item 22): no global kill/keep — each
    table's fate is decided by the batch that would use it.

---

## Part 0 — close the housekeeping tail

- 0.2 **Eyes-on QA walkthrough** [session] + fix wave [batch].
  One session (QA Walkthrough playbook, `docs/workshops/`), both
  viewports per surface: the Tomorrow section (live for the first
  time ever), the three H5 bug-fix surfaces (batch delete, sidebar
  flyout counts, skipped-event calendar toggle), the batch-42
  sweep, the overnight/project-blocks arc, PlaceTree/LoginGate.
  Findings triaged on the spot; the fix wave is the batch.
  Accept: every listed surface walked; triage list empty or booked.
- 0.3 **Settle migration 0043** [James, 5 min]. `supabase migration
  list --linked` (needs a real terminal login). If unapplied:
  backup → push per data-safety rules. Failure mode while unknown:
  un-confirming a day silently no-ops under RLS.
- 0.4 **Test-gate completeness** [batch]. Fold
  `test-schedule-partition.mjs` (~4,000 randomized partitioner
  runs) into vitest; move the version-sync check into
  `.githooks/pre-commit` so human commits hit it too.
  Accept: `npm run check` runs the partition property test; a
  human commit with mismatched versions is blocked.
- 0.5 **outbox.js unit coverage** [batch]. 756 lines carrying the
  additive-merge guarantee, zero tests — the highest-value test
  gap in the repo. Accept: the additive-merge property has a
  failing-first suite; coverage ratchet raised.
- 0.6 **Projects model collapse** [batch]. Retire `isActiveProject`
  for `queue_state` + `completed_at` + `archived_at` across
  deriveDay/Schedule/sections (closes F96, 06-04); fixes F16
  (undated projects render "All day") in the same shared selector;
  drop the vestigial `status` column path and ProjectPage's status
  select; **delete the forced-rank UI** (decision 10) and the
  settable no-op lock-to-date. Accept: no `isActiveProject`
  callers; F16 test green; rank surface gone; suite green.
- 0.7 **Inbox promote-to-project fix** [batch]. Route through
  `createProject({ queueState: "unprioritized" })` — the current
  path corrupts rank order today. Accept: promoted thought gets
  slug + bucket + tail position; TDD.
- 0.8 **Quick-convert thought → event** [batch, small]. The missing
  third of the shipped Inbox; convert-to-chore stays behind the
  chores fence. Accept: a thought becomes an event via the app's
  real event-creation path.
- 0.9 **projectGaps sun-anchored break fix** [batch]. Break holes
  bypass `resolveWindow`; a sunset-anchored break fails to trim
  the evening project gap. Accept: the TDD case from
  `docs/history/schedule-and-events.md` passes.
- 0.10 **Placement staleness cleanup** [batch + James data check].
  The map is lying now: batch_3 holds a stale open brooder
  placement, batch_5 has none. Ship close-placements-on-
  pasture-move (or a staleness warning) + the one-time data fix.
  Accept: `scripts/check-consistency.mjs` extended to flag
  placements older than their batch's stage; prod clean.
- 0.11 **Finish the "Anytime" removal** [batch]. Half-done is the
  worst state (06-28 F30). The wider chore display/ordering arc
  (F30/F48/F49 as one model change) stays behind the chores
  fence; this batch only finishes the started removal.
  Accept: no surface renders an "Anytime" bucket.
- 0.12 **Bank the multi-device concurrency lesson** [batch, doc].
  The deterministic-survivor mitigation (lexically smallest id)
  was root-caused in deleted code; write it into
  `docs/history/platform-and-infra.md` where it survives.
- 0.13 **Start recording the live market cycle** [James]. Markets
  are running now; POS works and has recorded nothing. Record
  real sales with current ad-hoc prices — explicitly a
  data-capture exercise, not the 4.2g acceptance milestone.

## Part 1 — the design pass

Time-sensitive (Jim's learned habits calcify) and a hard gate for
anything customer-facing.

- 1.1 **Design session** [session]. Agenda, decided with mockups:
  category colour identity (F11 07-02 — "category colour identity
  has failed", incl. the light-theme accent/resolved same-hex
  defect); F32 proportional bars (decision 8); the
  gray-as-disabled cluster (F46/F52/F63/F83/F104/F131, 06-04);
  the remix's 20 unreviewed pages; the folded 06-28 design set
  (rethinker Phase 4); ramp canonicity for brand use + the
  turf-green 550 brandmark handoff; which duplicates
  alias-or-delete. Output: written palette + identity decisions.
- 1.2 **Ramp configuration** [batch]. Implement 1.1: Tailwind
  ramps for info/alert/warning/danger + category hues; reassign
  identity per the session; implement `--c-brandmark-inverse`;
  reconcile/alias the duplicate ramps; retire or author
  teal/mulberry/terracotta/emerald per the session.
  Accept: styleGuideRamps test updated + green; both faces of the
  design library updated; no same-hex accent/resolved.
- 1.3 **Component convergence** [batch]. ConfirmDialog for bare
  `window.confirm` (re-measure the count first), BTN_* adoption,
  the deferred CoverSheet sized-BTN variant, Eyebrow/Heading/
  Button/StatTile/PlaceSection unification where touched.
  Accept: enumerated list in the PR; design library updated.
- 1.4 **Design-doc drift lint** [batch]. Every ramp named in
  `foundations.html` exists in `src/styles.css`; every path cited
  in the design docs resolves (extends pathCitations pattern).
  Accept: a deleted ramp fails the suite.
- 1.5 **Self-host Lora + Inter** [batch, small]. Two of three type
  roles currently fail on a cold offline load; Nacelle already
  shows the pattern. Accept: no external font requests.

## Part 2 — Dashboard retirement

- 2.1 **Rehoming checklist** [James, async]. Five one-line calls,
  answered before the batch starts: current conditions (→ top-bar
  fold-out?), broiler weeks + F19 day count (→ species page /
  Now?), sunrise countdown (→ inside conditions?),
  since-yesterday activity (→ Now or dies?), the Tomorrow
  section's job (→ Now or dies?).
- 2.2 **Retirement batch** [batch]. Execute 2.1; delete
  `Overview.jsx` and the duplicate day-derivation; nav update;
  prune "What's coming" (four shipped entries) or generate it
  from this file; remove the Notes and Equipment ComingSoon nav
  entries (revivable; Farm updates + Content calendar stay,
  pending 4.8). The OpenOrdersCard question dies with the page —
  the future sales glanceable lands on Now when there are orders.
  Accept: no route renders Overview; nav has no ComingSoon dead
  ends except the two kept on purpose; suite green.
- 2.3 **Quote/artwork rotation v1** [batch] (decision 7). Spec +
  dataset tracked; ~4h + one curation pass [James]. Gallery v2
  stays deferred. Accept: rotation renders; curation list signed
  off.

## Part 3 — stack upgrade

- 3.1 **React 19 + Vite 8 + @vitejs/plugin-react 6** [batch]. One
  coordinated unit (clears the esbuild dev advisory). Positioned
  before the spine so storefront work starts on the target stack.
  Accept: suite + build + CI green; `npm audit` clear of the
  esbuild advisory; deploy verified by content marker.
- 3.2 **F23 caching / stale-flash** [batch]. The flash of stale
  content on navigation + the ~5s Schedule recompute — what every
  glanceable feels like today. Scope: memoize/cache the day
  derivation, not a rewrite. Accept: navigation shows no stale
  frame; recompute under 1s on the reference phone.

## Part 4 — the e-commerce arc (the spine)

- 4.1 **Site-architecture session** [session]. FIRST; nothing
  customer-facing before it. Fixed inputs: Tailwind UI/CSS,
  Stripe, full rewrite of the Hugo site (decision 1). To decide:
  framework (Astro candidate), monorepo vs split, separate
  Netlify site (the admin app is de-indexed at three layers; the
  storefront must be indexable), data boundary (direct Supabase
  read vs published feed), build triggers. Output: written
  decisions, pricing-workshop style, appended to PREP.md.
- 4.2 **Admin-side data readiness** (letters in order):
  - a. **Catalog ↔ price-list reconciliation** [batch → James].
    Agent enumerates the gaps (4 missing SKUs, the 5.0–5.5 lb
    whole-chicken hole, the 2.5–3.0 lb wings hole) and stages the
    seed/migration with a dry-run diff; James confirms
    `proposed-prices-summer-2026.md` and authorizes the write —
    the first `product_prices` rows ever.
    Accept: every price-list SKU has a bracket and a price row;
    no bracket holes; prod-read verifies.
  - b. **Egg inventory model** [session, short]. The decision
    everything below depends on (`thread_egg_inventory_model`):
    count-before-market vs log-as-collected; grading model (egg
    grading exists in no layer today).
  - c. **Egg chain build** [batch ×3, sequenced]. Cartons at pack
    time (dozens by grade → `inventory_lots`, + `place_id` and
    periodic `avg_egg_weight_oz` on `egg_collections`) → egg
    brackets in `product_kinds` → egg `product_prices` rows
    (Large $7 / Medium $5 / Pullet $3). Each carries a migration
    number + vitest expectations.
    Accept: a pack-time entry yields an on-hand dozens figure.
  - d. **Lots from processing day** [batch]. "Resolve the day →
    create the lots" as a real write keyed on batch id — kills
    the date-string join (`Metrics.jsx:125`); fix the three stale
    strings (Processing's "Batch 16" comment, Inventory's
    lot-creation promise, Metrics' "joins chicken lots"); seed
    real freezer/fridge places [James names them].
    Accept: resolving a processing day creates lots carrying the
    batch id; Metrics joins by id.
  - e. **Feed-substrate session** [session]. Replacement for the
    feed schedule (F24 07-02: "phased out, replacement TBD") —
    blocks cost floor, FCR, margin. Then [batch]: reconcile the
    two feed-cost engines, fill cost inputs (chick, packaging ×3,
    confirmed yields, target margin), decide costs-block →
    Postgres. Accept: `computeBroilerCostPerBird` returns no
    `missing` entries; one feed-cost engine.
  - f. **Batch data backfill** [James, small]. Arrival dates for
    Batches 1–2 (null today — no age, no lifecycle state, no
    per-batch metrics) and Batch 4's tractor spread.
  - g. **One real reconciled sales cycle** [James, milestone].
    The acceptance test of a–f: a market weekend recorded through
    POS at real prices, inventory draining FIFO. Agent delivers a
    pre-flight checklist before and a first-use bug-fix batch
    after. Accept: product_sales rows exist with real prices and
    lot movements.
- 4.3 **Platform preconditions** (letters in order):
  - a. **Transactional email** [batch]. Provider (SendGrid/
    Mailgun) wired server-side; the farm-updates email half ships
    with it — 65 contacts waiting since 06-02, explicitly NOT
    blocked on site architecture. Accept: a real update email
    reaches the list; order-confirmation template exists.
  - b. **YoLink coop-temperature thresholds** [batch] (decision
    7). Rides the notification plumbing while it is warm.
    Depends: YoLink API key + a live reporting sensor.
    Accept: threshold breach produces a web-push [James verifies].
  - c. **Anonymous read surface** [batch]. RPC/view for published
    products + current price (append-only `product_prices` means
    "current" must be derived) + availability. Accept: anon key
    can read exactly the published surface; zero anon table
    grants.
  - d. **Caller-verified functions** [batch]. The shared-secret /
    JWT-forward pattern on every function touching orders,
    customers, or payments; Stripe/Shippo keys into Netlify env,
    test mode. The existing three functions' open-POST pattern
    must not extend. Accept: an unauthenticated POST to a
    commerce function is rejected; a test-mode Stripe call
    succeeds.
  - e. **Staging story** [session, short → batch]. Supabase
    branch or second project + branch deploys — checkout cannot
    be prod-tested by marked rows. Decide, then wire.
    Accept: a PR exercises checkout end-to-end in test mode
    without touching prod.
    (Backups stay manual per decision 9 — re-raise here, once,
    when payments code is imminent.)
- 4.4 **Site rewrite** (the public half):
  - a. **Content port** [batch]. The Hugo site's pages on the
    framework chosen at 4.1. Accept: content parity, indexable,
    Lighthouse ≥ the Hugo baseline; the placeholder phone number
    in `company.yaml` finally fixed.
  - b. **Brand tokens as web tokens** [batch]. Export the Part-1
    palette decisions in the format 4.1's framework consumes.
    Blocked on 1.2. Accept: storefront styles reference exported
    tokens, not hex literals.
  - c. **Voice publish gate** [batch]. The lintable half of
    `voice-guide.md` (smart quotes, pasture-raised hyphenation,
    non-GMO casing, seasonal titles, footer, gratitude line) as a
    content check in the site's CI. Accept: a violating page
    fails the build.
  - d. **Nacelle licence verification** [James]. Freeware from
    dotcolon.net — commercial-use terms never verified. Do this
    before the brand ships on a commercial storefront.
- 4.5 **Storefront v1** (letters in order):
  - a. **Catalog content** [James]. Four description slots × six
    products + photos (photos ride the `project-files` +
    `attachments.js` convention — no third upload layout).
  - b. **Pickup + local delivery model** [batch]. Physical
    channels first, shipping later. Bulk-discount tiers
    ($10/$15/$20 at $100/$150/$200 — `orderTotalCents` grows a
    discount argument), delivery policy ($10 fee waived > $150,
    $50 min, Thursday-only, prepaid), zip-level service area
    (today: state-level and empty). TDD throughout.
    Accept: a draft order prices itself per the published policy.
  - c. **Stripe checkout** [batch]. Gated on 4.3d + 4.3e.
    Integration shape (Checkout vs Payment Element) decided at
    4.1. Accept: a test-mode order completes end-to-end in
    staging; webhook signature verification + idempotency tested.
- 4.6 **Order operations**:
  - a. **Per-row detail routes** [batch] (revived): customer,
    product, order pages; the search index already knows every
    row. Accept: search lands on a detail page, not a list.
  - b. **CRM completion** [batch]. The named thinness list from
    `docs/history/pricing-orders-and-ecommerce.md`: customer ↔
    order linking UI, address/tags/referral fields, dedup pass on
    the 65-row import. Accept: an order shows its customer; a
    customer shows their orders.
  - c. **Fulfillment ticket + bins** [batch]. Bin assignment on
    lots; the ticket shows the pull location. (Physical freezer
    organization stays outside the app.) Chores-pull decision at
    kickoff per decision 4 (e.g. `mkt-prep-preorders` −3 days as
    the online-order hook). Accept: a ready order prints/renders
    a pull list by bin.
  - d. **Guest access + roster** [batch]. The moment someone who
    is not James or Jim handles a market or fulfillment:
    guest role per the handoff design; `PARTITION_ADMINS` /
    `ADMINS` hardcoding replaced by a people source.
    Accept: a guest login can work a fulfillment screen and
    nothing else; no hardcoded roster in src/.
  - e. **CLAUDE.md must-never-lose update** [batch, doc]. Add
    customers / orders / product_sales when the first real order
    exists (audit PREP note).
- 4.7 **Mileage + maps unit** [batch] (decision 7 + buy-the-key-
  once). One Google maps/geocoding key serves: mileage tracker
  (one table, one page, an annual total — direct dollar return),
  event time footprint's cheap slice (post-event work modeling),
  and any delivery-route/pickup-window need from 4.5b. Live
  travel-time stays in the tail. Accept: mileage annual total
  renders; events carry a geocoded endpoint.
- 4.8 **Later commerce** (ordered, but explicitly after v1 ships):
  Shippo live labels/rates/tracking (the shipment model is
  already Shippo-shaped) → farm-updates site half + blog pipeline
  (inherits 4.1's answer; consider plain drafts + gates before
  the PR-emulation review layer) → "order work on the Schedule"
  re-scope (slice 8) → QuickBooks (independent; can wait
  indefinitely).
- 4.9 **Pasture rotation planner, small** [batch] (decision 7).
  James picks the surviving spec first (the re-pointed roadmap
  line vs `docs/specs/pasture-rotation-planner.md` — they
  conflict); then GeoJSON upload + tractor-capacity calculator,
  no canvas. Accept: a rotation plan renders as future
  placements.

## Part 5 — the deprioritized tail

Ordered; starts only when the spine's v1 (through 4.6) has shipped,
except where a tail item is pulled forward by a real need.

- 5.1 **06-28 backlog triage** [session]. Triage once against
  current main (deploy-lag rule: de-taint findings first); the
  four VERIFY items need a real phone [James]. May re-rank the
  rest of this tail.
- 5.2 **Layers cluster** [batch ×n]. F113/F20 reconciliation (a
  move-out action recording culled vs sold — the only way a flock
  leaves); F114 backfill of the three layer groups [James, ~1h
  data]; the pooling story (F36 port to Metrics, F41a pooled
  mortality, the F41b definition-text migration that was
  prod-parked in the 06-04 handoff and never executed); F112
  flock model; replace the `purpose`-regex species test with a
  role column before a copy edit disables egg capture.
- 5.3 **Agent bridge** (decision 3; internal order per its own
  chapter — the contract layer is the dependency under the rest):
  settle the five design-doc open questions (contract format
  first) → register the server + run one end-to-end approve in
  prod (verified, exact-id cleaned) → fix the invisible nav
  pending-count badge (`sections.jsx:135`) → event/chore proposal
  kinds (chore kinds respect the fence) → HTTP transport last.
  Decide alongside: email-to-agent (supersede or fourth surface)
  and propose_attachment (keep-or-kill). Commerce guardrails from
  PREP.md are binding: propose-only; never prices/orders/payment
  state; read tools return dated current prices or don't exist.
- 5.4 **Schedule deferred stories**: S114 "tomorrow looks heavy"
  (needs a server-cheap load proxy), man-down push (S111),
  token-grammar search (S33d), invalidate-ack-on-edit (S60b),
  S69; confirm auto-pop 3b was closed by 42.4's retirement.
- 5.5 **Who's-here / availability cluster** (F1/F4/F6/F8/F12
  07-02): `availabilitySegments` is already in the engine
  waiting; includes the HereStrip successor and "why is no one
  here" traceability.
- 5.6 **Week/Month views** design bracket (F19 07-02 vs S107).
- 5.7 **Overnight polish**: O6, O-B7, retime-across-midnight,
  placement unification.
- 5.8 **Smaller standing questions**, batched opportunistically:
  F10 overdue-rollover semantics; records-drawer IA (re-adopt
  §5.1 deliberately or retire it); place_status keep-pure vs
  materialize; the SVG↔place drift invariant + geometry tail;
  asset occupants as real tables (with the Equipment nav
  revival, if ever); cross-batch conflict detection (F25);
  sticky chrome + landing-split re-evaluation; F12/F13 map
  one-liners; clone-from-stub for repeatable projects; F111
  completion roll-up decision.

---

## Standing rules (not sequence positions)

- **Chores fence** (decision 4): no chores investment without a
  fresh James call; commerce pulls hooks per-need, decided at the
  pulling batch's kickoff.
- **Split-when-touched**: Schedule.jsx (3,945), Chores.jsx,
  Orders.jsx. Never scheduled as standalone refactors; complexity
  waiver buckets only shrink (`eslint.config.js` RATCHET rule).
- **ESLint backlog burn-down**: exhaustive-deps (31) retires as
  files are touched; enable the React-Compiler hooks rules after
  3.1; only-export-components (18) as refactors happen.
- **Coverage ratchet**: thresholds rise to just under real
  coverage whenever it improves; never loosen.
- **Next-real-batch verification checklist** (run once, when a
  real broiler batch next arrives): brooder-cleanout expansion
  writes `anchor_batch_id` and lands on the brooder; the broiler
  process expands end-to-end from the arrival event (F26/F29);
  multi-occupancy placements behave across 5+ tractors.
- **Deploy-lag rule**: de-taint any audit finding against current
  main before booking work on it.
- **Prod writes**: agent stages read-only + dry-run; James
  executes; backup first; exact-id deletes only.
- **Doc upkeep**: batch roadmap entries are the catalog's feed;
  chapters' "Current state" refreshes at arc boundaries, not
  per-commit. Design-library both-faces rule stands.

## Graveyard & deferrals

- Lessons module — killed 2026-07-30 (decision 5), no seeds.
- Forced-rank UI — killed (decision 10); removed by 0.6.
- GCal push — killed; `gcal_pushes` dropped by 0051;
  `gcal_event_id` on events is documented dead.
- ntfy — killed; web-push/VAPID won.
- Bookmarking / voice control — dead; the MCP agent is voice's
  successor.
- Resources rethink — absorbed by the place model 2026-05-31;
  this line is the record.
- Unlock gallery v2 — deferred, not killed; meaningful after
  quote rotation (2.3) has run a few weeks.
- Live travel-time / leave-by — deferred behind 4.7's cheap
  slice; needs a scheduler + per-event data audit [James].
- `event_instances` — frozen legacy; 10 future-dated rows must be
  diffed against the new tables before any drop.
- Sheep — pets by design: no lifecycle strip, no metrics; a
  barn → stall → sheep pass only if it ever earns a pull.
