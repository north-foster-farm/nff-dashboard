# Feature life-story catalog

The primary artifact for understanding this app's vision: one chapter
per feature, each recording every evolution the feature has undergone —
from first idea through workshops, pivots, shipped versions, redesigns,
and abandonments — with sources cited for every claim.

Written during the 2026-07 housekeeping arc (plan:
`.ignored/housekeeping/PLAN.md`). Chapters land in Phase H2; until
then this stub marks the home.

Chapters live directly in this directory. `records/` holds primary
documents promoted out of `.ignored/` during H1 — plans as they were
written at the time, not narrative — so chapters can cite a tracked
path instead of an untracked one:

- `chores-rebuild-reconciliation.md` — the spec→schema reconciliation
  that preceded the live chore cutover.
- `processes-as-chore-generators-plan.md` — the executed plan behind
  the processes-as-generators model.
- `overnight-project-blocks-the-design.md` + `…-scope.md` — what the
  parked overnight/project-blocks feature actually is.
- `schedule-coverage-audit.md` — the 2026-06-25 story-coverage audit
  of the shipped Schedule.

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

Twelve, finalized 2026-07-29 against the H1 evidence. Each maps onto
sections of the mining dossiers in `.ignored/housekeeping/mining/`
(m1 = commits + migrations, m2 = roadmap archaeology, m3 = .ignored
docs, m4 = audits + memory, m5 = targeted transcript mining).

1. **`chores.md`** — the chore model, Rounds, the 2026-06-04 rebuild,
   chore modifiers, and the automations→processes collapse. Processes
   are event-anchored chore generators, so they belong here rather
   than in a chapter of their own.
   *Evidence:* m1 §1.1 + §1.8; `records/chores-rebuild-reconciliation.md`;
   `records/processes-as-chore-generators-plan.md`;
   `docs/specs/nff-chores-spec.md`.
2. **`schedule-and-events.md`** — the day-atomic draft/confirm
   schedule, the event model beneath it, overnight and project blocks
   (shipped, then parked), and the schedule side of the reflow engine.
   *Evidence:* m1 §1.2 + §1.3; m2; `records/schedule-coverage-audit.md`;
   `records/overnight-project-blocks-*.md`; the schedule run under
   `docs/workshops/`.
3. **`places-and-farm-map.md`** — sites becoming places, the recursive
   place tree, and the settled-but-unbuilt farm map.
   *Evidence:* m1 §1.4;
   `docs/specs/farm-map-north-star-requirements.md`.
4. **`projects.md`** — the projects engine, forced rank, phases and
   steps, the URL slice, and the reflow slices in
   `docs/specs/scheduling-engine-design.md`.
   *Evidence:* m1 §1.5.
5. **`processing-and-broilers.md`** — broiler batches, the processing
   pipeline and workspace, cut sheets, feeds.
   *Evidence:* m1 §1.6.
6. **`layers-and-eggs.md`** — layer groups, egg collection, wash and
   pack, and the lifecycle rules still waiting on process backing.
   *Evidence:* m1 §1.7.
7. **`pricing-orders-and-ecommerce.md`** — products, weight brackets,
   cost floors, POS, orders, and everything the next arc inherits.
   **Written by the main session, with extra depth.**
   *Evidence:* m1 §1.9 + §4; `docs/ecommerce/`.
8. **`design-system.md`** — tokens and ramps, the style guide, the
   voice guide, and the design-bracket → rethinker arc with its
   unfinished Phase 4.
   *Evidence:* m1 §1.10; m5 (the rethinker plan survives only in
   transcripts); `docs/workshops/design-bracket/`.
9. **`agent-bridge.md`** — the MCP proposal inbox: the shipped
   projects slice and what remains.
   *Evidence:* m1 §1.11.
10. **`platform-and-infra.md`** — Supabase and migrations, Netlify
    deploys, auth, backups, the git hooks, the vitest suite and the
    move to TDD.
    *Evidence:* m1 §1.12; m4.
11. **`surfaces.md`** — Overview, Metrics, Now: the cross-feature
    surfaces.
    *Evidence:* m1 §1.13.
12. **`parked-and-abandoned.md`** — quote/artwork rotation,
    farm-update publishing, Inbox capture, pasture rotation, YoLink
    sensors, ntfy, and the rest of the graveyard.
    *Evidence:* m1 §1.14; m3.

Chapter ordering in the index is by feature weight, not alphabetical.
A chapter may say "no e-commerce relevance" — that is a real answer,
not a gap.
