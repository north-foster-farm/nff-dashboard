# Schedule & events

The heaviest feature in the app and the one that changed shape most. It
starts as a read-only card, grows an RFC 5545 event model and a
four-view calendar, then gets reframed — in a single workshop — as
something the calendar was never trying to be: a **day-atomic
commitment layer** the two operators agree to each morning. The event
model survives that reframe intact underneath; the calendar survives it
too, renamed.

A naming hazard first, because it poisons every other source: **`batch
41` alone is the chores rebuild** (`b0ff48f`, 2026-06-04); **`batch
41.N` is the Schedule** (`e6668c0` onward, 2026-06-24) — the number was
reused ten days later against a different feature (m2 §1). Batch
numbers were renumbered six times overall (m1 §5); the only
trustworthy mapping is the as-shipped table at m1 §2, cited throughout.

## Evolutions

### 2026-05-04 — "schedule glance" is in the founding brain dump

Round 1 of the two requirement dumps that produced the original
22-batch plan already names a *schedule glance* (m2 §1 "Era 0",
recorded in `4a8ed2c`; the dump text lived outside the repo at
`~/.claude/plans/i-want-to-make-cozy-kitten.md` and is now lost —
that directory is empty as of 2026-07-30). Batch 3 shipped it as
an Overview card (`c827eb1`, v0.9.2) — a glanceable read with no model
behind it. Everything below is that card growing a spine.

### 2026-05-06 — the Events overhaul workshop: RRULE from day one

The second of two four-agent design workshops that day (the first was
Chores) inserted an Events overhaul as Batches 11–14, renumbering
11–27 → 15–31 (`9aff149`; m2 §1). Source of truth was
`~/.claude/plans/events-overhaul-v1.md` (**now lost** — that directory
is empty as of 2026-07-30). The workshop prompt and James's verbatim
requirements survive, promoted to
`docs/workshops/scope-workshop/examples/events/workshop-prompt.md`; the
visual was
`docs/workshops/design-bracket/examples/calendar-rail-mockup.html`,
the repo's earliest
mockup artifact and still cited by the Design Bracket playbook as the
archetype of a standalone HTML mockup.

Three decisions in that one commit outlived the feature. "Chore Doer"
became **Rounds**. A mileage tracker was parked (still unbuilt, m2 §2).
And two-way Google Calendar sync was split: *push-only* folded into the
overhaul, the standalone entry repurposed as "two-way GCal sync
(deferred)". Push-only then failed to ship in the overhaul either —
deferred mid-batch at `fd1cd2d` (Batch 19) to a Batch 31 never built.
At HEAD nothing GCal has ever shipped; only the `gcal_event_id` column
and the schema-only `gcal_pushes` table remain
(`0013_events_foundation.sql:21`).

### 2026-05-08 — the event model (13.1, 13.2)

`4426f79` (batch 13.1) is the load-bearing commit of the events half.
Migration 0013 creates the model still in use today:

- `event_series` — one row per recurring or one-off event, carrying an
  **RFC 5545 RRULE** string (`rrule=NULL` for one-offs) plus a
  `season_window` mirror so a future "every year May 14 → Sept 21" can
  attach a yearly rule without an `UNTIL` cap.
- `event_occurrences` — **materialize-on-touch**: a row exists only
  when an instance is edited, moved, or cancelled; unedited instances
  expand from the rule at read time.
- `event_links` — polymorphic links from an event to anything else
  (the shape later reused for `project_links` and `commitments`).
- `automations` + `gcal_pushes`, schema-only.
- `timeline_items`, a SQL view meant to be the app's one day timeline.

`src/lib/recurrence.js` was rebuilt on the `rrule` library in the same
commit, which also converts every legacy `event_instances` row (0005)
into a series + occurrence, mapping the old
`{dayOfWeek, startTime, seasonStart, seasonEnd}` jsonb into
`FREQ=WEEKLY;BYDAY=…;UNTIL=…` (`0013_events_foundation.sql:286`).
`ce04214` (13.2) added `EventEditor` with `RecurrenceEditor`, the
`EventScopePrompt` (this / this-and-following / all) and `splitSeries` —
the Google Calendar edit-scope pattern, adopted as a resolved thread
(`src/data/nff-data.json`, `thread_chore_edit_scope_ux`).
`DetailModal` was deleted here (m1 §5).

### 2026-05-08 — the calendar (14.1, 14.2)

