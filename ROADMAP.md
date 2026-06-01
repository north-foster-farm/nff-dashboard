# NFF Dashboard — Roadmap

Living record of the multi-batch improvement plan: how it came to be,
what has shipped, and what is still upcoming. Updated as part of every
batch (final step of the per-batch checklist).

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

---

## Upcoming

The remainder of the plan (originally 22 batches; renumbered to 23
when Batch 6 was inserted to ship the in-app roadmap page; renumbered
to 27 when the Chores overhaul was inserted as Batches 7–10
on 2026-05-06; renumbered to 31 when the Events + Schedule overhaul
was inserted as Batches 11–14, also 2026-05-06; renumbered to 35
on 2026-05-07 after the roadmap-updates revision — a new Batch 10
absorbs the Rounds polish + block-model + `chore_groups` removal
carved out of 8.x, a new Batch 12 ships the chore assignment rules
engine immediately after Performance, a new Batch 17 ships the
Inbox "just a thought…" capture surface post-Events overhaul, and
a new Batch 23 — Metrics & analytics — supersedes the broiler
tracker and folds in any other data-visualization or reporting
items the roadmap was tracking piecemeal); renumbered to 38 on 2026-05-31 when the Farm Map UI overhaul was inserted as Batches 15–18 right after 14.2 — pushing the Events-overhaul tail (Triggers, Animal lifecycle) to 19–20, absorbing the old Resources rethink (Batch 21) into the place-model collapse, re-pointing the old Pasture simulator (Batch 34) into the Rotation planner (Batch 37), and pulling a field slice of Offline (old 33), App-wide search (old 30), and the mobile pass (old 32) forward into the farm-map MVP. Sequencing is the
proposal — locked in only when the batch starts.

### Chores overhaul (Batches 7–12)

Why these jump the queue: chores + scheduling are the primary
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
  chores; the table ships in Batch 7 so it's ready for Processes
  to populate, but the modifier-conflict UI ships with the
  Processes batch (now Batch 23) since it has nothing to render
  until then.

### Events + Schedule overhaul (Batches 13–16; tail now 19–20)

*Sequencing note (2026-05-31): the Farm Map overhaul was inserted as Batches 15–18 right after 14.2, so this overhaul's two still-upcoming batches — Triggers + GCal push and Animal lifecycle pages — now land as Batches 19–20.*

Why these jump ahead of Projects: events + schedule are the other
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

### Farm Map UI overhaul (Batches 15–18)

Why these jump the queue: navigation and the place model are the
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

### Batch 15 — Farm map: place-model foundation ✅ SHIPPED
Shipped `v0.10.10-alpha` (2026-05-31) — see the Shipped section above.

### Batch 16 — Farm map: per-place completion + offline outbox
The rollout's beating heart — Dad working in the field, offline. Re-key
`chore_completions` to `(chore_id, place_id, date)` and **fan site-scoped
chores into per-place obligations** (so "tractor 3 fed, 4 not" is
representable, and the map can show "3 of 5 fed"). Build a device-local
**append-only IndexedDB outbox**; replace today's silent-revert toggle
(`useChoreCompletions.toggle` reverts on network error — a tick behind the
broiler pasture silently un-ticks) with optimistic local apply + a visible
**"queued / not synced"** indicator + guaranteed sync. Conflict policy:
completions are **idempotent** row-presence inserts; **counts (mortality)
merge ADDITIVELY** (two offline phones each logging "1 dead" sum to 2 —
non-negotiable); field **edits are clocked last-write-wins** with the
append-only `activity_log` as audit. No full CRDT (shape it to grow).
(May split 16.1 grain / 16.2 outbox when the batch starts.)

Ships value: capture works with no signal and never silently loses data;
per-place completion lights up the rest of the design.

### Batch 17 — Farm map: Now surface + hardened Rounds
The phone rollout. **Now** is the phone landing (decision 1): the
active-or-next round as a fat primary button (`nextBlock` logic), then a
farm-wide **due/overdue** list (`ChoreRemainingPill` logic), each row
tagged with its place (**D1** bold parent) and deep-linking into the round
or place; overdue sorts to the top. **D2** loud "round in progress — tap
to resume" bar sits on Now (replacing the orphaned "rejoin from the
sidebar" path — verified `Rounds.jsx:531`). The shipped **Rounds**
takeover is promoted to the primary phone path; its Site Switcher gains a
**group-by-zone OR group-by-kind** toggle (decision 4; geography default,
Dad moves by place); mid-round capture pre-seeds and **prominently
displays** the resolved place before save (**D1**). A derived
**`place_status`** projection feeds the Now sort/flags (and the map tint
in Batch 18).

