# Farm Map UI Overhaul — Proposal Capture

**App:** NFF // Daily Ops
**Status:** Idea captured / pre-design. Jumping-off point for a dedicated feature-design session.
**Proposed priority:** New roadmap item(s), promoted to top of the list.
**Approach:** **North-star first** — design the complete feature comprehensively, then work backwards to a scoped MVP (see §11).
**Not yet decided:** The MVP cut for the initial rollout — but per §11 that is a deliberate *output* of the design work, not an open default. This document is for capture and framing, not specification.

---

## 1. Problem statement (current IA)

The current dashboard uses a conventional, domain-agnostic pattern: entities listed in a left sidebar, user clicks menu items to jump between screens.

Why it's not working for us:

- The sidebar is a **flat list of entity types**. It imposes a structure that has no relationship to how the farm is actually organized or operated.
- It creates **no meaningful hierarchy** among entities — nothing that's valuable to us as users.
- Navigation depends on **memorizing** which menu/screen something lives on. There is no intuitive wayfinding.
- It was **not designed to be responsive**, and most real data capture / interaction will happen **outside, on phones**.
- It will be a **pain point for Dad**, who isn't accustomed to hopping around a complex web app.

Conclusion: UI changes are required before rollout regardless of whether we pursue the map idea — the responsive + simplicity problems exist independently.

---

## 2. The proposal (in brief)

Make the app's **main screen a 2D map of the farm**, navigated like a world map in an RPG.

**Zoom / drill-down hierarchy** (containment, not a flat list):

- **Farm (max zoom-out):** each area is a clickable region — brooders, broiler pasture, barn, layer pasture A, layer pasture B, house, etc.
- **Area:** zoom into an area to see its structures — e.g. Brooders → Brooder 1, Mobile Brooder; Broiler Pasture → Chick Tractors 1–5 (possibly positioned).
- **Structure / batch:** drill into a single brooder or tractor to see batch detail, location-specific chores, animals, projects, etc.

At every level, the entities contained at that location (chores, animals, projects) are interactable in context.

**Core philosophy:** spatial navigation that mirrors the farm's real geography, replacing an arbitrary entity list with the structure we already hold in our heads.

---

## 3. Rollout drivers (why now)

- We intend to **start using the app for real with Dad**, soon.
- First parts to roll out: **dashboard, chores, scheduling**.
- Interaction will largely be **outdoors, on phones** → responsive design is mandatory.
- The current UI will be a **friction point for a non-web-native user (Dad)**.

---

## 4. Responsive strategy — what needs mobile, what doesn't

The app **does** need to be responsive — enough to render without layout bugs or major usability problems on a phone. But it does **not** need to target mobile as a primary device *everywhere*. There's a specific, intentional division between functionality that needs robust mobile support and functionality that doesn't.

**The desktop is the workbench.** This dashboard is fundamentally a long-term planning and strategy tool, and that's where the real work *in the app* happens. On our phones — outside, working — we're mostly marking chores complete, checking things, and logging basic information.

### 4.1 Needs robust mobile support (Tier 1)
What Dad and I actually do on our phones during normal operations:

- **Conduct rounds.** A *round* is completing all the chores within a **scheduled block** — e.g. Monday's first block fires at sunrise; "morning rounds" = traveling the farm and completing everything that must happen first thing. The block groups chores by time; the chores themselves are scattered across locations, so a round is inherently a **time-driven traversal of places** (the clearest spot where the time axis §7 and place axis §2 meet in daily use). There's already a pattern in place built around the task-management + data-capture of doing rounds. This is the canonical field flow and must be first-class on touch.
- **Reference things** — feed schedules, event details, data/metrics from previous batches, the daily agenda, the broiler timeline.
- **Make basic changes** to objects/instances — e.g. rename or change the date of a specific event.
- **Basic messaging** — leaving comments or notes.

### 4.2 Doesn't need mobile as a primary target (Tier 2)
Must still render without layout bugs on a phone, but is not designed for primary phone use:

- The **interaction-heavy 2D map** — explicitly does *not* need to translate to the phone.
- Deep **planning / strategy** work and dense authoring interactions (including the rotation planner, §8, and timeline *composition*, §7).