`275a9e8` (14.1) built the four-up Day / Week / Month / Agenda views
with a time rail banded by chore blocks and a click-to-type date
header; `AllEvents.jsx` was deleted because Agenda subsumed it.
`371db5f` (14.2) added drag-to-reschedule and resize, click-empty to
create, a conflict-dot lint, and collapsed the per-kind pages into a
sidebar flyout (`EventKindPage.jsx` deleted), plus the Processing
workspace. The events-overhaul *tail* — triggers and animal lifecycle —
had already been pushed to 19–20 by the Farm Map insertion (`dadeb03`).

For six weeks this was the whole answer: the calendar page was called
**Schedule**, the Overview card summarized chores separately, and the
`timeline_items` view was never consumed by anything.

### 2026-06-03 — the footprint idea that got parked

`14663e7`, expanded by `38aeedd`: events should carry travel-to /
setup / breakdown / travel-home buffers, with a "leave by" on Now and
buffers that block chores; the second commit upgraded typed minutes to
**live predicted-traffic lookups** at creation / T−1d / T−3h / T−30min,
pushing an alert if leave-by shifts. Still unbuilt at HEAD (`ROADMAP.md`
~4847). Batch 41.21 later shipped the *market buffer* slice
(`c2f8460`) but never the travel model, which needs a maps key and was
labelled "Batch 30 territory" (m1 §4).

### 2026-06-24 — the reframe: Schedule as the commitment layer

This is the pivot. Between 06-04 and 06-24 the roadmap went quiet
(m2 §1 "second gap") while two things happened off-file: the 138-finding
walkthrough audit, and a full **Scope Workshop → Scope Document →
Design Bracket** run on the Schedule — the canonical example of the
method, now tracked at
`docs/workshops/scope-workshop/examples/schedule/` and
`docs/workshops/design-bracket/examples/schedule/` (the Scope Document
is literally the same file in both, per `docs/workshops/README.md`).

The diagnosis (`ROADMAP.md:3418`): a **missing layer between chores,
which are generative, and the calendar, which is temporal** — a
day-atomic plan that auto-composes chores + projects + events into one
*draft* the operators *confirm*. Five results mattered:

- **Derive-and-diff, unanimous across lenses.** The live day is never
  persisted; it recomputes every load from chores/events/projects plus
  *sparse* placement deltas
  (`docs/specs/versioned-capture-substrate.md` §3).
