# North Foster Farm Admin App — Conversation Handoff

**Purpose of this document.** Self-contained briefing for resuming the NFF admin app build in a new Claude session (Windsurf or elsewhere). Reading this plus the two artifacts (`nff-dashboard.jsx` and `nff-scope.md`) should fully restore working context without needing the original conversation transcript.

**Current version:** 0.6.0
**Date of last work:** 2026-05-01

---

## What this project is

James (operator) and his father Jim run **North Foster Farm** in Foster, Rhode Island — a 50/50 partnership focused on pasture-raised meat birds (Cornish Rock Hybrid broilers), egg-laying hens (Red Sex Link layers), and three pet sheep (Katahdin: Lily, Ivy, and Violet). The farm is approaching its first full season.

We're iteratively building a **custom internal admin app** to capture operational knowledge currently held only in James's head and to grow into the operational system of record as the farm scales. This is a prototype-phase build: a React dashboard with seeded data and progressively-refined sections. No real backend yet.

James is a software developer himself, prefers terminal/CLI workflows, and has had artifact-debugging issues before — keep components self-contained and avoid `localStorage` / `window.storage`.

---

## How we work together

**Workflow.** Each turn, James drops a numbered list of bullets — feature requests, data, corrections, decisions. Claude:

1. Parses the bullets and decides which sections of the app they affect.
2. Surfaces *threads* — open questions, pushbacks, ambiguities, things that warrant verification — both inline in chat and persisted in the dashboard's Threads section.
3. Regenerates the artifacts (currently two files) end-to-end with the changes applied.
4. Calls `present_files` so James can download the updated artifacts.
5. Briefly recaps what changed and flags the most actionable items for the next bullet drop.

**Two artifacts in lockstep:**

- `/mnt/user-data/outputs/nff-dashboard.jsx` — full React dashboard with all data embedded as a `NFF_DATA` const at the top. Single source of truth. Self-contained — runs as an artifact.
- `/mnt/user-data/outputs/nff-scope.md` — high-level scope document; describes what the app does and how it's organized.

Until v0.5.0 there was a third file `nff-data.json` mirroring the data. James eliminated it in v0.6.0 — the embedded `NFF_DATA` const is the single source of truth now. Extract by regex on the const or by evaluating the module if needed.

**Threads system.** Open questions and resolved decisions live in `NFF_DATA.threads`. Each thread has `id`, `title`, `question`, `status: "open" | "resolved"`, optional `resolution` (when resolved), and optional `notes`. The Threads section in the dashboard renders these in two subsections (Open / Resolved) — resolved threads carry their resolution and act as a decision log.

When Claude opens a thread, it's flagged in chat with the thread id (e.g., `thread_log_storage`) so James can address it later. When a thread resolves, the original question stays and a `resolution` field is added. Resolved threads are NOT deleted — the decision log is the point.

**Pushbacks.** When James proposes something Claude thinks is suboptimal (a name collision, an architectural risk, an ambiguity), Claude pushes back briefly in chat *and* opens it as a thread. Examples to-date: pushing back on `LogEvent` → `LogEntry` to avoid overloading "Event" (resolved); flagging the unusual decreasing broiler feed pattern (still open).

**Tone.** Direct, lightly opinionated, terse where possible. James appreciates concrete pushback and surfacing edge cases over deference. He's not looking for a sycophant. Bullet-heavy chat responses with a clear "what changed / what to watch / ready for next" rhythm.

---

## Reserved terminology

These are non-negotiable in code, UI, and prose:

- **Event** — A *sales occasion* only: farmers market, pop-up event, or egg drop. Never used to mean a log entry, an occurrence, or anything else.
- **Tractor** (unqualified) — The Kubota agricultural utility vehicle (or any future ag tractor).
- **Chicken tractor** — A mobile broiler pen with feed/water/fencing.
- **LogEntry** — Polymorphic base type for all loggable activity. Subtypes follow `<Domain>Log` (`ChoreCompletionLog`, `TemperatureLog`, `FeedLog`, `MortalityLog`, `EggCollectionLog`, `WeightLog`). "Event" never appears in log type names.
- **Group** — A tracked unit of livestock. Semantics vary by tracking model: a generation (layers), a batch (broilers), or an individual / consolidated set (sheep).
- **Mobile coop** — Wooden chicken coop on running gear, layers only. Towed by the tractor via drawbar hitch.

