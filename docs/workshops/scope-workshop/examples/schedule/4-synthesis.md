# Schedule Feature — Scope Workshop Synthesis

**What this is:** the orchestrator's synthesis of the 6-lens Scope Workshop
(Cutter, Data-model purist, Field-ergonomics, UI Conventions,
First-principles, Reframer) on the new **Schedule** feature, run 2026-06-24
off the reviewed story set. Reserve commentary (Maximalist, Dad) is
appended. James decides the open questions (§6); those answers then seed
the **Scope Document**.

The headline: **all six lenses independently landed on the same core
model** — store deltas, derive the draft. That convergence (six blind
agents reinventing the same shape) is the strongest signal in the run.
The live decisions are about confirm-scope, surface count, and how much
conflict machinery to build — not about the data model.

---

## 1. What each agent contributed

- **Cutter** — found the floor: store almost nothing (a confirm record +
  sparse deltas + `time_off`); dissolve the activity/reservation taxonomy
  and the buffer subsystem; collapse man-down + protection to *flags + one
  hardcoded warning*; cut token-search, week-drag, month view, per-entry
  history. Most aggressive "what breaks if we delete it."
- **Data-model purist** — drew the precise stored-vs-derived line: a row
  exists **only when there's a delta** (untouched auto-populated chore =
  zero rows, like `event_occurrences` materializing lazily); `class`
  (work/reserved) is a *column*, not two tables; confirm writes a
  `manifest` + `digest` so a past day survives source deletion. Named the
  polymorphic `source_ref` (no FK) honestly as the price of one junction.
- **Field-ergonomics** — built outward from the field tap: one scroll of
  block "stops," a now-line, forward-focus dimming, inline one-tap ticks
  vs block-stops that open Rounds, start-time derived from `min(completed_
  at)`. Demoted week/month/search/buffer to a desktop "workbench."
- **UI Conventions** — mapped the whole feature to shipped prior art
  (Sunsama "plan your day" = the draft→confirm ritual; Motion = auto-slot
  into free time; Linear/Things command bar = search-to-add; Google Cal =
  now-line + this/all-future; Reclaim = buffers). Crucially flagged where
  the farm **breaks** the borrow: the draft is a *regenerable build
  artifact*, not a precious Sunsama doc; man-down is PagerDuty, not a
  calendar dismiss; never surface a parent-concept word — pick one flat
  noun, type it under the hood.
- **First-principles** — separated **must** (forced by animal welfare,
  needs no agreement) from **discretionary** (should/ad-hoc), and redefined
  **confirm** as agreeing the *discretionary band* + dropping a
  measurement anchor for plan-vs-actual — not "approve the whole day." The
  taxonomy dissolves: only *placement* + *reservation* are nouns; the
  chore/event/task union is a render-time adapter.
- **Reframer** — changed the unit from *the day* to **a single claim on a
  block of someone's time** (a "commitment"), pointing out the day is
  *already a query* (chores fan out at read-time, events from RRULE,
  projects by `sort_order`) — so a stored day-list is the wrong thing. Day
  / week / Calendar-month become three **zooms of one timeline**.
  Owned the highest migration cost (generalizing `chore_runs`).

---

## 2. Where they disagreed — and where I came down

