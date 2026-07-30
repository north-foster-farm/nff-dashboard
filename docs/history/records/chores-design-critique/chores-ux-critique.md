# NFF Daily Ops — Chores & Rounds UX Critique

**Prepared for a Claude Code working session.** This document is the reasoning artifact:
read it first, then use the two HTML mockups (`desktop-mockups.html`, `rounds-mockups.html`)
as visual references for the target state. Mockups are static and illustrative — they encode
the *intended structure and hierarchy*, not final copy, spacing tokens, or component APIs.

Surfaces reviewed:
- **Desktop** — Chores › TODAY, Chores › ALL CHORES (incl. the inline edit form)
- **Mobile** — Rounds (launcher, active run, quick-log sheets, cancel dialog)

---

## TL;DR — the one decision everything hangs on

A "chore" currently conflates **what to do** (the activity) with **when it fires** (the
block) and **where** (the place). The edit form's `WHEN` is single-select — one chore = one
block — so a thing done four times a day becomes four separate chore records.

This single modeling choice is the dominant cause of nearly every symptom in both surfaces:

- ALL CHORES shows "8 chores" for Brooder 1 that are really 2 activities × 4 blocks.
- The nav badge of **60** is mostly a cartesian product, not 60 things to think about.
- Editing how feeding works at Mobile Coop 1 means editing the same logical thing in 4–5 places.
- On the rounds screen, Pastures is a flat list of 10 near-identical Coop 1 / Coop 2 cards.

**Fix the model first.** A chore should be an *activity* with a **set** of blocks and a
place-binding. Occurrences (one per block per place) are *generated* from it — which is what
TODAY and the active round already render. The library and the field list are currently
showing the generators flattened instead of the activities.

Everything below is sequenced around this. Items marked **[MODEL]** depend on it; items marked
**[UI]** can ship independently.

---

## Part 1 — Desktop: ALL CHORES & TODAY

### First impression
- **TODAY** reads as a schedule (block → place → chore). Correct mental model for execution.
- **ALL CHORES** reads as a wall. No anchor for the eye; near-identical rows repeat down the page.

### Findings

| # | Finding | Severity | Type | Recommendation |
|---|---------|----------|------|----------------|
| D1 | One chore per block forces clones (Fill feeders ×4 per place) | 🔴 Critical | MODEL | Make `WHEN` multi-select. One row → fans out to occurrences. Collapsing feeders+waterers alone drops Brooder 1 from 8 rows to 2. |
| D2 | Redundant metadata on every TODAY row ("Brooders · occupied · Morning (sunrise) · Every day") repeats the block + place already in the section headers | 🔴 Critical | UI | On TODAY, strip to the non-redundant signal (here, "occupied"). A row needs: checkbox, title, exception-only deadline, assignee (when filtered to ALL). |
| D3 | Deadline pills say "by the next block" on nearly every row | 🟡 Moderate | UI | When every row carries the same pill it conveys nothing. Show a pill only on *deviation* (due-soon / overdue / unusual deadline); fold the default into the block header. |
| D4 | Sort modes (BY PLACE / A-Z / TIME OF DAY) none reduce repetition; A-Z makes it worse by stacking the four "Fill feeders" adjacent | 🟡 Moderate | MODEL | Resolved by D1. Post-collapse, "by activity" becomes a meaningful view. |
| D5 | Trash icon one click from every row, ×60 | 🟢 Minor | UI | Move destructive actions behind the expand/edit state, or require confirm. |
| D6 | `SORT ORDER` is a raw integer spinner (12) in the edit form | 🟢 Minor | UI | Manual sort integers are fragile and leak the data layer into the UI. Prefer drag-to-reorder or derive from block/place. Acceptable for an admin-only tool, but flag it. |

### Visual hierarchy
- **TODAY** — block headers (counts + sunrise/10AM labels) draw the eye. Correct. Deep nesting
  (Block → Brooders → Brooder 1 → chore) pushes chore text far right; collapse place + sub-place
  onto one breadcrumb line ("Brooders › Brooder 1") to recover horizontal space, esp. on narrow widths.
