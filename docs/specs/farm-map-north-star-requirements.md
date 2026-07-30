# Farm Map UI Overhaul — North-Star Requirements

**App:** NFF // Daily Ops
**Status:** North-star design, settled. This is the *complete* feature,
designed comprehensively per the north-star-first approach. It is **not**
an MVP and contains **no build sequencing** — the work-backwards / MVP cut
is the explicit next phase, done against this doc.
**Provenance:** Output of the multi-agent design workshop (5 blind lenses
+ synthesis + Dad reserve round), plus James's decisions on the seven open
questions and two Dad-derived hard requirements. Grounded in a direct read
of the shipped schema and field code (migrations `0001`–`0013`,
`Rounds.jsx`, `useChoreCompletions.js`, `sections.jsx`).
**Reading order:** §1 decisions → §2 model → §3 surfaces → §4 tiering →
§5 what-ships-today-becomes → §6 rotation planner → §7 risks → §8 deferred
→ §9 reference.

---

## 1. Decisions locked (the seven questions + two Dad requirements)

These are settled inputs, not open items. The rest of the doc builds on
them.

1. **Map demotion — accepted.** The phone lands on the **"Now"** surface,
   not the map. The map is a first-class *view*, not the front door. The
   "place and time are two renderers of one dataset" framing keeps the
   map's value intact rather than killing it.
2. **Desktop landing — the MAP**, with "Now" one click away. Deliberate
   call *against* the workshop's desktop-Now majority: the efficiency
   argument is a field/phone argument; the desktop is the planning
   workbench, where a status-tinted spatial overview is a good landing.
3. **Saved-view primitive — NOT built in v1.** Adopt the shared *unified
   occurrence data shape*, but keep map and timeline as **separate
   renderers** over it. Leave the door open to unify into one saved-view
   primitive later, only if a third renderer ever justifies it.
4. **Geography vs kind — geography is primary.** Re-seed the place tree
   geographically (Pasture A/B/C, Barn, …); keep a **kind tag** as a
   secondary axis so Rounds can still group "all coops." Dad navigates by
   place, not kind — decisive.
5. **Place-tree depth — recursive.** Containment (farm → zone → structure
   → contents) is the literal premise of the map; a 2-level model fights
   the drill-down. `parent_id` is cheap, seed data is tiny. **UI stays
   shallow** even though the tree is recursive. Sequence the migration
   carefully — it touches live Rounds/chores tables.
6. **Offline — pragmatic, not full CRDT.** Idempotent completions +
   **additive merge for counts** + clocked last-write-wins for edits +
   activity-log audit. **Non-negotiable:** additive merge for counts (two
   offline phones each logging "1 dead" must sum to 2, never overwrite to
   1). Shape the log to grow toward the heavier model later; don't build
   that now.
7. **Composable timeline — smaller honest version for now.** Saveable,
   named filters/pins over the unified occurrence stream. The full
   "compose lanes / zoom the scale / click any dated thing" vision is
   **designed here** as north-star direction (§3.4) but is **not a v1
   commitment** — it's work-backwards material.

**Dad-derived hard requirements (not nice-to-haves):**

- **D1 — Visual place disambiguation.** Every place label renders
  `name + parent` together with the **parent as the bold/primary**
  element. Mid-round capture shows the resolved place prominently
  ("Mobile Coop 1 · **Pasture B**") **before** save. Non-unique display
  names are durable field confusion, not first-use friction.
- **D2 — Loud resume affordance.** A persistent **"round in progress —
  tap to resume"** bar on the Now surface. Deleting the sidebar orphans
  the current rejoin path (verified: `Rounds.jsx:531` exits with
  *"run keeps going — rejoin from the sidebar"*). Invisible running state
  is exactly where a non-web-native operator gets stuck.

---

## 2. The data model

The model has one spine (a recursive place tree), one verb (a time-bounded
occupancy), one time substrate (a place-anchored unified occurrence
shape), and one capture discipline (append-only intents that reconcile
offline). Everything else hangs off these.

### 2.1 Places — one recursive tree

A single recursive **place** entity replaces the current two-table
`sites` + `site_locations` split and absorbs the Resources flyout's
place-typed entries.

- **Identity is an opaque surrogate** (`id uuid`), never displayed, never
  derived from a name or an SVG layer id. This is the only load-bearing
  key.
