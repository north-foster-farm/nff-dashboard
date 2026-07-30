# Existing-pages inventory (grounding for Round 3)

_Consolidated from a 4-way read of the live codebase, 2026-06-29. This is the
"before" side of the change-map: what Dashboard / Schedule / Chores / Rounds
render today and the data behind them. The Round-3 hybrid must conserve all of
this functionality unless James explicitly approves dropping a piece._

## Reality check — what is REAL vs MOCKUP-ONLY

The DESIGN.md / mockups name primitives that **do not exist in the app yet**.
Don't "preserve" them — they're proposals:

- **`NowRule`** — proposed. Today: a local `NowMarker()` in `Schedule.jsx`
  (green hairline + dot + "Now") and the Rethinker pool copy. No shared one.
- **`AttentionCard`** — proposed. Today: man-down "Needs cover" cards are built
  by `blockAlerts()` inline in `Schedule.jsx` (amber, ⚠, work + reason + cover
  button); `ChoreCheckRow` shows escalation as a raised `border-l-2` left border.
- **`SealStamp` / "Sealed"** — proposed wording only. Today Rounds has NO "seal"
  language: completion is **auto-derived** (run flips `in_progress → done` when
  every obligation is ticked; the `WrapCard` shows elapsed time + overrun, no
  submit step). James's "kill Sealed" = don't introduce that word.
- **`LoadSpine` / `farmLoad` / `WeekStrip` / `Pane`** — proposed primitives.
  Today the load visuals are `DayRailSpine`/`DayStrip` (nav), `DayRibbon`
  (two-lane person ribbon), `WeekSpines` (mini week heat), `WeekList` (sidebar
  week column), all keyed off separate data-walks (`weekFullness`,
  `weekShouldHeat`, `personLoad`, `monthFullness`). `Card` is the current pane.

## Shared substrate (all four pages depend on these — DON'T break)

Data hooks (`src/lib/data/`):
- `useChoreBlocks()` — block defs `{id,name,startKind,startMinutes,
  durationMinutes,sortOrder,isActive}`. **The day-load organizing principle.**
- `useChoreCompletions(date)` — `isDone/isQueued/toggle/toggleMany`, outbox-backed
  (offline-first). Source of truth for ticks across all 4 pages.
- `useSites()` — place tree + occupancy (`placesById`, `childrenByParent`,
  `placementsByPlaceId`, `choreCtx`).
- `useChoreDefinitions()`, `useChoreAssignmentRules()`, `useChoreModifiers()`.

Lib (`src/lib/`):
- `getChoresForDay` / `expandChoreForDay` / `obligationPlaceIds` — the anchor
  fan-out engine (chore → concrete places by species/batch/place/kind/occupancy;
  dormancy gating). `rollupChoresForDay` (schedule/deriveDay) groups by block.
- `choreDaysRemaining` — the **should→must escalation** logic (window chores warm
  future→today→overran). Rendered today as `ChoreCheckRow` left-border + the
  `ChoreRemainingPill`. Lives in `lib/chores.js`.
- `resolveBlockMinutes` / `sunTimes.js` — sun-relative block start resolution.

Shared components (`src/components/`):
- **`ChoreCheckRow`** — THE checkable (chore, place) row. Used by Schedule,
  Chores (Today), Rounds. Carries checkbox, modifiers, remaining-pill, escalation
  border, optional edit/drag (Schedule). The most-shared, highest-risk piece.
- `ChoreRemainingPill`, `ModifierBadges`, `BlockBadge`, `ChoreMessageButton`,
  `PlaceTag`, `PlaceTree`, `OutboxIndicator`, `ActivityRow`,
  `ChoreFieldsEditor`, `AssignmentRulesEditor`, `Card` (ui.jsx).

## DASHBOARD — `src/pages/Overview.jsx` (label "Dashboard")

All sub-cards are inline in Overview.jsx unless noted.
- **Row 1 L:** Upcoming Chores card — next chores grouped by block, per-place
  fan-out, live done counts (`getChoresForDay`+`useChoreCompletions`).
- **Row 1 R (stack):** Current Conditions (`WeatherWidget.jsx`,
  `useCurrentWeather`); Broiler Weeks countdown (`metrics.js` weeksTimeline +
  `useProcessingDates`); **Schedule-at-a-glance** = today/tomorrow/upcoming
  timeline merging events+chores+projects (`rollupChoresForDay`,
  `getEventOccurrences`, `SunCountdownPill` live ticker, "N changed" badge).
- **Row 2:** Active Projects · Open Orders · Farm Updates (counts + quick-open).
- **Row 3:** Activity since yesterday (`useActivityLog`, realtime, edit/delete,
  "view all").

## SCHEDULE — `src/pages/Schedule.jsx` (the dense one)

