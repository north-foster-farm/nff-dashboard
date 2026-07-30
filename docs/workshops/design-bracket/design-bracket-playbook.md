# Design Bracket — Playbook

**Purpose:** A reusable method for settling the **visual and interaction
design** of a feature by running several AI agents as competing designers,
each committed to a fixed design stance, across **two rounds** — cheap
wireframes first, then real coded hi-fi mockups for only what survives —
narrowing to one **Design** James can hand to a build.

**How to use this file:** Share it with Claude after a feature's **scope is
settled** (a Scope Document exists) and say "run the Design Bracket on
\<feature\>." Claude assembles the design brief, runs Round 1, gates it with
James, runs Round 2, and produces the Design. This document is the
operating manual; it is not specific to any one feature.

**Provenance & relationship to the Scope Workshop.** This is the **second**
of the two workshop methods in this `docs/workshops/` bundle. The
**Scope Workshop** (`../scope-workshop/scope-workshop-playbook.md`) decides
*what to build* — the model, the entities, what's in and out — and
deliberately leaves design questions open. The **Design Bracket** picks up
where it stops: it decides *what it looks like and how it feels to use*,
**within settled scope it does not relitigate.** Read that playbook first;
this one assumes its vocabulary (lenses, counter-pressure, blind parallel
agents, orchestrator-owned synthesis, the Dad reserve lens).

---

## 1. What this method is (and when to use it)

The Bracket pits **independent design executions against each other** and
runs them through an **elimination funnel**. Each agent gets the same
settled scope but a different **design stance** (a strong, named visual /
interaction bias). They work blind and in parallel, the same as the Scope
Workshop — but with three differences that define this method:

1. **Scope is fixed; only the design varies.** The model, entities, and
   what's-in-scope are *given* (the Scope Document is binding). Agents
   compete on layout, hierarchy, interaction, motion, density, and visual
   language — not on what the feature does.
2. **It produces artifacts, not prose.** Round 1 is wireframes; Round 2 is
   **running code** James can open and click. The deliverable is a thing
   you look at, not a pitch you read.
3. **It's a funnel, not a synthesis.** Four stances enter; cheap wireframes
   gate the field down to ~two; only those get built as expensive hi-fi
   mockups; one wins. The economic logic *is* the method: never build four
   coded mockups — wireframe four, build two, ship one.

**Use it when:** the scope is settled but the *look and interaction are
genuinely open*, the feature has real screens (not just a dialog), and the
design space is wide enough that one person's first instinct would
under-explore it. The Schedule feature is the canonical case — a dense,
multi-surface, field-and-desktop feature where the interaction model is
the whole ballgame.

**Don't bother when:** the screen is obvious, it's a small addition to an
existing surface with a settled pattern, or there's really only one
sensible layout. Use the existing design system directly and skip the
overhead.

---

## 2. The shape at a glance

```
  SCOPE DOC (binding) ──►  ORCHESTRATOR assembles the DESIGN BRIEF
                           (binding scope + hero screens + design system
                            + device tiers + real content + states list)
                                        │
                                        ▼
                 ROUND 1 — WIREFRAME-OFF   (4 stances, parallel, blind)
            ┌──────────┬──────────┬──────────┬──────────┐
            ▼          ▼          ▼          ▼
       Convention   Flow-first  Minimalist  Rethinker
       -follower
            │          │          │          │
            └──────────┴────┬─────┴──────────┘
                            ▼
              Each emits low-fi wireframes of every hero
              screen + key states, in the fixed format
                            │
                            ▼
              ┌─── THE GATE  (James + optional judge panel) ───┐
              │  Narrow 4 → ~2.  Pick winners and/or graft.    │
              │  Orchestrator writes the ROUND 2 BRIEF.        │
              └────────────────────────┬──────────────────────┘
                                       ▼
                 ROUND 2 — CODED HI-FI MOCKUP-OFF  (survivors only)
            ┌────────────────────┬────────────────────┐
            ▼                    ▼
       Direction A          Direction B     (each in its own isolated
       (coded mockup)       (coded mockup)   dir/route; uses real design
            │                    │            system + frontend-design)
            └─────────┬──────────┘
                      ▼
        FINAL JUDGING (James, + Dad reserve lens on the mockups)
                      │
                      ▼
                 THE DESIGN  =  the chosen mockup
                              +  a short decision spec (the build reference)
```

