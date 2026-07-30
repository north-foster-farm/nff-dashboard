# Schedule Feature — The Design

**Status:** SETTLED 2026-06-24. This is the output of the **Design Bracket**
(4 stances → wireframe-off → gate → coded hi-fi mockup-off → final judging).
It is the **visual/interaction build reference**. Paired with
`scope-document.md` (the *what*) it is the complete spec to build from.

**The winning artifact:** `mockups/minimalist.html` — the **single-open
accordion** Schedule. Open it; it is the visual source of truth. This doc
records the decisions, the grafts pulled in from the eliminated stances,
and the binding fixes.

**How we got here:** Round 1 wireframes + gate → `bracket-round1.md`. Round
2 brief → `bracket-round2-brief.md`. Coded mockups → `mockups/{minimalist,
rethinker}.html`. The **Dad reserve lens picked Minimalist decisively** for
the field (reads with no legend; words + counts + the same checkboxes as
Rounds; the man-down still leaks up); it also wins on build cost and carries
**no durations data dependency**. James chose Minimalist + one graft.

---

## 1. The design in one line

The Schedule is a **single-open accordion of the day's 5 blocks** — exactly
one block expanded (the one "now" is in), everything else collapsed to a
quiet one-line summary — so a 40-item market day reads as ~4 lines + the
block in your hand, and the whole-day *shape* lives one tap away in a
load-silhouette overview.

---

## 2. The spine (Minimalist — the chosen structure)

- **One block open at a time; "now" decides which.** Past blocks collapse
  to a dimmed `▸ Morning · done 6:08a` line; future blocks to a quiet
  `▸ Late afternoon · 4:00p · 0/11` line. The open block shows its
  Rounds-style checklist. Tapping any collapsed line peeks it open (and
  closes the previous — single-open).
- **Forward-focus IS the collapse.** No colored now-line needed on phone —
  the open block is the only loud thing; the now-marker is the fact that
  *it's* the open one. `jump-to-now` snaps back to it when scrolled away.
- **Only three things may break the collapse** (the density contract): the
  **source-change ribbon**, the **should→must box**, and the **one-line
  man-down leak**. Nothing else escapes a collapsed line.
- **Strict component reuse** (Convention-follower graft, see §4): the 28px
  `border-2` checkbox with `bg-resolved` tick and `row-active-dim` done
  rows is the literal Rounds `ChoreCheckRow`; `BlockBadge` glyphs,
  `ChoreRemainingPill`, `OutboxIndicator`/`CloudOff`, `EmptyState`,
  `CommandPalette`/`PlaceSearch` all reused as-is.
- **Desktop** = the same accordion + a thin persistent **day-rail spine**
  (the block list always visible on the left) + the week view.

---

## 3. The grafts (pulled in from the eliminated stances)

### 3.1 From Rethinker — the load silhouette (the one graft James chose)
- **Where it lives: overview altitude only.** The **week view** is a 7-day
  list where each day is a **5-bar load silhouette** (taller bar = heavier
  block) with flag glyphs (man-down / should / market / processing). This
  is the "how heavy is today / this week" read Dad praised — and it's how
  the hidden whole-day shape stays one tap away from the accordion.
