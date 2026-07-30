# Feature life-story catalog

The primary artifact for understanding this app's vision: one chapter
per feature, each recording every evolution the feature has undergone —
from first idea through workshops, pivots, shipped versions, redesigns,
and abandonments — with sources cited for every claim.

Written during the 2026-07 housekeeping arc (plan:
`.ignored/housekeeping/PLAN.md`). Phase H1 mined the evidence; Phase H2
wrote the chapters. The evidence dossiers behind every citation live in
`.ignored/housekeeping/mining/` (m1 = commits + migrations, m2 =
roadmap archaeology, m3 = `.ignored` docs, m4 = audits + memory, m5 =
targeted transcript mining).

This catalog is the *backward*-looking record. `ROADMAP.md` is
forward-looking only. Nothing should be documented in both.

## How to read it

Start with the narrative below for how the whole app got here, then go
to the chapter for whatever you are about to work on. Each chapter's
**Unresolved threads** section is the input to Roadmap v2; each
chapter's **E-commerce relevance** section feeds
`docs/ecommerce/PREP.md`.

Three hazards will bite anyone reading the primary sources directly:

- **"Batch 41" means two different features.** `batch 41` alone is the
  2026-06-04 chores rebuild; `batch 41.N` is always the Schedule.
- **Batch numbers were renumbered six times** (`bfb8f8b`, `9aff149`,
  `8790e21`, `dadeb03`, `c63cfa8`, `60c10c8`). A number in an old
  roadmap revision rarely means what it means today. The only
  trustworthy mapping is the as-shipped table in m1 §2, and the
  genealogy in m2 §3.
- **Four independent F-numbering universes exist** — the audits of
  2026-06-04, 06-28, 07-01 and 07-02 each start at F1. Every F-number
  needs a date qualifier or it is ambiguous. There is also a fifth,
  separate scheme: `D1–D6` / `R1–R9` in
  `records/chores-design-critique/`.

## The cross-feature narrative

Six months, 263 commits, v0.9.0-alpha → v0.10.99-alpha, in five
movements separated by three silences.

**Movement 1 — foundations and two overhauls (2026-05-01 → 05-08).**
The app starts as a dashboard over a JSON file (`a074dfb`), gains
Supabase auth (`9878f1e`), and migrates its reference data to Postgres
across four batches. On 2026-05-04 the whole plan is dumped in two
sessions and written down as 22 batches (`4a8ed2c`). The raw dump lived
outside the repo in `~/.claude/plans/` and is now **gone** — that
directory is empty as of 2026-07-30, so `4a8ed2c`'s reconstruction is
all that survives of it. Then, within four days, two
design workshops insert two overhauls ahead of that plan — chores
(`bfb8f8b`) and events (`9aff149`) — and batches 7 through 14.2 ship
rapid-fire. By 05-08 the plan has grown from 22 batches to 35 and the
codebase has a chore model with time blocks, a Rounds lifecycle, an
RFC 5545 event layer and a calendar.

**First silence (05-08 → 05-31).** Three weeks with no roadmap commit.
The farm-map workshop happens at the end of it.

**Movement 2 — the place-model collapse, production, and all of
commerce (05-31 → 06-04).** The largest single restructure
(`dadeb03`) inserts the farm map as batches 15–18 and absorbs an older
"Resources rethink" that had been waiting since day one. Batch 15
(`acfd246`) collapses three competing place vocabularies into one
recursive `places` tree with polymorphic `placements` — and, in the
same commit, performs the last database reset this project will ever
do and creates `backup-db.mjs`. On **2026-06-01 the database goes
live** (`fd1cd2d`); every migration after 0014 is additive-only.

Then commerce ships in about seventy-two hours: CRM, products,
pricing, sales, bundles, lot-based inventory, POS, orders,
fulfillment, shipments (`4afcda6` → `faecbf5`), plus metrics and a
feeds overhaul. It is the densest stretch of feature work in the
project's history, and — see `pricing-orders-and-ecommerce.md` — it has
never been used. Zero prices, zero sales, zero orders in production
as of 2026-07-29.

