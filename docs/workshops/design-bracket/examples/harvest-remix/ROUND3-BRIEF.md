# Round 3 brief — collaborative real-app prototype

Round 2 produced two coded mockups (Operator, Systematizer). James reviewed them
side by side on 2026-06-29 (see `../../../audit-v2/audits/2026-06-29/review.md`
for the full capture). **Verdict: build a hybrid, not a winner.** This brief is
binding for Round 3.

## What changes from Rounds 1–2

- **Collaboration, not competition.** Round 3 has **exactly two agents** — the
  **Operator** and the **Systematizer** — and they **work together** toward one
  shared hybrid. No third strategies, no gate, no parallel divergent builds.
- **Full memory.** Both agents get full access to their own Round-1 wireframe +
  thinking docs (`round1-operator.md`, `round1-systematizer.md`), the gate
  verdicts (`gate-verdicts.md`), `DESIGN.md`, both Round-2 mockups under
  `mockups/`, and this review (`audits/2026-06-29/review.md`).
- **Real app, not static HTML.** The artifact is a **functioning prototype in
  the codebase on a new git branch**, wired to **real data**, **not** a
  self-contained `index.html`.

## The hybrid thesis (both agents commit to this)

**Operator's product shape, executed with Systematizer's discipline.** Operator
owns the phone-led signal placement (strong mobile Today + Rounds, re-homed
man-down / now / day-load); Systematizer owns the one clean app-wide component
vocabulary and the desktop Schedule workbench. The clean Operator sidebar +
Systematizer component cleanliness combine. The settled shared floor from the
gate (`ROUND2-BRIEF.md` §"settled shared floor") still holds.

## Deliverable — four real pages, both tiers

A functioning prototype of **all four surfaces, each working on desktop AND
mobile (390px)**, using real app data:

1. **Schedule** — START HERE. Rebuild the current Schedule page as a real
   functioning **desktop** page using Systematizer's component vocabulary, on
   top of the existing schedule's data so it carries **all the same information**
   (the operator's level of detail, more). Roll-back-able.
2. **Dashboard** — "schedule at a glance" with the dynamic day-load read.
3. **Chores** — the block/escalation surface (escalation relocated off verbose
   text per C2).
4. **Rounds** — the active doing surface; strip ancillary/overdue detail (C9).

Build on a **new branch**; if it doesn't pan out, roll back or don't merge.

## Hard requirements pulled from James's review (must all land)

**Dynamic + projects (the big two):**

- **Day-load is dynamic** (G1) — derives from the **actual user-defined blocks
  on the Chores page**, not 5 hardcoded buckets. Any surface rendering day-load
  reads that data directly.
- **Projects are integrated** (G2, G3) — project blocks for the day are surfaced
  in the day-load component and interwoven across all four pages, not chores-only.
- **Real assembled desktop page** (G4) — show page chrome + nav placement, not
  floating surfaces.

**Language / nomenclature:**

- **Drop "should" / "must"** from the UI (C3); use Operator's **window-of-time**
  visual for the should→must conversion (L5). Alt phrasings are out of scope
  (separate workshop).
- **Kill "Sealed" / "Completion is the seal"** (C5) → "completed" / "finished";
  applies to the **whole run**, not a sub-bucket.
- "**Needs cover**" text must be **emphatic / eye-catching**, not just a pill
  (C6).
- Rephrase overdue copy to omit "yesterday"/"must" (C8); e.g. "Pressure-wash
  nest boxes was due yesterday."

**Visual / component:**

- Top-strip icon → **Lucide** (C1).
- **should-escalation relocated** off spelled-out text → chore row, or a bar
  decoration/outline on the week view; handle multiple chores sharing a warming
  curve (C2).
- **Hatch/stripe motif never behind body text** (C4) — text-free hole indicators
  only.
- **Blue is reserved for chore-time** (C7) — no chore lands on a conflicting blue
  background; keep background-color usage consistent.
- **Redesign the nav** (C10) — no horizontal off-screen scroll; obviously
  navigational; quick jumps between places.
- **Drop "heavy day" / "light day" text** (C11).

**Bugs to resolve, not reproduce:**

- Week-spine bar overflow (B1) — decide: overbooked signal vs CSS bug, then make
  it intentional or fix it.
- Day-load bar element overflow (B2); phone "dense day" box overflow (B3).

## Out of scope for Round 3

- Picking final "should/must" replacement words (parked — separate workshop).
- Anything not on the four pages above.

## Self-critique requirement

End with an honest accounting: what's real vs faked/stubbed, what data is wired
vs hardcoded, what each tier still lacks, and the cost to ship for real.
