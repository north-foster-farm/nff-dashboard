# Schedule Feature — Scope Workshop Brief (agent input package)

**What this is:** the input package for running the multi-agent design
workshop (see `../design-workshops/multi-agent-design-workshop-playbook.md`)
on the new **Schedule** feature. It is thin packaging around two content
artifacts that already exist:

- `verbatim-requirements.md` — James's raw, unedited brain-dump (the seed).
- `story-set.md` — the **fully-reviewed** user-story + boundary-story set
  (S1–S129, BD1–BD44). Per the playbook §13, **the reviewed story set IS
  the behavior description** — we deliberately did NOT write a separate
  synthesized spec, because a polished synthesis pre-settles decisions and
  dulls the lens spread. Agents read both; the open questions stay open.

**How the orchestrator uses it:** assemble each agent's prompt from
**Part A (shared context)** + **Part B (verbatim + story-set pointers)** +
**Part C (source list)** + **Part D (open questions)** + that agent's one
lens + the mandatory output format (playbook §9). There is no withheld
"Part E" prior-design for this feature (see Part E note).

---

## PART A — Shared context block (feed to EVERY agent, identical)

### A1. Workshop framing
"You are participating in a **6-agent** design workshop on the new
**Schedule** feature for NFF Dashboard. Five other agents are running in
parallel from different angles; you cannot see them. James will read all
six pitches plus the orchestrator's synthesis and decide where to land.
Commit hard to your lens — do not hedge toward a balanced answer; the
other lenses supply the balance."

### A2. Project & tech context
- React + Vite + Supabase (Postgres + realtime + RLS) + Tailwind v4.
- **Two-person team:** James + his dad ("Dad" / "Jim"). Assignees are
  hardcoded strings `"James"` / `"Jim"` — there is NO users/roles/
  permissions system and none is wanted (BD29).
- Repo at `/Users/james/Code/nff-dashboard`. App is **LIVE in production**
  with real data — but this workshop is design-only (no code, no
  migrations here).
- Domain vocabulary — get the nouns right: **chicken tractor** (mobile
  bottomless pen on pasture), **brooder**, **mobile coop**, **pasture**,
  **paddock**, **broiler** vs **layer**, **batch/cohort**, **round** (all
  chores in one scheduled time-block), **block** (a named time-of-day
  chore window, e.g. sunrise/first block).

### A3. The problem (why this feature exists)
There is a missing concept **between "chores"** (the generative engine —
what recurring work is due, with must/should + windows) **and the
"calendar"** (the temporal list of clock-anchored events). Today nobody
ever sits down and *agrees* "here is today's actual plan: these chores, in
this order, plus we're power-washing today for reasons X/Y/Z, around this
appointment." Chores string through the whole day with no agreed shape;
there's no durable record of what was planned vs what happened. The
Schedule is that missing **commitment / junction layer**: a **day-atomic
plan** (with week/month views) that composes chores + project work +
events into one **draft**, which the operators **confirm**. "Do chores"
on the phone is great but must be *married* to a "today's schedule" that
says what we're doing and in what order.

### A4. The premise & goals (binding — the *solution* is open)
Binding (do not relitigate):
- The Schedule is **day-atomic** with **week + month** views.
- The day starts as an **auto-populated draft** (from chores + projects +
  events) that operators **confirm** — review a plan, don't build one.
- It is a **thin junction / commitment layer**, NOT a new source of
  truth. It references chores/projects/events; it never redefines them.
  A hard goal James stated: *stop "chores" from getting any bigger* (it
  "feels like a classic Law-of-Demeter violator") and *create a
  fundamental LINK between concepts without being a leaky abstraction
  that poorly wraps several complex domain objects.*
