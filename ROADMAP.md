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
items the roadmap was tracking piecemeal). Sequencing is the
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
  Processes batch (now Batch 19) since it has nothing to render
  until then.

### Batch 11.3 — Web push notifications
Web push (PWA + service worker — may need to pull forward from
the iOS / mobile-responsive work, now Batch 32) on transition
to `done`, with on-time and overran payload variants. Closes
the Chores overhaul umbrella except for assignments.

### Batch 12 — Chore assignment rules engine
Default assignments for chores, expressed as a small day-of-week
DSL. Two scopes: chore-level ("on Mondays and Fridays James
washes and packs eggs; on Tuesdays and Thursdays Jim washes and
packs eggs; on Wednesday/Saturday/Sunday both") and block-level
("on Mondays and Tuesdays James is assigned to morning chores;
Wed–Sun Jim takes them"). Block-level rules seed defaults for
chores in that block; chore-level rules override.

Per-instance assignment changes (the assignment UI James
already uses on the All chores tab) only touch that instance —
they never edit the rule. Schema sketch:
`chore_assignment_rules(id, scope, scope_id, days_of_week,
assignees[], priority)` plus a resolver that runs at instance
materialization. UI: a rules editor on each chore's expanded
panel and on each block's edit form, with a "what does this
look like for the next 7 days?" preview.

Ships value: the assignment grid we keep recreating in our
heads becomes data the dashboard owns. High-priority insert
between Performance and the Events overhaul, ahead of the
original sequencing.

### Events + Schedule overhaul (Batches 13–16)

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

### Batch 13 — Events foundation (schema + RRULE + EventEditor)
New tables: `event_series`, `event_occurrences`, `event_links`,
`automations`, `gcal_pushes`. Migrate `event_instances` to the
new shape (recurring rows materialize zero occurrences; single-
dated rows get one pre-materialized row). Replace `recurrence.js`
with an `rrule.js` wrapper. New `timeline_items` query view that
unions `event_occurrences` + `chore_runs` with a `kind`
discriminator. EventEditor side panel (desktop) / sheet (mobile)
with full CRUD, two-tier recurrence editor (Apple Calendar's
macOS dialog pattern), and the universal three-button "This event
/ This and following / All events" prompt. Lazy materialization
with three triggers (first override, GCal push, drag-to-
reschedule).

Ships value: event CRUD finally exists; complex recurrence
("first and third Sunday May 14 → Sept 21 every year") works.

### Batch 14 — Calendar UI rework
Schedule page gets the Day / Week / Month / Agenda toggle.
Clickable date header with typer popover (Notion Calendar
pattern). Time-of-day rail on Day + Week views uses the banded-
background approach (option C): chore-block windows render as
faint amber bands behind the grid; events sit on top. Conflict
surfaces visually as event-on-band, with a small amber dot for
emphasis. Drag-to-reschedule writes overrides; drag-to-resize on
Day view. AllEvents.jsx folds into Agenda view (route deep-links
preserved). Per-kind flyout pages demote to saved filter chips on
Schedule (the two flyouts in `sections.jsx` collapse to one
"Event types" entry). Standalone Timeline view dies. Processing-
day kind page survives separately as a batch-close workspace at
`/events/processing/:id` (cut sheet upload, packed-crates
counter, final-count entry, batch resolution); reachable from
the EventEditor's "Open processing details →" link.

Ships value: the calendar you actually use day-to-day.

### Batch 15 — Triggers + GCal push
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

### Batch 16 — Animal lifecycle pages
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

### Batch 17 — Inbox / "just a thought…" capture
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

### Batch 18 — Projects subsystem rewrite
Hierarchy Project → Phase → Step → Checklist → Checklist item.
Schema: `projects`, `project_phases`, `project_steps`,
`project_checklists`, `project_checklist_items`, `project_links`,
`project_dependencies` (with `shift_dependents` for proportional
date shuffle). Completeness rule: phases > 1 → milestones drive %;
phases == 1 → steps drive %. Verbatim copy: "x/y steps complete" /
"x/y milestones reached". Trello-style edit modal with markdown,
Supabase Storage uploads, assignees, target dates / ranges.

### Batch 19 — Processes
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

### Batch 20 — Customers + Lists
`customers` CRUD (workshop fields together). `customer_lists`
(title + purpose) and `customer_list_members`.

### Batch 21 — Resources rethink
"Resources" is too vague today. Redesign categorization and
re-home items contextually (brooders inside Animals/Broilers,
suppliers inside Feed/Inventory, etc.) with a fallback search
index. Workshop scope at the start of the batch.

### Batch 22 — Animals & Feed UI overhaul
- Feed page redesigned as a group-cards layout: group by animal
  (animals list pulled from DB); drag-drop orderable within group;
  cards lead with amount remaining + next order date, last price
  paid secondary; past-order history view. (Originally specced as
  "match the Chores page" — that comparison no longer holds after
  the chores overhaul, so the pattern is described directly here.)
- Broilers pages: persistence + UI rethink across all subpages.
- Broiler tracker carved out into Batch 23 (Metrics & analytics);
  this batch handles the page-shell + persistence work, the
  metric definitions and cross-batch comparison view ship there.

### Batch 23 — Metrics & analytics
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

### Batch 24 — Products + pricing
Products CRUD with photos / descriptions / content (research
Pat's etc. for content patterns first). Group by animal; allow
"uncategorized / not animal-specific". Sales-over-time
visualization. **Pricing UI** — workshop together at start of
batch; reference apps to surface: Shopify admin, Square, Faire,
GoodEggs vendor portal.

### Batch 25 — Inventory backend + Point of Sale
Inventory schema + CRUD; on-hand by SKU/location. POS marks items
sold so inventory decrements correctly. Internal "family sale" flow.

### Batch 26 — Orders
Manual order creation; edit / interact with customer orders;
shipment creation from order (integration scoped here).

### Batch 27 — Commerce integrations
Stripe (cards / online payments); Venmo (where API exists);
QuickBooks (accounting sync). E-comm front-end if needed.

### Batch 28 — Two-way Google Calendar sync (deferred)
Push-only sync ships in Batch 15. This batch is reserved for the
two-way case if it ever becomes a real need — e.g., editing on
the phone calendar app and having those edits flow back to the
dashboard. James's stated stance: "If that use case crops up
down the road we can revisit it." Until then, this is a
placeholder so the slot doesn't get reused for something else
and so the design constraints (idempotent change ledger,
per-field merge rules, conflict resolver UI) are remembered if
it ever lands.

### Batch 29 — Farm updates / Social / Content calendar
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

### Batch 30 — App-wide search
Cross-cutting; lands after most data models exist so the index is
comprehensive. Likely Postgres `tsvector` + a client palette
(cmd-K).

### Batch 31 — App-wide bookmarking
Per-user bookmarks of arbitrary entities/pages, surfaced in nav.
Table `user_bookmarks (user_email, target_type, target_id, label,
sort_order)`.

### Batch 32 — iOS / mobile-responsive pass
Audit every page for iPhone widths. PWA manifest + install prompt
for Add to Home Screen. Lands after Tailwind so responsive
utilities are available.

### Batch 33 — Offline tolerance + resync
IndexedDB write queue (idb / Dexie) wrapping the Supabase client;
outbox pattern for mutations; conflict policy per table. Service
worker for asset caching. Affects every data hook.

### Batch 34 — Pasture visualization simulator
Standalone subsystem. Map / canvas with land outline; draw + name
pasture boundaries; tractor pins (dims + capacity drive math);
assign batch → tractor count needed; hypothetical-batch sandbox;
fence-area calculator; tractor-move cadence tuning; timeline
scrubber (manual + autoplay) with hover read-out ("X days since
occupied / available in Y"); commit a movement plan → scheduled
chore moves; per-plan distance/location breakdown. Likely libs:
Leaflet or MapLibre + a geometry layer.

### Batch 35 — Voice / natural-language control
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
home is the new Metrics & analytics batch (Batch 23), which owns
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