- **One timeline, three zooms** (Reframer's merge, Q2). Schedule and
  Calendar collapse conceptually into one commitment timeline with
  day/week/month zooms; "Calendar" is that timeline filtered to
  event-kind commitments — which resolved Dad's "two surfaces, one
  word" objection (same doc, §4).
- **Physical generalization over a read-model union** (Q3-impl):
  `chore_runs` *becomes* `commitments` rather than a view unioning the
  two. The design note records this as James overruling its author's
  own recommendation (§5 sub-decision 3).
- **A reusable versioned-capture substrate** (Q7+), not a one-off
  snapshot table — durable records must outlive a codebase on
  no-legacy footing.
- **The single-open accordion** as the visual answer (Design Bracket
  winner, Minimalist; `ROADMAP.md:3429`).

### 2026-06-24 — the MVP in five sub-batches, in one day

All five shipped 2026-06-24, `v0.10.42` → `v0.10.46`:

- **41.1 `e6668c0`** — migration 0029 creates `commitments` as a strict
  superset of `chore_runs`: a `source_type` discriminator
  (`chore_block` only at first), a `source_ref` jsonb pointer, placement
  (`run_date`, `block_id` *or* `clock_time`, `assignee`), the "pact"
  (`reason` = why today, `protected`, `overrides`), and the execution
  columns folded from `chore_runs` **under their original names** so
  the run-lifecycle code repointed with a table name plus a filter and
  zero field mapping (`0029_…sql:26`). Every `chore_runs` row copied
  uuid-preserving; the two inbound FKs
  (`chore_run_participants.run_id`, `activity_log.run_id`) repointed;
  the old table left orphaned on purpose.
- **41.2 `a393e88`** — migration 0030: `capture_schemas` + `captures` +
  a `SECURITY DEFINER` `record_capture` RPC validating with
  `pg_jsonschema`, with client-side `ajv` as the first gate. First
  registered schema: `schedule.confirmed_day` v1.
- **41.3 `f03569b`** — `src/lib/schedule/deriveDay.js`, the one
  client-side day assembler. `useTimelineItems` was deleted here, which
  is what made the 0013 view dead.
- **41.4 `f712c14`** — the accordion Today view, and **the vocabulary
  settlement**: the old events page became `Calendar.jsx` at
  `/calendar`, freeing the word — "the new accordion owns **Schedule**"
  (`ROADMAP.md:3474`). Schedule = the day plan; Calendar = the
  date-bound view of everything.
- **41.5 `848a406`** — one-tap Confirm writes the
  `schedule.confirmed_day` capture; the day flips to a green pill; a
  *source-changed-after-confirm* ribbon diffs live sources against the
  frozen snapshot and **surfaces, never auto-applies** the difference.
  Migration 0031 was a same-day hotfix stripping `$schema`/`$id` from
  the schema document, which `pg_jsonschema` rejected with XX000.

### 2026-06-24/25 — editing, then a two-day UI sprint

Deltas and editing: `494bc29` 41.6 (the `foldDeltas` seam goes live —
ad-hoc tasks as commitment deltas through the outbox), `73e76ec` 41.7
(search-to-add existing chores; migration 0032 adds the `chore`
source_type), `17a2ccb` 41.8 (instance overrides, protection, and
modification history; migration 0034 adds `override` + a `history`
jsonb), `a762b7b` 41.9 (non-work time, man-down, cover).

Then eleven UI sub-batches in two days (41.10–41.20): desktop spine +
week silhouette, events absorbed into the Today timeline, a search
overhaul that deleted `SearchSelector.jsx`, project-work rows, a
**second Design Bracket** for the day spine won by the **Rethinker
master-detail** (`307b727` 41.15; `ROADMAP.md:3619`), Week/Month zooms,
must/should escalation, the Review zoom, a daily confirm-nudge push
(migration 0035), notes and future-day confirm.

### 2026-06-25 — the coverage audit, and the fork that evaporated

Mid-sprint, four parallel read-only audits checked the shipped code
against the story set — S1–S129 and BD1–BD44 — every verdict cited to
`file:line` (`docs/history/records/schedule-coverage-audit.md`, against
`baef9dc`). Headline: the spine was solid; the gaps fell into
deferred-by-design, the known tail, and "genuine in-scope gaps not
tracked anywhere".

Its biggest finding was **3a — the must/should distinction**, blocked
because `chore_definitions` had no must/should flag; the audit demanded
a decision: change a live table, or narrow the epic. Batch 41.17 took a
third path, and the dossier is now out of date on it. `7eeeb5e` found
the distinction already **derivable**: window frequencies
(`weekly_window`, `monthly_last_week_window`, `block_on_weekday`) *are*
the shoulds, fixed daily chores are the musts, and
`choreDaysRemaining()` already supplied the escalation signal. No field
was added to the live table (`ROADMAP.md:3659`). The audit's other
buckets drove the 41.21–41.31 coverage tail directly.

### 2026-06-25 — the coverage tail, and the one destructive migration

Eleven sub-batches closing the audit's list: buffers with **BD23**
settled (a buffer is its own `buffer` commitment bound to an activity,
`c2f8460` 41.21), multi-day add, recurring reservations, the one
conflicts list plus double-booking, event edit scopes reachable from
the Schedule, week reservations and yesterday's unfinished musts,
split-block (`1b40df1` 41.27 — deleted six days later, see 42.3),
buffer templates, buffer squeeze + horizon double-book, and bulk series
removal (`9c375dc` 41.31, feature complete).

In the middle of that, **41.28 `b4c217d` authored migration 0036 — the
only destructive schema migration in the repo's history.** It drops the
`timeline_items` view (0013) and the `chore_runs` table (0009), both
with `RESTRICT` so an unforeseen dependent fails the push loudly rather
than cascading. The file carries its own pre-apply protocol: full
backup, confirm `commitments(source_type='chore_block')` parity against
the live `chore_runs` count, then James pushes it himself. **It was
applied to prod 2026-06-26** (memory `project_schedule_feature`; orphan
check 0, lossless).

### 2026-06-26 — Overnight + Project blocks: shipped, then parked

A second full Scope Workshop → Design Bracket run, outputs now at
`docs/history/records/overnight-project-blocks-scope.md` and
`…-the-design.md`. The purpose was to **tile the day completely**: the
negative space between chore blocks becomes legible work-time. All five
scope lenses converged independently — both new blocks are **pure
derivation, zero stored rows, v1 ships with zero migrations** (scope
§2).

The engineering is three pure functions: a ribbon partitioner walking
the gaps between resolved chore-block windows; one placement function
`segmentForStart` so there is exactly one catch rule for chores,
project steps, ad-hoc items and events; and a two-day Overnight span
that is **one commitment row surfaced on two days** — an 11 p.m. task
carries its literal `(run_date, clock_time)`, day D derives
`[lastChoreEnd(D), firstStart(D+1))` as its trailing segment, day D+1
derives the same interval as its leading one. Ticking it toggles the one
row, so "one shared completion truth" is an identity rather than a
synced feature (scope §2.3).

The Bracket's deciding axis was explicitly **Dad's field comprehension
at 4 a.m.** (the-design §1). Convention won; Minimalist was rejected
for hiding project time so well "Dad would never know it existed", and
Flow's traveling-marker animation lost on build cost while its
**hinge** — the now-ring crossing midnight on one shared segment — was
grafted in by name (§4). Four amendments followed: de-hatch the gauges
(crosshatch reads "blocked", not "free"); a **slate-blue `--c-project`
token** picked from a five-candidate swatch pass in both themes;
`ClockArrowRight`/`Left` icons encoding the two-day direction (which
required bumping `lucide-react` 0.462 → 1.21); and naming blocks by
kind + range ("Project · 11:00–1:00") with the project name in the
*item* row — deliberately avoiding the word "Free" because it collides
with the who's-free badge (§2.4).

Shipped across 41.32–41.36 (`05a946e`, `99fc42c`, `15dd110`, `923deb1`,
`21515de`, v0.10.73 → v0.10.77). **41.36 earns its own note:** a
committed 4,000-configuration property test
(`scripts/test-schedule-partition.mjs`, `npm run test:partition`)
immediately caught a real latent bug — `projectGaps` walked gaps
between blocks consecutive *by start*, so an earlier-starting block
that ended later could let a "gap" run straight through it. Fixed by
merging block windows to their union first (`mergeWindows`), now used by
both `projectGaps` and `overnightWindow` (`ROADMAP.md:3983`).

James **parked the feature 2026-06-26**, functionally complete but
never visually QA'd (memory `project_overnight_project_blocks`).

### 2026-06-28 — the audit-fix wave and one hard-won lesson

Twenty-two fix commits against the shipped Schedule (m1 §1.2), from the
2026-06-28 audit round (F1–F80, still untriaged as a set). The one with
transferable value is `86fbaac` — untick didn't propagate to the other
device because Postgres wasn't publishing enough of the deleted row:
the **REPLICA IDENTITY** lesson for realtime DELETE events.

The same day, `afa484a` shipped a piecemeal colour pass (amber-now,
green/blue block tints) and `58d3942` reverted it hours later with no
rationale in the message. m5 §2b recovered the reason from transcript:
the pass **contradicted the Rethinker system**, against James's standing
directive that "where my earlier per-finding style requests contradict
the rethinker's system, defer to the system." The whole per-finding
colour backlog (F5, F11, F21, F31, F32, F33, F36, F39, F44 — all 06-28
audit) was folded into the Rethinker arc's Phase 4, "reconcile deferred
findings". **Phase 4 is the one phase of that arc that never ran** (m5
bonus finding).

