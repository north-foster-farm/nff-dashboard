# Chores & Rounds UX critique (2026-06-05)

Preserved as-is on 2026-07-30 during the housekeeping arc. James's call:
*"it probably needs to all survive for now, even though it may not be
relevant when it is eventually revisited."*

Read that caveat first. This describes the chores UI as it stood on
2026-06-05, **before** the 2026-06-04 chore-set rebuild had settled and
before the 2026-06-28 processes-as-generators work existed. Some
screens it critiques have since been redesigned. Treat it as a record of
an argument, not a to-do list — and re-verify any finding against the
current app before acting on it.

## What's here

- `chores-ux-critique.md` — the critique. A TL;DR naming one root
  cause, findings tables for desktop (D1–D6) and Rounds (R1–R9) with
  severity + `[MODEL]`/`[UI]` type + recommendation, a diagram of how
  the two surfaces connect, a five-step recommended sequence, and
  accessibility notes.
- `activity-collapse-migration-spec.md` — the drafted
  `0030_chore_activities` migration (goal/non-goals, target schema,
  occurrence generation, an idempotent assertion-gated backfill,
  identity/merge rules, cutover sequence, test plan, rollback, and open
  questions). Never applied.
- `desktop-mockups.html`, `rounds-mockups.html` — the visual proposals.

## The argument, in one paragraph

A chore conflates **what** to do, **when** it fires, and **where**. The
edit form's `WHEN` is single-select, so one chore = one block, and a
thing done four times a day becomes four records. That one modelling
choice drives most symptoms on both surfaces: "8 chores" at Brooder 1
that are really 2 activities × 4 blocks, a nav badge of 60 that is
mostly a cartesian product, and a Rounds list of ten near-identical
cards. The fix proposed was to make a chore an *activity* with a **set**
of blocks plus a place binding, and generate occurrences from it.

## Status: what shipped, what did not

`e474993` (2026-06-24) was an explicitly zero-migration UI pass and
closed **R1, R4, R5, R6, R7, R8 and D2**. Its own body records that
"the model / collapse work is deferred to migration 0030". Migration
0030 was then shelved and deleted — the collapse survived as a decision
but pivoted away from this spec's shape (memory
`project_chores_collapse_decision`), and `0030_chore_activities` never
existed in the migration chain.

Still unbuilt at the time of writing:

- **D1** (🔴, MODEL) — multi-block `WHEN`. The root cause above.
- **R2/R3** (🔴, MODEL+UI) — group Rounds by location along the walking
  route, so the screen mirrors the walk, instead of by activity.
- **D5, D6, R9** — minor UI items.
- The cross-cutting tail of step 5: a unified pill system and a
  contrast pass on gray metadata (the critique suspected WCAG AA
  failures).
- **R4's principle**, app-wide. It said never ship `window.confirm` in
  a designed product; Rounds was fixed, but 27 bare `window.confirm`
  calls remained in `src/` as of 2026-07-30 — the same debt batch 39.2
  was supposed to clear (`audits/2026-06-03/design-audit.md` §4).

## Numbering hazard

`D1–D6` and `R1–R9` are their own numbering universe, unrelated to the
four audit F-number universes (2026-06-04, 06-28, 07-01, 07-02) listed
in `docs/history/README.md`. A bare "D2" or "R4" means this document.

For the surrounding history see `docs/history/chores.md`.