- **`parent_id`** (self-referential) gives the containment tree:
  farm → zone → structure → sub-unit. The canonical inventory (§9.1) is
  mostly two levels under the farm root, but recursion is required for
  cases like Barn → Machinery → excavator and for the rotation planner's
  paddock subdivisions (§6).
- **`kind`** ∈ {`farm`, `zone`, `structure`, `unit`} — the structural
  level (drives drill-down depth and rendering).
- **`kind_tag`** — the *secondary* axis (decision 4): `mobile_coop`,
  `chicken_tractor`, `brooder`, `mobile_brooder`, `sheep_paddock`,
  `feed_store`, `machinery`, `house`, `pasture`, … This is what lets
  Rounds group "all coops" across Pasture B and C even though geography
  is the primary tree.
- **`name`** — mutable, **non-unique** presentation. Uniqueness only on
  the surrogate and on `(parent_id, name)`. "Mobile Coop 1" legally
  exists under both Pasture B and Pasture C. **D1** requires the UI to
  always render `name` with its bold parent.
- **`code`** — a stable, short, human-readable handle (e.g. `CT3`) for
  deep links and search, decoupled from the display name.
- **`mobile`** (bool) — a tractor/coop/mobile-brooder moves; a pasture or
  the barn does not. Drives whether the unit is a candidate for the
  rotation planner and whether its position is data-driven vs authored.
- **`is_active`**, **`sort_order`** — carried over from the shipped sites
  model (seasonal activation, ordering).

A place can exist with **no geometry** (rendered as a list row or an
auto-laid-out pin) and a layer can exist with **no place** (decoration).

### 2.2 Occupancy — one time-bounded edge, generalized

The shipped `site_residents` table is **already** a time-bounded
occupancy edge: `location_id`, `livestock_group_id`, `moved_in`,
`moved_out`, with a partial-unique index enforcing **one open row per
group**. The time model is right; the only thing wrong is that it can
only hold a bird cohort.

Generalize it into **occupancy** (`placements`):

- **`place_id`** → the recursive place (was `location_id`).
- **`occupant_type`** ∈ {`batch`, `livestock`, `equipment`, `feed_lot`,
  …} + **`occupant_id`** — polymorphic, following the precedent already
  set by `event_links` (target_type + target_id, shipped in `0013`).
- **`moved_in` / `moved_out`** — unchanged. `moved_out IS NULL` = "here
  now." The one-open-per-occupant constraint generalizes from group to
  occupant.

Consequences:

- "Coop moved paddock," "batch graduated brooder → tractor," and
  "excavator parked in the barn" are **one event type** — opening one row
  and closing another. **Move history falls out for free** (it already
  does for cohorts today).
- A place's contents are **not only birds + chores**: sheep, machinery,
  and feed storage are occupants of the same shape. Each occupant type
  has its own detail entity — `livestock_groups` (batches/cohorts) ships
  today; **equipment, machinery, feed, and other assets get real tables**
  (today they are placeholder seed arrays behind the Resources flyout).
- The free-text `livestock_groups.current_location` ("MC2", "MC1", null —
  `0004`) is **deleted**; current location is read from the open
  occupancy row. (It is a third, drift-prone place reference today.)

### 2.3 SVG ↔ domain binding — geometry is presentation

A separate **place_geometry** table binds the artwork to the domain,
rather than the SVG layer id *being* the identity:

- `place_id` → `svg_layer_id`, plus `centroid` and optional `footprint`.
- The **domain is the source of truth; the SVG is presentation bound into
  it.** Renaming a layer in the vector tool or renaming a place for users
  never churns identity or data.
- **Unmapped layers are decoration.** `Roads` and `Farm` (in
  `farm-map_v1.svg`) have ids but bind to no place — they are
  context/boundary, not navigable.
- Stable geometry (parcel, zones) is **authored once** in a vector tool
  and exported as SVG. **Moving units** (tractors, coops) are
  **data-driven markers/pins**, not authored geometry — schematic
  auto-laid-out slots until/unless the rotation planner draws real ones
  (§6). v1 art has zone geometry only.
- Adopt this binding *shape* now. The **CI-validated drift invariant**
  (every place resolves to a layer, loud build failure on drift) is good
  but **deferred** (§8) — the shape is the requirement; the guard is
  hardening.

### 2.4 Time — one place-anchored unified occurrence shape

The shipped `timeline_items` **view** (`0013`) already unions
`event_occurrences` + `chore_runs` under a `kind` discriminator and is
the single source the calendar reads. Two things make it the spine of the
time axis:

- **Recurrence is already modeled correctly:** `event_series.rrule`
  (RFC 5545) + **lazy** `event_occurrences` (materialized only when an
  occurrence is overridden/skipped/rescheduled/pushed). Pure recurring
  series materialize zero rows; read-time expansion handles them. **Keep
  this**; do not reinvent recurrence.
- **The gap:** `timeline_items` carries **no place columns**. For the
  central "place-filter → map, time-filter → timeline" identity to hold,
  **every dated fact must carry a place** (or fan to a place subtree).

Requirement: the unified occurrence shape becomes **place-anchored**.

- Event occurrences bind their free-text `location` jsonb to a real
  `place_id`.
- Chore obligations carry a `place_id` per occurrence (this is the same
  change as the completion-grain fix, §2.5 — a site-scoped chore fans out
  into per-place obligations).
- The unified shape is a **read model** (a view/projection): each row is
  `{kind, id, place_id, occurs_on/time, status, label}`. The **write**
  models stay specialized (events: series/occurrences; chores:
  definitions/blocks/runs/completions) — they both *feed* the read shape.
- **The map is `WHERE place ∈ subtree`; the timeline is
  `WHERE time ∈ window`** over the same rows. This *is* the place↔time
  link — two projections of one dataset, not glue between two features
  (decision 3: shared shape, separate renderers).

### 2.5 Chore completion — per-place grain

**Verified defect.** `chore_completions` (`0002`) is keyed
`unique (chore_id, completion_date)` with **no place dimension**, and
`chore_id` is a bare `text` value. In the field flow, `toggle` is called
with the **bare `chore.id`** (`Rounds.jsx:724`, `:854`), and a
site-scoped chore renders as a **single** `siteScopedAll` checkbox
(`:794`). So a chore that applies to five chicken tractors is **one tick,
one row** — you cannot record "fed tractor 3, not 4," and the map cannot
show "3 of 5 tractors fed." This is single-grain *by design*, not just a
missing column.

Requirement: **completion grain becomes (chore × place × date).**

- A site-scoped chore **fans out into per-place completable obligations**;
  each is independently completable and carries `place_id`.
- The completion record gains `place_id`; the natural key becomes
  `(chore_id, place_id, completion_date)`.
- This is what enables per-place status (§2.7) and per-place map tinting,
  and it is the change James flagged as touching live tables — **sequence
  carefully** in the work-backwards phase.
- Completions remain modeled as **row-presence** (insert = done, delete =
  undone), which is already conflict-free — see §2.6.

### 2.6 Offline & sync — append-only intents, pragmatic conflict policy

Today there is **no offline layer**. `useChoreCompletions.toggle` calls
`supabase.auth.getSession()` and the network synchronously, and **reverts
the optimistic tick on error** — so a checkbox ticked behind the broiler
pasture with no signal **silently un-ticks** and the operator never
knows. Given offline is the priority constraint, this is the single
largest build and a going-in architectural requirement.

- **Device-local append-only outbox** (IndexedDB). Every capture (tick,
  untick, observation, mortality, edit) records an **intent**:
  `{op, entity, natural_key, actor, client_clock, client_event_id}`,
  applied to local state immediately and synced when connectivity
  returns. The server stays the system of record; **realtime stays the
  merge path** (it already keeps two devices in sync online).
- **Replace silent-revert with queued-and-guaranteed.** Optimistic local
  apply + a visible **"queued / not yet synced"** indicator + eventual
  sync. The operator must never believe a tick saved when it only lives
  locally — but the local apply must *survive*, not revert.
- **Conflict policy by data kind:**
  - **Completions / observations → commutative idempotent inserts**,
    keyed on natural key (`chore_id, place_id, date`). Replay in any
    order; two people ticking the same box converge (row presence). This
    is already how the model behaves — preserve it.
  - **Counts (mortality) → ADDITIVE merge (non-negotiable, decision 6).**
    A count is an **append**, never an overwrite. `activity_log` is
    *already* append-only via the `log_run_event` SECURITY DEFINER RPC
    (`0010`) — mortality is already an event row, not a mutable counter.
    The requirement is to **never** collapse counts into a mutable column
    that last-write-wins could clobber; sum the events.
  - **Field edits (rename, correct a value, reschedule) → last-write-wins
    with a clock** (`client_clock`), with `activity_log` as the audit
    trail.