### 2026-07-01/02 — batch 42: the Rethinker redesign

Nine sub-batches, `v0.10.78` → `v0.10.86`, all Schedule-facing:

- **42.1 `e983910`** — an affordance standard (voice-guide principle
  10) plus a `Tooltip` primitive.
- **42.2 `2fca52c`** — chrome and toolbar; `AddTaskBar`; per-block foot
  inputs removed outright (no-legacy).
- **42.3 `c72c676`** — spine finish plus four feedback rounds.
  Root-caused duplicate project steps to two devices' auto-reflow
  debounces firing in the same instant, fixing `reconcilePlan` to dedupe
  by placement key keeping the lexically-smallest id so concurrent
  healers delete the same row. **`SplitBlockSheet` deleted** — F53
  (07-01 audit) resolved as *drop*, ten days after 41.27 built it.
  Added **un-confirm**, which needed migration **0043** — see the
  warning in Current state.
- **42.4 `54dc41b`** — two range bugs meant events barely reached the
  Schedule at all: `deriveDay` expanded occurrences over a *zero-width*
  range so only midnight/all-day events ever showed, and `farmLoad`'s
  week expansion ended at Saturday 00:00 so Saturday's timed events
  never got their badge. Needs-cover reworked to block-level units
  (`CoverSheet.jsx` deleted). And **the reflow engine's auto-seeding
  was retired** (no-legacy): the projects engine used to auto-fill the
  day's project gaps from the ranked queue; quick-add replaced it, and
  `useScheduleReflow` + `reflowBridge` were deleted, taking 41.33's
  auto-pull of the top project step with them.
- **42.5 `81fdc89`** — a truer This Week (identity bars), warming
  collapsed to binary, a "Nobody at the farm" card.
