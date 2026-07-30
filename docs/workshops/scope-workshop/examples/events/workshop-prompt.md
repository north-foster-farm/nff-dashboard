Events + Schedule overhaul workshop — 2026-05-06
Same four-lens pattern as the 2026-05-06 chores workshop.

================================================================
JAMES'S VERBATIM REQUIREMENTS DUMP
================================================================

- the point of the google calendar sync is to get farm events into
  the calendar app on my phone. push only is fine for now. I worry
  that being able to edit events outside of the context of the
  dashboard opens us up to weird conflicts or side effects. If that
  use case crops up down the road we can revisit it
- the calendar view in the app is worth it because it gives us what
  I just said we won't have in google calendar — the ability to
  manage events in a calendar-like UI and click on them to edit
  them and the ability to drag them around and so forth.
- the calendar view needs enhancement: the date at the top of the
  calendar must be clickable so I can type the month/year I want
  to seek to. I also need to be able to see the calendar by week
  and by day
- animal groups (need a better name for that I think) all have a
  date on which they arrive at the farm. many animal groups have a
  date on which they leave the farm for processing or culling.
  these dates are tied to the animal groups — when I click on
  broiler batch 2, I should be able to see the date of arrival and
  the processing date, and I should be able to click on those to
  see the calendar event and event details
- there are definitely situations where the overlap between events
  and chores needs to be surfaced so we can plan accordingly.
  markets and deliveries in particular.
- the linear timeline view is a great tool for visualizing things,
  but as a standalone view it seems a little underdeveloped. maybe
  there is a more conventional way to incorporate this element?
- recurrence is a hugely important feature, because so much of what
  we do happens on repeated cycles. I think of recurrence as
  something I set manually when I create an event, for example,
  like if we got accepted to a new farmers market — I would
  manually create the event in the UI and set up its recurrence.
  this might need to be fairly complex (happens on the first and
  third sunday of every month from may 14 to september 21 every
  year).
- event CRUD still needs to be implemented
- triggers are something else to consider here. there are a lot of
  conditions that should trigger new events to be created, such as:
  feed has been depleted down to its reorder point -> trigger
  creates a chore to place an order, trigger creates an event to
  receive the delivery
- projects and the ability to visualize project timelines is
  something we haven't dealt with yet because projects isn't
  implemented. however, projects will be one of the most commonly
  dealt with things on the schedule.

================================================================
PROJECT CONTEXT FOR THE AGENTS
================================================================

- React + Vite + Supabase (Postgres + realtime + RLS) + Tailwind
  v4. Mobile is critical (events get checked from a phone
  mid-task).
- Two-person family farm: James + his dad.
- "Tractor" in this codebase always means **chicken tractor**
  (mobile bottomless pen on pasture).
- Repo at /Users/james/Code/nff-dashboard.
- Today the events subsystem is read-only with no CRUD; weekly-
  only recurrence; processing-day batch-assignment is a stub
  alert; per-kind pages exist behind a flyout; AllEvents and
  Schedule duplicate browsing surfaces; timeline view is its own
  thing; chores + events DO interleave on the dashboard but NOT
  on /schedule.

================================================================
SOURCE MATERIAL TO READ (do not bluff)
================================================================

1. src/pages/Schedule.jsx — dual calendar+timeline page
2. src/pages/AllEvents.jsx — chronological list browser
3. src/pages/EventKindPage.jsx — per-kind detail view, stub
   batch-assign for processing days
4. src/components/DetailModal.jsx — read-only event modal
5. src/lib/recurrence.js — weekly-only expansion logic
6. src/lib/data/useReferenceData.js (loadEvents) — data flow
7. supabase/migrations/0005_events_products_inventory.sql —
   schema (event_kinds, event_instances, recurrence JSONB,
   processing-day payload)
8. src/pages/Overview.jsx — where chores + events interleave
   today (lines 253–344)
