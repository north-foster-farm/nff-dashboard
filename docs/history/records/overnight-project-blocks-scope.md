# Overnight + Project blocks — Scope Document

**Status:** SETTLED 2026-06-26. Output of the 5-lens Scope Workshop
(Data-model purist, Field-ergonomics, Cutter, Reframer, UI Conventions) +
reserve round (Maximalist, Dad, First-principles) + James's decisions on
every open question. It defines **what these two Schedule additions are,
what's in v1, what's deferred, and how we'll know they're done.** Input to
the **Design Bracket** (the visual/interaction-design competition next).

**Reads with:** `overnight-project-blocks-stories.md` (the accepted story
catalog O#/P# + BD#, the acceptance detail), `overnight-project-blocks-
scope-workshop-synthesis.md` (how we got here), and the parent Schedule's
`scope-document.md` (the commitment/derive model these extend).

---

## 1. Purpose — one sentence

Fully **tile the Schedule day**: the negative space between chore blocks
becomes legible work-time — derived **Project blocks** fill the gaps between
(and before the first) chore blocks, and a derived **Overnight block** owns
the wrap-around span from the last chore block tonight to the first chore
block tomorrow — so "what are we doing between chores?" and "where does
4 a.m. work live?" are answered on the same surface that already answers
"what chores, when?"

Both are **pure derivation over the existing model** — no new source of
truth, no copied content; the day's chores/projects/events stay the only
truth, surfaced in newly-named windows.

---

## 2. The settled model

All five lenses independently converged: **both blocks are pure derivation,
zero stored block rows; the overnight item is ONE commitment surfaced on two
days; v1 ships with zero migrations.** James's decisions chose the tightest
realization of that convergence.

### 2.1 One ribbon partitioner (the shared engine)
A pure client-side function inside `deriveDay` resolves **every active
chore-block definition that occurs this calendar day** (and tomorrow's first
block) via `resolveBlockMinutes` / sun-times, sorts them, and walks the gaps
to emit an ordered, **non-overlapping, gap-clamped** set of derived
segments:
- a gap **before the first** or **between** chore blocks → a **Project
  block**;
- the trailing gap `[lastChoreEnd(today), firstStart(tomorrow))` → the
  **Overnight block**.

Segments are synthetic rollups appended to `choreRollups` with reserved
bucket ids (`"overnight"`, `"project:<startMin>"`), exactly like today's
`"anytime"` bucket. **Nothing about a block is stored.** `rollupChoresForDay`
changes from **sparse** (emit only blocks with work) to **total for
windowing** (resolve all occurring definitions so gaps can be derived) —
chore *rendering* stays sparse (empty chore blocks still hide).

### 2.2 One placement function (the catch rule)
A single `segmentForStart(startMinutes)` routes any chore instance /
`project_node` / `ad_hoc` / event into the segment whose half-open
`[start, end)` window contains its start. The Overnight "catch," the
project-step auto-route (P-B8), and ad-hoc adds all call it — **there is no
second placement path.** An item at *exactly* a chore block's start belongs
to that chore block, not the preceding gap/overnight (O-B3).

### 2.3 The two-day Overnight span — one row, no copy
An overnight item is an ordinary commitment with its **literal**
`(run_date, clock_time)`: an 11 p.m. task on the start date, a 4 a.m. task
on the next morning's date — no offset flag, no wrap-encoding, **no
duplicate row.** Day D derives `[lastChoreEnd(D), firstStart(D+1))` as its
trailing segment; day D+1 derives the *same interval* as its leading
segment; each reads the overlapping calendar dates' rows, so the identical
item surfaces in both places. **Ticking it toggles the one underlying row**
— "one shared completion truth" (O-B4) is an identity, not a synced feature.
This requires `deriveDay` to read **neighbor-day deltas** (D−1 evening +
D+1 pre-dawn) so the overnight edges populate offline.

### 2.4 Project gaps subtract real availability
Each gap is **trimmed** by every `bufferWindow` and `reservationWindow`
(time-off) overlapping it, clamped to the farm-wide default earliest/latest
band, and **dropped** if the result is < 30 min (P-B3) or **nobody is free**
across it (P6). The partitioner attaches **structured per-segment
availability — `{freeCount, who:[…]}`** — to each segment (Maximalist's
ask): v1 renders a quiet "who's free" badge, but "both free" (the scarce
resource for two-hand jobs) stays one branch away, not a retrofit.

### 2.5 Auto-pull is display-only derivation
Each Project block defaults to the **`sort_order`-min active project's next
incomplete step** — derived live, **writing nothing on open** (honors
no-silent-mutation). It's a swappable default occupant. To avoid the same
step rendering N times, the auto-pulled step shows in the **first** Project
block only; later blocks fall to the next step or show the emphasized-empty
state. Adding a specific project/phase/step/checklist item or an ad-hoc task
auto-routes by time (§2.2); completing an item writes through to the
**project step** (one truth, no block-level done/seal status — P-B7).

### 2.6 Conflict exemption / consumption
Overnight is **exempt** from man-down / double-book / buffer-squeeze (O-B6):
overnight-tagged rows are skipped in `computeManDown` /
`doubleBookConflicts` / `bufferSqueezes`. Project blocks generate no
conflicts of their own (no block-level assignee) and instead **consume** the
same reservation/buffer-window math to trim their span (§2.4) — shared code,
not duplicated.

---

## 3. Decisions ledger (every resolved question)

| Question | Decision |
|----------|----------|
| **Overnight counting (Q1)** | **Start day only.** The block **shows on both days** and completion is **one shared tick**, but each overnight item counts toward **only the start day's** totals, week/month badges, and confirm snapshot. **This strikes O-B4's "both days" clause; O-B5 and O-B7 (start-day-only) stand.** Resolves the locked-set contradiction First-principles caught. |
| **Proportional drawing (Q2)** | **Span label + coarse size step in v1; defer pixel-accurate duration-to-height bars.** The header range text (e.g. "1:00–4:30") carries "how long is this gap." Real duration-to-height is a navigator change (the shipped spine/strip sizes by item count, one block at a time) — deferred to a fast-follow. |
| **Auto-pull (Q3a)** | **Keep, display-only.** Top project's next step as a swappable default occupant, derived live, zero writes on open, first block only. |
| **Per-day boundary override (Q3b)** | **Deferred** (unanimous). Ship the farm-wide default earliest/latest; the per-day override editor + its `project_bounds` storage land later, additively. |
| **Empty-block confirm warning (Q4)** | **Softened to a passive note** — no confirm gate. An empty (but available) Project block shows emphasized with a quiet "free — nothing planned" note; confirming is **not** interrupted. Reframes empty time as a prompt, not a defect, and removes the cry-wolf risk on the shared man-down gate. |
| **"Down day" definition (baked in)** | **Occurrence-based.** Overnight anchors come from block definitions that **occur this calendar day** (weekday/sun schedule), regardless of whether they have completable work. A true down day (zero occurrences) has no anchor → Overnight correctly absent (O-B1). O-B2's "well-defined even on a down day" clause is narrowed accordingly. |
| **Availability shape (baked in)** | **Structured `{freeCount, who:[…]}` per segment**, rendered as a quiet badge in v1. |
| **Routing (baked in)** | **One `segmentForStart` function** for overnight catch + project auto-route + ad-hoc add. |
| **Migration (baked in)** | **Zero in v1.** The only candidate new storage (per-day `project_bounds` override) is deferred; when it ships it's one additive `source_type` whitelist, no table. |

---

## 4. In scope — definition of done, by feature

The behavior detail is the story set; this is the v1 acceptance bar.

### 4.1 Overnight block (Epics ON-A/B/C + boundaries)
- Window **derives client-side, offline**, from chore-block definitions that
  **occur** on day D and D+1 + sun-times; defined every night except a true
  down day (zero occurring definitions), where it's absent.
- Belongs to **two days**: renders **last** on the start day, **first** on
  the end day, **same contents**, with a **stable prior-evening range label**
  ("Overnight · 9:40p–5:10a") and a two-day glyph so it reads as one shift.
- **Catches by start time** (half-open `[lastEnd, firstStart)`); **not
  pickable** in add/edit; retiming an item out of the window moves it (and
  its `run_date` if it crosses midnight) to wherever its new time lands.
- **No rounds** (no "Open rounds"); **hides when empty**; **exempt** from all
  three conflict checks.
- The **same item ticked on either day toggles one row**; it **counts on the
  start day only** (totals, week/month badges, confirm snapshot).
- **Two shipped code fixes are part of done:** `startKey` must **pin the
  end-day overnight first** (not sort it last by start-minute); `pickNowBucket`
  must mark overnight **"now" before sunrise** (the `startMin <= nowMin` wrap).
- **Cold-cache safety:** when neighbor-day deltas aren't yet cached, the
  morning Overnight renders a **"syncing…" state, never a false empty**
  (Dad's ask — empty must always mean empty).

### 4.2 Project blocks (Epics PB-A/B/D + boundaries)
- Gaps **between** chore blocks + **before the first** derive client-side;
  the **after-last window is Overnight, never a Project block** (P-B1).
- Each gap's span = real available time after **subtracting buffers +
  time-off**, clamped to the farm-wide default band, **dropped** if < 30 min
  or nobody's free; **recomputes live** as buffers/time-off change.
- **Proportional via span label + coarse size** (not pixel-accurate bars).
- **One shared span** annotated with a quiet **who's-free badge** (no
  per-person lanes); structured `{freeCount, who}` underneath.
- **Auto-pull** the top project's next step as a swappable default occupant
  (first block only, display-only, zero writes); add specific
  project/phase/step/checklist items + ad-hoc tasks; items **complete and
  update the underlying project** (one truth); **no block done/seal status**.
- Item adds **auto-route by time** into the containing Project block (P-B8).
- An **empty-but-available** Project block **shows, emphasized**, with a
  **passive note** (no confirm gate); a **nobody-home** gap is **absent**
  (the two states must not be conflated).
- A gap shrinking below 30 min mid-session **drops its block and re-homes
  any item already routed there** (defined fallback — surface on the nearest
  surviving Project block or an "anytime" note — never a silent orphan).

---

## 5. Explicitly deferred / out of scope

- **Deferred (fast-follow, additive):** pixel-accurate duration-to-height
  proportional bars (needs the navigator change); the per-day boundary
  override editor + its `project_bounds` storage; spreading the top
  project's next N steps across multiple blocks (P-B6 — v1 is top step in the
  first block only).
- **Rejected:** Overnight as a first-class queryable "night" entity (it's a
  derived window, not a stored key); counting overnight on both days
  (struck — start day only); a confirm gate on empty Project blocks
  (softened to a passive note); per-person Project-block lanes (decided
  against — one shared span); block-level done status for Project blocks.
- **Out of v1 entirely (inherited from the parent Schedule scope):**
  weather-aware scheduling; travel-time/leave-by routing; any
  resource-leveling solver; auto-scheduling that *moves* chores; per-person
  hour-budget math beyond "who's free in this gap."

---

## 6. Reserved for the Design Bracket (next stage)

The Bracket decides look + interaction, not scope. Carried in:
- **The two-day Overnight affordance** — how the same shift reads as *one*
  thing on two day views (the "continues ↑/↓" glyph, the range label, the
  last-tonight / first-tomorrow placement) without reading as a duplicate.
- **Proportional within the count-sized navigator** — how the span label +
  coarse size step present "this afternoon is bigger than that morning gap"
  on phone and desktop *without* the full duration-to-height rewrite; and
  whether the eventual real bars are worth the navigator change.
- **The who's-free badge** — quiet annotation vs the "both-free window"
  emphasis (the Maximalist's two-hand-job signal), without a free/busy grid.
- **Empty-Project-block emphasis** — how "free — nothing planned" + the
  auto-pulled next step reads as an inviting prompt, not a defect or noise.
- **Auto-pull occupant ergonomics** — the swap gesture, and how the
  first-block-only rule looks when a day has several Project blocks.

---

## 7. Completion criteria (how we know v1 is done)

1. **Overnight derives offline** from occurring block definitions + sun-times
   at D and D+1, for every night including down days (absent only when zero
   definitions occur).
2. A clock-timed overnight item appears in the **correct overnight block on
   both day pages from one stored row**; ticking on either page toggles that
   one row; it **counts on the start day only** in totals/badges/confirm.
3. Retiming an item across midnight is a **cross-day move that preserves its
   id** (so confirm change-detection sees present, not removed+re-added).
4. Overnight is **exempt** from man-down/double-book/squeeze and shows **no
   "Open rounds."** `startKey` pins it first before sunrise; `pickNowBucket`
   marks it "now" at 4 a.m. A cold cache shows **"syncing…", never false
   empty.**
5. **Project gaps** derive from definitions minus buffers + time-off, bounded
   by the farm-wide default, recomputing live; **< 30 min or nobody-home
   gaps produce no block**; a gap shrinking below 30 mid-session **re-homes
   its items, no silent orphan.**
6. Each Project block **auto-pulls the top project's next step (first block,
   display-only, zero writes on open)**; added items auto-route by time;
   completing an item **updates the underlying project step**; the block has
   **no done/seal status.**
7. An empty-but-available Project block **shows emphasized with a passive
   note** and **does not gate confirm**; a nobody-home gap is **absent.**
8. A **property test** asserts the partition is ordered, non-overlapping,
   non-negative (DST + sun-drift gaps clamped to ≥0, inverted gaps dropped),
   and tiles the ribbon — and that Overnight/Project/ad-hoc placement all go
   through the single `segmentForStart`.
9. **Zero new migration** in v1.

---

## 8. Risks carried forward

1. **`rollupChoresForDay` sparse→total is the richest new bug surface** —
   the gap derivation, cross-day fold, and "resolve all occurring
   definitions" rewrite the load-bearing assembly on a live offline path.
   The §7.8 property test is the cheap insurance.
2. **Neighbor-day offline reads** — the two-day span depends on D±1 deltas
   being cached; the "syncing…" state (§4.1) covers the cold case, but the
   read-side fan-out must actually land in the offline cache.
3. **DST + sun-drift malformed gaps** — minute-of-day math (1440 + the
   `+1440` cross-midnight offset) mis-measures the span on the two DST
   nights, and a fixed block vs a sunset block overlapping only in winter
   can yield a negative-length gap. Clamp to ≥0, drop inverted.
4. **Auto-pull "same step in N blocks"** — the first-block-only rule (§2.5)
   resolves the duplicate-render cascade; verify ticking the step in the
   first block re-derives the rest cleanly.
5. **The proportional deferral is a UX bet** — if "the afternoon visibly
   dwarfs the morning gap" turns out to *be* the feature in use, the span
   label won't satisfy and the navigator change moves up. Validate with the
   Bracket mockups before committing.