- **42.6 `eba428e`** — **availability becomes a real model**: migration
  0044 (`time_off`, `working_hours`, `breaks`), `availability.js` built
  TDD with 40 tests, and the magic 6 p.m. project cutoff retired for a
  band derived from whoever is scheduled to work.
- **42.7 `3148879`** — availability on the surfaces plus week/day
  conflict parity. The `HereStrip` (F48, 06-28 audit) was built,
  walkthrough-reviewed and **reverted the same day** — it layered UI on
  UI with no phone affordance — but `availabilitySegments` was kept in
  the engine for a design-bracket successor (`ROADMAP.md:4468`).
- **42.8 `828088c`** / **42.9 `1a98ae5`** — live HTML doc attachments
  (migration 0045); the walkthrough phase-1 sweep, including migration
  0046 making sunrise/sunset first-class on working hours and breaks.

The Schedule then went quiet while 42.10–42.19 worked projects, animals,
processing and layers, returning for two quick-wins: **42.20
`a61b02e`** (live today progress in the header) and **42.21 `0650fa4`**
(focus recall across day navigation, extracted to a tested pure
`resolveFocusBucket`; the conflicts entry always reads as a count). F32
(06-28 audit — proportional left-pane bars) was left explicitly open
there as a design call, because it contradicts the deliberate
equal-height row grid.

A second colour revert belongs here: `99c9375` minted a `now` token and
`776a39a` deleted it the same day, replacing it with an inset
accent-deep ring plus a 1px background-coloured gap. That commit
documents its own reasoning, and the durable rule it extracted is now in
the tracked design system: **contrast on coloured fills is solved with
luminance separation, not by minting a new hue** (m5 §2a).

## Current state

Verified against the working tree at `063ffb7` (v0.10.99-alpha); suite
green, 37 files / 1178 tests.

**The event model — unchanged since 0013 and still the substrate.**
`event_series` (RRULE + `season_window`), `event_occurrences`
(materialize-on-touch), `event_links` (polymorphic). Read path:
`src/lib/recurrence.js` (`getEventOccurrences`, re-exporting `RRule` /
`rrulestr`), `useEventSeries`, `useEventOccurrences`, `useEventLinks`,
`useEventMutator`. Edit scopes go through
`useEventSeries.splitSeries` (`:122`), reached from both
`EventEditor.jsx:263` and `Schedule.jsx:2383` via `EventScopePrompt`.
`event_attachments` (0048) carries processing cut sheets.