---

## Information architecture

17 sections in 6 sidebar groups:

```
Overview                         (ungrouped)
LIVESTOCK                        Layers, Broilers, Sheep
ENTITIES                         Spaces, Machines, Suppliers, Feeds
ACTIVITY                         Schedule, Chores
EVENTS                           Farmers markets, Pop-up events, Egg drop
PLANNING                         Projects, Processes, Notes
META                             Threads
```

**Species pages** (Layers, Broilers, Sheep) each have 5 internal tabs: Groups · Feed schedule · Chores · Activity Log · More info.

**Event sub-pages** show instances of each kind. Recurring instances render Day/Time/Season; single-date instances render Date/Time. Both render full Location (name + address).

**Schedule** is the cross-cutting calendar/timeline view aggregating event instances (and eventually chore instances and dated projects). Calendar/Timeline toggle, prev/next month nav, filter chips per category, click-to-detail modal. Push-only GCal sync is planned. Drag-and-drop, in-place editing, and the actual GCal API call are deferred (`thread_schedule_full_scope`).

---

## Current data state (v0.6.0)

### Livestock (3 species, 7 groups total)

**Layers** (Red Sex Link, generation tracking):
- No bands — count and arrival unknown, in MC2
- Blue bands — count and arrival unknown, in MC2
- Orange bands — count unknown, arrived 2025-10-14, in MC2
- Gold bands — 200 birds, arrived 2026-04-01, 16 weeks old as of 2026-05-03, in MC1

**Broilers** (Cornish Rock Hybrid, batch tracking):
- Batch 1 — 275 birds, arrival/processing dates TBD
- Batch 2 — 275 birds, arrival/processing dates TBD

**Sheep** (Katahdin, individual tracking, consolidated to one group):
- Lily, Ivy, and Violet — pets, no production. Location TBD.

### Spaces

**Kinds:** mobile coop, brooder, pasture, chicken tractor.
**Items:** MC1 (gold bands), MC2 (no/blue/orange cohabit), B1, B2, layer pasture.

Most specs (dimensions, capacity, build details) are TBD — see thread_layer_pasture_specs, thread_chicken_tractor_inventory, thread_brooder_specs, thread_mobile_coop_specs.

### Machines

Tractor (Kubota, model TBD), Backhoe (John Deere, model TBD), Excavator (John Deere, model TBD). Lightweight reference list. Maintenance tracking depth deferred (thread_machine_management).

### Suppliers

Pullet sources (preferred individuals), Broiler chick hatchery, Feed mill, Hay supplier. All specific identities TBD.

### Feeds (5 types, all costs illustrative)

- Broiler starter — $0.55/lb, 50-lb bags, reorder at 100 lb / order 500 lb, 7-day lead
- Broiler grower — $0.50/lb, same package, reorder at 200 / order 1500
- Broiler finisher — $0.48/lb, same package, same reorder
- Layer feed — $0.45/lb, 50-lb bags, reorder at 100 / order 500
- Sheep hay — $5.00/bale (~40 lb, ~10 flakes), reorder at 5 / order 20, 5-day lead

### Feed schedules (3, one per species)

**Standard broiler schedule** (cycle anchored to arrival, 5–7 weeks total):
- Days 0–14: Starter, free choice
- Days 14–21 (Week 3): Grower, **100 lb/day per batch** of 275 → $350.00
- Days 21–28 (Week 4): Grower, **75 lb/day per batch** → $262.50
- Days 28–49 (Weeks 5–7): Finisher, amounts TBD

Total estimated cost for metered stages: **$612.50**. James indicated amounts continue decreasing — biologically unusual for Cornish Rock, see thread_broiler_feed_pattern.

**Standard layer feed:** ongoing free choice, layer feed + grit + calcium.

**Sheep hay regimen:** ongoing, 1 flake/day for the trio.

### Chores (7, mostly with when=TBD)

