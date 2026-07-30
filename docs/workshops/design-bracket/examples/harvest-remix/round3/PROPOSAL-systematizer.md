# Round 3 — Systematizer-lens proposal for the hybrid

_One component vocabulary, applied app-wide. Operator's product IA, riding on
Systematizer's rails. This is the change-map James asked for: every existing
piece, named, with its fate. Build on a new branch; roll back if it doesn't
pan out._

## 0. The thesis, narrowed to the hybrid

My Round-1 thesis stands but bends to the hybrid: the leverage is **one
promoted primitive vocabulary in `ui.jsx` + `lib/load/farmLoad.js`**, repointed
across Dashboard / Chores / Rounds / Schedule so all four read as one typeface
of components. What I **concede** to the Operator (and the gate): the *product
shape* is phone-led — signals re-home to where decisions happen (phone Today
glance + live Rounds), and there is **no "confirm the day" affordance** (a block
is finished by completion, not sealed by a button). My Round-1 `ConfirmCard`
day-anchor is therefore **cut** (see §5).

What I **keep fighting for**: the per-person two-lane ribbon is **not** a system
primitive — it is a Schedule-only conditional overlay that draws only when
assignment data is real. And the lead *build* tier is the **desktop Schedule
workbench**, because that is where one-typeface consistency is legible and where
James explicitly said the Systematizer "nailed it" (L7) and demanded a real
assembled page (G4).

The single biggest lever is unchanged: **flush, not raised** — `Card`
(`ui.jsx:42`, `bg-surface`) becomes flush `Pane` on `var(--c-bg)`, and figure-
ground comes from borders, not interstitial surfaces. Everything else is built
on that plus the type rule (Lora headings / Inter eyebrows, no third option).

---

## 1. The promoted primitive vocabulary

These land **once** in `src/components/ui.jsx` (or a thin `ui/` folder) +
`src/lib/load/farmLoad.js`, then every surface imports them. Names match
DESIGN.md / DESIGN-SYSTEM.md so we're extending the documented system, not
inventing beside it.

### 1.1 `Pane` — flush bordered section (absorbs `Card`)
- **Replaces** `ui.jsx:42 Card`. Props: `{title, subtitle, eyebrow, icon,
  actions, children, className}`. Renders `border border-line` on `bg-bg`
  (NOT `bg-surface`), Inter eyebrow header (`Eyebrow`), optional Lora `Heading`.
- **States:** default; `tone="warn"` tints the whole pane via
  `color-mix(in srgb, var(--c-warn) N%, var(--c-bg))` (used by AttentionCard's
  full-bleed variant). Never raised.
- **Anti-rule:** floating overlays keep `bg-surface` (sheets, modals,
  `QuickActionsTray`, Rounds `DoingSurface` over a scrim). Flush is for in-page
  panes only. This is the one place I deliberately do NOT apply the pattern.

### 1.2 `Eyebrow` — Inter uppercase label (one idiom)
- Props `{children, tone, trailing}`. `font-ui text-[10px] font-bold uppercase
  tracking-[0.14em] text-faint`. Replaces the ad-hoc uppercase spans in `Card`'s
  header, `LABEL_CLS` (`ui.jsx:14`), Chores' inline `T.*` idiom, Rounds' block
  eyebrows. `tone="warn"` for the AttentionCard header.

### 1.3 `Heading` — Lora title (one idiom)
- Props `{children, level}` → `page|section|hero`. `font-heading -tracking-
  [0.01em]` (hero `-0.02em`). Unifies `PageHeader.jsx`, Chores inline `h2`,
  Rounds hero number. `tabular-nums` when the heading is a count.

