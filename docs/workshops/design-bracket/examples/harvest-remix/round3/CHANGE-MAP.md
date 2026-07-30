# Round 3 — CHANGE-MAP (review this before greenlighting)

_The single artifact James approves first. For each of the four pages: every
existing piece from `EXISTING-INVENTORY.md`, with its disposition — KEEP /
MOVED / SPLIT / FOLDED / DROPPED — and where it goes. Nothing silently lost.
Then: NEW pieces introduced, and Net dropped functionality (loud)._

**Disposition key:** KEEP = stays, restyled to the vocabulary · MOVED =
relocated tier/surface · SPLIT = one piece becomes two · FOLDED = absorbed into
a primitive · DROPPED = deleted (reason given).

**Whole-rebuild guarantee:** view-layer only. No data-model change, no
migration. All shared hooks/libs are KEEP.

---

## Shared substrate / primitives (depended on by all four pages)

| Existing piece | Disposition | Destination / into what | Why |
|---|---|---|---|
| `ui.jsx:42 Card` (raised, `bg-surface`) | FOLDED | **Pane** (flush, `--c-bg`) | the headline flush-not-raised lever |
| `ui.jsx:14 LABEL_CLS`, inline `T.*`, Card header span | FOLDED | **Eyebrow** | one uppercase-label idiom |
| `PageHeader` / Chores `h2` / Rounds hero number | FOLDED | **Heading** | one Lora-title idiom |
| `ui.jsx:88 StatTile` (raised) | KEEP (flush) | flush stat grid | deferrable follow-up, not blocking |
| `ui.jsx:64 StatusPill` / `BlockBadge` / `ModifierBadges` / `PlaceTag` | KEEP | unchanged | shared, no change needed |
| `ChoreRemainingPill` (should/must text) | FOLDED | **WindowBar** | window-of-time visual; drops the words (C3/L5) |
| `ChoreCheckRow.jsx:92 28px box` | SPLIT | **CheckTarget** (composed back into `ChoreCheckRow`) | one tap target app-wide; kills 22/20/16px reimpls |
| `ChoreCheckRow.jsx:43 escalateClass` (`border-l-2 bg-warn/5`) | FOLDED | **AttentionCard** / **Hole.row** | flush warn, hatch text-free (C4) |
| `ChoreCheckRow` completion engine, drag/edit, modifiers | KEEP | unchanged | highest-risk shared engine — restyle container only |
| `Schedule.jsx:340 NowMarker()` + Rethinker pool copy | FOLDED | **NowRule** | one shared today-only marker |
| `Overview.jsx:489 TimelineRow` + `Schedule.jsx:246` left-bar + `EventEntry` | FOLDED | **EventRow** | one event-rail treatment app-wide |
| `OutboxIndicator.jsx` | KEEP | unchanged; `CheckTarget.queued` reuses its glyph | offline-first indicator stays canonical |
| `lucide-react` | KEEP | top-strip glyph + ⚠/✓/CloudOff | already the lib (C1) |
| `useChoreBlocks`, `useChoreCompletions`, `useSites`, `useChoreDefinitions`, `useChoreAssignmentRules`, `useChoreModifiers` | KEEP | consumed by `farmLoad` + pages | shared data layer — never touched |
| `getChoresForDay` / `expandChoreForDay` / `obligationPlaceIds` / `rollupChoresForDay` | KEEP | consumed by `farmLoad` | the fan-out engine — read, not replaced |
| `choreDaysRemaining` (`lib/chores.js`) | KEEP | feeds **WindowBar** + `farmLoad.heat` | the should→must engine stays; only its rendering changes |
| `resolveBlockMinutes` / `sunTimes.js` | KEEP | feeds `farmLoad` block state | unchanged |

---

## SCHEDULE — `src/pages/Schedule.jsx`

