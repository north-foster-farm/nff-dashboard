# Surfaces — Overview, Metrics, Now

The cross-feature screens: the Dashboard and its glanceables, the Now
surface, the Metrics page, the in-app "What's coming" roadmap, and the
navigation chrome all four hang off. Evidence: m1 §1.13 (spine), §1.4
(Now), §1.6 (Metrics), m2 §3 (renumbering), m4 §1b–1c (audits).

Disambiguation: `batch 41` alone is the chores rebuild; `batch 41.N` is
the Schedule feature. Batch numbers are as-shipped (m1 §2). Every
F-number carries its audit round's date.

## Evolutions

**2026-05-04/05 — the dashboard *was* the app.** Batches 1–6 are all
surfaces batches, and they built the shell everything else hangs off.
Batch 1 (`7859209`, v0.9.0-alpha, ROADMAP.md:64) moved logout, theme
and avatar into the top bar, added the weather widget and date, created
the "Planning" sidebar group, replaced scattered empty states with
`ComingSoon`, and renamed the cards to the names they still carry
("Today's schedule" → "Schedule at a glance"); the premise that polish
is front-loaded so nothing gets built twice was argued out the same day
(ROADMAP.md:1–40). Batch 3 (`c827eb1`, ROADMAP.md:124) then replaced
the segmented events/chores layout with **one chronological timeline**
interleaving events, chore-period rollups and active projects, plus a
seven-day "Upcoming events" tail — the direct ancestor of the Schedule
feature, which later did properly what this card attempted in
miniature. Batch 4 (`773bd15`, ROADMAP.md:159, migration 0007) made the
activity feed trustworthy — check/uncheck within 10s cancels out at the
trigger, and two ownership-checked `SECURITY DEFINER` RPCs allow inline
edit/delete without opening RLS.

**2026-05-05 — prefs, groups, sticky notes, and the in-app roadmap.**
Batch 5 (`f734bb4`, ROADMAP.md:210, migration 0008) landed
`user_preferences` (theme + density follow the user across devices,
localStorage demoted to a fast-paint cache), `chore_groups` +
`chore_group_members`, and chore sticky notes (`chore_messages`) with a
top-bar bell for unaddressed ones. Two days later batch 10 (`b37ed73`)
**retired `chore_groups`** — tables, hook, tab and the auto-expand pref
— and 0008 was amended in place under the pre-production rule; its
header records the removal. Sticky notes and the bell survived. Batch 6
(`12b40c1`, ROADMAP.md:191) added "What's coming", a hardcoded
plain-English mirror of `ROADMAP.md`, inserted as a *new* batch 6 — the
first of six renumberings (m2 §3). Its contract was explicit from day
one: prune an item as the batch delivering it ships.

**2026-05-31/06-01 — the farm-map workshop redefines "landing", and
the Dashboard is demoted.** Two workshop decisions are surfaces
decisions: phones land on Now, desktop on the map (m1 §1.4; m2,
2026-05-31). Batch 17 (`b21e892`, ROADMAP.md:1359) built Now as a
time-anchored phone screen — a fat start-rounds CTA off the same
`nextBlock` logic Rounds uses, a farm-wide due/overdue list from the
`place_status` projection, and the workshop's D2 requirement, a loud
round-in-progress resume bar. Desktop still landed on the Dashboard
(ROADMAP.md:1391) until batch 18.2 (`b1e2a81`, ROADMAP.md:1571)
slimmed the sidebar to Now · Farm map · Dashboard, moved every pure
record group to a `RecordsDrawer` off the avatar, dissolved the
Resources flyout, and made the map the desktop landing
(ROADMAP.md:1585). The Dashboard stopped being where anyone arrives.