- **ALL CHORES** — nothing draws the eye; uniform density with no anchor. The collapse (D1) is the fix.
- **Telling asymmetry:** the *one-time* Whole-Farm tasks are handled *better* than the recurring
  ones — the "FRI JUN 5 · 53 DAYS LEFT" countdown pills are the right pattern. The recurring section
  is over-flattened while the one-time section is well-structured. Bring the recurring section up to
  the same standard.

### What works (keep)
- The **BELONGS TO** model (Animals / A place / Every place of a kind / Nothing — whole farm) with
  "housed anywhere → work happens where they live." It cleanly encodes chore-follows-animals, and the
  inline helper ("Wash eggs belongs to the layers but happens at the House") teaches at the right moment.
- **NEXT 7 DAYS PREVIEW** — immediate feedback on the recurrence rule. Rare and valuable. Keep, and
  extend it to preview multi-block expansion once `WHEN` is multi-select.
- The place-scoped filter chips.

---

## Part 2 — Mobile: Rounds (field execution)

A "round" is a timed session for completing one block's chores out in the field, on a phone.
This is the surface that most needs work, and it shares Part 1's root cause.

### First impression
- Launcher is strong: clear START CTA, a block picker, recent rounds with resume.
- Active run has good bones for field use (big cards, big checkboxes, sticky session header).
- But the active list fights the physical reality of doing rounds, and a few interactions break
  the design language.

### Findings

| # | Finding | Severity | Type | Recommendation |
|---|---------|----------|------|----------------|
| R1 | The hero header number is an **elapsed stopwatch** ("0:48 → 1:45 → 2:33") | 🟡 Moderate | UI | A big ticking clock on a chore run creates time-pressure and adds little. Make the hero number **progress** (e.g. "4 / 18 done", with a thin progress bar). Keep elapsed time if you need it for the Performance metrics, but demote it to secondary text. |
| R2 | Pastures is a flat list of 10 cards differing only by "Coop 1" vs "Coop 2", with the differentiator in small gray subtext while the bold title repeats | 🔴 Critical | MODEL+UI | Rounds are inherently **spatial and sequential** — you are physically *at* a location. Group the list **by sub-place along the walking route** (Mobile Coop 1 → its chores; then Mobile Coop 2). The location becomes the card header; the activity becomes the scannable title. Far fewer mis-taps, and the screen mirrors the walk. |
| R3 | Title line wastes the most valuable real estate: "Fill feeders" (bold, identical) repeats while the differentiator (Coop 1) is small + gray | 🟡 Moderate | UI | Resolved by R2 (location becomes the header). If you keep activity-grouping anywhere, swap the emphasis so the differentiator is the bold line. |
| R4 | Cancel uses a raw browser `confirm()` — cyan OK button, breaks the visual language; "Cancel / OK" is a double-negative ("Cancel" the cancel?) | 🟡 Moderate | UI | Replace with an in-app styled sheet using your green system. Use explicit verbs: **"Keep going"** vs **"Cancel run"**. Never ship `window.confirm` in a designed product. |
| R5 | "ALL TAKEN CARE OF" is styled like a status chip, not a button; text wraps awkwardly ("ALL TAKEN CARE / OF"); semantics ambiguous (mark-all-done vs nothing-here) | 🟡 Moderate | UI | Make it an obvious action: **"Mark all done"** with a check affordance, or a check-all control in the group header. Fix the wrap (shorter label / wider hit area). |
| R6 | Mortality and Eggs quick-log sheets are inconsistent. Eggs is clean (WHERE / FLOCK selected-highlight / HOW MANY stepper / LOG N). Mortality lacks a visible quantity control, the selected cohort isn't clearly indicated, the long cohort list scrolls behind a muted (disabled-looking) button | 🟡 Moderate | UI | Mirror the Eggs sheet exactly for Mortality: WHERE / COHORT (with selection highlight) / HOW MANY (stepper) / **LOG N LOSSES**, solid-green button. One sheet component, two configs. |
| R7 | Quick-log "LOGGING AT" context defaults: Eggs correctly inherits "Mobile Coop 1 · Pasture C"; Mortality defaults to "General — whole farm" even when you're at a coop | 🟢 Minor | UI | Inherit the active place/flock context into both sheets; let the user override. Logging mortality at a coop should pre-select that coop's flock. |
| R8 | Filter tabs overflow (EVERYWHERE / HOUSE / BARN / BROOD…) with "BROOD…" cut off and no scroll affordance | 🟢 Minor | UI | Add an edge fade / chevron so the horizontal scroll is discoverable. |
| R9 | Recent rounds shows 5 same-day sessions all "RESUME"-able (multiple in-progress runs for one day) | 🟢 Minor | UI/MODEL | Clarify the lifecycle: one active run per block per day? Label abandoned sessions "incomplete," and consider auto-finalizing or merging on resume so you don't accumulate ghost runs. |

