# Round 3 — JOINT build plan (Operator + Systematizer, reconciled)

_One agreed plan. Operator's product IA (phone-led signals, live Rounds) on
Systematizer's rails (one promoted vocabulary in `ui.jsx` + `farmLoad`). This is
the build brief; the companion `CHANGE-MAP.md` is what James greenlights first._

This is a **view-layer remix, not a data-model change.** No migration, no table,
no schema touch. Every shared hook/lib named in the inventory is preserved and
consumed as-is. The only new files are presentation primitives and one thin
derivation (`farmLoad`) that **reads** existing walks. Flagged explicitly: **no
proposal touches the data model**; if any step appears to, it is wrong and stops.

---

## 0. Resolved disagreements (binding)

1. **Desktop emphasis.** The desktop Schedule is **FIRST-CLASS and COMPLETE** —
   no global opacity demotion, no "scan/plan afterthought" framing. It is the
   workbench where the dense data (buffers, conflicts, drag-reorder,
   reservations, project gaps) lives and where the one-typeface consistency is
   legible (James G4 + the "build a real functioning desktop schedule page …
   with all the same information and data … more detail" mandate). **Phone
   remains the lead glance/doing tier** for Dashboard-Today and Rounds (Operator
   L1). Both are true: desktop leads the *workbench*, phone leads the *signals*.
   The Operator mockup's `opacity:.96` desktop killnote is **dropped**.

2. **Completion stamp name → `FinishStamp`.** One name everywhere. Copy
   "Finished · who · window · N/N" (or "Completed"). The word "Sealed" / "the
   seal" is killed (C5). Applies to the **whole run**, never a sub-bucket/place.

3. **`farmLoad` scope → pragmatic middle.** A **thin presentation collapse** that
   REUSES `deriveDay` / `rollupChoresForDay` / `projectGaps` / `manDown` /
   `weekFullness` / `weekShouldHeat`. It does **not** rewrite the derivation
   engine. Per block it exposes `{ blockId, name, kind, total, done,
   projectCount, state, window }`; per week it folds the existing fullness + heat
   walks. Operator's "fuller derivation" framing and Systematizer's "thin collapse
   over deriveDay" collapse to the same thing: read, don't replace.

4. **Other conflicts:**
   - **LoadSpine polymorphism** — NOT one god-widget. Rounds keeps its
     completion-fraction progress bar (`prog`); Dashboard/Schedule/Week use the
     item-count `LoadSpine`. Visually kin (same bars/tokens), semantically
     distinct. (Both agents already agree; recorded so it doesn't drift.)
   - **Confirm-DAY — KEPT (James, 2026-06-29).** Distinct from block completion.
     Two orthogonal concepts the reconciliation had wrongly conflated:
     * **Block completion** — auto-derived, no submit gate (the "finished by
       completion" thesis; correct, applies to a block/run). UNCHANGED.
     * **Confirm-the-day** — a deliberate plan-level ACTION James + his dad
       perform to mark a day discussed/planned. KEPT as a real affordance,
       restyled flush into the vocabulary (a confirm control on the day header,
       not a raised `ConfirmCard`). It must preserve all three of its purposes:
       (1) the shared confirm action itself; (2) the plan snapshot at confirm
       time (`schedule.confirmed_day` capture) so later drift is highlighted;
       (3) the data points (confirm frequency, how often confirmed days change,
       deviation from confirmed shape). The "N changes since confirmed" delta
       renders as the passive `AlertStrip` (no longer a gate), but the confirm
       button/badge + capture write are RETAINED.
   - **Person-lane** — KEPT as a conditional `.lanes` overlay on `LoadSpine`,
     drawn only when `farmLoad` reports real reservation/assignment segments;
     never the base layer. `personLoad.js` is scope-narrowed, not deleted.
   - **should/must words** — dropped from UI (C3/L5); the *signal* survives as a
     window-of-time visual. Replacement words are out of scope (parked workshop).

---

## 1. Promoted primitive vocabulary (lands in `ui.jsx` / thin `ui/` folder)

Built **once**, imported by all four pages. Names match DESIGN.md /
DESIGN-SYSTEM.md — we extend the documented system, not invent beside it. Every
primitive must be documented in **both faces** of the design library
(`public/style-guide/` visual docs + `DESIGN-SYSTEM.md`) as it lands.

| Primitive | What it is | Props / states | Absorbs (real source) | Tokens |
|---|---|---|---|---|
| **`Pane`** | Flush bordered in-page section (never raised) | `{title, subtitle, eyebrow, icon, actions, children, className, tone}`; `tone="warn"` tints whole pane via `color-mix(--c-warn N%, --c-bg)` | `ui.jsx:42 Card` (flush-flip) | `border border-line` on `--c-bg`; **not** `bg-surface` |
| **`Eyebrow`** | Inter uppercase micro-label, one idiom | `{children, tone, trailing}` | `ui.jsx:14 LABEL_CLS`, Chores `T.*` spans, Card header span, Rounds block eyebrows | `font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-faint`; `tone="warn"` |
| **`Heading`** | Lora title, one idiom | `{children, level: page\|section\|hero}`; `tabular-nums` when a count | `PageHeader`, Chores inline `h2`, Rounds hero number | `font-heading -tracking-[0.01em]` (hero `-0.02em`) |
| **`NowRule`** | Green hairline + dot + glow + "Now · time" | `{time, viewingToday}` — draws only on today-views | `Schedule.jsx:340 NowMarker()` + Rethinker pool copy | `--c-now` / celadon glow |
| **`AttentionCard`** (+ compact `Hole.row`) | The one amber obligation card | `{kind:"cover"\|"overdue", work, where, reason, action, onAct}`; full card + one-line `Hole.row` variant | `Schedule.jsx blockAlerts()` man-down, `ChoreCheckRow.jsx:43 border-l-2 bg-warn/5` escalation | flat `color-mix(--c-warn, --c-bg)` body fill; **hatch only in text-free gutter/corner** (C4); `Eyebrow tone="warn"` + ⚠ Lucide + Lora work line + solid-amber action (C6) |
| **`FinishStamp`** | Whole-run completion stamp | `{who, window, ratio}`; copy "Finished/Completed · who · window · N/N" | n/a (today completion auto-derives; no "seal" word existed) | celadon ✓ in a square (C5) |
| **`LoadSpine`** | Count-driven height bars = the dynamic day-load | `{blocks}` where `blocks = farmLoad(date).blocks`; per bar `{blockId, label, total, done, projectCount, state, kind, window}`; `state ∈ {done, committed, now, future, over, hole}`; `kind ∈ {chore, project, event}`. Optional `.lanes` overlay layer | `DayRibbon` combined silhouette + spine bits, `DaySilhouette` | height ∝ count, **clamped** `% of track` + `overflow-hidden` (B2); count label **beside** the spine; project bars `--c-project` not blue (C7); man-down bar `hole` (text-free hatch) |
| **`EventRow`** | One left-color-bar timeline row | `{title, meta, cat, flag}` | `Overview.jsx:489 TimelineRow` + `Schedule.jsx:246` left-bar + `EventEntry` | `box-shadow:inset 3px 0 0 var(--cat)` + `color-mix(cat, transparent)`; `cat` from one token map; chore-time blue reserved (C7) |
| **`CheckTarget`** | The 28px completion box, factored out | `{done, queued, pending, onToggle}` | `ChoreCheckRow.jsx:92 w-7 h-7 border-2` box | one tap target app-wide; `queued` → `CloudOff` Lucide (offline) |
| **`WeekStrip`** | The week, drawn ONCE | `{week}` from `farmLoad`; two layouts off one data: desktop **sidebar row-per-day** (`day · count · mini-spine · should-tick`), phone **7-col header** | `WeekSpines` (center) + `WeekList` (sidebar) collapsed | should-escalation = **one tick/outline per day** (C2), intensity = hottest chore via `farmLoad.heat`; capped + `overflow-hidden`, overbook = intentional warn top-rule (B1) |
| **`WindowBar`** (small) | Window-of-time track for one obligation (the L5 visual) | `{opensMin, closesMin, remaining}` from `choreDaysRemaining` | `ChoreRemainingPill` should/must **text** (signal kept, words dropped) | warms amber → `--c-cat-processing` as it narrows; no "should"/"must" words (C3) |
| **`AlertStrip`** (supporting) | One flush warn strip | offline / "N changes since confirmed" / overdue context | `Schedule.jsx:2237` banner + source-change ribbon | flush warn; passive, never a gate |

**Untouched engines (non-negotiable):** `ChoreCheckRow`'s completion path,
`useChoreCompletions`, `getChoresForDay`/`expandChoreForDay`/`obligationPlaceIds`,
the outbox offline-first path, `useChoreRuns`/`useRunEvents`. We restyle
containers and relocate escalation; we never re-implement the tick path.
`ChoreCheckRow` keeps its drag/edit/modifier/remaining-pill behavior — it merely
**composes** the new `CheckTarget` and its escalation chrome moves to
`AttentionCard`/`Hole`.

`StatTile` flush-flip is a **deferrable** follow-up (not blocking).

---

## 2. `farmLoad` spec — the linchpin (G1/G2/G3)

`src/lib/load/farmLoad.js` — a thin presentation collapse over the existing
walks. **It reads; it never replaces `deriveDay` or the engine.**

### Signature
```
farmLoad(date, {
  blocks,        // useChoreBlocks().blocksOrdered — the live chore_blocks defs
  completions,   // useChoreCompletions(date)
  sites,         // useSites() — fan-out + occupancy
  definitions,   // useChoreDefinitions()
  deltas,        // useScheduleDeltas — commitments (project + reservation incl.)
  week,          // ±range for the WeekStrip
}) -> {
  day,
  blocks: [{ blockId, name, kind, total, done, projectCount, state, window }],
  week:  [...weekFullness folded],
  heat:  [...weekShouldHeat folded],
  lanes: null | [...buildPersonLanes],   // conditional overlay only
  totals: { items, blocks, uncovered },
  heatColor(), loadColor()
}
```

### Inputs from real hooks/lib (reuse, don't rewrite)
- **Blocks are the organizing principle (G1).** Start from
  `useChoreBlocks().blocksOrdered` active blocks
  (`{id,name,slug,startKind,startMinutes,durationMinutes,sortOrder,isActive}`).
  **No hardcoded `["Morning","Midmorn",…]` array survives** — add/remove a block
  on Chores › Blocks and every day-load on every page redraws. That is G1
  satisfied structurally, not cosmetically.
- **Per-block counts.** `rollupChoresForDay` (`deriveDay.js:30`) groups expanded
  instances by `chore.blockId ?? "anytime"`; fan-out is
  `getChoresForDay`/`expandChoreForDay`/`obligationPlaceIds`. `total =
  items.length`; `done = completions.isDone` over each item's `(choreId,placeId)`.
- **Projects (G2/G3).** `deriveDay` already returns `projects[]` +
  `projectSegments[]` (`projectGaps()` in `partition.js:142`), and `DayRailSpine`
  already renders project gaps as bars on **one** surface. `farmLoad` lifts that
  into the shared model: project blocks become `kind:"project"` columns
  (`projectCount` per block; standalone project bars where they sit) colored
  `--c-project` (never blue/`--c-egg` — C7), and interleaved project `EventRow`s
  appear on **all four** pages, not just the Schedule rail. That lift is the real
  G2/G3 delta. `who.freeCount` availability annotation may ship simplified at MVP.
- **State per block.** `done` if `done === total`; `hole` if `manDown.js`
  (`computeManDown`/`reservationWindows`) reports an uncovered assigned obligation
  in that block; `now`/`future`/`over` from block start
  (`resolveBlockMinutes`/`sunTimes`) vs now; else `committed`.
- **Window (L5/C3).** `window:{opensMin,closesMin,remaining}` from
  `choreDaysRemaining` — rendered by `WindowBar`/the week tick, never the words
  "should"/"must".

### Week + heat (fold, don't fork)
- `week[]` folds `weekFullness(data,date,ruleOpts)` (`weekView.js:41`) — item
  count, `max` scales bars.
- `heat[]` folds `weekShouldHeat(data,date,ruleOpts)` (`weekView.js:77`), driven
  by `choreDaysRemaining`; `topTitle` **already collapses multiple chores sharing
  a curve to the hottest one** per day — exactly C2.
- `heatColor(heat)` — one shared ramp (`transparent → color-mix(warn) →
  --c-cat-processing` at peak).

### Lane overlay (conditional)
`lanes = buildPersonLanes(...)` (`personLoad.js:27`) only when real segments
exist (`mine.length > 0`); `null` otherwise. Feeds the `.lanes` overlay on
`LoadSpine`, never the base spine. `personLoad.js` kept, scope-narrowed.

**Go/no-go gate:** `farmLoad` is load-bearing for all four pages. Build and test
it FIRST against real `chore_blocks` + `projectGaps` + `manDown`, verifying it
reproduces `weekFullness`/`weekShouldHeat` before those call-sites are repointed
(NO-LEGACY: fold old in, delete it — no dual-source soak). If `farmLoad` doesn't
hold, nothing downstream does.

---

## 3. Per-page target design (both tiers)

Notation: **bold** = a promoted primitive. Sheets/modals/`QuickActionsTray`/the
Rounds `DoingSurface` over a scrim deliberately **stay raised** (`bg-surface`) —
flush is for in-page panes only.

### 3.1 SCHEDULE — `src/pages/Schedule.jsx` (START HERE; desktop = first-class)

The G4 deliverable: a real assembled desktop page on the *current* Schedule data,
in real chrome — the documented master–detail shell **left load rail · center day
detail · right WeekStrip**, inside the existing `Sidebar.jsx` nav (not a floating
card). Desktop carries **all** the detail, more than the Operator mockup showed.

**Desktop, top→bottom:**
1. Page chrome: sidebar nav + `PageHeader` (**Heading** "Schedule" + date + view
   segmented control Day/Week/Month/Review — kept). Top strip (L2): date ·
   **NowRule** · temperature with a **Lucide** icon (C1, replaces emoji `⛅`).
2. **Confirm-day control** (KEPT) on the day header — a flush confirm affordance
   (button → "Confirmed · {time}" badge once set; writes the
   `schedule.confirmed_day` capture). The deliberate plan-level action; distinct
   from block completion.
   **AlertStrip** — below it, only if offline or "N changes since confirmed"
   (passive, not a gate). Absorbs the changes-since-confirmed ribbon +
   yesterday's-unfinished banner (reworded, C8).
3. **LoadSpine** (day shape, count-driven, projects interleaved) + count read
   beside ("N items · M blocks · K projects"). No heavy/light text (C11). The
   two-lane becomes the conditional `.lanes` overlay.
4. Center: time-ordered blocks as flush **Pane**s — each header
   (**Eyebrow**+count) + "Open rounds" deep-link + `BufferSection` +
   **AttentionCard** for man-down (absorbs `blockAlerts`) + draggable
   **ChoreCheckRow**s (dnd-kit kept, composes **CheckTarget**) + **EventRow**s for
   events + project gaps + `AddTaskRow` + split. Project-gap/overnight detail kept
   as Pane variants.
5. Right sidebar: the single **WeekStrip** (folds `WeekList` + kills
   `WeekSpines`), reservations/buffers chips + conflicts button kept.
6. Week/Month/Review behind the existing view switch (`ScheduleZoom`,
   `ScheduleReview`): `WeekView` adopts `WeekStrip`/`LoadSpine` language;
   Month/Review get a light reskin only this round.
7. Sheets/modals (`AddToScheduleSearch`, `ScheduleEditSheet`, `ReservationSheet`,
   `BufferSheet`, `EventTimeSheet`, `SplitBlockSheet`, `EventScopePrompt`,
   `CoverSheet`, `ConflictsPanel`) — KEEP raised.

**Phone (read surface; planning is desktop):** top strip → **WeekStrip** header
(collapses `DayStrip`) → **LoadSpine** → **NowRule** → **AttentionCard** (if down)
→ collapsed block **Pane**s (tap → **ChoreCheckRow**s) → deep-link "Open Rounds."
Editing sheets reachable but de-emphasized.

### 3.2 DASHBOARD — `src/pages/Overview.jsx` (phone = lead tier)

**Phone (the Operator Today glance, tap-priority order):**
1. Header: date · **Lucide** weather icon + temp (C1) · **NowRule**.
2. **AttentionCard** — only on man-down; jumps to top, emphatic (C6).
3. **LoadSpine** (dynamic `farmLoad`, chores + project columns, `done/total`,
   count label). Man-down block burns warn. No heavy/light text (C11).
4. Block groups → tap a block → **ChoreCheckRow**s → deep-link "Open Rounds."
5. Below fold: Conditions (`WeatherWidget`), Broiler Weeks, Active Projects, Open
   Orders, Farm Updates, Activity since yesterday — reskinned to **Pane**.

**Desktop:** keep the multi-pane grid; flip every sub-card `Card → Pane` (flush).
Schedule-at-a-glance card → **Pane** with **LoadSpine** → **NowRule** → **EventRow**
timeline (absorbs `TimelineRow`; `SunCountdownPill` ticker kept; "N changed" badge
→ inline **AlertStrip**). Active Projects visually ties to the LoadSpine project
bars (G3). `useActivityLog` realtime/edit/delete kept.

### 3.3 CHORES — `src/pages/Chores.jsx` (5 tabs, all KEEP)

- **Today** (`TodayTab`/`TodayObligationRow`): user filter kept; chores by block,
  place-tree nested, kept; rows → **ChoreCheckRow**/**CheckTarget**; remaining-pill
  → **WindowBar** (C3/L5); escalation tint → flush **Hole.row**/**AttentionCard**
  (C4). Jump-nav chip strip → redesigned nav (§4, C10).
- **Blocks** (`ChoresBlocksTab`): the CRUD that defines `chore_blocks` — **the
  source of truth `farmLoad` reads.** KEEP untouched; **ADD a tiny LoadSpine
  preview** so editing a block visibly reshapes the day-load (closes the G1 loop).
- **All chores** (`AllChoresTab`): newspaper columns + `ChoreInlineEditor`
  (`ChoreFieldsEditor`+`AssignmentRulesEditor`) untouched; container → **Pane**.
- **Performance** / **Activity log**: KEEP; flush container only.
- Escalation relocation (C2): `WindowBar` on the row + one outline tick on the
  `WeekStrip` day bar; shared curves aggregate to one tick at hottest intensity.

**Phone:** Today tab as a stack of block **Pane**s; **WeekStrip** header optional.

### 3.4 ROUNDS — `src/pages/Rounds.jsx` (doing surface; phone-first; strip C9)

- **Cold open** (`ColdOpen`): start CTA + other blocks + `RecentRuns` — KEEP;
  in-page `PlaceSection` `bg-surface` → **Pane** (running surface stays raised).
- **Active run** (`DoingSurface`): status bar (progress `prog` ≠ LoadSpine,
  elapsed, **OutboxIndicator** loud, cancel/finish) kept; **NowRule** promoted into
  the run header (Operator placement). "Waiting on Jim" banner kept.
  **AttentionCard** surfaces **inside** the run when man-down — the one mid-round
  actionable signal (survives C9 because it's a do-it-now action, not info).
  `PlaceSwitcher`/`KindView` chip strip → redesigned (§4, C10). `AllPlacesView`→
  `PlaceSection` (flush), `SelectedPlaceView`, `AllDoneButton`, **ChoreCheckRow**
  rows, `QuickActionsTray` — KEEP.
- **Wrap** (`WrapCard`): **FinishStamp** ("Finished · who · window · N/N");
  whole-run, no "Sealed" (C5). Completion auto-derives (run flips `in_progress →
  done` when every obligation ticked) — no submit gate. (The Schedule
  confirm-day affordance is a separate, KEPT plan-level concept; it does not
  apply to a Rounds run.)
- **C9:** NO overdue / "yesterday's-must" detail in Rounds — that lives on
  Today/Schedule/Dashboard.

### 3.5 Nav redesign (C10) — all four pages

Three off-screen horizontally-scrolling strips: app section nav, Chores Today
jump-chips, Rounds `PlaceSwitcher`. Resolution:
- **App nav:** desktop left rail (existing `Sidebar.jsx`, fine — unchanged); phone
  bottom tab bar (Dashboard/Schedule/Chores/Rounds) with Lucide icons. No overflow.
- **Place/jump nav** (Chores jump-chips + Rounds `PlaceSwitcher`): replace the
  single scrolling row with a **wrapping 2-row chip cluster** (never off-screen) +
  a **"Jump to…" affordance** opening `PlaceTree` / `CommandPalette` (⌘K) for
  direct place jumps (coops → tractor → egg room). Obviously navigational.

---

## 4. Build / migration order (cheapest-first; farmLoad = the gate)

Branch: **`feat/harvest-remix`** (Round-3 hybrid; roll back / don't merge if it
fails). Promote-then-delete the `/rethinker` scratch IN-BATCH, no soak (NO-LEGACY).

- **Step 0 — `farmLoad` go/no-go gate (do before any surface).** Write
  `lib/load/farmLoad.js`; verify against real `chore_blocks` + `projectGaps` +
  `manDown` that it reproduces `weekFullness`/`weekShouldHeat`. If it doesn't
  hold, stop — nothing downstream does. **REAL** from day one.
- **Step 1 — cheap, low-risk lever (touches every page).** `Card → Pane`
  flush-flip; `ChoreCheckRow` escalation → flush `Hole`; `NowMarker`/pool →
  one `NowRule`. **REAL.**
- **Step 2 — promote the vocabulary + wire signals.** `AttentionCard`,
  `FinishStamp`, `CheckTarget`, `LoadSpine`, `EventRow`, `WindowBar` into
  `ui.jsx`; wire phone Today glance + in-run AttentionCard; SCHEDULE desktop page
  assembled (G4) on real `deriveDay` data. **REAL**; project columns may start
  **count-only stubbed** before full project-block detail; `who.freeCount`
  annotation **simplified at MVP**.
- **Step 3 — fold the week.** `WeekStrip` (sidebar layout) absorbs `WeekList` +
  the should-tick; delete center `WeekSpines`; demote `DayRibbon` (silhouette →
  LoadSpine, two-lane → conditional `.lanes` overlay). **REAL** base; lane overlay
  **real only on man-down days** (draws nothing on normal days — narrate so an
  empty overlay isn't read as a bug).
- **Step 4 — projects + nav + overflow.** Project bars/EventRows into `farmLoad`
  across all four pages (G2/G3); C10 wrapping place nav + phone tab bar; B1/B2/B3
  clamp/overflow fixes; `WindowBar` shared-curve aggregation (the fiddliest bit).
- **Step 5 — delete scratch.** `RethinkerKit.jsx`, `RethinkerGallery.jsx`,
  `sections.jsx` `rethinker` item + `SectionContent` `case "rethinker"`.
- **Deferrable (not big-bang):** `StatTile` flush-flip; Month/Review beyond light
  reskin; the Blocks-tab LoadSpine preview if time is short.

**Real vs stubbed at first cut:** REAL = all four pages' existing data
(`useChoreBlocks`, `useChoreCompletions`, `useSites`, `useScheduleDeltas`,
`useChoreRuns`/`useRunEvents`), `farmLoad`, `ChoreCheckRow`+completions+outbox
(untouched), `choreDaysRemaining`→`WindowBar`, `deriveDay`/Schedule substrate.
STUBBED first pass = project-block detail (count-only first), `who.freeCount`
availability, `WindowBar` shared-curve aggregation, the lane overlay (sparse in
prod by design). LIGHT-RESKIN-ONLY = Month/Review.

---

## 5. Review-item checklist (where each lands)

| Item | Where satisfied |
|---|---|
| **G1** dynamic day-load | `farmLoad` reads `useChoreBlocks().blocksOrdered`; every `LoadSpine`/`WeekStrip` consumes it; Blocks-tab LoadSpine preview proves the loop. No hardcoded buckets. |
| **G2/G3** projects woven | `projectGaps`/`partition` → `kind:"project"` columns in `farmLoad`; project `EventRow`s + project-gap Panes on all four pages; Active Projects ties to LoadSpine. |
| **G4** real assembled page | Schedule desktop built in real chrome + redesigned nav on live `deriveDay`, all detail conserved, first-class (no opacity demotion). |
| **C1** Lucide icon | Top-strip emoji → Lucide (`lucide-react`, already a dep); `AttentionCard` ⚠, `CheckTarget` ✓/`CloudOff` also Lucide. |
| **C2** escalation relocated | `WindowBar` on the row + one outline tick on the `WeekStrip` day bar; shared curves aggregate to one tick via `farmLoad.heat`. |
| **C3 / L5** drop should/must | `WindowBar` window-of-time visual replaces the words; replacement phrasings parked (out of scope). |
| **C4** no hatch behind text | Hatch only in text-free `hole`/`AttentionCard` gutter zones + LoadSpine man-down bar; prose panes get flat `color-mix` warn fill. |
| **C5** kill "Sealed" | `FinishStamp` renders "Finished/Completed," whole-run. (Block completion has no submit gate; the Schedule confirm-DAY action is a separate KEPT concept — not "Sealed.") |
| **C6** emphatic needs-cover | `AttentionCard` = `Eyebrow tone="warn"` + ⚠ + Lora work line + solid-amber action, not a quiet pill. |
| **C7** blue = chore-time only | Project surfaces use `--c-project`; events use their `cat`; chore-time blue reserved via one token map; no checkable chore on a blue field. |
| **C8** overdue copy | "Pressure-wash nest boxes was due yesterday" — no "yesterday's must"; on Today/Schedule/Dashboard. |
| **C9** Rounds stripped | Only the in-run actionable man-down `AttentionCard`; overdue/ancillary off Rounds. |
| **C10** nav | §4 — phone tab bar + wrapping place cluster + ⌘K/PlaceTree jump; no off-screen scroll. |
| **C11** no heavy/light text | Bars + counts carry the read; the "— heavy/light day" suffix dropped. |
| **B1** week-spine overflow | `WeekStrip` bars capped + `overflow-hidden`; overbook = intentional warn top-rule, never silent overflow. |
| **B2** day-load bar overflow | `LoadSpine` bars clamp to `% of track` + `min-height` + `overflow-hidden`; count label outside the bar. |
| **B3** phone dense-day overflow | `min-w-0` + `overflow-hidden` on phone glance panes; fixed-height spine track with clamped bars; counts wrap. |

**Data-model flag:** none. Every change is view-layer. No migration, no table,
no schema edit. `farmLoad` reads existing walks; `personLoad.js` is narrowed not
dropped; all substrate hooks/libs are preserved.
