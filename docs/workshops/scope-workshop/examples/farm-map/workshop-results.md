  Farm Map UI Overhaul — Workshop Synthesis

  1. What each agent contributed

  - Cutter — Collapse to one place tree; delete the duplicate spaces model; demote the map to an optional desktop skin over a flat, scannable place index; add just a location
  filter to the already-shipped Schedule rather than building a composable timeline. Sharpest warning: re-seeding sites geographically could break Rounds' kind-based "sweep all
  coops."
  - Maximalist — A recursive place tree with geometry + a polymorphic, time-windowed occupancy edge is a platform substrate: ambient status dashboard, a single Saved-View
  primitive with spatial/temporal/list renderers, the rotation planner as a map editing mode, multiplayer presence. Tiered it honestly — and flagged presence ("Dad is at Pasture
  A") as possibly creepy between father and son.
  - Data-model purist — The cleanest spine: recursive place + unit/placement supertypes + geometry-as-a-bound-row + RRULE/lazy-overrides + an append-only clocked mutation log
  feeding materialized place_status/round_today projections. Surfaced the concrete chore_completions-has-no-place defect and made the re-key its headline fix.
  - Field-ergonomics — The screen the farm runs on is the round, not the map. Land on "Now"; keep Rounds wholesale and wrap it in the offline outbox it currently lacks (today's
  toggle is a naked live call that reverts on error — i.e. silently un-ticks with no signal). Counted taps (1+12 for a clean round; 3–4 for a mortality) and warned mortality
  counts need additive merge, not last-write-wins.
  - First-principles — Strip the word "map" and the constraints force a place-tree + a now/next queue + an append-only fact log. The map is a legitimate desktop renderer of the
  tree, never the load-bearing primitive. Self-policed against reinventing field-service tools (Jobber/ServiceTitan open on today's jobs, not a property map) and named
  map-demotion as its one deliberate divergence.

  The headline convergence: four-to-five agents, working blind, independently landed on the same answer to a question your planning doc deliberately deferred — the default/field
  landing surface should be a time-anchored "Now/agenda" surface, and the map should be a desktop renderer/skin over a place tree, not "the main screen." Three of them
  independently re-derived "place and time are two projections of one dataset," and three independently re-derived the surrogate-key + geometry-as-binding place identity. That
  independent reinvention is strong validation of those pieces — and the map demotion is the loudest signal in the room, because it pushes back on your stated headline.

  2. Where they disagreed — and where I came down

  ┌─────┬──────────────────────────────┬───────────────┬─────────────────┬────────────────┬───────────────────┬──────────────────┬────────────────────────────────────────┐
  │  #  │      Contested question      │    Cutter     │   Maximalist    │   Data-model   │    Field-ergo     │ First-principles │                My pick                 │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────┤
  │     │                              │ No — list     │                 │                │ No — "Now"        │ No — "Now"       │ No. Phone lands on "Now" (unanimous).  │
  │ 1   │ Map = default landing?       │ index; map    │ Desktop yes;    │ Desktop yes;   │ agenda; map       │ board; map       │ Desktop default = "Now" too, map one   │
  │     │                              │ optional      │ phone no        │ phone no       │ desktop tool      │ desktop renderer │ click away (contested — see Q1/Q2)     │
  │     │                              │ desktop skin  │                 │                │                   │                  │                                        │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────┤
  │ 2   │ Phone field landing          │ Place list    │ "You are here / │ The round      │ "Now" agenda +    │ "Now" board      │ "Now"/Today: active-or-next round +    │
  │     │                              │               │  What's next"   │                │ Start-rounds      │                  │ due/overdue list (5-0)                 │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────┤
  │     │                              │ Yes (keep     │                 │                │                   │                  │ Yes (5-0). Keep                        │
  │ 3   │ Collapse the 2–3 place       │ sites, kill   │ Yes             │ Yes            │ Yes               │ Yes              │ sites/site_locations/site_residents;       │
  │     │ models → one?                │ spaces)       │                 │                │                   │                  │ delete spaces/space_kinds/space_items +    │
  │     │                              │               │                 │                │                   │                  │ free-text current_location                 │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │ Place tree: recursive or     │ Flat (re-seed │ Recursive +     │ Recursive +    │                   │                  │ Recursive (cheap parent_id; covers         │
  │ 4   │ flat 2-level?                │  geo)         │ geometry        │ supertypes     │ Flat (+ ordinal)  │ Recursive        │ Barn→Machinery→excavator + future          │
  │     │                              │               │                 │                │                   │                  │ paddocks) — but keep UI shallow (Q5)       │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │               │ Polymorphic     │ unit+placement │                   │                  │ Time-bounded occupancy edge generalizing   │
  │ 5   │ Heterogeneous contents       │ Rows hung off │ place_residents │  supertype, 1  │ Keep              │ Typed occupant,  │ site_residents (move history for free) — 3 │
  │     │ (birds/sheep/equipment/feed) │  location_id  │                 │ open placement │ site_residents    │ time-bounded     │  derived this independently                │
  │     │                              │               │ (time-windowed) │                │                   │                  │                                            │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │               │                 │ Yes — re-key   │                   │                  │                                            │
  │ 6   │ Fix chore_completions place  │ —             │ —               │ (chore_id,     │ One row per chore │ (facts carry     │ Yes. Verified defect; completion grain     │
  │     │ dimension?                   │               │                 │ place_id,      │                   │ place)           │ must carry place                           │
  │     │                              │               │                 │ date)          │                   │                  │                                            │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │ Map fidelity / track moving  │ Schematic;    │ Zone accurate,  │ Zone accurate, │                   │ Zone accurate,   │ Authored accurate zones; structures =      │
  │ 7   │ units                        │ positions =   │ structures      │  geometry as   │ n/a               │ structures pins  │ schematic pins; live position-tracking =   │
  │     │                              │ planner       │ schematic slots │ binding        │                   │                  │ rotation-planner only (5-0)                │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ Just a        │ Full Saved-View │ Saved filter   │                   │                  │ Saveable named filter/query over a unified │
  │ 8   │ Composable timeline          │ Schedule      │  primitive, 3   │ over unified   │ Desktop-authored, │ "Pin a filter"   │  occurrence stream (extends                │
  │     │                              │ filter        │ renderers       │ occurrence     │  phone reads      │ on Schedule      │ timeline_items); primitive-vs-feature fork │
  │     │                              │               │                 │ shape          │                   │                  │  → Q3                                      │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ Filter        │ Two renderers   │ Same rows      │ Place tags on the │ Same fact        │ One occurrence shape; place-filter = map,  │
  │ 9   │ Place↔time link              │ Schedule by   │ of one Saved    │ indexed two    │  Now list         │ indexed two ways │ time-filter = timeline (validated by       │
  │     │                              │ place         │ View            │ ways           │                   │                  │ M/D/P)                                     │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ (keep capture │ Outbox +        │ Append-only    │ IndexedDB outbox; │ Append-only      │ Append-only intent outbox; completions     │
  │ 10  │ Offline / conflict policy    │               │ per-place LWW + │ HLC log,       │  completions      │ facts;           │ idempotent; counts additive; field edits   │
  │     │                              │ offline-able) │  presence       │ per-field LWW  │ idempotent,       │ destructive      │ LWW-with-clock + activity-log audit. Don't │
  │     │                              │               │                 │                │ counts additive   │ edits need merge │  build full CRDT v1 (Q6)                   │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ Where map     │ Map editing     │ Sibling        │                   │ Renderer shares  │ Sibling sharing the place-geometry         │
  │ 11  │ Rotation planner             │ stops being   │ mode            │ sharing        │ n/a               │ the tree         │ substrate, not bundled into map v1         │
  │     │                              │ decorative    │                 │ substrate      │                   │                  │                                            │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │               │                 │ Materialized   │                   │                  │ Derived per-place status rollup            │
  │ 12  │ Status & empty states        │ One attention │ Ambient tint    │ place_status   │ Red-sorted Now    │ Flagged places   │ (cached/materialized) read by both map     │
  │     │                              │  dot          │ pipeline        │ projection     │ list              │ on Now           │ (tint) and Now list (sort). Basic          │
  │     │                              │               │                 │                │                   │                  │ "needs-attention" for v1                   │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ Kill as nav;  │ Kill; 3 anchors │ Kill;          │                   │ Kill;            │ Delete as primary nav; keep a thin desktop │
  │ 13  │ Current sidebar IA           │ thin admin    │  + Manage       │ admin/catalog  │ Kill; "everything │ settings/records │  admin/records drawer                      │
  │     │                              │ drawer        │ drawer          │ drawer         │  else" drawer     │  index           │ (Products/Orders/CRM/Comms/Resource-types) │
  │     │                              │               │                 │                │                   │                  │  — 5-0                                     │
  ├─────┼──────────────────────────────┼───────────────┼─────────────────┼────────────────┼───────────────────┼──────────────────┼────────────────────────────────────────────┤
  │     │                              │ Keep          │ Keep, becomes   │ Keep (one      │ Keep — it's the   │ Keep —           │ Keep wholesale; Rounds is the field spine, │
  │ 14  │ Shipped Chores/Rounds        │ wholesale     │ field backbone  │ re-key)        │ spine             │ most-validated   │  wrapped in the new offline layer (5-0)    │
  │     │                              │               │                 │                │                   │ piece            │                                            │
  └─────┴──────────────────────────────┴───────────────┴─────────────────┴────────────────┴───────────────────┴──────────────────┴────────────────────────────────────────────┘

  3. The unified pitch

  The model. One recursive place tree (place: opaque surrogate id, self-referential parent_id, stable code, mutable non-unique name, kind ∈ {farm, zone, structure, slot}, mobile
  flag). The three shipped place references collapse into it: evolve sites/site_locations/site_residents; delete the legacy space_kinds/space_items and the free-text
  livestock_groups.current_location. Identity is the surrogate — display names are mutable presentation, unique only on (parent_id, name), so "Mobile Coop 1" can exist in both
  Pasture B and C. The SVG binds through a separate geometry row (place_id → svg_layer_id + centroid/footprint); artwork is swappable, and unmapped layers (Roads, Farm) are
  simply decoration the registry doesn't bind. Everything a place contains — bird batch, sheep, excavator, feed lot — is a row in a time-bounded occupancy edge generalizing
  site_residents (occupant_type, occupant_id, place_id, from, to, one open row per occupant), so "coop moved paddock," "batch graduated brooder→tractor," and "excavator parked
  in barn" are one event type and move-history is free. Time is one unified occurrence shape (extend the existing timeline_items view that already unions events + chore runs);
  every dated fact carries a place_id (or fans to a subtree), so the map is WHERE place ∈ subtree and the timeline is WHERE time ∈ window over the same rows — that is the
  place↔time link, not glue between two features. Recurrence stays RRULE-series + lazy override occurrences (the events layer already does this). chore_completions gains a place
  dimension — its current (chore_id, completion_date) key (verified) can't represent per-tractor completion of a fan-out chore. Offline is an append-only intent outbox per
  device: completions/observations are commutative idempotent inserts (conflict-free by row-presence, which the model already is), mortality/counts merge additively, and genuine
  field edits use last-write-wins-with-a-clock backed by the existing activity log — the server stays system-of-record and realtime stays the merge path.

  The interaction model. The app opens on a "Now" surface — the active or next round as a fat primary button, then a farm-wide due/overdue list, each row tagged with its place
  and deep-linking straight into the round or place. This is the landing on phone (unanimous) and the recommended default on desktop (the 6am question is "what's overdue," not
  "show me the parcel"). The map is a first-class desktop view, one toggle away: the authored, geographically-accurate SVG zones tinted by a derived per-place status rollup;
  click a zone → zoom → structure pins (schematic auto-laid-out slots, since v1 art has no structure geometry) → a place page (current occupant/batch with age, chores due here,
  recent observations, "view on timeline"). The same place tree is reachable on phone as an indented list — map and list are two renderers of one tree. The field flow is the
  shipped Rounds takeover, kept wholesale and promoted to the primary phone path, now wrapped in the offline outbox it lacks; express lanes are search (disambiguating non-unique
  names as "Mobile Coop 1 — Pasture B"), recents, push deep-links into the active run, and a resumable run bar. Mid-round capture pre-seeds the place (a mortality at Tractor 3
  is 3–4 taps). The composable timeline is a saveable, named filter/query over the unified occurrence stream, composed on the desktop workbench and consumed read-only by Dad
  (saved/pinned views; Agenda on phone). The rotation planner is a sibling that draws real structure/paddock geometry on the same spatial substrate — not part of map v1.

  4. Risks (the honest part)

  1. The map demotion is a real bet against your stated headline. All five agents, blind, put a time-agenda first and made the map a desktop renderer. They optimized for ops
  efficiency — but if "flying over my farm" is half the point, this guts it, and Dad (who may navigate by picture, not words) is exactly the user who lands on a list instead.
  This is yours to override, not theirs.
  2. Geography axis vs. kind axis collide. Current sites are kind-grouped ("Mobile coops"); Rounds' Site Switcher filters by kind ("sweep all the coops"). Re-seeding into
  geographic zones scatters same-kind units across Pasture B and C, so "do all the coops" becomes multi-zone. The tree must carry both a geographic parent and a kind tag, and
  Rounds must group by either. Real migration + real UX tension.
  3. The cheap-render claims rest on a derived projection staying correct. "The map paints instantly" and "the round list is one query" depend on a materialized
  place_status/round_today projection kept in sync by triggers. If it drifts, the map lies — more moving parts than naive live queries.
  4. Offline conflict nuance is easy to get silently wrong. Completions are safely idempotent, but mortality counts need additive merge (two offline phones each logging "1 dead"
  must sum to 2, not overwrite to 1), and destructive edits need a real clocked LWW. Botching this loses Dad's data — the precise failure the offline priority exists to
  prevent.
  5. This is a schema-down change, not a view over what ships. Recursive places + occupancy supertype + completion re-key + collapsing the place models touches the live
  chores/Rounds tables. Migration is bounded (seed data is tiny) but it is not free, and a lighter "evolve sites in place" path exists (Cutter / Field-ergo).
  6. The abstract parts can balloon. The saved-view primitive, composable timeline, and ambient-status pipeline are the most likely to slip the rollout they're meant to serve.

  5. Things I'm explicitly NOT pulling forward

  - Multiplayer presence ("Dad is at Pasture A") — rejected for v1: thin value for two people, reads as surveillance (Maximalist flagged it himself).
  - Map time-scrubber / season replay, cross-batch forecasting lanes, voice capture, weather overlays, equipment auto-service triggers, auto-presence — deferred moonshots; each
  needs substrate (position snapshots / metrics registry / speech intent) that isn't here yet.
  - Full CRDT / HLC vector-clock sync — over-built for two users today (Data-model's own counter-pressure agrees); shape the log to grow into it.
  - The CI-validated SVG↔place registry invariant — adopt the binding shape now; the loud-failure build check is a later hardening step, not v1.
  - Cutter's "no timeline at all, just a filter" — too minimal; the unified occurrence shape + saveable filters earns its place. (But I'm not going full saved-view-primitive
  either — that's your call, Q3.)

  6. Open questions for you (decide before I draft the requirements doc)

  1. The map demotion — the big one. All five independently put a "Now"/agenda surface first and made the map a desktop renderer. Do you accept the map is not the default
  landing (at least on phone)? Or is "map as the main screen" a hard requirement you want kept even against the consensus?
  2. Desktop landing specifically. Even granting phone = agenda: should desktop open on the map (Maximalist, Data-model) or on the "Now" surface with the map one click away
  (Field-ergo, First-principles, Cutter)?
  3. Saved-view fork (your §7.8 territory). One unified "saved view" primitive with swappable spatial/temporal/list renderers — or keep map and timeline as separate features
  that merely share the occurrence data shape? Maximalist re-derived your primitive independently; the others stayed lighter.
  4. Geography vs. kind. Re-seed the place tree geographically (Pasture A/B/C, Barn) and keep a kind axis so Rounds can still "sweep all coops" across zones — or does kind
  grouping matter enough that geography stays secondary?
  5. Place-tree depth. Adopt recursive places now (future-proofs Machinery sub-items + rotation paddocks) or keep the shipped 2-level sites→locations + kind tags (cheaper, less
  future-proof)?
  6. Offline appetite. Pragmatic (idempotent completions + additive counts + clocked-LWW + activity-log audit) — or the heavier append-only-clocked log now? This sets how much
  you build before rollout.
  7. Composable-timeline ambition. The full "click any dated thing → compose lanes → zoom the scale → save it" vision, or the honest smaller version (saveable filters/pins over
  the existing Schedule)? The agents split hardest here.

  7. Proposed sequencing

  Per north-star-first (A5 / your §11), I'm deliberately not cutting an MVP or proposing batch order yet — that's the explicit work-backwards phase after you resolve the open
  questions and we lock the north-star requirements doc. (Doing it now would smuggle scope decisions into a design that isn't settled.) I'll hold the dependency skeleton until
  your decisions land.

  8. Push back on anything — the 3 places I'm least certain

  - The map demotion (Q1/Q2). The agents are unanimous, but they optimized for ops efficiency; your vision/emotional read of "the map is the app" is a legitimate override and
  only you can make it.
  - The recursive-places + occupancy-supertype + completion-re-key bundle (Q4/Q5). It's the "right" model per three agents, but it's the riskiest migration; the lighter
  evolve-sites-in-place path is defensible.
  - The saved-view primitive (Q3). Genuinely could be the cleanest thing in the app or an over-abstraction for two people — I don't have conviction either way.

  ---
  Running the Dad reserve-lens pass on this synthesis now — his read on whether the day-one field path is genuinely usable lands next, and then the seven open questions above
  are yours to call.

⏺ Agent(Reserve lens: Dad commentary) Opus 4.8
  ⎿  Done (1 tool use · 24.6k tokens · 23s)
  (ctrl+o to expand)

⏺ Dad's pass is in. Here it is, then a short orchestrator's note on what I'd fold in — and then it's your move.

  ---
  Reserve commentary — Dad (non-technical field operator)

  - Where the synthesis is right (from my angle): Opening on "Now" instead of the map is correct for me. When I pick up the phone in the morning I don't want to find my work, I
  want it handed to me — the next round as one big button, then what's due; I never have to know where something lives on a screen. And the offline layer is the single most
  important fix here: today if I tick a box behind the broiler pasture where there's no signal, it silently doesn't save and I have no way of knowing. That's a durable problem
  (I'll never see the failure), so saving-and-reconciling is exactly right.
  - What worries me most:
    - Two coops both named "Mobile Coop 1," told apart only by a faint "— Pasture B / — Pasture C" tag, is durable confusion, not first-use friction. Mid-round, gloves on, sun
  on the screen, I won't reliably know which one I'm standing next to. Logging a dead bird to the wrong tractor is a mistake I'll make more than once. The hidden ID is fine; the
  display leaning on me to remember which pasture a coop is parked at this week is a model I won't hold.
    - "Resume round" is hidden state now that the sidebar is gone. The current exit says the run "keeps going — rejoin from the sidebar," but you're deleting the sidebar. If I
  close the app for a phone call and a round is still ticking somewhere I can't see, I'll start a second one or assume the first died. The resume bar has to be loud, on the Now
  surface — invisible running state is exactly where I get stuck.
    - The "do all the coops spans two pastures" worry isn't my problem — don't optimize for it. I move by site→location anyway: everything at Pasture B, then walk to Pasture C.
  I don't do "all coops" as a category. (Counter-pressure applied: the synthesis already does the right thing; don't redesign it.)
  - One change I'd make: Make non-unique names self-disambiguating visually, not just textually — parent pasture as the bold, primary part of the row, and in mid-round capture
  show the pre-seeded place big at the top of the Note/Mortality tray ("Mobile Coop 1 · Pasture B") so I confirm where before I commit.

  ---
  Orchestrator's note — what I'd fold in (flagging, not silently absorbing)

  Two of Dad's points are compelling enough that I'd want to carry them into the requirements doc rather than leave them as commentary:

  1. Visual place disambiguation becomes a hard requirement, not a nicety. This strengthens the surrogate-key model (Q5) — the key is opaque, but the display must always render
  name + parent together (bold parent), and the mid-round capture tray must show the resolved place prominently before save. Cheap, and it closes the single most likely field
  error.
  2. The "resume round" affordance is a gap the synthesis created. By deleting the sidebar (where you currently rejoin a run), we orphaned the rejoin path. A persistent, loud
  "round in progress — tap to resume" bar on the Now surface is now a requirement, not an express-lane extra. Worth a quick check of what Rounds.jsx says today about exiting a
  live run before we finalize.

  And one point that moves a decision: Dad pushed back on the geography-vs-kind worry (Risk #2 / Q4) — he says he navigates by place (Pasture B, then walk to C), not by kind
  ("all coops"). That's the actual operator's mental model arguing for the geographic re-seed and against treating "sweep all coops" as load-bearing. It doesn't fully settle Q4
  (Rounds' Site Switcher is built around kind today), but it's real evidence from the one user who matters most.

  ---
  The workshop is complete. Your move.

  Five blind pitches → synthesis (decision table + unified design + risks) → Dad's reserve read. The strongest signal is the independent 5-way convergence that the map is a
  desktop renderer over a place tree and the field/default surface is a time-anchored "Now" list — which is the biggest pushback on your original headline, and the thing I'm
  least certain about on your behalf.

  I won't draft the north-star requirements doc until you weigh in. The seven open questions in §6 are the decisions only you can make; the three I flagged as least-certain (the
  map demotion Q1/Q2, the schema-migration bundle Q4/Q5, the saved-view primitive Q3) are where your answer changes the most downstream. Answer as many as you have conviction
  on — partial is fine, and "I want to argue with the map demotion" is a perfectly good place to start.

✻ Baked for 15m 56s