**Why this matters for the map:** the hardest responsive problem — a pan/zoom spatial canvas on a phone (see §6.2) — is one we can largely *opt out of*. The map is a desktop-first surface; the field experience leans on the Tier-1 flows above, which are list/form/round-shaped and translate cleanly to touch.

---

## 5. Why this is promising (the case for)

- **Mental model match.** We already navigate the farm spatially every day. "Go to the broiler pasture and check the tractors" is a real action, not a learned menu path.
- **Real hierarchy with value.** Farm → area → structure → batch is a genuine containment hierarchy — exactly what the sidebar's flat list lacked.
- **Onboarding for non-technical users.** You navigate by recognizing *places*, not by learning labels. Lowers the barrier for Dad dramatically.
- **Context-rich.** Standing "in" a place surfaces exactly what's relevant to that place.
- **Doubles as an ambient status dashboard.** Color/badge each place by state (overdue chore, needs attention, empty between batches) and the home screen becomes at-a-glance ops awareness — replacing much of what the current dashboard does.
- **Forces a clean data model.** Everything (chores, batches, projects, animals) hangs off a *place*. That location-as-backbone model is probably the right structure anyway.
- **Deep-linkable by design.** Zoom levels map naturally to a route hierarchy (`/farm`, `/area/broiler-pasture`, `/tractor/ct3`), so notifications/reminders can link straight into the relevant place.

---

## 6. Key tensions & risks (the case to watch)