- **Where it must NOT go:** the **in-block phone view**. Rethinker's
  per-block two-lane committed/open bars are **rejected for the field** —
  they leaned on a legend Dad's phone doesn't carry ("his lane's longer so
  he's slammed" was a *guess, not a read*). The phone block view stays
  words + counts + checkboxes.
- **A day-level silhouette strip** (the single "how big is today" bar Dad
  liked at the top of Rethinker) MAY appear at the top of the phone Today
  as a *one-bar* glance — but only if it reads with zero legend. Treat as a
  build-time A/B (§6), not a requirement.
- **No durations dependency.** The silhouette is sized by **item count per
  block** (what Minimalist already uses), not time estimates. If a real
  per-commitment duration ever lands, the bars can upgrade to time — but
  the Design ships on counts. (This is the decisive build-cost win over
  Rethinker.)

### 3.2 From Flow-first — the motion (already in the mockup)
- **tick→seal:** ticking fills the box instantly (optimistic, offline-safe);
  the block's `n of M` count bumps; completing the last item **seals** the
  block — it flashes, stamps its worked window ("sealed 9:04–9:58a"),
  collapses, and the next actionable block opens and scrolls into view.
- **Accordion transition** (animated `max-height`) and **jump-to-now**.
- **`prefers-reduced-motion` honored throughout** — instant state, no
  height/seal/sheet animation. The field works either way.

### 3.3 From Convention-follower — the build discipline (in the mockup)
- Strict reuse of the existing design system (§2).
- **Sunsama-style one-tap Confirm bar** that *names the deal* ("Confirm
  today — 5 blocks · 38 chores · 1 market") then collapses to a header
  timestamp (`✓ Confirmed 6:08a`).
- **Problems-panel** treatment for conflicts (jump + prev/next), surfaced
  only when >1.

---

## 4. The hard states — decided behaviors (per the mockup)

- **Draft ↔ confirmed:** draft shows the "Confirm today" deal-naming bar;
  one tap → collapses to the `✓ Confirmed 6:08a` header stamp. Confirm is
  not a gate (you can tick from a draft); it drops the accountability
  anchor + freezes the planned shape.
- **Now / forward-focus:** the open block; past dimmed-collapsed, future
  quiet-collapsed; `jump-to-now`.
- **Should→must escalation:** the one **boxed row** (2px `accent-deep`)
  inside the open block, carrying "why today: last clean before processing
  Thu · due Thu"; border weight rises toward the deadline.
- **Man-down + covering-person ack:** a **one-line yellow leak** under the
  collapsed Early-afternoon row ("Wash eggs needs cover — James off-site
  till 1:00") → opens a sheet → "Jim covers" records the *covering person's*
  acknowledgment (S60a) and updates the leak to "Jim covering."
- **Event + buffer:** the market renders at clock time with its 8–9 setup
  buffer + the equipment checklist (modeled as an openable block for
  uniformity — flagged as a slight metaphor-bend, scope untouched).
- **Offline / unsynced:** `CloudOff` glyph on the queued Coop 2 tick; the
  whole day derives client-side; ticks queue and reconcile.
- **Source-changed-after-confirm:** the top ribbon "1 change since you
  confirmed — review" (feed delivery moved to today); surfaced, never
  auto-applied.
- **Dense day:** the accordion *is* the answer — ~4 lines + one open block.
- **Empty day:** `EmptyState` ("No work on the schedule today" + Add).

---

## 5. Binding fixes (must be true before this ships)

1. **Dad's non-negotiable: the man-down leak must be unmissable and
   unmistakable.** The yellow cover line + its Cover button must never read
   as just another chore row — distinct color, weight, and an action affordance.
   "If covering James's eggs ever reads like a normal row I might scroll
   right past it, and that's the one mistake on a market day I can't afford."
2. **The phone in-block view stays words + counts + checkboxes** — no
   legend-dependent encoding (the reason Rethinker lost the field).
3. **The week silhouette must be legible without a key** — taller = heavier,
   flags self-explanatory; if it needs a legend, it's failed Dad's bar.

---

## 6. Build-time open questions (decide while building, not now)

- **Phone day-level silhouette strip** (§3.1): include the single "how big
  is today" bar at the top of phone Today, or rely solely on the week view
  for day-shape? A/B in the build.
- **The market-as-block metaphor-bend** (§4): is an event an openable
  "block," or does it render distinctly from chore blocks? The mockup
  unified them for simplicity; revisit if it confuses.
- **Search-to-add** is mocked as two staged frames (dedup → place-narrow),
  not a live typeahead — wire it to `useSearchIndex`/`CommandPalette` for
  real; confirm the dedup + place/occurrence narrowing (S33a–c) feel.
- **Buffer config placement (BD23)** — still the reserved cross-cutting
  question from the Scope Document; the Design renders buffers but doesn't
  decide where they're *configured*. Resolve in build (the "bufferable"
  interface idea).

---

## 7. Explicitly NOT pulled forward

- **Rethinker's in-block two-lane load bars** and the **desktop two-lane
  ribbon** — rejected for the field (legend dependency) and for build cost.
  Only the overview silhouette survives, on counts.
- **The per-commitment durations data model** — not needed; the Design runs
  on item counts. (Revisit only if time-accurate load ever becomes a goal.)
- **Flow-first's fixed-waterline scroll-under model** — its *motion*
  (tick→seal, jump-to-now) was grafted, but the non-standard "day scrolls
  under a pinned band" scroll was not adopted; the accordion is the
  structure.

---

## 8. The Bracket is complete

Scope Workshop → Scope Document → Design Bracket → **The Design**. The
Schedule feature is now fully specified (the *what* in `scope-document.md`,
the *look & feel* here, the storage substrate in
`versioned-capture-substrate.md`). **Next phase: work backwards to a build
plan / MVP increments** (the orchestrator-owned sequencing the workshops
deliberately deferred) — not yet started.