### What works (keep)
- **Big cards + big checkboxes** — right for gloves, sun, one-handed use.
- **Quick-log bottom bar** (NOTE / MASH / MORTALITY / EGGS) — logging data *as you walk* is the
  killer feature of this surface. The Eggs sheet in particular is a clean pattern; standardize on it.
- **Sticky CANCEL / FINISH header** and the resume-able recent rounds.
- **Bulk-complete per group** is the right idea (just needs R5's clarity).

---

## How the two surfaces connect

The desktop fix and the rounds fix are **one fix**, not two:

```
Activity (chore)  ──fans out to──▶  Occurrences  ──rendered by──▶  TODAY (by block)
   • title                            (block × place)                Active Round (by place/route)
   • blocks: {set}
   • place-binding (BELONGS TO)
   • schedule (days / recurrence)
```

- Once `WHEN` is a set of blocks, ALL CHORES collapses to one row per activity (D1, D4).
- Once occurrences carry a place, the active round can group them **by location along the route**
  (R2) instead of by activity — which is what makes the field list short and walk-shaped.

So the recommended program of work treats the occurrence model as the shared foundation.

---

## Recommended sequence

1. **[MODEL] Multi-block `WHEN`.** Migrate one-chore-per-block records into activities with a block
   set. This is upstream of D1, D4, R2 and collapses the row count on both surfaces. Folds into the
   existing place-model batch work.
2. **[MODEL] Occurrence generation with place + route order.** Generate occurrences for TODAY and for
   rounds; give places a sortable route position so rounds can be walk-ordered.
3. **[UI] Surface separation.** TODAY and the active round read from the same occurrence stream but
   render for *execution* (minimal chrome, strip redundant metadata — D2; progress-first header — R1).
   ALL CHORES renders for *authoring* (one row per activity, schedule as a compact summary, expand to edit).
4. **[UI] Rounds polish.** Group-by-location (R2/R3), styled cancel sheet (R4), bulk-complete clarity
   (R5), unify quick-log sheets + context inheritance (R6/R7), tab overflow affordance (R8).
5. **[UI] Cross-cutting polish.** Unified pill system (default/due-today/overdue/countdown), contrast
   pass on gray metadata + deadline text (likely failing WCAG AA on white), `SORT ORDER` affordance (D6),
   rounds lifecycle cleanup (R9).

---

## Accessibility notes (apply throughout)
- **Contrast:** the light-gray metadata + "by the next block" deadline text is small and likely fails
  AA on white. Deleting the redundant metadata (D2) removes most of the problem for free.
- **Touch targets:** desktop checkboxes and far-right action icons are small; combined with deep nesting
  they're rough on the mobile "Now" surface. The rounds cards already get this right — match that scale.
- **The cyan `confirm()` (R4)** is also an a11y/consistency regression; the styled replacement should be
  focus-trapped and keyboard-dismissable.
