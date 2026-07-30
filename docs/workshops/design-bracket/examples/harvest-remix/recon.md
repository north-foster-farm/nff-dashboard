I now have everything needed. Here is the brief.

---

# STATE OF PLAY — Rethinker arc (cc72b04 → 3fcb016)

Binding recon brief for the Design Bracket. 10 files touched, +1229/−59. Arc commits run `afa484a`→`3fcb016` (note: `afa484a` amber-now pass was reverted by `58d3942`; the live arc is the LoadMeter-primitive line `35f58a1` onward).

## (A) Precise inventory

### SCRATCH POOL — `/rethinker` nav item, explicitly disposable

Reachable via `src/sections.jsx:127` (new `{ id: "rethinker", group: "Other", label: "Rethinker port", icon: Sparkles }`) wired in `src/components/SectionContent.jsx:145` (`case "rethinker"`). Delete those two lines + the two files to retire it.

- **`src/components/rethinker/RethinkerKit.jsx`** (470 lines, 14 exported specimens). 1:1 React port of the mockup, NOTHING wired to data — pure presentational, hardcoded sample values ("market Tuesday"). Exports: `Eyebrow`, `LoadTrack`/`LoadMeter` (the signature lane), `NowRule`, `SealStamp`, `RoundsCheckbox` (28px tap target), `DaySilhouette`, `EventBand`, `NeedsCoverCard`, `ConfirmCard`, `SourceChangeStrip`, `BlockCard` (sealed/now/default states), `OutboxIndicator`, `DesktopRibbon` (hardcoded two-lane), `WeekSpines` (hardcoded mini-spines + heat row), `SearchToAdd`. Internal helpers: `segStyle(kind)` (done/committed/open/event/hole fills), `barStyle(spec)` token→inline-bg resolver (so dynamic colors dodge the Tailwind JIT scanner), the `HATCH_*` 45° gradient constants.
- **`src/pages/RethinkerGallery.jsx`** (142 lines). The gallery shell — a `Specimen` wrapper card (numbered, Lora title, `→ maps to` note) rendering all 14 in a 2-col grid. Each specimen's `mapsTo` prop is the design intent map (e.g. "01 Load-meter lane → block load / Rounds progress"; "13 Desktop two-lane ribbon → desktop Schedule"). This is the de-facto harvest checklist.

Note the duplication: the scratch pool's `DesktopRibbon`/`WeekSpines`/`LoadMeter` are the *mockup-literal, hardcoded* versions; the landed `DayRibbon`/`WeekSpines` below are the *data-driven reinterpretations*. Same patterns, two copies — the pool copy is the one meant to die.

### LANDED REINTERPRETATIONS — real, shipping in the Schedule