**2026-06-01/02 — sticky nav killed, then nav restructure #2 reverses
#1.** `328db1a`: the pinned TopBar (h-screen root, inner-scrolling
`<main>`) misbehaved on iOS — viewport-height jumps, scroll chaining —
so the chrome now scrolls away with the content; the commit reserves
the right to bring a proper sticky header back "once the iOS scroll
issues are understood", and never did. Then `0b4d003` deleted
`RecordsDrawer.jsx` and put Products, Sales, Animals, CRM,
Communication and Resources back in the left sidebar at James's
request, sent the avatar to Settings, and gave the hamburger a
desktop job (collapse the sidebar). Both structures used the same
section ids, so deep links survived the round trip. The same window
hardened Now: place-grouped rows (`8a798a3`), **overdue-only**
(`6d867cd`), checkbox-only rows with an Undo toast and the date in the
heading (`0b4d003`), phone badge overlap (`acd5d17`). Overdue-only is a
model choice, not a filter — due-but-not-overdue chores belong to a
round that hasn't ended, so the round button already covers them
(`src/pages/Now.jsx:32-35`).

**2026-06-02 — Metrics arrives; the Heads-up lane dies.** Batch 26.2
(`e48d90d`, ROADMAP.md:2134) added Metrics as a fourth top-level
surface — broiler and layer cross-batch comparison sheets plus the
metric-definitions registry seeded in 0023 — and put
`BroilerWeeksCard` on the Dashboard, the stat James's dad watches day
to day. Batch 27.5 (`94d38fb`, ROADMAP.md:2378) retired the
Dashboard's automation lane; firings moved to the bell, which now
aggregates three streams (automation emissions, unaddressed chore
notes, unread inbox thoughts).

**2026-06-04 — the first audit puts the Dashboard on notice.** Clip 3,
2026-06-04 numbering: F14 strips current conditions,
schedule-at-a-glance, active projects, activity, open orders and farm
updates as unearned; F15 proposes the opposite of today's split — fold
Now *into* the Dashboard; F18 moves the sunrise readout into conditions
(`audits/2026-06-04/findings.md:229-296`). None was applied (m4 §1c).

**2026-06-30 — the rethinker remix reaches the Dashboard.** The Round 3
brief named it one of four surfaces to rebuild — "'schedule at a
glance' with the dynamic day-load read"
(`docs/workshops/design-bracket/examples/harvest-remix/`
`ROUND3-BRIEF.md:39`). `aa37e6e` wired it in place (no-legacy, no V2
page): a phone-only `TodayGlance` reading the single `farmLoad` model,
`Card` → `Pane`. Refined by 42.3 (`c72c676`) and 42.4 (`54dc41b`).

