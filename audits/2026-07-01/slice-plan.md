# Schedule redesign batch — build-ordered slice plan

_Drafted 2026-07-01 (session 6) from findings.md §1–§2 after de-tainting
against current main (776a39a). Batch scope per §0.1: the visual
redesign + the cross-cutting affordance standard (F65), with the
availability cluster (F45–F51) as a feature-complete slice inside it.
Proposed numbering: **batch 42.1–42.8** (each slice = one batch commit
+ patch version bump)._

## Already on main — do NOT rebuild

Verified live (session 6, desktop 1280): F2, F3(label part), F6, F7
(as teal — settled deviation), F8, F10, F13, F14, F15, F26, F30, F32,
F17/F20 cores. Bug-loop commits closed F31, F36, F52, F57, F59, F60.

## Out of this batch (parked follow-ups)

Rounds cluster **F62, F63, F64**; Projects simple mode **F61**. These
are self-contained and can run as an independent mini-batch any time.

---

## Slice 1 — Interaction foundations (F65 + F41 primitive)

The affordance standard everything later leans on. Build once, apply
everywhere, document in BOTH design-library faces.

- F65: shared hover (lighter background tint, follows cursor) +
  active (filled, no border) + tappable treatments as utility
  classes/tokens, applied to: spine rows (F1 hover + verify the
  active box), Day/Week/Month/Review tabs (F17 hover), header/block
  action buttons (F25 hover part), mobile day-strip bars (F29 —
  tappability must be visible without instructional text).
- F41: a real tooltip primitive (instant, formatted HTML, a11y
  trade-off accepted) replacing native `title` — needed by slices
  4, 5, and 7.

## Slice 2 — Chrome & toolbar

Structural cleanup of the Schedule frame; no data model changes.

- F28 kill the desktop "Whole day" spine row (mobile keeps block
  nav); absorbs the rest of F3.
- F16 column widths: spine 240px / This Week 180px / center gets
  the rest (verify current, adjust).
- F25 + F58 one top toolbar: Time off · Add chore · Add one-off
  task (single line + block selector incl. Overnight + optional
  time; specific-time entry stays deferred) · per-block actions
  (Split block / Open rounds / Add buffer) presented consistently.
- F27 Review-tab copy trim + the yesterday banner shows counts,
  not every item name.
- F4 drop the overnight "0 of 1" count; F12 shorten the overnight
  time label ("after 8:57").

## Slice 3 — Spine finish

- F5 NowRule/now-marker pattern in the spine (style-guide
  component).
- F11 typography consistency pass (block name = title font,
  active/inactive weights match).
- F9 planned vs unplanned project rows: cross-hatch gradient
  (slate-blue version of the wash-eggs ribbon) vs solid — the
  planned/free state already exists (spine says "both free").
- F66 gutter decision spike: propose the route/order indicator
  (ties to F56) — small mockup for James, then apply or drop.

## Slice 4 — This Week: truer week (X1/X2)

- F40 bars carry chores + projects + events (identity colors).
- F49 overnight signal carried through (X1).
- F37 baseline alignment of bars with the day text.
- F21 warming goes binary: warning (due this week) / due (today,
  red), clock-alert icon inline in the day summary (×N) and on the
  chore row; collapse the shipped CH-Pill gradient to the same two
  states. Uses slice-1 tooltips for the hover explanations.
- F42 (This Week half) hover details per symbol/bar.

## Slice 5 — Day-load axis + events

- F43 WHEN-axis on the day-load with block color coding.
- F33 events into the day-load + a spine row per event (E badge,
  event color); clicking shows event details, not a chore list;
  same-time events stack.
- F20 residue: conflict symbol on day-load bars.
- F44 buffers get a visible home in the list.
- F42 (day-load half) hover details: chore block → name/count/
  window; project → name + phase/step; event → details.

## Slice 6 — Availability core (schema + engine) ⚠ prod migration

The structural heart of the cluster; everything in slice 7 renders
from this. Additive-only migration + backup ritual before push.

- Schema: time_off (person, span, optional note, all-day or
  partial), working_hours (per person, weekday defaults +
  per-date exceptions), breaks (farm-wide windows).
- F50 time-off entry page (Schedule sub-tab or user settings):
  from→to shorthand, all-day or partial. Explicitly NOT an event.
- F51 engine: availability = working hours ∩ not-time-off ∩ not
  break; default assignment falls back to "everyone available"
  (X3 — kills the unassigned-everything problem); working hours
  gate project time (derived cutoff, not the magic 6pm; over-long
  project block → warn).

## Slice 7 — Availability surfaces

- F45 spine tab for unavailability (out from A→B, clickable).
- F46 whole-day-out icon on This Week days (needs-cover or
  person-with-line).
- F47 event-coverage indicator during event windows.
- F48 who's-here count across the day's time axis (1 → 2 → 1).

## Slice 8 — Project blocks & task rules

Engine-heavy tail; depends on slice 6 (working-hours-derived
windows).

- F51b create/modify project blocks (ad-hoc evening block etc.).
- F23 block height ∝ duration; planned/unplanned state shown here
  too (F9's pattern).
- F22 project blocks populate every gap; "Continue project" button
  + restore Swap.
- F53 task carry-over rules (roll to next block; duplicate-chore
  absorption with left-undone flag; revisit dropping split-block).
- F54 move a chore to a different day (recurring → ad-hoc other
  day + optional block).
- F55 chore rows surface place/animal (tap-to-expand candidate).
- F56 route/order within a block — LARGE; do the order-preserve
  part here, defer route-building unless slice 3's F66 spike
  settled the indicator.

---

## Order rationale

1–3 are cheap, purely visual, and immediately visible in James's
daily use; they also install the affordance/tooltip primitives the
rest reuse. 4–5 complete the "truer week" read of the schedule.
6 must precede 7 and 8 (schema/engine before surfaces; working
hours gate project windows). 8 last because it's the most
engine-entangled and benefits from everything before it.

Deploy note: deploy main before James records audit round 2 — the
July 1 recording predated aa37e6e and re-reported finished work.
