# Schedule Design Bracket — Round 2 brief (coded hi-fi mockup-off)

**Status:** Gate decided 2026-06-24. James advanced **two** directions to
the coded round: **Rethinker** and **Minimalist**. This brief is binding for
Round 2. Round 1 wireframes + gate analysis: `bracket-round1.md`. Shared
context (scope, hero screens, states, design system, the real day):
`design-bracket-brief.md` (still in force — read both).

**NOT YET DISPATCHED** — waiting on James's "continue" (connection was
flaky). When he says go, dispatch the two coded-mockup agents in parallel.

---

## The two directions that advance

1. **Rethinker — the load-silhouette spine.** 5 blocks × two person-lanes
   as committed/open load bars; now-block opens into a Rounds checklist,
   others collapse to bars; man-down = a visible hole in James's lane.
   Desktop = a horizontal two-lane ribbon + a day load strip; week =
   mini-spines + a should-escalation heat row. (Round 1 §Stance 4.)
2. **Minimalist — the single-open accordion.** Exactly one block open at a
   time ("now" decides which); the rest collapse to one line each; the dense
   day reads as ~4 lines + the actionable block. Desktop = phone + a thin
   day-rail spine; week = a day-list with fullness bars, not a grid.
   (Round 1 §Stance 3.)

Each agent starts from its own Round 1 wireframe and builds it to running
hi-fi. They are a deliberate opposed pair: **show the whole day's shape** vs
**show only now**.

---

## Grafts to carry into BOTH mockups (from the eliminated stances)

- **From Flow-first (motion):** the **tick→seal reward loop** — ticking a
  chore fills the box instantly (optimistic, offline-safe), the block's
  count/bar animates, and completing the last item *seals* the block
  (collapses it, stamps its worked window). Plus **jump-to-now** and kinetic
  forward-focus. Honor `prefers-reduced-motion` (instant state, no
  animation) — the field must work either way.
- **From Convention-follower (build discipline):** **strict reuse of the
  existing design system** — Rounds' `ChoreCheckRow` (28px `border-2`
  checkbox, `bg-resolved` tick, `row-active-dim` done rows), `PageHeader`,
  `BlockBadge`, `ChoreRemainingPill`, `OutboxIndicator`/`CloudOff`,
  `CommandPalette`/`PlaceSearch`, `EmptyState`. Plus the **Sunsama-style
  one-tap Confirm banner** and the **linter "Problems panel"** treatment for
  the conflict list (jump + prev/next). Don't reinvent what the app ships.

---

## Must-fixes / gate notes per direction

**Rethinker:**
- **Resolve the durations dependency for the mockup.** The load bars need a
  committed-vs-open estimate. For the mockup, use plausible fixed estimates
  per block (it's a mockup), AND design the **item-count fallback** bar
  visibly (so James can judge both). Flag in §4 that the real build needs a
  data decision (per-commitment time estimate) — don't pretend it's solved.
- **The phone is the test.** The two-lane ribbon is desktop-only; on phone
  it's a single split bar — make sure **Dad can parse the load bar at a
  glance** (this is the whole reason it's in the coded round). Label/encode
  it so "how heavy, who's slammed" reads without instruction.
- Introduce the **new load-meter component** cleanly, matching the app's
  tokens/spacing so it doesn't read as a foreign widget.

**Minimalist:**
- **Defend the floor, visibly.** The known weakness is hiding the day's
  shape. Prove the **week-list fullness bars** compensate (heavy/light, the
  man-down/should flags) — make that view real, not a stub.
- Every must-see state must remain reachable in the collapsed model:
  man-down (the one-line leak → sheet), draft/confirmed, the should→must
  box, offline/unsynced, "1 change since you confirmed." Show them.
- Make the **accordion transition** feel good (this is where the Flow-first
  seal graft lands): collapsing the prior block + opening the next.

---

## Build mechanics

- **Standalone HTML, one file per direction**, isolated so they don't
  collide and open side by side:
  - `.ignored/schedule-feature/mockups/rethinker.html`
  - `.ignored/schedule-feature/mockups/minimalist.html`
  - (Precedent: `../calendar-rail-mockup.html` — a self-contained
    HTML mockup with inline styles/CDN Tailwind is the proven low-friction
    form. Pull the real theme tokens from `src/styles.css` so colors/fonts/
    radii match: semantic `bg/surface/line/fg/accent/warn/resolved`, the
    `cat-*` category colors, Nacelle/Lora/Inter fonts, sky-aqua + celadon.)
- **Use the `frontend-design` skill** for the quality bar — distinctive,
  production-grade, no generic-template aesthetic; it must read as *this
  app*.
- **Real content** = the Part F dense market day (real chore titles, James/
  Jim, now ≈ 9:40, confirmed-with-1-change). No lorem ipsum.
- **The hard states must be VISIBLE**, not described — via toggles, multiple
  frames, or separate sections in the file: draft↔confirmed, now-marker/
  forward-focus, should→must escalation, man-down + ack, event+buffer,
  offline/unsynced, source-changed-after-confirm, dense day, empty day.
- **Hero screens to build:** (1) phone Today — the primary, most detailed;
  (2) desktop timeline + week; (3) the confirm + man-down moment; (4)
  search-to-add. Phone Today is what decides the winner.

---

## Round 2 output format (each agent)

```
## 1. What I built
(One paragraph + the file path to open. Which hero screens + states are live,
and how to toggle the states.)

## 2. What to look at
(The 3–5 design decisions made concrete — what to notice.)

## 3. Interaction notes
(How the high-frequency actions feel; what's clickable vs faked; how the
tick→seal graft and jump-to-now behave; reduced-motion behavior.)

## 4. Where it's weak / real build cost
(Honest self-critique: rough edges, what's faked, the durations dependency
[Rethinker], the whole-day-shape gap [Minimalist], and what it'd cost to
ship for real.)
```

Bans: no scope changes (flag, don't redesign the model); no lorem ipsum; no
inventing components outside the app's system; no bluffing; no
happy-path-only. The mockup IS the deliverable.

---

## After Round 2 — final judging (playbook §11)

James opens both mockups side by side. Run the **Dad reserve lens** on the
running mockups (comprehension/field-readiness — the deciding axis here is
whether Dad parses Rethinker's load bars vs Minimalist's one-block focus).
Optional judge panel scores both on glanceability / tap-cost / state
coverage / fits-system / comprehension / distinctiveness. Orchestrator
assembles **the Design** = winning mockup + a decision spec + named grafts.