9. src/sections.jsx — two events flyouts in the sidebar
10. ROADMAP.md — Batch 12 (Processes, hangs off event_kinds),
    Batch 20 (GCal sync), Batch 21 (Content calendar inside
    Farm Updates)
11. ~/.claude/plans/chores-overhaul-v2.md — the recently-finished
    chores plan, including site_residents and the activity_log
    + run_id pattern for run events

================================================================
OUTPUT FORMAT (mandatory)
================================================================

## 1. The model in one paragraph
Plain prose. Data model + interaction model in 5–8 sentences.

## 2. The UI in one page
Calendar view (with the clickable date header / week / day views
James asked for), dashboard rollup, AllEvents disposition, per-
kind pages disposition, timeline view disposition. Mobile vs.
desktop. No code.

## 3. Recurrence
How complex patterns ("first and third Sunday May 14–Sept 21
every year") are stored and edited. RRULE? Custom JSON?
Per-occurrence overrides?

## 4. Triggers + cross-entity links
- Animal groups → arrival event, processing/cull event (linkable
  both directions)
- Reorder-point trigger → creates chore + receive-delivery event
- Project timeline blocks on the schedule
- Conflict surfacing between events and chores (markets,
  deliveries especially)

## 5. What survives, what dies, what morphs
Specifically: AllEvents page, per-kind flyout pages, the
standalone timeline view, processing-day batch-assign stub,
DetailModal.

## 6. Top 3 tradeoffs
1.
2.
3.

## 7. You'd hate this if...
Five bullets — when this approach is the wrong call.

## 8. Naming for "animal groups"
One sentence — a better name. James asked.

DO NOT include code. DO NOT propose batch sequencing — that's
the orchestrator's job. DO read the source files; do not bluff.

================================================================
LENSES (each agent gets one)
================================================================

1. Scope-cutter — "you don't need as much as you think." Argue
   AllEvents is redundant; per-kind pages don't earn their keep;
   timeline-as-standalone is overkill. Defend a smaller surface.

2. UI conventions — every requirement maps to a known pattern
   from a real shipped tool. Real product names. Google Calendar,
   Notion Calendar, Cal.com, Fantastical, Apple Calendar,
   Outlook, Linear cycles, Square Appointments, RRULE/iCalendar.

3. Reframer — change the unit. Seeded candidates:
   (a) Series + Occurrence (with exceptions)
   (b) Calendar Items as a unified type — events, chores,
       projects, processes all on one timeline with a kind
       discriminator
   (c) Drop the month-grid metaphor; everything is a vertical
       timeline.

4. Maximalist — extrapolate every requirement. Triggers as a
   real automation engine. Full RRULE. GCal two-way (later).
   Project Gantt blocks. Customer-facing event pages. RSVP for
   farm visits. Weather-aware. Multi-day. ICS feed.

================================================================
PITCH 1 — SCOPE CUTTER (agentId: ab891e72cd87999c3)
================================================================

## 1. The model in one paragraph

There is one table — `event_instances` — and it is the source of
truth for everything date-bound that isn't a chore or a project.
Each row is either single-dated or carries a recurrence rule
(RRULE string). Instances reference other entities through a
small set of typed foreign keys: `livestock_group_id`,
`project_id`, `chore_id`, plus a generic `payload jsonb` for
kind-specific extras. Per-kind is a tag (`kind_id`) plus a color,
not a sub-table. Occurrences are computed at read time; per-
occurrence overrides live in a sibling `event_overrides` table
keyed by `(instance_id, occurrence_date)`. Triggers write rows
through the same path a human would. Animal-group dates are NOT
stored on the group — the group reads them off whichever
event_instances point to it.

## 2. The UI in one page

One page, `Schedule`, with three view toggles: Month / Week /
Day. The big month label is a button — tap to type "Aug 2027" or
pick from a year strip. Filter chips and "today" jump in the
same control row. Calendar items open an editable detail sheet
(not a read-only modal); same sheet creates new events from a
long-press on an empty cell or "+" in the header.

The dashboard rollup stays exactly as it is in Overview.jsx.
That's the at-a-glance surface; the calendar is the planning
surface. They answer different questions.

AllEvents dies. Per-kind flyout pages die as routes; the seven
children of "Event types" become pre-applied filter chips. The
kind-specific payload moves into the event detail sheet.
Standalone Timeline dies as a top-level toggle; returns as Day
view's body and as project Gantt strips.

Mobile defaults to Day; desktop to Month.

## 3. Recurrence

Store RRULE strings (RFC 5545). James's example becomes
`FREQ=MONTHLY;BYDAY=1SU,3SU;BYMONTH=5,6,7,8,9` with `DTSTART`
and `UNTIL`. Switch to rrule.js (~30KB gz). Per-occurrence
overrides go in `event_overrides`. "Edit this and following"
rewrites the master's UNTIL and creates a new instance — same
trick Google Calendar uses.

## 4. Triggers + cross-entity links

`event_instances.livestock_group_id`. Click "arrival: 2026-04-12"
on Broiler Batch 2 → land on the event detail sheet. This kills
the EventKindPage.jsx:65 "+ Assign batch" stub by inverting the
relationship — the processing event is created from the batch.

Reorder-point trigger: a Postgres trigger writes a chore + an
event, both with `triggered_by jsonb`. Project milestones are
event_instances with project_id and kind=project_milestone.
Conflict warning is a lint at render time, runs against
`resources_required` not just time ranges.

## 5. What survives, what dies, what morphs

- AllEvents.jsx — DELETE.
- Per-kind flyout pages — DELETE routes, KEEP labels as filters.
- Standalone Timeline — MORPH (Day view body + project Gantt).
- Processing-day batch-assign stub — DELETE the stub; INVERT
  the model.
- DetailModal — MORPH editable.
- recurrence.js — replaced by rrule.js.

## 6. Top 3 tradeoffs

1. RRULE means rrule.js (~30KB).
2. Killing AllEvents and per-kind pages will feel destabilizing
   for two days.
3. Inverting batch ↔ processing-day means processing dates can't
   exist without a batch.

## 7. You'd hate this if...

- AllEvents was your taxes report.
- Per-kind URLs were shareable bookmarks.
- RRULE strings unreadable in psql.
- You wanted "thinking about it" placeholder events.
- You wanted pure chronological flow without month-grid (Day view
  is close but not the same).

## 8. Naming

**Batches** — broiler batch, layer batch, sheep batch.

================================================================
PITCH 2 — UI CONVENTIONS (agentId: ac133725a4073dbc8)
================================================================

## 1. The model in one paragraph

Single `events` table; recurrence as RRULE. Sibling
`event_exceptions` table for per-occurrence overrides. Cross-
entity links via polymorphic `event_links` (event_id, target_type,
target_id, role). Triggers are server-side Postgres functions
that insert event + chore pairs marked `source: 'auto'`.
Push-only Google Calendar = per-user ICS feed URL (Cal.com
pattern) plus a write-through job for created/updated/cancelled.
Single entry point: every clickable date in the app opens the
same event editor.

## 2. The UI in one page

Schedule keeps the grid; gains the standard four-up switcher
seen in Google Calendar / Notion Calendar / Fantastical:
**Day / Week / Month / Agenda** (Agenda replaces standalone
Timeline). Month/year header → clickable button that opens a
"jump to" popover (typeable: "Sep 2027"). Drag-to-reschedule on
Week/Day; drag-to-resize on Day. Side panel (Notion Calendar)
on desktop, full-sheet (Fantastical) on mobile.

Dashboard rollup keeps the day's interleaved chores+events; adds
a "next 7 days" mini-agenda above (Sunsama). Conflicts get a
small amber dot — Outlook's indicator.

AllEvents dies → folds into Agenda view. Per-kind pages → saved
filters on the calendar. Processing-day batch-assign becomes a
real picker inside the event editor.

Mobile uses iOS Calendar pattern: Day view by default with week
strip on top, swipe between days.

## 3. Recurrence

RFC 5545 RRULE on the event row. James's example:
DTSTART;TZID=America/New_York:20260514T080000
RRULE:FREQ=MONTHLY;BYDAY=1SU,3SU;UNTIL=20260921T235959Z
RDATE for ad-hoc; EXDATE for skips; event_exceptions for moved/
retitled.

Two-tier editor (Google Calendar pattern): dropdown
(Daily/Weekly/Monthly/Yearly/Custom) → Custom modal modeled on
Apple Calendar's macOS recurrence editor. Three-button "This /
This and following / All events" when editing one occurrence.

## 4. Triggers + cross-entity links

Animal groups carry arrival_event_id and processing_event_id;
event has back-link via event_links. Reorder-point trigger:
Supabase Postgres function fires when on_hand <= reorder_point;
inserts chore + event, both `source: 'auto'` with bot/sparkle
icon — visually distinguished, dismissable. Projects = horizontal
Gantt bars inside Week and Month views (Notion Calendar pattern,
Linear cycles). Conflict surfacing = Outlook amber dot; not
hard-blocking.

## 5. What survives, what dies, what morphs

- AllEvents.jsx — dies, folds into Agenda.
- Per-kind flyout pages — morph into saved filters; processing
  payload moves into editor.
- Standalone Timeline — dies; reborn as Agenda + project bars.
- Processing batch-assign stub — morphs into real picker.
- DetailModal — dies as read-only; replaced by EventEditor side
  panel/sheet with full CRUD + recurrence editor + delete prompts.
- recurrence.js — dies, replaced by rrule.js.

## 6. Top 3 tradeoffs

1. RRULE everywhere vs. simple weekly: RRULE wins, costs ~30KB.
2. One unified editor vs. specialized per kind: unified, with
   collapsible "Details" accordion for processing-day payload.
3. Folding AllEvents into Agenda loses the year-out range slider;
   mitigation: Agenda gets the same range picker.

## 7. You'd hate this if...

- You wanted GCal two-way someday — one-way ICS now means no
  GCal event IDs to reconcile against later.
- You wanted natural-language recurrence ("first and third
  sunday from may to september") instead of a modal builder.
- You expected project bars to be a separate Gantt page with
  dependencies and critical paths.
- You like AllEvents as a printable list.
- You wanted auto rows to appear silently (they don't).

## 8. Naming

**Batch** — already in code (processing.batchId), used in
poultry literature, covers all species.

================================================================
PITCH 3 — REFRAMER (agentId: a963a759aaf33761d)
================================================================

## 1. The model in one paragraph

Reframe: Series and Occurrences. Today's `event_instances` is
doing both jobs in one row using nullable columns; that's why
per-occurrence edits have no place to live. **Split**:
`event_series` (label, kind, location, recurrence rule, status,
season window) and `event_occurrences` (series_id, date,
start/end, location_override, status: scheduled/skipped/done,
notes_override, gcal_event_id). One-off events = a series with
rule=null and one occurrence. Editing "this Saturday's address"
creates an occurrence override; series untouched. "Edit this and
future" splits: end old series day before, start new series.
RRULE because GCal speaks it.

## 2. The UI in one page

Schedule. Three view modes: Month / Week / Day, plus Agenda
(replaces Timeline). Month default desktop; Day default mobile.
Clickable month/year header, typeable. Filter chips; "show
conflicts" toggle.

Dashboard rollup unchanged; reads from new event_occurrences
query (cheaper: date-range index hit).

AllEvents folds into Agenda. Per-kind flyouts demoted to saved
filters EXCEPT processing days, which becomes a *Processing day
workspace* (batch-close workflow — cut sheet, crates packed —
not really calendar UI).

Standalone Timeline dies as toggle. Linear time goes to Projects
(Gantt swim lanes) and animal-group detail (lifespan strip).

Mobile: Day = home screen of Schedule. Tap header to jump. Swipe
between days. Long-press for skip/edit. Month view one tap away.

## 3. Recurrence

Single `rrule` text column on series (RFC 5545). rrule.js for
expansion. Skip Sunday = event_occurrences row with status=
'skipped'. Edit just this one = override row. Edit this and
following = transaction: set old series until=(this_date-1),
insert new series starting this_date. Pre-existing overrides
past split move to new series. Same as Google Calendar.

## 4. Triggers and cross-entity links

**Every dated row registers an occurrence** against a synthetic
series. Animal groups: arrival_date and processing_date aren't
fields on the batch; they're occurrence rows linked back via
`source_kind='animal_group', source_id=...`. Click date on batch
detail → opens DetailModal. Edit from either side.

Reorder trigger: writes (a) chore_run for "place order" and
(b) one-off occurrence on event_series of kind=delivery.

Projects: phases = series with date range, no recurrence (just
DTSTART/DTEND). Render as horizontal bars in project Gantt and
as event-like blocks on calendar (filterable kind=project_phase).

**chore_runs absorbed via a query view, not merged tables.**
chore_runs and event_occurrences are structurally identical
(materialized instance of recurring rule, date, status). Don't
merge — but expose `timeline_items` view that unions them. UI
consumes the view.

## 5. What survives, what dies, what morphs

- AllEvents — morphs to Agenda.
- Per-kind flyout pages — morph to saved filters; processing
  days survives separately as a workspace.
- Standalone Timeline — dies. Energy → Projects Gantt + animal-
  group lifespan strips.
- Processing-day batch-assign stub — survives, gets implemented.
- DetailModal — survives, grows up. Universal occurrence
  inspector with override controls + source-link back-trail.
- recurrence.js — dies, replaced by rrule.js.
- event_instances table — splits into event_series +
  event_occurrences.
- chore_runs (from chores plan) — survives unchanged but exposed
  via timeline_items view.

## 6. Top 3 tradeoffs

1. Two tables instead of one. Every read needs the override
   join. Wins: first-class exceptions, GCal-compatible, drag has
   somewhere to write.
2. Lazy materialization is fiddly (computed vs. stored).
3. Migration: every existing query against event_instances
   rewrites. ~3 call sites, bounded.

## 7. You'd hate this if...

- SQL-by-hand: series/occurrences split is gnarly until view.
- Schedule owning AllEvents: one more view-mode to manage.
- Per-kind pages were landing pages.
- rrule.js feels like overkill (~30KB for 68 lines today).
- Triggers as imperative scripts vs. declarative occurrence
  inserts.

## 8. Naming

**Cohorts** — short, accurate (a group born/raised together),
livestock vocabulary, doesn't collide with "batch" (reserve for
processing).

================================================================
PITCH 4 — MAXIMALIST (agentId: a2793ed03e5655454)
================================================================

## 1. The model in one paragraph

Three core tables + automation surface. **`event_series`** holds
the rule (RRULE, season window, holiday-calendar reference,
optional `entity_ref`). **`event_occurrences`** materialized
~18 months ahead. **`automations`** is its own table: trigger
expression, condition filter, action list. Plus `gcal_pushes`
log. Drag-to-reschedule writes override rows, not series
mutations. Conflicts (event vs. chore window, weather, double-
book) surface as yellow underline + hover explanation.

## 2. The UI in one page

Schedule = the spine. Clickable month/year header opens typer.
**Day / Week / Month / Agenda** toggle. **Week and Day views
render time-of-day rails so chores-with-times AND events sit on
the same grid** — surfaces overlap visually. Drag any block to
reschedule. Weather chips on day strip (low temp, precip %).
Conflicts: amber dot with tap-to-explain ("Market starts 8 AM,
evening chores cluster ends 7:55 — 22 min drive to Foster, leave
7:38").

Dashboard rollup gains a "Heads up" lane for trigger output
("Layer feed hit reorder; chore + delivery event drafted —
review").

AllEvents → Agenda (saved-search/list view of same data).
Per-kind pages → kind *configuration* pages (defaults, GCal
target, trigger hooks) — NOT instance lists. Two flyouts collapse
to one "Event types" entry. Standalone Timeline dies; reborn as
Agenda + entity-page strips.

Mobile: Day view default, swipeable date header.

## 3. Recurrence

RRULE + season_start/season_end as MM-DD pairs (recur annually) +
optional holiday_calendar_id (US-federal, RI-state, custom).
Materialization expands rule against season window, subtracts
holidays per calendar's policy (skip / move_to_following_day /
keep). Three-button prompt for edits. "Edit this and following"
splits the series.

## 4. Triggers + cross-entity links

Animal groups get `entity_ref` on event_series. Broiler batch
with arrival 2026-06-01 + processing 2026-08-12 spawns two
events with entity_ref=batch:broiler-2. Batch detail page
renders own timeline rail (arrival → 4-week weighing →
processing). Delete batch → events tombstoned with confirm.

Reorder trigger: automations engine evaluates on inventory
write; action sequence creates chore + event linked by
automation_run_id. Cancelling the chore cancels the event draft.

Projects: phases with start/end + dependencies. Each phase
materializes as a `phase`-kind event with a span; renders as
horizontal Gantt block in Week view. Drag trailing edge →
dependent phases auto-shift via override mechanism. "5 cascading
changes — review" toast before commit.

Conflict detection = derived view, not stored. Three sources:
chore time-windows overlapping event times, two events on same
person at same hour, weather at lat/lon at event time. Inline
in cells + dashboard Heads-up lane.

**Automations admin page** (new): rule list, last-fired log,
dry-run preview, enable/disable. No visual rule builder in
tier-1 — rules seeded in code, configured via small form.

## 5. What survives, what dies, what morphs

- AllEvents — morphs to Agenda. Route survives as deep-link.
- Per-kind flyouts — morph to kind configuration pages; lists go
  to Schedule's filtered view. Two flyouts → one entry.
- Standalone Timeline — dies as toggle. Reincarnates as Agenda +
  entity-page strips.
- Processing-day batch-assign stub — morphs to real picker that
  writes entity_ref both directions.
- DetailModal — dies in current form. Replaced by Event Editor
  sheet (full CRUD, recurrence editor, conflict warnings, GCal
  toggle, automation provenance).
- recurrence.js — dies, replaced by rrule.js + season+holiday
  wrapper.

## 6. Top 3 tradeoffs

1. Materialize occurrences vs. expand on read: materialize wins
   downstream features, costs horizon management.
2. Automations engine as own surface vs. baked: engine takes
   longer but pays off with second trigger.
3. Drag-to-reschedule writing overrides accumulates rows — needs
   a "bake overrides into series?" cleanup nudge.

## 7. You'd hate this if...

- Wanted to ship in two evenings.
- Phantom auto-chore fires weekly with unclear cause.
- RRULE editor UI feels clunky on first cut.
- Materialized occurrences drift after schema change.
- Two-way GCal stays out of scope but you keep getting asked.

## 8. Naming

**Batches** — short, in code already, matches how processors
and feed stores talk.

## 9. Tier-2 moonshots

- Visual rule builder
- Two-way GCal sync with conflict resolver
- Multi-calendar push (personal vs. farm vs. crew)
- Public ICS feed + per-market public page with RSVP
- Travel-time-aware "leave by" alerts
- Weather-aware auto-reschedule (proposal UI)
- Critical-path Gantt with dependency auto-shift
- Voice-driven event creation
- Customer RSVP into CRM-lite
- "Season template" library (drop "broiler batch lifecycle"
  onto a date → all 9 events + chores stamped)
