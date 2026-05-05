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

---

## Upcoming

The remainder of the plan (originally 22 batches; renumbered to 23
when Batch 6 was inserted to ship the in-app roadmap page).
Sequencing is the proposal — locked in only when the batch starts.

### Batch 7 — Projects subsystem rewrite
Hierarchy Project → Phase → Step → Checklist → Checklist item.
Schema: `projects`, `project_phases`, `project_steps`,
`project_checklists`, `project_checklist_items`, `project_links`,
`project_dependencies` (with `shift_dependents` for proportional
date shuffle). Completeness rule: phases > 1 → milestones drive %;
phases == 1 → steps drive %. Verbatim copy: "x/y steps complete" /
"x/y milestones reached". Trello-style edit modal with markdown,
Supabase Storage uploads, assignees, target dates / ranges.

### Batch 8 — Processes
Process = template tied to an `event_kind`. Event instance lands on
schedule → process expands into project(s) / tasks anchored to the
event date (e.g. "1 week before processing day → check trailer
hitch and tires"). Schema: `processes`, `process_steps` (with
`offset_days` from anchor event), `process_event_kind_links`.

### Batch 9 — Customers + Lists
`customers` CRUD (workshop fields together). `customer_lists`
(title + purpose) and `customer_list_members`.

### Batch 10 — Resources rethink
"Resources" is too vague today. Redesign categorization and
re-home items contextually (brooders inside Animals/Broilers,
suppliers inside Feed/Inventory, etc.) with a fallback search
index. Workshop scope at the start of the batch.

### Batch 11 — Animals & Feed UI overhaul
- Feed page redesigned to match Chores; group by animal (animals
  list pulled from DB); drag-drop orderable within group; cards
  feature amount remaining + next order date prominently, last
  price paid secondary; past-order history view.
- Broilers pages: persistence + UI rethink across all subpages.
- Broiler tracker: per-batch records (weeks on farm, move history,
  feed eaten, feed cost, mortality, cuts ordered) optimized for
  cross-batch comparison.

### Batch 12 — Products + pricing
Products CRUD with photos / descriptions / content (research
Pat's etc. for content patterns first). Group by animal; allow
"uncategorized / not animal-specific". Sales-over-time
visualization. **Pricing UI** — workshop together at start of
batch; reference apps to surface: Shopify admin, Square, Faire,
GoodEggs vendor portal.

### Batch 13 — Inventory backend + Point of Sale
Inventory schema + CRUD; on-hand by SKU/location. POS marks items
sold so inventory decrements correctly. Internal "family sale" flow.

### Batch 14 — Orders
Manual order creation; edit / interact with customer orders;
shipment creation from order (integration scoped here).

### Batch 15 — Commerce integrations
Stripe (cards / online payments); Venmo (where API exists);
QuickBooks (accounting sync). E-comm front-end if needed.

### Batch 16 — Google Calendar integration
OAuth scope add; two-way vs one-way sync — TBD.

### Batch 17 — Farm updates / Social / Content calendar
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

### Batch 18 — App-wide search
Cross-cutting; lands after most data models exist so the index is
comprehensive. Likely Postgres `tsvector` + a client palette
(cmd-K).

### Batch 19 — App-wide bookmarking
Per-user bookmarks of arbitrary entities/pages, surfaced in nav.
Table `user_bookmarks (user_email, target_type, target_id, label,
sort_order)`.

### Batch 20 — iOS / mobile-responsive pass
Audit every page for iPhone widths. PWA manifest + install prompt
for Add to Home Screen. Lands after Tailwind so responsive
utilities are available.

### Batch 21 — Offline tolerance + resync
IndexedDB write queue (idb / Dexie) wrapping the Supabase client;
outbox pattern for mutations; conflict policy per table. Service
worker for asset caching. Affects every data hook.

### Batch 22 — Pasture visualization simulator
Standalone subsystem. Map / canvas with land outline; draw + name
pasture boundaries; tractor pins (dims + capacity drive math);
assign batch → tractor count needed; hypothetical-batch sandbox;
fence-area calculator; tractor-move cadence tuning; timeline
scrubber (manual + autoplay) with hover read-out ("X days since
occupied / available in Y"); commit a movement plan → scheduled
chore moves; per-plan distance/location breakdown. Likely libs:
Leaflet or MapLibre + a geometry layer.

### Batch 23 — Voice / natural-language control
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

Motivation: James has noticed his dad keeps scrawling the same
note ("batch 2 — week 4") on the office whiteboard, so this stat
clearly belongs front-and-center on the dashboard.

Open question: does each batch already carry a `start_date` and a
target weeks-to-process value, or do we need to add one? Most
natural pairing is alongside Batch 11 (broiler tracker work) since
the underlying batch model gets fleshed out there — but if the
data is already present, this could ship sooner as a small batch
on its own.

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