---

## 3. Roles

### 3.1 The orchestrator (Claude, in the main session)
1. Assembles the **design brief** from the Scope Document (§5–§6): binding
   scope, the **hero screens**, the **design system** the mockups must use,
   the **device tiers**, the **real content**, and the **states list**.
2. **Selects the design stances** (§7) — the ≤4 that produce the biggest
   *visual/interaction* spread for this feature; designates the rest (and
   Dad) as reserve judges.
3. Writes each agent's Round 1 prompt and dispatches them blind, in
   parallel (§8). Keeps handles.
4. Runs **the gate** (§9): presents the four wireframes to James (optionally
   with a judge-agent panel), captures what advances, and writes the
   **Round 2 brief**.
5. Dispatches Round 2 (§10): the surviving directions as **coded hi-fi
   mockups**, each isolated so they don't collide.
6. Runs **final judging** (§11), including the **Dad reserve lens** on the
   running mockups, and assembles **the Design** — the winning mockup plus
   a decision spec.

The orchestrator does *not* design. It frames, gates, judges, and writes
the spec. It owns the funnel; the agents own the pixels.

### 3.2 The design agents (parallel subagents)
Each one:
- Receives the same design brief + its one stance + the round's output
  format.
- Is told other agents run in parallel and blind, and James will see all
  outputs side by side — so it should **commit hard to its stance**, not
  hedge toward a safe middle.
- **Reads the real design system** (the components, `src/styles.css`/
  Tailwind theme, neighboring shipped screens) and the **real domain
  content** — no bluffing, no lorem ipsum, no inventing a component library
  that doesn't exist.
- Emits its artifact in the round's **mandatory format** (§12).

### 3.3 The judges (James, always; a judge panel + Dad, optional)
- **James** is the decider at both the gate and the final.
- A **judge-agent panel** (optional, for a crowded or close field) scores
  each entry against fixed criteria (§11) to give James a decision surface
  rather than four raw artifacts to eyeball cold.
- The **Dad reserve lens** (the non-technical operator) is the prototypical
  reserve judge — he never produces a design, but his read on the *running
  mockups* is exactly what you want before committing, since the field
  operator's comprehension is usually the deciding axis.

---

## 4. How the Bracket differs from the Scope Workshop (read this once)

| | Scope Workshop | Design Bracket |
|---|---|---|
| Decides | what to build (model, scope) | what it looks like + how it feels |
| Scope is | deliberately open | **settled, binding — not relitigated** |
| Lenses bias toward | scope/data/ontology | **visual/interaction/aesthetic** |
| Structure | spread → **synthesize all** | funnel → **eliminate to one** |
| Rounds | one | **two (wireframe → coded)** |
| Output | a Scope Document (prose) | **the Design (running code + spec)** |
| Reserve Dad | comments on the synthesis | judges the **running mockups** |

The shared DNA — blind parallel agents, named stances with
counter-pressures, the orchestrator owning the cross-cutting calls, the Dad
reserve lens, the no-buzzwords tone — carries over unchanged.

---

## 5. The inputs (gather before writing any prompts)

1. **The Scope Document.** Binding. The model, entities, decisions ledger,
   in/out scope, and completion criteria. The Bracket designs *this*; it
   does not reopen it. Point agents at it and say "treat as settled."
2. **The behavior detail.** The story set (or equivalent) — the acceptance
   detail for each screen, including the awkward states (overdue, man-down,
   offline, empty, conflict). Agents design the *real* behavior, not a
   happy-path sketch.
3. **The design system.** The exact components, tokens, and conventions the
   mockups must use so they read as *this app*, not a generic template:
   - the component directory (`src/components/`),
   - the Tailwind theme / global styles (`src/styles.css`),
   - two or three neighboring shipped screens to match
     (`src/pages/…`),
   - any prior mockups (`.ignored/*mockup*`).
4. **Device tiers.** Which surfaces are phone-field-first vs desktop-
   workbench, and the hard constraints on each (one-handed, gloves, sun,
   offline for the field tier).
5. **Domain vocabulary + real content.** Real chore names, real blocks,
   real places, the two real operators. No lorem ipsum — fake content hides
   real density and real overflow problems.