**Second silence (06-04 → 06-24).** No roadmap commits. A recorded
walkthrough audit produces 138 findings, and the Schedule design
workshop runs.

**Movement 3 — the Schedule becomes the spine (06-24 → 06-26).** The
number 41 is reused for a second feature and 41.1–41.36 ship in three
days. `chore_runs` is generalized into `commitments`, a versioned
capture substrate lands, and the vocabulary settles: **Schedule** is
the day plan, **Calendar** is the old event view. This is the pivot
that reorganized the whole app — the day plan, not the calendar and
not the dashboard, becomes the surface everything else feeds.
Overnight and project blocks ship at the end of it and are parked the
same day.

**Movement 4 — findings, then a design language (06-28 → 06-30).** A
22-commit audit-fix wave hits the shipped Schedule. Then the rethinker
arc: a mockup is ported into a component pool, James corrects the
approach mid-flight (extract the patterns, don't keep the mockup's
components), the patterns are reinterpreted into the app's own
components, and on 06-29 a real design system ships with a style guide
and a voice guide (`4fe2c86`). In parallel the projects rework lands
forced ranking and a reflow engine.

**Movement 5 — redesign, tests, and a second look at everything
(07-01 → 07-03).** Batch 42 rebuilds the Schedule's chrome on the new
system, availability becomes real tables instead of magic constants,
and on 07-02 the app acquires a unit-test suite and, with it, TDD as
the standing workflow (`08c523d` → `bdf8aaf`). The reflow engine's
auto-seeding is retired ten days after shipping. Processing, animals
and layers each get a slice.

**Third silence (07-03 → 07-29).** Twenty-six days, the longest gap.
It ends with one small batch (`f230327`) and this housekeeping arc.

## The divergent-paths diagnosis

Why the plan keeps forking, stated as patterns with evidence. These
are structural, not failures — but Roadmap v2 should be built knowing
them.

**1. Planning is insertion-driven, so the tail never arrives.** New
work goes in at the front. The plan grew 22 → 23 → 27 → 31 → 35 → 38 →
40 and then to 42, and every growth step pushed the same tail further
out (m2 §1). The consequence is mechanical: **almost nothing numbered
above 30 has ever been built** — 30 (commerce integrations), 31 (GCal
push), 32 (farm updates / social / blog), 36 (offline remainder), 37
(rotation planner) are all still open, while 34 and 38 were cut
outright (m1 §2, m2 §3).

**2. The unbuilt remainder is the original day-one list.** What is
still open is almost exactly the second half of the 2026-05-04 Round 2
dump. Six months of work delivered three overhauls that were *not* in
the original plan (chores, events, farm map), plus the Schedule and a
design system — all inserted after the fact. The plan was never
executed; it was continuously pre-empted by better ideas.

**3. Vocabulary collisions get resolved by collapse, which erases the
history.** Three place vocabularies became one (`acfd246`);
`chore_runs` became `commitments` and the old table was dropped
(`b4c217d`); "Chore Doer" became Rounds; `chore_groups` shipped and was
killed two days later. The house rule is fold-and-delete with no
compatibility shims, which keeps the codebase clean and makes its
history unrecoverable from the code alone. That rule is precisely why
this catalog exists.

**4. The design system and the findings backlog pull against each
other.** Per-finding style fixes were reverted wholesale when they
contradicted the system (`afa484a` → `58d3942`), under a standing
directive that the system wins. The rethinker arc's own Phase 4,
"reconcile deferred findings", **never ran** — and it is where the
colour bracket and several other open design calls live (m5). Any
future colour or style work must be scoped as a system pass; the
per-finding shape has been tried and reverted once.