| Existing piece | Disposition | Destination / into what | Why |
|---|---|---|---|
| `DayRailSpine` / `DayStrip` (nav spines) | KEEP | restyle to spine tokens; phone `DayStrip` → **WeekStrip** header | day nav role preserved |
| `DayRibbon` (two-lane person ribbon + silhouette) | SPLIT | silhouette → **LoadSpine**; two-lane → conditional `.lanes` overlay | desktop-only + empty in prod; only real signal (man-down hole) harvested |
| `WeekSpines` (center week heat) | DROPPED | → **WeekStrip** | duplicate week; B1 overflow dies with it |
| `WeekList` (sidebar week column) | FOLDED | **WeekStrip** (single week) | absorbs spine + heat tick |
| `blockAlerts()` inline man-down | FOLDED | **AttentionCard** | one amber obligation card, flush (C4/C6) |
| Confirm-day control (button → "Confirmed · {time}" badge) | KEEP (restyle) | flush confirm affordance on the day header; writes `schedule.confirmed_day` capture | James's deliberate plan-level action — kept (≠ block completion); all 3 purposes preserved |
| "changes since confirmed" ribbon | FOLDED | **AlertStrip** (passive "N changed", also on Dashboard) | real delta signal kept; it's now passive (the confirm *action* stays, only its old gate-styling goes) |
| "Yesterday's unfinished musts" banner | MOVED + REWORD | **AlertStrip** on Schedule/Dashboard; OFF Rounds (C9); copy drops "yesterday"/"must" (C8) | overdue is context, not a Rounds concern |
| Reservations/buffers chips, conflicts button, `ConflictsPanel`, `BufferSection` | KEEP | restyle flush | real planning tools |
| Time-ordered block body, counts, project gaps, overnight blocks | KEEP | flush **Pane** variants | the operator's level of detail — conserved |
| `EventEntry` | FOLDED | **EventRow** | one event-rail treatment |
| Draggable `ChoreCheckRow` (dnd-kit), `AddTaskRow`, split | KEEP | container restyled flush; composes **CheckTarget** | untouched engine |
| `NowMarker` (Schedule top chrome) | FOLDED | **NowRule** | shared primitive |
| Top-strip temperature emoji `⛅` | KEEP (re-icon) | **Lucide** icon (C1) | wrong icon source only |
| All sheets/modals (`AddToScheduleSearch`, `ScheduleEditSheet`, `ReservationSheet`, `BufferSheet`, `EventTimeSheet`, `SplitBlockSheet`, `EventScopePrompt`, `CoverSheet`) | KEEP (raised) | float over scrim — deliberately NOT flush | DESIGN floor #1 |
| `useScheduleDeltas`, `useBufferTemplates`, `useEventSeries`, `useNeighborDeltas`, `useRunHistory` | KEEP | unchanged | data layer intact |
| `deriveDay`, `projectGaps`/`partition`, `overnightWindow`, `placement`, `overrides`, `manDown`, `conflicts`, `buffers`, `monthView`, `lookBack` | KEEP | `farmLoad` consumes `deriveDay`/`projectGaps`/`manDown`; rest unchanged | substrate — read, not replaced |
| `weekView.js` `weekFullness` / `weekShouldHeat` | FOLDED | `farmLoad` (day + week + heat) | one model + one `heatColor()` |
| `personLoad.js` `buildPersonLanes` | KEEP (narrowed) | feeds conditional `.lanes` overlay only | never the base spine |
| `monthView.js`, `lookBack.js`, Month / Review views (`ScheduleZoom`, `ScheduleReview`) | KEEP | light reskin only this round | structurally unchanged |
| Week view (`WeekView`) | KEEP | adopts **WeekStrip**/**LoadSpine** language | one vocabulary |
| `captures` (`schedule.confirmed_day`) | KEEP (read + write) | confirm-day action still writes it; drift still read from it | snapshot + confirm-frequency/deviation data points preserved |

---

## DASHBOARD — `src/pages/Overview.jsx`

| Existing piece | Disposition | Destination / into what | Why |
|---|---|---|---|
| Upcoming Chores card (block-grouped, live counts) | KEEP | **Pane** + block groups + **ChoreCheckRow**s | same data |
| Schedule-at-a-glance (events+chores+projects timeline) | SPLIT | load read → **LoadSpine**; rows → **EventRow** list; `SunCountdownPill` ticker KEEP; "N changed" → **AlertStrip** | the load becomes dynamic + projects woven |
| `TimelineRow` (inset-bar) | FOLDED | **EventRow** | one event-rail |
| `WeatherWidget` / `useCurrentWeather` | KEEP | top-strip icon → Lucide (C1); **Pane** | content unchanged |
| Broiler Weeks countdown (`metrics.js`, `useProcessingDates`) | KEEP | **Pane** | reskin |
| Active Projects | KEEP | **Pane**; also feeds project columns into **LoadSpine** (G3) | projects woven |
| Open Orders, Farm Updates | KEEP | **Pane** | reskin |
| Activity since yesterday (`useActivityLog`, realtime, edit/delete, `ActivityRow`) | KEEP | **Pane** | content unchanged |
| (no man-down today) | NEW (ADD) | **AttentionCard** | man-down re-homes here as lead glance signal (C6) |
| All inline `Card` sub-cards | FOLDED | **Pane** (flush) | one vocabulary |

---

## CHORES — `src/pages/Chores.jsx`

| Existing piece | Disposition | Destination / into what | Why |
|---|---|---|---|
| `TodayTab` (filter, by-block, place-tree) | KEEP | flush reskin; jump-nav → §4 nav (C10) | conserved |
| `TodayObligationRow` | KEEP (restyle) | checkbox/badges/message kept; remaining-pill → **WindowBar**; escalation → **Hole**/**AttentionCard** | signal kept, words/raised-border dropped |
| Today jump-nav chip strip | KEEP (redesigned, C10) | wrapping cluster + jump affordance | no off-screen h-scroll |
| `AllChoresTab` (sortable, search, dormant, newspaper) | KEEP | **Pane** container only | reskin |
| `ChoreInlineEditor` / `ChoreFieldsEditor` / `AssignmentRulesEditor` | KEEP | unchanged | full editing preserved |
| `ChoresBlocksTab` (CRUD `chore_blocks`) | KEEP + ADD preview | untouched CRUD + small **LoadSpine** preview | the source of truth for dynamic day-load (G1); preview closes the loop visibly |
| `ChoresPerformanceTab` (30-day `chore_runs`) | KEEP | **Pane** | reskin |
| `ActivityLogTab` (completion log, filters, edit/delete) | KEEP | **Pane** | reskin |
| `ChoreRemainingPill` (should/must text) | FOLDED | **WindowBar** | window-of-time visual (C3/L5) |
| `ChoreCheckRow` escalation border | FOLDED | flush warn / **AttentionCard** | C4 |
| `ChoreMessageButton`, `PlaceTree` | KEEP | unchanged | shared |