---

## 6. The design brief (assembled once, identical across agents)

Mirror the Scope Workshop's brief structure. The parts:

1. **Bracket framing** — "You are one of N designers in a Design Bracket on
   \<feature\>. N−1 others run in parallel and blind; James sees all outputs
   side by side. Commit hard to your stance." Plus the round (1 or 2) and
   what advances.
2. **SCOPE — BINDING, DO NOT REOPEN** — a tight digest of the Scope
   Document's model + decisions ledger, with a pointer to the full doc.
   State plainly: design questions are yours; scope questions are closed.
3. **HERO SCREENS** — the specific surfaces this Bracket competes on, named
   and bounded. You cannot mock "the whole feature" — pick the **2–4
   screens that carry the design**, the ones where the interaction model
   lives or dies. (For Schedule: the phone Today view; the desktop
   timeline/week workbench; the confirm + man-down moments; search-to-add.)
4. **STATES TO DESIGN** — the explicit list of states each hero screen must
   handle, including the ugly ones (empty/first-run, overdue, draft vs
   confirmed, man-down/conflict, offline/unsynced, dense/overflowing day).
   "Design the real states, not the happy path" is the single highest-
   leverage instruction in this brief.
5. **DESIGN SYSTEM TO USE** — the component/token/style pointers from §5.3,
   prefixed "read these; match this app; do not invent a component library."
6. **DEVICE TIERS & CONSTRAINTS** — the phone-vs-desktop split and the
   field constraints.
7. **REAL CONTENT** — the real names/blocks/places to populate with.
8. **TONE** (§13) and **OUTPUT FORMAT** (§12) and the universal bans.

---

## 7. The design stances (the four-lens default)

Each stance is a **named, committed design bias** with a starting belief, a
task, latitude, and a **counter-pressure** that keeps it from becoming a
caricature (same discipline as the Scope Workshop's lenses). These four are
the proven default set for a screen-heavy feature; swap or drop per the
feature (selection, below).

**1. Convention-follower — "Match the app; borrow the proven."**
- *Starting belief:* the best design is the least surprising one — it
  reuses this app's existing components and the patterns users already know
  from shipped products, so it needs no learning.
- *Task:* build the feature almost entirely out of the existing design
  system and established UI patterns; name the component or product pattern
  behind every screen; make it look like it was always part of the app.
- *Counter-pressure (internal):* don't cargo-cult. A borrowed pattern that
  fights the feature's reality (e.g. a calendar grid for a regenerable
  draft) is worse than none — say where the convention breaks and adapt,
  and match *this* app's system specifically, not generic Material/Bootstrap.
- *(Structural opposite: Rethinker.)*

**2. Flow-first — "The sequence of actions is the design."**
- *Starting belief:* the screen is judged by how the handful of high-
  frequency actions *flow* — tap-to-tap, state-to-state, the transitions
  and feedback between them. Layout serves the flow.
- *Task:* identify the core action sequences (glance → confirm → go; tick a
  chore; resolve a man-down) and design the motion, transitions, focus, and
  state-feedback that make them fast and obvious. Show the *between* states,
  not just static screens.
- *Counter-pressure (internal):* a slick flow that hides state, over-
  animates, or corrupts the model is a defect. The field/offline/glance
  constraints bound the flow — latency and one-handedness beat delight.
- *(Structural opposite: Minimalist on chrome; allied with Field-ergonomics
  thinking.)*

**3. Minimalist — "Less surface; ruthless restraint."**
- *Starting belief:* density is the enemy of a glanceable field tool; the
  best version shows the fewest elements that still do the job, with the
  most whitespace and the least chrome.
- *Task:* strip every screen to the irreducible; remove persistent controls
  in favor of on-demand inspectors; make the one thing that matters *now*
  the loudest thing on screen. Directly serves the scope's UI-density
  restraint constraint.
- *Counter-pressure (internal):* **defend the floor.** Restraint that hides
  a must-see state — man-down, draft-vs-confirmed, overdue, offline — has
  gone too far. Minimal ≠ feature-hostile; name what you refuse to remove.
- *(Structural opposite: Flow-first / Rethinker richness.)*