**Two surfaces, settled vocabulary.** `sections.jsx:51` = Schedule
("Today's plan"), `:56` = Availability, `:60` = Calendar ("Calendar and
timeline view of everything date-bound"). `src/pages/Calendar.jsx`
(554 lines) hosts Day/Week/Month/Agenda via
`components/CalendarViews.jsx` (1024) and doubles as a place timeline
for the farm map (`forPlace`). The per-kind sidebar flyout and
`events_all` both route into Calendar with a preset view/filter
(`SectionContent.jsx:62–73`).

**The day plan.** `src/pages/Schedule.jsx` — **3,945 lines, the largest
file in the app by more than 2×** (next is `Orders.jsx` at 1,818). It
hosts four zooms: Day (master-detail), Week, Month and Review
("Looking back"), the last three desktop-only, phone staying on the day
(`Schedule.jsx:1804`, `:2912`). Supporting components:
`ScheduleSidebars.jsx` (`DayRailSpine`, `DayStrip`), `ScheduleZoom.jsx`
(`WeekView`, `MonthView`), `ScheduleReview.jsx`, `ConflictsPanel.jsx`,
`AddToScheduleSearch.jsx`, `ScheduleEditSheet.jsx`,
`ReservationSheet.jsx`, `BufferSheet.jsx`, `EventTimeSheet.jsx`,
`ChoreCheckRow.jsx` (shared with Rounds — the one completion truth).

**The engine — `src/lib/schedule/`, 13 pure modules, 12 test files,
340 tests.** `deriveDay.js` (the assembler + `rollupChoresForDay` +
`foldDeltas`), `partition.js` (the ribbon partitioner: `projectGaps`,
`overnightWindow`, `inOvernight`, `mergeWindows`, `subtractIntervals`),
`placement.js` (`segmentForStart`, `buildDaySegments` — the one catch
rule), `availability.js`, `manDown.js`, `conflicts.js`,
`overrides.js`, `buffers.js`, `lookBack.js`, `weekView.js`,
`monthView.js`, `focus.js`, `reflow.js`. Plus `src/lib/load/farmLoad.js`
(the day/week load model, 44 tests) and
`scripts/test-schedule-partition.mjs` (the 4,000-config property test,
`npm run test:partition`, outside vitest).

**The capture substrate.** `src/lib/capture/` — `capture.js`
(`recordCapture` validates with `ajv` then rides the outbox;
`readCaptures` upcasts every row to the latest shape on read),
`registry.js`, `validate.js`, `upcast.js`, and exactly one registered
schema: `schemas/schedule.confirmed_day/v1.schema.json`. Tables
`capture_schemas` + `captures` with the `record_capture` RPC (0030,
0031). Confirmed-day captures are read in three places in
`Schedule.jsx` — the day header, the week/month confirmed stamps
(`:1825`), and the Review zoom's actuals-vs-planned (`:1872`).

**Reminders.** `netlify/functions/schedule-reminder.mjs`, scheduled
`0 11 * * *` UTC (≈7 a.m. EDT). It deliberately does *not* recompute
the day — the draft is client-derived — it reads the cheap durable
signal "did anyone confirm today?" from `captures` and pushes one
shared nudge, honouring the per-user prefs from 0035.

**Availability.** Tables `time_off` / `working_hours` / `breaks` (0044)
with sun anchors (0046); `useAvailability.js` shapes them into an
engine-ready `{ hours, timeOff, breaks }` context;
`src/pages/Availability.jsx` (996 lines) edits all three in place.
Precedence in `workingWindow`: per-date exception > weekday default >
a 9–5 fallback.

**Overnight + Project blocks are live**, and split across two layers.
`partition.js` owns the pure windows, but the Overnight *assembly* —
neighbour-day reads via `useNeighborDeltas`, the evening/dawn edge
catch, the lead/trail entries — lives inline in `Schedule.jsx`
(`:1059`–`:1280`), not in `deriveDay`. `deriveDay.js:95` and
`partition.js:6` both still say Overnight is "added in a later batch
and not emitted here", which is literally accurate and is exactly the
"placement unification" item on the parked backlog. Overnight hides
when it has no items, which **matches** the scope doc (`…-scope.md:137`)
rather than diverging from it.

**What the reflow engine left behind.** `reflow.js` is now only the
ranked project queue: `rankedActiveProjects`, `rankedStepQueue`,
`nextRankedStep` — the last consumed at `Schedule.jsx:2873` for the
manual "add next task" quick-add. The auto-seeding planner, its hook
and its bridge are gone (42.4). Its own header comment documents the
retirement (`reflow.js:11`).

**Where the code contradicts or outruns the dossiers:**

- **Migration 0043 (`unconfirm_day`) is unverified against prod, and if
  unapplied, un-confirm is live-broken.** Authored at `c72c676`, whose
  body says "NOT pushed — un-confirm no-ops until it's applied", and
  whose closing line is "0043 push is the immediate follow-up". No
  later commit mentions 0043; `ROADMAP.md:4174` still reads "AUTHORED,
  NOT PUSHED". Its state cannot be confirmed from the repo. One
  correction: the roadmap says un-confirm "404s" without it, but the
  code path (`Schedule.jsx:2160`) is a plain PostgREST
  `.delete()` — with RLS denying it, that returns **success affecting
  zero rows**, so no error is thrown, `setConfirmedDoc(null)` runs, and
  the day appears to revert until the realtime refetch (`:2023`) snaps
  "Confirmed" back. The failure mode is a silent lie, not an error.
- **Sun-anchored breaks carve availability but not project gaps.**
  `availableWindows` resolves each break through `resolveWindow`
  (`availability.js:59`), honouring `startSun`/`endSun`.
  `projectGaps` pushes break holes as raw
  `{ s: br.startMin, e: br.endMin }` (`partition.js:200`) with no sun
  resolution — and `createBreak` permits a sun-only row with null
  minutes (`useAvailability.js:245`). `subtractIntervals` skips
  `!(h.e > h.s)`, so such a break is *silently ignored* by the
  partitioner instead of crashing. A sunset-anchored break therefore
  shrinks a person's availability but does not trim the project block
  drawn over it.
- **The capture substrate's regression net was never built.**
  `docs/specs/versioned-capture-substrate.md` §2.3 specifies "a
  golden-file test per version pins old fixtures rendering under the
  latest shape — that's the regression net for 'March's day still
  renders in December'". `src/lib/capture/` has **no test files at
  all**; `upcasters.js` is `export default {}`. Nothing is wrong yet
  because v1 is the only version — the net is missing precisely for
  the moment v2 ships.
- **The operator roster is hardcoded twice.**
  `PARTITION_ADMINS = ["James", "Jim"]` (`partition.js:31`) and
  `ADMINS = ["James", "Jim"]` (`manDown.js:12`). Availability, who's-free
  and man-down all resolve against literals.
- **`event_instances` is a live legacy table.** Fully superseded by
  0013's conversion, never dropped, still in the backup roster
  (`scripts/backup-db.mjs:64`) and still named in `CLAUDE.md`'s
  "must never be lost" events list — which overstates its importance
  and understates `commitments`', which is absent from that list.
- **Stale references to promoted docs.** `src/lib/capture/registry.js:8`
  and the header comments of `0029_…sql:5` and `0030_…sql:5` point at
  `docs/specs/versioned-capture-substrate.md`; the file
  now lives at `docs/specs/versioned-capture-substrate.md`.
- **Stale post-rename vocabulary in comments.** `Calendar.jsx:18`
  still opens "Schedule (Batch 14.1)" and its inline comments call the
  page "the plain Schedule screen"; `sections.jsx:65`/`:70`/`:75`
  describe event sub-items as "Schedule with the Agenda view selected";
  `SectionContent.jsx:62` says "folded into Schedule's Agenda view".
  All four mean **Calendar** since 41.4.
- **`monthView.js` is the only untested schedule module.**
- The coverage audit's structural fork 3a is **resolved, not open** —
  see the 2026-06-25 entry. Anyone mining
  `records/schedule-coverage-audit.md` for open work should skip it.

## Unresolved threads

**Blocking / correctness**

1. **Verify and, if needed, push migration 0043.** Un-confirm is
   either working or silently lying to both operators. Backup →
   row-count → authorized push. Note that it cannot be settled by a
   read-only probe: PostgREST does not expose RLS policies, so
   `scripts/prod-read.sh` is no help and `supabase migration list
   --linked` (after `supabase login`) is the definitive check. Its two
   companions in the H1 "authored but never pushed" list, **0033 and
   0040, turned out to be applied** (verified 2026-07-29 — see
   `platform-and-infra.md`), so the commit-body flag is weak evidence
   here in both directions.
2. **Fix sun-anchored break resolution in `projectGaps`** — route
   break holes through the same `resolveWindow` the availability
   engine uses. TDD: a sunset-anchored break should trim the evening
   project gap.
3. **Golden-file upcaster tests for `schedule.confirmed_day`** before
   a v2 schema ever ships. Also unresolved in
   `docs/specs/versioned-capture-substrate.md` §5: sub-decision 4
   (table/RPC naming) and sub-decision 5 (schema publish mechanism —
   migration-per-version vs a deploy sync script) are both still
   "pending James", though the migration path is what the code does.

**Design decisions James still owes**

4. **F11 (07-02 audit) — the colour system.** The finding is not "fix
   these hues" but "category colour identity has failed; configure the
   Tailwind palette so info/alert/warning/danger + category hues are
   actually represented, then reassign identity." It is flagged
   **time-sensitive** because Jim is now using the app and late colour
   changes fight learned habits. m5 §2b is emphatic that the
   per-finding shape has already been tried and reverted once
   (`afa484a` → `58d3942`) — scope it as a design-system pass.
5. **F32 (06-28 audit) — proportional left-pane timeline bars** vs the
   deliberate equal-height row grid. Left open with that reason stated
   in `0650fa4`. A merge/kill call, not a bug.
6. **The who's-here / availability cluster** — F1/F4/F6/F8/F12 (07-02
   audit), including a successor to the reverted `HereStrip`.
   `availabilitySegments` is still in the engine waiting for it, and
   "why is no one here" traceability is unbuilt (`ROADMAP.md:4472`).
