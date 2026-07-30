# Round 3 — Operator-lens proposal (hybrid build)

_Operator agent. Pairs with `PROPOSAL-systematizer.md`. Both feed one joint
build plan. Lens: **re-home the signals to where decisions happen** — phone-led
Today glance, signals living inside the running Rounds, desktop demoted to the
scan/plan tier. I keep my thesis; I accept Systematizer's discipline (one
promoted primitive vocabulary, cheapest-first migration)._

---

## 0. The spine of the whole thing — one shared `farmLoad` model

Everything below leans on a single new derivation, because G1/G2/G3 are really
one requirement: **day-load must be a live read of the user-defined blocks, with
projects woven in.** Build it once; every surface consumes it.

`src/lib/load/farmLoad.js` — `buildFarmLoad(date, { blocks, choresForDay,
completions, projectGaps, manDown })`:

- `blocks` = `useChoreBlocks()` (the organizing principle — NOT 5 hardcoded
  buckets). Each active block becomes one column.
- For each block: fan-out item count from `rollupChoresForDay` /
  `getChoresForDay` + `obligationPlaceIds`; `doneCount` from
  `useChoreCompletions(date)`.
- **Projects (G2/G3):** `projectGaps` / `partition.js` already yields project
  blocks for the day. They become columns too, tagged `kind:"project"`, colored
  `--c-project` — so the LoadSpine is genuinely "chores + projects," not
  chores-only.
- `manDown` (`manDown.js` `computeManDown`) flags the affected block →
  `state:"hole"`.
- Per-column `state`: `done | now | future | over | hole`, derived from block
  start (`resolveBlockMinutes`/`sunTimes`) vs now, and from `choreDaysRemaining`
  for the window/escalation.
- Returns `{ columns:[{blockId,name,kind,total,done,projectCount,state,
  window}], totals:{items,blocks,uncovered} }`.

This **folds `weekFullness` + `weekShouldHeat` + `personLoad` into one model**
(the Recombiner graft baked into DESIGN.md) and exposes a shared `heatColor()` /
`loadColor()`. It is the data contract behind `LoadSpine` and `WeekStrip`. Adding
or removing a block on **Chores › Blocks** changes every day-load on every page —
that's G1 satisfied structurally, not cosmetically.

A **window** field carries L5/C3: instead of the words "should"/"must," each
warming obligation gets `window:{opensMin,closesMin,remaining}` from
`choreDaysRemaining` — rendered as a shrinking time-window bar, never a word.

---

## 1. Shared primitive vocabulary (promoted into `ui.jsx`, used by all 4 pages)

From DESIGN.md, the one vocabulary. Operator owns _where_ they land; these are
the _what_:

| Primitive | Real source it collapses | Notes |
|---|---|---|
| `Pane` (flush) | `Card` (ui.jsx) flush-flip | border-on-`--c-bg`, never raised. |
| `Eyebrow` / `Heading` | inline Lora/Inter usage | one title + one label idiom. |
| `NowRule` | local `NowMarker()` in Schedule + pool copy | today-views only. |
| `AttentionCard` (man-down/Hole) | inline `blockAlerts()` + `ChoreCheckRow`'s `border-l-2 bg-warn/5` | flush warn, hatch only where text-free (C4). |
| `SealStamp`→**renamed** | n/a (completion auto-derives today) | "completed/finished," **no "Sealed"** (C5). |
| `LoadSpine` | `DayRibbon` + `DaySilhouette` + spine bits | count-driven, reads `farmLoad`. |
| `EventRow` | `Overview.TimelineRow` + `EventEntry` | one left-bar event treatment app-wide. |
| `CheckTarget` | the 28px box inside `ChoreCheckRow` | **`ChoreCheckRow` completion engine stays**; only its chrome is factored out. |
| `WeekStrip` | `WeekSpines` + `WeekList` collapsed | the single week. |
| `WindowBar` (new, small) | renders `choreDaysRemaining` | the L5 window-of-time visual; replaces should/must words. |

**Non-negotiable:** `ChoreCheckRow`, `useChoreCompletions`, `getChoresForDay`,
the outbox — untouched engines. We restyle containers and relocate escalation;
we never re-implement the tick path.

---

## 2. SCHEDULE — start here (the desktop workbench, demoted but complete)

