# North Foster Farm — Admin App Scope

**Version:** 0.6.0
**Last updated:** 2026-05-01

---

## Purpose

A custom internal admin app supporting North Foster Farm operations. The app captures
operational knowledge currently held only in James's head, surfaces it in a structured
dashboard, and grows into the operational system of record for the farm as it scales
from its first full season onward.

## Users

| User | Role | Access |
|------|------|--------|
| James | Owner / Operator | Full admin |
| Jim | Partner | Full admin |
| Customers | (future) | Customer-facing only |

## Reserved terminology

- **Event** — A sales occasion: farmers market, pop-up event, or egg drop. Never used for log entries.
- **Tractor** — Unqualified, refers to the Kubota (or future agricultural utility vehicle).
- **Chicken tractor** — A mobile broiler pen.
- **LogEntry** — Polymorphic base type for loggable activity. Subtypes follow `<Domain>Log`.
- **Group** — A tracked unit of livestock (generation, batch, or individual/named set).
- **Mobile coop** — Wooden chicken coop on running gear, layers only.

## Information architecture

Sidebar (top to bottom):

**Overview** (ungrouped) — 1
1. Overview

**Livestock** — 3
2. Layers
3. Broilers
4. Sheep

**Entities** — 4
5. Spaces
6. Machines
7. Suppliers
8. Feeds

**Activity** — 2
9. Schedule
10. Chores

**Events** — 3
11. Farmers markets
12. Pop-up events
13. Egg drop

**Planning** — 3
14. Projects
15. Processes
16. Notes

**Meta** — 1
17. Threads

17 sections in 6 groups. Sidebar gains its own scroll if needed.

## Section specs

### Overview

Tile counts and a status panel.

### Livestock pages (Layers, Broilers, Sheep)

Each species has its own page with five tabs:

1. **Groups** — grid of group cards (default).
2. **Feed schedule** — read-only display of the species' feed schedule(s); see Feed Schedules below.
3. **Chores** — chore definitions filtered by species tag.
4. **Activity Log** — `LogEntry` instances relevant to the species (storage architecture open).
5. **More info** — species-level details.

Group card: name, breed, age, count (species-dependent), arrival date, location, cohabitation note. For sheep, age/arrived/location are hidden.

### Spaces

Kinds + items structure. Current items: MC1, MC2, B1, B2, layer pasture.

### Machines

Lightweight equipment list. Current: Tractor (Kubota), Backhoe, Excavator (both John Deere).

### Suppliers

Vendors NFF buys from. Currently: pullet sources, broiler chick hatchery, feed mill, hay supplier.

### Feeds

Master list of feed types. Each feed type captures:
- Name and description
- Supplier (reference)
- Unit (e.g., lb, bale)
- Package size (e.g., 50-lb bag)
- Cost per unit
- Reorder point and reorder quantity
- Lead time in days

Current feeds: Broiler starter, Broiler grower, Broiler finisher, Layer feed, Sheep hay. Costs and lead times are illustrative placeholders pending `thread_feed_specifics`.

### Schedule

Aggregator view of everything date-bound: chores, scheduled projects, event instances. Two views:

- **Calendar** — month grid, prev/next nav, day cells with up to N event chips and "+N more" for overflow, today highlighted.
- **Timeline** — list view, chronological, grouped by day.

Filter chips toggle visibility per category: Markets, Pop-ups, Egg Drop, Chores. Click any item for a detail popup. Chores currently have no concrete instances (most have `when: TBD` — see `thread_chore_schedule_population`).

**Sync to Google Calendar is push-only**: the schedule is the source of truth and changes propagate to a linked GCal. Reverse-sync (GCal → schedule) is not a goal. Actual integration deferred — see `thread_schedule_full_scope`.

**Prototype scope**: calendar grid, timeline, filters, click-to-detail. Drag-and-drop, in-place editing, and the actual GCal API call are deferred.

### Chores

Definitions + activity log + model notes.

### Events (category)

Each event kind is its own page:

- **Farmers markets** — recurring weekly markets. Three captured: Scituate Rotary, Foster, Tilted Barn.
- **Pop-up events** — one-off occasions. Six captured for summer 2026.
- **Egg drop** — off-season weekly customer pickup at the farmers market site. One captured: Scituate Egg Drop.

Each instance captures: label, location (name + address), and either a recurrence pattern (weekly with day-of-week, time, season window) or an explicit date + time.

### Projects, Processes, Notes

(Scaffolding sections for now.)

### Threads

Open questions and decision log.

## Cross-cutting architecture

### Logging (LogEntry, polymorphic)

Discriminated union with `{ type, id, logTime, actor, subjects }` base. Subtypes per `<Domain>Log`.

### Feed schedules

A feed schedule is owned by a species and assignable to one or more groups. Stages are time-ordered (anchored to "days from arrival" for batches, or "ongoing" for layers/sheep). Each stage references a feed type and a consumption spec (free-choice, metered amount-per-day-per-batch/group, or TBD).

Stage cost is computed automatically when consumption is metered with a finite duration: `amount × days × costPerUnit`. Free-choice and TBD stages are listed but not costed. Total cycle cost is the sum of computed stage costs.

The Feed Schedule tab on each species page shows the schedule(s) read-only. Editor and full week-by-week customization deferred.

### Authentication & user attribution

Auth method TBD. `created_by`, `last_modified_by` on every record. `actor` on every LogEntry.

### Mobile-first surfaces

Chore-completion flow assumed mobile-first. Other surfaces desktop-first.

## Technical notes

- **Frontend:** React (likely Next.js)
- **Backend:** TBD
- **Data model:** Document-oriented. The dashboard's `NFF_DATA` const is the canonical shape; backend will impose IDs and relations on import. No enforced foreign keys.
- **Recurrence expansion:** Computed client-side in the dashboard for prototype; production implementation will live in the backend or a worker.

## Decision log

Resolved threads (12 total as of v0.6.0):

- Sheep, Spaces, Suppliers — top-level sections.
- Chore recurrence model, edit scopes — Google Calendar pattern.
- Logging architecture — polymorphic discriminated union.
- Pasture compliance — soft KPI.
- Log naming — `LogEntry` base + `<Domain>Log`.
- Tractor terminology — qualified disambiguation.
- Sheep consolidation — single group "Lily, Ivy, and Violet".
- Farmers markets — three captured.
- Egg drop — Scituate location captured.

## Open questions

20 open threads. See the `threads` array in the dashboard's `NFF_DATA` const, or the Threads section in the dashboard itself.

---

*Maintained in lockstep with `nff-dashboard.jsx`. The dashboard's `NFF_DATA` const is the single source of truth for the data model — extract it directly when needed (regex on the const declaration, or evaluate in a JS context).*
