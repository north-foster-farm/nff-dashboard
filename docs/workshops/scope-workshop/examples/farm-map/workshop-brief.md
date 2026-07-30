# Farm Map UI Overhaul — Workshop Brief (agent input package)

**What this is:** the input package for running the multi-agent design workshop (see `multi-agent-design-workshop-playbook.md`) on the Farm Map UI overhaul. It is *derived from* `farm-map-ui-overhaul-proposal.md` but is a different kind of document: the planning doc is our rich synthesis; this brief is shaped to feed a **divergence engine** without anchoring it.

**The core handoff principle:** the planning doc, in places, already did the workshop's job (it settled a timeline design and a place-identity model). Feeding settled conclusions to blind agents destroys the spread the method exists to produce. So this brief sorts the planning doc into:
- **Parts A–D → fed to every agent** (binding constraints, facts, raw requirements, open questions).
- **Part E → withheld from agents**, retained only as the orchestrator's reference for the synthesis step.

**How the orchestrator uses it:** assemble each agent's prompt from **Part A (shared context)** + **Part B (verbatim dump)** + **Part C (source list)** + **Part D (open questions)** + that agent's one lens + the mandatory output format. Never paste Part E into an agent prompt.

---

## PART A — Shared context block (feed to EVERY agent, identical)

### A1. Workshop framing
"You are participating in an N-agent design workshop on the Farm Map UI overhaul for NFF Dashboard. N−1 other agents are running in parallel from different angles; you cannot see them. James will read all pitches plus the orchestrator's synthesis and decide where to land."

### A2. Project & tech context
- React + Vite + Supabase (Postgres + realtime + RLS) + Tailwind v4.
- Two-person team: James + his dad. Real-time multi-user matters; they move around the property together.
- Repo at `/Users/james/Code/nff-dashboard`.
- Domain vocabulary — use the right nouns: **chicken tractor** (mobile bottomless pen on pasture), **brooder**, **mobile coop**, **pasture**, **paddock**, **broiler** vs. **layer**, **batch/cohort**.

### A3. The problem (why this workshop exists)
The current dashboard uses a conventional left-sidebar IA: a flat list of entity types; navigation by memorizing which screen something lives on. It imposes a structure unrelated to how the farm is organized, creates no meaningful hierarchy, has no intuitive wayfinding, was not designed to be responsive, and will be a friction point for a non-web-native operator (Dad). UI changes are required before rollout regardless of the solution chosen.

### A4. The premise & goals (binding — but the *solution* is open)
Binding goals (do not relitigate these):
- Replace the arbitrary sidebar IA with navigation that mirrors how the farm is actually organized and operated.
- **Place and time are both first-class axes and must be linked** — neither alone is sufficient. (Place: "what's going on at X." Time: "what's due / overdue / scheduled.")
- Navigation should bottom out at real, named, batch-bearing units (farm → area → structure → batch is a genuine containment hierarchy).

The **leading proposal** James is committed to is a **2D farm map** navigated like an RPG world map (zoom/drill-down through places), plus a co-equal time surface. Treat the map as the strong default direction — but you are permitted to argue for a different realization of the *goals* above if your lens produces a genuinely better fit. Don't discard the goals; do feel free to challenge the mechanism.

### A5. Hard constraints (binding)
- **Responsive tiering.** Tier 1 (robust mobile/touch, used outdoors): the field flows — conducting rounds, referencing schedules/metrics, basic edits, notes. Tier 2 (desktop "workbench," render-safe on phones but not designed for them): the interaction-heavy map, dense planning/authoring, and timeline *composition*. The map is desktop-first; the field experience leans on list/form/round-shaped flows.
- **Offline-first capture & sync — PRIORITY.** Data capture happens on phones, outdoors, on a rural property; connectivity cannot be assumed. Field flows must work offline and reconcile later. Two users may act against the same data while offline → a sync model and conflict policy are required. This shapes the data layer broadly; treat it as a going-in architectural constraint, not a later feature.
- **North-star-first.** Design the *complete* feature comprehensively. **Do NOT scope an MVP and do NOT propose build sequencing** — that is the orchestrator's job, done after the design is settled. Your job is the right feature, fully thought through.