James's mandate: rebuild the real desktop Schedule on the current data, carrying
**all** the same info, in Systematizer's vocabulary. Operator twist: it is the
**scan/plan tier**, not the load centerpiece — the load _glance_ is the phone's.

### Desktop target structure (top → bottom)
1. **Page chrome + real nav** (G4, C10). Left app nav redesigned (see §6). Top
   strip kept (L2): date · `NowRule` · temperature with a **Lucide** icon (C1,
   replacing the emoji `⛅`).
2. **`LoadSpine` (Day load)** — one count-driven row from `farmLoad`, columns =
   live blocks **+ project columns** (G1/G2). Each bar shows `done/total`; the
   man-down block renders the hatch `hole` state (text-free — C4). Always a
   count beside it ("N items · M blocks · K projects"), never height-alone.
   **No "heavy/light day" text** (C11) — the bars _are_ the read.
3. **Master-detail day body** (the dense core, conserved): time-ordered blocks
   as flush `Pane`s; each block header → "Open rounds" deep-link, `BufferSection`,
   man-down `AttentionCard` (was inline `blockAlerts`), draggable `ChoreCheckRow`s
   (dnd-kit kept), `AddTaskRow`, split. Project-gap + overnight detail variants
   kept as `Pane` variants. `EventEntry` → `EventRow`.
4. **Right sidebar = the single `WeekStrip`** (folds `WeekList` + kills
   `WeekSpines`). Each day: mini count-spine + a **should-escalation outline on
   the bar** (C2), not a separate heat strip and not words.
5. Week / Month / Review views kept behind the existing view switch
   (`ScheduleZoom`, `ScheduleReview`) — `WeekView` adopts `WeekStrip`/`LoadSpine`
   language; Month/Review structurally unchanged this round.

### Phone target structure
Schedule on phone is a **read** surface (planning is desktop). Top strip (L2) →
`NowRule` → `LoadSpine` (same `farmLoad`) → collapsed block list (tap a block →
its `ChoreCheckRow`s) → deep-link "Open Rounds." The editing sheets stay
reachable but de-emphasized; the phone's _doing_ home is Rounds, its _glance_
home is Dashboard/Today.

### Disposition — every Schedule piece