---

## ROUNDS — `src/pages/Rounds.jsx`

| Existing piece | Disposition | Destination / into what | Why |
|---|---|---|---|
| `ColdOpen` (start CTA, other blocks), `RecentRuns` | KEEP | in-page parts → **Pane** | flush reskin |
| `DoingSurface` status bar (progress `prog`, elapsed, cancel/finish) | KEEP (raised) | + **NowRule** in header; `prog` stays a progress bar (≠ LoadSpine) | full-screen takeover over scrim |
| `OutboxIndicator` | KEEP | stays loud in the run | offline indicator |
| "Waiting on Jim" multi-person banner | KEEP | flush | real coordination signal |
| `PlaceSwitcher` (geo vs kind_tag) / `KindView` chip strip | KEEP (redesign chrome, C10) | wrapping cluster + ⌘K/`PlaceTree` jump | no off-screen scroll |
| `AllPlacesView`→`PlaceSection`, `SelectedPlaceView` | KEEP | `bg-surface` in-page → **Pane** | flush reskin |
| `AllDoneButton`, `ChoreCheckRow` rows, `QuickActionsTray` (Note/MASH/Mortality/Eggs) | KEEP | composes **CheckTarget**; tray stays raised | untouched engine |
| man-down surface | MOVED → FOLDED | in-run **AttentionCard** (Operator re-home) | the one mid-round actionable signal — survives C9 |
| overdue / "yesterday's must" detail | DROPPED (from Rounds) | lives on Today/Schedule/Dashboard | C9 — Rounds is execution, not info-checking |
| `WrapCard` (elapsed + overrun) | KEEP → FOLDED | **FinishStamp** ("Finished · who · window · N/N"), whole-run | "Sealed" killed (C5) |
| `useChoreRuns`, `useRunEvents` | KEEP | unchanged | run lifecycle/outbox |

---

## NEW pieces introduced

