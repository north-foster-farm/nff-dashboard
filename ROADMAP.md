# NFF Dashboard — Roadmap

Living record of the multi-batch improvement plan: how it came to be,
what has shipped, the design records of the completed overhauls, and
what is still upcoming. Updated as part of every batch (final step of
the per-batch checklist).

## How this plan was formed

On **2026-05-04** James dumped two rounds of requirements into a
planning conversation:

1. **Round 1 (16:06)** — first brain-dump covering activity-log
   debouncing + edit/delete, dashboard card renames, "Schedule at a
   glance" timeline rework, dynamic chore time-block labels, chore
   groups, chore sticky notes, user settings page, dashboard
   date/weather, the full Project → Phase → Step → Checklist model,
   Processes tied to event_kinds, Customers + Lists, Google Calendar
   sync, Farm Updates with AI review, Social Posts, Content Calendar,
   and the "Planning" sidebar grouping.
2. **Round 2 (19:23)** — second dump covering the Resources problem,
   Products/pricing, Inventory backend, Orders, POS, commerce
   integrations (Stripe / Venmo / QuickBooks), app-wide search,
   offline tolerance, iOS responsive pass, voice control, the Nacelle
   font fix, "coming soon" stubs, Tailwind/design-system migration,
   bookmarking, the pasture-visualization simulator, top-bar logout +
   avatar relocation, the permanent `-alpha` version suffix, the feed
   resource overhaul, the broiler tracker, broiler page persistence,
   and breadcrumb / page-title hierarchy.

Two key sequencing decisions came out of the back-and-forth that
followed:

- **Tailwind moves earlier.** Initially proposed further out; James
  pushed back ("why do we think the tailwind migration will take
  weeks?") and we agreed to land it as Batch 2 so we don't build new
  UI in inline styles only to migrate it twice.
- **Polish gets aggressively front-loaded.** Anything content-only or
  light UI that could ship safely was pulled into Batch 1, including
  the weather widget, top-bar date, and dynamic chore-period labels —
  not just the strictly cosmetic items.

The full original plan (all 22 batches, with detailed Batch 1
implementation notes and verification steps) lives at
`~/.claude/plans/i-want-to-make-cozy-kitten.md`. This file is the
source of truth going forward; any divergence from the original plan
is recorded under the relevant batch below.

## Execution rules

- One commit per batch.
- Version bumps: Batch 1 → `v0.9.0-alpha`, Batch 2 → `v0.9.1-alpha`,
  … i.e. patch increments per batch with permanent `-alpha` suffix.
- After each batch lands, post a short "what changed" summary plus
  2–3 hands-on tasks the user can try in the running app.
- **Update this ROADMAP.md** as the final step — tick the batch off
  under "Shipped" with date, version, planned scope, and any
  extras / scope changes that happened mid-flight.

---

## Shipped

### Batch 1 — Cosmetic & top-bar polish · `v0.9.0-alpha` · 2026-05-04
Commit `7859209`.

Planned:
- Nacelle font load fix (woff2 files dropped into `public/fonts/`).
- Permanent `-alpha` suffix on version label.
- Logout button → top right; new icon (lucide `LogOut`).
- SessionFooter (avatar/name/email) removed from sidebar.
- Avatar moves to header — grayscale, colorizes on hover, click →
  Settings stub.
- "Coming soon" full-page component; swapped into unfinished pages.
- `SectionHeader` parent back-link for non-top-level pages.
- Dashboard card renames ("In-progress farm updates", "This week's
  projects", "Schedule at a glance").
- "SKUs" → "All Products"; Events menu drops "Upcoming"; sidebar
  gains "Planning" group (Schedule / Chores / Projects / Processes;
  Processes flagged coming-soon).

Front-loaded extras (originally slated for later batches):
- Weather widget (Open-Meteo, Foster RI).
- Top-bar date / day-of-week.
- Dynamic morning/afternoon/evening time labels on Overview + Chores
  page (the chore time-block work from the round-1 dump).

Mid-flight scope changes:
- Multiple iterations on the weather widget before settling on a
  half-width "current conditions" card sitting above Schedule at a
  Glance, with three flex children (temps · conditions · day/date),
  no decorative dots, real Open-Meteo data (no hardcoded fallbacks).
- Avatar padding aligned to logout / theme-toggle buttons for visual
  parity in the top-bar cluster.

### Batch 2 — Tailwind v4 + shell/dashboard · `v0.9.1-alpha` · 2026-05-04
Commit `207d5e1`.

Planned:
- Tailwind installed; tokens (color/spacing/radius/font/shadow)
  aliased to existing CSS vars so theme switching keeps working off
  `data-theme`.
- Migrate shell + dashboard in waves; leave untouched pages on the
  CSS vars (subsequent batches migrate as they get touched).

Mid-flight scope changes:
- Chose **Tailwind v4** via the `@tailwindcss/vite` plugin (not v3
  with PostCSS) — simpler config, `@theme` tokens live in
  `src/styles.css`.
- "All Products" copy fixed to lowercase "p" ("All products") — typo
  carried over from Batch 1.
- Sidebar polish folded in: tighter vertical spacing within menu
  groups, scrollbars permanently hidden on menu + flyout, empty div
  under Dashboard link removed, dashboard tile alignment fixed
  (Upcoming chores + Schedule at a Glance now flush at the bottom).
- **Density variants** added (compact + spacious) ahead of schedule
  in anticipation of the larger-text variant we'll need as data
  density grows.

Migrated this batch: `App.jsx`, `TopBar.jsx`, `UserAvatarMenu.jsx`,
`Sidebar.jsx` (+ children), `WeatherWidget.jsx`, `ComingSoon.jsx`,
`PageHeader.jsx`, `SectionHeader.jsx`, `Overview.jsx`.

### Batch 3 — Schedule-at-a-glance timeline · `v0.9.2-alpha` · 2026-05-04
Commit `c827eb1`.

Planned:
- Replace segmented "events / chores" layout with one chronological
  list per day, interleaving events, chore-period rollups, and
  active projects.
- Pre-morning items (anything before today's earliest morning chore)
  pushed to the bottom and visually highlighted.
- "Upcoming events" subheading appears below the day's list when an
  event is in the next 7 days (excluding today).
- Visual differentiation per kind: events = small color dot;
  chore-group = medium-weight title; project = italic placeholder
  until the real phase/step model lands in Batch 6.

Mid-flight scope changes (heavy iteration on the row design):
- "Today" includes everything up to *tomorrow's* morning chores,
  not just calendar-today — so a 3 AM evening-period chore still
  reads as part of today's plan.
- Removed bullet icons in front of event names; color is delivered
  via small dots and tinted backgrounds, not prefix glyphs.
- Sundown indicator: dropped the icon, kept only the text "sundown".
- High/low temp glyph colors removed for the same "less decoration"
  reason.
- Pre-dawn rows visible permanently (had been flashing then hiding).
- Three-column layout with consistent column widths top-to-bottom;
  middle column truncates with ellipsis and reveals via tooltip on
  hover.
- Nacelle text bumped 11px → 12px globally; SVG sizing + bottom
  margin (1.75px) standardized; all rows align-items: center.
- New helpers `getEarliestChoreInPeriod` and
  `getChorePeriodStartMinutes` extracted in `src/lib/chores.js` so
  the existing `getChorePeriodTimeLabel` doesn't duplicate the
  window/sort logic.

### Batch 4 — Activity feed quality · `v0.9.3-alpha` · 2026-05-05
Commit `773bd15` (+ follow-up `01f19fd`).

Planned:
- Debounce check↔uncheck within 10s at the trigger level — both
  `chore_completed` and `chore_uncompleted` rows removed instead of
  emitting a noisy pair. (Migration `0007`.)
- Inline edit + delete on activity entries: hover-revealed pencil +
  trash, edit-in-place, optimistic UI, realtime UPDATE/DELETE
  propagation.
- New nullable `edited_summary` column overrides generated text.
- SECURITY DEFINER RPCs `edit_activity_entry` / `delete_activity_entry`
  enforce ownership (caller must be row's actor + admin); RLS on
  `activity_log` stays restrictive — no direct UPDATE/DELETE policy.
- `useCurrentUserEmail` hook added so consumers can decide whether
  to render the affordances.
- `Activity.jsx` Tailwind-migrated as part of the restyle (this is
  also how subsequent batches absorb migration work — only when a
  page is touched).

Mid-flight scope changes / hiccups:
- First migration push attempt happened against a `main` that had
  diverged after a force-push; recovered via "Option A" (clean
  re-fetch + re-push of the new commit).
- Discovery during smoke-test: the **Chores → Activity log tab was
  never implemented**, so it appeared activity persistence was
  broken on dashboard + chores. Wired tab to `useActivityLog`
  filtered to `chore_completed` / `chore_uncompleted` kinds with
  the same realtime + edit/delete affordances as the global page,
  and reserved layout space for the hover buttons so adjacent text
  no longer jostles. Shipped as follow-up commit `01f19fd`.

### Batch 6 — Roadmap on the dashboard · `v0.9.5-alpha` · 2026-05-05
New "What's coming" page (sidebar: Other → What's coming, lucide
`Map` icon). Plain-English overview of every upcoming feature from
the in-repo `ROADMAP.md`, written for a reader who wants to know
what's on deck without diving into batch numbers, schemas, or
sequencing notes. The markdown file remains the source of truth for
implementation; the in-app page is the marketing-style summary.

Page lives at `src/pages/Roadmap.jsx`. New `roadmap` section in
`sections.jsx`; added to `isSelfHeadered` in `App.jsx` so the page
owns its own title. Wired in `SectionContent.jsx`. The list of items
is hardcoded — when an upcoming batch ships, prune the matching
entry from the page as part of the batch's ROADMAP.md update step.

Mid-flight scope changes:
- Inserted as a new Batch 6, shifting the originally-numbered
  Batch 6 (Projects subsystem rewrite) to Batch 7 and bumping every
  subsequent batch by one.

### Batch 5 — Settings + chore groups + sticky notes · `v0.9.4-alpha`
2026-05-05. Commit `f734bb4`. Migration `0008`. All three new domains stream
cross-device via realtime.

**User preferences** (`user_preferences` table, keyed by email):
- Theme + density now follow the user across devices; localStorage
  remains as the boot-time fast-paint cache, the React hook
  reconciles after sign-in.
- Settings page replaces the coming-soon stub with a real form —
  segmented controls for theme + density, toggle for auto-expand
  chore groups.
- `useUserPreferences` upserts a row on first login seeded from
  whatever the device already had, so existing users keep settings.

**Chore groups** (`chore_groups` + `chore_group_members`):
- New "Groups" tab on Chores page; rename / delete groups; add or
  move existing chores via inline picker. Unique index on
  `chore_id` enforces one-to-one membership.
- Today tab partitions by group — group accordions render first
  (closed by default per the new user pref), period buckets pick up
  ungrouped chores.
- Each accordion header shows count + earliest start time and a
  "Mark all" affordance for bulk-completing remaining chores.
- Removed the "unassigned" label noise; right column now shows
  only an explicit assignee + deadline.

**Chore sticky notes** (`chore_messages`):
- MessageSquare icon next to every chore (Today + All chores) →
  popover with note thread + ⌘↵ composer. Author can delete own
  notes; any admin can mark any note addressed / unaddressed.
- Top-bar Bell icon: global inbox of unaddressed notes with count
  badge → dropdown with quick-address actions. Mounted before the
  avatar so it sits at the natural attention spot in the cluster.
- Shared `useChoreLookup` cache hook keeps `InboxBell` and
  `ChoreMessageButton` from each re-fetching `chore_definitions`.

Mid-flight scope changes:
- Realtime channel bug: `postgres_changes` callbacks were being
  attached *after* `subscribe()`. Fixed by attaching listeners
  before the subscribe call.
- Add-chore picker iterated heavily before landing:
  - Surfaces chore type AND scheduled time alongside the chore name.
  - Time moved next to frequency (not jammed at the right edge).
  - Search expanded so typing "mobile coops" returns related chores.
  - Search input + picker no longer reset after each add (preserves
    state so you can add multiple chores in a row).
  - Drag-and-drop reordering inside groups.
- `.temp/` directory added to `.gitignore`.

### Batch 7 — Chores foundation (schema + sites admin) · `v0.9.6-alpha`
2026-05-06. Migration `0009`. The schema foundation for the chores
overhaul. Source-of-truth plan at
`~/.claude/plans/chores-overhaul-v2.md`.

**Two-level site model:**
- `sites` — user-creatable parent categories (Brooders, Mobile
  coops, Barn, Wash & pack…). Five seeded; CRUD-able; carries a
  `default_has_residents` flag inherited by new locations.
- `site_locations` — specific named instances inside a site
  (Brooder #1, Hay room, Egg station). Each has its own
  `has_residents` flag (overrides the parent default). Locations
  are where chores actually happen and where residents live.
  Soft-delete preserves history.
- `site_residents` — which `livestock_groups` (cohorts/batches)
  live at which **location** with `moved_in` / `moved_out`
  dates. Unique partial index enforces "one current location per
  cohort." Editable moved-in date per row.

**Time-block model with sun events:**
- `chore_blocks` — named windows. Each side (start, end) is
  either `fixed` (a clock time stored as minutes-of-day),
  `sunrise`, or `sunset`. Sunrise / sunset resolve to today's
  actual local times via SunCalc (lat/lon hardcoded to Foster,
  RI; same coordinates as the weather widget). Validation
  rejects overlapping windows; the Blocks tab orders by today's
  resolved start time ascending.
- `chore_modifiers` — date-bound overrides; targets either a
  location, a parent site, or just a chore. Schema ready for
  Processes (Batch 19); UI ships there.
- `chore_runs` — one row per `(block_id, run_date)`. Mostly
  unused until Rounds (Batch 8); schema lands here.

**`chore_definitions` migration:** added `site_id` (nullable FK
to sites — applies to every active location under that site),
`location_id` (nullable FK to site_locations — instance-scoped),
`block_id` (nullable FK to chore_blocks), `sort_order` (int
default 0). XOR check ensures at most one of site_id /
location_id is set. Backfill populated site_id from the legacy
`category` text and block_id by matching `period` to seed block
names. Legacy `category` / `period` columns remain for now.

**New data hooks:**
- `useSites` — sites + locations + residents with CRUD,
  soft-delete, reorder, cohort assign/move-out, edit moved-in
  date, realtime. All mutations apply optimistically and revert
  on persistence failure.
- `useChoreBlocks` — blocks with CRUD, soft-delete, sun-event
  resolution via SunCalc, overlap validation, realtime. Plus
  `formatMinutesOfDay` / `parseMinutesOfDay` /
  `minutesOfDayToTimeInput` / `nowAsTimeInput` /
  `displayBlockSide` / `validateBlockWindow` helpers.
- `useChoreDefinitions` — live read with `updateDefinition` /
  `deleteDefinition` actions, realtime; used by the in-place
  edit affordance on the All chores tab. Optimistic + revert.

**Resources → Sites** (`SitesPage.jsx`, `SitesAdmin.jsx`):
- Sites are user-creatable parents; each renders a card with
  the site name (editable inline), a "Hosts cohorts by default"
  checkbox, an archive button, and the locations inside.
- Each location has up/down reorder, inline rename, a "Hosts
  cohorts" checkbox, and (when the checkbox is on) an
  always-visible residents pane below: list of currently-
  assigned cohorts with editable moved-in date and a
  "Move out" action, plus an "Assign cohort" affordance.
- "Add &lt;singular&gt;" buttons use `pluralize.singular()` so
  "Brooders" → "Brooder", "Sheep paddocks" → "Sheep paddock",
  "Wash & pack" → "Wash & pack" (already singular).
- Light surface backgrounds + clean inputs in the chore-groups
  add-form style; no dark gray fills; checkboxes (not
  chip-style toggles).

**Chores → Blocks tab** (`ChoresBlocksTab.jsx`):
- Lives on the Chores page now (split from sites). Each block
  card shows name + the two sides (clock-time / Sunrise pill
  / Sunset pill). Edit opens an inline form: name input, plus
  per-side segmented control (Time / Sunrise / Sunset) with a
  native `<input type="time">` when Time is selected.
- Validation rejects overlapping windows and end-before-start.
- New blocks default the time inputs to the current clock time
  if empty.

**In-place chore edit** on the All chores tab:
- Pencil icon now opens an inline editor in the expanded panel
  (no modal). Editable fields: title, description, where (radio
  between Specific site / Site kind / No site, with appropriate
  picker), when (block picker including "anytime"), sort order.
- Trash icon prompts for confirm and hard-deletes.

**Today + Schedule-at-a-glance** read from the new schema. New
helpers `getBlockTimeLabelForPeriod` and
`getBlockStartMinutesForPeriod` in `lib/chores.js` prefer
`chore_blocks` data when a matching block exists, falling back to
the legacy instance-derived helpers when not. Editing a block's
window in Settings propagates to the period header time labels on
both the dashboard's Upcoming chores card and the Today tab in
real time. Frequency / deadline / per-day-of-week assignment
editing remain out of scope (those JSON shapes deserve dedicated
editors later).

Pre-workshop dnd-kit reorder work in `ChoreGroupsTab.jsx` +
`useChoreGroups.js` ships with this batch unchanged — the
existing reorder-within-a-group surface still works against
`chore_group_members.sort_order`. The new canonical
`chore_definitions.sort_order` is currently editable via the
inline editor's number input; drag-reorder against it lands when
the Site Switcher ships in Batch 8.

### Batch 8.1 — Rounds lifecycle + Site Switcher · `v0.9.7-alpha`
2026-05-07. The doing-surface foundation, scoped down from the
full Batch 8 spec. Full plan at
`~/.claude/plans/chores-overhaul-v2.md`.

**Top-level takeover.** App.jsx gains a `roundsOpen` state; when
true, the normal layout (TopBar / Sidebar / SectionHeader)
disappears entirely and `<Rounds />` renders edge-to-edge.

**Sidebar dynamic label** (`RoundsSidebarItem.jsx`). Custom entry
inside the Planning group with `kind: "takeover"`. Label flips
between three states with a live tick:
- "Do morning rounds · 47m" — no run open; countdown to next
  block start (or 0 if a block window is currently open).
- "Help with rounds · 14:23" — a run is in progress on another
  client; elapsed counter ticks every second.
- "Do rounds" — fallback when no blocks are configured.

**`useChoreRuns` hook.** Loads today's chore_runs (one row per
`(block_id, run_date)`). Computes `nextBlock` (in-progress > now-
in-window > soonest-future > soonest-remaining). Mutations:
`startRun(blockId)` materializes / resumes a run, `endRun(runId)`
flips state to `done`, `resumeRun(runId)` pulls a done run back
to `in_progress`. Realtime subscription; optimistic + revert.

**Rounds takeover** (`Rounds.jsx`). Three states:
- *Cold open* — no in-progress run; centered "Start rounds"
  button + block name + window times. Locked-name title.
- *Doing surface* — top status bar (block name, live elapsed,
  sundown / sunup pill when the block has a sun-event end, All
  done button, Close X), Site Switcher chip strip (kind-level
  filter), main body listing chores grouped by site or — when a
  site is selected — by location with an optional secondary
  location strip when a site has multiple locations.
  Per-task fat checkboxes (44px target) read/write the existing
  `chore_completions` table; realtime echo flips contended rows
  to ✓ + disabled within ~80ms. No per-user attribution surfaced
  (generic ✓, no initials, no toast).
- *Wrap card* — total elapsed in display type, "Ran Xm past the
  window" when overran, Resume + Close buttons.

**Sundown pill on Schedule-at-a-glance.** Live-ticking
`SunCountdownPill` at the top of the dashboard's
Schedule-at-a-glance card. Shows the next sun-event (sunrise or
sunset) and how long until it lands; updates every minute. Uses
SunCalc directly (Foster, RI). Hidden if neither sunrise nor
sunset is in the future today.

**Out of scope for 8.1 (lands in 8.2):**
- Quick-action tray (Note / Condition multi-select chip sheet /
  Mortality fast-path / Chick → MASH / Moved coops / Moved
  chicken tractors). Run Events writing to `activity_log` with
  the `run_id` FK ships with that.
- Cohort-aware quick action prompts (read site_residents at the
  current location).
- Push notifications on Run done with overran callout — that's
  Batch 11 (Chores telemetry + push).

### Batch 8.2 — Quick actions tray (Run Events) · `v0.9.8-alpha`
2026-05-07. The other half of Rounds — bottom-pinned tray that
writes typed Run Events to `activity_log` with `run_id` +
site/location FKs. Three actions ship in 8.2; `Chick → MASH`,
`Moved coops`, and `Moved chicken tractors` are deferred to a
follow-up (8.3) so this batch can land without a five-sheet
explosion.

**Schema** (migration 0010): `activity_log` gains `run_id`,
`site_id`, `location_id` (all nullable, FKs with `set null` on
delete). New child table `activity_log_condition_states` for the
multi-select Condition chips (cascades on parent delete). New
RPC `log_run_event(p_kind, p_payload, p_run_id, p_site_id,
p_location_id, p_conditions)` is the single client-callable
entry point — direct INSERT to `activity_log` stays denied by
RLS, so the audit-trail invariant is preserved. Realtime
publication picks up the new child table.

**`useRunEvents` hook.** Wraps the RPC and loads a rolling
7-day window of `condition_observed` rows + their chip child
rows for the repeat-detection banner ("Brooder #1: 2 off-feed
calls in the last 7 days"). Realtime refresh on either table
inserting / deleting.

**`QuickActionsTray.jsx`** docks at the bottom of the doing
surface with three buttons:
- **Note** — site/location picker + free-text textarea.
- **Condition** — site/location picker + 6-chip multi-select
  (Listless / Unthrifty / Off-feed / Off-water / Damaged /
  Sick) with the repeat-detection banner inside the sheet.
- **Mortality** — site/location picker → cohort list resolved
  via `site_residents` (residents currently at that location)
  → numeric count with ± stepper. Auto-decrements
  `livestock_groups.count` on save, best-effort.

Activity feed renderer learns three new kinds (`note_observed`,
`condition_observed`, `mortality_observed`) so the existing
Activity page and Overview ticker display sensible lines without
further changes.

**Out of scope for 8.2 (lands in 8.3):**
- Chick → MASH cohort fast-path.
- Moved coops / Moved chicken tractors kind-level sweep with
  per-task sub-checklist (fences, feeders, waterers, grit,
  shell).
- Per-cohort attribution + automatic `site_residents` move-out
  when a cohort empties to zero.

### Batch 9 — Observation Log · `v0.10.0-alpha`
2026-05-07. New "Observations" page under the Other sidebar group
(lucide `Eye`). Reads `activity_log` rows for the five Rounds-emitted
observation kinds (`note_observed`, `condition_observed`,
`mortality_observed`, `cohort_moved`, `infra_swept`) — no new table.
Filter bar: kind chips (All / Notes / Conditions / Mortality / Moves
/ Sweeps), site dropdown (resolves rows tagged with only a
`location_id` via the parent site lookup), author dropdown (populated
from the rows actually present), and a date-range preset pill (Last
7 days / Last 30 days / All time). Realtime subscription scoped to
the observation kinds; row edit + delete affordances inherited from
Batch 4 (same `ActivityRow`).

**`useActivityLog` hook generalized** to support the new shape:
optional `untilDate` (paired with the existing `sinceDate`) and
optional `kinds` array. The select now pulls `site_id`, `location_id`,
and `run_id` from `activity_log`; UIEntry exposes them as
`siteId` / `locationId` / `runId` for site-aware filtering. Realtime
INSERT path filters by the same kinds + window so Activity, Overview,
and Observations don't cross-contaminate each other's streams.

**Out of scope** (intentional, per the original Batch 9 spec):
structured forms, photo attachments, AI summarization. Sequencing
keeps the feature small so the chores polish + telemetry batches
that follow (Batches 10–11) land next without backlog.

### Batch 8.3 — Remaining quick actions · `v0.9.9-alpha`
2026-05-07. Picks up the three actions deferred from 8.2 — Move,
Sweep, and the auto move-out — without any schema changes (kinds
are just strings; payloads carry the structured per-instance data).

**Move sheet (cohort fast-path).** Generalises "Chick → MASH" to
arbitrary cohort relocations. Pick a source location, pick the
cohort currently living there (resolved via `site_residents`),
pick a destination location, submit. Logs `cohort_moved` with
the from/to location names + cohort id, then calls
`assignResident(toLocationId, groupId)` — that helper closes the
open row and inserts a new one in a single transaction, exactly
the right semantics for a move. Use case: chicks graduating from
a brooder into a MASH ward (the ward is just another active
`site_locations` row).

**Sweep sheet (kind-level sub-checklist).** Replaces the original
"Moved coops" / "Moved chicken tractors" pair with one site-driven
action. Pick a site (typically Mobile coops or Chicken tractors),
get a per-instance card per active location with five chips
(Fences, Feeders, Waterers, Grit, Shell). The "All taken care of"
button mass-toggles every chip on every location at once and
flips to "Clear all" once everything is filled. Submit logs a
single `infra_swept` row carrying the per-instance breakdown so
the upcoming Performance sub-tab + Observation Log can render
which items were checked at which location.

**Auto move-out via Mortality.** When the Mortality sheet
decrements a cohort to zero, every open `site_residents` row for
that group is closed today. The location stops surfacing the
cohort in pickers immediately, no manual cleanup needed. Failures
are swallowed so a misaligned count never loses the activity_log
row.

**Activity feed renderer** learns `cohort_moved` ("moved Brooder
batch: Brooder #1 → MASH ward") and `infra_swept` ("swept Mobile
coops — all taken care of" or per-item count). The tray now has
five buttons: Note, Condition, Mortality, Move, Sweep.

### Batch 10 — Chores polish · `v0.10.1-alpha`
2026-05-07. Cleanup pass on the chores layer landed across migrations
0008–0010 (amended in place per the pre-production rule — DB resets
expected) plus React-side rewrites of Rounds, the Today tab, the
Blocks editor, and the quick-actions tray.

**Block model: start + duration.** Dropped `end_kind` /
`end_minutes`; added `duration_minutes` (default 120). Editor
collapses to one start picker (Time / Sunrise / Sunset segmented
control) plus a number-of-minutes input. End is derived as start +
duration everywhere it gets rendered or compared. `validateBlockWindow`
+ `isOverran` + `nextBlock` all updated to the new shape. Rounds
status-bar pill now reads "Morning · 2h" rather than "6 AM – 8 AM."
The Rounds-internal sundown / sunup pill goes away — the
dashboard's existing `SunCountdownPill` already covers that need.

**`chore_groups` retired.** Dropped the `chore_groups` /
`chore_group_members` tables, the `auto_expand_chore_groups`
preference column, the Groups tab on the Chores page, the
`useChoreGroups` hook, and the dnd-kit reorder UI that was specific
to the groups surface. Today-tab partitions by block only now —
site- and block-driven groupings already cover the use case the
manual groups served. ~70KB drop in client JS as dnd-kit went with
it.

**MASH rename + Other field.** Activity-log kind `condition_observed`
→ `mash_intake` everywhere (RPC, useRunEvents, useActivityLog
renderer, Observations filter chip). Tray button reads "MASH"; chip
sheet header reads "Why move to MASH"; renderer line reads
"moved to MASH — listless, off-feed" instead of "flagged listless,
off-feed." New chip "Other" appended to the chip set; ticking it
reveals a textarea, and the trimmed text rides in `payload.other_text`.
Submit button reads "Move to MASH (N)" with the picked-chip count.

**Mortality: any cohort under General.** When the SitePicker is in
its General state (no site, no location), the cohort dropdown
widens from "residents at this location" to every active
`livestock_groups` row. The empty-state copy switches to match.

**Move + Sweep retired from the bottom rail.** MoveSheet and
SweepSheet deleted from `QuickActionsTray`; cohort moves resurface
as planned events when the Events overhaul lands (Batch 13). The
tray drops to three buttons: Note, MASH, Mortality. The
`onAssignResident` prop and `ArrowRightLeft` / `Wrench` lucide
imports go with them.

**Sweep folded into Rounds main UI.** New `AllDoneButton` on every
section header in the doing surface (per-site in AllSitesView, the
"Anywhere in <site>" header in SelectedSiteView, and per-location
in SelectedSiteView). Tap = bulk-tick every undone chore in that
section through the existing `chore_completions.toggle` path so the
realtime contention + auto-derive-done flow stays intact. No new
RPCs; the `infra_swept` activity_log kind stops being emitted.

**Previous rounds + launch-out-of-block + cancel-current.**
`useChoreRuns` now pulls a 7-day rolling window (today + history),
exposes `historicalRuns` separately from today's `runs`, and gains
a `cancelRun(runId)` mutation. The chore_runs state check
constraint added a `'canceled'` value. Cold-open screen restructured
into a scrollable column: the natural-next-block CTA at the top, an
"Or pick a different block" picker below (every active block other
than the suggested one, ordered by today's start time, tagged
"done today" / "canceled today" where applicable), then a
"Recent rounds" list of today's done/canceled + recent days with a
Resume action on done runs. DoingSurface header gets a Cancel
affordance with a confirm prompt — flips state to `canceled`,
preserves `ended_at`, lands the user back on cold open.

**Out of scope — deferred to Batch 11.** The "(N days remaining)"
pill + bottom-grouping for anytime / multi-day chores. The math
depends on the last-chance-block setting that ships in Batch 11
alongside the Performance sub-tab and chore-window deadlines, so
this rides with that batch.

### Batch 11.1 — Last-chance block + days-remaining pill · `v0.10.2-alpha`
2026-05-07. First slice of the Batch 11 umbrella, scoped down to the
foundation that the Performance sub-tab + web push (still upcoming
as 11.2 / 11.3) consume. Picks up the pill work deferred from Batch
10.

**Schema** (migration 0009 amended in place per the pre-production
rule). `chore_definitions` gains `last_chance_block_id` — a nullable
FK to `chore_blocks` that names the deadline block for chores whose
window spans multiple blocks or days. NULL means the chore's normal
block window is the deadline (matches pre-11.1 behavior). Indexed
where set.

**Days-remaining helper** (`lib/chores.js`). New `choreDaysRemaining`
walks a chore's frequency window — `weekly_window` /
`monthly_last_week_window` resolve their `latestDay` against today;
"anytime" daily chores collapse to "due today". Returns one of
`{ kind: 'days', days: N }`, `{ kind: 'today' }`,
`{ kind: 'overran' }`, or `null` (single-block daily chores). The
"overran" branch fires once today's resolved last-chance-block
window has ended, so the pill flips automatically without a
refresh.

**`<ChoreRemainingPill>`** (new shared component). Tinted glanceable
pill rendered next to chore titles wherever the helper resolves.
Re-ticks once a minute so "due today" can flip to "overran" at the
deadline-block end. Three tones: neutral (days), accent (today),
warn (overran).

**Surfaces:**
- **Today tab** — every `TodayChoreRow` shows the pill next to the
  category / deadline meta line. Window chores within a block sort
  to the bottom of the block bucket so the strict "do this now"
  daily chores read first; the pill carries the urgency for the
  rest.
- **All chores tab** — the pill appears on `SecondaryRow` (next to
  the frequency chip) so the chore list at a glance answers "which
  of these have a deadline pressing?".
- **Rounds doing surface** — `ChoreCheckRow` shows the pill inline
  with the chore title, so picking up a window chore mid-rounds
  surfaces its remaining-window context.

**Editor.** `ChoreInlineEditor` gains a "Deadline block" picker
under "When", with helper text explaining when the field matters.
Picker is always visible (inert for non-window single-block chores),
matching the simplicity of the existing block picker. The
`useChoreDefinitions` hook maps `last_chance_block_id` ↔
`lastChanceBlockId` on read + write.

**Out of scope — deferred to Batch 11.2 / 11.3.** Performance
sub-tab on the Chores page (start-time histogram per block, duration
trend, late-start rate, overrun rate) and web push notifications on
chore_run state transitions. They build on the deadline math 11.1
ships.

### Batch 11.2 — Performance sub-tab · `v0.10.3-alpha`
2026-05-08. Second slice of Batch 11. New "Performance" tab on the
Chores page (between Blocks and Activity log), reading run history
straight from `chore_runs` so no schema work was required. Built
on the run-metrics math that Batch 11.3 (web push) will reuse for
its on-time / overran payload variants.

**`useRunHistory` hook.** Read-only loader for the last 30 calendar
days of `chore_runs`, sharing the realtime channel approach with
`useChoreRuns` but without any mutations. Pulls `block_id`,
`run_date`, `state`, `started_at`, `ended_at` only.

**`lib/runMetrics.js`.** Pure helpers operating on the camelCase
run + block shapes. Sun-event blocks resolve their nominal window
against each run's `run_date` (parsed as local-noon to dodge DST
edges) so a run from three weeks ago is compared to THAT day's
sunrise / sunset, not today's. Surface API:
`runStartMinutes` / `runEndMinutes` / `runDurationMinutes`,
`nominalStartMinutes` / `nominalEndMinutes`, `runIsLate`,
`runOverrunMinutes` / `runOverran`, `summarizeRuns(runs, block)`
returning count + late-start rate + overrun rate + median /
IQR duration + median start delta, and `histogramBins` with a
configurable bin width and pad-before / pad-after on the time
domain.

**`<ChoresPerformanceTab>`** renders one card per active block,
ordered by `sortOrder`. Each card shows:
- **Stats row** — Late-start rate %, Overrun rate %, Median
  duration with IQR sub-line (`p25 – p75`), and Median start as
  "+8m late" / "3m early" / "on time".
- **Start-time histogram** — inline-SVG bars over absolute
  time-of-day, 10-minute bins, with a dashed accent vertical line
  at the median nominal start and a fainter warn line at the
  median nominal end. Bars left of nominal start render in
  muted text colour; in-window bars use the body text colour;
  past-nominal-end bars use the warn colour. Hour ticks under
  the X-axis baseline.
- **Duration trend** — chronological dot/line chart with a
  faint accent IQR band, dashed median line, and a dashed warn
  line at the block's nominal duration. Points that exceeded
  nominal duration render in warn so over-window runs read at a
  glance.

Empty / sparse-data states are explicit: blocks with zero
completed runs in the window get an italic "No completed runs in
the last 30 days" line; the whole tab returns a single "Add a
block and run a few rounds…" card if no active blocks exist.

Per the chores-accountability rule (no per-person splits, no
"DNF" framing), the tab surfaces only block-level aggregates and
treats every run as `done` with an `overran` flag — no comparison
between James and his dad anywhere.

**Out of scope — deferred to Batch 11.3.** Web push notifications
on chore_run state transitions. The on-time / overran payload
variants are computed via the run-metrics helpers landing here, so
11.3 is the service-worker + push-subscription plumbing only.

### Batch 11.3 — Web push notifications · `v0.10.4-alpha`
2026-05-08. Closes the Batch 11 umbrella (and the chores overhaul
through Batch 12). New migration `0011_push_notifications.sql`,
PWA manifest + service worker, a new Settings section, a
notification trigger wired into `endRun`, a Netlify function that
fans out the push, and a one-shot VAPID generator script.

**Schema** (`migration 0011`). `push_subscriptions` table: one row
per (user, device), keyed by endpoint, with the AES128GCM keys
(`p256dh`, `auth`) the server side needs to encrypt payloads. RLS
locks reads + writes to the row's own `user_email`; the Netlify
function reads cross-user with the secret key (RLS bypass).
`chore_runs.notified_at` is a nullable timestamptz idempotency
marker — the function claims a run with a single
`UPDATE ... WHERE notified_at IS NULL`, so concurrent end-clicks
only ever produce one push.

**PWA shell.** `public/manifest.webmanifest` (standalone display,
brand-anchor theme color, the existing logo as the icon),
`public/sw.js` service worker handling `push` events with
`showNotification` and a click-to-focus / open-window flow that
lands the user on `/chores`. `index.html` references the manifest
and a `theme-color` meta. The SW deliberately doesn't cache app
shell yet — that's offline-tolerance work in Batch 33.

**`usePushNotifications` hook.** State surfaces feature-detection
(`support`), permission state, current subscription presence,
pending mutation flag, error, plus two derived flags:
`needsInstall` (true on iOS Safari outside the installed-PWA
context, since iOS only delivers push to home-screen-installed
PWAs) and `missingVapid` (true when `VITE_VAPID_PUBLIC_KEY` is
unset). Actions: `enable()` requests permission + registers SW +
subscribes via PushManager + upserts the row;
`disable()` deletes the row + unsubscribes.

**Settings page** gains a Notifications section with a single
Enable / Disable button per device, status copy that explains
each disabled-state, denied-state error reporting, and an iOS
"add to home screen first" hint when applicable.

**Trigger.** `useChoreRuns.endRun` fires a fire-and-forget POST
to `/.netlify/functions/notify-run-done` after the DB UPDATE
succeeds. The function is idempotent on its own, so a missed
client-side post just means nobody got notified for that one run
— the run state itself is unaffected.

**Netlify function** (`notify-run-done.mjs`). Receives `{ runId }`,
atomically claims the run via the notified_at lock, fetches the
block, computes the on-time / overran payload (sun-event blocks
resolve their nominal end against the run's run_date — same math
the Performance tab uses), then iterates `push_subscriptions` and
sends a VAPID-signed push to each. Stale subscriptions
(HTTP 410 Gone, 404 Not Found) get deleted in the same pass.
Uses the existing `web-push` npm package (added to deps), bundled
via Netlify's esbuild runtime.

**One-shot setup.** `scripts/generate-vapid-keys.mjs` prints the
env-var lines to drop into `.env.local`
(`VITE_VAPID_PUBLIC_KEY=…`) and the Netlify dashboard
(`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`).
`.env.example` updated to document the new vars.

**Payload format** (sent through the push pipeline as JSON):
`{ title, body, runId, blockName, durationMinutes, overranMinutes, kind }`
where `kind` is `"on_time"` or `"overran"`. Title reads
"Morning rounds done"; body is `"1h 12m"` on time or
`"1h 47m, overran 22m"` when over the window — matches the
in-app Performance numbers exactly.

### Batch 12 — Chore assignment rules engine · `v0.10.5-alpha`
2026-05-08. Closes the chores overhaul umbrella (Batches 7–12).
Default assignments for chores expressed as a small day-of-week
DSL — captured as data instead of in James's head, so every
surface that asks "who's on this chore today?" reads from one
source.

**Schema** (`migration 0012`). New `chore_assignment_rules` table:
`(scope, scope_id, days_of_week int[], assignees text[], priority,
is_active)`. Two scopes: `'chore'` (one chore_definitions row,
scope_id is the chore's text id) and `'block'` (one chore_blocks
row, scope_id is the block's uuid as text). The discriminator
means `scope_id` can't be a real FK, so two ON DELETE triggers
mirror the cascade behavior — deleting a chore or block purges
matching rules. RLS unchanged from the project default; realtime
publication added so the rules editor live-updates.

**Resolver** (`lib/chores.js`). `resolveAssignees(chore, date,
{ rulesByChoreId, rulesByBlockId })` returns a string[] of
resolved names. Precedence (first match wins): active
chore-scoped rule whose `days_of_week` contains the day-of-week
ordered by priority desc → active block-scoped rule for the
chore's `block_id` ordered the same way → legacy
`chore.assignment.byDayOfWeek[dow]` → legacy
`chore.assignment.default` → empty list. The legacy
`resolveAssignee` becomes a thin wrapper joining names with
" · " so existing single-name callers keep working without
edits — multi-assignee rules render as e.g. `"James · Jim"` in
the meta line.

**`useChoreAssignmentRules` hook.** CRUD + realtime; surfaces
`rules`, two pre-bucketed maps (`rulesByChoreId`,
`rulesByBlockId`) ready for the resolver, plus
`createRule` / `updateRule` / `deleteRule`. Sanitizes incoming
days-of-week (de-duped, integer-clamped 0–6) and assignees
(de-duped, trimmed) so malformed payloads can't reach the DB.

**`<AssignmentRulesEditor>`** (new shared component). Reusable for
either scope. Lists existing rules with a day-letter chip strip
("S M T W T F S" highlighted by membership) → arrow → assignee
join. New-rule form: day toggle chips + assignee toggle chips
(currently a hardcoded James / Jim list — same names the
fake-auth picker uses). "Next 7 days preview" runs the real
resolver against today + 6 so the reader sees exactly what the
engine will produce, including legacy fallbacks.

**Mount points:**
- **Chore inline editor** — chore-scoped rules editor under the
  existing fields. The preview uses the chore being edited so
  the reader sees rules + that chore's legacy assignment field
  resolved together.
- **Block editor** — block-scoped rules editor folds in below
  the start / duration row. The preview uses a synthetic chore
  carrying just the block id, so it reflects what every chore
  in this block would inherit by default.

**Display.** `expandChoreForDay(chore, date, ruleOpts)` returns
both `assignees: string[]` (the new shape) and `assignee: string`
(the back-compat join). `getChoresForDay` accepts the same opts
and forwards. `Today` tab + `Overview`'s upcoming-chores card +
schedule-at-a-glance rollup all thread `{ rulesByChoreId,
rulesByBlockId }` through. Today's "Mine" filter widens to
include any chore whose assignees array contains the current
user — matches the semantics of "Wed/Sat/Sun = both."

### Batch 13.1 — Events foundation (data layer) · `v0.10.6-alpha`
2026-05-08. First slice of the Events + Schedule overhaul, scoped
to the data layer only. Existing surfaces (Schedule, AllEvents,
EventKindPage, dashboard rollup) keep rendering unchanged — the
schema swap is invisible to them. EventEditor + the override-
trigger half of lazy materialization land in 13.2.

**Schema** (`migration 0013`). Five new tables plus a view:
- `event_series` — the rule. RFC 5545 RRULE string in `rrule`,
  with `dtstart` / `until`, optional `season_window` jsonb (e.g.
  `{ start: "05-14", end: "09-21" }` for "every Saturday May 14
  → Sept 21"), `duration_minutes`, status, payload jsonb, plus a
  `legacy_instance_id` linking back to the pre-migration row for
  audit.
- `event_occurrences` — materialized rows for any series that has
  been touched (override / skip / drag-reschedule / GCal push).
  Lazy: pure recurring series with no overrides materialize zero
  rows; read-time RRULE expansion handles them.
- `event_links` — polymorphic glue between events and batches /
  projects / chores / inventory items / automations, with a `role`
  discriminator (arrival / pasture_move / processing / cleanout /
  delivery / milestone / phase_span / triggered_by). Exactly one
  of `series_id` / `occurrence_id` is set.
- `automations` — schema only; seed rules ship in Batch 15.
- `gcal_pushes` — schema only; the push job ships in Batch 15.

**`timeline_items` view.** Unions `event_occurrences` +
`chore_runs` with a `kind` discriminator so the calendar UI in
Batch 14 consumes one source. The view is the materialized half;
recurring-with-no-override series expand client-side.

**Migration of `event_instances`.** Each row becomes one
`event_series`. Recurring (legacy weekly-only JSONB) converts to
RRULE: `FREQ=WEEKLY;BYDAY=<DOW>;UNTIL=<season-end>` with
`dtstart` at season-start + start_time, `season_window` mirroring
the start/end MM-DD pair. One-off rows materialize a single
pre-populated `event_occurrences` row at their date — so one-offs
already live in the materialized half, matching the lazy-for-
recurring contract. Re-runnable: the loop skips rows whose
`legacy_instance_id` already has a series.

**`recurrence.js` rewritten.** Now an `rrule` (~30KB gz) wrapper.
Same `getEventOccurrences(eventsData, fromDate, toDate, filters)`
signature as before, so every existing caller keeps working.
Behaviour: recurring → rrule.js `between()` expansion + season-
window MM-DD filter + override merge (override times / location /
status win, `skipped` rows are dropped, off-rule override dates
pull in too — covers drag-rescheduled rows). One-off → straight
read of the pre-materialized occurrence. Per-series RRule cache
via WeakMap so repeated calls don't re-parse.

**`useReferenceData.loadEvents` rewritten** to read `event_series`
+ `event_occurrences` and shape one UI-facing instance per series.
One-offs surface their occurrence's date / start / end at the top
level so the legacy UI shape stays intact. Recurring instances
carry `rrule` / `dtstart` / `until` / `seasonWindow` /
`durationMinutes` / `occurrences[]` for the new wrapper to consume.

**`useTimelineItems` hook** (read-only). Loads the
`timeline_items` view between two ISO dates with a realtime
subscription on both underlying tables. Default range is the
current calendar month. The Calendar UI rework in Batch 14 is the
first consumer.

**Out of scope — deferred to 13.2.** EventEditor side panel /
sheet, two-tier recurrence editor, the universal three-button
"This / This and following / All" prompt, override-trigger
materialization. The schema, expansion, and read paths land here
so 13.2 only adds the editor + write paths.

### Batch 13.2 — EventEditor (interactive layer) · `v0.10.7-alpha`
2026-05-08. Second slice of the events overhaul. Event CRUD finally
exists. Drag-trigger and GCal-push triggers stay deferred to
Batch 14 / Batch 15 respectively.

**Hooks** (new). `useEventSeries` exposes `series` + `seriesById`,
`createSeries(input)`, `updateSeries(id, patch)`,
`deleteSeries(id)`, and `splitSeries(id, splitDate, newPatch)` —
the last is the "this and following" transaction (caps the old
series at the day before, inserts a new series with the patch,
re-parents override rows on/after the split date). Realtime-
subscribed. `useEventOccurrences` exposes `occurrences`,
`upsertOverride` (idempotent on `(series_id, occurs_on)` —
materializes on first write), `skipOccurrence`,
`unskipOccurrence`, `deleteOverride`. Optionally scoped to a
single seriesId.

**`<RecurrenceEditor>`** (new shared). Two-tier:
- Top tier — preset dropdown: None / Daily / Weekly / Monthly /
  Yearly / Custom. Picking a preset auto-generates a sensible
  RRULE from the series's dtstart (Weekly anchors to dtstart's
  day-of-week, Monthly to its day-of-month, Yearly to its
  month + day).
- Bottom tier — Custom dialog (Apple Calendar macOS pattern):
  frequency, every-N interval, BYDAY toggle chips for weekly,
  BYMONTHDAY for monthly, BYMONTH + BYMONTHDAY for yearly, ends
  Never / On <date>. Outputs a flat RRULE string + UNTIL ISO.

**`<EventScopePrompt>`** (new shared). The universal three-button
"This event / This and following / All events" dialog. Each
button has its own subtitle explaining the consequence
("Splits the series at this date and applies the change going
forward.") so users don't have to think about the model.

**`<EventEditor>`** (new). Side-panel on desktop / full-height
sheet on mobile. Holds title, subtitle, kind, date, start /
end, recurrence (via `<RecurrenceEditor>`), location (name +
address), and notes. Save flow:
- New event → `createSeries`; if non-recurring, also pre-
  materialize the single occurrence so the read pipeline
  surfaces it without RRULE expansion.
- Edit one-off → no scope prompt; updates series and the
  materialized occurrence in lockstep.
- Edit recurring → opens scope prompt:
  - This event → `upsertOverride` materializes a single
    override row (first-override trigger lives here).
  - This and following → `splitSeries` caps the old series and
    inserts a new one with the edited rule.
  - All events → updates the series rule itself.
- Delete recurring → same prompt, mapped to skip-this /
  cap-from-this / delete-series.

**Wiring.** App.jsx `eventSeed` state replaces the previous
`scheduleDetail` modal route. Schedule.jsx click → seed `{ mode:
'edit', seriesId, occurrenceId, occursOn, kindId }`; new "+ New
event" button on Schedule → seed `{ mode: 'new', occursOn:
today }`. The old `<DetailModal>` is removed; `SyncNotice` strip
removed too (the Planned-feature warning is now stale — push-
only GCal sync ships in Batch 15).

**Out of scope — deferred to Batch 14 / 15.** Drag-to-reschedule
+ drag-to-resize (Batch 14, alongside the Calendar UI rework).
GCal push trigger materialization (Batch 15). The two
remaining lazy-materialization triggers from the events plan.

### Batch 14.1 — Calendar rework (views) · `v0.10.8-alpha`
2026-05-08. First slice of the calendar UI rework. Schedule
becomes a single page hosting four view modes; `AllEvents.jsx`
folds in as the Agenda view. Drag-to-reschedule, processing-day
workspace, and the per-kind flyout collapse stay in 14.2.

**View toggle.** Day / Week / Month / Agenda. Mobile defaults
to Day; desktop to Month. The picker is sticky after the first
tap so we don't auto-flip on resize.

**Time-of-day rail (Day + Week).** Banded chore-block
backgrounds — option C from the workshop mockup. The window
spans 5 AM → 10 PM (17 hours) at 0.9px / minute (54px per hour).
Sun-event blocks resolve their nominal window per-day so the
"Evening rounds" amber band lands at today's actual sunset, not
yesterday's. Half-hour ticks under hour grid lines, a live
"now" indicator on today's column (red-line + dot, ticks once a
minute via re-render), and a greedy left-to-right column packer
spreads overlapping events into side-by-side mini-columns.

**Date-typer header** (`<DateTyperPopover>`). Clicking the
month/week/day label opens an input that parses "today" /
"tomorrow", "Aug 2027", "Sep 14, 2026", "9/14", and ISO
"2026-09-14". Bare "Sep 14" jumps forward a year if today is
already past it, mirroring Notion Calendar's "next match" logic.

**Calendar math** (`lib/calendarMath.js`). Pure helpers reused
across views: `blockToBand` (chore_block → rail rectangle, sun-
event aware per-date), `eventToBlock` (occurrence → top/height
inside the rail), `layoutOverlappingEvents` (greedy column
packer for side-by-side rendering), `advanceDate` (prev/next by
view unit), `formatViewLabel` (month / week-range / "Thursday,
May 8, 2026" — consistent header across views), plus
`startOfWeek`, `isSameDate`, `isoDateLocal`, `hhmmToMinutes`.

**`<CalendarViews>`** holds `<DayView>`, `<WeekView>`,
`<MonthView>`, and `<AgendaView>`. MonthView is the existing
six-week grid, evolved with Tailwind classes and the new event-
kind colour mapping; WeekView is a 7-column rail with the same
banded backgrounds; AgendaView is the chronological list that
used to live in `AllEvents.jsx`.

**`AllEvents.jsx` deleted.** The `events_all` section now mounts
`<Schedule initialView="agenda" />` from `SectionContent`, so the
deep link survives — clicking "All events" in the sidebar lands
on Schedule with the Agenda view selected and a today→+12-month
date range. The standalone Timeline view that lived in the old
Schedule is retired (Agenda subsumes it).

**Out of scope — deferred to Batch 14.2.** Drag-to-reschedule +
drag-to-resize on Day / Week views. Click-empty-space → new
event seeded with that time slot. Per-kind flyout collapse +
nav restructure to the single "Event types" entry. Processing-
day workspace at `/events/processing/:id`. Visual conflict-dot
lint on event-over-block overlap.

### Batch 14.2 — Drag interactions + processing workspace · `v0.10.9-alpha`
2026-05-08. Closes the Calendar UI rework. Triggers + GCal push
(Batch 15) and animal-lifecycle pages (Batch 16) are the
remaining slices of the events overhaul.

**`useEventMutator` hook.** High-level wrapper over
`useEventOccurrences.upsertOverride` that the calendar views call
on drop:
- `moveOccurrence({ seriesId, fromDate, toDate, newStartTime,
  newEndTime })` — same-date moves upsert the override at the
  date with the new times. Cross-date moves skip the source
  (status='skipped' tombstone) and upsert a fresh row at the
  destination. Recurring + one-off use the same flow because the
  recurrence reader was extended (in this batch too) to look past
  skipped rows.
- `resizeOccurrence({ seriesId, occursOn, newStartTime,
  newEndTime })` — pure same-day retime.

**Drag-to-reschedule on Day + Week.** New `useRailDrag` hook
inside `CalendarViews.jsx`. Pointer events ride out to the
document so a fast drag doesn't lose its pointer when the
cursor leaves the small event-block hit area. 15-minute snap
on retime. Cross-column hops on Week view hit-test against
each column's bounding rect — drop on Thu, the override anchors
to Thu's date. Visual feedback uses CSS translate on the
original block; the column packer re-runs after the realtime
echo.

**Drag-to-resize on Day + Week.** Bottom 8px of every event
block is a resize hit zone (`cursor-ns-resize`). Dragging it
extends / shortens the block; minimum length is enforced at the
SNAP_MIN of 15 minutes.

**Drag-to-reschedule on Month.** Separate `useGridDrag` hook
walks the 42-cell ref array on pointer up; drop on a different
cell → `moveOccurrence` with the target ISO date and the
original times preserved. Hovered target cell gets an accent
outline; a small floating label follows the cursor while
dragging.

**Click empty rail / cell → new event.** The Day / Week column
host element fires its own click only when the click target is
the host itself (not a bubbled event-block click). Translates
the cursor's y-position into a snapped HH:MM and seeds the
EventEditor with `{ mode: 'new', occursOn, startTime }`. Month
cells do the same with the cell's date and a 9 AM default.

**Conflict-dot lint.** New `bandsOverlapEvent` helper checks
whether an event's resolved rail rectangle intersects any
chore-block band on the same date. Day / Week event blocks
render a small amber dot in the top-right when overlapping —
the visual cue from the original mockup.

**Recurrence reader robustness.** `expandOneOff` now collects
every non-skipped occurrence row instead of trusting
`occurrences[0]`, and `loadEvents` picks the first non-skipped
occurrence for legacy `instance.date` shaping. Together these
fix the post-drag display: a one-off whose original row was
tombstoned `skipped` and whose canonical row moved to a new
date renders at the new date everywhere.

**Per-kind flyout collapse + nav restructure.** Top-level
`events_all` removed from the sidebar. The `events_all_types`
flyout renames to **Events** and now hosts every event-related
nav target as children:
- "All events" → Schedule with Agenda view, no filter.
- Per-kind children → Schedule with that one kind's filter
  pre-applied. The hosting `<Schedule>` re-mounts on kind
  change (key={ek.id}) so the filter resets cleanly.
The standalone `EventKindPage.jsx` is deleted.

**Processing-day workspace** (`/events/processing/:id`). New
`Processing.jsx` page, reachable only via the EventEditor's
"Open processing details →" link on `processing_days` kind
events. Owns four fields stored on `event_series.payload`:
`cut_sheet`, `packed_crates`, `final_count`, `notes`, plus a
`resolved` toggle with `resolved_at` timestamp. Saves write
both the series payload AND the per-occurrence override's
`payload_override` so per-instance edits survive series-level
saves.

App.jsx tracks `processingTarget`; setting it replaces the
section content with the workspace and hides SectionHeader.
The workspace's Back button clears the target, returning the
user to whatever they had open.

**Out of scope — deferred to Batch 19 / 20.** Triggers v1
(feed reorder + broiler-batch lifecycle automations writing
linked event_links). One-way Google Calendar push with
`gcal_pushes` audit log. Animal-lifecycle pages with the
event-link-driven timeline strip. (These were the old Batch
15 / 16 slots before the Farm Map overhaul pushed the
events-overhaul tail to 19–20.)

### Batch 15 — Farm map: place-model foundation · `v0.10.10-alpha`
2026-05-31. The schema-down spine of the Farm Map overhaul
(Batches 15–18). Collapses the three overlapping place
vocabularies — `sites`/`site_locations`/`site_residents`,
the legacy `space_kinds`/`space_items`, and the free-text
`livestock_groups.current_location` — into **one recursive
`places` tree**. Migrations amended in place per the
pre-production rule (events + chores backed up first via the
new `scripts/backup-db.mjs`; see CLAUDE.md → Data safety).

**Schema** (migrations 0003/0004/0009/0010/0013 amended):
- `places` — recursive tree (`parent_id`, `name`, `kind`
  [farm/zone/area/structure], `kind_tag` [the secondary
  "sweep all coops" axis], `code`, `mobile`, `sort_order`,
  `is_active`). Geography is the primary axis.
- `placements` — polymorphic occupancy edge
  (`occupant_type`/`occupant_id`, one open row per occupant)
  replacing `site_residents`; covers livestock batches AND
  assets (machinery parked in the barn).
- `place_geometry` — `place_id → svg_layer_id` +
  centroid/footprint binding (shape only; the SVG lands in
  Batch 18).
- `chore_definitions`/`activity_log`/`chore_modifiers` repoint
  to a single `place_id` (drop the site/location pair + XOR);
  `log_run_event(… p_place_id …)`; `timeline_items` view gains
  `place_id`. Legacy `space_*` tables + `current_location`
  deleted.
- Re-seeded with the real North Foster Farm geography (House,
  Barn → High tunnel + "Fred" container, Brooders → Brooder 1
  + Mobile Brooder, Pastures A/B/C with chicken tractors 1–5
  and Mobile Coops 1–2), plus current cohort + machine
  placements.

**Client.** New `src/lib/places.js` (`buildPlaceTree`,
`descendantIds` subtree fan-out, `displayPlace`,
`placePath`). `useSites` rewritten as a places + placements
loader (CRUD incl. reparent + polymorphic occupant assign).
`SitesAdmin` is now a recursive place-tree editor (rename,
add-child, reparent, reorder, archive, mobile/kind/kind_tag/
code, occupants pane). Chores / Rounds / Observations /
QuickActionsTray repoint to `place_id` with subtree fan-out
(a chore on "Pastures" surfaces under every tractor/coop
beneath it); the legacy Resources → Spaces page is removed.

Mid-flight (high-priority bug fixes folded in, separate from
the place model): the calendar now reflects event
create/edit/delete **without a hard refresh**
(`useReferenceData` subscribes to `event_series` /
`event_occurrences` and re-loads the events slice), and the
EventEditor reads the **occurrence override** time so the
edit UI matches the time shown on the calendar month view.

Also folded in (security-linter cleanup ahead of rollout):
`timeline_items` recreated `with (security_invoker = on)` to
fix the SECURITY DEFINER view ERROR; `search_path = public`
pinned on every trigger function; and EXECUTE revoked on the
trigger-only functions (+ `anon` on `log_run_event` /
`edit`/`delete_activity_entry`) so they're not exposed as
PostgREST RPCs. New backup/restore tooling
(`scripts/backup-db.mjs` + `scripts/restore-db.mjs`) supports
the pre-rollout back-up → reset → restore loop.

**Out of scope (Batches 16–18):** per-place completion +
offline outbox, the Now surface + hardened Rounds, and the
map renderer + place pages + nav restructure. `place_geometry`
ships empty until the authored SVG lands in 18.

### Batch 16.1 — Per-place completions + occupancy fan-out · `v0.10.11-alpha`
2026-05-31. First half of Batch 16 (Farm map: per-place completion +
offline outbox), split when the batch started so the destructive
schema re-key lands separately from the client-only IndexedDB outbox
(16.2). Migrations 0002/0009/0010 amended in place per the
pre-production rule (backup → reset → restore loop run; all priority
tables verified non-empty before reset).

**Schema.** `chore_completions` re-keyed from one-row-per-(chore, day)
to per-place grain:
- 0002: the inline `unique (chore_id, completion_date)` constraint is
  removed from the create-table (uniqueness now lives in 0009, where
  `places` exists).
- 0009: `chore_completions.place_id` (nullable FK → places, on delete
  set null) + two partial unique indexes —
  `(chore_id, place_id, completion_date) where place_id is not null`
  and `(chore_id, completion_date) where place_id is null` — so both
  placed and chore-level rows get NULL-safe one-per-day semantics.
- 0010: both completion trigger functions redefined (supersedes the
  0002 / 0007 versions): `activity_log.place_id` is populated, the
  payload carries `place_id` + a denormalized `place_name` (renderers
  need no join), and the 10s check↔uncheck debounce now matches on
  place too (`is not distinct from`, NULL-safe) so un-checking MC1
  never cancels the feed entry for a fresh MC2 check.

**Occupancy-driven fan-out** (the design decision of the batch). A
chore scoped to place P fans into the places in P's subtree (incl. P)
that currently host a livestock batch (open `placements` row,
`occupant_type = 'batch'`). Machines never create obligations; an
unoccupied subtree falls back to a single obligation at P; placeless
chores keep one NULL-place obligation. Chores follow the animals —
move a batch and its obligations move with it. New pure helper
`obligationPlaceIds()` in `lib/chores.js`, reused by Rounds, Today,
the dashboard, and (Batches 17–18) place_status + the map tint.

**`useChoreCompletions` rewritten** to composite `(chore, place)`
keying: `isDone(choreId, placeId)`, `doneCountForChore(choreId,
placeIds)`, `toggle(choreId, placeId, done)`, and a batched
`toggleMany(choreId, placeIds, makeDone)` (one INSERT for all
remaining places / one DELETE for uncheck-all — replaces the old
sequential await loops). Optimistic + revert + realtime preserved.

**Surfaces:**
- **Rounds** — each (chore, place) obligation is its own check row
  under its place section; "X/Y done" headers and the run auto-done
  derivation count obligations; "All taken care of" uses the batched
  toggleMany.
- **Chores → Today tab + dashboard Upcoming card** — fanned chores
  render as one row with an "N of M" progress chip; expanding reveals
  per-place sub-checkboxes labeled name + bold parent (D1
  disambiguation). The main checkbox bulk-completes all remaining
  places (or un-completes all). Single-obligation chores look and
  behave exactly as before.
- **Activity feed** — completion lines read "completed Check / fill
  waterer · Chicken tractor 1".

Mid-flight: the restore-script bugs this reset exposed were fixed in
`scripts/restore-db.mjs` — `product_kinds` now inserts after
`livestock_species` (FK order; the cascade-delete + wrong order had
emptied it), `user_preferences` / `admins` get correct PK overrides
for the delete-all step, and the `timeline_items` view is excluded
from restore.

**Out of scope — Batch 16.2:** the device-local IndexedDB outbox,
"queued / not synced" indicator, guaranteed sync, and the additive
mortality merge policy.

### Batch 16.2 — Offline outbox · `v0.10.12-alpha`
2026-06-01. Closes Batch 16 (Farm map: per-place completion + offline
outbox). Client-only — no migrations, no DB reset needed. Every field
write (chore ticks, Notes, MASH intakes, mortality) now goes through a
device-local, append-only IndexedDB outbox instead of straight to
Supabase, so capture works with no signal and never silently loses
data.

**`lib/outbox.js`** (new). The core module — IndexedDB store
(`nff-outbox` / `ops`, auto-increment key = FIFO order), an in-memory
mirror, a subscriber API, and a sync engine:
- Op kinds: `completion_insert`, `completion_insert_many`,
  `completion_delete`, `completion_delete_chore`, `run_event`,
  `mortality_decrement`. Executors live in the module; `enqueueOp` is
  the only write entry point the rest of the app uses.
- Flush triggers: immediately after enqueue, on the `online` event, on
  visibilitychange → visible, and on an exponential-backoff retry
  timer (5s → 60s cap) while pending ops remain. The Web Locks API
  serializes flushes across tabs so two open tabs never double-replay
  an op; the flush pass re-reads IndexedDB inside the lock.
- Error classification: connectivity failures stop the pass and leave
  everything pending (retry later); permanent errors (RLS /
  constraint) mark the op `failed` and keep going. Failed ops stay
  visible in the indicator with Retry / Discard — never silently
  dropped.
- In-memory queue fallback when IndexedDB is unavailable (private
  browsing) — no reload survival, but the session still works.

**Conflict policy** (per the going-in spec — deliberately not a CRDT):
- *Completions are idempotent row-presence inserts/deletes.* A unique
  violation on replay means another device already did it → the
  executor returns the existing row as success. Batched inserts
  select-then-insert-missing, with a per-row fallback on races.
- *Counts (mortality) merge ADDITIVELY.* The op carries a delta, and
  the executor applies it against the cohort count read at sync time —
  two offline phones each logging "1 dead" sum to 2. The Batch 8.3
  auto-move-out (cohort empties → close open placements) moved into
  the executor so it happens when the decrement actually lands.
- *Run events are append-only* activity_log rows, at-least-once
  delivery; the original capture time rides in `payload.captured_at`
  since the RPC stamps `occurred_at` at sync time.

**`useChoreCompletions` rewritten** (write path). Toggles never call
Supabase directly anymore — `toggle` / `toggleMany` append ops and
return immediately. Displayed state = server rows (initial load +
realtime) overlaid with the queue's not-yet-synced ops, replayed in
order so check-then-uncheck-offline nets out correctly. The old
silent-revert-on-network-error behavior is gone. New `isQueued(chore,
place)` read. Reconciliation details:
- When an op syncs, its confirmed rows fold straight into the server
  map so nothing flickers in the gap before the realtime echo.
- Realtime doesn't replay events missed while offline, so server rows
  refetch on reconnect — but only after this date's queued ops finish
  syncing, so a stale fetch can't clobber reconciled rows.

**`useRunEvents`**: `logRunEvent` now enqueues; new `logMortality`
helper queues the observation row + the additive decrement as a pair.
`QuickActionsTray`'s MortalitySheet drops its direct
`livestock_groups` UPDATE + move-out logic and calls `logMortality`.

**"Queued / not synced" indicator** (new `<OutboxIndicator>` +
`useOutbox` hook). Mounted in the TopBar (global), the Rounds doing-
surface status bar, and the Rounds cold open. States: "Offline · N
queued" (warn), "Syncing N…", "N not synced" (tap to flush now), and
"N couldn't sync" with Retry / Discard. Per-row: a small CloudOff
glyph next to any chore title whose tick is still sitting in the
outbox (Rounds check rows, Chores Today rows + place sub-rows,
dashboard Upcoming rows).

**Rounds auto-done guard.** Offline ticks now make a block read
"all done" while `chore_runs` writes still fail, which would have made
the auto-flip effect loop (fail → revert → re-render → retry). A
failed auto-flip now blocks further attempts until connectivity
returns. Full offline run-lifecycle support (start/end/cancel through
the outbox) is Batch 17 — hardened Rounds.

**Out of scope:** offline page *load* (app-shell caching is Batch 36 —
the outbox guarantees writes survive, but a hard refresh with no
signal still can't boot the app), and offline `chore_runs` lifecycle
writes (Batch 17).

### Batch 17 — Farm map: Now surface + hardened Rounds · `v0.10.13-alpha`
2026-06-01. The phone rollout. Client-only — no migrations, no DB
reset. Phones now land on a time-anchored **Now** surface; the Rounds
takeover is hardened into the primary phone path with a fully offline
run lifecycle; and the derived `place_status` projection that will
drive the Batch 18 map tint ships as a pure client-side module.

**`lib/placeStatus.js`** (new). The `place_status` projection as pure
functions — no table, no view. `computePlaceStatus()` folds chore
definitions + occupancy fan-out (`obligationPlaceIds`) + today's
completions into per-obligation status (`due` / `overdue` / `done`)
and a per-place rollup propagated up the place tree (an obligation at
Mobile Coop 1 also counts toward Pasture B and the farm root), plus a
`flagOf(placeId)` accessor for the Batch 18 zone tint. Overdue =
window chores past their last-chance block (`choreDaysRemaining` →
overran) or daily block chores whose block window has fully passed.

**`pages/Now.jsx`** (new) — the phone landing (decision 1):
- **D2 resume bar.** When a run is in progress on any device, a loud
  full-width accent bar ("Round in progress · Morning · 14:23 — tap
  to resume") with a live elapsed tick sits at the top and re-enters
  the takeover. This replaces the orphaned "rejoin from the sidebar"
  path as the canonical way back into a running round.
- **Fat start button.** No active run → one big "Start morning
  rounds" CTA driven by the same `nextBlock` logic Rounds uses,
  showing the block's start (sun-event aware) + duration.
- **Farm-wide due/overdue list.** Every (chore, place) obligation
  active today, bucketed Overdue → To do → Done (collapsed), sorted
  by block start time within each bucket. Each row carries its place
  as a **D1** tag (name + bold parent via the new shared
  `<PlaceTag>`), the per-row CloudOff queued glyph, and deep-links
  into Rounds for that chore's block.
- New `now` section in `sections.jsx` (lucide `Sunrise`, top of the
  sidebar above Dashboard); self-headered. `App.jsx` picks the boot
  landing by viewport: phone (`max-width: 639px`) → Now, desktop →
  Dashboard (the map becomes the desktop landing in Batch 18).

**Offline run lifecycle** (closes the Batch 16.2 deferral). Four new
outbox op kinds — `run_start` / `run_end` / `run_resume` /
`run_cancel` — and `useChoreRuns` rewritten outbox-first with the
same overlay pattern as completions:
- Mutations never call Supabase directly; they enqueue and return.
  Displayed state = server rows (load + realtime) overlaid with
  pending ops, so starting / finishing / canceling a run works in a
  dead zone, survives an app kill, and syncs when signal returns.
- Offline-created runs carry a client-generated uuid; executors
  reconcile against the natural `(block_id, run_date)` key, so a run
  started offline merges cleanly with a row another device created
  for the same block + day (unique-violation → update-existing).
- The run-done push notification now fires from the `run_end`
  executor at sync time (when the run actually persists) instead of
  from the hook.
- Rounds' Batch 16.2 auto-flip offline guard (`autoFlipBlocked`) is
  deleted — the auto-derive effect just works offline now.
- Email resolution switched `getUser()` (network round-trip) →
  `getSession()` (local cache) so lifecycle writes work offline.

**Hardened Rounds:**
- **Group-by toggle on the Switcher** (decision 4). "Place" (top-
  level place chips — geography, the default) or "Kind" (place
  `kind_tag` chips — "sweep all coops"). Kind mode groups
  obligations by tag with the same progress chips + bulk "All taken
  care of" affordance; selecting a kind drills to one section per
  specific place. Each axis keeps its own selection.
- **D1 capture context.** Every quick-action sheet (Note / MASH /
  Mortality) now leads with a prominent "Logging at" banner showing
  the resolved place as name + bold parent (or "General — whole
  farm"), above the existing picker. Check-row place sublabels
  switched to the same `<PlaceTag>` treatment.
- **Deep-linking.** `<Rounds initialBlockId>` lands the cold open on
  a specific block — how Now's list rows open the right round.
- Exit button copy updated: "run keeps going — resume from Now."

**Phone shell** (minimal slice; the full nav restructure is Batch 18).
The fixed sidebar is now desktop-only (`hidden sm:flex`); phones get
a TopBar hamburger that opens the same sidebar as an overlay drawer.
Main content padding tightened on phone widths; the version label
hides on phone to keep the TopBar uncluttered.

**Out of scope — Batch 18:** the map renderer + `farm-map_v1.svg`,
place pages, place search, the nav restructure to Now · Map/Places ·
Schedule · Do rounds, and the records drawer. The `place_status`
rollup ships here but nothing tints by it until the map exists.

### Batch 18.1 — Chore anchors (ownership model) · `v0.10.14-alpha`
2026-06-01. Inserted as the first slice of Batch 18 when James flagged
the place-only chore model as a rollout blocker: chores were vanishing
from Pasture B because the mobile coops (and their layers) had moved to
Pasture C — but those were never the *pasture's* chores to begin with.
The map renderer (now Batch 18.2) builds on top of this fix. First
**additive-only** migration (`0014`) — rollout began 2026-06-01, so the
amend-in-place / reset era is over; this applied to the linked DB with
a plain `db push`, no reset, after a safety backup.

**The model.** `chore_definitions` gains an *anchor* — what the chore
belongs to — which drives where its obligations surface:
- `place` — a specific place, occupied or not ("mow Pasture B").
  Obligation always at that place; never disappears when animals move.
- `occupied_place` — the pre-0014 occupancy fan-out, kept for
  brooder-style "whoever is currently brooding" chores.
- `place_kind` — every active place with a kind_tag ("power-wash nest
  boxes" → every coop, occupied or not).
- `species` — all active batches of a species; obligations follow the
  animals wherever they live. Optional `anchor_kind_tag` housing
  filter ("broilers, *in tractors*"); optional `at_place_id` fixed
  work place ("wash eggs" belongs to the layers but happens at the
  House).
- `batch` — one specific livestock group, same following + at-place
  semantics.
- `none` — whole-farm chore.

**Schema** (`migration 0014`). Five new columns on `chore_definitions`
(`anchor_type`, `anchor_kind_tag`, `anchor_species_id` FK,
`anchor_batch_id` FK, `at_place_id` FK — all ON DELETE SET NULL so a
deleted species/batch/place flags the chore as "needs re-anchoring"
instead of deleting or orphaning it), an enum check, partial indexes,
and a category-keyed backfill: tractors → broilers-in-tractors, coop
care → layers-in-coops, coop equipment (power wash / deep clean) →
every-coop, sheep → sheep, egg washing → layers-at-House, brooders →
occupied-place (unchanged behavior).

**Fan-out engine** (`lib/chores.js`). `obligationPlaceIds(chore, ctx)`
rewritten around the anchor types; returns `[]` when the anchor
resolves nowhere — the chore is *dormant* (no broilers in winter → no
tractor chores anywhere, instead of phantom obligations). New
`describeChoreAnchor()` ("Broilers · in tractors", "Layers · at
House", "Every coop") and `choreIsDormant()`. `useSites` now also
loads `livestock_groups` + `livestock_species` and exposes a single
`choreCtx` lookup bag that every fan-out call site consumes;
`computePlaceStatus` (Batch 17) takes `choreCtx` directly.

**All chores tab — recursive place tree** (the new default view).
"By place" renders the *full place tree* as nested accordion headers —
every level of nesting gets its own header, exactly mirroring how the
farm is organized. Chores land under the place their anchor currently
resolves to (one row per fanned obligation, with a "1 of N places"
hint), so coop chores read under wherever the coops are *right now*.
Headers with nothing beneath them auto-fold but stay visible — every
place is represented even when it has no chores yet. A "Whole farm"
section collects unanchored chores; a "Dormant" section at the bottom
keeps no-active-animals chores visible and editable instead of letting
them silently vanish. A–Z and Time-of-day sorts remain; the legacy
Category sort is retired.

**Editor.** The inline editor's "Where" select is replaced by a
"Belongs to" section: Animals (species or one batch, with "housed
in ___" + "work happens at ___" refinements) / A place (with an
"only where animals currently live" checkbox) / Every place of a
kind / Nothing — whole farm. The secondary-row place chip now shows
the anchor description and double-click opens the full editor.

**Surfaces updated to the anchor fan-out:** Rounds (switcher chips +
doing-surface obligations), Chores Today tab (dormant chores hidden),
dashboard Upcoming card, Now / place_status. All gain a loading guard
so animal-anchored chores don't flash as dormant while occupancy
loads.

**Verification.** Fan-out tested against the live DB: moving both
mobile coops (and their layers) to Pasture B moves all 23 coop-chore
obligations with them — nothing disappears, nothing phantom remains
at Pasture C; processing the broilers sends the 15 tractor chores to
Dormant instead of leaving them dangling at Pasture A.

Follow-up commit (same day, from field testing): canceled rounds get a
delete affordance (new `run_delete` outbox op), and the Today tab
re-groups as time-of-day block → place tree, reusing the All-chores
tree components generalized over their row type.

### Batch 18.2 — Farm map: map renderer + place pages + nav restructure · `v0.10.15-alpha`
2026-06-01. Closes Batch 18 and the Farm Map UI overhaul (Batches
15–18). The desktop landing (decision 2) and the IA overhaul that
started the project. Client-only — no migrations; `place_geometry`
rows are written by the app itself.

**Map renderer** (`public/farm-map_v1.svg` + `lib/farmMap.js` +
`<FarmMap>`):
- The authored SVG is committed to `public/` and fetched/parsed at
  runtime (`parseFarmMapSvg`). Background art (roads, the farm
  boundary) renders as-is; zone layers (House, Barn, Brooders,
  Pastures A–C) become interactive shapes.
- **Layer ↔ place binding**: an explicit `place_geometry` row wins;
  otherwise slug matching ("Pasture-A" ↔ "Pasture A"). Slug-derived
  bindings are persisted back to `place_geometry` (with centroids)
  the first time the map renders, so the table reflects reality and
  renames don't break the art.
- **Zones tint by `place_status`** (the Batch 17 projection): overdue
  → warn, due → accent, all-done → resolved, quiet → neutral, with
  the rollup propagating up the tree (a tractor's overdue chore tints
  Pasture A). Labels carry a live "N to do" count.
- **Click a zone → zoom** (CSS-transform animated viewBox fit) →
  child structures appear as **auto-laid-out pins** (grid inside the
  zone bbox; the v1 art has no structure geometry) sized
  counter-to-scale so they stay readable. Click a pin → that place's
  page; click the zone name plate → the zone's page; click outside →
  zoom back out.

**Place pages** (`pages/PlacePage.jsx`). Everything the dashboard
knows about one place: clickable ancestor breadcrumb, status flag,
"Who's here" (batches with species + count + since-date, machines —
subtree occupants link to their actual sub-place), "Chores here
today" (the place_status obligations for the subtree, deep-linking
into Rounds), "Places inside" (child cards with their own flags +
occupants), "Recent observations" (activity_log observation kinds
filtered to the subtree, with the standard edit/delete affordances),
and a "View on timeline" hand-off to Schedule.

**Place search** (`components/PlaceSearch.jsx`). The express lane:
searches names, codes (MC1, CT3), and current occupants (typing
"gold band" finds Mobile Coop 1), D1-disambiguated results via
`<PlaceTag>`, recents (localStorage) when focused-but-empty.

**Nav restructure** (the IA overhaul):
- The sidebar slims to the spatial/temporal surfaces: **Now · Farm
  map · Dashboard**, then Planning (Schedule / Events / Chores /
  Do rounds / Projects / Processes) and the Other log pages
  (What's coming / Activity / Observations / Notes / Threads).
- Everything that's a pure record moves to the new **records drawer**
  (`components/RecordsDrawer.jsx`) off the header avatar: Products,
  Sales, Animals, CRM, Communication, Resources (feed / suppliers /
  machinery / trailers / the place tree) + Settings. `RECORDS_GROUPS`
  in sections.jsx is the source of truth; `findSection` resolves both
  lists so deep links keep working.
- **The Resources flyout dissolves**: place-type placeholders
  (brooders, tractors, coops, pastures, containers) are deleted —
  the place tree is the source of truth, reachable from the map's
  "Edit places" button and the drawer's "Places" entry.
- **Desktop lands on the map** (decision 2); phones keep landing on
  Now, with the map as a secondary read-only view. The What's-coming
  page icon switches Map → Telescope, freeing the Map glyph for the
  actual map.

**Out of scope / deferred:** structure-level geometry in the SVG
(pins stay auto-laid-out until a future art pass), push deep-links
from search into a specific chore of the active run (search opens
place pages; place pages deep-link into Rounds), and the cmd-K
cross-entity palette (Batch 33 — place search here is the thin
slice).

### Batch 19 — Triggers (automations engine) · `v0.10.16-alpha`
2026-06-01. The automations half of the old "Triggers + GCal push"
batch. **GCal push is deferred** (folded into Batch 31) — James's
call mid-batch; the dirty-row watcher and push job ship there
instead. This batch also marks the production cutover: **the linked
DB is live**, migrations are additive-only from here on (CLAUDE.md
updated), and the linked project never gets reset again.

Migration `0015_automations.sql` (the engine lives in Postgres so
rules fire no matter which client writes the triggering row):

- **`automation_emissions`** — one row per firing: trigger payload,
  human summary, `status` (active / acknowledged / dismissed) +
  who/when/why columns. Provenance columns
  (`automation_emission_id`) on `event_series` and
  `chore_definitions` point everything a firing created back at it.
- **Seeded rules** (in the `automations` table from 0013, idempotent
  by name):
  * **Broiler batch lifecycle** (`batch_created`): AFTER INSERT on
    `livestock_groups` for the configured species → arrival event +
    pasture-move event (+3 weeks, configurable) + processing event
    (kind `processing_days`, +8 weeks, configurable, payload carries
    batchId/batchSize/breed) + brooder cleanout chore (move + 1 day),
    all linked to the batch via `event_links` roles
    arrival/pasture_move/processing.
  * **Feed reorder** (`inventory_reorder`): AFTER INSERT/UPDATE OF
    `on_hand` on `feed_types`; edge-triggered on crossing
    `on_hand <= reorder_point` and never stacks while an active
    emission exists for the same feed → "Place feed order" chore +
    "Receive feed delivery" event (today + lead_time_days), linked
    to the feed (`inventory_item`) and the chore.
- **One-time chores**: new `once` frequency type
  (`{"type":"once","date":...}`) — active from its date until
  completed; completion retires the chore (`retired_at`, set by a
  new trigger on `chore_completions`); the hooks filter retired
  rows out everywhere. New `one_time` chore category.
- **`feed_types.on_hand`** jsonb (+ `on_hand_updated_at`) so the
  reorder rule has a number to compare; editable on the Feeds page.
- **RPCs**: `acknowledge_automation_emission` (drops out of the
  Heads-up lane) and `dismiss_automation_emission` (reason logged to
  `activity_log`, emitted events end + occurrences skip, emitted
  chores retire).
- **Realtime**: `automations`, `automation_emissions`, plus
  `feed_types` / `chore_definitions` / `livestock_groups` join the
  publication (the chore_definitions realtime subscription had been
  silently dead).

UI:

- **"Heads up" lane** (`Overview.jsx`): full-width row-0 card, only
  renders when an automation has fired and nobody has triaged it.
  Sparkle + summary + fired-at per row; **Got it** acknowledges,
  **Dismiss** asks for a reason and tombstones what was created.
- **Sparkle provenance icons** on auto-created rows: chore rows
  (Chores Today + All-chores tree, Now obligations) and calendar
  events (day/week blocks, month chips, agenda rows).
- **Settings → Automations**: per-rule enable toggle, last-fired
  timestamp, and inline week-offset editors (pasture move /
  processing) for the broiler rule.
- **Feeds page**: editable on-hand amount per feed + "Reorder" warn
  badge when at/below the reorder point.
- **Species page → Add batch**: minimal create-batch form (name /
  count / arrival date) so the lifecycle automation has a UI
  trigger; full lifecycle pages are Batch 20. Hooks:
  `useAutomations` / `useAutomationEmissions`.

**Out of scope / deferred:** GCal push (→ Batch 31), per-breed
config overrides on the lifecycle rule (single species-level config
for now), automation rule creation UI (the two rules are seeded;
new rules are a migration).

### Batch 20 — Animal lifecycle pages · `v0.10.17-alpha`
2026-06-01. The batch detail page and the batch ↔ events relationship
inversion: the batch owns its dates, the events are derived. Client
only — no migration; everything reads/writes through tables that
already exist (event_links from 0013, batch_assignments from 0002,
placements from 0009).

**Batch lifecycle page** (`pages/BatchPage.jsx`, routed at
`/livestock/<species>/<batchId>`):
- **Lifespan timeline strip**: Arrival → Pasture move → Processing →
  Brooder cleanout, read from `event_links` (target_type='batch')
  with the series + occurrence embedded via one nested PostgREST
  select (`lib/data/useEventLinks.js`, realtime-subscribed). The
  cleanout milestone is the one-time chore, rendered as a chore pill.
- **The inversion**: each milestone shows an editable date input —
  editing it rewrites the underlying event (occurrence `occurs_on` +
  series `dtstart`). Clicking a milestone name opens the EventEditor
  for that event (the reciprocal wiring).
- **Where**: the batch's current placement (place name + since-date,
  deep link to the place page).
- **Chores tied to this batch**: the auto cleanout chore + anything
  anchored to the batch.
- **Delete with tombstone**: confirm dialog lists exactly what will
  happen — linked event series end + their scheduled occurrences
  skip (rows kept as history), one-time chores retire, the open
  placement closes, processing assignments delete, then the
  `livestock_groups` row deletes. Orphaned `event_links` survive as
  audit history.

**Routing** (`lib/router.js`): `/livestock/<species>/<batchId>` +
`pathForBatch()`; `SectionContent` renders BatchPage inside the
species section; species GroupCards are clickable links to their
batch page.

**Processing workspace batch-assign picker** (`pages/Processing.jsx`):
the real picker replacing the old EventKindPage stub. Lists every
batch of batch-tracked species with count + current location (from
placements); assigning upserts `batch_assignments` AND keeps the
`event_links` row in sync (retarget or create, role='processing') so
the batch's lifecycle strip shows the assigned processing day. A
"Lifecycle page" deep link jumps from the workspace to the batch.
App.jsx closes the workspace on any real navigation so deep links
out of it work.

Verified with a surgical live-DB test (16 checks: nested lifecycle
read, milestone reschedule, assignment upsert + link sync,
delete-tombstone semantics); all test rows cleaned up.

**Out of scope / deferred:** layers + sheep lifecycle pages (the page
renders for any species but the milestone strip assumes the broiler
arrival/move/processing shape — species-specific milestone sets come
with the species that need them), batch detail editing (count /
label / arrival-date edits still happen at creation only), and the
"add milestone" affordance for batches created before the automation
existed.

### Batch 21 — Inbox / "just a thought…" capture · `v0.10.18-alpha`
2026-06-01. The lightweight capture surface for ideas that aren't yet
projects or chores. Quiet by design — no push.

Migration `0016_inbox.sql`:
- **`inbox_items`** — body, created_by, created_at, `pinned`,
  `archived_at`, `sort_order` (drag position; pinned and unpinned
  groups have independent ordering spaces).
- **`inbox_item_reads`** — per-user read receipts (`item_id`,
  `user_email`, `read_at`); mark-unread deletes the row. RLS lets any
  admin read receipts but each user only writes/removes their own.
- Both tables join the realtime publication.

UI:
- **Top-bar capture** (`components/ThoughtCapture.jsx`): the
  lightbulb button drops a small textarea; ⌘↵ or "Capture" saves.
  The author's own read receipt is written automatically.
- **Notifications bell** (`components/InboxBell.jsx`, extended): now
  a combined dropdown — unread thoughts (with mark-read + a jump to
  the Inbox) above unaddressed chore messages; the badge counts both.
- **Inbox page** (`pages/Inbox.jsx`, sidebar → Other → Inbox):
  * Inbox / Archived tabs, unread count.
  * Pinned section on top; **drag-and-drop ordering** within each
    group (@dnd-kit — first use of the dependency); pin/unpin drops
    the item at the top of its destination group.
  * Per-item actions: mark read/unread, pin/unpin, archive /
    restore, delete-forever (archived + own items only), and
    **Promote to event** — opens the EventEditor with the thought
    prefilled (label + notes seeding added to the editor's new-mode
    derivation).
- New hook `lib/data/useInboxItems.js` (realtime, optimistic
  reorder).

Verified with a surgical live-DB test (10 checks: capture/ordering,
read receipts, pin/archive/reorder persistence, delete cascade).

**Out of scope / deferred:** editing a thought's text after capture,
cross-promotion to chores/projects (events only for now — chores
promotion makes sense once chore creation UI exists), and read-state
sync to the dashboard Heads-up lane (the bell is the notification
surface).

### Batch 22 — Projects subsystem rewrite · `v0.10.19-alpha`
2026-06-01. The full Project → Phase → Step → Checklist → Checklist
item hierarchy, replacing the flat Batch-4 stub table.

Migration `0017_projects_subsystem.sql` (additive — the existing
`projects` table gains columns, nothing is dropped):
- **`projects`** extended: `body_md` (markdown), `created_by`,
  `archived_at`, `sort_order`, `updated_at` + touch trigger.
- **`project_phases`** — ordered phases; explicit `completed_at`
  check-off or derived done (all steps complete) counts as a
  "milestone reached".
- **`project_steps`** — the unit of work: markdown body, `assignees`
  (jsonb display names, same convention as chore assignment rules),
  start/target dates, completion, sort order.
- **`project_checklists`** / **`project_checklist_items`** — Trello
  pattern: named checklists inside a step, checkable items inside.
- **`project_links`** — cross-links to other entities
  (`event_series` / `chore`; text target_id so non-uuid ids fit).
- **`project_dependencies`** — step-level "X blocks Y" edges with
  `shift_dependents`: when a predecessor's dates move, every
  transitive dependent shifts by the same number of days.
- **`project_attachments`** — metadata for Supabase Storage uploads;
  the `project-files` bucket is created in the same migration
  (storage policies attempted in a guarded block — newer hosted
  projects may need them added via the Dashboard).
- All 8 tables join the realtime publication; RLS is the standard
  admin-only pattern.

Completeness rule (`lib/projects.js`, pure functions): phases > 1 →
milestones drive the % ("x/y milestones reached"); phases == 1 →
steps drive it ("x/y steps complete"). The same module owns the
dependency date-shuffle math (`computeDependentShifts`, cycle-safe
transitive traversal).

UI:
- **Projects list** (`pages/Projects.jsx`, sidebar → Planning →
  Projects): Active / Completed / Archived tabs, new-project form,
  cards with status badge, progress bar + the verbatim copy, dates.
- **Project detail** (`pages/ProjectPage.jsx`, routed at
  `/projects/<projectId>`): inline-editable title/description,
  status select, archive/delete, start → target dates, markdown
  notes (write/preview), progress header, phase sections with
  drag-orderable step rows (@dnd-kit), per-phase milestone check-off
  and target date, links section, project-level files.
- **Step modal** (`components/ProjectStepModal.jsx`): the
  Trello-style card — done toggle, assignee chips (James/Jim),
  start/target dates (with the dependency-shift toast), markdown
  details, checklists with progress bars, Storage attachments,
  and the blocked-by / blocks dependency editor.
- **Markdown** (`components/Markdown.jsx`): marked + DOMPurify (new
  dependencies), `.md` styles scoped in styles.css.
- New hooks `lib/data/useProjects.js` (`useProjects` list-level +
  `useProject` detail-level, shared fetch-all core, realtime on all
  8 tables).
- **Dashboard + sidebar integration**: `loadProjects` in
  useReferenceData now excludes archived projects, computes progress
  for each, and the projects slice is realtime; the "This week's
  projects" card deep-links to project pages (replacing the
  "not implemented" alert); the schedule-at-a-glance project rows
  show the progress copy; fixed a pre-existing field-name bug
  (`p.start`/`p.end` → `startedAt`/`targetDate`) in the
  active-project filters.
- **Inbox**: "Promote to project" action (deferred from Batch 21) —
  a thought becomes a planned project and jumps to its detail page.

**Out of scope / deferred:** linking projects to places / other
projects (kinds are modeled, picker UI is events + chores only),
dragging steps between phases, proportional (vs same-delta) date
shuffle, and pulling assignees from the admins table (hardcoded
James/Jim, same as chore assignment rules).

### Batch 23 — Processes · `v0.10.20-alpha`
2026-06-02. Process templates tied to event kinds, the client-side
expansion engine, and the chore-modifier UI deferred from the chores
overhaul (Batch 7 created the table; this finally writes + renders
it).

Migration `0018_processes.sql`:
- **`processes`** — title, description, `is_active` (gates
  expansion), `lookahead_days` (default 60).
- **`process_steps`** — ordered steps with `offset_days` relative to
  the anchor event (negative = before). Two kinds: `task` (becomes a
  project step) and `chore_modifier` (writes a `chore_modifiers` row:
  target chore + action + text, priority 10 so process modifiers
  deterministically beat manual ones).
- **`process_event_kind_links`** — which event kinds trigger which
  process (many-to-many, unique per pair).
- **`process_expansions`** — one row per (process, series, date)
  expanded. The unique constraint IS the idempotency guard (two
  clients racing produce exactly one expansion). Mirrors
  automation_emissions' active / acknowledged / dismissed lifecycle;
  `created` jsonb records what was written so dismissal can undo it.
- Provenance columns: `projects.process_expansion_id`,
  `chore_modifiers.process_expansion_id` (both set-null on delete).
- All new tables + chore_modifiers join the realtime publication.
- **Seed**: "Processing day prep" (6 task steps, −7 days → +1 day)
  tied to processing_days — seeded DISABLED so nothing expands until
  James reviews it and switches it on.

Expansion engine (`lib/data/useProcessRunner.js`, mounted in
App.jsx): watches active processes + upcoming occurrences (client
side — occurrences are lazily materialized from RRULEs, so only the
client can see "this occurrence is now within the lookahead
window"). Each expansion creates the project (one phase, one step
per task, dated event date + offset), `project_links` +
`event_links` in both directions, and the chore_modifiers rows.
Pure planning math lives in `lib/processes.js`.

Modifier UI (`lib/modifiers.js` + `components/ModifierBadge.jsx`):
- Conflict resolution: priority desc, then newest — deterministic,
  no resolver modal (the chores-overhaul decision).
- **Stacked badges**: winner solid, losers ghosted behind it;
  tap-to-explain popover shows winner + losers + source ("Process" /
  "Added by hand") + the conflict rule.
- Surfaces: **Rounds** rows (ChoreCheckRow) and **Chores → Today**
  rows (TodayObligationRow) render the badge and apply the winner's
  effect — skip ghosts the row, replace swaps the title, prepend adds
  an instruction line, restrict_until overrides the deadline text.
  **Schedule-at-a-glance** rollups show an "N changed" count.
- `useChoreModifiers` is a shared singleton store
  (useSyncExternalStore) — one fetch + one realtime channel app-wide,
  so leaf rows can read modifiers without per-row subscriptions.

UI:
- **Processes page** (`pages/Processes.jsx`, sidebar → Planning →
  Processes — the coming-soon flag finally drops): process cards
  with inline editor (title, description, active toggle, event-kind
  chips, step editor with offset/kind/chore-picker), and the
  expansion log with per-expansion "Got it" / "Dismiss + undo".
- **Heads-up lane** (Overview): process expansions ride the same
  lane as automation emissions — Workflow icon, "See the project"
  deep link, acknowledge / dismiss with reason.
- **EventEditor**: "Process work on this event" section — the
  event-side view (prep project deep link + chore-change count).

Verified with a surgical live-DB test (41 checks: modifier conflict
resolution, expansion planning, idempotency constraint, full
expansion simulation, dismissal semantics, cascades); all test rows
cleaned up.

**Out of scope / deferred:** dismissal of a partially-failed
expansion retries nothing (visible in the expansion log instead),
modifier place-targeting UI (the column + resolution logic exist;
the Processes step editor doesn't expose a place picker yet), and
process-level "expand N days early" overrides per event kind.

### Batch 24 — Customers + Lists · `v0.10.21-alpha`
2026-06-02. The CRM foundation: a customer directory and named
lists. Fields workshopped with James — deliberately minimal (name,
email, phone, notes; everything else can come additively later).

Migration `0020_customers.sql`:
- **`customers`** — name, email (unique, case-insensitive), phone,
  notes, archived_at. Check constraint: at least a name or an email.
- **`customer_lists`** — title + purpose.
- **`customer_list_members`** — membership (list ↔ customer).
- All three realtime; standard admin RLS.
- **Seed**: James's existing 65-contact email list (egg drop /
  farmers market contacts), all members of one "Mailing list" — the
  list the Batch 32 farm-updates email blast will target.

UI (`pages/Customers.jsx` + `lib/data/useCustomers.js`):
- **Directory tab**: search across name/email/phone/notes, inline
  add/edit forms, archive / restore / delete-forever.
- **Lists tab**: list cards (title, purpose, member count); expanding
  manages members (add from a directory dropdown, remove).
- Sidebar wiring: CRM → Customers lands on Directory, CRM → Lists
  lands on the Lists tab, and the "Add new customer" action opens
  Directory with the form already open. All three drop their
  placeholder / coming-soon status.

**Out of scope / deferred:** address / tags / referral-source fields
(James's call — basics only), customer ↔ order linking (Batch 29
owns the orders model), and de-duplication tooling (the seed has one
likely duplicate — Renee Pepler appears under two addresses — left
for James to merge by hand).

### Batch 25.1 — Feed page group-cards redesign · `v0.10.22-alpha`
2026-06-02. First slice of the Animals & Feed UI overhaul. The Feed
page (Resources → Feed) becomes a group-cards layout grouped by
animal, with schedule-driven reorder projections and a feed-order
history. The Broilers/animals-pages half is Batch 25.2.

Migration `0021_feeds_overhaul.sql`:
- **`feed_types.species_id`** (FK livestock_species, nullable) +
  **`sort_order`** — the Feed page groups by species and
  drag-orders within each group. Seeded feeds backfilled
  (broiler starter/grower/finisher → broilers, layer feed →
  layers, sheep hay → sheep).
- **`feed_orders`** — one row per order placed: ordered_on,
  received_on, quantity jsonb, total_cost, supplier FK, notes.
  Realtime + admin RLS + updated_at touch trigger. The source of
  "last price paid" (total_cost ÷ quantity).
- **`fire_feed_reorder_automations()` replaced** — the auto-created
  order chore + delivery event now carry a snapshot of EVERY
  feed's remaining stock (text lines in the chore description,
  structured jsonb in the event payload), so orders get
  consolidated into one delivery instead of paying freight twice.

**Consumption + projection engine** (`lib/feedConsumption.js`):
- Daily consumption per feed is derived from the feed schedules:
  every assigned group's metered stage covering that group's age
  on a given day (per James's spec — every batch of animals is on
  a feed program; consumption is calculated, never guessed).
- `projectReorder` walks stock forward day by day (consumption
  changes as batches age through stages) until it crosses the
  user-defined reorder point → trigger date → snapped to the
  closest **business day on or before** the trigger (no weekend
  orders).
- Everything the schedules can't meter (free-choice stages, TBD
  stages, missing arrival dates, unit mismatches like hay tracked
  in bales but fed in flakes) surfaces as explicit caveats on the
  card instead of silently reading as zero.

**`useFeeds` hook** (`lib/data/useFeeds.js`): feed_types +
feed_orders with realtime, `updateFeed`, `reorderFeeds` (persists
sort_order, optimistic), `recordOrder` (optionally bumps on-hand
by the ordered quantity), `updateOrder`, `removeOrder`.

**Feed page rewrite** (`pages/Feeds.jsx`, Tailwind):
- Species group sections (ordinal order) + an "Other" group for
  non-animal-specific feeds; dnd-kit drag reorder within a group.
- Cards lead with **amount remaining** (inline-editable, commits
  on blur/Enter) and **next order date**; **last price paid** is
  the secondary line (catalog price as fallback until orders
  exist).
- **Consolidation banner** when any feed is at/below its reorder
  point or projected to hit it within 14 days — lists every
  feed's stock so the order can be combined into one delivery.
- Per-card "Record order" form (quantity, total cost, date,
  supplier, notes, add-to-on-hand toggle) + expandable past-order
  history with delete.

`loadFeeds` in useReferenceData also exposes the new
speciesId / sortOrder fields app-wide.

**Out of scope — Batch 25.2:** the Broilers/animals pages
(Activity Log tab, feed schedule editor replacing the "Manage
feed" placeholder, placement fix on group cards, Tailwind
migration of SpeciesPage). The schedule editor is what makes the
projections here fully accurate — today most production stages
are free-choice/TBD, so cards lean on the caveat line.

### Batch 25.2 — Animals pages rethink · `v0.10.23-alpha`
2026-06-02. Closes the Animals & Feed UI overhaul (Batch 25). The
animals pages get a real activity log, the feed schedule editor
the 25.1 projections depend on, placement-aware group cards, and
a full Tailwind migration.

Migration `0022_feed_schedules_realtime.sql` (publication-only —
no schema or data changes): adds `feed_schedules` +
`feed_schedule_stages` to the realtime publication so editor
changes stream live to the Feed page projections on every open
client.

**Feed schedule editor** (`pages/FeedSchedulesPage.jsx` +
`lib/data/useFeedSchedules.js`) — replaces the "Manage feed"
coming-soon placeholder under Animals:
- Per-species schedule cards: inline rename, delete, description,
  and assigned-groups toggle chips (new schedules default to
  every current group).
- Stage rows expand into an inline editor: name, day range
  (from/to, blank = ongoing), feed type picker, consumption
  segmented control (Metered / Free choice / TBD; metered →
  amount + unit + per-batch/per-bird basis), notes. Non-metered
  stages get a "can't be projected" nudge.
- Stage ordinals re-derive from start_day on every write —
  chronological order is the only order.
- `describeConsumption` helper added to lib/feedConsumption.js,
  shared by the editor, species pages, and Feed page.

**SpeciesPage rewrite** (Tailwind, all five tabs):
- **Groups** — cards read where each group actually lives from
  `placements` (the dead currentLocation column is finally
  unread); place name links to its place page. Add-batch form
  notes that the arrival date anchors the feed schedule.
- **Feed schedule** — Tailwind read view + "Edit schedules"
  button into the new editor.
- **Chores** — now also picks up chores anchored via
  anchor_species_id / anchor_batch_id, not just tag matches.
- **Activity log** — real implementation (was a stub):
  chore completions on species chores, mortality + cohort moves
  on its groups, MASH intakes + notes at places its groups
  currently live. Same ActivityRow edit/delete affordances as
  the global Activity page.
- **More info** — Tailwind.

`useReferenceData` keeps `data.feedSchedules` live (subscribes to
both schedule tables) so the Feed page's projections update the
moment a schedule is edited.

**Out of scope:** BatchPage already shipped mostly-Tailwind in
Batch 20 and was left alone. Per-batch metrics (FCR, ADG,
mortality trend) remain Batch 26 (Metrics & analytics).

### Batch 26.1 — Metrics foundation + capture · `v0.10.24-alpha`
2026-06-02. First slice of the Metrics & analytics subsystem
(Batch 26): the data foundation, the capture surfaces, and the
per-cohort metric cards. The Metrics page (registry view +
cross-batch comparison) and the dashboard weeks-remaining widget
are Batch 26.2.

Migration `0023_metrics_foundation.sql`:
- **`metrics`** — the metric registry: id, name, formula
  description, unit, applies_to (broiler_batch / layer_flock),
  target range, ordinal. Seeded with 10 definitions: broiler FCR
  (pasture target 2.2–3.0), ADG, uniformity CV (under 8% = tight),
  mortality, weeks remaining; layer hen-housed production (target
  280–320/yr), feed per dozen, feed per lb egg mass, body weight
  trend, mortality.
- **`weight_samples`** — one row per weigh-in session; `weights`
  is a jsonb array of individual bird weights (the uniformity /
  CV metric needs the spread, never just the average).
- **`egg_collections`** — one row per egg-count capture per flock.
  Distinct from egg_lots (carton inventory): this is the
  production record. Client-suppliable uuid so offline-outbox
  replays are idempotent.
- **`livestock_groups.placed_count`** — birds the cohort started
  with; `count` is live (mortality decrements it), so metrics
  need the original denominator. Backfilled as count + logged
  mortality; the add-batch form now sets it on creation.
- **`livestock_species.target_process_weeks`** — seeded to 7 for
  broilers; drives weeks-remaining when no processing event is
  scheduled.
- Admin RLS + realtime on all three new tables.

**Metrics engine** (`lib/metrics.js`, pure functions): FCR (feed
projected from schedules ÷ liveweight gain; feed eaten by birds
that died stays in the numerator), ADG (sample slope, or chick-
weight anchor with one sample), uniformity (CV of latest sample),
mortality stats, weeks timeline (processing event wins over
species target), hen-housed production, laying rate, feed per
dozen / per lb egg mass, body weight trend with the
burning-reserves / getting-fat condition flags. Everything
uncomputable surfaces as a caveat, never a wrong number (same
philosophy as feedConsumption.js).

**Hooks**: `useWeightSamples` / `useEggCollections` (CRUD +
realtime), `useMortalityLog` (read-only view over
mortality_observed activity rows).

**Capture surfaces**:
- **Eggs quick action in Rounds** — fourth tray button; sheet
  picks place → layer flock → count. One submit queues two outbox
  ops: an `eggs_collected` activity row (Observations/Activity
  feeds) + an idempotent `egg_collections` insert (what metrics
  read). Works offline like mortality.
- **Weigh-ins card on BatchPage** — record a 10–20 bird sample as
  free-typed weights; history list with per-sample avg + CV +
  delete.
- **Egg log card on layer BatchPage** — desktop date+count entry
  + recent history.

**Metric cards on BatchPage** (`components/BatchMetrics.jsx`,
species-aware): Performance card for meat batches (FCR, daily
gain, uniformity, mortality, weeks remaining, projected feed
eaten + cost); Production card for layer flocks (hen-housed,
laying rate, feed per dozen, feed per lb egg mass, mortality,
body-weight strip with condition flags).

`loadLivestock` in useReferenceData exposes placedCount +
targetProcessWeeks app-wide; the Observations page gains an Eggs
filter chip.

**Out of scope — Batch 26.2:** the Metrics page (registry +
cross-batch comparison sheet), the dashboard "broiler weeks
remaining" widget, and feed-page metric embeds.

### Batch 26.2 — Metrics page + comparison + dashboard widget · `v0.10.25-alpha`
2026-06-02. Closes the Metrics & analytics subsystem (Batch 26).
The cross-cutting surfaces over the 26.1 foundation: the Metrics
page, the comparison sheets, and the dashboard weeks-remaining
widget. No new schema.

**Metrics page** (`pages/Metrics.jsx`, new top-level nav entry
right under Dashboard — Now · Farm map · Dashboard · Metrics):
- **Broiler batch comparison sheet** — one row per batch of every
  meat species: placed / alive, weeks on farm, weeks left, feed
  eaten (lb, schedule-projected), feed cost, mortality %, FCR,
  daily gain, uniformity, cuts ordered. FCR over the pasture
  target band and uniformity over 8% render in the warn color.
  Rows deep-link to the batch page.
- **Layer flock comparison sheet** — placed / alive, eggs
  collected, hen-housed production, laying rate, feed per dozen,
  feed per lb egg mass, body weight (with % change; condition
  flags warn-colored), mortality %.
- **Metric definitions registry** — the seeded `metrics` rows
  grouped by family: name, unit, formula description, target
  note. The "what does this number actually mean" reference.
- "Cuts ordered" joins chicken_lots on the batch's processing
  date (chicken_lots has no batch FK; the processing day is the
  natural key).

**Dashboard widget** (`Overview.jsx` → BroilerWeeksCard): one line
per broiler batch still on the farm — `Batch 1 · week 5 · 2 weeks
remaining` — sorted closest-to-processing first, deep-linking to
the batch page. Counts down to the scheduled processing event
when one exists, else arrival + target_process_weeks. Renders
nothing when no meat batch is active. This retires the
"Broiler-batch weeks remaining dashboard widget" item from
Recently added.

**Hooks**: `useMetricDefinitions` (registry + realtime),
`useProcessingDates` (one query → Map<batchId, processing date>
from event_links role='processing', shared by the comparison
sheet and the widget).

In-app Roadmap page: "Metrics & analytics" item retired.

### Batch 27.1 — Products catalog + content · `v0.10.26-alpha`
2026-06-02. First slice of Products + pricing (Batch 27): the
schema, the catalog CRUD, and the content surfaces. The pricing
grid (27.2) and sales + bundles UI (27.3) come next.

The batch opened with the two research passes the roadmap called
for, then a four-question pricing workshop with James. Decisions:
- **Fixed price per weight bracket** (the Pat's Pastured / White
  Oak pattern — no farm storefront does true $/lb catch-weight).
  Matches the existing `size_brackets` jsonb.
- **Pricing UI = bulk grid + per-product editor** (grid for
  prices with live margin, editor for content).
- **Sales chart fed by a manual "record a sale" form** until POS
  (Batch 28) / Orders (Batch 29) write the same table.
- All four research extras in scope: bundles, compare-at pricing,
  price history, the four-slot description template.

Migration `0024_products_pricing.sql` (all of Batch 27's schema
in one file — one prod push for the whole batch):
- **`product_kinds` extended** — `content` jsonb (the four
  description slots: what-it-is / cooking / sourcing /
  nutrition), `photo_path`, `sold_out`, `is_bundle` +
  `bundle_contents` jsonb, `average_per_package`, `archived_at`.
- **`product_prices`** — append-only price log; the current
  price of a SKU (product × bracket) is its newest row, so
  price history falls out of the schema for free. Carries
  `compare_at_cents` for strike-through "was" pricing.
- **`product_sales`** — one row per sale line (date, SKU, qty,
  total, channel). The 27.3 record-a-sale form, Batch 28 POS,
  and Batch 29 Orders all write here.
- **`product-photos` Storage bucket** + guarded policies (same
  pattern as project-files in 0017).
- Admin RLS + realtime on all three tables.

**Catalog lib** (`lib/productCatalog.js`, pure): content slots,
sale channels, money parsing/formatting, product-id slugs,
current-price maps, margin math (Shopify-style price − floor),
per-SKU + bundle cost floors, animal grouping, SKU expansion.

**Hook** (`lib/data/useProducts.js`): CRUD + realtime over the
three tables; photo upload / replace / remove against the
product-photos bucket with batch signed-URL resolution.

**Products page rebuild** (`pages/Products.jsx`): products
grouped by animal (+ "Not animal-specific"; bundles last), each
row expandable into the full editor — photo box, identity fields,
sold-out toggle (stays visible in catalog, flagged), the
four-slot description editor, and the size-brackets editor with
per-bracket current price + cost floor. New-product form
(name / animal / sale unit / bundle flag), archive / restore /
delete (FK-protected), "From $X" price summaries on cards, and
the compact broiler cost-floor reference.

**Out of scope — next slices:** the Pricing tab (bulk grid, live
margin, below-floor warnings, price history view) is 27.2; the
Sales tab (record-a-sale + sales-over-time chart) and bundle
contents UI are 27.3.

### Batch 27.2 — Pricing grid · `v0.10.27-alpha`
2026-06-02. The pricing surface over the 27.1 foundation: the
Pricing tab on the Products page. No new schema (27.1's
migration covered the whole batch).

**Pricing tab** (`components/PricingGrid.jsx`):
- **One sheet, every SKU** — rows grouped by product, one row per
  size bracket (bracket-less products and bundles get a single
  row). Columns: cost floor, current price (with strike-through
  compare-at), editable new price, editable compare-at, margin %,
  profit per unit.
- **Live margin** (the Shopify-admin pattern): the margin and
  profit columns recompute on every keystroke against the SKU's
  cost floor — bundle floors sum their components'. Margin =
  (price − floor) / price.
- **Below-floor warning**: a draft price under its cost floor
  turns the input border, margin, and profit the warn color with
  a triangle icon.
- **Quick fill** (Faire's keystone rule adapted to cost floors):
  type a target margin %, and every un-priced SKU with a known
  floor gets price = floor / (1 − margin) filled into its input.
- **Save all** — one append-only `product_prices` insert for all
  dirty rows (`useProducts.setPrices` bulk mutation); per-row
  discard before saving.
- **Price history** — per-SKU expandable list of every past
  price (amount, compare-at, date, who set it). Reads the same
  append-only table; nothing extra to maintain.

**Hook**: `useProducts` gains `setPrices(entries)` (bulk insert,
one refetch).

**Out of scope — 27.3:** the Sales tab (record-a-sale +
sales-over-time chart) and the bundle contents picker.

### Batch 27.3 — Sales + bundles · `v0.10.28-alpha`
2026-06-02. Closes Products + pricing (Batch 27). The Sales tab
and the bundle contents picker, over the schema 27.1 already
pushed. No new migration.

**Sales tab** (`components/SalesTab.jsx`):
- **Record a sale** — date / product / size / quantity / total /
  channel / notes. The total pre-fills from the SKU's current
  price × quantity (editable — markets round, bundles discount).
  After saving, date + channel stick so logging a market's worth
  of sales is rapid-fire.
- **Sales-over-time chart** — stacked monthly bars (SVG, house
  chart style), split by product group with hover tooltips,
  per-month totals, gap months filled so the timeline reads
  honestly. Source is `product_sales` — the same table POS
  (Batch 28) and Orders (Batch 29) will write, so the chart
  never changes source.
- **Recent sales list** — newest first, per-row delete.

**Bundle contents picker** (Products page editor, bundle
products only): rows of component product + size + quantity;
bundles can't nest bundles. The components' summed cost floor
shows in the editor and drives the bundle's margin on the
pricing grid.

**Catalog lib additions**: `saleGroupKey` / `saleGroupLabel` /
`salesByMonth` (month bucketing + group split + gap filling).

In-app Roadmap page: "Products and pricing" item retired.

### Batch 27.4 — Automations rework: lifecycle + prep-as-chores · `v0.10.29-alpha`
2026-06-02. First slice of the automations rework (Batches
27.4–27.6), driven by James's feedback on the Batch 19/23
automations after the broiler lifecycle fired in production.

The core re-think: **calendar events are for things that happen at
a time; chores are for work someone does.** The old automation
created three events + a chore; prep processes created projects.
Both now create chores where chores are the right shape.

Migration `0025_automations_rework.sql`:
- **`fire_batch_created_automations()` replaced** — new shape:
  arrival event (unchanged) + pasture-move **chore** (was an
  event; batch-anchored, block / start-time / period read from
  `trigger_config`) + brooder cleanout chore (now batch-anchored
  too). **No auto-created processing event** — processing days
  are created manually with the batch picker (27.6) once the real
  date is known.
- **`chore_definitions.process_expansion_id`** — provenance FK
  mirroring `projects.process_expansion_id`, so expansion
  dismissal can retire exactly what it created.
- **Seed rule updated** — actions jsonb reflects the new shape;
  `processing_weeks` dropped from config;
  `pasture_move_block_id` / `pasture_move_start_time` added
  (edited from the Automations tab, 27.5).
- **Surgical prod cleanup** — the three "Processing day prep"
  projects + their expansions/modifiers/links deleted; stale
  active emissions acknowledged; any automation-created
  processing / pasture-move events tombstoned. Shipped as
  **migration `0026_cleanup_prep_projects.sql`** (plain top-level
  SQL): 0025's version ran inside a `do $$` block, whose DML
  silently affects zero rows under the Supabase CLI's migration
  login role — the lesson is recorded in 0026's header. After
  cleanup the upcoming processing days re-expand as chores under
  the new runner.

**Process expansion → chores** (client):
- `useProcessRunner.expandOne` writes one-time
  `chore_definitions` rows (one per task step, dated event date +
  offset, anchored to the event's linked batch when present)
  instead of a project + phase + steps. Deterministic chore ids
  (`process_<expansion>_<step>`) make partial-failure re-runs
  idempotent.
- `dismissExpansion` retires the created chores (legacy
  project-archive path kept for pre-0025 expansion rows).
- Processes page copy + expansion log updated (chore count chip;
  legacy project link kept for old rows).
- Process-created chores render the same provenance sparkle as
  automation-created ones (`processExpansionId` now selected by
  the chore hooks).

**Out of scope — next slices:** 27.5 moves the rules UI to the
species/feed pages and emissions to the bell; 27.6 adds the
processing-event batch picker, batch-referencing titles, and the
feed supplier picker.

### Batch 27.5 — Automations relocation + bell · `v0.10.30-alpha`
2026-06-02. Second slice of the automations rework: the rules UI
moves out of Settings to live next to what each rule is about,
and automation firings become bell notifications. No schema
changes.

- **`components/AutomationsPanel.jsx`** (new, shared): rule cards
  (enable toggle + per-rule config) + that rule's firing history.
  The broiler-lifecycle card gains the two controls the 0025
  trigger reads: a **pasture-move chore block picker** and a
  **custom start-time override**, plus the cleanout-offset days
  editor. Copy reflects the post-0025 behavior ("processing days
  are not auto-created").
- **Broilers page → Automations tab** — `batch_created` rules
  whose species matches, between Chores and Activity log.
- **Feed page → tabs** — "Feed types · N" (the existing
  group-cards layout) | "Automations" (the `inventory_reorder`
  rule).
- **Settings** — Automations section removed (with its Toggle /
  NumberSetting inputs, which moved into the panel).
- **Bell (InboxBell)** — new "Automations" section at the top of
  the dropdown: every active firing with **Clear** (acknowledge —
  keeps what it created) and **Delete** (dismiss — tombstones the
  created events/chores via the existing RPC; confirm dialog, no
  reason prompt). Badge count includes active firings.
- **Dashboard** — the Heads Up lane is retired; automation
  firings live in the bell, and process expansions now create
  chores that surface through the normal chore surfaces.

**Out of scope — 27.6:** processing-event batch picker,
batch-referencing schedule titles, feed supplier picker, and the
place-page "View on timeline" fix.

### Batch 27.6 — Pickers + titles · `v0.10.31-alpha`
2026-06-02. Final slice of the automations rework. No schema
changes — every picker writes through existing tables
(`batch_assignments`, `event_links`, `feed_types.supplier_id`).

- **`components/BatchPicker.jsx`** (new, shared): the
  batch-candidates list, select UI, and event_links sync extracted
  from the Processing workspace's `BatchAssignSection` (Batch 20),
  which now consumes it.
- **EventEditor → Batch picker** — when kind is
  `processing_days`, a Batch field appears (new and edit modes).
  Saved with the event (Cancel really cancels): writes the
  `batch_assignments` row + keeps the `event_links` batch row in
  sync. Picking a batch on an untitled new event autofills
  "Batch N — processing".
- **Schedule → batch-referencing titles** — processing
  occurrences whose series has an assigned batch render as
  "title — batch label" (display-time only, via the new
  `useSeriesBatchMap` hook over event_links + batch_assignments;
  skipped when the title already names the batch).
- **Feed page → supplier picker** — inline borderless select on
  each feed card's detail line, writing
  `feed_types.supplier_id` via the existing `updateFeed`.
- **Place timeline** — `/place/<id>/timeline` route; the place
  page's "View on timeline" button now lands on the Schedule
  filtered to the events of the batches placed at that place (or
  its subtree), opened in Agenda view with a place-context chip.
  Derived from placements — no event→place schema needed.

### Batch 28.1 — Inventory backend + CRUD · `v0.10.32-alpha`
2026-06-02. First slice of Batch 28 (Inventory + POS). Lot-based
inventory on real tables, replacing the Batch-4 static stub.
Design decisions (settled with James): lots (not aggregate
counts), storage locations are places, POS will live as a tab on
the Products page (28.2).

Migration `0027_inventory.sql` (additive):
- **`inventory_lots`** — product kind × bracket × lot date ×
  place (FK → places), with `quantity` (current) and
  `initial_quantity`. The Batch-4 `egg_lots` / `chicken_lots`
  placeholders are superseded but left in place.
- **`inventory_movements`** — append-only audit: created /
  adjustment / spoilage / sale (28.2), with `sale_id` FK →
  product_sales for the POS link.

Client:
- **`useInventory`** hook — lots + movements, realtime, on-hand
  rollup by SKU (productCatalog's `skuKey`); createLot /
  adjustLot / moveLot / removeLot, every quantity change paired
  with a movement row.
- **Inventory page rebuilt** (Tailwind, DB-backed): summary
  tiles per product, lots grouped by product kind with
  depleted-lot collapse, per-lot expand → recount / spoilage
  adjustment, move-to-place, delete (mistakes only), and the
  movement history.
- **Metrics "cuts ordered"** now reads real inventory lots
  (joined on lot date = processing date, filtered to the
  species' products, summing initial_quantity).
- **`data.inventory` slice retired** from useReferenceData —
  nothing read it anymore; two dead queries per app load gone.

**Out of scope — 28.2:** the POS / quick-sell tab (FIFO lot
allocation on sale, family-sale channel).

### Batch 28.2 — POS + family sale · `v0.10.33-alpha`
2026-06-02. Second slice of Batch 28: the register. No schema
changes — 0027's `inventory_movements.sale_id` was built for this.

- **`components/SellTab.jsx`** (new) — the POS register on the
  Products page (Catalog | Pricing | **Sell** | Sales): every SKU
  (products × brackets + bundles) as a row with current price,
  on-hand count, and a quantity stepper; sticky cart with
  editable per-line totals (auto from the pricing grid), grand
  total, date / channel / notes.
- **FIFO draw-down** — `useInventory.allocateToSale` decrements
  open lots oldest-first, one 'sale' movement per lot touched,
  carrying the `sale_id`. Bundles expand to their components.
  Shortfalls warn after recording, never block.
- **Family sale flow** — the Family channel prefills line totals
  to $0 (consumption, not revenue) while inventory still
  decrements; bundle on-hand shows how many complete bundles the
  freezers could assemble.
- **Sale deletion restores inventory** —
  `useInventory.reverseSale` runs before `removeSale`: counter
  adjustment movements + quantity restore, retry-safe via
  clearing `sale_id` on reversed movements.
- **Sales tab slimmed** — the Batch-27.3 manual record-a-sale
  form retired (recording now goes through the Sell tab, which
  is inventory-aware); chart + recent sales stay, with a pointer
  to the Sell tab. `recordSale` now returns the created row.

Batch 28 (Inventory + POS) is complete.

### Batch 29.1 — Orders backend + CRUD · `v0.10.34-alpha`
2026-06-02. First slice of Orders + shipping plumbing (Batch 29):
all of the batch's schema in one migration, the orders hook, and
the Orders page. Lifecycle + fulfillment (29.2) and shipments
(29.3) come next.

Migration `0028_orders.sql` (all of Batch 29's schema — one prod
push for the whole batch):
- **`orders` extended** — the 0006 placeholder grows the real
  model: `customer_id` FK, `ready_at` / `cancelled_at` lifecycle
  timestamps, `paid_at` + `payment_method`, `fulfillment_method`
  (pickup / delivery / shipping), `ship_to` jsonb snapshot,
  `shipping_cents`, `created_by`, `updated_at` + touch trigger,
  and check constraints for the settled enums (safe to add — the
  table has been empty since 0006 created it schema-only).
- **`order_lines`** — one row per line: product × bracket ×
  quantity × price. `sale_id` links a line to the product_sales
  row written at fulfillment (29.2). Replaces the 0006
  `line_items` jsonb (left in place, never read).
- **`shipments` + `shipment_parcels`** — Shippo-shaped (shipment
  → parcels → label) so the Batch 30 live API drops in without a
  remodel: carrier / service level / ship date / label cost /
  tracking; parcels carry dims + weight + dry-ice lbs (the
  cold-chain coolant). Read by the hook now, written by 29.3.
- **`shipping_settings`** — singleton state allowlist for the
  cold-chain distance cap (29.3 UI).
- **`customers.address`** (default ship-to, jsonb) and
  **`product_sales.order_id`** (fulfillment sales point back at
  their order).
- Admin RLS + realtime on every new table.

**Orders lib** (`lib/orders.js`, pure): statuses, fulfillment +
payment methods, Shippo-shaped address formatting, order totals,
customer display names.

**Hook** (`lib/data/useOrders.js`): orders with lines attached
(newest first), status grouping, shipments with parcels attached,
`createOrder` / `updateOrder` / `setLines` / `removeOrder`.
Lifecycle transitions are 29.2; shipment mutations are 29.3.

**Orders page** (`pages/Orders.jsx`): status-grouped list (open /
ready / fulfilled / cancelled, working set expanded by default),
summary strip (open / ready counts + awaiting value), new-order
form — customer picker with walk-in free-text fallback, line
editor with price prefill from current prices and on-hand counts,
fulfillment method, notes — and expandable order rows with edit /
delete while open.

**Wiring**: Sales → Orders lands on the page (placeholder
retired); the sidebar count and the dashboard "Open orders" card
now count open + ready orders, update live via a new
`refdata:orders` realtime subscription, and the card deep-links
to the page. Two Batch-28 leftovers fixed along the way: the
"Point of sale" sidebar action now opens the Products page's Sell
tab, and "Add to inventory" opens Inventory with the new-lot form
already open (both previously dead-ended on ComingSoon).

**Out of scope — next slices:** ready / fulfilled / cancel flows,
payment capture, and the fulfillment → sales + inventory write
(29.2); shipments UI, ship-to address entry, customer default
addresses, and the state allowlist UI (29.3).

### Batch 29.2 — Lifecycle + fulfillment · `v0.10.35-alpha`
2026-06-03. Second slice of Orders (Batch 29): the order lifecycle
becomes operable end to end — open → ready → fulfilled, plus
cancel — and fulfillment is the moment an order turns into real
money and real freezer movement. No new migration (0028 carries
the whole batch's schema). Shipments (29.3) remain.

**Lifecycle + payment** (`useOrders`): `markReady` / `reopenOrder`
(ready or cancelled → open, clears stamps) / `cancelOrder`;
`setPaid(id, { method })` + `clearPaid` — a paid stamp + method
(cash / check / Venmo / card / other), capturable at any point in
the order's life (deposit up front, cash at handoff, invoice
settled later). Live payment APIs stay in Batch 30.

**Fulfillment** (`useOrders.fulfillOrder`): every line becomes a
`product_sales` row — channel derived from the fulfillment method
(pickup → farm_pickup, delivery → delivery, shipping → shipping,
new channel added to `SALE_CHANNELS`), `order_id` pointing back at
the order — then inventory draws down FIFO via the same
`allocateToSale` path as the POS (bundles expand to components),
and the order is stamped fulfilled. Payment can be captured in the
same step. Failure tolerance: each line's `sale_id` is written
right after its sale row lands and already-linked lines are
skipped, so a partial failure can be re-run without
double-recording; inventory shortfalls warn, never block.
`recordSale` (useProducts) gained `orderId` passthrough →
`product_sales.order_id`.

**Fix — `allocateToSale` stale reads:** the FIFO allocator now
re-reads lots from the database on every call instead of using the
hook's React state. Two draws against the same SKU in one flow
(order with two lines of one product, or a bundle overlapping a
component line — possible in the POS since 28.2) previously had
the second draw seeing pre-first-draw quantities and overwriting
its decrement.

**Orders page**: per-status action rows — open: mark ready /
fulfill / edit / cancel / delete; ready: fulfill / back to open /
cancel; cancelled: reopen / delete; fulfilled: frozen. Fulfill
opens a confirm panel: sale date, optional payment capture, and a
per-SKU inventory-draw preview (have vs. need, bundle-expanded)
before anything is written; shortfalls surface after as a warning
(mirrors the POS). Payment chip on every row now shows the method;
expanded rows show the order's lifecycle timestamps. Surgical prod
test of the full write sequence ran clean (marked rows, exact-ID
cleanup).

**Out of scope — next slice (29.3):** shipments UI (parcels +
dry-ice config, manual label workflow, tracking), ship-to address
entry, customer default addresses, the state allowlist UI, and
shipping cost on the order total.

### Batch 29.3 — Shipments · `v0.10.36-alpha`
2026-06-03. Final slice of Orders + shipping plumbing (Batch 29):
the cold-chain shipping pipeline, operated manually until the live
carrier API (Batch 30 / Shippo). No new migration (0028 carries
the whole batch's schema). **Batch 29 is complete.**

**Ship-to + shipping charge** (Orders page): shipping orders get
an address form (Shippo-shaped: name / phone / street / city /
state / zip), a shipping-charge input folded into the order total,
and a cold-chain warning when the destination state isn't on the
allowlist (warn, never block — per-order override is just
proceeding). Picking a customer prefills a blank address from
their default; a checkbox saves the entered address back to the
customer record (`customers.address`, now read/written by
`useCustomers`).

**Shipments** (`useOrders` + Orders page): `createShipment`
(snapshots the order's ship-to), `updateShipment` (carrier /
service level / ship date / label cost / tracking number + URL),
`setShipmentStatus` (draft → label_purchased → shipped →
delivered, plus cancelled; delivered stamps `delivered_at`),
`setParcels` (replace-all, same pattern as order lines),
`removeShipment`. Expanded shipping orders grow a Shipments block:
per-shipment cards with a parcel editor (L×W×H, weight, dry-ice
lbs), label fields, tracking links, and the status workflow —
draft shipments can be deleted, labelled ones cancelled.

**State allowlist** (`shipping_settings` + UI): the singleton row
is now read (with realtime) and editable from a Shipping settings
panel on the Orders page — comma-separated state codes + notes;
empty = check off. `stateAllowed` warnings surface in the order
form and on shipment cards.

Surgical prod test of every new write path (customer address,
shipping order, shipment + parcel, full status walk, allowlist
update) ran clean — marked rows, exact-ID cleanup, settings
restored.

**Batch 29 wrap-up — deferred to Batch 30:** live carrier API
(Shippo: address validation, real rates, label purchase, tracking
webhooks), payment APIs (Stripe / Venmo), QuickBooks sync.

### Batch 40.1 — Preliminary functionality + UX audit · `v0.10.37-alpha`
2026-06-03. A Claude-driven UI audit (Playwright against every
screen, authenticated as James, marked test rows + exact-ID
cleanup) ahead of the recorded walkthrough proper. 60-route render
sweep (desktop + mobile) plus interactive flow tests; findings in
`.ignored/audit/FINDINGS-2026-06-03.md`. 19 code findings fixed in
one pass, plus one prod data fix. Four data-readiness items
(catalog prices, inventory lots, feed on-hand, batch arrival-date
backfill) are James's to enter and stay parked.

**Batch lifecycle (the big one — A1/A2/A3):** new
`batchLifecycle()` in `lib/metrics.js` derives a batch's state
(`arriving` / `active` / `processed`) from data already present —
arrival date + the scheduled processing occurrence — with no
schema change. Applied everywhere a batch is shown:
- Processed batches (Batch 1, 2) collapse into a **"Past
  batches"** section on the species Groups tab, drop off the
  dashboard "Broilers" card, and stop reporting a current place.
- Not-yet-arrived batches (5–8) render an **"Arriving · arrives
  Jul 8"** state instead of the negative "week -4" artifacts; the
  batch page holds performance metrics until arrival.
- Shared `BatchStatePill` chip; the dashboard card and batch
  header branch on the lifecycle.
- **Data fix:** Batch 1's stale open placement (processed weeks
  ago, still "in" Chicken tractor 1) was closed by exact id —
  the tractor now reads empty.

**Other fixes:**
- **Preferences (B1):** `useUserPreferences()` now mounts at the
  App level, so a saved theme/density loads on every boot, not
  only when the Settings page is open.
- **Places tree (B2):** expands fully by default; collapsed nodes
  show a child-count + occupant hint; occupants roll up so a zone
  reads "N in sub-places below" instead of "No occupants here"
  while a child holds a batch.
- **Orders (B3):** editing a line's quantity no longer wipes a
  hand-typed price (`patchLineKeepingPrice`).
- **Projects (B4 / C9):** shared `isActiveProject()` selector used
  by both the sidebar badge and the dashboard card ("Active
  projects") so their counts agree and past-target prep projects
  drop off both.
- **Activity feed (C1):** humanized batch ids and unmapped kinds;
  no more raw UUIDs / slugs.
- **Router (C2):** unknown URLs render a "nothing at this address"
  panel instead of silently showing the dashboard.
- **Copy / icons (C3, C4):** TopBar capture is a lightbulb (matches
  the sidebar + the Inbox copy); stale "(coming in 28.2)" removed.
- **Farm map (C5):** vertical label-declutter pass so adjacent
  zone labels stop overlapping.
- **Schedule (C6, C8):** month cells collapse the recurring chore
  blocks into one summary chip so real events stand out; the
  agenda collapses per-day blocks to a single row and caps its
  horizon to 3 months (was a 40-screen, full-year list).
- **Feed (C7):** the "Remaining" unit hides until there's a value.
- **Mobile (G1):** place-tree indentation shrinks on narrow
  viewports via a `--tree-indent` CSS var, so Chores → Today is
  usable on a phone.
- **Docs (F2):** corrected the stale "fake-auth" comment in
  `Chores.jsx`.

Re-ran the audit flows to confirm: zero negative-number
observations (was 4), the qty-price wipe gone, processed batches
off the live surfaces, the tractors visible and empty. Prod
verified back to baseline.

**Still open (40.2):** the recorded-walkthrough audit pipeline
(ffmpeg + whisper) per the Batch 40 plan, and the four
data-readiness items above.

### Batch 39.1 — Design audit + first consolidation · `v0.10.38-alpha`
2026-06-03. The code-side design audit (run after the preliminary
40.1 functionality pass). Four parallel read-only sweeps of `src/`
— class-string duplication, inline-style idiom, duplicate
structural components, color/token bypasses — synthesized into
`audits/2026-06-03/design-audit.md`, then the safe, high-value
slice executed. The large regression-prone migrations are
documented there as deferred (39.2).

**New shared UI kit** (`components/ui.jsx`, Tailwind-native):
class constants `LABEL_CLS` / `INPUT_CLS` / `INPUT_SURFACE_CLS` /
`BTN_ACCENT` / `BTN_GHOST` / `BTN_GHOST_WARN`, and components
`Card`, `StatusPill`, `StatTile`. This supersedes the old
inline-style `primitives.jsx`, which was effectively dead (one
live import) and has been **deleted**.

**Consolidations:**
- `Card` — the four near-identical copies (Overview, Metrics,
  BatchMetrics, BatchPage) collapse to one import.
- `StatusPill` now backs `BatchStatePill` and the Orders payment
  chip.
- The byte-identical `labelCls` (4 files) and Orders'/Inventory's
  full button-and-input constant blocks now import from the kit.
- Token-bypass fixes: the 5 `text-red-500` / hardcoded-`#e25c4a`
  sites (SitesAdmin, ChoresBlocksTab, Chores) → `text-warn`.
- Legacy inline-`style={{T.*}}` → Tailwind for the tiny files:
  EmptyState, Suppliers, Machines, Trailers, Threads, and
  SectionContent's `GenericItemList`.

**Functionality follow-up (closes a 40.1 miss):** the Metrics
batch-comparison table printed a raw negative "weeks on farm" for
not-yet-arrived batches (the 40.1 scan only caught the "week -N"
text form). Now guarded to "—", matching the dashboard and batch
page.

Verified: all 11 refactored routes render with zero console/page
errors; Cards, chips, and migrated pages screenshot clean; the
Metrics negatives are gone.

**Deferred to 39.2:** the broad button/input constant adoption
across ~40 sites, a styled `ConfirmDialog` replacing 27
`window.confirm()` calls, segmented-control unification, the large
legacy-idiom migrations (Chores, LoginGate, PlaceTree), and a
`--c-warn-subtle` token.

### Batch 35 — Mobile-responsive pass + install prompt · `v0.10.39-alpha`
2026-06-03. The broad iPhone-width audit of every non-field page
(the Tier-1 field surfaces — Now, Rounds, capture — were already
mobile-first). Method: a Playwright sweep of all 41 routes at
390×844 that *measures horizontal overflow* (the #1 mobile bug),
not just eyeballs screenshots. Found 14 routes overflowing; fixed
down to 2 imperceptible sub-30px slivers.

**Overflow fixes:**
- **Tab strips** that ran off-screen now wrap (`flex-wrap`): the
  Chores tab bar (Today/All/Blocks/Performance/Activity — was 679px,
  ~2× viewport, on all 5 chores routes), and the Products,
  Customers, and Projects tab+action rows.
- **Dashboard grid** collapses to one column on phones
  (`grid-cols-1 sm:grid-cols-…`) — it was forcing 2–3 columns,
  squeezing cards to ~190px and overflowing their content.
- **Flex inputs that wouldn't shrink:** the Customers search box
  (`min-w-0` on the flex-1 input + container) and long customer
  emails (truncate) no longer force the row wide.
- **Side-by-side date inputs** on a project wrap; the Schedule
  date-label's fixed `min-w-[180px]` is now responsive
  (`min-w-[130px] sm:min-w-[180px]`).

**PWA — install prompt** (`components/InstallPrompt.jsx`, the one
gap; the manifest + service worker + icons already shipped with the
farm-map MVP): a dismissible "Add to Home Screen" banner. Chrome /
Android use the `beforeinstallprompt` event → native installer; iOS
Safari (which never fires it) gets the Share-sheet instruction.
Hidden when already installed (standalone display-mode) or once
dismissed (persisted).

**Accepted as minor (documented, not chased):** two sub-30px
slivers remain — Schedule (404px, the calendar nav, 14px over) and
Processes (417px, the config step rows, 27px over). Neither causes
a noticeable horizontal scroll.

### Batch 33 — App-wide search (cmd-K palette) · `v0.10.40-alpha`
2026-06-03. The full cross-entity command palette (the Batch 18
place-only search was the thin precursor). Opens from anywhere with
**⌘K / Ctrl-K** or the TopBar **Search** button; one box searches
every page and entity, ranked, keyboard-first (↑/↓ move, Enter
opens, Esc closes).

**Client-side, no migration.** The roadmap floated Postgres
tsvector, but migrations are parked for James's return (never
unattended) — and a client palette over already-loaded data is the
pragmatic MVP. `useSearchIndex` reshapes what `useReferenceData`
already holds (batches, projects, suppliers, machines, trailers,
threads, orders) and loads a lightweight slice (id + name) of the
three tables that aren't in the global bag — places, customers,
product_kinds (all tiny). Pages come from the static `SECTIONS`
list so they're searchable instantly.

**Matching + ranking** (`CommandPalette.jsx`): whitespace-token
substring match (every token must hit the entry's keyword
haystack), ranked so a label-prefix beats a word-prefix beats a
mid-string beats a sublabel/keyword-only hit; pages get a small
boost so "ord" surfaces the Orders *page* above an individual
order. Each result shows an icon, label, sublabel, and a type chip.

**Deep links:** pages, batches (`/livestock/<sp>/<id>`), projects
(`/projects/<id>`), and places (`/place/<id>`) navigate straight to
the thing. Entities without a per-row route yet — customers,
products, orders, suppliers, machines, trailers, threads — jump to
their list page (find it, land where it lives).

Verified end to end: opens via button + ⌘K, searches across pages /
batches / customers / places / threads, Enter deep-links to a batch
page, Esc closes.

**Deferred:** a server-side tsvector index (for fuzzier ranking and
scale once tables grow) and per-row detail routes for customers /
products / orders so the palette can deep-link those too. Both want
a migration / new routes — a future slice.

---

### Batch 41 — Chores rebuild: block-model engine + soft cutover · `v0.10.41-alpha`
2026-06-04. Clean-slate replacement of the organically-grown chore
set with the spec (`.ignored/nff-chores-spec.md`), plus the engine
rewrite that renders it. Soft, reversible cutover on the live DB.

**Source of truth.** `src/data/choreSeeds.js` rebuilt to the spec:
48 recurring chores on the 5 daily blocks (morning … end_of_day,
referenced by stable slug via `CHORE_BLOCK_IDS`), each owned by an
animal / equipment (brooder / chicken_tractor / mobile_coop / sheep)
or place-scoped (house / cold_storage). Block-reference deadlines
(`following_block` / `block` / `midnight` / `block_on_weekday` /
`block_at_offset`), generalized `every_n` recurrence, and a feed/water
fill-out across the blocks for brooders, mobile coops, and tractors
(the tractor morning feed stands; the day-before withhold skips
midmorning→EOD via `mod-proc-no-feed`). `src/data/processSeeds.js`
adds the two event processes (processing day, market / pop-up) whose
steps spawn the event chores; the market load checklist rides in the
step body. Dropped the `layers` owner, the 3-period model, and the
demo chores + the demo-merge scaffolding in `getAllChoreDefinitions`.

**Engine** (`src/lib/chores.js`): `isChoreActiveOn`, `computeDeadline`,
`describeFrequency`, and the deadline/start helpers learn the new
frequency + block-reference deadline vocab, resolved against the live
block schedule; legacy paths kept for back-compat. `Overview`,
`Chores`, and `SpeciesPage` group + label by block + owner (anchor)
instead of period + category.

**Cutover** (`scripts/chores-cutover.mjs` — dry-run by default,
discrete `--apply` steps, backup-gated): created the `Cold storage`
place under the House, renumbered `chore_blocks.sort_order`
chronologically (1..5), soft-deleted the 76 old definitions
(`retired_at`, reversible), inserted the initial 38 (anchors mirror
the existing verified rows), and seeded the two processes (off).
Verified on prod: 38 active / 76 retired. The brooder + mobile-coop
feed/water fill-out (10 more, taking the seed to 48) is staged for a
follow-up `--apply` insert.

**Deferred:** the 6 manual-landmark post-return chores (no engine
support yet); the F69 `batch-clean-brooders` trigger reconciliation;
the F85 `process_steps.kind='task'` rename; migration 0033 (the
rename-proof `chore_blocks.slug` + a `chore_checklist_items` table)
is authored but not pushed — unneeded for the cutover. Phase D hard-
delete of the retired defs + disposable history waits on James's
sign-off in the new UI.

---

## Overhaul design records

Three overhauls jumped the original plan's queue, each kicked off by
a multi-agent design workshop. Every batch under them has now
shipped (full entries in Shipped above); the write-ups stay here as
the record of why each one jumped and what was decided.

### Chores overhaul (Batches 7–12) ✅ COMPLETE
*All batches shipped as of 2026-05-08 (`v0.10.5-alpha`). The one
deferred loose end — the modifier-conflict UI (last bullet below) —
shipped with the Processes batch (Batch 23, 2026-06-02).*

Why these jumped the queue: chores + scheduling are the primary
problem the dashboard exists to solve. The current chores
implementation became too tangled to keep extending. A four-agent
design workshop on 2026-05-06 produced a unified model — captured
in `~/.claude/plans/chores-overhaul-v2.md` — that landed across
the original four batches; the polish, deadlines, and assignment
rules engine added on 2026-05-07 extend the umbrella to Batch 12.
The full plan, the rejected ontologies, the open questions, and
the "you'd hate this if…" tradeoff list all live in that file.
Highlights:

- **Sites become first-class, per-instance, app-wide.** Brooder
  #1 and Brooder #2 are different rows. Used by chores,
  observations, the metrics & analytics subsystem, pasture
  rotation, and the mortality dashboard. Term is "site," not
  "stop."
- **Blocks are user-defined named windows** (Morning, Afternoon,
  Evening seeded; arbitrary additions allowed). Editing a block
  propagates to every chore in it. Block model simplifies in
  Batch 10 to start (sun-event or clock) + duration; the
  independent end_kind / end_minutes fields go away.
- **Rounds** is the full-screen mobile-first surface for actually
  doing chores (renamed from "Chore Doer"). Site Switcher
  drills kind → instance, generic ✓ on realtime contention (no
  per-user attribution), run-event quick actions written to
  `activity_log`, and a sundown countdown pill.
- **Accountability target is time, not per-person split.** Track
  start-time, run duration, late-start rate, and "overrun"
  (chores ran past the block window). No DNF state — chores
  always finish; "overran" is a boolean, not a failure.
- **Chore assignment rules engine** (Batch 12). Default
  assignments at the chore *and* block level, expressed as a
  small day-of-week DSL ("Mon/Fri James, Tue/Thu Jim,
  Wed/Sat/Sun both"). Per-instance overrides only touch that
  one instance.
- **Modifiers** are date-bound override rows that ride alongside
  chores; the table shipped in Batch 7 so it would be ready for
  Processes to populate, and the modifier-conflict UI shipped with
  the Processes batch (Batch 23) once it had something to render.

### Events + Schedule overhaul (Batches 13–14 + 19–20) ✅ COMPLETE
*All batches shipped as of 2026-06-01 (`v0.10.17-alpha`). The tail
landed as Batches 19–20 after the Farm Map overhaul was inserted as
15–18. One bullet below didn't ship: push-only GCal sync was
deferred mid-Batch-19 (James's call) and is now Batch 31.*

Why these jumped ahead of Projects: events + schedule are the other
half of the time-management problem chores tackles. The current
events subsystem is read-only with no CRUD, weekly-only
recurrence, a stub for processing-day batch assignment, two
duplicating browse surfaces (Schedule.jsx + AllEvents.jsx),
seven per-kind pages behind a flyout, and a standalone timeline
view that James called "underdeveloped." A four-agent workshop
on 2026-05-06 produced the unified plan at
`~/.claude/plans/events-overhaul-v1.md`. Visual mockup of the
chosen calendar rail at
`.ignored/calendar-rail-mockup.html`. Highlights:

- **Series + Occurrences** split. `event_series` holds the rule
  (RFC 5545 RRULE, season window, status); `event_occurrences`
  holds materialized rows for anything touched (override, skip,
  drag-reschedule, GCal push). Lazy materialization — pure
  recurring series have zero occurrence rows until something
  happens to them. Rule changes never bulk-rewrite materialized
  rows.
- **Animal groups are called "batches"** (broiler batch, layer
  batch, sheep batch). Already in code; matches verbal usage.
- **Polymorphic `event_links` table** glues events to batches,
  projects, project phases, chores, inventory items, and
  automations. Cross-entity navigation reads from one table.
- **`timeline_items` query view** unions `event_occurrences` and
  `chore_runs` (from the chores overhaul). UI components consume
  the view, not the underlying tables. Conflict surfacing reads
  from this view too.
- **Calendar UI gets the four-up Day / Week / Month / Agenda
  toggle**, a clickable date header with typer popover, and the
  banded-background time-of-day rail (option C from the mockup):
  chore-block windows render as faint amber bands behind the
  grid, events sit on top, conflict reads as event-on-band.
- **Push-only GCal sync.** `gcal_pushes` audit log; per-
  occurrence event IDs preserved across updates. No two-way for
  v1 — James's stated concern about external editing wins.
- **Triggers v1: two seed automation rules.** Feed reorder
  (creates chore + delivery event) and broiler-batch lifecycle
  (creates arrival event + pasture-move event + processing event
  + cleanout chore on batch creation). Auto rows visually
  flagged with a sparkle icon, dismissable.

### Farm Map UI overhaul (Batches 15–18) ✅ COMPLETE
*All four batches shipped as of 2026-06-01 (`v0.10.15-alpha`). The
write-up below is kept as the design record for the overhaul.*

Why these jumped the queue: navigation and the place model are the
structural problem the dashboard keeps running into. The sidebar is an
arbitrary flat list with no wayfinding, it isn't responsive, and it's a
friction point for a non-web-native operator (Dad) — and underneath it,
three overlapping place vocabularies have accreted
(`sites`/`site_locations`, the legacy `space_kinds`/`space_items`, and a
free-text `livestock_groups.current_location`). A five-lens design
workshop (May 2026 — blind pitches + synthesis + a "Dad" reserve-lens
pass) produced a unified north-star; James's calls on the seven open
questions and the work-backwards MVP cut land it as Batches 15–18,
inserted right after 14.2. The north-star design, the rejected
alternatives, the seven decisions, and the two Dad-derived hard
requirements have been folded in here from
`farm-map-north-star-requirements.md`, `farm-map-ui-overhaul-proposal.md`,
and `farm-map-workshop-brief.md` — those artifacts are now retired; this
roadmap is the capture point.

Headline decisions (including the workshop's biggest surprise):
- **The map is a view, not the front door.** Five blind agents
  independently put a time-anchored **"Now"** surface first. The phone
  lands on Now; the map is the **desktop** landing (decision 2) and a
  secondary read-only view on phone.
- **Place + time are two renderers of one dataset** — the map is
  `WHERE place ∈ subtree`, the timeline is `WHERE time ∈ window` over one
  place-anchored occurrence shape. Not glue between two features.
- **One recursive place tree** (opaque surrogate id, `parent_id`, `kind`,
  `kind_tag`, `code`, `mobile`) replaces the three place vocabularies.
  Geography is the primary axis; `kind_tag` is secondary so Rounds can
  still "sweep all coops." Display is always `name` + **bold parent**, so
  non-unique names ("Mobile Coop 1" in both Pasture B and C) don't
  confuse Dad in the field.
- **Offline-first is a going-in requirement**, not a later batch — the
  field flow silently loses data today.
- **Two Dad-derived hard requirements:** **D1** visual place
  disambiguation, and **D2** a loud "round in progress — tap to resume"
  bar (the sidebar that holds the current resume path is being deleted).

Collisions resolved (recorded here for the record):
- **Resources rethink (old Batch 21) — absorbed** into the place-model
  collapse + asset-as-occupant typing (Batch 15) and the Resources-flyout
  dissolution (Batch 18). Removed as a standalone batch.
- **Pasture visualization simulator (old Batch 34) → the Rotation planner
  (now Batch 37)** — re-pointed onto the shared place-geometry substrate
  rather than a standalone map.
- **Offline (old 33 → 36), App-wide search (old 30 → 33), Mobile pass
  (old 32 → 35)** each had a slice pulled forward into the farm-map MVP
  (the field write-path outbox, place search, and Tier-1 mobile
  respectively); the remainders stay as those later batches.

---

## Upcoming

The remainder of the plan, Batch 23 onward, plus the sequencing-TBD
list at the bottom. Sequencing is the proposal — locked in only when
a batch starts.

Numbering history (for anyone reading old commit messages):

- Originally 22 batches (2026-05-04).
- → 23 when Batch 6 was inserted to ship the in-app roadmap page.
- → 27 when the Chores overhaul was inserted as Batches 7–10
  (2026-05-06).
- → 31 when the Events + Schedule overhaul was inserted as
  Batches 11–14 (2026-05-06).
- → 35 after the 2026-05-07 revision: a new Batch 10 (Rounds polish
  + block model, carved out of 8.x), a new Batch 12 (chore
  assignment rules engine), a new Batch 17 (Inbox capture), and a
  new Batch 23 (Metrics & analytics, superseding the broiler
  tracker).
- → 38 on 2026-05-31 when the Farm Map UI overhaul was inserted as
  Batches 15–18 right after 14.2: the Events-overhaul tail
  (Triggers, Animal lifecycle) moved to 19–20, the old Resources
  rethink (21) was absorbed into the place-model collapse, the old
  Pasture simulator (34) was re-pointed into the Rotation planner
  (37), and slices of Offline (old 33), App-wide search (old 30),
  and the mobile pass (old 32) were pulled forward into the
  farm-map MVP.
- → 40 on 2026-06-02: Batches 34 (bookmarking) and 38 (voice
  control) moved to the Graveyard (numbers retired with them);
  Batch 39 (design audit) and Batch 40 (functionality + UX audit)
  added; the live carrier-label integration (Shippo) folded into
  Batch 30's scope.

### Batch 23 — Processes ✅ SHIPPED
Shipped `v0.10.20-alpha` (2026-06-02) — see the Shipped section
above. Process templates tied to event kinds, the client-side
expansion engine (project + chore modifiers per upcoming
occurrence), the Processes page, Heads-up lane integration, and the
stacked-badge modifier UI in Rounds / Today / Schedule-at-a-glance
all landed.

### Batch 24 — Customers + Lists ✅ SHIPPED
Shipped `v0.10.21-alpha` (2026-06-02) — see the Shipped section
above. The directory (basics-only fields), named lists with member
management, and the seeded 65-contact mailing list all landed.

### Batch 25 — Animals & Feed UI overhaul ✅ SHIPPED
Shipped in two slices (both 2026-06-02) — see the Shipped section
above:
- **25.1** — Feed page group-cards redesign (`v0.10.22-alpha`).
- **25.2** — Animals pages rethink (`v0.10.23-alpha`).

The broiler tracker stays carved out into Batch 26 (Metrics &
analytics); the metric definitions and cross-batch comparison
view ship there.

### Batch 26 — Metrics & analytics ✅ SHIPPED
Shipped in two slices (both 2026-06-02) — see the Shipped section
above:
- **26.1** — Metrics foundation + capture (`v0.10.24-alpha`):
  the metrics registry, weight_samples + egg_collections schema,
  the metrics engine, the Rounds Eggs quick action, and the
  per-cohort Performance / Production cards on BatchPage.
- **26.2** — Metrics page + comparison + dashboard widget
  (`v0.10.25-alpha`): the top-level Metrics page (comparison
  sheets + metric registry) and the broiler weeks-remaining
  dashboard widget.

Out of scope for v1 (still true): predictive models, anomaly
detection, custom user-defined metrics. Future reporting /
data-viz items (sales charts, feed analytics) land in this
subsystem when their batches ship.

### Batch 27 — Products + pricing ✅ SHIPPED
Shipped in three slices (all 2026-06-02) — see the Shipped
section above:
- **27.1** — Products catalog + content (`v0.10.26-alpha`): the
  pricing workshop, migration 0024 (the whole batch's schema in
  one push), the catalog CRUD with photos / four-slot
  descriptions / brackets / sold-out.
- **27.2** — Pricing grid (`v0.10.27-alpha`): the bulk pricing
  sheet with live margins against cost floors, below-floor
  warnings, quick-fill, compare-at, and price history.
- **27.3** — Sales + bundles (`v0.10.28-alpha`): record-a-sale +
  the sales-over-time chart, and the bundle contents picker.

Out of scope (still true): e-commerce/storefront publishing of
the catalog (no batch owns this yet); inventory decrement on
sale (Batch 28 POS); per-order sales (Batch 29).

### Batches 27.4–27.6 — Automations rework ✅ DONE
James's 2026-06-02 feedback on the Batch 19/23 automations. All
three slices shipped 2026-06-02 — see Shipped above: **27.4**
(lifecycle + prep-as-chores, `v0.10.29-alpha`), **27.5**
(relocation + bell, `v0.10.30-alpha`), **27.6** (pickers +
titles, `v0.10.31-alpha`).

Remaining tail:
- **Prod cleanup — BLOCKED on a stale client.** The
  pattern-based sweep ran 2026-06-02 ~22:47 UTC (exact-ID deletes
  of 4 prep projects + 2 project-shaped expansions + 2 links,
  backed up to `.backups/2026-06-02T22-43-*`). Within seconds, a
  client still running the pre-27.4 bundle re-expanded two series
  as projects ("Batch 2 — processing (Jun 2)" + "Broiler
  processing day (Jul 14)"). Cleanup is futile until that stale
  tab / PWA is found and refreshed — then re-run the same sweep
  on whatever project-shaped rows exist at that point.

### Batch 28 — Inventory backend + Point of Sale ✅ DONE
Both slices shipped 2026-06-02 — see Shipped above: **28.1**
(inventory backend + CRUD, `v0.10.32-alpha`), **28.2** (POS +
family sale, `v0.10.33-alpha`).

### Batch 29 — Orders + shipping plumbing ✅ DONE
All three slices shipped — see Shipped above: **29.1** (orders
backend + CRUD, `v0.10.34-alpha`, 2026-06-02), **29.2** (lifecycle
+ fulfillment, `v0.10.35-alpha`, 2026-06-03), **29.3** (shipments,
`v0.10.36-alpha`, 2026-06-03).

Scope settled at the 2026-06-02 workshop. Manual order creation;
edit / interact with customer orders; customer ↔ order linking
(deferred here from Batch 24); and the cold-chain shipping
pipeline modeled in-app, operated manually until the live carrier
API lands (Batch 30).

Workshop decisions:
- Orders write `product_sales` + decrement inventory **at
  fulfillment** — an open order is a promise; cancelling an open
  order costs nothing. The sales chart stays a record of actual
  money.
- Lifecycle: open → ready → fulfilled, plus cancelled. Edits
  allowed while open; fulfilled orders are frozen.
- Payment tracking: paid flag + method (cash / check / Venmo /
  card / other) + paid-on date. Live payment APIs stay in
  Batch 30.
- Addresses: customers get a default ship-to; each order
  snapshots / overrides it at order time.
- Cold-chain limit: products ship cold/frozen, so transit time is
  capped — v1 is a state allowlist with per-order override.
- The shipment model is designed around Shippo's object shapes
  (shipment → parcels → label) so the live API drops in later
  without a remodel. Until then: buy labels on PirateShip/Shippo
  by hand, paste tracking numbers in.

Slices:
- **29.1 — Orders backend + CRUD**: migration `0028_orders.sql`
  carries all of Batch 29's schema in one prod push (orders table
  extensions, `order_lines`, `shipments` + parcels,
  `customers.address`, `product_sales.order_id`); `useOrders`
  hook; Orders page (status-grouped list, create/edit, customer
  picker, line editor with price prefill); nav + Overview card
  wiring.
- **29.2 — Lifecycle + fulfillment**: ready / fulfilled / cancel
  flows, fulfillment writes sales rows + FIFO inventory draw-down
  (same `allocateToSale` path as POS), payment tracking UI.
- **29.3 — Shipments**: create-shipment-from-order (parcels +
  dry-ice coolant config, allowlist check with override, manual
  label workflow, tracking), shipping cost passed onto the order
  total.

### Batch 30 — Commerce integrations
Stripe (cards / online payments); QuickBooks (accounting sync).
E-comm front-end if needed. **Venmo:** no accept/confirm API, but a
**deep link / QR** can pre-fill the pay screen (recipient + amount +
note) with no credential — a build task, payment still confirmed
manually; real acceptance would be PayPal/Braintree. See
`docs/integrations-and-credentials.md`.
**Added 2026-06-02:** the live carrier-label integration — Shippo
(address validation, real-time rates, label purchase, tracking
webhooks) against the Batch 29 shipment model. Batch 29 builds the
cold-chain shipping pipeline operated manually; this batch makes
it live.

### Batch 31 — Google Calendar sync (push-only first; two-way deferred)
Now owns the **push-only sync** originally scoped into Batch 19
and deferred when that batch shipped (2026-06-01): a Postgres
function or edge job watches `event_occurrences` for dirty rows
and emits create/update/cancel calls; per-occurrence event IDs
preserved across updates; logs to `gcal_pushes` (table already
exists, schema-only, from 0013). Requires Google API credentials
(service account or OAuth) wired as Supabase secrets.

The two-way case stays deferred — e.g., editing on the phone
calendar app and having those edits flow back to the dashboard.
James's stated stance: "If that use case crops up down the road
we can revisit it." The design constraints (idempotent change
ledger, per-field merge rules, conflict resolver UI) are
remembered here if it ever lands.

### Batch 32 — Farm updates / Social / Content calendar
Farm updates: list-targeting, markdown editor, file uploads, email
sequences (delays + scheduled dates), "needs review" message
thread, **AI review pipeline** gating "ready to send".

**Publishing pipeline** (added 2026-05-05): once an update is
approved, it should fan out to two places at once: (1) the
public-facing nff site (front-end publish — exact mechanism TBD,
likely a webhook into the site's CMS / a build trigger / a
content-API write); and (2) an email blast sent through our
Fastmail account, addressed to a customer list maintained in the
dashboard's CRM → Lists section. Same draft, one approval,
both surfaces in lockstep. Implementation notes for whoever picks
this up: the list selection lives on the farm update record so the
target audience is part of the artifact under review; Fastmail
integration likely means SMTP auth + per-recipient personalization,
unless they expose a transactional API by then; site-publish should
be idempotent so re-publishing an edited update updates the
already-live page in place.

Social posts: same shell + real social-network integrations + true
scheduling. **Instagram** is the primary target — publishing via the
**Meta Graph API (Instagram Content Publishing)**. The farm **has a
Business IG**, so the official path is available; it still needs the
IG account linked to a Facebook Page + a Meta app + **App Review** for
the publish permissions (the most gated integration; budget for
review). Facebook Page posts ride the same API. IG has no native
scheduling, so schedule server-side (a Netlify scheduled function
fires the publish). Credentials in
`docs/integrations-and-credentials.md`.

Content calendar: calendar UI + auto-add to schedule.

#### Blog authoring & publishing (design settled 2026-06-04)
Big subsystem — likely its own batch when sequenced. The decision:
**the dashboard is the CMS.** All authoring + review happens in our
app (James's dad will never touch GitHub, and the review needs to be
usable by a non-technical reviewer); git is only the *publish target*,
never the review surface.

**Context shaping it:** the public site exists but is being
**redesigned from the ground up**, and the redesign introduces
**ecommerce** — a large JS surface. The site is **Hugo** today; James
prefers **monorepos**. If we can author → review → render a Hugo
markdown file → commit it → rebuild, that's the win.

**Content model:**
- **Body:** markdown — covers bold/italic, ordered/unordered lists,
  h3–h6, links, images + alt text.
- **Beyond plain markdown (need handling):** embedded **video** and
  image **captions** (markdown shortcodes / structured blocks).
- **User-editable fields:** post type, meta description (+ more TBD).
- **Auto metadata:** title tag, published + updated dates, OpenGraph,
  schema markup (JSON-LD).

**In-app review system (emulate a PR, DB-backed — do NOT use GitHub's):**
versioned documents with **diffs** between versions; **line-anchored,
threaded comments** with **resolve**; AI **suggestions rendered as
proposed diffs** with **1-click accept**. The whole surface lives in
the dashboard.

**3-gate publish pipeline** — runs when a post is marked *ready for
review* (or a new version is saved while under review):
1. **AI tone & voice check** on the prose → suggests fixes, flags
   unfixable issues → **must pass to publish**.
2. **Content/schema check** → image/file sizes valid, headings not too
   long, all custom fields filled, etc. → flags issues → **must pass
   to publish**.
3. **Human review** → reviewer comments + approves/rejects. Approve =
   human gate passed; reject → author revises → the loop restarts.

All three pass → post is **ready to publish or schedule**. On publish/
schedule it **locks** (visible but uneditable); any change requires a
**new review cycle**. (The "CI pre-commit hooks" James wants *are* this
pipeline — it runs in-app, server-side, before anything ships;
optionally a real CI on the site repo can validate the Hugo build as a
backstop.)

**Publish mechanism** (gated on the architecture decisions below): on
publish, render the post to a **Hugo-compatible markdown file** (front
matter carrying all the metadata) and get it into the site's content
so Hugo rebuilds — commit via the **GitHub API** + build trigger if the
site is a **separate repo**, or write into the content dir + trigger
the build if it lives in the **monorepo** beside the app.

**Open architecture decisions (settle when the redesign is scoped —
they gate the publish mechanism + whether a GitHub credential is even
needed):**
- **Stay Hugo, or move to a JS framework (Astro / Next / …)?** The
  ecommerce layer needs dynamic JS — either Hugo-for-content + JS
  islands for commerce, or one JS framework doing both. Determines
  whether "generate a Hugo markdown file" stays the publish target.
- **Monorepo layout:** dashboard + public site (+ shared packages) in
  one repo? If so, publishing is an internal write + build; if
  separate repos, it's a cross-repo commit via the GitHub API.
- **Build/deploy trigger:** host build (Netlify/…) fired by the
  commit, vs a content-API write.

Recommend a short **site-redesign architecture session** before
building this — it's entangled with the ecommerce + monorepo
decisions, which have impact well beyond the blog.

### Batch 33 — App-wide search ✅ SHIPPED
Shipped `v0.10.40-alpha` (2026-06-03) — see the Shipped section
above. The full cross-entity cmd-K palette (the Batch 18 place-only
search was the precursor), built client-side over already-loaded +
three lightweight tables (no migration). Deferred: a server-side
`tsvector` index and per-row detail routes for
customers/products/orders so those deep-link too.

### Batch 35 — iOS / mobile-responsive pass ✅ SHIPPED
Shipped `v0.10.39-alpha` (2026-06-03) — see the Shipped section
above. The iPhone-width audit of every non-field page (overflow
measured, not eyeballed): 14 overflowing routes fixed to 2
sub-30px slivers, plus the PWA Add-to-Home-Screen install prompt
(manifest/SW/icons already existed). Re-scoped by the farm map:
the Tier-1 field surfaces (Now, Rounds, capture) were built
mobile-first in Batches 16–17; this was the broad audit of every
*other* page.

### Batch 36 — Offline tolerance + resync
IndexedDB write queue (idb / Dexie) wrapping the Supabase client;
outbox pattern for mutations; conflict policy per table. Service
worker for asset caching. Affects every data hook. **Re-scoped by
the farm map:** the field write-path outbox (completions,
observations, additive-merge mortality) shipped in Batch 16 — this
batch generalizes the outbox to every remaining hook and adds the
service-worker asset cache.

### Batch 37 — Rotation planner (formerly Pasture visualization simulator)
**Re-pointed by the farm map:** a sibling on the **shared
place-geometry substrate** — it draws real structure/paddock
geometry and *sets* tractor positions over time, while the nav map
only *shows* current schematic pins. A rotation plan is a sequence
of future `placements` rows on the same place tree (no longer a
standalone map). Otherwise as specced below:

Standalone subsystem. Map / canvas with land outline; draw + name
pasture boundaries; tractor pins (dims + capacity drive math);
assign batch → tractor count needed; hypothetical-batch sandbox;
fence-area calculator; tractor-move cadence tuning; timeline
scrubber (manual + autoplay) with hover read-out ("X days since
occupied / available in Y"); commit a movement plan → scheduled
chore moves; per-plan distance/location breakdown. Likely libs:
Leaflet or MapLibre + a geometry layer.

### Batch 39 — Design audit (code-side)
Added 2026-06-02. **39.1 shipped 2026-06-03 (`v0.10.38-alpha`)** —
the audit + first (safe) consolidation slice; see Shipped. Report
in `audits/2026-06-03/design-audit.md`. Remaining (39.2): the
broad constant adoption, `ConfirmDialog`, segmented-control
unification, large legacy migrations, and the warn-subtle token.

Claude-led review of the front-end, run ahead of
the recorded audit (Batch 40): component architecture (what gets
extracted / merged / deleted), design-system consolidation
(spacing, typography, color tokens, `primitives.jsx` coverage,
Tailwind idiom consistency), and UI/UX patterns visible from code
(empty states, form layouts, button variants). Output is a written
report + refactor plan checked into `audits/`, then executed as
`fix:` / `chore:` commits.

### Batch 40 — Functionality + UX audit (recorded walkthrough)
Added 2026-06-02. **40.1 shipped 2026-06-03 (`v0.10.37-alpha`)** —
a preliminary Claude-driven UI audit + fixes ahead of the recorded
walkthrough; see Shipped. Remaining (40.2): the recorded-walkthrough
pipeline below, and the four parked data-readiness items.

The screen-recording audit workflow, then the audit itself.
Design/UX issues are treated exactly like functionality bugs —
one backlog, fixed in sequence. Settled at the 2026-06-02
discussion:

- **Capture (James):** ⌘⇧5 screen recording with the mic on,
  narrating issues while demonstrating them on screen. Files land
  in a gitignored `audits/raw/`. Several shorter recordings (one
  per app area) are fine.
- **Process (Claude):** `scripts/process-audit.sh` — ffmpeg
  extracts the audio, whisper.cpp (local, runs on the M1, nothing
  leaves the machine) produces a timestamped transcript, ffmpeg
  pulls a video frame per transcript segment. Claude reads the
  transcript + frames and writes `audits/<date>/findings.md`: one
  entry per issue — page, James's words, the frame, a diagnosis
  (file / component, proposed fix), size estimate, checkbox.
- **Pilot first:** a 2–3 minute test clip proves the pipeline and
  tunes the findings format before the full walkthrough.
- **Triage (together, ~15 min):** correct misreads, kill
  non-issues, set priority order, and pre-authorize the fix list.
- **Execute (Claude, while James is at the farm):** work the list
  top-down — fix, verify in the running app, check off, next.
  Each finding becomes its own `fix:` commit straight to main
  (pre-authorized at triage; this is the standing exception to
  the ask-before-each-commit rule). Anything needing a migration
  or prod push is parked for James's return — that never happens
  unattended.

The same pipeline drives the Batch 35 responsiveness audit when
that batch runs.

### Batch 41 — Schedule (the commitment layer)
Added 2026-06-24. The missing day-plan layer between chores
(generative) and the calendar (temporal): a day-atomic plan that
auto-composes chores + projects + events into one **draft**, which the
operators **confirm** — a durable, glanceable, Rounds-executed day.
Designed end-to-end via the Scope Workshop → Scope Document → Design
Bracket; full spec + the work-backwards build plan live in
`.ignored/schedule-feature/` (scope-document.md, the-design.md,
versioned-capture-substrate.md, build-plan.md). The chosen design is
the single-open accordion (`mockups/minimalist.html`).

Built commitments-first over an S1–S11 plan (S1–S5 = the MVP: draft →
one-tap confirm → tick, married to Rounds, offline, recorded as a
versioned capture).

- **41.1 — commitments foundation. ✅ SHIPPED `v0.10.42-alpha`
  (2026-06-24).** Generalized `chore_runs` into the unified
  `commitments` timeline (one row per claim on a block of someone's
  time; `chore_block` kind only for now). Migration 0029 is additive —
  create + copy every chore_runs row uuid-preserving, repoint the
  `chore_run_participants` + `activity_log` FKs and the `timeline_items`
  view; `chore_runs` is left orphaned and dropped in a later batch
  (after S3 removes the view and parity holds). Repointed the
  run-lifecycle read/write paths (useChoreRuns, useRunHistory, outbox,
  the notify-run-done push function). Row-count parity verified in prod
  (10 → 10).
- **41.2 — versioned-capture substrate. ✅ SHIPPED `v0.10.43-alpha`
  (2026-06-24).** The reusable durable-record layer: `capture_schemas` +
  `captures` + the `record_capture` RPC (server-validated by
  `pg_jsonschema`), client-side `ajv` validation + an upcaster harness in
  `src/lib/capture/`, and the first schema `schedule.confirmed_day` v1.
  Migration 0030 (additive; an in-migration sanity block proves
  `pg_jsonschema` on push). Metrics/KPI schemas fold in later.
- **41.3 — derive-the-draft engine. ✅ SHIPPED `v0.10.44-alpha`
  (2026-06-24).** `src/lib/schedule/deriveDay.js` — the one client-side day
  assembler folding chore fan-out + events + active projects into a
  structured, regenerable, offline-computed day (blocks carry their member
  chores, for both Overview's rollup and the S4 accordion). Relocated
  `rollupChoresForDay`/`getRollupAssignee`/`todaysMorningCutoff` out of
  Overview (behavior-preserving) and deleted the dead `useTimelineItems`
  hook. Pure code — no migration. A documented `foldDeltas` seam awaits S6.
  DEFERRED to a later authorized cleanup migration: dropping the dead
  `timeline_items` view + the orphaned `chore_runs` (both safe; chore_runs
  parity was verified in 41.1).
- **41.4 — the Schedule accordion Today view. ✅ SHIPPED `v0.10.45-alpha`
  (2026-06-24).** `src/pages/Schedule.jsx` — the Minimalist single-open
  block accordion (per the-design.md / mockups/minimalist.html): the
  current block expanded, others collapsed to a `name · done/total` line,
  done blocks recede (forward focus); inline ticks via the shared
  `ChoreCheckRow` (extracted from Rounds) write `chore_completions` through
  the outbox — one completion truth, offline `CloudOff`; tick→seal
  auto-advances to the next undone block; "Open rounds" deep-links the
  Rounds takeover; jump-to-now. Renders from the S3 `deriveDay` engine.
  Freed the name: the old events surface became **Calendar** (`/calendar`);
  the new accordion owns **Schedule** (`/schedule`). Phone-first, DRAFT-only
  (a static "Draft" pill). Verified live by James.
- **41.5 — confirm (S5). ✅ SHIPPED `v0.10.46-alpha` (2026-06-24) — THE MVP
  IS COMPLETE (S1–S5).** One-tap whole-day "Confirm today · N blocks · M
  chores" → builds the frozen planned shape (date / confirmed_by /
  confirmed_at / blocks / entries — reference + labels only) and writes a
  `schedule.confirmed_day` capture via the 41.2 substrate (client ajv +
  server pg_jsonschema, rides the outbox); flips to a green ✓ Confirmed
  pill; `readCaptures` on load restores the confirmed state (persists across
  reload/device, newest snapshot wins); a source-changed-after-confirm
  ribbon (diffs the live chore set vs the snapshot, surfaced not applied).
  Verified live by James end-to-end (confirm → capture lands in prod →
  persists on reload). Includes migration `0031` — a hotfix stripping the
  `$schema`/`$id` metadata from the confirmed_day schema that pg_jsonschema
  (XX000) couldn't validate; semantics unchanged.
- **41.6 — S6 (1/3): commitment-delta foundation + ad-hoc add. ✅ SHIPPED
  `v0.10.47-alpha` (2026-06-24).** The first batch that WRITES commitment
  deltas (the S3 `foldDeltas` seam goes live). `commitment_insert/_set_
  state/_delete` outbox ops; `useScheduleDeltas` (reads a day's ad-hoc/note
  deltas with an outbox overlay — instant + offline-safe add/remove/toggle);
  `foldDeltas` implemented (attaches deltas to block rollups as `extras`,
  orphan-tolerant); Schedule renders a "+ Add a one-off task" input per
  open block, ad-hoc tasks as their own checkable rows (done-state on the
  commitment, not chore_completions), counted + folded into confirm + the
  change-ribbon. Pure code, no migration. Delta data path verified against
  prod (insert/read/state/delete); UI awaits James's live review.
- **41.7 — S6 (2/3): search-to-add chores. ✅ SHIPPED `v0.10.48-alpha`
  (2026-06-25).** A reusable `SearchSelector` overlay (CommandPalette is
  nav-only) over the chore set (`describeChoreAnchor` sublabel for
  disambiguation); picking a chore pulls it onto the day at every place
  it's anchored to (`obligationPlaceIds`) as `chore` commitment deltas,
  which render as real `ChoreCheckRow`s (completion via chore_completions)
  with a remove control; dedupe against chores already due (S37). Migration
  `0032` adds `'chore'` to the `commitments.source_type` enum (applied to
  prod; data path verified). Deferred to a later slice: the dedup-by-title
  + place-narrowing two-step (S33a–c) and project-node add.
- **41.8 — S6 (3/3): instance overrides + protection + modification
  history. AUTHORED `v0.10.49-alpha` (2026-06-25); migration `0034` NOT
  yet pushed.** Editing the derived day, schedule-local: a per-row edit
  sheet (`ScheduleEditSheet`) moves a row to another block / sets a clock
  time (S63/S64), and drag-reorders within a block (S71, via the existing
  `@dnd-kit`). Because the day is derived, an edit to a chore writes an
  `override` commitment that targets the instance (`source_ref.target =
  {chore_id, place_id}`) and carries the new placement; `applyOverrides`
  (new `src/lib/schedule/overrides.js`) relocates/retimes/reorders the
  derived row in place. Commitment-backed rows (ad-hoc / pulled chore /
  note) are edited directly, including **cross-day move** (run_date change)
  per the chosen v1 cut — recurring derived chores get within-day moves
  only (S73, scoped). Risky edits — a different block or another day —
  pass a **protection double-confirm** that explains *why* (`assessEdit`
  heuristic; there's no must/critical flag on chores), per S65/S66/S70.
  Every edit appends to an instance `history` jsonb, surfaced as a viewable
  per-row log (`EditedHistory`), per S74. Migration `0034` adds `'override'`
  to the `source_type` enum + the `history` column (additive). Deferred:
  cross-day move of *derived recurring* chores (suppression tombstones),
  S69 mark-not-protected, S72 split-a-block.
- **41.9 — S7 non-work-time + S8 man-down. AUTHORED `v0.10.50-alpha`
  (2026-06-25); no migration (reuses the `reservation` enum value + jsonb).**
  Non-work time is a `reservation` commitment (person + off-site / break /
  appointment / day-off window), added via `ReservationSheet` and shown as
  a compact strip; `removeDelta` clears it. Man-down (`src/lib/schedule/
  manDown.js`): an assigned row whose block window overlaps its assignee's
  reservation surfaces a one-line "needs cover" **leak** on the block
  (visible while collapsed), per the mockup. **Cover** (`CoverSheet`)
  reassigns the chore to the free admin (an `assignee` override / delta
  update) and records a cover with `ack:false`; an "awaiting ack" line lets
  the covering person **acknowledge** (S60a). Assignee now resolves per row
  (`resolveAssignee`) and an override/delta can carry `assignee` + a `cover`
  record. Deferred: buffers (S8.5 — BD23 open), event-derived off-site,
  push-notify on cover.
- **41.10 — S9 (partial): desktop spine + week load-silhouette. AUTHORED
  `v0.10.51-alpha` (2026-06-25); pure frontend, no migration.** At lg+ the
  Schedule becomes a 3-column workbench: a thin **day-rail spine**
  (`DayRailSpine`) pinning the day's shape (bar height = block item count;
  warn-tinted on man-down, accent for the "now" block), the unchanged
  accordion in the centre, and a **week day-list of fullness silhouettes**
  (`WeekList`, `src/lib/schedule/weekView.js` — bars sized by item COUNT,
  not duration, so no data dependency), tapping a day opens it (the viewed
  day is now state). A desktop Day/Week/Month toggle is shown with Day
  active. Phone is unchanged (sidebars are `hidden lg:*`). **This completes
  every screen demonstrated in the minimalist mockup.** Deferred: the
  Week/Month center views, Calendar (events) absorption, per-person
  start-time line, the seal worked-window stamp, the should→must box.
- **41.11 — S9: events absorbed into the Today timeline. AUTHORED
  `v0.10.52-alpha` (2026-06-25); pure frontend, no migration.** `deriveDay`
  already folded in event occurrences + active projects, but the Schedule
  rendered only chore rollups. Now the accordion merges chore blocks with
  **event entries** in one time-ordered timeline (`EventEntry`): each event
  is an openable line (kind-coloured dot + start time) whose panel shows the
  time window, `kindLabel`, location, subtitle, a recurring marker, and an
  "Open in Calendar" jump. Events fold into the **confirm** doc as
  `source_type:"event"` entries (the schema's `source_type` is a freeform
  string — no migration), the confirm-button count gains a `· N events`
  segment, and the source-changed ribbon now tracks added/removed events.
  The empty-state + confirm-enabled checks key off the merged timeline, so
  an events-only day is valid. "now"/seal/spine stay on chore blocks.
  Deferred: project-work rows (need a placement delta + enum migration),
  the event buffer/equipment checklist (no generic data), per-person
  start-time line, the seal worked-window stamp.
- **41.12 — S33: search-to-add overhaul. AUTHORED `v0.10.53-alpha`
  (2026-06-25); pure frontend, no migration.** Replaces the flat one-tap
  `SearchSelector` (which added a chore at every place at once) with the
  mockup's Hero 4 flow in a new `AddToScheduleSearch` component:
  categorised results (a **Chores** section + a **One-off task** action),
  chores **deduped by title** so a chore that fans out to several places
  shows once as "N places · pick one", and a **two-step place-narrow** —
  tapping a multi-place chore opens a place list (with an "All N places"
  shortcut) and picking one adds just that (chore, place) via the same
  `chore_completion` write as Rounds; single-place chores still add in one
  tap. The query also offers "Add '…' as a task" (an ad-hoc commitment).
  Dead `SearchSelector.jsx` deleted (no-legacy). Deferred: the Project
  category (needs a project-node placement delta + `source_type` enum
  migration), and dedup across the (rare) same-title-different-definition
  case beyond title grouping.
- **41.13 — mockup polish. AUTHORED `v0.10.54-alpha` (2026-06-25); pure
  frontend.** Two fidelity fixes against the minimalist mockup: the
  Confirmed pill now shows the **confirmed-at clock stamp** ("Confirmed
  6:08a", from the capture's `confirmed_at`), and **jump-to-now** is now
  conditional — the "Now" FAB fades in only once the open block scrolls out
  of view (IntersectionObserver on the open block), as the mockup does,
  instead of being permanently visible. (The mockup's round "+" add FAB was
  intentionally not added — the toolbar's "Add chore" / "Time off" already
  cover it without duplicating the affordance.)
- **41.14 — project-work rows. AUTHORED `v0.10.55-alpha` (2026-06-25); NO
  migration needed.** Closes the last minimalist-mockup gap (Hero 1's
  project row + Hero 4's Project search category). A schedulable project
  "node" = an incomplete step of an active project. Picking one in the
  search writes a `project_node` commitment (`useScheduleDeltas.addProject`,
  source_ref = {project_id, step_id, title, project_title}); it folds onto
  the day like an ad-hoc row (foldDeltas is generic) and renders through the
  generalised `AdHocRow` — a checkable row whose done-state lives on the
  commitment, with a "project" pill and an italic project-title sub-line.
  Counts/seal/man-down/edit/cross-day all treat it as a commitment-backed
  row; it folds into the confirm capture as a `project_node` entry.
  **No migration:** the `commitments.source_type` CHECK constraint already
  whitelisted `'project_node'` (and `'event'`) back in migration 0034 — the
  planned 0035 was unnecessary. Deferred: a block-picker on project add
  (lands in "anytime" today; movable via the edit sheet), the event
  buffer/equipment checklist, and the richer should→must box.
  **This re-completes every screen in the minimalist mockup.**
- **41.15 — day-spine + accordion rework (Design Bracket 2). AUTHORED
  `v0.10.56-alpha` (2026-06-25); pure frontend.** After James's live test of
  the desktop Schedule, a focused Design Bracket (3 stances → coded
  head-to-head → the Design, `the-design2.md`) reworked the interaction model.
  Winner = **Rethinker master-detail** + grafts. The single-open accordion is
  replaced by a **master-detail** surface: the center renders exactly ONE
  thing — the focused block's checklist, an event's panel, or (nothing
  focused) the **whole-day overview agenda** — so you never scroll past an
  open block to reach the next (the founding complaint). New `focus` model
  (`focusSel`: null=follow-now / "overview" / a bucket); picking the open
  block collapses to the overview (closable). The **spine is now the
  navigator**: `DayRailSpine` (desktop) + new `DayStrip` (phone) are clickable
  load gauges that read as a **time axis** — each segment carries the block's
  sun-position glyph + start time over a dawn→night wash (James's tweak: no
  blank boxes; "tap a time of day"). A **ring/fill dual-marker** (clock's
  pick = ring/now, your pick = fill/focus) runs on the spine, the strip, and
  the **week pane** (today = ring, viewed day = fill + a today dot). An
  explicit **"Whole day"** affordance returns to the overview; seal→advance
  now drives `focus`; the man-down leak + Cover render on the overview row and
  the detail. Plus a global `@layer base` rule restoring `cursor: pointer` on
  enabled buttons (Tailwind v4 dropped it) — fixes the row ellipses + every
  icon button. Deferred: per-person split load lanes (single-lane first),
  wiring the Week/Month tabs (next), event markers on the axis.
- **41.16 — Week/Month tab wiring (the three zooms). AUTHORED
  `v0.10.57-alpha` (2026-06-25); pure frontend.** The desktop Day/Week/Month
  toggle was inert "coming soon" spans; it now drives a `viewMode` state that
  swaps the centre for two wider navigators ("one timeline, three zooms").
  **Week** = seven day-columns, each listing its blocks (icon + name + count)
  with a per-day total; tap a day → opens the Day zoom on its overview, tap a
  block → opens the Day zoom focused on that block. **Month** = a Sunday-first
  calendar grid; each cell shows the date + an accent load-bar scaled to the
  day's item count + the total; tap a cell → opens that day. Both reuse the
  cheap chore fan-out (`rollupChoresForDay`, counts only — no duration data),
  carry the feature's **today = ring / viewed = fill** markers, and stamp a
  **Confirmed ✓** on agreed days pulled in one `readCaptures` range query over
  the visible window. New `src/lib/schedule/monthView.js` (`monthFullness`
  calendar-grid engine) + `src/components/ScheduleZoom.jsx` (`WeekView` /
  `MonthView`); `blockFullness` now carries the `block` object for icons. In
  the wider zooms the day chrome (spine, week silhouette, confirm bar,
  reservations, day-strip, jump-to-now) hides so the centre grid is the
  navigator; the header subtitle tracks the zoom (day → week range → month).
  The month memo is keyed on year-month so it recomputes per-month, not
  per-day. Phone is untouched (the toggle is desktop-only). Deferred: man-down
  warnings in the zoom grids (would add per-day delta reads).
- **41.17 — must/should escalation in the Schedule (S13–S15). AUTHORED
  `v0.10.58-alpha` (2026-06-25); pure frontend, NO migration.** A full
  story-coverage audit (`.ignored/schedule-feature/coverage-audit.md`) found
  the must/should distinction reported "missing" was actually derivable from
  the existing chore model — window frequencies (`weekly_window` /
  `monthly_last_week_window` / `block_on_weekday` deadline) ARE the "shoulds"
  (deferrable across a window), fixed daily/specific-day chores are the
  "musts", and `choreDaysRemaining()` already supplies the escalation signal
  (already painted by `ChoreRemainingPill`). So no field was added to the live
  `chore_definitions`. `ChoreCheckRow` gains a `showPriority` prop (Schedule
  passes it; Rounds doesn't, so execution is unchanged): shoulds with a future
  deadline render an "optional today" tag; when a should hits its deadline
  (`due today` / `overran`) the row gets the **should→must escalation box** from
  the Design (`the-design.md` §4) — a left accent-deep border + faint wash
  (warn-tinted if overran) — auto-promoting it to a must. Deferred: the "note
  why today" input (derived shoulds auto-appear rather than being hand-pulled;
  the commitment `pact.reason` field is ready when a trigger exists).
- **41.18 — looking-back / routine drift: the Review zoom (S11 / Epic L).
  AUTHORED `v0.10.59-alpha` (2026-06-25); pure frontend, NO migration.** A
  fourth tab — **Review** — on the desktop Day/Week/Month toggle, reading two
  durable sources with no new storage: ACTUALS from the commitments exec
  history (`useRunHistory`) and PLANNED from `schedule.confirmed_day` captures.
  New `src/lib/schedule/lookBack.js` derives **(a) routine drift** — per chore
  block, mean actual start over the last 14 days vs before, flagged "Nm later"
  (warn) / "Nm earlier" (resolved) / "steady" (S117/S86) — and **(b) per-day
  plan-vs-actual** — per confirmed day, planned blocks/items vs blocks that
  actually ran (S116/S91/S119). New `src/components/ScheduleReview.jsx` renders
  both, framed "for learning the routine, not grading" (S120). Deferred:
  should-slippage (S118) + recurring-conflict spotting (S121) — both need the
  capture's `shoulds` array, which `buildConfirmedDoc` doesn't populate yet.
- **41.19 — reminders: the daily build/confirm nudge (S10 / Epic K).
  AUTHORED `v0.10.60-alpha` (2026-06-25); migration `0035` (additive).** A
  scheduled Netlify function (`schedule-reminder.mjs`, the `heartbeat.mjs`
  cron pattern, `0 11 * * *` ≈ 6–7am ET) reads whether today's
  `schedule.confirmed_day` capture exists; if not, it pushes ONE shared nudge
  ("Review and confirm today's plan", deep-linking `/schedule`) to recipients
  — only those who've opted in (S110/S113/S115). **Per-user control** lives in
  Settings → Notifications as one 3-way picker (Every day / Weekdays / Off),
  backed by migration `0035` (additive `schedule_reminder_enabled` +
  `schedule_reminder_frequency` on `user_preferences`; `useUserPreferences`
  carries them). The function joins subscriptions→prefs (default enabled/daily)
  and respects weekday-only. `public/sw.js` now honours a per-push `url` +
  `tag` so the nudge deep-links. Migration `0035` applied to prod + verified
  (both users default enabled/daily; backup `.backups/2026-06-25T22-37-09Z`).
  Deferred: "tomorrow looks heavy" (S114 — the server can't derive the day's
  load without the client engine) and the man-down push (S111 — client-
  triggered). **S10 + S11 both complete.**
- **41.20 — coverage: free-text notes (S36) + future-day confirm label
  (S82). AUTHORED `v0.10.61-alpha` (2026-06-25); pure frontend, NO migration.**
  S36: the `note` commitment type (already whitelisted by the source_type
  CHECK) gets a UI at last — "Add … as a note" in the add-to-schedule search;
  notes render as a quiet, non-checkable marker row (sticky-note glyph + italic
  text + remove) via a new `NoteRow`. Notes are excluded from a block's work
  counts/seal logic and from the confirmed-day capture's entries (markers, not
  work) — fixing a latent "block never seals" trap. `addNote` in
  `useScheduleDeltas`. S82: the Confirm button now reads "Confirm <date>" when
  viewing a non-today day, so confirming a future day is visibly distinct.
- **41.21 — buffers: settle BD23 + the market buffer & equipment checklist
  (S53/S55/S57/S61, BD22/BD23). `v0.10.62-alpha` (2026-06-25); pure frontend,
  NO migration** (the `buffer` source_type was whitelisted back in 0034).
  **BD23 settled:** a buffer is its own `buffer` commitment — *a reservation
  bound to an activity* (BD22), not a field on chores/events (keeps chores lean,
  BD3). The **bufferable interface**: any activity with a time anchor (an event,
  or a focused chore block with a start + duration) exposes an "Add buffer"
  affordance in its detail panel. New `src/lib/schedule/buffers.js`
  (`bufferWindow`/`buildBuffer`/`buffersForTarget`/`describeBuffer` — resolves
  the reserved window from the activity's anchor + side) + `BufferSheet.jsx`
  (side before/after/both · length · optional label · setup/cleanup checklist ·
  optional reserve-for person). A buffer renders in its activity's panel as a
  "Buffer reserved START–END" line + a tickable checklist (done-state in
  `source_ref.checklist`, written through the outbox = offline-safe); it also
  shows as a dashed Timer chip in the day's reserved-time strip. It reserves
  adjacent time and never moves the thing it buffers (S61). `addBuffer` /
  `toggleBufferItem` in `useScheduleDeltas`; `'buffer'` added to its
  `DELTA_TYPES`. Matches the minimalist mockup's market event panel (8–9 buffer
  + "Load market equipment" list). Deferred: S54 buffer-all-occurrences (needs a
  recurring rule) + S53 auto-reserve; S61 live squeeze-detection.
- **41.22 — multi-day add (S34). `v0.10.63-alpha` (2026-06-25); pure frontend,
  NO migration.** The add-to-schedule search gains a "Days" chip row (the viewed
  day + the next six; the viewed day reads "Today" when it's actually today).
  Ticking extra days fans the add out — one commitment per date — for chores,
  tasks, notes, and project steps alike. `useScheduleDeltas` add functions
  (`addTask`/`addNote`/`addChore`/`addProject`) take an optional trailing
  `dates` array via a shared `insertEach` fan-out (default = the viewed day, so
  every existing single-day call site is unchanged). The footer reflects the
  count ("Adds to 3 days").
- **41.23 — multi-day + recurring reservations (S45/S46). `v0.10.64-alpha`
  (2026-06-25); pure frontend, NO migration.** `ReservationSheet` gains a
  "Repeat across days" mode: weekday chips (preselecting the viewed day's
  weekday) + a horizon (1/4/8/12 weeks). It materialises one `reservation`
  commitment per matching date from the viewed day forward — so "every Sunday
  off for 8 weeks" (S46) and "Mon–Fri this week" (S45) are both one action,
  while each stays a plain per-day commitment the existing per-day read +
  man-down logic already handles. Materialised reservations carry a `series`
  id in `source_ref` (surfaced as a Repeat glyph in the day's reserved-time
  strip). `addReservation` routes through the shared `insertEach` fan-out.
  Note: each materialised day is removed individually (off *this* Sunday);
  bulk "remove the whole series" is deferred.
- **41.24 — conflicts: the one list (S56a/b/c) + double-booking (S58).
  `v0.10.65-alpha` (2026-06-25); pure frontend, NO migration.** A "Conflicts"
  control in the day header (warn-coloured with a count when the viewed day has
  any) opens a `ConflictsPanel` listing every conflict in one place: the viewed
  day's man-downs + double-bookings, and a 14-day horizon scan for man-downs
  ahead (recurring days-off from 41.23 surface here). From the list you jump
  straight to a conflict in context (S56b — focus its block, or open the day it
  falls on) and step next/previous with ↑/↓ (S56c). New
  `src/lib/schedule/conflicts.js`: `doubleBookConflicts` (same person, two
  overlapping different-block assignments — S58, distinct from a man-down where
  someone's away) + `scanHorizonManDown` (derives each upcoming day via
  `rollupChoresForDay` + `resolveAssignee` and checks reservations read once
  when the panel opens). New `ConflictsPanel.jsx`. Note: the horizon scan is
  man-down only (the reservation-driven case); horizon double-book is deferred.
- **41.25 — edit an event's time from the schedule, this/following/all (S67).
  `v0.10.66-alpha` (2026-06-25); pure frontend, NO migration.** A focused event
  in the timeline was read-only (only "Open in Calendar"). It now offers
  "Edit time" → a small `EventTimeSheet` (start/end). A recurring occurrence
  then pops the shared `EventScopePrompt` (this / this-and-following / all);
  a one-off writes straight to its occurrence. Scopes apply via the same
  mutators the Calendar's `EventEditor` uses — `this` = an occurrence override
  upsert, `all` = `updateSeries` (rebuilt dtstart time + duration; one-offs
  also mirror the occurrence), `following` = `splitSeries` at the date with the
  new time. `data.events` is kept live by refdata's realtime channel, so the
  day re-derives after the write with no local thread. Time-only by design:
  date moves + full recurrence/title edits stay in the Calendar editor.
- **41.26 — week reservations (S80) + yesterday's unfinished musts (S12).
  `v0.10.67-alpha` (2026-06-25); pure frontend, NO migration.** S80: the Week
  zoom now shows each person's reserved non-work time per day — a one-range read
  of the week's `reservation` commitments, collected per day and rendered as
  small "James off / Jim 1–4p" chips under each column (`WeekView` gains a
  `reservations` prop + `reservationChip`). S12: when building today, a
  warn-bordered banner surfaces the must-do chores that fell due *yesterday* and
  weren't completed (shoulds — deferrable window chores — are excluded; they
  roll forward by design). Computed from yesterday's `rollupChoresForDay` ×
  `isMustChore` (the same must/should rule ChoreCheckRow uses) against
  yesterday's completions (its own per-date `useChoreCompletions`), via
  `doneCountForChore`; dismissible.
- **41.27 — split a chore block for one day (S72). `v0.10.68-alpha`
  (2026-06-25); pure frontend, NO migration.** A focused block with ≥2 rows
  gains a "Split block" action → a `SplitBlockSheet` to pick a second-sitting
  time + which rows move to it. Apply bulk-writes a clock-time override to each
  chosen row through the SAME per-row path edits already use (derived chores →
  `override` commitment, commitment-backed rows → `updateDelta`), so the moved
  rows show their new time in the block, reading as a second sitting. The
  global block durations are untouched (instance-local, like every schedule
  edit). Reuses `writeRow`; no new write plumbing.
- **41.28 — DB cleanup: drop the dead `timeline_items` view + orphaned
  `chore_runs`. `v0.10.69-alpha` (2026-06-25); migration AUTHORED, NOT yet
  applied to prod.** Migration `0036_drop_dead_timeline_items_and_chore_runs`
  drops the dead view (replaced by `deriveDay.js` in S3) + the orphaned
  `chore_runs` table (generalised into `commitments` in 0029; every live query
  reads `commitments`, both inbound FKs were repointed, only comments still
  name it) + the now-orphaned `touch_chore_runs_updated_at()` trigger function.
  DESTRUCTIVE — departs from additive-only on purpose; uses RESTRICT so an
  unforeseen dependent fails the push loudly. **Pending the push protocol:**
  backup → confirm commitments(chore_block) parity → James runs
  `supabase db push --linked`. This closes the Schedule coverage tail.
- **41.29 — buffers, all occurrences / auto-reserve (S53/S54). `v0.10.70-alpha`
  (2026-06-25); pure frontend, NO migration.** `BufferSheet` gains an "Apply to"
  toggle — **This time** (a one-day buffer, as before) or **Every time / Every
  day** (an auto-reserve template). A template is a `buffer` commitment carrying
  `source_ref.scope='all'`, read across all days by a new `useBufferTemplates`
  hook and SYNTHESIZED onto each occurrence by `deriveTemplateBuffer` — its
  window recomputed from that day's anchor (occurrences can shift), its
  checklist done-state stored per-day in `source_ref.checklistState[iso]` so the
  "load the truck" list resets each market day. Template buffers render in the
  activity panel with an "every time" badge; per-day buffers exclude scope-'all'
  rows so there's no double-render. So: set the market's 1-hour setup buffer +
  equipment list ONCE and it appears on every market day.
- **41.30 — conflict completeness: buffer squeeze (S61) + horizon double-book.
  `v0.10.71-alpha` (2026-06-25); pure frontend, NO migration.** S61: a buffer
  reserves adjacent time and never moves the thing it buffers — it now SURFACES
  THE SQUEEZE when other work lands in the reserved window. `bufferSqueezes`
  checks every active buffer's window (per-day + templates synthesized onto
  today's events/blocks, via `activeBufferWindows`) against the day's assigned
  rows (a buffer's own block is exempt); squeezes show in the conflicts list
  (Timer glyph) AND as an inline warn in the buffer's panel. Horizon scan
  (`scanHorizonManDown` → `scanHorizonConflicts`) now also detects double-
  bookings on upcoming days, not just man-downs.
- **41.31 — bulk recurring-reservation remove. `v0.10.72-alpha` (2026-06-25);
  pure frontend, NO migration.** A recurring reservation's strip chip now has
  two removes: the `X` drops just that day ("off *this* Sunday after all"), and
  a `CalendarX` drops the whole series. `removeSeries(seriesId)` looks up every
  member by `source_ref->>series` server-side and deletes each through the
  outbox (offline-safe, same path as single-day removal); a confirm guards it.
  This closes the entire Schedule deferred-items list — the feature now fully
  implements the story set + mockups (the only remaining gate is applying
  migration 0036 to prod via the push protocol).

**Overnight + Project blocks (41.32+).** Tiles the Schedule day's negative
space: the gaps between (and before the first) chore blocks become legible
**Project blocks**, and the wrap-around from the last chore block tonight to
the first tomorrow becomes the **Overnight block**. Both are **pure
derivation** — zero stored block rows, **v1 = zero migration** (the per-day
boundary override + its storage are deferred, additive). Design settled via a
Scope Workshop → Design Bracket (Convention, de-hatched; slate-blue project
color; clock-arrow overnight icons). Build refs in
`.ignored/schedule-feature/` (`overnight-project-blocks-the-design.md` +
`…-scope.md` + `…-build-plan.md`).

- **41.32 — Project blocks: derive + render the gaps. `v0.10.73-alpha`
  (2026-06-26); pure frontend, NO migration.** A new client-side ribbon
  partitioner (`src/lib/schedule/partition.js`, `projectGaps`) resolves every
  active chore-block definition that *occurs* on the day (occurrence-based, so
  project time is well-defined even on a quiet day), walks the gaps before the
  first / between blocks (the after-last window is reserved for Overnight),
  trims each by per-day buffer windows, clamps to a farm-wide default band
  (8 AM–6 PM; DST/sun-drift safe — inverted gaps dropped), drops gaps < 30 min
  or with nobody free, and attaches structured `{freeCount, who}` availability.
  `deriveDay` surfaces these as a `projectSegments` field; `Schedule.jsx`
  renders them in the overview agenda ("Project · <range>" + a quiet who's-free
  badge, both-free emphasized + the passive "free — nothing planned" note) and
  the day spine/strip (`ScheduleSidebars.jsx`) as soft slate-blue,
  coarse-duration-sized, de-hatched gap gauges. Display-only this sub-batch
  (auto-pull/contents/detail = 42.2). Folds in the design-phase prep (lucide
  0.462→1.21 for the overnight clock-arrow icons; the `--c-project` slate-blue
  token + slate-blue/periwinkle palette ramps). Stories P1–P10 (P9 per-day
  boundary editing deferred), P-B1/2/3/4/10. Known limitation: all-occurrences
  buffer *templates* don't yet trim gaps (per-day buffer deltas do) — a later
  buffer-integration follow-up.
- **41.33 — Project blocks: contents (auto-pull + detail). `v0.10.74-alpha`
  (2026-06-26); pure frontend, NO migration.** Project blocks become
  openable and fillable. A shared placement helper
  (`src/lib/schedule/placement.js`, `segmentForStart` + `buildDaySegments`)
  tiles the day's chore-block windows with the derived Project gaps and routes
  any *timed* delta to the segment whose half-open `[start, end)` window holds
  it (the P-B8 catch rule; a boundary minute falls to the chore block that
  starts there). A new `nextProjectStep(projects, todayISO)` in
  `src/lib/projects.js` auto-pulls the top active project's (lowest
  `sort_order`) next incomplete step as the **first** Project block's default
  **occupant** — display-only, zero writes on open (P11/P-B5/P-B6 first-block
  scope). `Schedule.jsx` computes each segment's `items` (project_node / ad_hoc
  deltas whose `clock_time` routes there, excluded from the "anytime" fold so
  they render once) and renders a dedicated Project-block **detail**: the
  occupant (checkable → write-through, with a **Swap**) or its placed items
  (checkable + removable), an inline "+ one-off task" and "+ project step"
  (both carry the segment's start time so the add routes back in — the add-to-
  day search bound to the block), a who's-free badge, and the passive empty
  note — **no rounds, no seal** (P-B7). Completing an item writes straight
  through to `project_steps.completed_at` (P14, one source of truth; the
  reference-data realtime channel refreshes `data.projects`). The Project
  segments in the agenda + day spine/strip (`ScheduleSidebars.jsx`) are now
  focusable buttons carrying a done tally. Loader fix:
  `useReferenceData.loadProjects` now hydrates each project's `steps`
  (id/title/sortOrder/completedAt) so the auto-pull + node list see live step
  titles. `useScheduleDeltas.addTask` / `addProject` gained an optional
  `clockTime`. Stories P11–P14, P-B5, P-B6 (first block; per-block refine
  deferred), P-B7, P-B8. Multi-block auto-pull + per-day boundary override
  still deferred.
- **41.34 — Overnight block: derive + two-day render. `v0.10.75-alpha`
  (2026-06-26); pure frontend, NO migration.** The trailing wrap-around the
  Project partitioner leaves out (P-B1) becomes a real block. New pure engine
  (`src/lib/schedule/partition.js`): `overnightWindow(date, nextDate, blocks)`
  derives `[lastChoreEnd(date), firstStart(nextDate))` from occurring block
  definitions (occurrence-based — a true down day has no anchor, so no
  Overnight: O-B1/O-B2), and `inOvernight(win, min, side)` is the half-open
  catch (an item exactly at the next first block's start belongs to that
  block, not Overnight: O-B3). Each day page shows **two** overnight
  references — a **leading** shift (last night -> this morning, pinned first)
  and a **trailing** shift (tonight -> tomorrow, last) — and each assembles its
  items from **two calendar dates** (the start date's evening rows + the end
  date's pre-dawn rows) so the one stored row surfaces on both day pages from
  its literal `(run_date, clock_time)`, no duplicate (O3/O4). A new read-only
  `useNeighborDeltas(prevISO, nextISO)` hook fetches the adjacent days' timed
  deltas so both edges populate offline; until it resolves the block renders
  **"syncing..." never a false-empty** (Dad's rule). `Schedule.jsx` derives the
  overnight entries (parallel path, like Project blocks), excludes the caught
  ids from the chore-block fold (Project gaps win any morning-band overlap),
  and renders them in the agenda + spine/strip (`ScheduleSidebars.jsx`) with
  the **`ClockArrowLeft`/`ClockArrowRight`** two-day glyphs, a stable range
  label ("Overnight - 9:40p-5:10a"), and a "counts tonight" note on the start
  day. Two shipped code fixes: `startKey` pins the **leading** overnight first
  (its window start is last night's evening, but it precedes the morning
  blocks), and the now-ring lands on the overnight wrap before sunrise / after
  the last chore (`nowBucket` wrap). Overnight detail = tickable items (each by
  its kind; project steps write through), **no rounds, no seal**, not pickable
  for adds (O7/O9/O11). Stories O1-O11, O-B1/O-B2/O-B3. Scoped to **timed
  deltas** (tasks + project steps) this batch; event/chore overnight-catch +
  the conflict exemption, start-day-only counting, and confirm/week/month fold
  are **batch 41.35** (integration).
- **41.35 — Overnight + Project: confirm / counts / conflict integration.
  `v0.10.76-alpha` (2026-06-26); pure frontend, NO migration.** The
  counts-and-confirm half of the integration pass. `buildConfirmedDoc` +
  its post-confirm reconcile (`changes`) now fold the placed items that live
  OUTSIDE the chore blocks — every Project-gap item + the **trailing**
  (start-day) Overnight items — keyed by commitment id like the in-block
  ad-hoc rows, so confirming a day agrees the project + tonight's overnight
  work, not just the chore blocks (O-B4/O-B5). Overnight counts on the
  **start day only**: the trailing night (starting tonight) is folded on this
  page; the same item shows as the *leading* block on tomorrow's page and is
  excluded there, so it never double-counts (O-B4). The day total
  (`totalRows`, the spine "N items" + agenda subtitle) folds the same placed
  items. Overnight + Project are confirmed **exempt** from man-down /
  double-book / buffer-squeeze (O-B6) **by construction** — the conflict
  scans build their rows only from `blockRows`, and those items live outside
  it (documented as an invariant). P-B8 (auto-route by time) already
  satisfied since 41.33/41.34. **Deferred to 41.36 (with rationale):**
  week/month day-count fold of overnight/project (O-B7) — the week/month
  zooms are deliberately delta-free chore silhouettes; folding delta-based
  counts needs per-day commitment reads across the grid, an architecture
  change (and regular ad-hoc/project deltas are uncounted there too);
  event/chore overnight-catch (O6 fuller) — events need neighbor-day
  derivation + a distinct overnight render (they complete unlike the shared
  commitment tick), chores can't fall in the between-frames gap; and the
  internal placement-unification refactor (collapse the parallel
  projectPlacements + overnightCaughtIds paths into one segmentForStart pass)
  — the two-date overnight assembly inherently needs side-based catch beyond
  a same-day lookup, so the parallel paths stay. **41.36 = integration tail
  (the three deferrals above) + the original batch-5 hardening**
  (retime-across-midnight run_date flip, sub-30-min gap re-home, DST/sun-drift
  clamp, partition property test, full O#/P# story sweep).
- **41.36 — Overnight + Project: hardening + partitioner fix. `v0.10.77-alpha`
  (2026-06-26); pure frontend, NO migration.** Closes the planned five-batch
  arc with a property test that immediately earned its keep. New committed
  property test (`scripts/test-schedule-partition.mjs`, run via
  `npm run test:partition` — node-based, matching the repo's script
  convention, no new framework) asserts the partitioner's invariants over
  4,000 randomized block/reservation/buffer configs: project segments are
  ordered, non-overlapping, non-negative, >= 30 min, clamped inside the
  farm-wide band, each with someone free; a buffer-swallowed gap drops and its
  items re-home to "anytime" (no silent orphan — the sub-30 safety); inverted
  (DST/sun-drift) gaps never survive; `overnightWindow` is null on a down day
  and `inOvernight` is half-open at the dawn edge with disjoint evening/dawn
  sides; project gaps never overlap a chore-block window. **The test caught a
  real latent bug:** `projectGaps` walked gaps between consecutive-by-*start*
  blocks, so when two blocks overlap and an earlier-starting one ends later, a
  "gap" could run straight through it. Fixed by merging block windows to their
  union first (`mergeWindows`), used by both `projectGaps` and `overnightWindow`
  (which now anchors on the true last-block end). Real chore blocks don't
  overlap, so this never surfaced in the field — but a sun-resolved block and a
  fixed one can coincide on some days, so the fix matters. Story sweep: P1-P14
  + P-B1-B10 satisfied (per-day boundary override + multi-block auto-pull
  deferred by scope decision); O1-O5/O7/O9-O11 + O-B1-B6 satisfied.
  **Remaining backlog (post-arc polish, not core):** O6 event/chore
  overnight-catch (events need neighbor-day derivation + a distinct overnight
  render; chores can't fall in the between-frames gap), O-B7 week/month
  day-count fold (the silhouette zooms are deliberately delta-free — folding
  needs per-day commitment reads across the grid), the retime-across-midnight
  run_date flip (not triggerable today — overnight items aren't edit-exposed),
  and the optional placement-unification refactor. The Overnight + Project
  feature is functionally complete for its main flows.

Features cut from the plan — kept so the reasoning isn't lost.
Batch numbers are retired with them, leaving gaps in Upcoming.

### Batch 34 — App-wide bookmarking · cut 2026-06-02
Was: per-user bookmarks of arbitrary entities/pages, surfaced in
nav, via a `user_bookmarks (user_email, target_type, target_id,
label, sort_order)` table. Cut: James doesn't expect to need it —
the sidebar plus the upcoming app-wide search (Batch 33) cover
the navigate-to-anything need.

### Batch 38 — Voice / natural-language control · cut 2026-06-02
Was: speech-to-text on device; intent → tool-call mapping via
Claude; confirmation step for state-changing actions. Cut: James
doesn't expect to need it at all.

---

## Recently added — sequencing TBD

These came up after the original 22-batch plan was set. Slot in
once the user picks where they belong.

### Broiler-batch "weeks remaining" dashboard widget ✅ SHIPPED
Added 2026-05-05; shipped 2026-06-02 with Batch 26.2
(`v0.10.25-alpha`). The open question resolved as: batches carry
`arrival_date` (already present) and the species carries the new
`target_process_weeks` (0023); a scheduled processing event
overrides the target when one exists.

### Mileage tracker
Added 2026-05-06. Track miles driven for farm-related trips —
markets, deliveries, supply runs, vet visits, processing-plant
runs. Primary motivation: tax deductions (the per-mile
business-use deduction is real money for a small farm) and
per-trip cost analysis (is this market actually worth the drive?).

UI placement is open. Three candidate homes:
- **Its own page** under "Other" or a new logistics section, with
  a simple trip log (date, miles, purpose, vehicle, optional event
  link) plus annual + per-vehicle totals.
- **Event-attached.** Marking a market or delivery done prompts
  "miles driven?" and links the trip to that event automatically.
- **Top-bar quick action.** A "Log trip" button near the inbox
  bell for ad-hoc trips that aren't tied to an event.

v1 likely needs a `mileage_logs` table (date, vehicle_id, miles,
purpose, event_id nullable, notes), an annual totals view for tax
season, and per-vehicle totals (which feeds future maintenance
scheduling — oil changes every X miles, tire rotation, etc.).

Adjacent ideas, probably their own batches:
- Vehicle records (make, model, plate, current odometer,
  insurance dates) so multi-vehicle households attribute trips
  correctly.
- Maintenance schedule per vehicle, surfaced when the odometer
  crosses a threshold.
- Fuel + repair cost tracking, totalled into a per-mile cost
  alongside the deduction view.

### Event time footprint — setup / breakdown + live travel time
Added 2026-06-03, expanded same day (James). An event's *real* time
commitment is bigger than its published window. A farmers market
that "runs 9–1" actually eats the day: drive there, set up the
stall, work the market, break down, drive home — and then there's
*more work at home* (store the processed chickens, put away the
tent and coolers, pressure-wash the crates and trailer). Processing
days have the same shape. Today the app only models the event
window (start/end time), so the Schedule, Now, and Rounds all
under-state how long you're tied up and *when you have to leave*.

Two parts: fixed setup/breakdown buffers, and **live, predicted
travel time**.

**1. Setup / breakdown — per-event, defaulted.**
`setup_min` / `breakdown_min` with **per-event-kind defaults that are
overridable per occurrence** (a market kind defaults to e.g. 30 min
setup + 20 min breakdown; a one-off pickup needs none; this specific
processing day might need more). Pure-additive: defaults on
`event_kinds`, nullable overrides on `event_occurrences`.

**2. Travel time — looked up, not typed.** James's call: don't make
us guess the drive. Like iOS Maps predicting traffic/ETA for a
*future* departure, the app should look up travel time both **to**
and **home from** the event:
- **Lookups are scheduled, not one-shot.** Run at: event creation,
  then **T-1 day**, **T-3 hours**, and **T-30 min** relative to the
  computed *leave-by* time. Goal: anticipate major delays early
  enough to plan around them.
- **Leave-by = event_start − setup − travel_to**, recomputed on
  every lookup as predicted traffic shifts.
- **Arrive-home = event_end + breakdown + travel_home**, so we can
  tell when we'll actually be back (and when the post-event work can
  start).
- **Alerting:** if the leave-by time changes **within 1 day of the
  event**, fire a **push notification + an in-app alert**. (Reuses
  the Batch 11.3 web-push infra.)

**3. Post-event work.** Getting home isn't the end — many events
have a tail of chores (store chickens, stow tent/coolers,
pressure-wash crates + trailer, …). These should be modeled so they
land on the day's plan after arrive-home, not forgotten. Likely a
**process expansion** (Batch 23) or post-event chore set keyed to
the event kind, anchored at arrive-home.

**Where it shows up:**
- **Schedule** — the occupied block spans travel + setup + core +
  breakdown + travel-home + post-event work, with the core window
  emphasized and buffers shaded. Nothing else schedules into it.
- **Now / leave-by** — the actionable signal is "leave by 8:15,"
  with a live "traffic looks heavy, leave 20 min earlier" when a
  lookup moves it.
- **Rounds / chores** — buffer + travel + post-event time is
  unavailable for other chores; the day's capacity shrinks.

**Build notes / dependencies:**
- **Maps/traffic API with future-departure prediction.** This is a
  web app, so MapKit JS or (more likely) Google's Routes/Directions
  API with `departure_time` + a traffic model. Needs an **API key
  (credentials → Batch 30 territory)** and has per-lookup cost — the
  scheduled-lookup cadence above keeps the call count bounded.
- **Geocoded endpoints.** Origin = the farm's coordinates;
  destination = the event's location. Events need a real
  address/lat-lng to route to (markets, plants) — see the data-audit
  prerequisite below.
- **A scheduler for the timed re-lookups** (creation / T-1d / T-3h /
  T-30m). Server-side: Supabase scheduled function / pg_cron / edge
  job, or an extension of the Batch 19 automations engine. Each run
  recomputes ETA → updates leave-by/arrive-home → diffs against the
  last value → notifies on change.
- Pairs with the **Mileage tracker** (same "a market costs more than
  its hours" theme — one models time, the other miles/dollars) and
  could share both the per-event-kind defaults UI and the geocoded
  endpoints.

This has grown past a single batch — realistically: (a) setup/
breakdown buffers + the schedule/Now rendering first (no external
deps), then (b) the live travel-time + scheduled lookups + alerts
(needs the maps key + scheduler), then (c) post-event work modeling.

**⚠ Data-audit prerequisite (James's to-do):** before this can be
accurate, James needs to go back over the existing events and make
sure each captures its real footprint — setup/breakdown estimates,
a routable location for travel lookups, and the post-event work that
follows it home. The feature is only as good as that per-event data.

### Daily quote / artwork rotation + unlock gallery
Added 2026-05-06. Spec + dataset already drafted; assets sit at
`.ignored/quotes-and-artwork/` (44 quotes, 54 artwork candidates
awaiting curation, 48 people records, plus an `artwork_curator.jsx`
tool for pruning the artwork list down). Full handoff doc lives at
`.ignored/quotes-and-artwork/handoff.md`.

**v1 (whenever it slots in):**
- Login screen surfaces a daily-rotating piece of content
  alternating quotes (typographic display) and artworks
  (full-bleed background, dark overlay so the login form stays
  readable). Attribution block is the constant across both
  treatments — name · lifespan · role · 1–2 sentence bio.
- Dashboard widget on the Today tab shows the same item that
  day. Compact card. Same source of truth.
- Daily rotation is deterministic (`(epoch_day_index % N)`) so
  every device shows the same item the same day.
- Curation is a one-time pruning of the 54 artwork candidates
  down to ~50–60; final rotation should clear the "no repeat
  for 2+ months" target.
- ~4 hours of focused work once curation is done.

**Rainy-day v2 — the unlock game (this is the part James asked
for on 2026-05-06):**
- Quotes and artwork are *unlocked* for a user's account only
  when that user has actually viewed them (login screen view or
  dashboard-widget click both count).
- A new per-account page (nested under the user's avatar / their
  Settings area) shows the full collection: every quote and
  every artwork in the rotation. Items the user has viewed
  appear in full; items they haven't appear as a "?" tile or
  similar locked-state placeholder.
- Mechanic is Pokédex-style — a quiet incentive to actually
  pause on the login screen instead of skipping past it, and
  a way for the rotation to stop being purely ephemeral.
- New table: `user_content_unlocks (user_email, content_id,
  unlocked_at)`.
- The unlock surface is account-scoped, not global — James and
  his dad maintain independent collections.
- Out of scope even for v2: trading, leaderboards, achievements,
  search-the-collection. Just unlock-on-view + a gallery.

### Lessons module ("Lessons" page)
Added 2026-05-05. Dedicated page with its own sidebar link, plus
the surfacing infrastructure to make the lessons actually useful.

Primary functions:
1. **Capture** — log incidents / events that taught us a lesson,
   especially during routine events (e.g. processing day). Standard
   structure: what happened, why, what changes / how we get better
   going forward.
2. **Surface** — automatically present previously-learned lessons
   at the right moment. When the schedule is gearing up to
   something we've learned a lesson about, surface those lessons
   ahead of time. Verify the process actually changed — not just
   that we captured the lesson and forgot.

Build approach: scope as its own batch. Phase 1 ships capture +
browse + manual tagging. Phase 2 adds automatic surfacing once the
trigger taxonomy is settled (event kind, season, chore template,
etc.). When the feature lands, prompt James to seed two lessons:
- Memorial Day is the start of meat-selling season; rushing the
  process to have meat for the first farmers market resulted in
  birds too small.
- Processing day needs an exhaustive checklist.

---

## Feature handoff — 2026-06-03

A batch of feature requests from James, source of record at
`docs/handoffs/2026-06-03-feature-handoff.md` (verbatim). To be
reprioritized and merged with existing batches when sequenced. Two
items below (Claude agent, YoLink + transactional email) were added
in the same session and aren't in the original doc. Credential/
account setup for all the integrations these imply is walked through
in `docs/integrations-and-credentials.md`.

Overarching context that shapes several of these: **a two-person,
interrupt-driven operation** — chores break the day ~5×, so the app
should *reduce* variability and push toward single-focus execution,
not add more to juggle.

### Operator scheduling & availability
Schedule **working hours** and **time off** for both James and his
dad. Two coexisting modes: **recurring rules** ("weekends we quit at
5," "no projects on weekends — chores only") that set a standing
baseline, and **ad-hoc one-off blocks** (appointments, errands,
vacation) that override/carve exceptions. Design considerations
(not committed): **availability-at-a-glance** (who can take a task
right now), a **reason/category** per block (time off vs appointment
vs hard-stop), and feeding recurring patterns into what gets
scheduled/surfaced. Feeds the schedule-reflow + conflicts work
below.

### Projects rework — forced-ranked priority (major rework of Batch 22)
**Status (2026-06-30):** structural-core foundation SHIPPED on `main`
(commit `c911ea4`, NOT pushed) — migration `0041` (additive: `queue_state`,
`timing_note`, `locked_date`; **authored, NOT applied to prod**), the
`useProjects` data layer (forced-rank reorder, queue-state moves, lock,
timing note), and the rewritten `Projects.jsx` (ranked list w/ dnd-kit +
Focus emphasis, Unprioritized bucket, lock-to-date, timing note). Build
green; NOT runtime-verified (blocked on the `0041` push). Still deferred:
the schedule reflow engine + stale indicator + Today integration,
lock-to-date UI at phase/step/item level, clone-from-stub, and retiring
the vestigial `status` column + the ProjectPage status select.

The big one. A reframe of how projects drive the schedule:
- **Single forced-ranked list.** Every queued project ranked
  against every other — no plural "high priority" flags. The top is
  *the* focus, and working on anything else should be **painful by
  design** (the app actively directs to one thing).
- **Projects only.** Chores (non-negotiable) and events (external)
  get scheduled as needed; **projects fill the remaining time.** The
  real question: which project fills the non-chore/non-event gaps?
- **Drag reorder** that cascades (move P1 → slot 2, P2 becomes top);
  the **Today view** reflects the new top project's tasks.
- **Tandem work** (two projects in parallel) must be *possible* but
  is the accommodated exception, not the happy path.
- **Lock-to-date** is the deliberate escape hatch to jump the queue,
  available at any level (project / phase / step / task). Locked
  items stay put; the schedule **flows around** them. No "out of
  sequence" warning for a deliberate lock — but a lock that creates
  a *conflict* must surface (see Conflicts).
- **Schedule reflow:** debounced so rapid planning doesn't trigger a
  recalc per change — **ceiling ~30s** (James walked back longer),
  plus a manual "reflow" button *and* an automatic fallback.
- **Stale indicator:** when the schedule is out of sync with the
  current ranking, show a clear "stale" flag wherever priorities
  live, with a "sync/update" action anywhere it appears — so the
  view never silently rearranges; the user deliberately syncs.

### Projects — dates as light-touch metadata (part of the rework)
Traditional start/end/duration fields don't fit: durations are
unknowable under constant context-switching, and it mostly doesn't
matter ("focus on the next thing till done," not "finish by X").
Dates have value only as **manual positioning** ("do this when it
cools off, ~September") — useful *metadata*, **never fed into
scheduling logic** (that would defeat the forced ranking). A
not-yet-actionable project (rake leaves) goes to the **Unprioritized
bucket** with an optional plain-text timing note, not a date on the
ranked list.

### Projects — Unprioritized bucket (backlog; part of the rework)
A backlog for anything **not yet scoped or not yet actionable** — a
one-line idea, a partial task list, a seasonal/conditional project.
Default landing spot for projects promoted from "Just a Thought."
Moves into the active ranked list when committed to. **Explicitly
replaces any "On Hold" concept** (no duplication).

### Projects — repeatable via clone-from-stub (part of the rework)
Projects are one-off by nature, but the same *kind* recurs (building
chicken tractors — they break and get rebuilt). Need a one-click
**clone/reboot** of an existing project so the task structure isn't
rebuilt from scratch. **Explicitly rejected:** a formal Templates
folder (too much infra) — clone from a stub instead. **Time tracking
is explicitly OUT of scope** — too much overhead, don't build it.

### "Just a thought" → quick convert (extends Batch 21)
Add quick actions on a captured thought to convert it into a
**Project / Chore / Event** — route the text into the right place.
Converting to a Project lands it in the **Unprioritized bucket**.
Its own distinct feature, separate from the projects rework. (Pairs
with the Claude agent below, which can do the same by request.)

### Conflicts as a first-class concept (new; scheduling)
Conflict *indication* becomes its own thing. In a two-person op,
when two things need the same slot, someone has to take each — so
collisions must be caught **well in advance** to plan the split.
Sources: locked tasks colliding with chores/sequence; chore vs event
overlap; **two events at once** (clearest case); any scheduling
collision. Behavior: **very prominent flags** (their own "special
sauce," not a quiet warning); **no severity levels** for now (all
equally needing resolution). Don't warn for a deliberate out-of-
sequence lock; *do* surface when a lock (or anything) creates a real
conflict.

### Notifications — channels & routing (extends Batch 11.3 + Settings)
Behavior/routing, not the notification UI. Three channels: **push**
(exists), **in-app** (the inbox/alerts), and **email** (blocked on
transactional email — below). In **Settings**, a per-notification-
type × channel **grid of checkboxes** (multi-select, plus "none") —
a notification can fire on several channels at once. Plus **in-app
mute** per type so low-value notifications never enter the inbox
(pain point: logging in to a pile of junk and clearing all).
"Round finished" is the example to make configurable.

### Wish list → asset pipeline (new top-level feature)
A **prioritized list of things to acquire** (anything that costs
money — goods, services, merch). Item: title, priority (H/M/L),
cost estimate, optional product URL, description, image, captured-
by/when. **Image:** auto-fetch from a product URL; for plain-text
items, auto-pull a relevant image (likely via the **Anthropic/Claude
API** parsing the description — see agent/credentials); manual upload
overrides. **Reactions:** a thumbs-up "I agree" endorsement and a
skeptical 🤨 raised-eyebrow (explicitly *not* a neutral "meh").
Lifecycle: create/edit/delete + **Purchased** (clears it).
Filter/group by category and by priority (manual order within a
priority). **On Purchase → Asset:** pre-fill the asset-creation form
(in the matching stubbed category — tractor → tractor section) with
the wish-list data, let the user tweak each field, then save. Mostly
automated, user keeps final control.

### Asset subsystem — expand + link to work (extends Resources)
Flesh out the still-stubbed asset pages (equipment, etc.). Assets =
things the farm owns; the value is knowing what exists and what's
tied up. **Link assets to projects, chores, AND events** — when an
asset is committed it's unavailable elsewhere that day (processing
needs the F-150 + deck-over trailer; overlapping markets need
"market kit A" vs "kit B"). Any asset type is linkable. **Metadata:**
universal purchase date; type-specific — vehicles get fuel type +
**mileage history shown on the vehicle's own page** (mileage is
recorded *against the specific vehicle*, not abstractly), machinery
gets an **hours** field; more type fields later. Depends on the
**Mileage tracker** (already in this section) for the logging
mechanism — model the asset pages to accommodate it.

### Storage locations, lots & bins — FIFO (extends Batches 28 + 29)
Product lives across **multiple freezers/bins**; multiple chicken
batches; eggs daily. **Stock rotation (FIFO)** matters for food
safety + freshness. Add: **lot tracking** (each processing batch →
lot id — partly exists from Batch 28), **storage location / bin
assignment** (which freezer, which bin/partition/shelf each lot
lives in), and **fulfillment integration** — an order's fulfillment
ticket shows *where* the item is stored; pulling it decrements that
lot. (Separately flagged: James wants advice on the *physical*
organization scheme — cardboard partitions etc. — designed apart
from the app; the app just makes lot+location tracking easy
regardless.)

### File storage — cross-cutting (new)
A general file-storage capability many entities use: **cut sheets →
processing events**, **photos/videos → product pages**, **media →
the social/content calendar**, and more. Backend likely **S3 or an
S3-compatible alternative** (Cloudflare R2 / Backblaze B2 / DO
Spaces — cheaper egress, drop-in API; decision deferred). **Google
Drive pull-in** desired (there's an existing Drive account) — import
files from Drive, not just local upload. **Versioning** flagged for
design: a never-destroy + latest-pointer **manifest** pattern, plus
possibly hosting **brand assets** (logo, typefaces) — discuss before
building. (Note: the app already has Supabase Storage buckets for
product photos + project files — this generalizes that, and may
migrate or sit alongside it.)

### Guest / contributor access (lightweight; extends auth)
Gated, limited access for occasional helpers — **explicitly NOT a
full RBAC/permission grid.** Page/section-level **allow-list**: pick
which sections a verified guest can see (Sarah → social/content +
its files + post scheduling; a farm-sitter → chores, maybe
schedule). **Magic-link sign-in** with a **persistent session** (no
constant re-auth — the current Google-email-only gate needs checking
for what's supported). **Time-limited** with **auto-revocation** —
"access for this weekend" — expiry applies to guests only.

### Claude-powered agent (new; in-app chat + email-to-agent)
A conversational agent that lets James or his dad *do work in the
app by asking* — "add a just-a-thought," "someone wants on our
mailing list, add them," "I forgot to mark chore X done earlier, do
it for me." Two entry points:
- **In-app chat window** — a chat surface in the dashboard.
- **Email the app** — send a request to a dedicated address; the
  agent handles it and replies. (Depends on **inbound email parse**
  — see transactional email + credentials.)
Implementation shape: the **Anthropic/Claude API** with **tool use**,
where the tools wrap the app's existing mutations (create inbox
item, add customer + list membership, complete a chore, create an
event, etc.). State-changing actions confirm before committing
(matching the app's existing confirm pattern), and everything is
scoped to the authenticated operator. Server-side for the email path
(a Netlify function), client-side for chat. Big feature — phase as:
chat + a starter tool set first, then the email channel. Pairs with
"just a thought → convert" (same intent, different surface).

### Integrations newly named (YoLink + transactional email)
- **Transactional email** (SendGrid / Mailgun / similar) — the
  dependency under *Notifications (email channel)*, *Guest access
  (magic links)*, the *Claude agent (email-to-agent inbound parse)*,
  and *Farm updates (Batch 32 blasts)*. Needs outbound API + a
  verified sending domain (SPF/DKIM/DMARC) and inbound parse routing.
  See credentials doc.
- **YoLink API** — the farm's **smart thermometers**. Pull
  temperature readings (freezers — ties straight into the cold-chain
  + lots/bins + alerts above; brooders; etc.) and drive alerts when
  a reading crosses a threshold. YoLink Cloud API (UAID + secret →
  token; HTTP/MQTT). See credentials doc.
