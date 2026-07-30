# Parked and abandoned

The graveyard and the parking lot. Two distinct populations:
**never-built ideas**, some scoped in more detail than features that
shipped, and **shipped-then-deleted code**, which no-legacy produces
constantly and which is a different artifact entirely — it has a
removal commit, so it is recoverable. Read this chapter for one
purpose: to decide, per idea, revive or kill.

On numbers, because this is where they are most dangerous. `batch 41`
alone is the **chores rebuild** (`b0ff48f`); `batch 41.N` is the
**Schedule**. Numbering was reshuffled six times, so only the
as-shipped table in `.ignored/housekeeping/mining/m1-commits.md` §2 is
trustworthy — and never-shipped numbers (30, 31, 32, 34, 36, 37, 38)
never got that correction pass, which is why they are the worst of
all. Four independent F-numbering universes exist, so every F-number
below carries its audit date.

## Evolutions

### 2026-05-04 — the wishlist that seeded most of the graveyard

Before `ROADMAP.md` existed there was a brain-dump
(`.ignored/more-stuff.md`, m3 §1). Its first paragraph is the
e-commerce intent list — "SKUs and inventory, pricing, orders, point
of sale, stripe, venmo and quickbooks integration"; its second half is
the parking lot: voice control ("dad needs to be able to command this
app by voice"), offline tolerance, pasture visualization. The commerce
half became Batches 27–29 plus the still-unbuilt Batch 30. Of the
other three, pasture is still open, offline shipped only in the
field-write slice, and voice was cut outright eight weeks later.

### 2026-05-05 — farm updates get a pipeline design and a table

`5fe6451` captured the publishing pipeline that is still the plan of
record (`ROADMAP.md:3219`, Batch 32): one draft, one approval, two
surfaces — a publish to the public nff site *and* an email blast
through Fastmail SMTP to a CRM list, with the list selection stored on
the update record so the audience is part of what gets reviewed, and
an idempotent site-publish so re-approving an edited update rewrites
the live page in place.

What makes this more than a wish is a foothold already in production.
`0006_threads_orders_updates_projects.sql:104` created `public.updates`
(title/body/status/author/published_at, "schema only, empty"),
`src/lib/data/useReferenceData.js:648` still loads it, and
`src/pages/Overview.jsx:955` renders an "In-progress farm updates" pane
keyed on its editorial statuses. No editor, no review thread, no
publish path: the dashboard has a window onto a table nobody can write.

Three more things date from this day. The **Lessons module**
(`ROADMAP.md:4981`) — capture what a bad day taught us, then surface it
before the next occurrence of the same event kind, with two seed lessons
James wants prompted for on build; the oldest untouched entry in the
file. Two integration reference dumps:
`docs/history/records/ntfy-digitalocean-setup.md` (self-hosting an ntfy
push server
on a droplet) and `.ignored/yosmart_docs.md` (292 KB of scraped YoLink
API docs for the farm's smart thermometers). And the **pasture rotation
planner**'s requirements — GeoJSON pasture upload, global
Suscovich/Salatin tractor footprints and bird caps, right-angle-move and
recovery-time preferences — now at
`docs/specs/pasture-rotation-planner.md`, whose header records that the
original's chores tail was dropped as superseded.

### 2026-05-06 — the quote/artwork rotation is fully packaged, then shelved

`ec48309` added what remains the most complete never-built feature in
the repo (`ROADMAP.md:4939`). v1: a deterministic `(epoch_day % N)`
rotation alternating typographic quotes and full-bleed artwork on the
login screen, mirrored by a Today-tab widget showing that same item,
with a constant attribution block (name · lifespan · role · bio). v2,
the part James actually asked for, is a Pokédex — items unlock per
account only once that account has *viewed* them, and a gallery under
the avatar shows the rest as "?" tiles; explicitly no trading, no
leaderboards, just unlock-on-view. Estimated at ~4 hours once artwork
curation is done.

The dataset was built before the code and survives intact: 44 quotes,
54 open-access artworks (Met/NGA), 48 people bios in
`docs/specs/quotes-and-artwork/nff_content.json`, plus a 66 KB
`artwork_curator.jsx` pruning tool and a `handoff.md` that opens "Spec
+ dataset complete. Implementation not yet started." Nothing has
changed that sentence in twelve weeks.

Two more entries land in this window. The **mileage tracker**
(`9aff149`; `ROADMAP.md:4823`) — a trip log for markets, deliveries,
supply and vet runs, motivated by the per-mile tax deduction and by
per-trip cost analysis ("is this market actually worth the drive?"),
with three candidate homes (own page / event-attached prompt / top-bar
quick action) and a sketched `mileage_logs` table. And the **Google
Calendar** deferral chain begins: the standalone GCal batch is
repurposed as "two-way sync (deferred)" because push-only is folded
into the Events overhaul.

### 2026-05-07 — a feature is killed two days after it shipped

`chore_groups` shipped in batch 5 (`f734bb4`, v0.9.4) as a table pair,
a Groups tab, Today-tab accordions and an auto-expand preference. The
batch-10 plan (`8790e21`) retired it and `b37ed73` executed: site- and
block-driven partitioning had made manual grouping redundant. It is the
earliest instance of the pattern that recurs all through this chapter —
the codebase would rather delete than keep a second way to do a thing.

### 2026-05-31 — the farm map absorbs two older plans

`dadeb03` did two rewrites at once (m2 §2). The **Resources rethink** —
"'Resources' is too vague today", re-home brooders into Animals and
suppliers into Feed — vanished as a standalone batch, absorbed into the
place model's asset-as-occupant typing and the Resources-flyout
dissolution; its last full text lives only in `dadeb03^:ROADMAP.md`.
The **pasture visualization simulator** was re-pointed from a
standalone Leaflet/MapLibre subsystem into "Batch 37 — Rotation
planner" on the shared place-geometry substrate, where a rotation plan
is just a sequence of future `placements` rows (`ROADMAP.md:3348`). The
requirements text survived unchanged; only its architecture moved.

`acfd246` (batch 15) then deleted the orphaned Resources → Spaces page
and amended the legacy `space_kinds`/`space_items` DDL out of migration
0003 in place — pre-production, so that drop is invisible in the
migration chain.

### 2026-06-01 — the one idea that graduated

Batch 21 (`220c17e`, mig `0016_inbox.sql`) shipped **Inbox / "just a
thought…" capture**, and it is worth being precise because this chapter
is otherwise a list of things that didn't happen. It is live and in
daily reach: global capture from the top bar (`TopBar.jsx:65`), a bell,
a 402-line `Inbox.jsx`, promote-to-event (`Inbox.jsx:212`) and
promote-to-project added in batch 22 (`Inbox.jsx:231`). Deliberately
quiet — the migration header says "no push notifications". The one
piece still owed is the handoff's promote-to-**chore**
(`ROADMAP.md:5107`).

### 2026-06-02 — the Graveyard section is created

`60c10c8` gave cut features a permanent home and retired their numbers
rather than reusing them, leaving deliberate gaps in Upcoming.
**App-wide bookmarking** (Batch 34, `ROADMAP.md:4797`) — per-user
bookmarks of arbitrary entities in nav, via
`user_bookmarks(user_email, target_type, target_id, label,
sort_order)` — was cut because the sidebar plus the cmd-K palette
cover navigate-to-anything. **Voice / natural-language control**
(Batch 38, `ROADMAP.md:4804`) — on-device speech-to-text, intent →
tool-call mapping through Claude, confirmation before state changes —
was cut with the blunt note that James "doesn't expect to need it at
all". Voice is the one graveyard entry that came back in spirit: the
2026-06-03 handoff's Claude-powered agent (`ROADMAP.md:5203`) and the
shipped MCP proposal inbox (mig 0042) are the same intent with a
keyboard instead of a microphone.

### 2026-06-03 — the most expensive unbuilt idea

`14663e7`, expanded the same day by `38aeedd`, filed **event time
footprint** (`ROADMAP.md:4853`). The insight: a market that "runs 9–1"
eats the day — drive, set up, work, break down, drive home, then unload
chickens, stow the tent, pressure-wash crates. Part one is
`setup_min`/`breakdown_min` as per-event-kind defaults with
per-occurrence overrides. Part two is James's real ask — do not make us
*type* the drive: look up live predicted travel time both directions on
a scheduled cadence (creation, T-1 day, T-3h, T-30min relative to a
recomputed leave-by), push-alert when leave-by moves inside 24 hours,
and derive arrive-home so post-event work lands after it as a process
expansion. It needs a future-departure traffic API (Google Routes
named), geocoded event locations, a server-side scheduler — and a
**prerequisite James owns**: re-auditing every existing event so its
footprint and routable address are real. The entry concludes it has
outgrown one batch and should ship in three stages.

The same day's feature handoff (`87a5178`, `ROADMAP.md:5007`) added
**YoLink** as a named integration (`ROADMAP.md:5222`): pull the farm's
smart thermometer readings, alert on threshold crossings.

### 2026-06-04 — the blog decision, and the question it left open

Two commits an hour apart settled the CMS architecture and opened a
bigger question. `47620bd` floated two shapes for blog review — wrap
real GitHub PRs, or emulate them in-app — and `f2e08f7` killed the first
the same day: **the dashboard is the CMS**, because Dad will not use
GitHub. Review is DB-backed PR-emulation (versioned diffs, line-anchored
comments, AI suggestions as one-click diffs) behind a three-gate publish
pipeline (AI tone check, content/schema check, human review); publishing
means rendering Hugo-compatible markdown and committing it.

The load-bearing question it left open: **stay on Hugo or move the
public site to a JS framework**, with "the ecommerce redesign brings a
big JS surface" named as the forcing consideration, plus monorepo layout
and build trigger. `f2e08f7` recommends a site-redesign architecture
session *before* any of this is built. That session has never happened.

### 2026-06-25 → 07-02 — the redesign era deletes its own scaffolding

Four removals in eight days, all deliberate, all argued in their commit
bodies. `b4c217d` (batch **41.28** — the Schedule, not the chores
rebuild) applied migration 0036 and dropped the `timeline_items` view
and `chore_runs` table once `commitments` subsumed both. `c72c676`
(42.3) deleted split-block: "F53 resolved as drop… per-row Edit covers
the rare move." `54dc41b` (42.4) deleted `CoverSheet` for block-level
`NeedsCoverCard` ("one write to resolve") and in the same commit
**retired reflow auto-seeding** under an explicit NO-LEGACY heading —
the engine stopped filling project gaps, `useScheduleReflow` and
`reflowBridge` went, Projects lost its stale strip and auto-sync toggle,
and an explicit "Add next task — <step>" quick-add replaced the
automation.

The rethinker pool was built to be thrown away, and was: `3b532ca`
(06-28) ported every mockup component into `RethinkerKit` plus a
`/rethinker` gallery so each could be mapped onto the Schedule;
`aa37e6e` (06-30) deleted the kit, the gallery route, `DayRibbon` and
`WeekSpines` once the mapping landed (m5, "port-the-pool step, then
map"). `ad39cd3` swapped `personLoad` for `farmLoad` the same week.

`HereStrip` is the odd one. The who's-here count strip was built, shown
in the 07-02 walkthrough, and reverted **inside the single commit**
`3148879` (42.7), whose body records "built, reviewed… and reverted the
same day — the presentation goes to a design bracket; the engine keeps
the segment math for its successor." No version of it was ever
committed.

One more artifact from this stretch deserves a line, because it is a
parked *process* rather than a parked feature.
`docs/history/records/remix-propagation-tour.md`
(2026-06-30) is a guided page-by-page tour of the app-wide design remix
across `9290268`→`cbfea96`, written with an honest admission — "I
haven't seen them rendered" — and a named remaining tail: the Rounds
takeover, `ChoreFieldsEditor`'s `editInputStyle` inline-style holdout,
and the component layer. The holdout is since closed (`95a7a6b` retired
the idiom), the design language now lives in `public/style-guide/`, and
the tour doc is on H3's deletion list. What has never happened is the
eyes-on review it was written for.

### 2026-06-28 — an audit round the dossiers record as untriaged

The June-28 walkthrough logged 80 findings across five clips, Schedule
and app chrome only (`audits/2026-06-28/findings.md`). Memory and m4 §1e both call this bucket UNTRIAGED. The
repo says otherwise: `triage.md` in the same directory records a
same-day triage with James, six named buckets, and a PROGRESS log of
three fix sessions (~20 `fix:` commits, `06874a0`…`1f8d523`) closing
every FIX NOW group A–E. See Current state for what is actually left.

## Current state

Verified against the repo, the migration chain, and production
(read-only) on 2026-07-29.

Shipped and live, listed here only because it started in this chapter:
**Inbox capture** — `inbox_items` + `inbox_item_reads` on prod (2 rows),
global `ThoughtCapture` in the top bar, `InboxBell`, `Inbox.jsx` with
pinning/archive/drag-order/read receipts, promote-to-event and
promote-to-project. Missing only promote-to-chore.

Never built — nothing in the codebase:

- **Quote/artwork rotation + unlock gallery** — no code; no
  `user_content_unlocks` on prod. Spec *and* dataset are tracked and
  complete at `docs/specs/quotes-and-artwork/` (44 quotes / 54 artworks
  / 48 people, counts verified); `ROADMAP.md:4941` points at that path.
- **Farm-update publishing / blog** — no editor, publish path, Fastmail
  or Meta wiring. Vestigial substrate: `public.updates` exists on prod
  and is **empty**, feeding a dashboard pane that can only ever show an
  empty state. The audience is real — `customer_lists` holds one row
  ("Mailing list… seeded from the egg drop / farmers market contact
  list") with **65 members** in `customer_list_members`.
- **Batch 30 commerce integrations** (`ROADMAP.md:3190`) — Stripe,
  QuickBooks, Shippo live labels, Venmo deep-link/QR: nothing wired.
  `docs/integrations-and-credentials.md` holds the setup order.
- **Batch 31 GCal push** (`ROADMAP.md:3203`) — dead schema: `gcal_pushes`
  (0013, `occurrence_id` PK) exists on prod and is **empty**; nothing
  has ever written it. Two-way sync still deferred behind push-only.
- **Batch 32 social/blog** — no code. Instagram needs Meta App Review;
  the CMS decision is settled, the Hugo-vs-JS question is not.
- **Pasture rotation planner** (Batch 37) — no code, no geometry editor.
  Spec at `docs/specs/pasture-rotation-planner.md`; the `placements`
  substrate it was re-pointed onto *does* exist (migs 0039/0040), so
  this is now an additive build, not a new subsystem.
- **YoLink / ntfy** — zero hits for `ntfy`, `yolink`, `yosmart` across
  `src/`, `scripts/`, `netlify/`, `supabase/`, `package.json`. ntfy is a
  true path-not-taken: push shipped via web-push/VAPID through
  `netlify/functions/` (mig 0011) instead.
- **Mileage tracker** — no `mileage_logs` on prod; no vehicle records.
- **Event time footprint** — partially *superseded*, not unbuilt.
  Batches 41.21/41.29 shipped buffers as first-class commitments
  (`src/lib/schedule/buffers.js`, BD22/BD23: a buffer is a reservation
  bound to an activity, with side + length + optional setup/cleanup
  checklist, plus templates) — a better shape than the original
  event-kind-defaults design. But there are no
  `setup_min`/`breakdown_min` columns and **no travel-time, leave-by,
  arrive-home or post-event-work modeling at all**.
- **Lessons module** — no table, no page, no code.
- **Per-row detail routes for customers/products/orders** — still
  absent. `src/lib/router.js` deep-links batches, projects, project
  attachments and places only; `useSearchIndex.js:113` and `:146`
  comment the gap ("no per-customer route yet", "no per-order route")
  and send every such hit to a list page.
- **Bookmarking** and **voice control** — cut, numbers retired, no
  `user_bookmarks` on prod; reasoning kept at `ROADMAP.md:4797`/`:4804`.

Shipped, then deleted — each recoverable from the parent of its
removal commit:

- `chore_groups` + `chore_group_members` + Groups tab — removed
  `b37ed73`. Files: `ChoreGroupsTab.jsx`, `useChoreGroups.js`. The
  DDL is *not* in the migration chain (0008 was amended in place; its
  header lines 7–10 record the retirement). Original DDL:
  `f734bb4:supabase/migrations/0008_…sql:64` and `:107`. Tables absent
  from prod.
- Spaces page + `space_kinds`/`space_items` — removed `acfd246`
  (`src/pages/Spaces.jsx`, plus the `.spaces` block in
  `nff-data.json`); DDL amended out of 0003. Tables absent from prod.
- `RecordsDrawer` — removed `0b4d003`.
- `SplitBlockSheet` + `doSplit` plumbing — removed `c72c676`.
- `CoverSheet` — removed `54dc41b`.
- Reflow auto-seeding: `useScheduleReflow.js` + `reflowBridge.js` —
  removed `54dc41b` (`reflow.js` kept the ranked queue).
- `HereStrip` — **not recoverable.** Built and reverted inside
  `3148879`; only the ROADMAP note survives.
- `/rethinker` pool: `RethinkerKit.jsx`, `RethinkerGallery.jsx`,
  `DayRibbon.jsx`, `WeekSpines.jsx` — added `3b532ca`, removed
  `aa37e6e`. `personLoad.js` removed `ad39cd3`.
- `timeline_items` view + `chore_runs` table — created 0013
  (`4426f79`) / 0009 (`82fe686`), dropped by migration 0036 in
  `b4c217d` (batch 41.28, Schedule). Both absent from prod.
- Also in the ledger, outside this chapter's scope: `DetailModal`
  (`ce04214`), `AllEvents` + `EventKindPage` (`275a9e8`, `371db5f`),
  `SearchSelector` (`a1835de`), the StyleGuide iframe page
  (`81fdc89`), `primitives.jsx` (`0efc7b5`).

The 2026-06-28 audit bucket, correctly:

- FIX NOW groups A–E: **closed** across three sessions
  (`triage.md` PROGRESS; ~20 `fix:` commits).
- Greenlit big builds, still open: **F30** remove "Anytime" —
  partially delivered (user chores now require a block, `1d1ad4a`),
  but the concept survives as a live fallback — `ScheduleEditSheet.jsx`
  line 142 still offers an "Anytime" option, and `BlockBadge.jsx:44` /
  `weekView.js:29` still name orphan buckets that way. **F48**
  chore-rethinker must/should/optional mockup and **F49** global chore
  ordering + place sub-grouping: untouched.
- Design pass, still open: F5, F7, F11, F21, F31, F32, F33, F36, F39,
  F44 (06-28 numbering) — all re-bucketed into one visual iteration,
  which is the same set m5 identifies as the rethinker arc's never-run
  **Phase 4**.
- Feature backlog (~20 findings, e.g. F14 Week/Month/Review on mobile,
  F27/F67 buffer rework, F55/F64 per-instance rename) and four VERIFY
  items (F13, F50, F59, F80) needing a real device: open, unscheduled.

## Unresolved threads

The revive-or-kill list, decisive by design.

1. **Hugo vs JS framework for the public site** — DECIDE FIRST. Not a
   batch, a prerequisite: `f2e08f7` asked for an architecture session
   before any publishing or storefront work, and e-commerce is the
   forcing function. Nothing customer-facing should start before it.
2. **Quote/artwork rotation v1** — REVIVE, cheap. Spec + dataset done
   and tracked; ~4 h plus one curation pass. Best delight-per-hour
   item in the repo.
3. **Unlock gallery v2** — DEFER, don't kill. One small table, but
   only meaningful once v1 has run for a few weeks.
4. **Farm-update publishing** — REVIVE inside the e-commerce arc. The
   65-contact list is real and idle; the email half is blocked on
   nothing, the site half on thread 1.
5. **Blog review pipeline (dashboard-as-CMS)** — KEEP AS DESIGNED,
   sequence after thread 1, and consider shipping plain drafts + the
   three gates before the PR-emulation review layer.
6. **Batch 30 integrations** — SPLIT. Stripe (or PayPal/Braintree if
   real Venmo acceptance is wanted) goes with e-commerce; Shippo live
   labels ride the already-Shippo-shaped shipment model; QuickBooks is
   independent and can wait indefinitely.
7. **Batch 31 GCal push** — KILL. Deferred four times in three months
   and never once missed; `gcal_pushes` is empty dead schema. Retire
   the number and drop the table in a new migration.
8. **Pasture rotation planner** — REVIVE, re-scoped small. With
   `placements` in place, v1 can be a GeoJSON upload plus a
   tractor-capacity calculator and no canvas at all; the drawing
   surface is the expensive half and not the value.
9. **YoLink sensors** — REVIVE small. Coop temperature thresholds into
   the existing web-push path; the API reference is already offline in
   the repo.
10. **ntfy** — KILL. Web-push/VAPID shipped and works; the guide is on
    H3's deletion list.
11. **Event time footprint** — SPLIT. Buffers already cover
    setup/breakdown better than the original design; post-event work
    modeling is the cheap next slice; live travel-time/leave-by costs a
    maps key, a scheduler, and the per-event data audit James owns.
12. **Mileage tracker** — REVIVE as the smallest possible thing: one
    table, one page, an annual total. The only item here with a direct
    dollar return. Kill the vehicle-records/maintenance tail.
13. **Lessons module** — DECIDE. Twelve weeks untouched: commit to
    phase 1 (capture + browse + tags, no auto-surfacing) or move it to
    the Graveyard, writing the two seed lessons down first.
14. **Per-row detail routes (customers/products/orders)** — REVIVE
    with e-commerce; the search index already knows every row, and
    order/customer detail is table stakes for fulfilment.
15. **Promote-a-thought-to-chore** — REVIVE, tiny. The last missing
    third of a shipped feature (`ROADMAP.md:5107`).
16. **Bookmarking / voice control** — STAY DEAD. Both cut for reasons
    that still hold; voice's real successor is the MCP agent.
17. **06-28 F30/F48/F49** — SCOPE AS ONE ARC. Greenlit together for a
    reason: chore display, ordering, and the death of "Anytime" are one
    model change. F30 is half-done, which is the worst state.
18. **06-28 design-pass set = rethinker Phase 4** — DO IT ONCE, AS A
    SYSTEM PASS. Non-negotiable per m5: a per-finding colour list was
    tried (`afa484a`) and reverted (`58d3942`) for fighting the design
    system. Time-sensitive — Jim is learning the app now, and the
    07-02 audit's F11 warns late colour changes fight learned habits.
19. **06-28 feature backlog + VERIFY items** — TRIAGE ONCE against
    current `main` first (deploy-lag rule: some may already be fixed).
    The four VERIFY items need a real phone, not an emulator.
20. **The design remix's unreviewed pages** — SCHEDULE A LOOK. 20 page
    surfaces were restyled and never viewed; fold the review into the
    Phase 4 pass (thread 18) rather than resurrecting the tour doc.
21. **Resources rethink** — CONFIRM DEAD. Absorbed by the place model;
    text survives only in `dadeb03^:ROADMAP.md`. Worth one Roadmap-v2
    line, because nothing else records the absorption.

## E-commerce relevance

Four of these parked ideas are not adjacent to the e-commerce arc —
they are inside it, and the arc has to un-park them.

**Hugo vs JS is the arc's first blocker.** `f2e08f7` named e-commerce
itself as the forcing consideration ("the site redesign brings a big JS
surface") and asked for a site-redesign architecture session before
building. Storefront, catalog publishing, farm updates and blog all
inherit the answer; deciding late means building twice.

**Farm-update publishing is closer than it looks.** The arc needs a way
to tell 65 existing contacts that ordering is open — and that audience
has been sitting on prod since 2026-06-02, seeded explicitly for the
Batch 32 blast, next to an empty `updates` table and a dashboard pane.
Missing: an editor, a Fastmail SMTP path (or a transactional provider —
the handoff names candidates), and the site publish. Note the split:
the **email** half is not blocked on the site architecture at all.

**Catalog publishing has never had a batch at all.** m1 §4 quotes the
gap from `6bda622`: "E-comm publishing of the catalog has no batch
yet." The internal halves of commerce are built and styled (products,
pricing with history and cost floors, inventory lots, POS, orders,
Shippo-shaped shipments); the external half — anything a customer sees
or pays through — exists only as Batch 30 intent. That is the largest
unscheduled item the arc inherits, and per-row detail routes (thread
14) are its immediate prerequisite for fulfilment work.

**Markets and travel-time are the arc's operational constraint.** A
storefront does not replace three weekly markets and six pop-ups
(`docs/ecommerce/markets-and-popups-2026.md`) — it competes with them
for the same inventory and the same two people's hours. The
event-time-footprint entry is where that cost gets modeled, and it says
it plainly: a market costs more than its hours. Buffers reserve
setup/breakdown; travel-time and arrive-home do not exist, so the
schedule still understates market days, and the mileage tracker is the
money-side twin of the same question. All three want the same geocoded
event endpoints — and if the arc adds delivery routes or pickup
windows, its maps key is the one travel-time has been waiting on. Buy
it once.

Two constraints bind from elsewhere: the colour-identity overhaul
(thread 18) should land **before** customer-facing surfaces or they get
restyled twice, and those surfaces should inherit
`public/style-guide/DESIGN-SYSTEM.md` plus `src/components/ui.jsx`
rather than invent a vocabulary.

Not relevant, for the record: quote/artwork rotation, unlock gallery,
Lessons, YoLink, ntfy, GCal, pasture rotation, bookmarking, voice.