- Accountability here = **time / routine** (start time, overrun, did the
  day's shape hold), explicitly **NOT** per-person leaderboards or
  who-did-more-chores (BD30).

The **leading direction** is the day-plan-with-draft→confirm described in
the story set. Treat it as the strong default — but you may argue for a
different *realization* of the goals above if your lens produces a
genuinely better fit. Don't discard the goals; you may challenge the
mechanism.

### A5. Hard constraints (binding)
- **Thin junction, regenerable draft.** The schedule stores only
  **reference + placement + commitment + reason + protection flag** —
  never a copy of source content (BD17). The draft is **regenerable**:
  clear it and it rebuilds from the same sources (S21). Confirming records
  *agreement + deltas*, not a frozen copy (BD18). Instance overrides are
  scoped to the schedule and never leak back to a source's global
  definition (BD19) — stretching one chore block an hour today must not
  change global block durations (S64).
- **No silent mutation of sources / no implicit side-effects** (BD20,
  BD44 — a global project preference). The only writes-back are the
  explicit **event this/all-future** edit and **chore completion**.
  Committed data never changes as a side effect of a refresh or new
  session; a source change affecting a **confirmed** day is *surfaced +
  prompted*, never auto-applied. (Showing genuinely-updated live data,
  74°→75°, is fine; an unconfirmed draft defined as a live view is fine.)
- **Field + offline-first.** Dad uses this one-handed on his phone, in the
  field, possibly offline; ticking a chore done must sync through the
  existing offline outbox (`src/lib/outbox.js`). The day must be legible
  as a glanceable checklist, not just an editor.
- **North-star-first.** Design the *complete* feature. **Do NOT scope an
  MVP and do NOT propose build sequencing** — that is the orchestrator's
  job after the design is settled.

### A6. Binding facts (already verified — don't re-discover, but DO read)
- **Events already have this/all-future split.** `EventScopePrompt.jsx` +
  `useEventSeries.splitSeries` ship today. Pulling an event onto a day =
  editing the event via this/all-future, never an un-persisted schedule
  tweak (S31, S67, BD7).
- **Overview already merges chores+events+projects** into a day timeline
  via `buildTimelineItems` (`src/pages/Overview.jsx`) backed by a
  `timeline_items` SQL view (migration `0013_events_foundation.sql`) and
  `src/lib/data/useTimelineItems.js`. The Schedule must **replace or
  absorb** this, not run a second competing day-timeline (BD15).
- **Project hierarchy** = project → phase → step → checklist-item, with a
  **global persistent `sort_order`** that IS the priority order
  (`useProjects.js`). Scheduling a low-priority project for today must
  never change that global order (S29, BD11). You can add **any level**
  (project / phase / task / bullet), and adding a node adds **only that
  node** (S30, S35).
- **No availability / time-off / per-person-capacity system exists yet** —
  the Schedule introduces non-work time (days off, appointments, breaks,
  projects-only window) from scratch (Epic D).
- **Default is two-up:** both James and Jim are assumed available each day
  unless explicitly marked off (S128).
- **The old events surface is `src/pages/Schedule.jsx`** and gets **renamed
  Calendar** under this feature. The new feature takes the name
  **Schedule**. James hopes the workshop/Bracket identifies the overlap
  between Calendar and the new Schedule and says whether they consolidate
  (open question, Part D).
- **Chores are mid-rebuild.** Migrations `0029_chores_rebuild_foundation`
  (and a *shelved* `0030_chore_activities`) are in flight; the chore model
  is `chore_definitions` / `chore_blocks` / `chore_runs` /
  `chore_completions` / `chore_modifiers` / `chore_assignment_rules`.
  Treat the chore engine as "emits due candidates with must/should +
  windows + anchors"; the Schedule reads those, never adds scheduling
  fields to `chore_definitions` (BD3).
- **`activity_log` is poorly named** (it's really the observations/notes
  feed) and is slated for an eventual rename — which is why the
  parent-concept word "activity" is NOT yet safe to hard-code (BD24).

### A7. Tone
No marketing buzzwords ("seamless," "intuitive," "powerful," "robust,"
"next-gen"). Plain English, concrete examples (name the real chore, the
real block, the real failure on the real farm), lead with the model not
the pitch. Get the domain nouns right.

### A8. Out of scope (parking lot — named so scope-creep dies; don't design)
Two-way Google Calendar sync (push-only stays); weather-aware
scheduling; travel-time / "leave-by" routing; season-template libraries;
a visual automation/rule builder (automations stay code-seeded);
customer-facing event pages / RSVP; voice/NL entry; any
resource-leveling solver or per-person hour-budget math beyond
availability + conflict flags (BD26, BD31–37).

### A9. Nothing is sacred (latitude)
Reading the real surfaces (Part C) is mandatory — designing in ignorance
of what ships today is disqualifying. But **no existing code or past
decision is sacred.** "It already exists" is never on its own a reason to
keep something. You may keep, reshape, or delete anything — Overview's
`buildTimelineItems` timeline, the events `Schedule.jsx` surface, the
recently-shipped chores rebuild / Rounds / quick-log work — **as long as
the change is justified on merit and respects the binding constraints in
A4–A5.** Account honestly for migration cost; don't let sunk work distort
the design.

---

## PART B — Source requirements (read verbatim; do not summarize)

Two files, both in `.ignored/schedule-feature/`:

1. **`verbatim-requirements.md`** — James's raw brain-dump. The mess is
   signal (the half-formed "what is the parent concept?" musing, the
   should→must power-wash example, the naming gymnastics). Read it whole.
2. **`story-set.md`** — the fully-reviewed story set (S1–S129 + BD1–BD44),
   organized into Epics A–L plus a boundary-story block. **This is the
   curated behavior description** — your single best map of what the
   feature is and is not. Walk it. Where it notes a "(Open: …)" or defers
   to "the Bracket," that decision is genuinely live — take a position
   from your lens; don't treat the note as settled.

---

## PART C — Source material to read (verify reality; do not bluff)

Prefix: *"Do not skip — verify reality, do not trust this brief's
summaries. Read the actual files. Do not bluff."* Paths verified against
the repo.

**The surfaces this feature composes / collides with**
1. `src/pages/Overview.jsx` — `buildTimelineItems`, the existing day
   timeline the Schedule must absorb or replace.
2. `src/lib/data/useTimelineItems.js` + the `timeline_items` view in
   `supabase/migrations/0013_events_foundation.sql` — the merged
   chore/event/project feed today.
3. `src/pages/Schedule.jsx` — the existing **events** surface (to be
   renamed **Calendar**); the consolidation question lives here.
4. `src/pages/Chores.jsx`, `src/pages/Rounds.jsx` — the chore model and
   the full-screen field "do rounds" execution takeover (the canonical
   field flow the Schedule is "married" to).
5. `src/pages/Projects.jsx`, `src/pages/ProjectPage.jsx` — project →
   phase → step → bullet hierarchy and the `sort_order` priority.
6. `src/pages/Observations.jsx` — notes/mortality/quick-log feed (the
   field-capture that must stay available alongside the schedule, S109).

**The data hooks / engine (the "what's stored vs derived" evidence)**
7. `src/lib/chores.js`, `src/data/choreSeeds.js`, and the chore hooks
   `src/lib/data/useChoreDefinitions.js`, `useChoreBlocks.js`,
   `useChoreRuns.js`, `useChoreCompletions.js`, `useChoreLookup.js`,
   `useChoreModifiers.js` — how chores emit due candidates with must/
   should, windows, anchors.
8. `src/lib/data/useProjects.js` — project tree + `sort_order`.
9. `src/lib/data/useEventSeries.js` (`splitSeries`),
   `useEventOccurrences.js`, `useEventMutator.js`,
   `src/components/EventScopePrompt.jsx`, `EventEditor.jsx` — the
   this/all-future machinery the Schedule must reuse for events.
10. `src/lib/outbox.js`, `src/lib/data/useOutbox.js`,
    `src/components/OutboxIndicator.jsx` — the offline outbox / sync model
    the field ticking must ride on.
11. `src/lib/data/useSearchIndex.js` — the existing search index (Epic C
    "search-to-add" should extend this, not invent a parallel one).
12. `src/lib/data/useActivityLog.js` — the **poorly-named** `activity_log`
    (observations feed) that blocks the word "activity" (BD24).
13. `src/data/nff-data.json`, `src/sections.jsx` — app data + the current
    sidebar IA (where a Schedule nav entry would land).

**Schema**
14. `supabase/migrations/` — current schema. Note `0013` (events +
    `timeline_items` view), `0029_chores_rebuild_foundation` (the chores
    rebuild, in flight; `0030_chore_activities` is **shelved** — don't
    rely on it). Events tables: `event_series`/`event_occurrences`/
    `event_instances`/`event_links`. Chores tables listed in A6.

**Behavior + method**
15. `.ignored/schedule-feature/story-set.md` and
    `verbatim-requirements.md` (Part B) — the requirements.

---

## PART D — Open design questions (take a position from your lens)

Stated neutrally. Every pitch should land somewhere on each question
relevant to its lens.

1. **Parent-concept taxonomy & naming.** What is the generic concept that
   chore / task / project-node / event / ad-hoc all specialize? The story
   set splits **activity** (work) vs **reservation** (non-work, incl.
   buffer), both "schedule entries" — but "activity" collides with the
   poorly-named `activity_log` (BD24), and the whole word is unsettled.
   What's the right ontology AND the right words?
2. **Calendar ↔ Schedule consolidation.** One surface or two? Calendar =
   browse/manage events over time; Schedule = compose/confirm a day. Do
   they merge, stay siblings sharing one event source, or something else?
   Name where each justifies itself (BD9, BD10).
3. **Schedule vs Overview's `buildTimelineItems`.** Replace it, absorb it,
   or refactor it into the Schedule? There must not be two competing
   day-timelines (BD15). What happens to Overview?
4. **What's stored vs derived.** Given "regenerable draft" + "thin
   junction" + "confirm records deltas not a copy," what *exactly* is
   persisted (placements? reasons? overrides? the confirmation? the
   modification history S74?) and what is recomputed on every load? Where
   is the line, and how does a confirmed day stay a durable historical
   record (S100, S119, BD18) while sources keep changing underneath?
5. **Per-person start time** (S129) — auto-captured from the first
   started/completed item, or manually recorded? And how prominent?
6. **Buffer config placement** (BD23) — *flagged as Design-Bracket
   territory.* James's naive lean: a reusable buffer-config component + a
   "bufferable" interface any object exposes, kept OUT of the source
   subsystems (don't re-bloat chores). **Note your lean in one line; do
   NOT fully design it** — it's reserved for the later visual Bracket.

---

## PART E — Withheld material

There is **no withheld prior-design** for this feature. Unlike the
Farm-Map workshop (which had a solo planning doc to hold back), here the
**story set IS the behavior description** and is fed in full (Part B). The
five open questions in Part D are left genuinely open *on purpose* — they
are what the workshop decides; do not treat the story set's parenthetical
leanings as settled answers.

**For the synthesis only (orchestrator note):** the mandatory pitch
section **"§3 — what recent shipped work becomes"** targets, for this
feature: Overview's `buildTimelineItems` day-timeline, the events
`Schedule.jsx` surface (→ Calendar), and the recently-shipped chores
rebuild / Rounds / quick-log surfaces. Each agent says what happens to
those under their design.

---

## PART F — Lens roster (DECIDED 2026-06-24)

Per playbook §6 selection, chosen for spread on *this* feature. James
elected to run **both** premise/ontology lenses (six total).

- **Run (6):**
  1. **Aggressive scope-cutter** — thin-junction-or-bloat is the central
     risk; internal "defend your floor" check.
  2. **Data-model purist** — the stored-vs-derived / confirm-delta /
     override / taxonomy core is the most-open part (opposed pair with #3).
  3. **Field-ergonomics** — Dad one-handed, offline, glanceable checklist;
     the daily confirm/tick actions (opposed pair with #2).
  4. **UI Conventions** — day-planning has heavy prior art (Sunsama,
     Motion, Reclaim, Akiflow, Things, Google Calendar); name the patterns
     (opposed pair with #5).
  5. **First-principles** — derive from this two-person farm's hard
     constraints; pressure-test why day-atomic / why draft→confirm / the
     irreducible entry concept (opposed pair with #4).
  6. **Reframer** — change the unit of analysis; aim at the explicitly-
     unsettled entry taxonomy and day-atomic-vs-timeline question.
- **Reserve (comment on the synthesis only, no pitch):**
  - **Maximalist** — the 129-story set is already near-maximal, so a full
    pitch would re-tread; high-value reacting to the synthesis.
  - **Dad (skeptical non-technical operator)** — narrow/evaluative; the
    rollout's whole point is Dad, so his read on the synthesis is the
    high-value moment.