Views: **Day** (master-detail accordion, default), **Week** (`WeekView`),
**Month** (`MonthView`) — both `ScheduleZoom.jsx`; **Review** (`ScheduleReview.jsx`
— routine drift + plan-vs-actual).
Day-view pieces:
- Nav: `DayRailSpine` (desktop vertical), `DayStrip` (phone horizontal),
  `WeekList` (desktop week column) — all `ScheduleSidebars.jsx`.
- `DayRibbon` (two-lane person ribbon + silhouette — desktop, **cut per DESIGN**),
  `WeekSpines` (mini week heat + should-escalation — **dup of week, cut**).
- Top chrome: Confirm-day badge + "changes since confirmed" ribbon +
  "yesterday's unfinished musts" banner + reservations/buffers chips + conflicts
  button + `NowMarker`.
- Body (overview): time-ordered blocks + `EventEntry` + project gaps +
  overnight blocks, each with counts. Block detail: header + "Open rounds" +
  buffers (`BufferSection`) + man-down `blockAlerts` + draggable `ChoreCheckRow`s
  (dnd-kit) + `AddTaskRow` + split. Project/Overnight detail variants.
- Sheets/modals: `AddToScheduleSearch`, `ScheduleEditSheet`, `ReservationSheet`,
  `BufferSheet`, `EventTimeSheet`, `SplitBlockSheet`, `EventScopePrompt`,
  `CoverSheet`, `ConflictsPanel`.
- Data: `useScheduleDeltas` (the `commitments` table — ad-hoc/note/chore/project/
  override/reservation/buffer, outbox-merged), `useBufferTemplates`,
  `useEventSeries`, `useNeighborDeltas` (overnight), `useRunHistory` (Review),
  captures (`schedule.confirmed_day`). Derivation: `deriveDay`, `projectGaps`/
  `partition.js`, `overnightWindow`, `placement.js`, `overrides.js`, `manDown.js`
  (computeManDown/pickCoverPerson), `conflicts.js`, `buffers.js`, `weekView.js`
  (`weekFullness`/`weekShouldHeat`), `monthView.js`, `personLoad.js`
  (`buildPersonLanes`), `lookBack.js` (Review).

## CHORES — `src/pages/Chores.jsx` (5 tabs)

- **Today** (`TodayTab`): user-filtered (James/Jim, Mine/All), chores by block,
  place-tree nested, `TodayObligationRow` (checkbox + badges + remaining pill +
  message). Jump-nav chip strip.
- **All chores** (`AllChoresTab`): every definition, sortable (place/A–Z/time),
  search, inline `ChoreInlineEditor` (`ChoreFieldsEditor`+`AssignmentRulesEditor`),
  quick-edit chips (anchor/schedule/frequency), dormant section, newspaper columns.
- **Blocks** (`ChoresBlocksTab.jsx`): **CRUD for `chore_blocks`** — name, start
  kind (fixed/sunrise/sunset), start minutes, duration, active/archived. THIS is
  where the user-defined blocks the dynamic day-load must read come from.
- **Performance** (`ChoresPerformanceTab.jsx`): 30-day `chore_runs` aggregates.
- **Activity log** (`ActivityLogTab`): completion log, filters, edit/delete.

## ROUNDS — `src/pages/Rounds.jsx` (full-screen takeover, the doing surface)

Lifecycle: **Cold open** (`ColdOpen` — start CTA, other blocks, `RecentRuns`) →
**Active run** (`DoingSurface`) → **Wrap** (`WrapCard` — elapsed + overrun, close).
DoingSurface: status bar (progress X/Y, elapsed, outbox, cancel/finish),
multi-person "waiting on Jim" banner, `PlaceSwitcher` (geography vs kind_tag mode),
views (`AllPlacesView`→`PlaceSection`, `KindView`, `SelectedPlaceView`),
`AllDoneButton` bulk-tick, `ChoreCheckRow` rows, `QuickActionsTray` (Note/MASH/
Mortality/Eggs). Data: `useChoreRuns` (run lifecycle + participants + outbox),
`useRunEvents` (activity/quick actions), plus the shared chore substrate.
Completion auto-derives done; offline-first throughout.

## The two big GAPS to design in (neither page does these today)

- **Dynamic day-load:** today's load visuals (`DayRibbon`/`WeekSpines`/spine)
  are NOT a clean "day-load bar derived from the live user-defined blocks." The
  rebuild's day-load must read `chore_blocks` (+ fan-out counts) directly so
  adding/removing a block on the Chores › Blocks tab changes every day-load.
- **Projects in day-load:** projects exist as `project_*`/commitments + project
  gaps in Schedule and the Dashboard Active-Projects card, but are NOT surfaced
  in any day-load read. Round 3 must weave project blocks into day-load + across
  all four pages.