### 1.4 `NowRule` — green hairline + dot + glow + "Now · time"
- Props `{time, viewingToday}`. Collapses the local `NowMarker()`
  (`Schedule.jsx:340`) and the Rethinker pool copy into one. **Draws only on
  today-views** (gated by `viewingToday`). Used by Dashboard glance, Schedule
  day view, and **promoted into the Rounds run header** (Operator's placement).

### 1.5 `AttentionCard` (+ compact `Hole` row) — the one amber obligation
- **Renamed** from my Round-1 "Hole/CoverCard" to `AttentionCard` per
  DESIGN.md's settled name. Props `{kind: "cover"|"overdue", work, where, reason,
  action, onAct}`. Flush warn fill + inset 1.5px warn ring + 45° hatch.
- **C4 compliance:** the 45° **hatch only sits behind text-free indicators**
  (the spine `bar.hole`, a corner motif). The card body that contains the work +
  reason text uses a **flat** `color-mix(warn, bg)` fill with the hatch confined
  to a left gutter / top rule — no stripes behind body copy.
- **C6 compliance:** the header is emphatic — `Eyebrow tone="warn"` + ⚠ Lucide
  glyph + a Lora `work` line, not a quiet pill. One solid-amber action button.
- **Supersedes** `ChoreCheckRow`'s raised `border-l-2 bg-warn/5` escalation
  (`ChoreCheckRow.jsx:43-47`) app-wide, and the inline `blockAlerts()` man-down
  cards built in `Schedule.jsx:~2078`.
- Two density variants: full card (man-down on glance + in-run) and
  `Hole.row` (a one-line overran row inside a list).

### 1.6 `FinishStamp` — completion stamp (the renamed `SealStamp`)
- **C5 compliance: "Sealed" is killed.** Renamed `SealStamp → FinishStamp`,
  copy is **"Finished · who · window · N/N"** (or "Completed"). Props
  `{who, window, ratio}`. Celadon ✓ in a square. Anchors the Rounds `WrapCard`
  (`Rounds.jsx:~470`). **Applies to the whole run**, never a sub-bucket/place
  (per C5's note). No "confirm the day" sibling.

### 1.7 `LoadSpine` — count-driven height bars (the dynamic day-load, G1)
- Props `{blocks}` where `blocks = farmLoad(date).blocks` — an **array derived
  from the live `chore_blocks` defs**, NOT 5 hardcoded buckets. Each bar:
  `{blockId, label, count, doneCount, state, kind}`. Height ∝ item count;
  `state ∈ {done, committed, hole}`; `kind ∈ {chore, project, event}` colors the
  bar (project bars use `--c-project`, never blue/`--c-egg`; see C7).
- **Always populated** from real block counts, so it never looks dead.
- **B2 fix:** bars are `min-height` clamped and the column is
  `overflow-hidden`; height is `% of track`, not a raw px that can exceed the
  track. The count label lives **beside** the spine (Dad-lens: "N items ·
  M blocks"), never height-alone.
- **Person-lane overlay** (`.lanes`) is a *separate optional layer* drawn only
  when `farmLoad` reports real reservation/assignment segments — never the base.

### 1.8 `EventRow` — left color-bar timeline row
- Converges `Overview.TimelineRow` (`Overview.jsx:~489`, inset box-shadow bar)
  and `Schedule.jsx:246` (border-left bar) into one. Props `{title, meta, cat,
  flag}`. `box-shadow:inset 3px 0 0 var(--cat)` + `color-mix(cat, transparent)`
  tint. **C7:** `cat` is the category hue; a chore's "chore-time" blue
  (`--c-cat-egg` / chore category) is reserved — a project row uses
  `--c-project`, a market uses `--c-cat-fm`, so no chore ever lands on a
  conflicting blue field.

### 1.9 `CheckTarget` — the 28px completion box (factored out of `ChoreCheckRow`)
- Extract the `w-7 h-7 border-2` button (`ChoreCheckRow.jsx:92-107`) as a
  standalone `CheckTarget` with `{done, queued, pending, onToggle}`. `ChoreCheckRow`
  then *composes* it. Kills the 22/20/16px reimpls (Operator's `.crow .cb` 22px,
  etc.). `queued` shows the `CloudOff` Lucide glyph (offline). This is the one
  tap target across Dashboard, Chores, Rounds, Schedule.

### 1.10 `WeekStrip` — the week, drawn ONCE
- Resolves the duplicate week (`WeekSpines` center + `WeekList` sidebar). Props
  `{week}` from `farmLoad`. Two layouts off the same data:
  - **Desktop sidebar:** Operator's compact row-per-day list — each row a
    `day · count · inline mini-spine · should-heat tick`. (Operator's L6 clean
    sidebar; my WeekStrip data.)
  - **Phone:** 7-column header strip, tap to switch day.
- **C2 + B1:** the should-escalation is a **decoration on the bar**, not spelled
  out — a single tick/outline per day (`warm` amber / `due` processing-red),
  and multiple chores sharing a curve roll into the **one** tick (intensity =
  hottest chore that day). **B1 is resolved by design:** an overbooked day is an
  *intentional* signal — the bar saturates at the track top and gains a warn top-
  rule ("over capacity"), it never silently overflows the container
  (`overflow-hidden` + capped height).

### Supporting promotions (not headline, but part of the one vocabulary)
- `AlertStrip` — the one flush warn strip (offline / "N changes since you
  confirmed"); generalizes `Schedule.jsx:2237` banner + the source-change
  ribbon.
- `StatTile` (`ui.jsx:88`) → flush stat grid (drop `bg-surface`). Deferrable.

---

## 2. The `farmLoad` data-walk (G1 dynamic, G2/G3 projects)

`src/lib/load/farmLoad.js` is the **one** collapse of the three separate data-
walks the inventory names — `weekFullness`, `weekShouldHeat`
(`lib/schedule/weekView.js`), and `personLoad.buildPersonLanes`
(`lib/schedule/personLoad.js`) — plus projects. It is the Recombiner graft,
baked in.

### 2.1 Signature
```
farmLoad(date, {
  blocks,        // useChoreBlocks()  — the live chore_blocks defs
  completions,   // useChoreCompletions(date)
  sites,         // useSites()        — fan-out + occupancy
  definitions,   // useChoreDefinitions()
  deltas,        // useScheduleDeltas — commitments (incl. project + reservation)
  week,          // ±range for the WeekStrip
}) -> { day, blocks[], week[], heat[], lanes|null, heatColor() }
```

### 2.2 The day-load walk (replaces 5 hardcoded buckets — G1)
The real assembly already exists as `deriveDay()` (`lib/schedule/deriveDay.js:86`),
which returns `{dayISO, events, choreRollups, projects, projectSegments}`.
`farmLoad`'s day model is a thin **presentation collapse** over it — it does NOT
replace `deriveDay`, it reads it.
1. Start from **`useChoreBlocks().blocksOrdered`** active blocks
   `{id,name,slug,startKind,startMinutes,durationMinutes,sortOrder,isActive}`
   (`useChoreBlocks.js:73`). **This is the organizing principle** — add/remove a
   block on Chores › Blocks and every day-load redraws. No literal
   `["Morning","Midmorn",…]` array survives. (Operator's mockup hardcodes exactly
   that array — the thing G1 forbids.)
2. For each block, `rollupChoresForDay` (`deriveDay.js:30`) groups expanded
   instances by `chore.blockId ?? "anytime"` into `{bucket, block, items[],
   startMin}`. `count` = `items.length`; `doneCount` = `completions.isDone` over
   each item's (choreId, placeId). Fan-out is `getChoresForDay` /
   `expandChoreForDay` / `obligationPlaceIds` (`chores.js:399/817`).
3. **Projects (G2/G3) — partly real already, finish it.** `deriveDay` already
   returns `projects[]` (active projects for the day) and `projectSegments[]`
   (`projectGaps()` `partition.js:142` → `{kind:"project", startMin, endMin,
   durationMin, who:{freeCount, who[]}}`), and `DayRailSpine`
   (`ScheduleSidebars.jsx:74`) **already renders project gaps as slate-blue
   bars** mixed into the desktop block rail. So the precedent exists on ONE
   surface. `farmLoad` lifts it into the shared model so a `kind:"project"` bar
   (colored `--c-project`, never blue/`--c-egg` — C7) and interleaved project
   `EventRow`s appear on **all four** pages, not just the Schedule rail. That is
   the real delta G2/G3 ask for.
4. Per-bar `state`: `done` if `doneCount === count`; `hole` if `manDown.js`
   (`reservationWindows`/man-down keys) reports an uncovered assigned obligation
   in that block; else `committed`.

### 2.3 The week walk (one `heat`, one `heatColor`)
Both already exist in `lib/schedule/weekView.js`; `farmLoad` folds them.
- `week[]` folds **`weekFullness(data,date,ruleOpts)`** (`weekView.js:41`) →
  `{days:[{date, blocks:[{bucket,name,block,count,startMin}], total}], max}`.
  Count is **item count**, not duration (chores-only today — projects are the
  add). `max` scales the bars.
- `heat[]` folds **`weekShouldHeat(data,date,ruleOpts)`** (`weekView.js:77`) →
  `{days:[{date, heat /*0..1*/, peak, topTitle}], top, peakDate}`, where
  `heat = max(0,(HEAT_RUNWAY−n+1)/HEAT_RUNWAY)`, `HEAT_RUNWAY=5`, driven by
  `choreDaysRemaining` (`chores.js:588`) → `{kind:"days",days}|{kind:"today"}|
  {kind:"overran"}|null`. `topTitle` already collapses **multiple chores
  sharing a curve to the hottest one** per day — exactly C2's "multiple chores
  sharing the same warming curve."
- `heatColor(heat)` — **one** shared ramp lifted from `choreHeat`: `transparent →
  color-mix(warn …)` rising to `--c-cat-processing` on `peak`/`peakDate`. Used by
  the WeekStrip tick and any future heat surface.

### 2.4 The lane overlay (kept, conditional)
- `lanes` = `buildPersonLanes(...)` (`personLoad.js:27`) output →
  `{lanes:[{name, segments:[{kind:"done"|"committed"|"hole"|"event"|"break",
  startMin, endMin, label, meta}]}], axisStart, axisEnd}`. The agent confirmed
  the two honest-middle properties I bet on in Round 1: **(a) a person's lane is
  omitted entirely when they have no assigned work that day (`mine.length===0`)**
  — so normal days draw nothing rather than empty lanes; **(b)** a segment is
  `kind:"hole"` exactly when the person is assigned work but off-site
  (`manDownKeys`). So `farmLoad.lanes` is `null` unless real segments exist.
  `personLoad.js` is **kept in place, scope-narrowed** to feed this overlay —
  never the base spine. My Round-1 bold bet, validated by the data.

> Visual kinship, semantic distinctness (Recombiner rule): Rounds shows a
> **completion-fraction** progress bar; Dashboard/Schedule/week show
> **item-count** LoadSpine. They look kin (same bars, same tokens) but are NOT
> one polymorphic widget — `LoadSpine` ≠ `prog`.

---

## 3. Per-page target structure (both tiers)

Notation: **bold** = a promoted primitive (§1). Each names what it absorbs.

### 3.1 SCHEDULE — `src/pages/Schedule.jsx` (START HERE, lead tier = desktop)

The G4 deliverable: a real assembled desktop page on the *current* Schedule's
data, in real page chrome. Layout = the documented master–detail shell:
**left load rail · center day detail · right WeekStrip**, inside the existing
sidebar nav (`sections.jsx` `schedule` item) — not a floating card.

**Desktop, top→bottom:**
1. Page chrome: sidebar nav (existing `Sidebar.jsx`) + `PageHeader` (**Heading**
   "Schedule" + date + view segmented control Day/Week/Month/Review — kept).
2. **AlertStrip** (only if offline or "N changes since confirmed"). Absorbs the
   "changes since confirmed" ribbon + yesterday's-unfinished banner. **No**
   confirm-day badge (cut, §5).
3. **LoadSpine** (the day's shape, count-driven, projects interleaved) + count
   read beside it. Absorbs `DayRibbon`'s combined silhouette; the two-lane
   becomes the conditional `.lanes` overlay.
4. **NowRule** (today only).
5. Center: time-ordered blocks. Each block = a **Pane** header
   (**Eyebrow**+count) over **ChoreCheckRow** rows (drag/edit kept — Schedule
   passes `onEdit`/sortable props), **EventRow**s for events + **project gaps**,
   **AttentionCard** for man-down (absorbs `blockAlerts`), `AddTaskRow` kept,
   split kept.
6. Right sidebar: **WeekStrip** (absorbs center `WeekSpines` + sidebar
   `WeekList`), reservations/buffers chips kept.
- Sheets/modals (`AddToScheduleSearch`, `ScheduleEditSheet`, `ReservationSheet`,
  `BufferSheet`, `EventTimeSheet`, `SplitBlockSheet`, `CoverSheet`,
  `ConflictsPanel`) **KEEP** raised (`bg-surface`) — they float over a scrim.

**Phone:** day-strip (`DayStrip`) collapses to a **WeekStrip** header; body =
**LoadSpine** → **NowRule** → **AttentionCard** (if down) → block **Pane**s with
**ChoreCheckRow**s. Same primitives, narrower.

### 3.2 DASHBOARD — `src/pages/Overview.jsx`

**Desktop:** keep the multi-pane grid; flip every sub-card `Card → Pane` (flush).
- Row 1 L "Upcoming Chores" → **Pane** + **ChoreCheckRow**s grouped by block.
- Row 1 R stack: Current Conditions (`WeatherWidget`) → **Pane**; Broiler Weeks
  → **Pane**; **Schedule-at-a-glance** = **Pane** containing **LoadSpine**
  (dynamic, projects in) → **NowRule** → **EventRow** timeline (absorbs
  `TimelineRow`; `SunCountdownPill` ticker kept; "N changed" badge →
  **AlertStrip** inline).
- Row 2 Active Projects · Open Orders · Farm Updates → **Pane**s; Active
  Projects now visually ties to the project bars in the LoadSpine (G3).
- Row 3 Activity since yesterday → **Pane** (`ActivityRow` kept).

**Phone:** the Operator **Today glance** *is* the phone Dashboard — NowRule →
AttentionCard (if down) → LoadSpine+count → block groups → deep-link into
Rounds. One screen, tap-priority order.

### 3.3 CHORES — `src/pages/Chores.jsx` (5 tabs, all KEEP)

- **Today** (`TodayTab`/`TodayObligationRow`): rows → **ChoreCheckRow** with the
  extracted **CheckTarget**; escalation tint → flush **Hole.row** /
  **AttentionCard**; user filter (James/Jim, Mine/All) kept. Jump-nav chip strip
  → redesigned per C10 (see §4).
- **All chores** (`AllChoresTab`): newspaper columns + `ChoreInlineEditor`
  (`ChoreFieldsEditor`+`AssignmentRulesEditor`) **KEEP**; container `Card → Pane`.
- **Blocks** (`ChoresBlocksTab`): **KEEP, untouched** — this is the CRUD that
  feeds `farmLoad`. The dynamic day-load's *source of truth* (G1).
- **Performance** / **Activity log**: **KEEP**; flush container only.

**Phone:** Today tab as a stack of block **Pane**s; **WeekStrip** header optional.

### 3.4 ROUNDS — `src/pages/Rounds.jsx` (doing surface; strip ancillary detail, C9)

- **Cold open** (`ColdOpen`): start CTA + other blocks + `RecentRuns` — KEEP;
  `bg-surface` `PlaceSection` → **Pane** for in-page parts (the running surface
  stays raised).
- **Active run** (`DoingSurface`): status bar (progress **prog** ≠ LoadSpine,
  elapsed, outbox, cancel/finish) kept; **NowRule** promoted into the run header
  (Operator); `PlaceSwitcher` chip strip **redesigned per C10** (§4); rows →
  **ChoreCheckRow**/**CheckTarget**; `AllDoneButton`, `QuickActionsTray` kept.
- **AttentionCard** (man-down "needs cover") surfaces *inside* the running round
  (Operator's re-home) — but **C9: NO overdue / "yesterday's-must" detail in
  Rounds.** Rounds is execution; overdue lives on Today/Schedule, not here.
- **Wrap** (`WrapCard`): **FinishStamp** ("Finished · who · window · N/N").
  Completion auto-derives (run flips `in_progress → done` when every obligation
  ticked). **No "Sealed", no confirm-day.**

---

## 4. How the review requirements land

| Req | Where it lands |
|---|---|
| **C1** Lucide icon | Top-strip temperature/timeline glyph → Lucide (`lucide-react`, already the app's lib per `sections.jsx`). The `AttentionCard` ⚠ and `CheckTarget` ✓ also use Lucide (`Check`, `CloudOff`) — no emoji/SVG one-offs. |
| **C2** relocate should-escalation | Off spelled-out text. Two homes: (a) the chore row's own decoration (`ChoreCheckRow` keeps `ChoreRemainingPill` but escalation styling → **Hole**), and (b) the **WeekStrip** per-day **tick/outline**. Multiple chores sharing a warming curve → one tick at `max` intensity via `farmLoad.heat[]`. |
| **C3** drop "should"/"must" → window-of-time | No "should"/"must" words in UI. Escalation is shown as Operator's **window-of-time** visual (the deadline runway in the heat ramp + a "window 1:00–4:00p" meta on the row). `ChoreCheckRow`'s "optional today" italic + the `must` class copy are removed; the *signal* survives visually. (Replacement words parked — out of scope.) |
| **C4** no hatch behind text | The 45° hatch is confined to **text-free** indicators (`spine bar.hole`, a gutter/corner motif). `AttentionCard`'s text body uses a flat `color-mix` fill. |
| **C5** kill "Sealed" | `SealStamp → FinishStamp`, copy "Finished/Completed", applies to the **whole run**. No "completion is the seal", no confirm-day. |
| **C6** "Needs cover" emphatic | `AttentionCard` header = `Eyebrow tone="warn"` + ⚠ Lucide + Lora work line + solid-amber action — loud, not a quiet pill. |
| **C7** blue reserved for chore-time | Category hues are functional. Chore-time blue (`--c-cat-egg`/chore) is reserved; **project** surfaces use `--c-project`, events use their own `cat`. No chore ever renders on a conflicting blue field — `EventRow`/`LoadSpine` `kind` drives color from one token map. |
| **C8** overdue copy | "Pressure-wash nest boxes was due yesterday." — no "yesterday's must". Lives on Today/Schedule (not Rounds, C9). |
| **C9** Rounds carries no ancillary/overdue | Rounds shows only the in-run AttentionCard (man-down, actionable now). Overdue/ancillary detail stripped. |
| **C10** nav redesign | The offending bar is the **Rounds `PlaceSwitcher` / `KindView` chip strip** (and the Chores Today jump-nav strip) — `overflow-x:auto` running off-screen. Redesign: a **wrapping** place selector (no horizontal scroll) that is obviously navigational — place chips wrap to rows, with a "jump to place" affordance (ties into `CommandPalette` ⌘K for quick coops→tractor jumps). The left **sidebar** (`sections.jsx`) is fine and unchanged. |
| **C11** drop heavy/light-day text | `farmLoad` produces counts only; the LoadSpine read is "N items · M blocks" — **no** "heavy day"/"light day" string (Operator's `READ` map's "— heavy day"/"— light day" suffix is dropped). |
| **B1** week-spine overflow | Intentional overbooked signal: bar saturates at track top + warn top-rule; container `overflow-hidden`, capped height — never a silent CSS overflow. |
| **B2** day-load bar overflow | `LoadSpine` height is `%` of track with `min-height` clamp + `overflow-hidden`; no raw px exceeds the border. |
| **B3** phone dense-day box overflow | Dense state: counts wrap, `min-w-0` + `overflow-hidden` on the phone glance panes; the spine track is fixed-height with clamped bars. |

---

## 5. Disposition of every existing piece (exhaustive change-map)

KEEP = stays, restyled to the vocabulary. MOVED = relocated tier/surface.
FOLDED = absorbed into a primitive. DROPPED = deleted (with why).

### Shared substrate / primitives
| Existing piece | Fate | Into / why |
|---|---|---|
| `ui.jsx:42 Card` (raised) | FOLDED | → **Pane** (flush). The headline lever. |
| `ui.jsx:14 LABEL_CLS`, inline `T.*`, `Card` header span | FOLDED | → **Eyebrow**. |
| `PageHeader` / Chores `h2` / Rounds hero | FOLDED | → **Heading**. |
| `ui.jsx:88 StatTile` (raised) | KEEP (flush) | flush stat grid; deferrable. |
| `ui.jsx:64 StatusPill` / `ChoreRemainingPill` / `BlockBadge` | KEEP | the remaining-pill stays on the row (C2 keeps the signal, drops the verbose words). |
| `ChoreCheckRow.jsx:92 box` (28px) | SPLIT | → **CheckTarget** (factored out); `ChoreCheckRow` composes it. |
| `ChoreCheckRow.jsx:43 escalateClass` (`border-l-2 bg-warn/5`) | FOLDED | → **AttentionCard/Hole** (flush). |
| `Schedule.jsx:340 NowMarker()` + pool `NowRule` | FOLDED | → one **NowRule**. |
| `Overview.jsx:489 TimelineRow` + `Schedule.jsx:246` left-bar | FOLDED | → one **EventRow**. |
| `Schedule.jsx:2237` banner + source-change ribbon | FOLDED | → **AlertStrip**. |
| `OutboxIndicator.jsx` | KEEP | already canonical; `CheckTarget.queued` reuses its glyph. |
| `lucide-react` icons | KEEP | already the lib (C1 satisfied by using it for the top-strip glyph). |

### Schedule pieces
| Existing piece | Fate | Into / why |
|---|---|---|
| `DayRailSpine` / `DayStrip` (nav) | KEEP | day nav; restyle to spine tokens. |
| `DayRibbon.jsx` (two-lane person ribbon) | SPLIT | combined silhouette → **LoadSpine**; two-lane → conditional `.lanes` overlay only. |
| `WeekSpines.jsx` (center) | DROPPED | duplicate week language; → **WeekStrip**. |
| `WeekList` (`ScheduleSidebars.jsx`) | FOLDED | → **WeekStrip** (its counts become the strip's day footer/row). |
| `blockAlerts()` inline man-down | FOLDED | → **AttentionCard**. |
| Confirm-day badge + "changes since confirmed" + yesterday's-musts banner | DROPPED (badge) / FOLDED (strips) | **No confirm-day** (block finished by completion, gate). The two strips → **AlertStrip**. |
| `EventEntry` / project gaps / overnight blocks | KEEP→FOLDED | event/project rows → **EventRow**; project gaps now also feed **LoadSpine** (G2). |
| `ChoreCheckRow` (draggable, dnd-kit) | KEEP | Schedule passes `onEdit`/sortable; unchanged behavior. |
| `BufferSection`, `AddTaskRow`, split | KEEP | unchanged. |
| All sheets/modals + `ConflictsPanel` | KEEP (raised) | float over scrim — deliberately NOT flush. |
| `personLoad.js buildPersonLanes` | KEEP (narrowed) | feeds the conditional overlay, not the base spine. |
| `weekView.js weekFullness/weekShouldHeat` | FOLDED | → `farmLoad` (day + week + heat). |
| `useScheduleDeltas`, `useBufferTemplates`, `useEventSeries`, `useNeighborDeltas`, `useRunHistory`, `deriveDay`, `monthView`, `conflicts.js`, `buffers.js`, `overrides.js`, `manDown.js` | KEEP | data layer intact; `farmLoad` consumes deltas + manDown, doesn't replace them. |

### Dashboard pieces
| Existing piece | Fate | Into / why |
|---|---|---|
| All inline `Card` sub-cards | KEEP (flush) | → **Pane**. |
| Schedule-at-a-glance timeline | FOLDED | → **LoadSpine** + **NowRule** + **EventRow**s. |
| `WeatherWidget`, Broiler Weeks, Active Projects, Open Orders, Farm Updates, Activity (`ActivityRow`) | KEEP | content unchanged, flush containers. |
| "N changed" badge | FOLDED | → inline **AlertStrip**. |

### Chores pieces
| Existing piece | Fate | Into / why |
|---|---|---|
| `TodayTab` / `TodayObligationRow` | KEEP | rows → **ChoreCheckRow**/**CheckTarget**; escalation → **Hole**. |
| Today jump-nav chip strip | KEEP (redesigned, C10) | wrapping selector, no h-scroll. |
| `AllChoresTab` + `ChoreInlineEditor` + `ChoreFieldsEditor` + `AssignmentRulesEditor` | KEEP | flush container only. |
| `ChoresBlocksTab` (chore_blocks CRUD) | KEEP (untouched) | the **source** of dynamic day-load (G1). |
| `ChoresPerformanceTab`, `ActivityLogTab` | KEEP | flush container only. |

### Rounds pieces
| Existing piece | Fate | Into / why |
|---|---|---|
| `ColdOpen` + `RecentRuns` | KEEP | flush in-page parts → **Pane**. |
| `DoingSurface` status bar + `prog` | KEEP (raised) | full-screen takeover over scrim; `prog` stays a progress bar (≠ LoadSpine). |
| `PlaceSwitcher` / `KindView` chip strip | KEEP (redesigned, C10) | wrapping, obviously-navigational; ⌘K jump. |
| multi-person "waiting on Jim" banner | KEEP | flush. |
| man-down surface | MOVED→FOLDED | → in-run **AttentionCard** (Operator re-home). |
| overdue / "yesterday's must" detail | DROPPED (from Rounds) | C9 — Rounds is execution; overdue lives on Today/Schedule. |
| `WrapCard` (elapsed + overrun) | KEEP→FOLDED | → **FinishStamp**; "Sealed" killed (C5). |
| `AllDoneButton`, `QuickActionsTray`, `useChoreRuns`, `useRunEvents` | KEEP | unchanged. |

### Scratch / nav to delete (promote-then-delete, NO-LEGACY, in-batch)
| Existing piece | Fate | Why |
|---|---|---|
| `src/components/rethinker/RethinkerKit.jsx` | DROPPED | the harvest is done; it was the checklist. |
| `src/pages/RethinkerGallery.jsx` | DROPPED | gallery, not a destination. |
| `sections.jsx:128` `rethinker` nav item | DROPPED | + its `SectionContent` `case "rethinker"`. |
| My Round-1 `ConfirmCard` | DROPPED (never built) | hybrid has no confirm-day; conceded to Operator. |
| Pool `DesktopRibbon` / `WeekSpines` / `LoadTrack` / `SearchToAdd` / `OutboxIndicator` / `RoundsCheckbox` literals | DROPPED | hardcoded twins of real components. |

**Nothing silently lost:** every inventory piece above is KEEP / MOVED /
FOLDED / DROPPED with a reason.

---

## 6. Where I push back on a pure-Operator take, and where I concede

**Push back (1) — keep the desktop Schedule as a first-class workbench, not a
de-emphasized "scan/plan" afterthought.** The Operator mockup literally renders
desktop at `opacity:.96` with a "Ribbon cut" killnote. James's L7 and G4 say the
opposite: build the *real assembled desktop Schedule* with **more** detail than
the Operator showed. Desktop is the lead **build** tier precisely because that's
where one-typeface consistency is visible and where Schedule's dense data
(buffers, conflicts, drag-reorder, reservations) actually lives. Phone leads for
*signals*; desktop leads for *the workbench*. Both, not one.

**Push back (2) — keep the per-person lane as a conditional overlay, don't cut
it outright.** Operator cuts the ribbon entirely. I keep `personLoad.js`
scope-narrowed to feed a `.lanes` overlay that draws **only** when assignment
data is real (man-down days). This costs ~nothing on normal days (it just
doesn't render) and preserves man-down lane context for free. The gate called
this "the honest middle" — I hold it.

**Push back (3) — `LoadSpine` is one *count-driven* primitive, not a family of
bespoke load widgets.** Operator's mockup hand-tunes a `toneVar`/`LOAD` map per
state with hardcoded 5-bucket arrays. That's exactly the G1 failure. The whole
point of `farmLoad` is that **the bars come from `chore_blocks`**, so dense/
sparse/overdue are *data*, not a styling branch. Same primitive, different data.

**Concede (1) — product IA is phone-led; no confirm-day.** My Round-1
`ConfirmCard` day-anchor is cut. A block is finished by completion (FinishStamp),
not sealed by a button. Signals re-home to the phone Today glance + live Rounds.

**Concede (2) — the week lives in the Operator's clean sidebar list shape**, not
a heavy center heat strip. My `WeekStrip` *data* drives Operator's *layout* (row-
per-day, inline mini-spine, single should-tick). L6 + the gate both want the
clean sidebar; I bring the one-source week data behind it.

**Concede (3) — man-down re-homes into the running round** (Operator), surfaced
via the shared `AttentionCard`. I just insist it's the *same* `AttentionCard`
primitive everywhere it appears (glance + in-run + Schedule), not three cards.

---

## 7. Self-critique — real vs faked, and the cost to ship

- **Real / wired:** the four pages' existing data (`useChoreBlocks`,
  `useChoreCompletions`, `useSites`, `useScheduleDeltas`, `useChoreRuns`) is all
  real and stays. `farmLoad` is a *new collapse* over real walks
  (`weekView`/`personLoad`/fan-out) — buildable, but it's the main new code and
  the riskiest piece (it must exactly reproduce `weekFullness`/`weekShouldHeat`
  before those are deleted, NO-LEGACY).
- **Projects (G2/G3):** less faked than I first assumed. `deriveDay` already
  returns `projects[]` + `projectSegments[]` (`projectGaps`), and `DayRailSpine`
  already renders project gaps as slate-blue bars on the Schedule desktop rail.
  So the data is real on one surface; the work is **lifting it into `farmLoad`'s
  shared model** so project bars + interleaved project `EventRow`s appear on all
  four pages. Lower risk than a from-scratch walk, but still the first thing to
  prove on the branch (and the `who.freeCount` availability annotation is the
  part most likely to ship simplified at MVP).
- **Person-lane overlay:** real only on man-down days; on normal days it
  correctly draws nothing — which means it'll *look* unfinished in demos. That's
  intended, but worth narrating to James so an empty overlay isn't read as a bug.
- **C10 nav redesign:** the wrapping place selector + ⌘K jump is a real change to
  `PlaceSwitcher`; the harder ask ("quick jumps coops→tractor→wherever") leans on
  `CommandPalette`, which already exists — low risk.
- **Cost to ship (cheapest-first, per DESIGN.md ledger):**
  1. `Card → Pane` flush flip; `ChoreCheckRow` escalation → Hole; `NowMarker` →
     one `NowRule`. (~1-line-each lever; touches every page.)
  2. Promote `AttentionCard`/`FinishStamp`/`CheckTarget`/`LoadSpine`/`EventRow`
     into `ui.jsx`; add `lib/load/farmLoad.js`; wire phone Today glance + in-run
     AttentionCard.
  3. Fold the week into `WeekStrip` (sidebar layout); delete center `WeekSpines`
     + demote `DayRibbon`.
  4. Projects into `farmLoad` (the new walk) + C10 nav + B1/B2/B3 overflow fixes.
  5. Delete `/rethinker` scratch + nav lines.
- **What each tier still lacks at MVP:** desktop Week/Month/Review views are
  KEEP-as-is (only Day view is rebuilt first); phone Schedule is the glance, not
  the full dense editor (drag-reorder stays desktop). That's an acceptable
  Round-3 cut — the four pages work on both tiers, the dense editing is desktop.