**5. Findings accumulate faster than they are triaged — but less
badly than the record claims.** Four audit rounds produced roughly 350
findings. The 06-04 round (138) was never systematically triaged and
the 06-03 round (23) is still "awaiting ROADMAP triage". The 06-28
round, however, **was** triaged the same day, into six buckets with a
progress log recording three fix sessions that closed every FIX NOW
group (`audits/2026-06-28/triage.md`); what remains
there is greenlit builds, a design pass, a feature backlog and four
VERIFY items. Both m4 §4 and the memory directory still describe that
round as "F1–F80 untriaged" — **Roadmap v2 must not quote that
figure.** The genuine backlog is large and invisible in `ROADMAP.md`,
but it is the two earlier rounds, not the recent one.

**6. "Shipped" and "in use" are different states, and only the first
is recorded.** Chores and the Schedule are used daily by two people.
Commerce is complete, styled, tested, deployed, and has never held a
row. The overnight/project-blocks arc shipped fully and was never even
visually reviewed. A roadmap that tracks only shipping cannot see this
distinction — Roadmap v2 should.

**7. Roadmap silence means design, not idleness.** Each of the three
gaps contained the workshop that produced the next movement. Do not
read a quiet stretch as a stall.

**8. Decisions lived outside the repo, and some are already lost.**
The original 22-batch plan, the chores overhaul plan and the events
overhaul plan all lived in `~/.claude/plans/`. **That directory is
empty as of 2026-07-30** — all three are gone, and session transcripts
only reach back to 2026-07-01, so nothing from May can be recovered
from them either. What survives is second-hand: `4a8ed2c`'s
reconstruction of the plan, commit bodies, and the workshop *inputs*
promoted to `docs/workshops/scope-workshop/examples/`. The rethinker
arc's phased plan survives only in transcripts, and dozens of standing
decisions existed only in the memory directory. This is no longer a
cautionary lesson — it is a loss that already happened: a decision
that is not in the repo is a decision you may simply not have.

**9. The written record drifts in both directions, so verify before
scheduling.** H2's writers checked every chapter against the code and
production, and found the record wrong both ways. Overstated: the
dossiers, memory and `ROADMAP.md` all describe the projects reflow
engine as shipped-with-a-remainder, when the planner was **deleted**
outright in 42.4; m4 lists the farm-map remainder as four open items
that all shipped in batches 15–18.2. Understated: migrations 0033 and
0040 are recorded as never pushed and are in fact **applied**
(verified three independent ways, 2026-07-29) — a commit body saying
"not pushed yet" is not evidence of current state, because the
follow-up push routinely left no commit. Roadmap v2 should treat every
inherited status claim as a hypothesis.

**10. Fixes regress quietly, because the thing they fixed has no
test.** The 06-28 placement bug (F50) is live again on production —
one broiler batch still holds an open brooder placement from June,
another has no placement row at all — and map tint, dormant-chore
hiding and occupancy fan-out all read from that. 42.18's egg-averaging
honesty fix landed on `ProductionCard` but not on `Metrics.jsx`, so
the same question has two answers. The chores rebuild's process cutover
was never finished, and its one live modifier step points at a retired
chore id, so the pre-processing feed withhold silently does nothing.
The pattern is consistent: data-shaped and cross-surface behavior is
where regressions hide, and `src/lib` unit tests do not reach it.

## Chapter contract

Every chapter follows the same shape:

- **Evolutions** — dated entries: idea → workshops → pivots →
  shipped → redesigned → current, each citing its sources (commit
  hash, roadmap line, planning doc, transcript).
- **Current state** — what exists today, verified against the code.
- **Unresolved threads** — open questions and deferred scope; feeds
  Roadmap v2 directly.
- **E-commerce relevance** — anything the e-commerce rollout should
  know; feeds `docs/ecommerce/PREP.md` (may be "none").

## Chapters

Twelve, ordered by feature weight rather than alphabetically. A
chapter saying "no e-commerce relevance" is a real answer, not a gap.

1. **[`chores.md`](chores.md)** — the chore model, Rounds, the
   2026-06-04 rebuild, chore modifiers, and the automations→processes
   collapse. Processes are event-anchored chore generators, so they
   belong here rather than in a chapter of their own.