`open_mobile_coops`, `give_sheep_hay`, `log_brooder_temp`, `move_chicken_tractor` (twice daily), `move_mobile_coop`, `feed_broiler_batch`, `collect_eggs`. Tagged by species so the per-species Chores tab and Schedule's chore filter can group them. Most have no specific times yet — see thread_chore_schedule_population.

### Events (3 kinds, 10 total instances)

**Farmers markets (3):**
- Scituate Rotary — Saturdays 9–1, May 9 – Nov 1, 46 Institute Lane North Scituate
- Foster Farmers Market — Sundays 9–12, June 1 – Nov 1, 164 Danielson Pike Foster
- Summer Market at Tilted Barn — Wednesdays 4–7pm, June 3 2025 – August 26 2026, One Hemsley Place Exeter (14-month range likely a typo, see thread_tilted_barn_date_range)

**Pop-up events (6, all 2026 assumed — see thread_popup_event_year):**
- July 10, 6:00–8:30 PM, Summer Celebration, Warwick City Hall Plaza
- July 18, 11:00 AM–3:00 PM, Summer Concert, Rocky Point
- July 22, 5:00–8:00 PM, Summer Concert, Warwick City Hall Plaza
- August 8, 11:00 AM–3:00 PM, Summer Concert, Rocky Point
- August 26, 5:00–8:00 PM, Summer Concert, Warwick City Hall Plaza
- September 19, 12:00–3:00 PM, Apple Fest, Warwick City Hall Plaza

**Egg drop (1):**
- Scituate Egg Drop — Saturdays 10–11 AM, Nov 2 – April 30, same site as Scituate Rotary (46 Institute Lane)

**Locations:**
- Warwick City Hall Plaza — 3275 Post Rd, Warwick, RI 02886
- Rocky Point — 1 Rocky Point Ave, Warwick, RI 02889

---

## Decision log (resolved threads — 12 of 33)

1. **Sheep** — 3 Katahdin pets consolidated into one group "Lily, Ivy, and Violet".
2. **Spaces** — top-level section with kinds + items structure.
3. **Suppliers** — top-level section.
4. **Chore recurrence model** — supports specific times, ranges, multiple times/ranges, sunrise/sunset anchors (UI shows both word and computed actual time), conditional state-based recurrence (state model still open).
5. **Chore edit scopes** — Google Calendar pattern: this instance / this and following / all instances. Past completions immutable.
6. **Logging architecture** — polymorphic discriminated union; "Event" reserved for sales occasions only.
7. **Pasture compliance** — soft KPI computed per batch from arrival, brooder graduation, processing dates.
8. **Log naming** — `LogEntry` base + `<Domain>Log` subtypes. "Event" never appears in log type names.
9. **Tractor terminology** — "tractor" unqualified = Kubota; "chicken tractor" = broiler pen.
10. **Farmers market details** — three markets captured (above).
11. **Egg drop details** — Scituate Egg Drop captured (above).
12. **(implicit) Information architecture** — Livestock and Events both became sidebar categories with sub-items rather than single sections.

---

## Open threads (21)

In rough priority order based on "what blocks the most other work":

**Architecturally significant (block downstream features):**
- `thread_log_storage` — Where do LogEntry instances live? Single global `logs[]` indexed by actor + subjects, vs distributed by domain. Blocks the Activity Log tab from doing anything real.
- `thread_recurrence_state_model` — Conditional chore recurrence needs a state expression language. Likely candidates: active broiler batch lifecycle stage, weather thresholds, manual flags, date offsets from livestock arrival.
- `thread_chore_schedule_population` — Most chores have when=TBD. Until specific times exist, the Schedule's Chores filter has nothing to render and the recurrence engine has nothing to expand.
- `thread_customers_in_admin` — Customer-facing app: same app or separate? Affects auth/session architecture.

**Verifications / quick confirmations:**
- `thread_tilted_barn_date_range` — 14-month range likely a typo (should both years be 2026?).
- `thread_popup_event_year` — pop-up dates have no year on source image; assumed 2026.
- `thread_broiler_feed_pattern` — week 3=100, week 4=75 lb/day is decreasing, unusual for Cornish Rock. Confirm direction.
- `thread_age_format_gap` — interpretation of the 5–8 week formatting gap (currently: weeks ≤4, months 1–11, "1 year" exact, "Y years, M months" beyond).
- `thread_chore_completion_ux` — confirm mobile-first priority for completion flow.