- **Don't build full CRDT / vector clocks now.** Shape the outbox and the
  clock so it can grow there if two-user offms contention ever proves it
  necessary.

### 2.7 Status — one derived per-place rollup

A derived per-place status powers both the map's tint/badge and the Now
list's sort/flag — *one* projection, two renderers.

- Per place (and rolled **up** the tree): open-obligation count,
  overdue/last-chance count, **attention flag**, current-occupant summary,
  and "N of M active" for parent zones (e.g. "4 of 5 tractors").
- Mechanism: a **materialized / cached projection** (`place_status`),
  refreshed on completion / placement / observation change. The map and
  Now never join five tables live — they read the projection and paint.
- **Keep the signal basic** for the north-star: a needs-attention level
  (overdue / due / empty-between-batches / healthy). Advanced
  status-overlay logic is explicitly out (§8).
- **Correctness is load-bearing:** if the projection drifts, the map
  lies. The refresh path must be trigger/job-correct (§7).

---

## 3. The surfaces (interaction model)

Four surfaces over the one model: **Now** (time, default on phone), the
**Map** (place, default on desktop), **Rounds** (the field flow), and the
**Timeline** (composed time). Plus place pages, express lanes, and the
admin drawer.

### 3.1 Now — the default field/phone surface

The phone opens here (decision 1); on desktop it is one click from the
map (decision 2).