2. **[`schedule-and-events.md`](schedule-and-events.md)** — the
   day-atomic draft/confirm schedule, the event model beneath it,
   overnight and project blocks (shipped, then parked), and the
   schedule side of the reflow engine.
3. **[`places-and-farm-map.md`](places-and-farm-map.md)** — sites
   becoming places, the recursive place tree, and the
   settled-but-unbuilt farm map.
4. **[`projects.md`](projects.md)** — the projects engine, forced
   rank, phases and steps, the URL slice, and the reflow engine's rise
   and retirement.
5. **[`processing-and-broilers.md`](processing-and-broilers.md)** —
   broiler batches, the processing pipeline and workspace, cut sheets,
   feeds, metrics.
6. **[`layers-and-eggs.md`](layers-and-eggs.md)** — layer groups, egg
   collection, and the lifecycle rules now backed by processes.
7. **[`pricing-orders-and-ecommerce.md`](pricing-orders-and-ecommerce.md)**
   — products, weight brackets, cost floors, POS, orders, and
   everything the next arc inherits. The one chapter where "built" and
   "used" diverge completely.
8. **[`design-system.md`](design-system.md)** — tokens and ramps, the
   style guide, the voice guide, and the design-bracket → rethinker
   arc with its unfinished Phase 4.
9. **[`agent-bridge.md`](agent-bridge.md)** — the MCP proposal inbox:
   the shipped projects slice and what remains.
10. **[`platform-and-infra.md`](platform-and-infra.md)** — Supabase
    and migrations, Netlify deploys, auth, backups, the git hooks, the
    vitest suite and the move to TDD.
11. **[`surfaces.md`](surfaces.md)** — Overview, Metrics, Now: the
    cross-feature surfaces, and whether Overview still earns its
    place.
12. **[`parked-and-abandoned.md`](parked-and-abandoned.md)** — the
    graveyard and the parking lot, with a revive-or-kill
    recommendation per idea.

## `records/`

Primary documents promoted out of `.ignored/` during H1 — plans as they
were written at the time, not narrative — so chapters can cite a
tracked path:

- `chores-rebuild-reconciliation.md` — the spec→schema reconciliation
  that preceded the live chore cutover.
- `processes-as-chore-generators-plan.md` — the executed plan behind
  the processes-as-generators model.
- `overnight-project-blocks-the-design.md` + `…-scope.md` — what the
  parked overnight/project-blocks feature actually is.
- `chores-design-critique/` — the 2026-06-05 Chores & Rounds UX
  critique, its drafted `0030_chore_activities` migration and two
  mockups. Still a live findings register: its critical items (D1, R2)
  are unbuilt. Read its README's caveat first.
- `ntfy-digitalocean-setup.md` — the provisioning runbook for the
  self-hosted push server that web-push/VAPID made unnecessary.
  Preserved as prior art for the still-unbuilt notification channel;
  preserving the runbook is not a vote to revive the idea.
- `remix-propagation-tour.md` — the 2026-06-30 walkthrough of the
  design-remix propagation. Its §4 is the durable half: what was
  deliberately *not* flushed and why (hairline list rows need their
  subtle grey fill or the dividers stop showing).
- `schedule-coverage-audit.md` — the 2026-06-25 story-coverage audit
  of the shipped Schedule.
- `prototype-model-notes.md` — the prototype-era `modelNotes` prose
  promoted out of `src/data/nff-data.json` when H3 deleted the dead
  keys that carried it (nothing ever rendered them).

Related promoted material lives in `docs/specs/` (design specs),
`docs/workshops/` (the playbooks and their worked runs),
`docs/research/`, and `docs/ecommerce/`.

## Upkeep

Proposed rule, to be settled in Phase H6: batch entries in
`ROADMAP.md` are the feed, and a chapter's **Current state** and
**Unresolved threads** are refreshed at arc boundaries — not per
commit. Chapters are narrative history; keeping them current
per-commit would turn them into a second changelog, which is exactly
what this catalog exists to replace.