**4. Rethinker — "Challenge the obvious representation."**
- *Starting belief:* the default visual metaphor (a vertical agenda list, a
  calendar grid) may not be the best way to *see* this data; a different
  representation might make the day's shape, the conflicts, or the routine
  drift instantly legible.
- *Task:* propose a genuinely different visual/spatial model for the hero
  screens (a time-ribbon, a load-bar, a two-column now/next, a spatial day-
  shape) and show it beats the convention on a *named* axis.
- *Counter-pressure (internal):* novelty must **win on a real axis**
  (glanceability, tap-count, comprehension) and survive Dad. A novel look
  the field operator can't parse, or that costs far more to build for a
  marginal gain, fails — account for both.
- *(Structural opposite: Convention-follower.)*

### Reserve judges
- **Dad (non-technical operator)** — never designs; judges the running
  mockups for comprehension and field-readiness. Always heard when the
  feature has a field operator.
- Any stance not selected, plus a **Data/feasibility** reviewer if a
  Rethinker concept needs a "can this be built on the real schema" check.

### Stance selection (the orchestrator's first move)
1. **Select for visual/interaction spread**, not coverage — the ≤4 that
   yield the most genuinely different *looks and feels* for this feature.
2. **Guarantee one opposed pair** (Convention-follower ↔ Rethinker is the
   reliable one) so the field spans safe→bold.
3. **Drop the inapplicable.** If a feature has no room for a radical
   representation, Rethinker is weak — cut it or narrow it. If it's a
   restyle of an existing surface, Convention-follower may dominate and you
   want fewer, sharper stances.
4. **Cap at 4.** More makes Round 1 noisy and the gate harder; the funnel
   wants a clean 4→2→1.
5. **Show your work.** Tell James the roster + why before dispatching; he
   may override.

---

## 8. Round 1 — the wireframe-off

**Goal:** cheaply expose four genuinely different structural takes so the
gate can kill the weak ones before anyone writes polished code.

- **Fidelity bar: LOW and uniform.** Structure, hierarchy, layout, and the
  key interaction moments — **no color systems, no polish, no pixel-
  pushing.** The point is to compare *bones*, not skins. Enforce the bar:
  an agent that secretly hi-fis Round 1 has broken the funnel.
- **What a wireframe is here:** a labelled **ASCII/box layout** (or the
  lightest possible annotated HTML) of each hero screen, plus a short
  annotation of what each region is, how it behaves, and what changes
  between the required states. Mobile and desktop both, where the screen
  spans tiers.
- **Cover every hero screen and its hard states** — a wireframe that only
  draws the happy path is incomplete and judged as such.
- Dispatch all four blind and in parallel; each reads the design system and
  scope first.

---

## 9. The gate (narrow 4 → ~2)

The hinge of the method. After the four wireframes return:

1. **Optional judge panel.** Spawn a small panel that scores each wireframe
   against the §11 criteria and flags the standout move and the fatal flaw
   of each. Gives James a decision surface instead of four cold artifacts.