| # | Question | Cutter | Data-purist | Field | Conventions | First-principles | Reframer | **My pick** |
|---|----------|--------|-------------|-------|-------------|------------------|----------|-------------|
| A | **Store the draft, or derive it?** | derive; store only deltas+confirm | derive; row only on delta | derive | derive (regenerable artifact) | derive (store the diff) | derive (day is a query) | **Derive every load; store only deltas + reservations + confirm.** Unanimous (6-0). |
| B | **Confirm = whole day, or just the discretionary band?** | one-button whole-day | whole-day status flip | whole-day | whole-day (Sunsama finalize) | **discretionary band only** (musts are forced) | freeze the day | **Whole-day, one tap** — but adopt First-principles' framing: musts render as non-negotiable, and the *value* of confirming is agreeing the should/ad-hoc + dropping the accountability anchor. (James decides — Q1.) |
| C | **One timeline (zooms) or two surfaces (Schedule + Calendar)?** | two | two (one event source) | two (field vs browser) | **two** (Sunsama+Cal precedent) | two (nouns differ) | **one timeline, 3 zooms** | **Two surfaces sharing one event source** (5-1) — BUT Schedule's *own* day/week/month is one renderer zoomed (Reframer's insight, kept). (James — Q2.) |
| D | **Parent-concept: base table + a word, or dissolve it?** | dissolve (refs + time_off) | `class` column, not 2 tables | n/a | never show a word; type under the hood | render-adapter, no table | one "commitment" row, work=derived | **No base `activity` table, no user-facing word.** Discriminator column + render adapter. Sidesteps the `activity_log` collision. Unanimous in effect. |
| E | **Confirm-snapshot thinness?** | JSON of the ref-list | manifest + digest | references-only manifest | (implicit) | confirmation snapshot | refs + thin display-label snapshot | **Minimal display-label snapshot** (label/time/class/person) — survives source deletion (S98). The one sanctioned crack in BD17; everyone reinvented it. (James — Q4.) |
| F | **Man-down / protection: flags or workflow?** | flags + 1 warning, cut S60 | keep S60 ack + history (cheap) | keep flag + ack | S60 = PagerDuty pattern, real | keep man-down + ack | keep; row is the audit unit | **Inline flag + conflict list (jump/next-prev) + covering-person ack (S60a). Defer S60b invalidate-on-edit-with-diff** as possibly over-built. (James — Q3.) |
| G | **Token search (S33a–d): build or cut?** | cut it | (n/a) | desktop-only | highest-build but required | (n/a) | reuse search index | **Build dedup + place/occurrence narrowing (S33a–c); treat full token grammar (S33d) as a stretch.** Reuse `useSearchIndex`. (James — Q6.) |
| H | **Per-person start time: auto or manual?** | derived | manual override optional | derived (min completed_at) | time-tracker stamp | captured for free at first tick | derived from `started_at` | **Auto-captured** from first started/completed item (resolves S129's open). (James — Q5, expected: confirm.) |
| I | **`buildTimelineItems` / `timeline_items` view fate?** | delete; promote into 1 view | retire the SQL view (half-built); absorb JS into one assembler | delete; today-strip is the one timeline | promote to Today view | delete; compute in JS | widen the view into the read model | **Delete `buildTimelineItems`; compute the live draft in JS (must derive offline); retire/demote the `timeline_items` SQL view to a past-history optimization.** Overview embeds the one renderer read-only. Unanimous on "one timeline." |

---

## 3. The unified pitch

**The model.** The Schedule stores three things and derives everything
else. (1) **Placements** — the thin junction: a row exists *only when
something departs from the auto-draft* (a should-chore pulled onto
Thursday with a "why today" reason; a one-day time/duration/assignee
override; a deferral/suppression; an ad-hoc task or note). Shape: a
polymorphic `source_ref` (type + id, no FK) + placement (date,
block-or-clock, person) + pact (reason, protected flag, overrides). An
untouched auto-populated chore has **no row**. (2) **Reservations** — the
one genuinely new domain object: non-work time (day off, appointment,
break) and buffers, per person, recurring- and multi-day-capable, with no
done-state. (3) **The confirm record** (`schedule_day`) — date, status
(draft/confirmed), confirmed_by/at, projects-window override, and a frozen
**minimal display-label snapshot** of what was on the plan at confirm
time, so the day stays a durable historical record even after a source is
deleted. The **draft is recomputed every load in JS** from the same
chore/event/project hooks the Dashboard already calls (chore anchor
fan-out, event occurrences, projects by `sort_order`), with placements +
reservations folded over as a diff — clear the placements and the pure
draft returns (regenerable, S21). There is **no `activity` base table and
no user-facing parent-concept word**: a render-time adapter unions the
kinds into "what's on the day," and work-vs-reserved is a derived
property, not an ontology — which sidesteps the `activity_log` naming
collision entirely. Completion stays **one truth**: ticking writes
`chore_completions` through the existing outbox; the Schedule never stores
completion. The **only write-back to a source is the event this/all-future
prompt** (`EventScopePrompt`). Per-person **start time is derived** from
the first started/completed item (auto-captured, not authored).

**The interaction — phone (Dad, in the field).** Lands on **today**: one
vertical scroll of block sections (Sunrise / Midday / Evening) with events
threaded at their clock times and reservations shown as greyed bands. A
**now-line** marks the moment; earlier-today is dimmed-but-present so
nothing silently falls off, but the next stop is the loudest thing on
screen. Top line: "Jim 6:12a · James —" (start times, glanceable, not a
leaderboard). Each block is a collapsed checklist ("Sunrise · 4 of 11");
tapping it drops into the **existing Rounds takeover** — they're married,
the block and the run are the same atom. Loose/"anytime" chores tick
**inline, one tap**, routed through the same `chore_completions` outbox op
(offline-safe, `CloudOff` glyph until synced). A single **"Confirm today"**
bar sits above a persistent **quick-log tray** (eggs/mortality/note —
rides the whole day, not gated behind a run); confirming collapses the bar
to a pill. If a source changed after confirm, the bar returns as **"3
changes since you confirmed — review"** (surfaced, never auto-applied).
Protected edits (move the first feed to afternoon) double-confirm and
*name why* ("the animals are waiting"), but never block.

**The interaction — desktop (James, the workbench).** The same today
renderer plus a **week rail** (drag any entry across days to rebalance;
global project order never moves) and a **month rhythm view** — the
Schedule's day/week/month are *one renderer at three zooms*.
**Search-to-add** is a command bar reusing `useSearchIndex`: it
collapses duplicate chore names to one result and narrows by
place/batch/time-of-day (full token grammar is a stretch goal). A
**reservations editor** and the **projects-only window** setting live here,
as does the **conflict / man-down list** (jump-to-context + next/prev
stepping). Editing an event routes through this/all-future. **Calendar**
(the renamed `Schedule.jsx`) stays as the browse/manage-events-over-time
sibling, sharing the one `event_series` source — Schedule composes a day,
Calendar manages externalities across time.

**What the existing surfaces become.** `buildTimelineItems` is **deleted**
and its job promoted into the single day renderer the Schedule, the
Dashboard glance, and Now all call; Overview keeps a read-only mini-agenda
that deep-links in (one timeline, BD15). The `timeline_items` SQL view is
**retired/demoted** to a past-history optimization (it omits projects and
read-time recurrence — wrong for the live draft, which must derive in JS
to work offline). `Schedule.jsx` → **Calendar**, near-unchanged. The
**chores rebuild, Rounds, and quick-log are kept whole** as the recurrence
engine + field-execution surface; the Schedule *references* what the chore
engine emits, adds **zero** scheduling fields to `chore_definitions`
(BD3), feeds Rounds rather than reimplementing it (BD16), and inherits the
one completion truth (BD5).

---

## 4. Risks (the honest part)

1. **The derive-and-fold merge is the richest bug surface** — above all, a
   placement that points at a source that *no longer emits* (a deleted
   chore, an occupancy that moved a tractor, a cancelled event). Needs an
   explicit "orphaned placement" resolution path, not an afterthought.
2. **The confirm snapshot is a real, sanctioned crack in "never a copy"**
   (BD17). It must be scoped to minimal display fields (label, time, class,
   person), or it drifts back toward the frozen content-copy the
   constraints forbid. Six lenses independently hit this — it's unavoidable,
   so it must be *bounded*.
3. **Offline re-derivation cost.** The chore anchor fan-out + recurrence
   expansion + project sort must run client-side on Dad's phone with no
   signal, every load. Performance and cache-correctness risk; the draft
   can't quietly depend on a server view.
4. **Man-down coverage-acknowledgment has no consumer-planner ancestor**
   (Conventions: it's PagerDuty/on-call, not Sunsama). Risk of building an
   ops-grade state machine (esp. S60b invalidate-on-edit-with-diff) for a
   two-person farm that mostly resolves coverage by talking.
5. **Two surfaces (Schedule + Calendar) is real IA cost.** The line —
   "agree the day here, manage market dates there" — will blur for Dad;
   the nav now has two time-ish entries where he expects one "schedule."

---

## 5. Things I'm explicitly NOT pulling forward

- **Reframer's `chore_runs`-generalized unified `commitments` table.**
  Highest migration cost of any pitch; can't be additive; touches the live
  execution path. **Rejected as the storage model** — but its *insights*
  are absorbed: day/week/month as zooms of one renderer, and
  work-vs-reserved as a derived property rather than a taxonomy.
- **Cutter's deletion of man-down + the conflict list + per-entry
  history.** Too far against the explicit Epic E/F stories; the delta model
  gives lightweight history almost for free. **Kept, scoped down.**
- **The full token-grammar search (S33d).** Deferred to a stretch; the
  dedup + place/occurrence narrowing (S33a–c) is the load-bearing part.
- **S60b (invalidate-acknowledgment-on-edit + diff) and session
  undo/rollback (S74 extras).** Deferred pending Q3 — possibly over-built.

---

## 6. Open questions for James (decide these before I draft the Scope Document)

1. **Confirm scope (table B).** One-tap **whole-day** confirm (Dad's
   mental model of "the agreed day"), or First-principles' **discretionary-
   band-only** confirm (musts are forced by welfare; you only agree the
   should/ad-hoc + drop the accountability anchor)? My lean: whole-day one
   tap, but musts visibly render as non-negotiable.
2. **Surface count (table C).** **Two surfaces** (Schedule + Calendar,
   sharing one event source) vs Reframer's **one timeline, three zooms**
   (Calendar = the event-filtered wide zoom)? My lean: two surfaces; keep
   "three zooms" only *within* the Schedule. This is the BD9 decision.
3. **Man-down machinery (table F).** Flags-only (Cutter), or flag +
   covering-person acknowledgment (S60a), or the full invalidate-on-edit +
   diff (S60b)? My lean: flag + lightweight ack now; defer S60b.
4. **Confirm-snapshot thinness (table E).** References-only (history blurs
   if a source is later deleted) vs a **minimal display-label snapshot**
   (survives deletion; a small, bounded denormalization). My lean: the
   minimal snapshot — accept the one crack, bound it tightly.
5. **Per-person start time (table H).** Confirm **auto-captured** from the
   first tick (all six lenses converged), dropping the manual-entry option
   in S129? My lean: yes, auto.
6. **Search ambition (table G).** Ship dedup + place/occurrence narrowing
   now and treat the full token parser (S33d "fill water sheep" →
   type-per-token) as a later stretch? My lean: yes.

---

## 7. Push back on anything

The three places this synthesis is least certain:
- **Confirm scope (Q1).** First-principles' "musts aren't agreed, they're
  forced" is the sharpest idea in the whole run, and it may mean the
  *whole* confirm ritual is lighter than the story set assumes. If the
  morning conversation already settles the day, confirm risks being
  ceremony — worth a hard look before we build it.
- **Two surfaces vs one (Q2).** The cleanest designs (Reframer) merged
  everything into one timeline; I picked two for migration cost and Dad's
  sake, but if you want the consolidation you originally hoped for, one
  surface is defensible.
- **How much offline re-derivation is safe (risk 3).** If the client-side
  chore fan-out is too heavy, we may be forced into a cached/materialized
  day after all — which dents the "pure regenerable draft" purity. This is
  an engineering unknown that could reshape the model.

---

## 8. Reserve-lens commentary

*Per playbook §8.1: the reserve lenses react to the synthesis from their
angle. Two points below are strong enough that I am NOT silently absorbing
them — I'm flagging them for James as decision-changers (see §9).*

### Reserve commentary — Maximalist
- **Where the synthesis is right (from my angle):** The derive-and-diff
  model is the opposite of a foreclosure — backward-planning prep off a
  market/processing day, and the week/month "where is work bunching"
  rollups, fall out for free (the day is a query; the timeline is one
  renderer at three zooms). The reservation, drawn as a real per-person,
  recurring, multi-day object with no done-state, **already is** the
  availability/capacity primitive; it can grow without a re-platform.
- **What worries me most:**
  - **Epic L (routine drift) is the stated reason this feature exists
    (S88, S117 — "the thing we're trying to fix") and the synthesis never
    mentions it** — not in the pitch, not in risks, not even in "not
    pulling forward." The confirm snapshot is justified entirely as
    *survive source deletion* (a durable **record**), which is a different
    shape than *comparable over time* (queryable **data**). A
    label/time/class/person freeze answers "what did the day say," not "is
    power-wash slipping to its deadline every week" (S118) or "does every
    market day collide with evening chores" (S121).
  - **The drift signal lives in placement rows** (deferrals, "why today,"
    overrides) — **the very rows the model sells as disposable** ("clear
    them and the pure draft returns," S21). Regenerability is right for the
    *draft*, but it parks the only record of routine drift on the most
    throwaway-feeling rows. Most days go unconfirmed (S9); if their
    placements are ever purged, the data the feature exists to surface is
    gone before any screen shows it — irrecoverable, unlike a deferred UI.
- **One change I'd make:** Decide the **retention contract now**, even
  though the drift UI ships later: confirmed days and their placement
  deltas are never garbage-collected, and confirm freezes the *planned
  shape* (planned start/block boundaries + which should-chores were
  deferred), not just a display label. A one-time near-free storage
  decision today; the one thing here that can't be additively fixed in v2,
  because you can't reconstruct history you threw away.

### Reserve commentary — Dad (skeptical operator)
- **Where the synthesis is right (from my angle):** The phone flow matches
  how I read my day — open, one scroll top to bottom, the next thing is
  loudest, the now-line says where we are. I don't build anything; it's
  already there. One-tap confirm (not a form), and egg/mortality/note
  logging riding the whole day instead of hidden behind a round — that's
  the field, and I can learn it in a morning.
- **What worries me most:**
  - **Two surfaces, one word in my head.** I call both "the schedule." If
    the nav has a *Schedule* and a *Calendar*, I'll open the wrong one half
    the time and not know why one shows chores and the other shows market
    day. That's not first-use friction — it's a fork I re-hit every day.
    "Compose a day here, manage externalities there" is a sentence James
    understands; it means nothing to me at 6am.
  - **Two ways to tick done on one screen.** Some chores I tap right there;
    some send me into the Rounds takeover. Nothing tells me *why this one
    and not that one* — that distinction lives in James's head, not mine,
    so the rule looks random. Durable confusion.
  - **"3 changes since you confirmed — review"** reads to me as "did I do
    something wrong?" — like the day I agreed to got pulled out from under
    me. It needs to say *who* changed *what* in plain words, or I'll tap
    past it. (Quieter worry: if the day works fine unconfirmed, I may never
    learn what confirming buys me — it'll feel like ceremony.)
- **One change I'd make:** On the phone, give me exactly one time-thing
  called **Schedule** — fold Calendar's browse/manage view inside it (or
  leave Calendar desktop-only, James's tool). One door on the device I use
  one-handed in the field kills "which one do I open?" — the man-down "I've
  got it" tap and the day's checklist all live behind that same door.

---

## 9. Orchestrator note — two reserve points that should change a decision

Not absorbed silently, per §8.1. Both are compelling:

1. **Retention contract (Maximalist) → new decision, Q7.** The synthesis
   under-served Epic L. Whatever we decide on the confirm snapshot (Q4),
   we should *also* decide now that **confirmed days + their placement
   deltas are never GC'd, and confirm freezes the planned shape** (planned
   block boundaries + which should-chores were deferred and why), not just
   a display label — because routine-drift history can't be reconstructed
   later if thrown away. This is nearly free today, irreversible if missed.
2. **Phone = one door (Dad) → reframes Q2.** Dad's "two surfaces, one word"
   is the strongest argument yet for collapsing the IA *on the phone*. It
   doesn't force one-surface-everywhere — the clean resolution is
   **device-tiered**: the phone shows a single **Schedule** door
   (Calendar's event-management folded in or simply absent on mobile);
   Calendar stays a desktop sibling for James. That keeps the two-surface
   data model (Q2) while removing the daily fork for Dad. I recommend this.