- **Top:** the active-or-next round as a fat primary button ("Evening
  rounds · starts in 47m" / "Resume morning rounds"). The block is
  auto-inferred (the shipped `nextBlock` logic).
- **D2 — loud resume bar:** if a round is `in_progress`, a persistent
  "round in progress — tap to resume" bar sits at the top of Now. This
  replaces the orphaned "rejoin from the sidebar" path.
- **Body:** a farm-wide **due / overdue** list (the shipped
  `ChoreRemainingPill` due/overrun/N-days-left logic), each row **tagged
  with its place** (bold parent per **D1**) and deep-linking into the
  round or the place. Overdue sorts to the top.
- Derived from the unified occurrence shape filtered to *today* + the
  status rollup. This is the cross-location "what's due across the whole
  farm" view the map alone cannot give.

### 3.2 The Map — the default desktop surface, a renderer over the tree

- The authored, geographically-accurate `farm-map_v1.svg` renders at the
  **zone** level, each zone polygon **tinted by the per-place status
  rollup** (§2.7) — an ambient overview that earns the desktop landing
  slot (decision 2).
- **Drill:** click a zone → camera zooms → structure **pins** appear
  (schematic auto-laid-out slots — v1 art has no structure geometry) →
  click a structure → its **place page** (§3.5).
- The map is the **place renderer** of the unified dataset; the timeline
  is the **time renderer**. They share the data shape but are **separate
  features** (decision 3) — no unified saved-view primitive in v1.
- **On phone** the map is a **secondary, read-only** view (it scales and
  is reachable, but is never the front door and never on the capture
  path). The same place tree is also reachable as an **indented list** —
  map and list are two renderers of one tree.

### 3.3 Rounds — the field flow, kept and hardened

The shipped Rounds takeover (`DoingSurface`, `ColdOpen`, `SiteSwitcher`,
the quick-actions tray, auto-done derivation) is the **canonical field
flow and the spine of this design** — kept wholesale, promoted to the
primary phone path, and hardened:

- **Wrapped in the offline outbox** (§2.6) — replacing the silent-revert
  toggle.
- **D2 resume** surfaced on Now (above) rather than the deleted sidebar.
- **Site Switcher gains the kind axis** (decision 4): group the round by
  **geographic zone** (walk Pasture B, then Pasture C) *or* by **kind
  tag** ("all coops"). Geography is the default; Dad moves by place.
- **Per-place completion** (§2.5): site-scoped chores fan out into
  per-place checkboxes, so the round can record "tractor 3 fed, 4 not"
  and the auto-done derivation reflects real per-place coverage.
- **D1 mid-round capture:** the Note / Mortality / MASH tray pre-seeds the
  place from `selectedLocationId` *and shows it prominently*
  ("Mobile Coop 1 · **Pasture B**", large, at the top of the sheet)
  before save. Logging a dead bird at Tractor 3 stays ~3–4 taps.

### 3.4 Timeline — composed time (north-star direction, staged realization)

**Committed near-term shape (decision 7):** saveable, **named
filters/pins** over the unified occurrence stream. The shipped Events
flyout already does exactly this — its per-kind children are saved-filter
chips that land on Schedule with one kind's filter on (Batch 14.2). Extend
that pattern: a saved filter is a `{subjects, place_scope, time_window,
kind_filters}` object, **composed on the desktop workbench**, **consumed
read-only by Dad** (he opens "Today's rounds" or "Batch 7"; he never
composes). On phone a saved timeline reads as the Agenda view.

**North-star direction (designed, deferred to work-backwards):** the full
composable timeline James described —

- A **"new timeline"** action puts a time axis on screen; clicking any
  dated thing **adds a lane** defined by that item (a batch's lifecycle,
  a tractor's move history, every occurrence of a chore type). The
  composition unit is a **lane (series/criterion)**, not a single event,
  so "all chores for Batch 7" is one gesture, not fifty.
- **Recurring obligations are one lane with a rule** (band when zoomed
  out, individual completable instances when zoomed in) — which the
  `event_series` rrule + lazy `event_occurrences` model already supports.
- **Zoom switches the idiom:** day → agenda, week → column calendar,
  season → continuous/Gantt axis; "set start/end" is windowing the same
  axis. One control, not three screens.

This grand version is **not a v1 commitment.** It is the direction the
saved-filter version grows into; the cut happens in the work-backwards
phase.

### 3.5 Place pages, express lanes, and the admin drawer

- **Place page** (reached from the map, the place list, search, a deep
  link, or a Now row): current occupant(s) with detail (batch age/count,
  or sheep, or the excavator's hours/next-service, or feed level), chores
  due here, recent observations (from `activity_log` rows tagged with this
  place), and a "view on timeline" jump. Drilling **bottoms out at the
  real, named, batch-bearing unit** (Tractor 3, Mobile Coop 1).
- **Express lanes (bypass the map, decision-1 corollary):**
  - **Search** over place `code` + `name` + occupant, returning
    **disambiguated** rows ("Mobile Coop 1 · **Pasture B**" vs "· **Pasture
    C**") per **D1**.
  - **Recents.**
  - **Push deep-links** straight into the active run (the shipped push
    infra) and into a place.
- **Admin / records drawer** (desktop, reached from the header avatar —
  the same place Settings already lives): the genuinely non-spatial,
  non-temporal record surfaces that have no place on a map or in a round
  (§5.1). It is *not* primary navigation.

---

## 4. Responsive tiering

Restating the binding split against this design:

- **Tier 1 — robust mobile/touch, outdoors, offline-first:** the **Now**
  surface, the **Rounds** field flow, all capture (tick, note, mortality,
  MASH), place **lists**, reading **saved** timelines, and basic edits
  (rename, change a date). These are list/form/round-shaped and translate
  cleanly to touch. **Phone landing = Now.**
- **Tier 2 — desktop workbench, render-safe on phone but not designed for
  it:** the interaction-heavy **map**, **timeline composition/authoring**,
  **place-tree authoring** (`SitesAdmin` becomes the place-tree editor),
  and the **rotation planner** (§6). **Desktop landing = the map**
  (decision 2).

---

## 5. What ships today becomes (migration map)

Grounded in the verified current state. This is *what changes*, not *when*
— sequencing is the work-backwards phase.

### 5.1 The sidebar IA (`sections.jsx`) — deleted as primary nav

The flat `SECTIONS` list mixes three different things — places, time, and
records — and only the third is genuinely a "list of types."

- **Becomes primary navigation:** Now · Map/Places · Schedule/Timeline ·
  Do rounds.
- **Moves into the thin admin/records drawer** (non-spatial,
  non-temporal, low-frequency): Products, Inventory, Add to inventory,
  Orders, Point of sale, Customers, Lists, Farm updates, Content calendar,
  What's coming (roadmap), Notes, Threads, Settings.
- **Animals (Layers / Broilers / Sheep):** these are *occupant/batch*
  views — reached by drilling a place to its resident batch, and from a
  records index. They stop being top-level nav.
- **Activity / Observations:** stay as cross-cutting logs, reachable from
  place pages (filtered to that place) and a global view.

### 5.2 The place tangle — collapse three+ models into one tree

Today there are **three overlapping place vocabularies**, which is the
strongest cleanup the design forces:

- the **live** `sites` / `site_locations` / `site_residents` (UUID-keyed,
  used by chores, Rounds, observations — `0009`);
- the **legacy** `space_kinds` / `space_items` (`0003`, text-keyed) and
  the Resources flyout's place-typed entries (Sites, Pastures, Brooders,
  Chicken tractors, Mobile coops);
- the **free-text** `livestock_groups.current_location` (`0004`).

Resolution:

- **Keep and evolve** `sites`/`site_locations` into the **one recursive
  place tree** (§2.1): `site_locations` gains `parent_id`, `kind`,
  `kind_tag`, `code`, `mobile`, geometry binding; the `sites` "category"
  role is replaced by the geographic tree + the `kind_tag` axis. Re-seed
  geographically (the shipped seed is kind-grouped: "Mobile coops",
  "Chicken tractors").
- **Delete** the legacy `space_kinds`/`space_items` and the free-text
  `current_location` (location now comes from the open occupancy row).
- The Resources flyout **dissolves**: place types → the place tree +
  `kind_tag`; asset types (Equipment, Machinery, Containers, Trailers,
  Feed) → typed **occupants** (§2.2) with real tables; Suppliers → a
  record in the admin drawer.
- `SitesAdmin` becomes the **place-tree authoring** tool (Tier 2).

### 5.3 Chores / Rounds (`0009`–`0012`) — kept wholesale, four changes

The most-validated shipped work; the spine of the field tier. Kept:
`chore_blocks`, `chore_runs`, `chore_definitions` (site/location/block/
last-chance), `chore_modifiers`, assignment rules, the quick-actions tray,
the auto-done derivation. Changes:

1. **Completion grain → per-place** (§2.5): add `place_id`, fan site-
   scoped chores into per-place obligations, re-key
   `(chore_id, place_id, date)`.
2. **Wrap writes in the offline outbox** (§2.6).
3. **Site Switcher → group by zone OR kind** (decision 4).
4. **Resume on Now** (D2); `chore_definitions.site_id`/`location_id`
   repoint to `place_id` in the unified tree.

### 5.4 Schedule / Events (`0013`) — kept, extended to place-anchored

Kept: `event_series` (rrule), lazy `event_occurrences`, the polymorphic
`event_links`, the `timeline_items` view, the four calendar views, the
Events-flyout saved-filter pattern. Changes: **add a place dimension** to
the unified occurrence shape (§2.4); the saved-filter pattern is the basis
for the Q7 saved-timeline (§3.4).

### 5.5 Completions & activity log (`0002`, `0010`) — reshaped / kept

- `chore_completions` (`0002`): **reshaped** — gain `place_id`, become
  per-(chore × place × date), feed the offline outbox's idempotent-insert
  model.
- `activity_log` + `log_run_event` (`0010`): **kept** — already append-
  only via a SECURITY DEFINER RPC, which is exactly the additive substrate
  mortality counts need (§2.6). Run events gain `place_id` (they already
  carry `site_id`/`location_id` → repoint to the tree).

---

## 6. Rotation planner relationship

A **sibling feature on the shared place-geometry substrate**, not part of
the map's v1, and not designed in isolation from it.

- Shares: the **place tree**, the **occupancy edge** (a rotation plan is a
  sequence of moves = future occupancy rows with dates), and the
  **geometry binding** (§2.3).
- Differs: the planner **draws real structure/paddock geometry** and
  **sets** positions over time; the navigation map only needs **schematic
  pins** and **shows** the current position. This is the natural seam
  where authored structure-level geometry would later replace
  auto-laid-out slots.
- The same fact (a tractor move) is a **position on the map** and a **lane
  entry on the timeline** — the place↔time identity (§2.4) in action.

---

## 7. Risks carried forward (the honest part)

1. **Desktop-map landing is a deliberate minority call (decision 2).** The
   workshop's efficiency logic said agenda-first everywhere; James kept
   the map as the desktop front door. Mitigants: the map itself carries
   the status tint (so "what needs attention" is visible spatially), and
   Now is one click away. Watch that desktop users don't miss time-urgent
   work behind a spatial overview.
2. **Geography vs kind must both be load-bearing.** The tree carries
   geography (`parent_id`) *and* kind (`kind_tag`); Rounds must group by
   either, and the re-seed repoints kind-grouped sites → geographic tree +
   tags. Get either axis wrong and "do all the coops" or "everything at
   Pasture B" breaks.
3. **The status projection must stay correct.** "The map paints instantly"
   and "Now is one query" rest on `place_status` staying in sync via
   triggers/jobs. Drift makes the map lie.
4. **Offline conflict is easy to get silently wrong.** Additive counts are
   non-negotiable; field edits need a real clocked LWW; completions must
   stay row-presence-idempotent. The failure mode (losing Dad's offline
   data) is precisely what the offline priority exists to prevent.
5. **The per-place completion grain change touches live tables.** Re-
   keying completions + fanning site-scoped chores + collapsing the place
   models is a schema-down change on the shipped chores/Rounds spine.
   Bounded (seed data is tiny) but real — careful sequencing required.
6. **Composable-timeline / saved-view scope can balloon.** Held to saved
   filters near-term (decisions 3 and 7); the grand versions are the most
   likely to slip the rollout they serve.

---

## 8. Explicitly deferred / not in the north-star build

Designed-or-considered, consciously not built now:

- **Full composable timeline** (lane composition, zoom-switches-idiom) —
  north-star direction (§3.4), realized via saved filters first
  (decision 7).
- **Unified saved-view primitive** with multiple renderers — shared data
  shape adopted; the primitive is a documented future option, built only
  if a third renderer justifies it (decision 3).
- **Multiplayer presence** ("Dad is at Pasture A") — **rejected**: thin
  value for two people, reads as surveillance.
- **Map time-scrubber / season replay; cross-batch forecasting lanes;
  voice capture; weather overlays; equipment auto-service triggers** —
  moonshots; each needs substrate not yet present.
- **Full CRDT / vector-clock sync** — pragmatic policy now; shape to grow
  (decision 6).
- **CI-validated SVG↔place registry invariant** — binding *shape* adopted
  now (§2.3); the loud-failure drift guard is later hardening.
- **GPS tracking of mobile units** — out of scope; the planner uses
  planned/schematic positions, not GPS.
- **Full mobile parity for the map / timeline composition / rotation
  planner** — Tier 2: render-safe on phone, not designed for it.

---

## 9. Reference

### 9.1 Canonical place inventory (authoritative)

- **House**
- **Brooders** → Brooder 1, Mobile Brooder
- **Pasture A** *(broiler)* → Chicken Tractors 1–5
- **Barn** → Feed storage, Sheep paddock, Machinery (excavator, backhoe,
  tractor)
- **Pasture B** *(layer)* → Mobile Coops 1, 2
- **Pasture C** *(layer)* → Mobile Coops 1, 2

Per-location numbering restarts ("Mobile Coop 1" in both B and C) →
identity is the surrogate, display is `name + bold parent` (D1).

### 9.2 Map asset

`farm-map_v1.svg`: viewBox `0 0 1250 1250`, geographically accurate
parcel. Layers: `Roads`, `Farm` (context/boundary — decoration, not
places), and a group of `House`, `Brooders`, `Pasture-A`, `Pasture-B`,
`Pasture-C`, `Barn` (zones). Zone level only — no structure geometry yet.
Not yet committed to `public/`.

### 9.3 Domain vocabulary

**Chicken tractor** (mobile bottomless pen on broiler pasture),
**brooder** / **mobile brooder**, **mobile coop** (wheeled hen coop on
layer pasture), **pasture** / **paddock**, **broiler** vs **layer**,
**batch / cohort**, **round** (completing all chores in a scheduled
time-block — a time-driven traversal of scattered places).

### 9.4 Verified current-state anchors (ground truth for work-backwards)

- `site_residents` (`0009`) is already a time-bounded occupancy edge
  (`moved_in`/`moved_out`, one-open-per-group) — bound only to
  `livestock_groups`.
- `site_locations` (`0009`) is strictly two-level — no `parent_id`.
- `chore_completions` (`0002`): `unique (chore_id, completion_date)`,
  `chore_id` is `text`, **no place column**; `Rounds.jsx` toggles the bare
  `chore.id`; site-scoped chores render as one `siteScopedAll` checkbox.
- `timeline_items` (`0013`) unions `event_occurrences` + `chore_runs` —
  **no place columns**.
- `activity_log` + `log_run_event` (`0010`) is append-only via a SECURITY
  DEFINER RPC (the additive substrate for counts).
- No offline store exists; `useChoreCompletions.toggle` is a live network
  call that **reverts on error**.
- `Rounds.jsx:531` exit: *"run keeps going — rejoin from the sidebar"* —
  the rejoin path D2 must replace.

---

*Next phase: work backwards from this north-star to a scoped rollout MVP,
with the increments between MVP and the complete feature made explicit.*