2. **James decides what advances.** Typical outcomes:
   - **Two head-to-head** — two strong, different directions both go to
     coded Round 2 (the default and usually best — keeps the competition
     alive where it's cheap to keep).
   - **One + grafts** — one lead direction advances, explicitly carrying
     named ideas grafted from the others.
   - **One synthesized direction** — the orchestrator merges the best of
     several wireframes into a single Round 2 brief (use sparingly; it
     spends the spread early).
3. **The orchestrator writes the Round 2 brief** capturing the decision:
   which direction(s) advance, the specific grafts, the must-fix notes from
   the gate, and any state that Round 1 underserved. This brief is binding
   for Round 2.

A wireframe that's all-around weak is eliminated; a wireframe with one
brilliant move but a broken whole survives only as a **graft**, not a
direction.

---

## 10. Round 2 — the coded hi-fi mockup-off

**Goal:** turn the surviving direction(s) into **real, viewable, clickable
mockups** good enough to decide on and to hand to a build.

- **Real code, real design system.** Actual HTML/CSS (or JSX matching the
  app), using the project's Tailwind theme, real components or faithful
  copies, real icons (`lucide-react`), real content. It must look and feel
  like *this app*. Invoke the **`frontend-design` skill** for the quality
  bar — distinctive, production-grade, no generic-AI-template aesthetic.
- **Self-contained and isolated.** Each direction builds in its **own
  directory/route** (e.g. `.ignored/<feature>/mockups/<direction>/`) — a
  standalone HTML file is the proven, low-friction form here (precedent:
  `examples/calendar-rail-mockup.html`). If agents edit shared files, give
  each its own **git worktree** so they don't collide. They must be openable
  **side by side**.
- **Design the states, interactively where it matters.** The required
  states (overdue, man-down, draft/confirmed, offline, dense day) must be
  *visible* — via toggles, multiple frames, or separate views — not
  described in a comment. The hard states are where mockups earn their cost.
- **Honest self-critique.** Each agent ends with where its mockup is weak
  and what it would cost to build for real.

If two directions advanced, this is a genuine head-to-head; if one, it's a
refinement pass to final fidelity.

---

## 11. Final judging → the Design

1. **James views the running mockups** side by side (the whole point of
   coding them).
2. **Dad reserve lens** judges the mockups for comprehension and field-
   readiness — bounded format, the same as the Scope Workshop's reserve
   round: where it's right, what confuses the operator, one change.
3. **Optional judge panel** scores the finalists against fixed criteria:
   - **Glanceability** — the day's shape / the key state read in one look.
   - **Tap-cost** of the high-frequency actions (field tier).
   - **State coverage** — does it handle overdue/man-down/offline/empty?
   - **Fits the design system** — reads as this app, low build cost.
   - **Comprehension** — can the non-technical operator parse it cold?
   - **Distinctiveness** — is it actually good, not just safe?
4. **The orchestrator assembles the Design:** the winning mockup **plus a
   short decision spec** — the concrete visual/interaction decisions
   (layout, hierarchy, the confirm gesture, the now-marker treatment, the
   man-down flow, the density rules), the named grafts pulled in from
   runners-up, and the open detail-level questions left for build time.
   That spec + the mockup is the build reference.

The Design does **not** silently absorb a losing mockup's idea — if a graft
is compelling, the orchestrator names it for James, who decides.

---

## 12. Mandatory output formats

### Round 1 — wireframe (every agent, exactly these headings)
```
## 1. The design in one line
(Your stance's core bet for this feature, one sentence.)

## 2. Wireframes
(Per hero screen: a labelled ASCII/box layout, mobile and desktop where it
spans tiers. Low-fi — structure only.)

## 3. The key interaction moments
(The 3–5 taps/transitions that define the feel; what happens, briefly.)

## 4. How it handles the hard states
(One line each: empty, overdue, draft→confirmed, man-down, offline, dense.)

## 5. The one bold bet
(The single thing this design commits to that the others probably won't.)

## 6. What it borrows / what it breaks
(Which existing components/patterns it reuses; where it departs and why.)
```

### Round 2 — coded mockup (every surviving direction)
```
## 1. What I built
(One paragraph + the path(s) to open. Which hero screens + states are live.)

## 2. What to look at
(The 3–5 things to notice — the design decisions made concrete.)

## 3. Interaction notes
(How the high-frequency actions feel; what's clickable vs faked.)

## 4. Where it's weak / real build cost
(Honest self-critique: rough edges, what's faked, what it'd cost to ship.)
```

Universal bans (both rounds): **no scope changes** (scope is settled — flag,
don't redesign the model); **no lorem ipsum** (real content only); **no
inventing components** that aren't in the system; **no bluffing** (read the
real files); **no happy-path-only** (design the hard states).

---

## 13. Tone & quality rules

- **No marketing buzzwords** ("seamless," "intuitive," "clean," "modern,"
  "polished") — show it in the artifact, don't claim it in prose.
- **Match this app, not a template.** The fastest tell of a bad mockup is
  that it looks like a generic dashboard kit. Use the real tokens, spacing,
  and components.
- **Real content, real density.** Populate with the real chores, blocks,
  and places; design the *full* day, not three tidy rows — overflow is
  where layouts fail.
- **Design the ugly states.** Empty, overdue, man-down, offline, dense.
  Happy-path-only is the single most common way a design hides its flaws.
- **Field reality bites first.** One-handed, gloves, sun, no signal bound
  the field tier — a design that ignores them loses regardless of beauty.
- **Lead with the artifact.** No preamble selling; the wireframe / mockup
  is the argument.

---

## 14. Quick-start checklist for the orchestrator

1. [ ] Confirm scope is **settled** (a Scope Document exists). If not, run
   the Scope Workshop first — don't design open scope.
2. [ ] Gather the five inputs (§5): scope doc, behavior detail, design
   system pointers, device tiers, real content.
3. [ ] Write the **design brief** once (§6): binding scope + **hero
   screens** + **states list** + design system + tiers + real content.
4. [ ] **Select the ≤4 stances** for visual/interaction spread (§7);
   guarantee one opposed pair; designate Dad + others as reserve judges.
   Tell James the roster and why.
5. [ ] Dispatch **Round 1 (wireframe-off)** blind, in parallel; enforce the
   low-fi bar and full state coverage (§8, §12).
6. [ ] Run **the gate** (§9): optional judge panel → James narrows 4 → ~2 →
   write the **Round 2 brief** (winners + grafts + must-fixes).
7. [ ] Dispatch **Round 2 (coded mockup-off)** for survivors only, each
   isolated, real design system, `frontend-design` skill, real states live
   (§10, §12).
8. [ ] Run **final judging** (§11): James views the mockups; **Dad reserve
   lens** + optional judge panel; pick the winner.
9. [ ] Assemble **the Design**: winning mockup + decision spec + named
   grafts + build-time open questions. Hand to build.

---

## 15. Adapting this to the Schedule feature (forward note)

When this method is pointed at the **Schedule** Design Bracket, the inputs
already exist, so prep is light:

- **Scope is fully settled** —
  `../scope-workshop/examples/schedule/5-scope-document.md`
  is binding (one `commitments` timeline, store-deltas-derive-the-draft,
  whole-day one-tap confirm, one-timeline-three-zooms, the versioned-capture
  substrate). Feed its model + decisions ledger as **closed**; the Bracket
  designs the surface, not the model.
- **Hero screens** (the §6.3 pick): the **phone Today view** (the field
  tier — highest value); the **desktop timeline + week workbench**
  (day/week/month zooms, the one-timeline render); the **confirm gesture +
  man-down/conflict moment**; and **search-to-add**. Four screens, the ones
  where the interaction model lives or dies.
- **States list** (the §6.4 must-haves): draft vs confirmed; now-marker +
  forward-focus dimming; overdue / should→must escalation; man-down +
  covering-person acknowledgment; offline / unsynced (`CloudOff`); the
  dense, overflowing real day; the rare empty-but-valid day.
- **Carried-in design questions** from the Scope Document §7: **buffer-
  config placement (BD23)** — James's lean is a reusable buffer-config
  component + a "bufferable" interface; the Bracket proposes the realization.
  Also **reservation as its own table vs rows in `commitments`** (a
  data-touching detail some stances may weigh in on). And **UI-density
  restraint (BD43)** — the live Minimalist ↔ Flow-first tension, and the
  reason S69 was deferred.
- **Design system to match:** `src/components/` (`PageHeader`,
  `CommandPalette`/`PlaceSearch` for search-to-add, `QuickActionsTray` for
  the quick-log tray, `BlockBadge`/`ChoreRemainingPill`/`BatchStatePill`
  for chips, `CalendarViews` for the existing event surface being absorbed),
  `src/styles.css` (Tailwind theme), and `src/pages/Rounds.jsx` +
  `Overview.jsx` as the neighbors to match. Prior mockup form:
  `examples/calendar-rail-mockup.html` (standalone HTML).
- **Device tiers:** phone = field-first (one-handed, gloves, sun, offline);
  desktop = the planning workbench (week/month composition, search, buffer
  config). The phone is the deciding tier — Dad's comprehension is usually
  the axis that picks the winner.
- **Stance note:** all four default stances apply cleanly here — Rethinker
  has real room (is a vertical agenda the best way to see a day's shape, or
  is a time-ribbon / load-bar better?), and Convention-follower ↔ Rethinker
  is the opposed pair. Dad is the essential reserve judge.

Everything else — blind parallel dispatch, the low-fi Round 1 bar, the
4→2→1 funnel, the gate, isolated coded mockups, the Dad reserve judging —
applies unchanged.