Ships value: Dad opens the app and his work is handed to him — nothing
silently lost, no menu-hunting.

### Batch 18 — Farm map: map renderer + place pages + nav restructure
The desktop landing (decision 2) and the IA overhaul that started the
project. Render the authored, geographically-accurate `farm-map_v1.svg`
(commit it to `public/`) at the **zone** level, each zone **tinted by
`place_status`**; click a zone → zoom → **structure pins** (auto-laid-out
slots — v1 art has no structure geometry) → a **place page** (current
occupant/batch detail, chores due here, recent observations, "view on
timeline"). **Express lanes:** a thin **place search** over
`code`/`name`/occupant, **D1-disambiguated** ("Mobile Coop 1 ·
**Pasture B**" vs "· **Pasture C**"); recents; push deep-links into the
active run. **Nav restructure:** the sidebar's flat `SECTIONS` list is
replaced as primary nav by **Now · Map/Places · Schedule · Do rounds**,
with the genuinely non-spatial/non-temporal records (Products, Orders,
CRM, Comms, etc.) moved to a thin **admin/records drawer** off the header
avatar; the **Resources flyout dissolves** (place-types → the tree;
asset-types → typed occupants; suppliers → the drawer). On phone the map
is a secondary read-only view, never on the capture path.

Ships value: fly over the farm with status at a glance and drill to
anything; the arbitrary sidebar is gone.

### Batch 19 — Triggers + GCal push
`automations` table seeded with two rules. (1) Feed reorder
fires when `inventory.on_hand <= reorder_point`; emits a "Place
feed order" chore + a "Receive feed delivery" event linked via
`event_links`. (2) Broiler batch lifecycle fires on
`batch_created`; emits the arrival event + the pasture-move
event (~3 weeks later, configurable per breed) + the processing
event (kind=processing_days, ~8–10 weeks for Cornish Cross,
configurable) + the brooder cleanout chore (day after pasture
move). Processing dates are static-by-default (set with the
hatchery before deposit) but editable as a fallback. Auto-row
visual treatment: sparkle icon, dismissable with reason logged,
"Heads up" lane on the dashboard. GCal push-only sync: a
Postgres function or edge job watches `event_occurrences` for
dirty rows and emits create/update/cancel calls; per-occurrence
event IDs preserved across updates; logs to `gcal_pushes`.

Ships value: automation closes the loop on
inventory + livestock + chores; phone calendar shows farm
events.

### Batch 20 — Animal lifecycle pages
Batch detail page (broiler batches first; layers + sheep follow
the same shape). Lifespan timeline strip across the page —
arrival → pasture move → milestones → processing → cleanout —
reading from `event_links` polymorphic rows. Reciprocal "click
arrival/processing date pill → opens EventEditor" wiring from
the batch detail card. Inverts the batch ↔ processing-day
relationship: the batch owns its dates, the events are derived.
Deleting a batch tombstones the linked events with a confirm
dialog. Implements the batch-assign UI properly (the stub at the
old `EventKindPage.jsx:65` becomes a real picker on the
processing-day workspace, populated from `site_residents`).

Ships value: the day James clicks "Broiler batch 2" and sees its
arrival, pasture-move, processing, and cleanout in one timeline
strip — and can edit any of them in place.

### Batch 21 — Inbox / "just a thought…" capture
Lightweight capture surface for ideas that aren't yet projects
or chores. A top-bar capture button drops a quick text input for
on-the-fly thought-dumping. New items show up in the dashboard
notifications widget (no push — these are quiet by design).

A dedicated Inbox page lists every item with creator + creation
time, drag-and-drop ordering, and pinning (pinned items stick
to the top of the list, drag-orderable among themselves). Items
are archivable and surface again on an Archived tab. Per-user
read/unread state with explicit mark-read / mark-unread.

Schema sketch: `inbox_items(id, body, created_by, created_at,
pinned, archived_at, sort_order)` +
`inbox_item_reads(user_email, item_id, read_at)`.

Ships value: a place for every "just a thought…" that doesn't
need to bottleneck through Projects or Chores. Slotted post-
Events overhaul so a captured thought can later be promoted to
a calendar event without a separate plumbing pass.

### Batch 22 — Projects subsystem rewrite
Hierarchy Project → Phase → Step → Checklist → Checklist item.
Schema: `projects`, `project_phases`, `project_steps`,
`project_checklists`, `project_checklist_items`, `project_links`,
`project_dependencies` (with `shift_dependents` for proportional
date shuffle). Completeness rule: phases > 1 → milestones drive %;
phases == 1 → steps drive %. Verbatim copy: "x/y steps complete" /
"x/y milestones reached". Trello-style edit modal with markdown,
Supabase Storage uploads, assignees, target dates / ranges.

### Batch 23 — Processes
Process = template tied to an `event_kind`. Event instance lands on
schedule → process expands into project(s) / tasks anchored to the
event date (e.g. "1 week before processing day → check trailer
hitch and tires"). Schema: `processes`, `process_steps` (with
`offset_days` from anchor event), `process_event_kind_links`.

**Modifier UI ships with this batch** (deferred from the chores
overhaul). When a process step targets a chore on a date, it
writes a `chore_modifiers` row (table created in Batch 7) — and
also writes corresponding `event_links` rows so the modifier
shows up on the event-side timeline too. Stacked-badge UI in
Rounds + Today tab + Schedule-at-a-glance:
winner solid, loser ghosted, tap-to-explain shows winner + loser
+ source. v1 conflict resolution is priority-based and
deterministic; no manual-resolver modal.

### Batch 24 — Customers + Lists
`customers` CRUD (workshop fields together). `customer_lists`
(title + purpose) and `customer_list_members`.

### Batch 25 — Animals & Feed UI overhaul
- Feed page redesigned as a group-cards layout: group by animal
  (animals list pulled from DB); drag-drop orderable within group;
  cards lead with amount remaining + next order date, last price
  paid secondary; past-order history view. (Originally specced as
  "match the Chores page" — that comparison no longer holds after
  the chores overhaul, so the pattern is described directly here.)
- Broilers pages: persistence + UI rethink across all subpages.
- Broiler tracker carved out into Batch 26 (Metrics & analytics);
  this batch handles the page-shell + persistence work, the
  metric definitions and cross-batch comparison view ship there.

### Batch 26 — Metrics & analytics
New first-class subsystem that owns metric definitions, their
underlying data plumbing, and every cross-cutting visualization
or reporting surface in the app. **Supersedes the broiler
tracker** (formerly bundled into the Animals & Feed batch) and
folds in any other data-visualization or reporting items the
roadmap was tracking piecemeal — animal-page reports, feed
analytics, sales charts, mortality trend, dashboard metric
cards. One subsystem, one registry, one front-end API.

Two seeded metric families to start, both grounded in the
agricultural reality:

- **Broiler batches (Cornish Cross).** Feed Conversion Ratio
  (lbs feed ÷ lbs liveweight gain; pasture-raised target
  2.2–3.0; commercial 1.7–1.9). Average Daily Gain via
  random 10–20 bird sample weekly on a hanging or platform
  scale. Uniformity = coefficient of variation across the
  sample weights (under 8% = tight). Per-batch record sheet
  (weeks on farm, move history, feed eaten, feed cost,
  mortality, cuts ordered) optimized for cross-batch
  comparison.
- **Layer flocks (Red Sex-Link).** Hen-housed production —
  cumulative eggs ÷ original hens placed; target ~280–320 in
  the first laying year. Feed per dozen and feed per pound of
  egg mass (egg mass = avg egg weight × egg count; the better
  denominator for older flocks laying bigger eggs). Body weight
  trend with condition flags — birds dropping weight while
  laying are burning reserves and will crash; birds gaining fat
  drop production and risk fatty liver.

Architecture: a `metrics` registry table where each row defines
a metric (id, name, formula description, units, applies-to
entity), backed by per-metric materialized views or query
helpers depending on data shape. Front-end consumes a single
metrics API; entity pages (broiler batch detail, layer flock
detail, feed page, dashboard) embed metric cards that pull from
it. The "broiler weeks remaining" dashboard widget ships out of
this subsystem too.

Out of scope for v1: predictive models, anomaly detection,
custom user-defined metrics. Just the registry, the seeded
metrics, the tracker views, and the cross-batch comparison
surface.

Ships value: the dashboard finally answers "how are we doing?"
with numbers, not vibes. Closes the data-visualization /
reporting umbrella in one place.

### Batch 27 — Products + pricing
Products CRUD with photos / descriptions / content (research
Pat's etc. for content patterns first). Group by animal; allow
"uncategorized / not animal-specific". Sales-over-time
visualization. **Pricing UI** — workshop together at start of
batch; reference apps to surface: Shopify admin, Square, Faire,
GoodEggs vendor portal.

### Batch 28 — Inventory backend + Point of Sale
Inventory schema + CRUD; on-hand by SKU/location. POS marks items
sold so inventory decrements correctly. Internal "family sale" flow.

### Batch 29 — Orders
Manual order creation; edit / interact with customer orders;
shipment creation from order (integration scoped here).

### Batch 30 — Commerce integrations
Stripe (cards / online payments); Venmo (where API exists);
QuickBooks (accounting sync). E-comm front-end if needed.

### Batch 31 — Two-way Google Calendar sync (deferred)
Push-only sync ships in Batch 15. This batch is reserved for the
two-way case if it ever becomes a real need — e.g., editing on
the phone calendar app and having those edits flow back to the
dashboard. James's stated stance: "If that use case crops up
down the road we can revisit it." Until then, this is a
placeholder so the slot doesn't get reused for something else
and so the design constraints (idempotent change ledger,
per-field merge rules, conflict resolver UI) are remembered if
it ever lands.

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
scheduling. Content calendar: calendar UI + auto-add to schedule.

### Batch 33 — App-wide search
Cross-cutting; lands after most data models exist so the index is
comprehensive. Likely Postgres `tsvector` + a client palette
(cmd-K). **Re-scoped by the farm map:** a thin, place-only search with D1 disambiguation already ships in Batch 18 — this batch is the full cross-entity cmd-K palette.

### Batch 34 — App-wide bookmarking
Per-user bookmarks of arbitrary entities/pages, surfaced in nav.
Table `user_bookmarks (user_email, target_type, target_id, label,
sort_order)`.

### Batch 35 — iOS / mobile-responsive pass
Audit every page for iPhone widths. PWA manifest + install prompt
for Add to Home Screen. Lands after Tailwind so responsive
utilities are available. **Re-scoped by the farm map:** the Tier-1 field surfaces (Now, Rounds, capture) are built mobile-first in Batches 16–17 — this batch is the broad audit of every *other* page.

### Batch 36 — Offline tolerance + resync
IndexedDB write queue (idb / Dexie) wrapping the Supabase client;
outbox pattern for mutations; conflict policy per table. Service
worker for asset caching. Affects every data hook. **Re-scoped by the farm map:** the field write-path outbox (completions, observations, additive-merge mortality) ships in Batch 16 — this batch generalizes the outbox to every remaining hook and adds the service-worker asset cache.

### Batch 37 — Rotation planner (formerly Pasture visualization simulator)
**Re-pointed by the farm map:** a sibling on the **shared place-geometry substrate** — it draws real structure/paddock geometry and *sets* tractor positions over time, while the nav map only *shows* current schematic pins. A rotation plan is a sequence of future `placements` rows on the same place tree (no longer a standalone map). Otherwise as specced below:
Standalone subsystem. Map / canvas with land outline; draw + name
pasture boundaries; tractor pins (dims + capacity drive math);
assign batch → tractor count needed; hypothetical-batch sandbox;
fence-area calculator; tractor-move cadence tuning; timeline
scrubber (manual + autoplay) with hover read-out ("X days since
occupied / available in Y"); commit a movement plan → scheduled
chore moves; per-plan distance/location breakdown. Likely libs:
Leaflet or MapLibre + a geometry layer.

### Batch 38 — Voice / natural-language control
Speech-to-text on device; intent → tool-call mapping via Claude;
confirmation step for state-changing actions. High-priority once
foundational batches land.

---

## Recently added — sequencing TBD

These came up after the original 22-batch plan was set. Slot in
once the user picks where they belong.

### Broiler-batch "weeks remaining" dashboard widget
Added 2026-05-05. Same card style as the other dashboard widgets;
lists each active broiler batch in the format:

> batch n | week x | y week(s) remaining

Motivation: this is a stat James's dad already keeps tabs on
day-to-day, so making it instantly visible on the dashboard saves
him doing the math from scratch.

Open question: does each batch already carry a `start_date` and a
target weeks-to-process value, or do we need to add one? Natural
home is the new Metrics & analytics batch (Batch 26), which owns
broiler-batch metric definitions and cross-batch comparison —
the widget is just a dashboard surface over the same underlying
metric. If the data is already present, this could ship sooner
as a small one-off batch on its own.

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