7. **Week/Month views** — F19 (07-02 audit) is a whole design bracket;
   the zooms are also **phone-unreachable by design**, which the story
   set disputes (S107 wants the week "a tap away").
8. **Rethinker Phase 4** — "reconcile deferred findings" — is the one
   phase of that arc that never ran, and F11 and F32 both live inside
   it. Phases 0–3 and 5 landed (m5 bonus finding).

**Parked backlogs, verbatim from their own commits**

9. **Overnight + Project polish** (`21515de`, `ROADMAP.md:3993`): O6
   event/chore overnight-catch (events need neighbour-day derivation
   plus a distinct overnight render), O-B7 week/month day-count fold
   (the silhouette zooms are deliberately delta-free), the
   retime-across-midnight `run_date` flip (not triggerable today
   because overnight items aren't edit-exposed), and the placement
   unification refactor. Plus the whole arc has **never had a visual QA
   pass**.
10. **Schedule deferred stories** (memory `project_schedule_feature`):
    S114 "tomorrow looks heavy" (needs a server-cheap load proxy),
    S111 man-down push, S33d token-grammar search, S60b
    invalidate-ack-on-edit, S69, and projects auto-pop 3b — which 42.4
    arguably **closed by decision** when auto-seeding was retired;
    confirm before rescheduling it.
11. **Batch 42's own visual QA sweep** was never done
    (memory `project_schedule_redesign_b42`).
12. **The 06-28 audit round F1–F80 is still untriaged as a set**, even
    though 42.21 found most of bucket B already shipped and merely
    unchecked. De-taint against main before scheduling anything from
    it (the deploy-lag rule, memory `project_next_bugfix_loop`).

**Architecture**

13. **`Schedule.jsx` at 3,945 lines** is the app's largest file and
    holds logic that belongs in the engine — the Overnight assembly
    (`:1059`–`:1280`) most obviously. Feed this to H4; the
    placement-unification backlog item (9) is the same problem seen
    from the feature side.
14. **Hardcode the roster out.** `PARTITION_ADMINS` / `ADMINS` should
    read from a real people source; guest/contributor access
    (2026-06-03 handoff) makes this load-bearing rather than cosmetic.
15. **Drop `event_instances`**, and correct `CLAUDE.md`'s
    must-never-lose list to name `commitments` and `captures` (the
    actual irreplaceable Schedule data) instead.
16. **Per-day project-block boundary override** was deferred by scope
    decision as additive-when-needed (`…-scope.md`, `ROADMAP.md:3853`);
    `PROJECT_DEFAULT_START`/`END` remain as the no-availability
    fallback.

**Fossils — planned, never built, never cut**

17. **Google Calendar push** — deferred four times across three
    numbering eras (m2 §2), most recently mid-Batch-19. The
    `gcal_event_id` column and `gcal_pushes` table are already in prod.
    Decide: build it or cut it.
18. **Event time footprint / live travel time** (`14663e7`,
    `38aeedd`, `ROADMAP.md` ~4847). Needs a Google Routes key. Its
    market-buffer slice shipped in 41.21; the travel model did not.
    Genuinely operational — "a market costs more than its hours."
19. **Mileage tracker** (`9aff149`, `ROADMAP.md` ~4817) — parked since
    the events workshop.
20. **Thought quick-convert to event** (2026-06-03 handoff) — the Inbox
    capture that would feed the Schedule. Inbox shipped (Batch 21,
    `220c17e`); the promotion path did not.

## E-commerce relevance

Real but indirect — the Schedule is where selling turns into work.

- **Markets and pop-ups are already event kinds**, and 41.21's buffer
  work exists for them: a market buffer with a setup/cleanup equipment
  checklist bound to the event (`ROADMAP.md:3717`). Pickup windows,
  delivery runs and fulfilment days should be **event kinds with
  buffers**, not a new scheduling concept — `event_links` already links
  an event to arbitrary rows and `commitments` already accepts an
  `event` source_type.
- **The event time-footprint idea is the missing piece for market
  economics** (thread 18). "A market costs more than its hours" needs
  the travel/setup model before market days can be costed against
  channel margin; it needs a maps key, filed under the never-built
  Batch 30 integrations (m1 §4).
- **The capture substrate is the app's KPI freezer, and it is
  underused.** `docs/specs/versioned-capture-substrate.md` §2.1 names
  `telemetry.daily_kpi` and `metrics.*` as intended schema_ids; only
  `schedule.confirmed_day` exists. Daily sales / margin / fulfilment
  snapshots are the natural second consumer, and folding
  `egg_collections` / `weight_samples` in was already the resolved plan
  (§5 sub-decision 2).
- **Availability gates fulfilment promises.** `working_hours` /
  `time_off` / `breaks` (0044/0046) are the only honest answer to "can
  we ship Thursday?" Pickup/delivery scheduling should read
  `src/lib/schedule/availability.js`, not invent a second capacity
  calendar.
- **Two constraints, not features.** Build customer-facing surfaces
  **after** the F11 palette reconfiguration or they get restyled twice
  (m5 §"E-commerce relevance"); and treat `Schedule.jsx` as the
  cautionary tale for page size — 3,945 lines is what 40 sub-batches
  without an extraction pass look like.
- **No shared schema risk.** None of this chapter's tables
  (`event_series`, `event_occurrences`, `event_links`, `commitments`,
  `captures`, `capture_schemas`, `time_off`, `working_hours`, `breaks`)
  is on the commerce path, so migration work can proceed independently
  on both sides.