| Piece (inventory) | Verdict | Where / why |
|---|---|---|
| `DayRibbon` (two-lane person ribbon) | **DROP** | desktop-only + empty in prod (assignment null). Its one real signal (man-down hole) is harvested into `AttentionCard` + the LoadSpine `hole` column. |
| `WeekSpines` (center week heat) | **DROP** | duplicate week. Folds into the sidebar `WeekStrip`; B1 overflow dies with it. |
| `personLoad.js` `buildPersonLanes` | **FOLD** | lane model dropped; keep only the `hole` derivation, merged into `farmLoad`. (Concession: kept as a _conditional overlay_ on LoadSpine, drawn only on days with real reservation data — see §7.) |
| `DayRailSpine` / `DayStrip` (nav spines) | **FOLD** | their count-spine idea becomes `LoadSpine`/`WeekStrip`; the nav role moves into the redesigned nav (§6). |
| `WeekList` (sidebar week column) | **FOLD → `WeekStrip`** | survives as the single week; absorbs spine + heat tick. |
| `NowMarker()` (local) | **FOLD → `NowRule`** | one shared primitive. |
| Confirm-day badge + "changes since confirmed" ribbon | **KEEP (restyle) / DROP confirm-as-gate** | the live "N changed" delta badge stays (real signal, surfaces on Dashboard too). **No "confirm the day" affordance** — a block is finished by completion, not a planning gate (matches DESIGN.md; I push back on Systematizer's ConfirmCard, §8). |
| "Yesterday's unfinished musts" banner | **MOVE + REWORD** | stays on Schedule/Dashboard as overdue context; **off Rounds** (C9). Copy drops "yesterday"/"must": "Pressure-wash nest boxes was due yesterday." (C8). |
| Reservations/buffers chips, conflicts button | **KEEP** | real planning tools; restyled flush. `ConflictsPanel`, `BufferSection` kept. |
| Time-ordered block body, counts, project gaps, overnight blocks | **KEEP** | the operator's level of detail — conserved as `Pane`s. |
| `EventEntry` | **FOLD → `EventRow`** | one event-rail treatment (also converges `Overview.TimelineRow`). |
| Draggable `ChoreCheckRow` (dnd-kit), `AddTaskRow`, split | **KEEP** | untouched engine; container restyled flush. |
| All sheets/modals (`AddToScheduleSearch`, `ScheduleEditSheet`, `ReservationSheet`, `BufferSheet`, `EventTimeSheet`, `SplitBlockSheet`, `EventScopePrompt`, `CoverSheet`, `ConflictsPanel`) | **KEEP (raised)** | floating overlays legitimately stay raised (DESIGN floor #1). |
| `weekFullness` / `weekShouldHeat` | **FOLD → `farmLoad`** | one model + shared `heatColor()`. |
| `personLoad.js` (lane build) | **TRIM** | to the hole derivation only. |
| `deriveDay`, `projectGaps`/`partition`, `overnightWindow`, `placement`, `overrides`, `manDown`, `conflicts`, `buffers`, `monthView`, `lookBack`, `useScheduleDeltas`, `useBufferTemplates`, `useEventSeries`, `useNeighborDeltas`, `useRunHistory` | **KEEP** | substrate; `farmLoad` consumes `deriveDay`/`projectGaps`/`manDown`, the rest unchanged. |
| Month / Review views | **KEEP** | structurally unchanged; light reskin only. |

---

## 3. DASHBOARD — `Overview.jsx` (the at-a-glance, phone-led)

### Target structure
**Phone is the lead tier** here (this is the operator's "Today"). Top → bottom
in tap-priority:
1. Header: date · **Lucide** weather icon + temp (C1) · `NowRule`.
2. **`AttentionCard`** — only on man-down; jumps to the top, emphatic (C6):
   `⚠ NEEDS COVER` eyebrow + bold work line + reason + one solid-`--c-warn`
   action. Hatch sits in the card border/hole zone, **never behind the prose**
   (C4).
3. **`LoadSpine`** (Schedule-at-a-glance, dynamic) — `farmLoad`, chores +
   project columns, `done/total`, count label. The over-cap/man-down block burns
   warn. No heavy/light text (C11).
4. **Block groups** (today's blocks) → tap a block to expand its
   `ChoreCheckRow`s → deep-link "Open Rounds for {block}."
5. Below the fold / desktop columns: Conditions (`WeatherWidget`), Broiler Weeks
   countdown, Active Projects, Open Orders, Farm Updates, Activity since
   yesterday — kept, reskinned to `Pane`.

### Desktop
The current 3-row grid, reskinned to flush `Pane`s; Schedule-at-a-glance card
becomes the `LoadSpine` + `EventRow` timeline. Same cards, one vocabulary.

### Disposition

| Piece | Verdict | Where / why |
|---|---|---|
| Upcoming Chores card (block-grouped, live counts) | **KEEP → `Pane` + block groups** | same data (`getChoresForDay` + completions). |
| Schedule-at-a-glance (today/tomorrow/upcoming, events+chores+projects) | **SPLIT** | the **load read** → `LoadSpine` (dynamic, projects woven); the **timeline rows** → `EventRow` list; `SunCountdownPill` live ticker **KEPT**; "N changed" badge **KEPT**. |
| `WeatherWidget` / `useCurrentWeather` | **KEEP** | top-strip icon → Lucide (C1). |
| Broiler Weeks countdown (`metrics.js`, `useProcessingDates`) | **KEEP** | reskin to `Pane`. |
| Active Projects · Open Orders · Farm Updates | **KEEP** | reskin; Active Projects now also feeds project columns into `LoadSpine` (G3). |
| Activity since yesterday (`useActivityLog`, realtime, edit/delete) | **KEEP** | reskin to `Pane`. |
| (no man-down today) | **ADD `AttentionCard`** | man-down re-homes here as the lead glance signal. |

---

## 4. CHORES — `Chores.jsx` (the block + escalation surface)

### Target structure
Five tabs conserved. The Round-3 work is concentrated in **Today** and
**Blocks**, plus relocating escalation off verbose text (C2).

- **Today (`TodayTab`)**: user filter kept; chores by block (place-tree nested)
  kept; `TodayObligationRow` → restyled flush with a **`WindowBar`** instead of
  the spelled-out should/must remaining text. Jump-nav chip strip → the
  redesigned wrapping nav (§6), no off-screen scroll (C10).
- **Blocks (`ChoresBlocksTab`)**: the CRUD that defines `chore_blocks` — **the
  source of truth `farmLoad` reads.** Add a tiny `LoadSpine` preview here so the
  user _sees_ that editing a block reshapes the day-load everywhere (closes the
  G1 loop visibly).
- **All chores / Performance / Activity log**: kept; reskin to `Pane`,
  `ChoreInlineEditor`/`ChoreFieldsEditor`/`AssignmentRulesEditor` unchanged.

### How escalation relocates (C2, L5/C3)
`choreDaysRemaining` (the should→must logic in `lib/chores.js`) stays as the
engine. We change only its _rendering_:
- On the **chore row**: `WindowBar` — a thin time-window track showing the
  obligation's window and how much remains, warming (amber → `--c-cat-processing`
  red) as it narrows. **No "should"/"must" words** (C3); the `ChoreRemainingPill`
  text is replaced by the bar.
- On the **week bar** (`WeekStrip`): the warming curve is an **outline/decoration
  on the day's bar** (C2). Multiple chores sharing a curve aggregate into one
  outline intensity — not N stacked labels.

### Disposition

| Piece | Verdict | Where / why |
|---|---|---|
| `TodayTab` (filter, by-block, place-tree) | **KEEP** | flush reskin; jump-nav → §6. |
| `TodayObligationRow` | **KEEP (restyle)** | checkbox/badges/message kept; remaining-pill → `WindowBar`. |
| `AllChoresTab` (sortable, search, dormant, newspaper) | **KEEP** | reskin only. |
| `ChoreInlineEditor` / `ChoreFieldsEditor` / `AssignmentRulesEditor` | **KEEP** | untouched. |
| `ChoresBlocksTab` (CRUD `chore_blocks`) | **KEEP + ADD preview** | add `LoadSpine` preview tying edits to day-load. |
| `ChoresPerformanceTab` (30-day `chore_runs`) | **KEEP** | reskin. |
| `ActivityLogTab` | **KEEP** | reskin. |
| `ChoreRemainingPill` (should/must text) | **FOLD → `WindowBar`** | window-of-time visual; drops the words (C3/L5). |
| `ChoreCheckRow` `border-l-2 bg-warn/5` escalation | **FOLD → flush warn / `AttentionCard`** | flush, hatch text-free (C4). |
| `ModifierBadges`, `BlockBadge`, `ChoreMessageButton`, `PlaceTag`, `PlaceTree` | **KEEP** | shared, untouched. |

---

## 5. ROUNDS — `Rounds.jsx` (the doing surface, phone-first)

### Target structure
Lifecycle conserved (Cold open → Active run → Wrap). Operator's whole thesis is
that **signals live in the run** — but per C9 the run carries _actionable_
signals only, not info-checking detail.

- **Cold open (`ColdOpen`)**: start CTA, other blocks, `RecentRuns` — kept,
  flush.
- **Active run (`DoingSurface`)**:
  - Status bar: progress X/Y, elapsed, **`OutboxIndicator`** (kept, loud here),
    cancel/finish. `NowRule` in the header.
  - Multi-person "waiting on Jim" banner — kept.
  - **`AttentionCard` surfaces _inside_ the run** when man-down — the one signal
    that _is_ actionable mid-round (take the cover). This is my signature
    placement and it survives C9 because it's a do-it-now action, not info.
  - `PlaceSwitcher` → redesigned (§6): wrapping chip cluster + a "jump to place"
    affordance over `PlaceTree` (coops → tractor → wherever). No off-screen
    horizontal scroll (C10).
  - `AllPlacesView`→`PlaceSection` (flush), `KindView`, `SelectedPlaceView`,
    `AllDoneButton`, `ChoreCheckRow` rows, `QuickActionsTray` — all kept.
- **Wrap (`WrapCard`)**: elapsed + overrun + close. Gets the renamed
  `SealStamp` (✓ + who + n/n + window) — wording is **"completed/finished," not
  "Sealed"** (C5), and applies to the **whole run** (C5 note), not a sub-bucket.

### Disposition

| Piece | Verdict | Where / why |
|---|---|---|
| `ColdOpen`, `RecentRuns` | **KEEP** | flush reskin. |
| `DoingSurface` status bar (progress/elapsed/cancel/finish) | **KEEP** | + `NowRule`. |
| `OutboxIndicator` | **KEEP** | stays loud in the run; gains a Today-header slot. |
| "Waiting on Jim" multi-person banner | **KEEP** | real coordination signal. |
| `PlaceSwitcher` (geo vs kind_tag) | **KEEP (redesign chrome)** | wrapping + jump affordance, no off-screen scroll (C10). |
| `AllPlacesView`→`PlaceSection`, `KindView`, `SelectedPlaceView` | **KEEP** | `PlaceSection` `bg-surface` → flush `Pane`. |
| `AllDoneButton`, `ChoreCheckRow`, `QuickActionsTray` | **KEEP** | untouched engine. |
| `WrapCard` (elapsed + overrun) | **KEEP + `SealStamp`** | renamed copy, whole-run, no "Sealed." |
| "Yesterday's must / overdue" detail | **DROP from Rounds** | C9 — Rounds is doing, not info-checking; lives on Schedule/Dashboard. |
| `useChoreRuns`, `useRunEvents` | **KEEP** | run lifecycle/outbox unchanged. |
| ConfirmCard / "confirm the day" | **NOT ADDED** | completion is the finish; no planning gate (§8). |

---

## 6. The nav redesign (C10) — applies to all four pages

The off-screen horizontally-scrolling strips appear in three places: app section
nav, the Chores/Today jump-nav chip strip, and the Rounds `PlaceSwitcher`.
Operator resolution (mobile-first, glance-able, quick jumps):

- **App nav**: a real, obviously-navigational structure — desktop left rail;
  phone bottom tab bar (Dashboard / Schedule / Chores / Rounds) with Lucide
  icons. No horizontal overflow.
- **Place / jump nav** (Chores jump-chips, Rounds `PlaceSwitcher`): replace the
  single scrolling row with a **wrapping 2-row chip cluster** that never runs
  off-screen, plus a **"Jump to…" affordance** opening `PlaceTree` for direct
  place jumps (coops → tractor → egg room). The tree already exists; we give it a
  fast entry point instead of a scroll.

---

## 7. How the review requirements land (checklist)

- **G1 dynamic day-load** — `farmLoad` reads `useChoreBlocks()` + fan-out; every
  `LoadSpine`/`WeekStrip` consumes it. Editing Chores › Blocks reshapes all
  day-loads. Visible proof: the LoadSpine preview on the Blocks tab.
- **G2/G3 projects woven** — `projectGaps`/`partition` feed `kind:"project"`
  columns into `farmLoad`; projects appear in the LoadSpine **and** as
  `EventRow`s on Dashboard/Schedule and project-gap `Pane`s in the day body.
- **G4 real assembled page** — Schedule built with real chrome + redesigned nav
  on the live `deriveDay` data, all detail conserved.
- **C1 Lucide icon** — top-strip emoji → Lucide (already a dep).
- **C2 escalation relocated** — `WindowBar` on the row + outline on the week bar;
  aggregated for shared curves. No spelled-out should-escalation.
- **C3 / L5 drop should/must** — `WindowBar` window-of-time visual replaces the
  words; alt phrasings parked (out of scope).
- **C4 no hatch behind text** — hatch only in text-free `hole`/`AttentionCard`
  border zones and the LoadSpine man-down column; prose panes get flush warn
  fill only.
- **C5 kill "Sealed"** — `SealStamp` renders "completed/finished," whole-run.
- **C6 emphatic needs-cover** — `AttentionCard` is bold heading + reason + solid
  action, not a bare pill.
- **C7 blue = chore-time only** — egg/chore-time blue tints kept; **projects use
  `--c-project` as a left-bar/outline only, never a blue fill behind a chore
  row.** No checkable chore lands on a blue background.
- **C8 overdue copy** — "Pressure-wash nest boxes was due yesterday"; no
  "yesterday's must."
- **C9 Rounds stripped** — overdue/ancillary info off Rounds; only the
  actionable man-down `AttentionCard` remains.
- **C10 nav** — §6, no off-screen scroll, quick place jumps.
- **C11 no heavy/light text** — bars carry the read; counts beside, no adjective.
- **B1 week-spine overflow** — fixed by construction: `WeekStrip` bars are
  `height: min(100%, count/max)`, clamped; the old overshoot was a CSS bug, now
  capped. An overbooked day is signalled by a **deliberate top-edge marker**, not
  by a bar escaping its box.
- **B2 day-load bar overflow** — `LoadSpine` bars clamp to the track height; the
  count label lives outside the bar, so no element exceeds the border.
- **B3 phone dense-day box overflow** — block groups scroll within the `Pane`;
  `min-width:0` + `overflow` guards on flex children (the omission that caused
  B3).

---

## 8. Where I push back on a pure-Systematizer take — and where I concede

**Push back:**
1. **ConfirmCard / "confirm the day" — cut it.** Systematizer keeps a
   draft→sealed day-confirm anchor. On a 2-person farm there's no operator
   decision behind "confirm the day"; it's planning theater and it reintroduces
   the "Sealed" wording James killed (C5). A block/run is finished by
   _completion_, full stop. This is the one place I'd hold firm.
2. **Don't let the LoadSpine become one polymorphic widget.** Systematizer's
   instinct is maximal unification. Keep completion-fraction (Rounds) and
   item-count-load (Dashboard/Schedule/Week) **visually kin but semantically
   distinct** — same primitive, different `state` semantics, not one widget that
   means two things.
3. **Desktop is secondary.** The Systematizer mockup centers the desktop quad. I
   keep the desktop _complete_ (G4 demands it) but the **lead glance is the
   phone** — decisions happen one-handed in the field. The desktop scans/plans.
4. **The primitive-index rail + superscript chips are presentation scaffolding,
   not product** — drop them in the real build (DESIGN.md already says so).

**Concede (genuinely adopt Systematizer's discipline):**
1. **One promoted vocabulary in `ui.jsx`** before any re-homing — I build on the
   shared primitives, not bespoke phone components.
2. **Cheapest-first migration ledger** (Editor's guardrail): Step 1 = `Card →
   Pane` flush-flip + escalation → flush + `NowMarker` → `NowRule`; Step 2 =
   promote `AttentionCard`/`SealStamp`/`CheckTarget`/`LoadSpine` + add
   `farmLoad`; Step 3 = fold `WeekStrip`, delete `WeekSpines` + `DayRibbon`;
   last = delete the `/rethinker` scratch + nav wiring. No big-bang.
3. **`model(state)` full re-render** — adopt Systematizer's state-driven render
   so dense/sparse/overdue/man-down reshape the _whole_ surface, fixing my
   weakest Round-2 point (only the strip changed).
4. **Person-lane as conditional overlay, not an outright cut.** Round 1 I cut it
   entirely. I concede the honest middle: keep the `hole` derivation in
   `farmLoad` and draw the lane overlay **only** on days with real
   reservation/assignment data — never the base layer. Man-down lane context for
   free, no empty lanes on normal days.

---

## 9. Self-critique — real vs faked

- **Real/wired:** `ChoreCheckRow` + completions + outbox (untouched);
  `useChoreBlocks` driving `farmLoad`; `getChoresForDay`/`rollupChoresForDay`
  fan-out; `projectGaps` project columns; `manDown` hole; `choreDaysRemaining`
  feeding `WindowBar`; `deriveDay`/Schedule substrate.
- **New code to write (the cost):** `lib/load/farmLoad.js` (the linchpin —
  highest-risk new derivation); `LoadSpine`, `WeekStrip`, `AttentionCard`,
  `WindowBar`, `NowRule`, `SealStamp` primitives; `Card → Pane` flip across
  callers; nav redesign (§6) touching app shell.
- **Likely stubbed first pass:** project columns may start count-only before
  full project-block detail; `WindowBar` aggregation for shared curves (C2) is
  the fiddliest bit; the person-lane overlay is real only where reservation data
  exists (sparse in prod — that's the point).
- **Still lacking:** Month/Review get only a light reskin this round; alt
  should/must phrasings are parked; the Blocks-tab LoadSpine preview is a
  nice-to-have if time is short.
- **Cost to ship for real:** the migration ledger is genuinely cheapest-first,
  but `farmLoad` is load-bearing for all four pages — it must be built and
  tested first, against real `chore_blocks` + `projectGaps`, before any surface
  is wired. Build it on the new branch; if `farmLoad` doesn't hold, nothing
  downstream does, so that's the go/no-go gate.
</content>
</invoke>