| New piece | What it is |
|---|---|
| `lib/load/farmLoad.js` | The linchpin derivation (G1/G2/G3). Thin presentation collapse over `deriveDay`/`rollupChoresForDay`/`projectGaps`/`manDown`/`weekFullness`/`weekShouldHeat`. Exposes per-block `{blockId,name,kind,total,done,projectCount,state,window}`, week + heat folds, conditional `lanes`, `heatColor()`/`loadColor()`. Reads `useChoreBlocks` so blocks are the organizing principle. **No engine rewrite, no data-model change.** |
| `Pane` | Flush bordered in-page section; replaces raised `Card`. |
| `Eyebrow` | Inter uppercase micro-label, one idiom. |
| `Heading` | Lora title, one idiom. |
| `NowRule` | Shared green hairline + dot + "Now · time", today-views only. |
| `AttentionCard` (+ `Hole.row`) | The one amber obligation card (man-down/overdue), flush, emphatic header, hatch text-free. |
| `FinishStamp` | Whole-run completion stamp; "Finished/Completed," no "Sealed." |
| `LoadSpine` | Count-driven day-load bars from `farmLoad`; dynamic blocks + project columns; clamped (B2); optional `.lanes` overlay. |
| `EventRow` | One left-color-bar timeline row, app-wide. |
| `CheckTarget` | The 28px completion box factored out of `ChoreCheckRow`, composed back in. |
| `WeekStrip` | The week drawn once; sidebar row-per-day (desktop) + 7-col header (phone); one should-tick per day. |
| `WindowBar` | Window-of-time track for an obligation (the L5 visual); replaces should/must words. |
| `AlertStrip` | One flush passive warn strip (offline / "N changes" / overdue context). |
| Phone bottom tab bar + wrapping place selector (C10) | Obviously-navigational nav; no off-screen scroll; ⌘K/PlaceTree quick place jumps. |
| Blocks-tab `LoadSpine` preview | Small live preview tying a block edit to the day-load (proves G1). |

All primitives must be documented in BOTH faces of the design library
(`public/style-guide/` + `DESIGN-SYSTEM.md`) as they land.

---

## Net dropped functionality

> **Confirm-day — NOT dropped (resolved with James, 2026-06-29).** Earlier draft
> proposed cutting it; James clarified its three purposes — (1) the shared
> confirm *action* he + his dad perform to mark a day planned, (2) the plan
> snapshot at confirm time for drift highlighting, (3) the data points (confirm
> frequency / how often confirmed days change / deviation). All three are
> **KEPT**: the confirm affordance + `schedule.confirmed_day` capture write are
> retained (restyled flush, not a raised gate). This is orthogonal to block
> completion, which stays auto-derived (no submit). **No sign-off needed — there
> is now no genuine behavior removal.**

The remaining items below only *relocate* a signal; nothing a user can do today
is lost:

1. **Two-lane person ribbon — DEMOTED to conditional overlay (effectively gone on
   normal days).** The desktop two-lane `DayRibbon` no longer draws as a base
   layer; it renders only as a `.lanes` overlay on days with real
   reservation/assignment data (man-down days). On a normal day it shows nothing.
   In prod, assignment data is sparse, so **most days lose the lane visual** — by
   design (it was empty/misleading before). `personLoad.js` is kept, scope-
   narrowed. No data lost; the visual is conditional.

2. **Spelled-out should/must escalation text — DROPPED (signal kept).** The
   verbose should→must wording and the "heavy day"/"light day" text are removed
   (C2/C3/C11). The *signal* survives as `WindowBar` + the WeekStrip tick — you
   lose the words, not the information.

3. **"Yesterday's must / overdue" detail on Rounds — DROPPED from Rounds only**
   (C9). Still available on Today/Schedule/Dashboard; just not inside the running
   round. Net: no information lost app-wide, only relocated.

4. **`/rethinker` scratch — DELETED** (`RethinkerKit`, `RethinkerGallery`, the 2
   nav lines). It was harvesting raw material, never a destination. No user-facing
   loss.

**Everything else is conserved** — all editing (chore CRUD, block CRUD,
assignment rules, schedule sheets, drag-reorder, split, buffers, reservations,
conflicts), all data hooks, the completion/outbox path, Rounds lifecycle,
Performance/Activity logs, Month/Review views, weather, broiler countdown,
projects/orders/updates. Month/Review get a light reskin only (not a rebuild)
this round — full migration is a deferrable follow-up, not a drop.