### A6. Binding facts
- **Canonical place inventory** (authoritative; the map's v1 art draws only the zone level):
  - **House**
  - **Brooders** → Brooder 1, Mobile Brooder
  - **Pasture A** *(broiler)* → Chicken Tractors 1–5
  - **Barn** → Feed storage, Sheep paddock, Machinery (excavator, backhoe, tractor)
  - **Pasture B** *(layer)* → Mobile Coops 1, 2
  - **Pasture C** *(layer)* → Mobile Coops 1, 2
  - Note: place "contents" are **not only chickens + chores** — they include other livestock (sheep), equipment/assets (machinery), and storage (feed). Display names are **not globally unique** ("Mobile Coop 1" exists in both Pasture B and C).
- **A v1 map asset exists** (`farm-map_v1.svg`): a roughly **geographically accurate** parcel (not a schematic), with **semantic layer IDs** (Roads, Farm, House, Brooders, Pasture-A/B/C, Barn). It currently stops at the zone level — no structure-level geometry (individual tractors/coops/brooders) yet. Roads and Farm are context/boundary, not navigable places.
- A round = completing all chores in a **scheduled time-block** (e.g. Monday's first block at sunrise); the chores are scattered across places, so a round is a time-driven traversal of places.
- **A place model already ships.** The app has "Sites" (a parent location with named child locations) and "Spaces" (kinds + instances, with current residents), plus a shipped chores overhaul (sites/blocks/runs/run-events). The map may well be a spatial *view* over this existing model — but it doesn't have to be. Designs must *account for* what exists and the cost of changing it; they are free to evolve or replace it on merit (see A9). The *identity/representation* specifics are an open question (Part D, Q7); detail in Part C.

### A7. Tone
No marketing buzzwords ("seamless," "intuitive," "powerful," "robust," "next-gen"). Plain English, concrete examples, lead with the model not the pitch. Get the domain nouns right.

### A8. Out of scope (parking lot — don't design these now)
GPS tracking of mobile units; full mobile parity for the interaction-heavy map / rotation planner / timeline composition; advanced status-overlay logic beyond a basic needs-attention signal; anything that delays the eventual responsive rollout. (The rotation planner itself is a known future feature that shares the map's spatial substrate — fair to reference, not to fully design.)

### A9. Nothing is sacred (latitude)
Understanding the real surfaces (Part C) is mandatory — designing in ignorance of what ships today is disqualifying. But **no existing code, feature, or past decision is sacred.** This app is continuously evolved; "it already exists" is never, on its own, a reason to keep something. You may keep, reshape, or delete anything — the Sites/Spaces place model, the entire sidebar IA, the recently shipped chores/Rounds work — **as long as the change is justified on merit.** Account honestly for migration cost (it's a real input to the judgment, not a veto), but don't let sunk work distort the design. Shipped code is fair game.

---

## PART B — Verbatim requirements dump (feed verbatim; do not clean up)

*These are James's own words on the two halves of the idea. The mess is signal. (Reconstructed from the originating conversation — James, swap in your original notes if you have a fuller version.)*

> The main screen should be a 2D map of the farm that works like a world map in an RPG. At max zoom-out it shows each area of the farm (brooders, broiler pasture, barn, layer pasture A, layer pasture B, house, etc.). Each area is clickable; on click we zoom into the area and see more detail — in Brooders, Brooder 1 and Mobile Brooder; in broiler pasture, Chick Tractors 1–5, maybe with accurate positions. Within an area view we should be able to interact with the chores, animals, projects, etc. contained inside. Same when drilling into a single brooder or tractor — more info about the specific batch, chores for that location, and so on. The sidebar "list of stuff" doesn't map to how we actually organize and operate; this does.

> For the time axis: what if we could compose timelines on any screen by clicking any item with a time or date attribute? A "new timeline" button puts a timeline on screen and lets the user search for whatever they want to visualize. The parameters/filters could be saved and persisted on screen while navigating around the app. The main concept is a "composable timeline." Also, the timeline should be able to zoom the time scale in and out (recurring events make this complex), and let you set start and end dates — basically behave like a calendar view.

---

## PART C — Source material to read (each agent reads these to verify reality)

Prefix: *"Do not skip — verify reality, do not trust this brief's summaries. Do not bluff. Read the actual files."*

Paths below are verified against the repo at `/Users/james/Code/nff-dashboard`.

**The IA being replaced**
1. `src/sections.jsx` — the entire current sidebar IA, declared as data (groups: Planning, Products, Sales, Events, Animals, CRM, Communication, Resources, Other). This *is* the flat-list structure the map is meant to replace; read it first.
2. `src/App.jsx`, `src/main.jsx` — app shell / routing / layout wiring.
3. `src/components/` — shell pieces (look for the sidebar/nav and the Rounds "takeover" renderer referenced in `sections.jsx`).

**The rollout surfaces (what the new IA must carry)**
4. `src/pages/Overview.jsx` — the dashboard "single-glance state of the farm."
5. `src/pages/Schedule.jsx` — "calendar and timeline view of everything date-bound" (the existing time-axis surface — directly relevant to the time-axis question).
6. `src/pages/Chores.jsx` and `src/pages/Rounds.jsx` — the chores model and the full-screen field "Do rounds" takeover (the canonical field flow).
7. `src/pages/Observations.jsx` — notes/mortality/cohort-moves/infra sweeps logged from Rounds.

**The existing place model (read closely — partially pre-empts the place-identity question)**
8. `src/pages/SitesPage.jsx` and `src/pages/Spaces.jsx` — there is **already a places model**: "Sites" (a parent location with one or more named child locations) and "Spaces" (kinds + instances, with current residents). The map could be a spatial *view* over this existing model — or a reason to change it. Understand it and weigh the cost of changing it; you're free to evolve or replace it if justified (see A9).
9. `src/data/` — seed data for sites/spaces/chores/etc. (the real shape of the data; the Reframer-style "what does the data say" check lives here).

**Schema**
10. `supabase/migrations/` — current schema. Note `0009_chores_overhaul_foundation.sql` through `0012_chore_assignment_rules.sql`: **the chores-overhaul workshop already shipped** (sites, blocks, runs, run-events, push, assignment rules). `0003_reference_lookups.sql` and `0004_livestock_feeds_chores.sql` hold earlier place/livestock structure.

**Plan / roadmap**
11. `ROADMAP.md` (repo root) — shipped + upcoming, including the rotation planner and broiler tracker as future surfaces the map should accommodate.

**Reference only (with caveat)**
12. `farm-map_v1.svg` (provided as an upload; not yet committed to `public/`) — the v1 map asset; inspect its layers/IDs.
13. `farm-map-ui-overhaul-proposal.md` — REFERENCE ONLY. Use it for the *problem, constraints, facts, and open questions* (Parts A/D here). **Do not treat its §7.3–7.8 or §9.4 as decided** — those are deliberately withheld (Part E) so you can solve them fresh.

*(Not available to agents: the original 22-batch plan dump lives under the user's home `~/.claude/`, outside the readable project directory — don't promise it as a source.)*

---

## PART D — Open design questions (each agent should take a position)

*Stated neutrally, leanings stripped. These are the live decisions; every pitch should land somewhere on each that's relevant to its lens.*

1. **Default landing surface** — the map, a time/agenda surface, or something else?
2. **Map fidelity** — schematic (fixed slots) vs. spatially accurate; do moving units (tractors/coops) have tracked positions, and is that worth the capture cost?
3. **Place ↔ time coexistence** — how do cross-location, time-based views (what's due/overdue across the whole farm) live alongside a place-based map, and how are the two linked?
4. **Field express lanes** — how does someone capture data fast on a phone, in the field, possibly bypassing the map (search, recents, deep links, "you are here," etc.)?
5. **Status & empty states** — how does the map/home surface convey state (overdue, needs attention, empty between batches, "3 of 5 active")?
6. **Time-axis pattern** — what is the top-level pattern for time, and how does it scale from one day → one batch's window → a whole season without fragmenting into unrelated screens?
7. **Place identity & data model** — how are places, their varied contents (birds, sheep, equipment, storage), and moving units modeled and identified, given non-unique display names and a farm layout that changes over seasons? *(Open — design it fresh.)*
8. **Rotation planner relationship** — is the broiler-pasture rotation planner part of the map feature or a sibling sharing a spatial substrate?
9. **Non-technical operator (Dad)** — what makes the day-one field path genuinely usable by someone not accustomed to complex web apps?

---

## PART E — WITHHELD from agents (orchestrator reference ONLY)

**Do not paste any of this into an agent prompt.** This is the planning doc's *provisional* design thinking — my prior solo analysis, not James's decisions. It is withheld to preserve spread, and retained here so the orchestrator can compare the workshop's independent output against it during synthesis (independent reinvention = strong validation; nobody landing near it = reconsider).

- **Composable-timeline design (planning doc §7.3–7.8):** timeline = query + renderer; the composition unit is a *lane* (series/criterion) not an event; recurring events modeled as a lane with a rule (band when zoomed out, instances when zoomed in); zoom-switches-the-idiom (day = agenda, week = calendar, season = continuous axis); map + timeline as "two zoomable lenses, one interaction grammar / two projections of one dataset"; timeline as a saveable/pinnable object; the single "saved-view primitive" hypothesis.
- **Place-identity design (planning doc §9.4):** explicit ID↔place registry (no implicit derivation from SVG IDs); two-hop binding through an opaque surrogate key; domain-as-source-of-truth with unmapped layers as decoration; registry as a CI-validated invariant.

**For the synthesis only:** the "what \<recent shipped work\> becomes" pitch section should target **the current sidebar IA** (and any in-flight rollout work) — i.e., each agent says what happens to the sidebar/navigation under their design.

---

## PART F — Lens selection (decide at run time; recommendation)

Per the playbook's selection step, pick the ≤5 lenses that maximize spread for *this* problem. Working recommendation:

- **Run:** **Cutter** and **Maximalist** (core less/more axis); **Data-model purist** and **Field-ergonomics** (schema-first vs. interaction-first — directly relevant given the offline/sync priority and the open place-identity question, and a clean opposed pair).
- **Possibly run / possibly omit:** **First-principles** (strong if you want the map premise itself pressure-tested; opposed by UI Conventions if you also run that).
- **Likely omit:** **Reframer** — the place/time reframe *is* the premise here, so there's little ontology left to overturn (or repurpose it narrowly as a "place-axis vs. time-axis" specialist).
- **Reserve (comment on synthesis, no pitch):** **Dad** — the rollout's whole point is a non-technical operator, so his read on the synthesis is high-value, but a full Dad pitch is too narrow.

Finalize the roster against the problem, show James the picks + reasoning, then dispatch.