**2026-07-02 — the verdict, not yet executed.** F30, 2026-07-02
numbering (`.ignored/audit-v2/audits/2026-07-02/findings.md:251-257`):
weather icon into the top toolbar with a click-to-expand conditions
card, capture the fold-out pattern in the design system, find the
broiler mini-tracker a home — and "Dashboard has been superseded and
will probably go away". Farm map and Metrics are "on hold"; the Now
screen is "good as-is". Queued as batch 42's Phase 4 beside the F23
caching work (m4 §"Batch 42 / current arc" #11); the arc stopped first.

## Current state

Verified against `src/` at v0.10.99-alpha.

**Landing split — real, and boot-only.** `App.jsx` sets `PHONE_QUERY =
"(max-width: 639px)"`; `defaultPath()` returns `/now` on phones and
`/map` elsewhere, and the `home` route replaces itself with it. Not
reactive: a rotation or a resized window never re-lands you.

**Nav.** One source of truth, `SECTIONS` in `src/sections.jsx`.
Ungrouped head Now · Farm map · Dashboard · Metrics; then Planning
(Schedule, Availability, Calendar, Events, Chores, Do rounds, Projects,
Processes); then the record groups restored by `0b4d003` (Products,
Sales, Animals, CRM, Communication, Resources); then Other last (Inbox,
Proposals, What's coming, Style guide, Activity, Observations, Notes,
Threads). Desktop gets a fixed 200px sidebar collapsible from the
hamburger, state in `sessionStorage` (`src/lib/router.js:212`); phones
render the same component as a fixed overlay drawer. Events is the only
`flyout` (children are Schedule filter presets), Rounds a `takeover`,
Style guide `external`, Settings `hidden`. The top bar is hamburger,
logo (→ `defaultPath()`), "Admin · v{meta.version}", search, outbox,
thought capture, bell, avatar (→ Settings) — no weather, date, theme or
sign-out since `0b4d003`, and not sticky.

**Overview (nav label "Dashboard").** Phone-only `TodayGlance` (date +
temp, `NowRule`, a needs-cover `AttentionCard`, a `LoadSpine` day-load
off `farmLoad`, "Open Rounds"), then the desktop grid: row 1 Upcoming
chores | (Current conditions, Broilers, Schedule at a glance); row 2
Active projects | Open orders | In-progress farm updates; row 3
Activity (10 rows + "View all"). Against the 2026-06-04 audit: **every
F14 item is still on the page**, and the sunrise pill F18 wanted moved
still tops Schedule-at-a-glance. F17 *is* structurally fixed — rollups
read live `chore_blocks` via `useChoreBlocks` → `ruleOpts`. F16 is
still reachable: `isActiveProject` (`src/lib/projects.js:24`) counts a
project with neither `startedAt` nor `targetDate` as active, so an
undated project renders "All day" today. The farm-updates rows still
call `alert("Open … — not implemented.")`
(`src/pages/Overview.jsx:961`), invisible only because `data.updates`
is `[]`.

**Does Overview still earn its place? On the code, no.**
`TodayScheduleCard` rebuilds a day timeline from `getEventOccurrences`
+ `rollupChoresForDay` + `isActiveProject` — a second, older derivation
of exactly what the Schedule derives through `farmLoad`/`deriveDay`,
which the same page's `TodayGlance` already uses. One screen carries
two generations of the same read, and its overdue signal duplicates
Now. What it uniquely holds is narrow: current conditions, the broiler
weeks-to-processing tracker, the since-yesterday activity window, the
sunrise countdown — and F30 (2026-07-02) already assigns the first to
the header and flags the second as homeless. Nothing lands on the page,
and the chrome has forgotten it exists: `NotFoundPanel`'s button reads
"Back to the dashboard" but navigates to `defaultPath()`
(`src/App.jsx:234,303`).

**Now.** A 640px column: "Now · <date>" plus the outbox indicator; then
the loudest thing on the page — `ResumeBar` when a run is live on any
device (Stop cancels), else `StartRoundCta` for `nextBlock`, else an
all-done / no-blocks notice. Below it `NextProjectCard` (top-ranked
project's next incomplete step via `rankedStepQueue`, added in the
reflow arc, `b91fa59`), the place-tree-grouped overdue list collapsed
behind a count (F133, 2026-06-04, `3a0477a`), and undo toasts. Still
overdue-only.

**Metrics + What's coming.** Metrics is three read-only sections —
broiler comparison, layer comparison, definitions registry — with all
math in `src/lib/metrics.js` and "cuts ordered" reading real inventory
lots (batch 28.1). `src/pages/Roadmap.jsx` is 12 hardcoded items whose
prune-on-ship contract has lapsed: it still advertises "Orders"
(shipped as 29.1–29.3), "The big audit" (39.1/40.1 plus four
walkthrough rounds), "iPhone-friendly" (batch 35 — the `InstallPrompt`
it promises is mounted in `App.jsx`), and "App-wide search" (cmd-K
shipped as batch 33; only its Postgres full-text index is outstanding).

**Adjacent facts.** The Activity page is an uncapped mirror of the
dashboard card over the same `ActivityRow`. Sticky notes are
chore-scoped (`chore_messages`, `ChoreMessageButton` + bell) and have
nothing to do with the "Notes" nav entry, which is a stub —
`data.notes` is `[]` so it falls through `SectionContent` to
`ComingSoon`, as do Farm updates and Content calendar; with
`resources_equipment` that is four nav entries leading nowhere. User
preferences are theme, density and the two schedule-reminder fields;
`auto_expand_chore_groups` is gone from both hook and migration 0008.

## Unresolved threads

- **Decide the Dashboard.** F30 (2026-07-02) says it "will probably go
  away"; F15 (2026-06-04) proposed the opposite merge. Pick one, in
  writing, before anything else touches `Overview.jsx`. Retiring it is
  also the cheapest way to delete the app's duplicate day-timeline
  derivation.
- **Rehome what only the Dashboard has, in order:** current conditions
  → top-bar icon with a click-to-expand card (F30 — and capture the
  "0 of 2 fold-out" pattern in the design system); the broiler
  weeks-to-processing tracker (F30: "needs a home eventually" —
  candidates are Now, the species page, Metrics); the since-yesterday
  activity window; the sunrise countdown (F18, 2026-06-04, wants it
  inside conditions).
- **If it survives, apply F14 (2026-06-04) as written:** drop active
  projects and activity, strike open orders and in-progress farm
  updates. The `alert()` at `src/pages/Overview.jsx:961` must go either
  way — it is the page's only unimplemented action.
- **F16 (2026-06-04) is a live bug**, not a design question: undated
  projects render "All day" today wherever `isActiveProject` gates a
  day view. Fix in `src/lib/projects.js` with a test, since Overview
  and the sidebar badge share the selector.
- **Refresh or retire "What's coming".** Four of twelve items have
  shipped. Re-establish the prune step in the per-batch checklist, or
  generate the page from `ROADMAP.md` so it cannot drift.
- **Four nav entries lead to `ComingSoon`** (Notes, Farm updates,
  Content calendar, Equipment). Build, hide, or delete — a nav that
  lies is worse than a shorter nav.
- **Sticky chrome is still open** (`328db1a` removed it wholesale
  pending an understanding of the iOS scroll behaviour), and **the
  landing split never re-evaluates** — decide whether boot-only is
  deliberate or a latent surprise at tablet widths and on rotation.
- **Metrics is on hold by James's own call** (F30, 2026-07-02) with no
  walkthrough coverage since clips 4–5 of 2026-06-04 (F28–F42), which
  include undecided design calls F32/F33/F34 — metrics overflow,
  sidebar width, main-pane cap (m4 §"Design calls flagged at capture").
- **F23 (2026-07-02) caching** is a surfaces problem as much as an
  infra one: the flash of stale content on navigation and the ~5s
  Schedule recompute are what every glanceable feels like today. No
  visual QA pass exists for the batch-42 surface work either
  (m4 §"Batch 42 / current arc" #13).

## E-commerce relevance

Real but narrow, and it resolves to a decision rather than a build.

- **The open-orders glanceable exists and is already contested.**
  `OpenOrdersCard` counts `open` + `ready` orders, and the sidebar
  Orders badge uses the identical selector (`src/sections.jsx:108-109`)
  so the two can never disagree. F14 (2026-06-04) struck the card as
  unearned *because the data was empty* — a real order stream reverses
  that premise. The storefront arc does re-open the question, but it
  must be answered inside the Dashboard-retirement decision above, not
  around it.
- **If the Dashboard dies, the sales glanceable needs a destination.**
  Now is the surface James endorsed ("good as-is") and it is
  phone-first, which matches market-day use; the Schedule day already
  carries market, delivery and pickup events. Neither carries money
  today. Do not add a third parallel day-derivation to hold it.
- **Metrics has no revenue view** — its only money-adjacent columns are
  projected feed cost and "cuts ordered" off inventory lots. Margin or
  sell-through reporting means extending the pure, tested
  `src/lib/metrics.js`, not computing in the page.
- **The comms stubs are e-commerce-adjacent placeholders.** Farm
  updates and Content calendar hold sidebar space for the unbuilt
  publish-to-site-plus-email pipeline (m1 §1.14) — the pipeline a
  storefront wants for announcements. Decide their fate with the
  storefront, not before it. Same for "What's coming", the closest
  thing to customer-facing copy in the app: prune the four shipped
  entries before adding e-commerce ones, and apply the product-UI
  voice standard.