- **`src/components/schedule/DayRibbon.jsx`** (166 lines, NEW). Desktop-only (`hidden lg:block`) horizontal hour-axis ribbon, one lane per admin, segments absolutely positioned by start/end minutes; green vertical now-line; bottom "combined day silhouette" (one bar per block, height = item count). **Data:** `lanes`/`axisStart`/`axisEnd` from `personLanes` (below), `nowMin`, `silhouette` from `daySilhouette`. **Reality: SPARSE.** A lane only shows blocks where a row's assignee literally matches the admin name; most chores carry no assignment rule so `resolveAssignee` → null → no segment. Has an explicit empty-state ("No one is assigned named work yet today"). The richest signal it can show today is reservations (off-site/break) + man-down holes, not routine load.
- **`src/components/schedule/WeekSpines.jsx`** (115 lines, NEW). Desktop-only seven-day mini-silhouette strip (height = block item count) + a should-escalation heat row (warn-alpha ramp → cat-processing on deadline day). Clickable days call `onPickDay`. **Data:** `week` (from `weekFullness`), `shouldHeat` (from `weekShouldHeat`). **Reality: MODERATELY RICH** (chore fan-out counts are real) BUT **the heat row only renders when `shouldHeat.top` exists** (a deferrable window-chore actually warming). **OVERLAP:** `WeekSpines` renders at the top of the center column (`Schedule.jsx:2231`) off the SAME `week` object that feeds `WeekList` in the right sidebar (`Schedule.jsx:2897`, `ScheduleSidebars.jsx:432`). The week is now drawn twice on the desktop day view, two different visual languages, same data.
- **`src/lib/schedule/personLoad.js`** (78 lines, NEW). `buildPersonLanes({admins, blocks, windows, manDownKeys, dayStart, dayEnd})` → `{lanes:[{name,segments}], axisStart, axisEnd}`. Pure/tolerant. Segment kinds: `done`/`committed` (assigned block work), `event`/`break` (reservation windows), `hole` (assigned ∩ off-site). `personsFor()` splits "James · Jim". **The honesty caveat is in its own header comment:** assignment is partial, so lanes are deliberately sparse rather than guessed.
- **`src/lib/schedule/weekView.js`** (+55 lines; `weekFullness`/`weekDays` already existed). NEW `weekShouldHeat(data, date, ruleOpts)` → per-day `{heat 0..1, peak, topTitle}` + `top` (week's driving should) + `peakDate`. `choreHeat()` ramps over a 5-day runway (`HEAT_RUNWAY`) via `choreDaysRemaining`. **Data:** real but narrow — only deferrable window chores (`weekly_window` etc.) generate heat; on a week with none, the whole row is suppressed.
- **`src/pages/Schedule.jsx`** (+249 lines, in-place reworks):
  - `personLanes` useMemo (shapes blockRows→lanes), `daySilhouette` useMemo, `shouldHeat` useMemo; renders `<DayRibbon>` + `<WeekSpines>` at the top of the day surface.
  - **Needs-cover card** — replaced the old one-line `leakLine` + "COVER" outline button with a flush amber-bordered card (⚠ "Needs cover" eyebrow / work+place / `coverReason` prose / solid amber "{coverer} covers — I've got it" button / faint record-note). `leakLine` deleted, `coverReason(row)` extracted and shared with the cover sheet. Imports `ADMINS` from `manDown.js`.
  - **Flush attention banners** — the source-changed-after-confirm ribbon and yesterday's-musts banner changed from raised `border-l-2 border-warn bg-warn/5` to flush `border` + `color-mix(... var(--c-warn) 6%, var(--c-bg))` (border-on-bg, per directive §3).
  - **Lora block headings** — focused block / overnight / project headers gained `font-heading … -tracking-[0.01em]`; the `EventEntry` title too.
  - **`EventBand` left rail** — `EventEntry` `<li>` got `borderLeft: 3px solid {color}`; the old round color dot was removed.
  - **`NowMarker` component** — extracted (green hairline + 7px dot + glow + "Now · time" eyebrow); now also guarded by `viewingToday` and reused in both overview and focused block.
  - **`ScheduleSidebars.jsx`** (−10): deleted `WASH_V` dawn→night gradient + its `div.absolute.inset-0` on `DayRailSpine` (directive §4 "kill the gradient").

## (B) Prior UI state & where patterns could land

At cc72b04 the Schedule used a 180px **left load-gauge rail** of block names (with the now-deleted vertical wash) → center master-detail block, plus a right-sidebar `WeekList`. Block headers were plain `text-[15px] font-semibold` (no Lora); the now-marker was inline; man-down was a text line + outline "COVER" button; banners were raised `bg-warn/5` panes. The arc reworked all of this in place.

**The app OUTSIDE the schedule — existing visual language:**

- **Dashboard (`Overview.jsx`)** is built entirely on the shared **`Card`** (`ui.jsx:42`): `bg-surface border border-line`, header = `font-ui text-[11px] uppercase tracking-[0.14em] font-bold` Inter eyebrow + lucide icon. This is the app's dominant pane chrome — and it is RAISED (`bg-surface`), the opposite of the Rethinker's flush border-on-bg. Rows are dense `text-[12–13px]` lines; the `TimelineRow` already does an **event left-bar via inset box-shadow + color-mix tint** — i.e. a primitive version of the EventBand the arc just formalized. `SubHeading`/`UpcomingBlockGroup` already use the uppercase-tracking eyebrow. `StatTile`/`StatusPill` exist in `ui.jsx`.
- **Rounds (`Rounds.jsx`)** is a full-screen takeover already in the Rethinker idiom: `font-heading … -tracking-[0.02em]` hero numbers (`{done}/{total} done`), Inter eyebrows (`tracking-[0.16em]`), `bg-surface border border-line` section cards (`PlaceSection`), a thin `h-1.5 bg-line` progress bar, `OutboxIndicator`, and **`ChoreCheckRow`** — the canonical 28px (`w-7 h-7 border-2`) checkbox the mockup's `RoundsCheckbox` was modeled on. `ChoreCheckRow` already encodes escalation as `border-l-2 border-warn bg-warn/5` (should→must), the raised treatment the arc is moving away from.
- **Chores (`Chores.jsx`)** — inline-styled Lora `h2` (32px), a `TabBar`, reuses `ChoreCheckRow` + `BlockBadge`.

**Where harvested patterns plausibly land app-wide:** the flush-card + Lora-heading + Inter-eyebrow trio should become the default replacing the raised `Card` (Dashboard, Chores, every pane); the EventBand left-rail unifies with `Overview.TimelineRow`'s existing left-bar; the LoadMeter/silhouette generalizes to Dashboard "day at a glance" and Rounds progress; the NeedsCoverCard's flush-amber treatment supersedes `ChoreCheckRow`'s raised escalation tint; the SealStamp maps to the Rounds WrapCard; `RoundsCheckbox` is already `ChoreCheckRow`.

## (C) Harvestable vocabulary (patterns, independent of components)

1. **Amber-hatch hole / needs-cover treatment** — `inset 0 0 0 1.5px warn` + faint 45° amber hatch + the ⚠-eyebrow card with one solid-amber action. Generalizes to any orphaned/blocked obligation: Rounds, Dashboard man-down, overdue musts (replacing `ChoreCheckRow`'s raised tint).
2. **Hairline-flush card chrome** (border-on-bg, NOT raised-surface) — `border` + `color-mix(token N%, var(--c-bg))`. The biggest app-wide lever: it conflicts with the current raised `Card`/`PlaceSection`/banner convention everywhere.
3. **Lora headings + Inter eyebrows** — `font-heading -tracking-[0.01..0.02em]` for block/section/pane titles; uppercase `tracking-[0.12–0.16em]` Inter labels. Already partly present (Rounds, Chores h2); generalizes to Dashboard `Card` titles and all pane headers.
4. **Now-marker / NowRule** — green 1.5px hairline + 7px dot + glow, never a colored block. Lands on any "now" divider (Schedule done; could mark the Dashboard timeline's current moment).
5. **Load-spine / silhouette** — height-encoded bars (item count or duration), per block. Generalizes to Dashboard day-at-a-glance, week navigators, place occupancy.
6. **Per-person lane model** — two stacked tracks (Jim/James) segmented by state. Powerful but data-gated; generalizes only where assignment data is real (currently almost nowhere — see sparsity).
7. **Should-escalation heat** — warn-alpha ramp over a deadline runway → cat-processing burn on the deadline day. Generalizes to any deferrable-with-deadline surface (Chores "all" list, Dashboard upcoming).
8. **Seal / confirm stamp** — celadon ✓ "Sealed · who · window · 7/7"; the day-confirm anchor. Maps to Rounds WrapCard and a day-confirm affordance (the `ConfirmCard` specimen has no landed home yet).

Two specimens have **no landed reinterpretation yet**: `ConfirmCard` (day-confirm anchor) and `SourceChangeStrip` (the live source-change ribbon was only restyled flush, not adopted as the strip). `SearchToAdd`/`OutboxIndicator` already have real equivalents (`AddToScheduleSearch`, `components/OutboxIndicator.jsx`).

## (D) Binding constraints

- **Extract patterns, don't transplant components** (DESIGN-SYSTEM §0a). The literal port was scaffolding; the destination is OUR components wearing the vocabulary. "Looks the same, doesn't necessarily behave the same." System wins over any per-finding/earlier styling request (James's explicit instruction).
- **Flush, not raised** (§0a.3). Cards sit on the page defined by their border, not raised `surface-alt` interstitials. "I want to start from there."
- **Kill the gradient** (§0a.4) — done; don't reintroduce washes.
- **NO-LEGACY** (MEMORY): each iteration folds the old in and DELETES it — never a dual-source shim, soak, or feature flag. The current `WeekSpines`↔`WeekList` and pool-copy↔landed-copy duplications violate the spirit and must collapse to one.
- **No implicit data mutation** (MEMORY): never mutate committed data as a side effect of refresh/session; surface + prompt. Live-data *display* is fine.
- **The `/rethinker` scratch is meant to be retired** once patterns live in real components. Treat the gallery as a checklist, not a destination; deleting it is in-scope, not out.
- **Tokens/fonts are already shared** (§0) — the gap is IA + vocabulary + execution, NOT palette/typeface. Use only existing tokens (`bg/surface/surface-alt/line/fg/dim/muted/faint/accent/accent-deep/warn/resolved/project/on-accent` + `cat-*`); color must be functional, never decorative; sharp corners (no `rounded-*`); tabular numerals for data.
- **Theme:** mockup is dark, app defaults to light for James; the system must work in BOTH (open question §7 — not yet resolved).
- **Reality check for any lane/per-person design:** assignment data is sparse (`resolveAssignee` null for un-ruled chores). A design leaning on per-person load will look empty in production unless it degrades gracefully to reservations + holes, or the bracket proposes closing that data gap.

Key file paths: `src/components/rethinker/RethinkerKit.jsx`, `src/pages/RethinkerGallery.jsx`, `src/components/schedule/DayRibbon.jsx`, `src/components/schedule/WeekSpines.jsx`, `src/lib/schedule/personLoad.js`, `src/lib/schedule/weekView.js`, `src/pages/Schedule.jsx`, `src/components/ScheduleSidebars.jsx`, `src/components/ui.jsx`, `src/components/ChoreCheckRow.jsx`, `src/pages/Overview.jsx`, `src/pages/Rounds.jsx`, `src/pages/Chores.jsx`, `.ignored/playbooks/design-bracket/DESIGN-SYSTEM.md`.