### 6.1 Place axis vs. time axis — the biggest one
The map nails the **place** axis ("what's going on at X"). But much of the work is driven by the **time** axis: "what's due today," "what's overdue," cross-cutting queries that live in no single place. If everything is reachable only by drilling into a location, those queries get painful (you can't drill into five tractors to find which one needs attention).

**Implication:** the map cannot be the *only* lens. We need a co-equal way to see the operation by time — and it likely deserves to be a first-class **timeline** lens, not merely a "today" list (developed extensively in §7). Whatever form it takes, it should be linked bidirectionally to the map (tap a chore → highlight its place; tap a place → see its timeline). For the rollout specifically, the time/agenda view may matter *more* on day one than the map.

### 6.2 The map can work *against* the mobile/field goal
A pan/zoom 2D map is elegant on desktop/tablet but can be **more** friction on a phone — one-handed, in the sun, possibly gloved, standing next to the thing you want. Pinch-zooming to find the tractor you're touching is slower than a list.

**Implication:** the field-capture flow needs express lanes that bypass the map — search ("jump to CT3"), recents, deep links from notifications, and possibly a "you are here" shortcut (e.g. a QR sticker on each coop that opens straight to it). This is consistent with treating the map as desktop-first (§4.2).

### 6.3 "Accurate tractor positions" — nuance, not just a trap
The tractors **move** — that's the point of pasture rotation — so accurate positions are dynamic state with ongoing data-capture overhead. For plain **navigation**, a **schematic** layout (fixed slots, roughly arranged) is probably enough.

**But** accurate tractor positions are also a deliberate, long-planned feature in their own right — see §8 (tractor rotation planning). So decide this on two levels: *navigation* needs only a schematic, while the *rotation planner* genuinely wants real positions tracked over time. Don't dismiss accurate positions outright; scope them to the planner.

### 6.4 Scope & sequencing
A real zoomable map is closer to **rebuilding the app shell** than iterating it — but we want to start with Dad soon, and responsive chores/scheduling is needed regardless.

**Implication:** consider **decoupling**. Ship a responsive, Dad-friendly chores + scheduling experience first; treat the map as the declared north-star IA we migrate the shell toward. Don't let the map block the rollout it's meant to serve.

### 6.5 Variable / empty states
Tractor count changes by season/batch; brooders empty between batches. The map must gracefully show "empty," "3 of 5 active," etc. (This overlaps with the status-overlay opportunity in §5 — it's a strength if handled well.)

### 6.6 Map authoring
The layout shouldn't be hardcoded. Adding/moving an area or tractor as the real farm changes should not require code. Some lightweight authoring (place a node, name it, set its type) keeps the map honest over time. *(A concrete candidate path — author stable geometry in a vector tool, drive moving tractors as data — is captured in §9.2.)*

### 6.7 Accessibility & "just do the thing" fallback
Spatial-only navigation is a problem for accessibility and for fast task completion. Always keep a list/search path available as an alternative.

### 6.8 Offline-first capture & sync — **[PRIORITY]**
Nothing in the original framing addressed connectivity, but the core premise — data capture on phones, outdoors, on a rural property — means cell/Wi-Fi coverage cannot be assumed. This is flagged as a **priority** because it is a foundational, cross-cutting constraint, not a feature:

- **Offline-first capture.** Marking a chore complete or logging a note must work with no connection and reconcile later. The field flows (§4.1 Tier 1) effectively *must* be offline-capable, or the rollout fails on day one.
- **Sync & conflict.** Two users (James + Dad) may act against the same data while one or both are offline. We need a sync model and a conflict policy (last-write-wins? per-field merge? chore-completion is probably idempotent and safe; edits to the same event are not).
- **Architectural reach.** This shapes the data layer broadly (local store, queue, sync engine) and therefore should be a *going-in constraint* for the design session, influencing the data model rather than being bolted on after.

---

## 7. The two axes: place (the map) and time (the timeline)

The map is only **half** the UI puzzle. It owns the **place** axis. The **time** axis needs an equally intuitive, top-level pattern of its own — and finding it is as central to the design session as the map itself.

- **Place lens (the map):** orientation, exploration, status-at-a-glance, drill-down to context.
- **Time lens (the timeline):** the "what's happening, when" surface — what's due, overdue, scheduled, and how activity unfolds over time.

These are two views onto the same underlying data and should be tightly linked, not siloed.

### 7.1 Timelines as a concept (maybe a top-level entity)
There is always a need to represent activity visually **by time**, at several scopes:

- a **single day** — what's happening today (the daily agenda);
- a **single batch over a window** — all activity for a given broiler batch across a date range;
- the **full sequence** — all events in order, zoomed out.

"Timeline" may deserve to be a **top-level entity / lens**, not just a screen — a consistent pattern that scales from one day to a whole season, the same way the map scales from one tractor to the whole farm.

### 7.2 The open design problem
Just as the map needs an intuitive zoom/drill pattern for *place*, the timeline needs an equally intuitive pattern for *time* — one that handles "today," "this batch," and "everything in sequence" without fragmenting into three unrelated screens. **Hypothesis worth testing:** agenda/today-first for the rollout, with the map and the broader timeline as the home/shell we grow into.

### 7.3 Composable timelines (the core concept)
The leading idea for the time axis: instead of pre-building a fixed set of timeline *screens* (today / batch / season — the fragmentation §7.2 warns against), let timelines be **composed on demand** from any time-attributed data. A "new timeline" button puts a timeline on screen; the user searches for / points at what they want to visualize; the result renders on a time axis.

**The key decomposition:** a timeline = a **query** (what data goes on it) + a **renderer** (the time axis). These are separable concerns, and separating them is the unlock.

- This is why off-the-shelf React timeline libraries didn't help — they only solve the **renderer**. They answer "how do I draw a timeline," not "what goes on one and how do you assemble it." The composition half is ours to design.
- Composable timelines are **the same anti-arbitrariness move as the map.** The map replaced an imposed structure (the flat sidebar) with one that already exists (place). Composable timelines replace imposed structure (three hardcoded timeline screens) with whatever the user actually wants to see. Same instinct, applied to the time axis.

### 7.4 The composition unit should be a *lane*, not an event
Composing a timeline by clicking individual events one at a time doesn't scale ("all chores for Batch 7" = fifty clicks). The productive version: **clicking an item adds a lane defined by that item.**

- Click a **batch** → a lane showing its whole lifecycle.
- Click a **tractor** → a lane of its move history.
- Click a **chore type** → a lane of every occurrence.

So the unit you compose is a **series / criterion**, not a single dot. Two composition modes likely coexist:

1. **Add by criterion** ("everything *like* this") — the default, scalable gesture.
2. **Add specific items** ("these three, for comparison") — for ad-hoc analysis.

**Lanes also solve the recurring-events problem.** A recurring chore is *one lane with a rule*, not N dots:

- **Zoomed out:** the lane renders as a band / pattern ("daily").
- **Zoomed in:** it resolves into individual completable instances, each with its own done / skipped / late state.
- The **recurrence rule lives on the lane**; **exceptions/overrides live on the instances.** Much saner than scattering every occurrence onto a flat axis. *(Note: instance-level overrides on a recurrence rule are a known hard problem — see iCal RRULE — worth not reinventing from scratch.)*

### 7.5 Zoom switches the idiom (reconciling "zoomable" with "calendar-like")
Two requirements that are mildly in tension: the timeline should **zoom its time scale** in/out, *and* it should **behave like a calendar view** (with settable start/end dates). A calendar grid and a continuous timeline are **different idioms**, each best at a different scale — so let **zoom switch the idiom**:

- **Day zoom** → agenda / calendar-day view.
- **Week zoom** → column calendar.
- **Season zoom** → continuous, Gantt-like axis.

…the same way a maps app flips from streets → region → globe. "Set start/end dates" is then just **windowing** that same axis. This gives one control (zoom + window) instead of three disconnected views.

### 7.6 Two lenses, one interaction grammar
The payoff: the **map and the timeline become two zoomable lenses sharing one interaction grammar** over the same place-and-time dataset.

- Map zooms **farm → area → structure**.
- Timeline zooms **season → week → day**.
- A single fact (e.g. a tractor move) appears as a **position on the map** *and* a **lane entry on the timeline**.

This partially **dissolves the "how tightly are they linked" question** (§10 Q12): they're not two features that need wiring together — they're **two projections of one dataset** (filter by place → map; filter by query, arrange by time → timeline).

### 7.7 Timelines as saveable objects — and the Dad line
Composability is a **power feature**, and power features baffle non-technical users. The clean division (consistent with §4 Tier 1/2):

- **Composing** timelines is an **authoring** move — James, on the desktop workbench (Tier 2).
- **Dad never composes anything.** He opens **saved / pinned** timelines someone already built ("Today's rounds," "Batch 7").

This implies a timeline should be a **saveable, nameable object** (like a smart playlist / saved search), not just an ephemeral scratch surface. James's "persist filters while navigating the app" instinct is really **"pin this timeline as a dockable panel"** that stays on screen as you move around — a persistent HUD, which fits the RPG world-map framing.

### 7.8 Open hypothesis: a single "saved view" primitive
If a **timeline** is "a saved query + a *time* renderer," and the **map** is "a place-scoped query + a *spatial* renderer," then maybe there's **one underlying `saved view` primitive with two (or more) renderers.** Could be too grand, or could be the cleanest thing in the app. Worth a few minutes in the session to either adopt deliberately or consciously reject.

---

## 8. Tractor rotation planning (a long-planned feature)

"Accurate tractor positions" (§6.3) isn't just a navigation nicety — it's the visible tip of a feature I've wanted for a long time: an **interactive 2D rotation planner** for the broiler pasture. The goal is to lay out and manage a chicken-tractor rotation plan on a 2D representation of the pasture and its paddocks.

**Shared concerns with the farm map.** The map and the rotation planner overlap heavily and should be designed together:

- both need a **spatial representation** of the pasture/paddocks (a 2D layout, rendering, pan/zoom);
- both care about **where tractors are** — the planner *sets* positions over time; the map *shows* the current ones;
- a rotation plan is inherently **time-based** (a sequence of moves), so this is where the place axis and the time axis (§7) meet: the same move shows up as a position on the map and an entry on the timeline.

**[design-session]** Whether the rotation planner is *one feature with the map* or a *sibling that shares a spatial substrate* is an open question — but the two should not be designed in isolation.

---

## 9. Farm map base asset (v1 SVG)

A first version of the map artwork exists: **`farm-map_v1.svg`** (passed along with this doc). It is the geometric basis for the farm map — and notably it is a roughly **geographically accurate** parcel, not a schematic abstraction.

### 9.1 What's in the file
The SVG layers carry **semantic IDs** that name what each shape represents. Structure as authored:

- `Roads` — the road network bordering/crossing the property (off-property context + wayfinding).
- `Farm` — the overall parcel boundary.
- `Group` (the operational zones), containing: `House`, `Brooders`, `Pasture-A`, `Pasture-B`, `Pasture-C`, `Barn`.

So three implicit layers already: **context (Roads)** → **boundary (Farm)** → **zones**.

### 9.2 Why this matters for the design

- **Semantic IDs = entity hooks (bound, not derived).** Each path's `id` is the natural hook for click/drill-down, highlighting, and status badges. Crucially, the ID is *bound* to a place through an explicit registry rather than *being* the place's identity (see §9.4) — the layer is how a place is drawn and clicked, not where its data key comes from. Either way, the artwork already carrying these semantics is concrete evidence toward an **SVG (not canvas) rendering approach** (§10 Q8).
- **The layer stack is the zoom hierarchy.** Roads/Farm/Zones is the start of a layer model. The next layers to add are **structures** (individual chick tractors CT1–5, Brooder 1 / Mobile Brooder) that appear on zoom-in, and a data-driven **status overlay** (§5). The SVG currently stops at the zone level — structure-level geometry isn't in it yet.
- **Authored geometry resolves part of the schematic-vs-accurate tension (§6.3).** A natural split: **stable geometry** (parcel, roads, zones) is *authored accurately once* in a vector tool and exported as SVG; **dynamic positions** (tractors, which move) are *data-driven markers* placed on top — and those can be schematic slots. Accurate where it's cheap and stable, schematic where it's volatile.
- **A candidate answer to "authoring without code" (§6.6).** Stable geometry is authored in the vector editor (Pixelmator Pro) and re-exported. Caveat: that's *James's* authoring path, not Dad's — fine, since map geometry changes rarely. Tractor placement (frequent) still wants an in-app, data-driven mechanism, not SVG editing.

### 9.3 Things to reconcile / tidy
- **Place naming / canonical set — resolved (§9.5).** The asset's Pasture-A/B/C reconciles with the earlier "broiler / layer-A / layer-B" framing; the full place tree is now locked in §9.5.
- **Container group names are generic.** `Group-copy` and `Group` are default tool names; if the SVG becomes the live substrate, the container groups deserve semantic IDs too (e.g. a `context` group, a `zones` group).
- **No structure-level detail yet** (individual tractors/brooders). Decide whether those live as additional SVG layers, as data-driven markers, or both.

### 9.4 Place identity & the SVG↔domain binding (resolved)

**Decision:** place identity is **not** derived implicitly from SVG layer IDs. An **explicit registry** binds the artwork to the domain. Rationale: it gives a clear version-to-version **migration framework**, and the mapping code becomes an **artifact that documents** the SVG-layer → behavior relationship.

**Shape of the binding — two hops, not one:**
- Each place is a domain entity with a **stable, opaque surrogate identity** (an internal ID we control and never display).
- The **slug, display name, boundary, and behaviors** all hang off that surrogate — so renaming a place (for users) or renaming a layer (in the art tool) never churns the underlying identity or its data.
- The registry binds `SVG-layer-id → place-id`. Both the SVG ID and the human name are treated as **mutable presentation**; only the surrogate is load-bearing.

**Direction of dependency:** the **domain is the source of truth; the SVG is a presentation bound into it** — not the reverse. Consequences:
- **Unmapped layers are decoration.** `Roads` and `Farm` have IDs but are *not* navigable places; the registry simply doesn't bind them. (This is why an implicit "every layer is a place" rule was already wrong for v1.)
- A place can exist in the registry before it's drawn, and a layer can exist without being a place.

**Make the registry a validated invariant, not just a table.** A build/CI check asserts that every place resolves to a layer in the current asset — and, optionally, that every non-decorative layer is claimed by a place. Drift between artwork and domain becomes a **loud failure**, not silent breakage; and on an asset version bump (`v1 → v2`), the validation failures *are* the migration checklist.

**Caution — the only real failure mode:** a registry the code bypasses, or that nothing validates, rots exactly like implicit derivation, only more verbosely. The benefits hold only if the registry is **the single path the app uses to resolve a place** *and* the thing the validation checks. Load-bearing and validated, or it's theater.

### 9.5 Canonical place inventory (resolved)

The authoritative place tree (place → contents). This is the domain reference the rest of the design hangs off; the SVG (v1) currently draws only the zone level.

- **House**
- **Brooders**
  - Brooder 1
  - Mobile Brooder
- **Pasture A** *(broiler pasture)*
  - Chicken Tractors 1, 2, 3, 4, 5
- **Barn**
  - Feed storage
  - Sheep paddock
  - Machinery (excavator, backhoe, tractor)
- **Pasture B** *(layer pasture)*
  - Mobile Coops 1, 2
- **Pasture C** *(layer pasture)*
  - Mobile Coops 1, 2

**Implications worth carrying into the session:**

- **A→B/C maps to broiler→layer.** Pasture A holds the broiler **Chicken Tractors**; Pastures B and C hold layer **Mobile Coops**. This is the reconciliation §9.3/§2 were chasing — confirmed, not inferred.
- **"Contents" are not only chickens + chores.** The Barn holds **feed storage**, a **sheep paddock**, and **machinery**. So the place-contents model must accommodate non-poultry livestock, equipment/assets, and storage — not just bird batches and tasks. Worth confirming the full set of *thing types* a place can contain before the data model hardens.
- **Display names are not unique → reinforces §9.4.** "Mobile Coop 1" exists in **both** Pasture B and Pasture C; the brooder/coop/tractor numbering restarts per location. Identity must be **scoped to the parent place** (or carry an opaque surrogate) — a concrete vindication of the "don't let the human name be the key" decision.
- **The structure level is real and worth drilling to.** Tractors (5), Mobile Coops (2+2), Brooders (2) are the units a round actually visits — confirming the farm→area→**structure** drill-down (§2) bottoms out at named, batch-bearing units, not just zones.

---

## 10. Open questions for the design chat

1. What is the **default landing surface** at rollout — map, or agenda/today? (Strong case for agenda-first.)
2. Is the map **schematic** or **spatially accurate**? Do we ever track real tractor positions, and is that worth the capture cost? (See §6.3 / §8 — the answer may differ for navigation vs. the rotation planner.)
3. How do **cross-location / time-based** views coexist with the map? What's the linking model between them?
4. What are the **express lanes** for fast field capture on a phone (search, recents, deep links, "you are here," QR-at-coop)?
5. How does the map represent **variable and empty states**, and what **status overlays** do we want (overdue, needs attention, empty, healthy)?
6. ~~How do we **author/maintain** the map layout without code as the farm changes seasonally?~~ **Resolved (§6.6 / §9.2 / §9.4):** stable geometry authored in a vector tool + exported SVG; the explicit registry absorbs change; moving units are data-driven, not authored.
7. What's the **build sequencing** — does the map ship with v1 of the rollout, or after a simpler responsive shell?
8. ~~Rendering approach (SVG vs. canvas)~~ **Resolved → SVG-as-substrate (§9.4).** Still open within that: responsive behavior across breakpoints, and how zoom levels map to routes/deep links.
9. What does **Dad's day-one happy path** look like, end to end, on a phone, for a single chore? (Design around this concretely.)
10. What's the **top-level pattern for the time axis** (§7) — how does one "timeline" lens scale from today → batch window → full sequence without becoming three screens?
11. Is **"timeline" a top-level entity/lens**, peer to the map? If so, what's its primary navigation gesture (the time-axis equivalent of map zoom)?
12. How tightly are **map and timeline linked** — shared selection, a tractor move that appears in both, a scrub-time-to-update-the-map interaction? *(Note: the §7.6 "two projections of one dataset" framing may largely answer this.)*
13. Is the **rotation planner** part of the map feature or a sibling on a shared spatial substrate (§8)? What's the minimum version worth shipping?
14. Where is the **mobile/desktop line** drawn per feature (§4) — and which Tier-1 flows are the actual day-one rollout surface?
15. **Composition unit** (§7.4): confirm **lane (series/criterion)** over individual-event as the default. What exact gestures add a lane, and do we support both "by criterion" and "specific items" modes?
16. **Recurring events** (§7.4): how do we model recurrence on a lane vs. overrides on instances? Do we adopt an existing recurrence standard (RRULE-style) rather than rolling our own?
17. **Zoom-switches-idiom** (§7.5): confirm the idiom transitions (day = agenda, week = column calendar, season = continuous axis) and where the breakpoints sit. Is windowing (start/end) a separate control from zoom?
18. **Timeline as a saveable object** (§7.7): what's its lifecycle — name, save, pin/dock, share between users (James authors → Dad consumes)? What does a *pinned/docked* timeline do on mobile (drawer? collapsed?)?
19. **Single saved-view primitive** (§7.8): do we adopt one `saved view` primitive with multiple renderers (map / timeline), or keep them as separate features that merely share a data model? (Architectural fork — decide deliberately.)
20. **Map rendering / substrate** (§9): **Resolved** — SVG-as-live-substrate with an explicit ID↔place registry (§9.4). Remaining: the surrogate-key scheme, and the exact validation/CI mechanism that guards artwork↔domain drift.
21. ~~**Canonical place set**~~ **Resolved (§9.5):** the full place tree is locked; A=broiler, B/C=layer; per-location numbering means identity is place-scoped.
22. **Geometry vs. markers split** (§9.2): confirm authored-SVG for stable geometry + data-driven markers for moving tractors. Where exactly is the line, and how are structure-level layers (CT1–5, brooders, coops) added — more SVG, markers, or both?
23. **Offline-first & sync** (§6.8) — **[PRIORITY]**: what's the local store + sync model, and the conflict policy when James and Dad act against the same data offline? This is a going-in architectural constraint, not a later feature.

---

## 11. Design approach (how we'll run the session)

**North-star first, then work backwards to the MVP.** We design the *complete* feature comprehensively before scoping the rollout:

1. **Design the right feature.** Run down everything we think we want and don't want; apply critical thinking and creative problem-solving to develop what we believe is the genuinely *right* feature — not the convenient one.
2. **Let understanding grow.** Through that process our grasp of both the feature and the **business rules** that define it deepens, which in turn lets us tighten scope with confidence.
3. **Produce a robust feature requirements doc** as the output of the comprehensive design.
4. **Then work backwards to an MVP** that is appropriately scoped for the initial rollout.

**Why this order.** Doing the hard work up front means the **MVP is genuinely a subset of the north-star** — not a throwaway — and the **deliverable increments between MVP and the complete feature are already known**. Nothing here is frozen: the north-star can still change. But we commit to designing it fully before cutting it down.

*Consequence for this doc:* several items in §13 framed as "decide at the top" are, under this approach, **goals to resolve through comprehensive design and then use to tighten scope** — not gating pre-decisions. The genuine pre-session prerequisites are narrow: the domain inputs (now captured — §4.1, §9.5) and the priority constraint (§6.8).

---

## 12. Parking lot / explicitly not-now

- Spatially accurate **GPS** tracking of mobile units (distinct from the planner's planned/schematic positions in §8).
- Map authoring/editing UI (may be later than v1).
- Advanced status-overlay logic beyond a basic needs-attention signal.
- Full mobile parity for the interaction-heavy map, rotation planner, and timeline *composition* (Tier 2, §4.2 — render-safe on phones, not designed for them).
- Anything that delays the responsive chores + scheduling rollout.

---

## 13. Design goals to resolve (and then scope from)

*Under the north-star-first approach (§11), these are resolved through comprehensive design and then used to tighten the MVP cut — not gating pre-decisions. The two MVP-sequencing items below are deliberately deferred to the work-backwards phase.*

- Resolve the **time-axis pattern** — what the "timeline" lens is, and that it's a co-equal peer to the map (§7).
- Resolve the **composable-timeline model**: timeline = **query + renderer** (§7.3), composed by **lane** (§7.4).
- Resolve **zoom-switches-idiom** as the reconciliation of "zoomable scale" and "calendar-like" (§7.5).
- Resolve that a **timeline is a saveable/pinnable object**, with composition as a Tier-2 authoring move and Dad as a consumer of saved timelines (§7.7).
- Decide the **single saved-view primitive** question — adopt or consciously reject (§7.8).
- Resolve whether **rotation planning** is part of the map or a sibling on a shared spatial substrate (§8).
- Define the **offline-first & sync model** (§6.8) — **[priority]**, shapes the data layer.

**Already resolved going in:**
- **Session scope:** north-star-first (§11).
- **Map substrate (§9.4):** SVG with semantic IDs; explicit registry binds layer-id → opaque place-id (no implicit derivation), validated against the asset in CI; stable geometry authored, dynamic positions data-driven.
- **Canonical place inventory (§9.5).**

**Deferred to the work-backwards (MVP) phase:**
- **Default landing surface** — map vs. agenda/today (§10 Q1).
- **What ships in the rollout MVP** and the increments from MVP → complete feature.

*(The design goals above gate most of the rest of the design.)*