**Specs to fill in:**
- `thread_broiler_batches_data` — arrival/processing dates, locations, status, week-by-week feed, mortality.
- `thread_brooder_temp_schedule` — full week-by-week target schedule (have week 1 = 85°F).
- `thread_feed_schedule` — broiler weeks 5–7 amounts.
- `thread_layer_pasture_specs` — dimensions + satellite-image boundary.
- `thread_chicken_tractor_inventory` — count, identifiers, capacity, specs.
- `thread_brooder_specs` — B1 and B2 location, capacity, heat source, dimensions.
- `thread_mobile_coop_specs` — MC1 and MC2 capacity, dimensions, build details.
- `thread_specific_suppliers` — pullet source and hatchery names, contacts, terms.
- `thread_feed_specifics` — actual feed mill identity, real prices, real lead times.
- `thread_machine_management` — depth of tracking (maintenance, hours, attachments).
- `thread_sheep_location` — where do Lily, Ivy, and Violet live? Should it be a Space?
- `thread_layer_arrival_history` — backfill arrival dates for No bands and Blue bands.

**Feature scope deferrals:**
- `thread_schedule_full_scope` — drag-and-drop, in-place editing, GCal API call all deferred for prototype.

---

## Visual / technical conventions

**Theme** (defined as `T` const):
- Background: `#181c19` (dark warm olive)
- Surface: `#23291f`, surfaceAlt: `#1f2520`
- Accent: `#a0b87f` (pasture green)
- Warn: `#d4a346` (gold, for TBD/pending)
- Resolved: `#7a9e5e`
- Schedule category colors:
  - Farmers market: accent green
  - Pop-up event: warn gold
  - Egg drop: `#7ea3b5` (desaturated blue)
  - Chore: `#9a9484` (muted)
- Fonts: Fraunces serif (headers), IBM Plex Mono (body) — both loaded from Google Fonts
- Inline styles only (no Tailwind class strings)
- lucide-react icons (Bird, Egg, PawPrint for livestock; Wheat, Calendar, Tent, Sparkles, Package etc. for sections)

**File structure:**
- `nff-dashboard.jsx` — single file, ~1500 lines, all components inline
- `NFF_DATA` const at top is the data source of truth
- `SECTIONS` array drives the sidebar; each entry has `{ id, group, label, icon, getCount }` and optional `description`
- Section IDs use `livestock_<species>` and `events_<kind>` patterns for sub-pages
- `SectionContent` switches on `section.id` to route; `SpeciesPage` and `EventKindPage` handle the patterned IDs
- Function declarations (hoisted) used throughout — order doesn't matter for forward references

**Recurrence expansion** is computed client-side in helpers (`expandWeekly`, `expandSingle`, `getEventOccurrences`) for the Schedule prototype. Production will move this to a backend or worker.

**Cost computation** for feed stages happens in `computeStageCost`. Returns `{ totalAmount, totalUnit, cost, days }` for metered+finite stages, `null` for free-choice/TBD/ongoing, `{ unitMismatch: true }` when the stage's unit doesn't match the feed's costPerUnit.unit.

---

## How to resume in a new session

1. Read this document and have it available alongside the artifacts.
2. Open `nff-dashboard.jsx` and `nff-scope.md` (the latter is a useful summary; the former contains all data).
3. The new Claude should treat this conversation as continuing — same workflow (bullet drops → Claude updates artifacts → Claude flags threads → Claude presents files).
4. New version bump on the next change: v0.7.0.
5. Maintain the two-files-in-lockstep rhythm.
6. Watch for and proactively flag threads — the system depends on never silently making assumptions.
7. The most actionable next bullets, in rough order of leverage:
   - Quick verifications (Tilted Barn date range, pop-up year, broiler feed pattern direction) — small fixes, unblock data accuracy.
   - `thread_log_storage` decision — unblocks Activity Log tab on every species page.
   - Filling in chore-specific times — unblocks Schedule's Chores filter and recurrence engine work.
   - `thread_customers_in_admin` — affects auth architecture, worth deciding before any backend work begins.

---

*Last updated: end of v0.6.0 work. Next session picks up here.*
