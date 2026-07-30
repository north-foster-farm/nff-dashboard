# Harvest-remix — commit ledger (out-of-band)

_James's call (2026-06-30): **do NOT commit** until the whole Round-3 rollout is
done and confirmed-to-keep. This file records exactly what to group into each
checkpoint commit + the draft message, appended as each build step lands, so the
branch can be sliced into clean per-step commits at the end (or abandoned whole)._

House style (CLAUDE.md): `<type>: <summary>` — lowercase subject, no trailing
period; blank line; 1–3 sentence context paragraph; `-` bullets wrapped ~72;
**no Co-Authored-By trailer**. These are plain `feat:` commits (NOT `feat: batch
N`), so **no version bump** (the version-sync hook only enforces equality, which
already holds at `0.10.77-alpha`).

Order matters: farmLoad (step 0) must land before the steps that consume it.

---

## Commit 1 — Step 0: farmLoad day-load derivation (the go/no-go gate)

**Files:**
- `src/lib/load/farmLoad.js`  (new)

(The regression harness `…/round3/verify-farmload.mjs` is under `.ignored/` and
gitignored — not part of the commit.)

**Draft message:**
```
feat: farmLoad day-load derivation (harvest-remix step 0)

The linchpin for the Round-3 view-layer remix: a thin presentation
collapse that READS the existing derivation walks (it never replaces
deriveDay or the engine). Build step 0 / go-no-go gate — verified to
reproduce weekFullness/weekShouldHeat before any call site is repointed.

- Folds rollupChoresForDay + obligationPlaceIds/resolveAssignee +
  reservationWindows/computeManDown + weekFullness/weekShouldHeat +
  buildPersonLanes + projectGaps into one read model.
- Exposes { dayISO, blocks[], projects[], week, heat, lanes, totals }
  with per-block { blockId, name, kind, startMin, endMin, total, done,
  projectCount, state, window }.
- Exports heatColor()/loadColor() (tokens only; project = --c-project,
  never blue — review item C7).
- View-layer only: no data-model change, no migration, no schema touch.
```

---

## Commit 2 — Step 1: flush Pane + unified NowRule + de-raised escalation

**Files:**
- `src/components/ui.jsx`            (Card → flush Pane; add NowRule)
- `src/pages/Overview.jsx`           (Card → Pane)
- `src/pages/Metrics.jsx`            (Card → Pane)
- `src/pages/BatchPage.jsx`          (Card → Pane)
- `src/components/BatchMetrics.jsx`  (Card → Pane)
- `src/components/ChoreCheckRow.jsx` (escalation de-raised to flat fill)
- `src/pages/Schedule.jsx`           (NowMarker collapsed into NowRule)
- `public/style-guide/DESIGN-SYSTEM.md`   (Pane/NowRule → Stable)
- `public/style-guide/components.html`    (Pane/NowRule → Stable)

**Draft message:**
```
feat: flush Pane + unified NowRule (harvest-remix step 1)

The cheapest-first lever of the Round-3 remix: promote the flush
container + now-marker into one vocabulary, touching every page.
View-layer only. The full Hole.row/AttentionCard/WindowBar treatment is
deferred to step 2.

- Pane: built flush in ui.jsx (border on --c-bg, never bg-surface;
  tone="warn" flat color-mix tint; title/eyebrow/actions props). The
  raised Card was folded in and DELETED (NO-LEGACY); all four consumers
  (Overview/Metrics/BatchMetrics/BatchPage) import Pane.
- NowRule: one canonical impl in ui.jsx (preformatted time / label
  override, today-views only). Schedule's NowMarker collapsed into it,
  both call sites repointed.
- ChoreCheckRow escalation de-raised: dropped the border-l-2 left-rail
  for a flush flat fill (bg-warn/[0.08] / bg-accent-deep/[0.06]).
- Design library updated both faces: Pane + NowRule -> Stable in
  DESIGN-SYSTEM.md and components.html; migration order marks step 1
  shipped.
```

---

## Commit 3 — Step 2a: promote the primitive vocabulary into ui.jsx

**Files:**
- `src/components/ui.jsx`            (add CheckTarget, AttentionCard +
                                      AttentionCard.Row, FinishStamp, LoadSpine,
                                      EventRow, WindowBar, AlertStrip, WeekStrip;
                                      import Check/AlertTriangle + loadColor)
- `src/components/ChoreCheckRow.jsx` (compose CheckTarget; drop Check import)
- `public/style-guide/DESIGN-SYSTEM.md`   (8 entries → Stable, sources → ui.jsx;
                                           SealStamp→FinishStamp; add WindowBar;
                                           banner→AlertStrip; migration ◐ step 2)
- `public/style-guide/components.html`    (same set flipped to Stable + reworded;
                                           SealStamp→FinishStamp; banner→AlertStrip;
                                           add WindowBar)

**Draft message:**
```
feat: promote primitive vocabulary into ui.jsx (harvest-remix step 2a)

The one shared presentation vocabulary for the Round-3 remix, built once
in ui.jsx and imported by all four pages. View-layer only; the
completion path, hooks, and data model are untouched. Surface wiring
(phone Today, desktop Schedule) follows in 2b/2c.

- CheckTarget: the 28px completion box factored out of ChoreCheckRow,
  which now composes it (one tap target app-wide, same outbox path); a
  queued/unsynced tick warms the box border.
- AttentionCard (+ AttentionCard.Row): the one amber obligation surface
  — flush flat color-mix warn body, Lora work line, solid-amber action
  (C6); the compact Row is the inline overdue variant. Hatch stays
  text-free (C4).
- FinishStamp: whole-run completion stamp — celadon check + "Finished ·
  who · window · N/N"; kills the "Sealed" word (C5).
- LoadSpine: count-driven day-load bars reading farmLoad blocks; clamped
  + overflow-hidden (B2), project bars --c-project (C7), man-down hole
  the only warn hatch.
- EventRow: one inset-left-bar timeline row (column-aligned), category
  hue, chore-time blue reserved (C7).
- WindowBar: window-of-time track replacing the should/must words (C3).
- AlertStrip: flush passive warn strip (offline / changes-since-confirmed
  / yesterday); never a gate.
- WeekStrip: the week drawn once off farmLoad, sidebar + header layouts;
  one should-tick per day (C2), capped + overflow-hidden (B1).
- Both faces of the design library updated to match (Stable, sources
  repointed to ui.jsx).
```

## Commit 4 — Step 2b: phone Today glance + in-run AttentionCard

**Files:**
- `src/pages/Overview.jsx`  (TodayGlance phone-only section reading farmLoad:
                             Lora date [inline toLocaleDateString — NOT
                             formatDate, which wants an ISO string] + Lucide
                             weather + NowRule + AttentionCard on man-down +
                             LoadSpine + Open-Rounds deep-link; weatherIcon
                             helper; import farmLoad/useScheduleDeltas +
                             LoadSpine/AttentionCard/NowRule + weather icons)
- `src/pages/Rounds.jsx`    (in-run AttentionCard on man-down: farmLoad over the
                             active block via useChoreAssignmentRules +
                             useScheduleDeltas; deep-links to Schedule cover flow;
                             manDownInBlock prop into DoingSurface)

**Draft message:**
```
feat: phone Today glance + in-run cover signal (harvest-remix step 2b)

Wire the first surfaces onto the promoted vocabulary, both reading the
one farmLoad model so they can't drift from the Schedule. View-layer
only.

- Overview: a phone-led Today glance (lg:hidden) above the desktop grid
  — Lora date + Lucide weather (C1, no emoji) + NowRule, an emphatic
  AttentionCard when the day is man-down (deep-links to the Schedule
  cover flow), and a LoadSpine of the day-load with an Open-Rounds
  deep-link. Desktop keeps its multi-pane grid.
- Rounds: the one mid-round actionable signal (C9) — when the live run's
  block carries an uncovered assigned obligation, an in-run AttentionCard
  at the top of the doing surface deep-links to the Schedule's cover
  sheet (cover stays a planning action; Rounds is execution). Man-down is
  read via farmLoad over the active block (useChoreAssignmentRules +
  useScheduleDeltas), matching the Schedule's derivation.
```

## Commit 5 — Step 2c: Schedule man-down → promoted AttentionCard

**Files:**
- `src/pages/Schedule.jsx`  (blockAlerts needs-cover card → AttentionCard;
                             import AttentionCard + LoadSpine from ui.jsx)

**Scope note:** per the JOINT-BUILD-PLAN build order, Step 2c assembles the
desktop Schedule **on its existing deriveDay data** by wiring the promoted
primitives — it does NOT repoint the day-load to farmLoad. The farmLoad repoint
(inline daySilhouette → LoadSpine, week fold → WeekStrip, two-lane → conditional
.lanes overlay, delete WeekSpines/inline memos) is **Step 3** ("fold the week +
demote DayRibbon"), which owns that rewrite. Doing it in 2c would be churn
(redone in Step 3) + silhouette-drift risk (rollupChoresForDay omits empty
blocks) on a live page with no visual QA. So 2c = the AttentionCard
consolidation; the rest of Schedule's remix is Steps 3–4.

**Draft message:**
```
feat: Schedule needs-cover → AttentionCard (harvest-remix step 2c)

Put the Schedule's man-down surface on the promoted vocabulary: the
hand-rolled blockAlerts needs-cover card becomes the shared AttentionCard
(same man-down row, cover reason, and openCover action — flush amber,
Lora work line, solid-amber button). View-layer only.

Per the build order, the farmLoad repoint of the day-load/week/lanes is
Step 3 (DayRibbon demote + week fold); Step 2c assembles the desktop
Schedule on its existing deriveDay data with the promoted primitives.
```

## Commit 6 — Step 3: fold the week + demote DayRibbon (Schedule on farmLoad)

**Files:**
- `src/pages/Schedule.jsx`            (one `farm = farmLoad(...)` memo; day-load
                                       = LoadSpine over farm.blocks; two-lane
                                       DayRibbon → conditional farm.lanes overlay;
                                       sidebar = WeekStrip(farm.week/heat); Week
                                       zoom repointed to farm.week; DELETE inline
                                       daySilhouette/personLanes/week/shouldHeat;
                                       drop WeekSpines/WeekList/buildPersonLanes/
                                       weekFullness/weekShouldHeat imports)
- `src/components/ui.jsx`             (WeekStrip: drop the misfiring overbook
                                       top-rule — `day.total > week.max` was ~
                                       always true since week.max scales bars,
                                       not daily capacity; B1 kept via cap +
                                       overflow-hidden)
- `src/components/ScheduleSidebars.jsx` (delete WeekList; barSize/DayStrip/
                                       DayRailSpine kept)
- `src/components/schedule/WeekSpines.jsx`  (DELETED)
- `public/style-guide/DESIGN-SYSTEM.md`   (WeekStrip/LoadSpine notes; migration
                                           Step 3 shipped; backlog WeekList)
- `public/style-guide/components.html`    (WeekStrip wording; backlog row)

**Draft message:**
```
feat: fold the week + demote DayRibbon onto farmLoad (harvest-remix step 3)

Step 3 puts the desktop Schedule on the one farmLoad model and collapses
the duplicated week. View-layer only; deriveDay + the chore engine
untouched. NO-LEGACY: the folded-in code is deleted, not shimmed.

- One `farm = farmLoad(...)` memo replaces the page's separate inline
  daySilhouette / personLanes / week (weekFullness) / shouldHeat
  (weekShouldHeat) computations (all deleted).
- Day-load is now the shared LoadSpine over farm.blocks + a count read;
  the two-lane "who's on what" ribbon is DEMOTED to a conditional overlay
  drawn only when farm.lanes has real assigned/reserved segments
  (man-down / day-off) — empty on a normal day by design.
- The week is drawn ONCE: the sidebar WeekStrip (farm.week/heat) folds in
  the old center WeekSpines (deleted) + sidebar WeekList (deleted). The
  Week zoom reads farm.week.
- WeekStrip: dropped a misfiring overbook top-rule (day.total > week.max
  was ~always true — week.max scales bar height, it isn't a daily
  capacity); B1 overflow safety stays via the height cap + overflow-hidden.
- Both design-library faces updated.
```

## Commit 7 — Step 4a: weave projects into the day-load (G2/G3)

**Files:**
- `src/lib/load/farmLoad.js`  (add `spine` = chore bars + kind:project bars
                               ordered by start; `totals.projects`)
- `src/pages/Schedule.jsx`    (day-load LoadSpine reads farm.spine)
- `src/pages/Overview.jsx`    (phone-glance LoadSpine reads fl.spine)

**Draft message:**
```
feat: weave projects into the day-load spine (harvest-remix step 4a)

G2/G3: the day's project segments now ride the SAME day-load model as
chores instead of a separate rail. farmLoad emits a `spine` = chore-block
bars + the projectGaps segments as kind:"project" bars, interleaved in
time order; the LoadSpine renders them as short --c-project markers
(C7 — never chore-time blue) at their slot. Project bars carry total:0
so they never inflate the item counts. Both the desktop Schedule day-load
and the phone Today glance read the spine. View-layer only; farmLoad
regression still green (13/13).
```

## (append step 4b+ groupings here as they land)

---

# Findings build (2026-06-30 video audits, F1–F34 triaged) — slices A–F

The 2026-06-30 walkthroughs (`.ignored/audit-v2/audits/2026-06-30/
findings.md`) drive a second build phase on the same branch. Same commit
policy: HOLD until James confirms the whole rollout.

## Commit 8 — Findings slice A: chore/event identity tokens + KindBadge (F8/F9)

**Files:**
- `index.html`                          (new themed `--c-chore` amber-glow +
                                         `--c-event` periwinkle, both themes)
- `src/styles.css`                      (`@theme` map `--color-chore` /
                                         `--color-event`)
- `src/components/ui.jsx`               (new `KindBadge` C/P/E primitive)
- `public/style-guide/assets/ds.css`    (static-guide copy of the two tokens)
- `public/style-guide/foundations.html` (State-hues table: chore + event rows;
                                         fix the stale "green chore" note)
- `public/style-guide/components.html`  (KindBadge visual demo)
- `public/style-guide/DESIGN-SYSTEM.md` (identity trio + KindBadge entry)

**Draft message:**
```
feat: chore/event identity tokens + KindBadge (harvest-remix findings A)

The Schedule identity foundation (F8/F9). Adds two themed semantic colors
— `chore` = amber-glow (#cc7700/#ffaa33) and `event` = periwinkle
(#5b54a8/#b6afe9) — alongside the existing `project` slate-blue, and a new
`KindBadge` primitive: a single Inter-600 letter (C/P/E) in a tight
bordered square tinted to its kind token. Chores stop borrowing accent
green; green stays a state color only. The badge is the one identity mark
reused across the block list, week-pane day symbols, and day-load (wired
in later slices). Documented in all three design-library faces
(foundations/components/DESIGN-SYSTEM). View-layer only; build green.
```

**QA note:** build-verified — utilities `.text-chore` / `.border-chore` /
`.text-event` / `.border-event` emitted, and both-theme token values present
in `dist/index.html`. Live screenshot deferred: the MCP browser profile was
locked by a parallel session and the dev-server HMR socket stalls
`networkidle`; re-shoot the style-guide KindBadge in both themes when the
browser frees.

## Commit 9 — Findings slice B: block-list → WeekStrip language + KindBadge

Findings F1–F7, F10, F12, F13, F14 (+ F8/F9 applied). The desktop block-list
navigator (`DayRailSpine`) restyled to speak the WeekStrip visual language and
to carry the new identity system.

**Files:**
- `src/components/ScheduleSidebars.jsx` (rewrite `DayRailSpine`: import
                                         Fragment + KindBadge/NowRule; new
                                         row shell; chore/project rows)
- `src/pages/Schedule.jsx`              (call site: drop `totalItems`, pass
                                         `nowMin={viewingToday ? nowMin : null}`)
- `public/style-guide/DESIGN-SYSTEM.md` (Master–detail pattern note)

**Draft message:**
```
feat: block-list → WeekStrip language + KindBadge (harvest-remix findings B)

Restyle the desktop Schedule day-navigator (DayRailSpine) to the WeekStrip
visual language and the new block-identity system:
- No dividers; the row border IS the active indicator — transparent until
  focus, then a bounding box over bg-row-active; lighter-on-hover (F1/F2).
- Equal row heights: the load rail self-stretches, so item count no longer
  drives height (F3).
- KindBadge identity: a C (amber) / P (slate) lettered box replaces the
  per-block Lucide glyphs (F8). Project titles drop the blue — the P badge
  carries it (F10).
- Every chore block reads "Chores", like every project reads "Project"
  (F12); the done/count suffix is gone from titles (F6).
- Whole-day loses its "overview · N items" subtext + normalizes its icon
  (F4/F5); row titles match the WeekStrip type ramp (F13).
- Overnight reads "Until <end>" / "After <start>" instead of the long
  range (F14).
- The canonical NowRule rides the list at the current block, replacing the
  inline "now" text tag (F7/F34).
View-layer only; build green; Schedule renders clean (light verified, zero
console/page errors).
```

**QA note:** light theme verified via the isolated-chromium harness
(`.ignored/audit/sliceb-shoot.mjs`, :5173, mintSession) — all of F1–F14
visible, zero console/page errors. Dark = build-verified + symmetric tokens
(the admin user's saved theme pref overrides the localStorage inject, so dark
needs a forced `data-theme` attribute to shoot).

Open for triage (not blocking): the focus border is neutral `border-line`
(subtler than WeekStrip's green today-border); the thin per-row load rail is
kept (decoupled from height per F3) — confirm James wants it; two now-markers
coexist (left rail NowRule + the center pane's own) until slice C/D.

## Commit 10 — Findings slice C: week-pane symbols + layout

Findings F15, F16, F17, F19, F20, F21. The right week pane (`WeekStrip` sidebar)
swaps its number + heat box for identity symbols, the explainer text goes, the
pane narrows, and the Schedule's toggle + action buttons adopt the WeekStrip
hover/active interaction.

**Files:**
- `src/lib/load/farmLoad.js`            (week gains per-day `events` count via
                                         one `getEventOccurrences`; new exported
                                         `manDownCountForDay` = the focal
                                         man-down engine, per day)
- `src/components/ui.jsx`               (WeekStrip: `conflictsByISO` prop;
                                         sidebar right cell → E badge +
                                         conflict triangle)
- `src/pages/Schedule.jsx`              (`weekConflictsByISO` via
                                         `manDownCountForDay` over the 7 week
                                         days; widen the reservations query to
                                         the week's Sunday; un-gate the scan;
                                         pass prop; remove caption;
                                         `w-[300px]`→`w-[240px]`; toggle +
                                         action-button hover/active)
- `…/round3/verify-farmload.mjs`        (assert week-events + `manDownCountForDay`)
- `public/style-guide/DESIGN-SYSTEM.md` + `components.html` (WeekStrip docs)

**Conflict-coverage note (James flagged the bug — RESOLVED + verified):** the
first cut keyed the triangle off `conflicts` (focal + forward horizon) so a
past-in-week day only showed its triangle when selected. Now `weekConflictsByISO`
runs `dayConflictCount` (exported from farmLoad) for all 7 week days — the focal
day's place-expanded rollup engine: `computeManDown` against each day's
reservations + `doubleBookConflicts`, **with block-move + reassignment overrides
applied** (mirroring `applyOverrides`' man-down-relevant effects). The Sun-28
case proved why overrides matter: prod read showed all "Fill waterers" chores
have `assignment:null` (assignee comes from rules) and an `override` delta moved
`m-brood-water` into the Early Afternoon block (`b05763c7`), which overlaps
James's off_site 14:45–15:15 → man-down. The raw rollup left it in its default
Morning block (no clash) → missed it; applying the override relocates it →
caught. The horizon query now fetches BOTH `reservation` + `override` over the
week (`horizon = {res, ovr}`). VISUALLY VERIFIED light+dark: Sun 28 shows E +
amber conflict triangle WITHOUT selecting it; Tue 30 (0 conflicts) shows none.
Buffer squeezes remain focal-only (need the day's buffer windows).

**Draft message:**
```
feat: week-pane symbols + layout (harvest-remix findings C)

Reshape the Schedule's right week pane (WeekStrip sidebar) and trim the
chrome around it:
- Drop the per-day number + heat box for identity symbols on the right: a
  periwinkle E badge when the day has an event (hover → count), an amber
  conflict triangle when it has man-down conflicts (hover → count) (F17).
- farmLoad's week now carries a per-day `events` count (one
  getEventOccurrences over the week's UTC range); conflict counts come from
  a new `conflictsByISO`, and the 14-day horizon scan is un-gated so the
  week shows conflicts without first opening the conflicts panel.
- Remove the confusing "taller bar = …, the tick warms toward a deadline"
  caption/legend (F15/F16).
- Narrow the week aside 300→240, handing the center timeline +60px (F19).
- The Day/Week/Month/Review toggle + the Time-off/Add-chore/conflicts
  buttons adopt the WeekStrip interaction: active = bg, no border; hover =
  a lighter row tint, not a text-darken (F20/F21).
View-layer only; build green; farmLoad regression 13/13; light+dark
verified, zero console/page errors.
```

**QA note:** light + dark verified via `.ignored/audit/slicec-shoot.mjs` — E
badges + the Sun-28 conflict triangle render, caption gone, pane narrowed, toggle
active = bg-row-active, zero console/page errors. farmLoad regression (green)
asserts `dayConflictCount`: 1 for the man-down scenario, 0 without, and — the
key case — **2 when a block-move override relocates a chore into the reserved
window** (the Sun-28 mechanism).

Open for triage (non-blocking): the week mark counts man-down + double-book;
buffer-squeeze conflicts still show only on the focal day via `todayConflicts`
(they need the day's buffer windows). The widened, un-gated query now fetches
reservations + overrides for the week — one read-only query on Schedule mount.

## Commit 11 — findings slice D (day-load silhouette + binary warming)

**Files:**
- `src/lib/load/farmLoad.js`      (binary `warming:{warn,due,byBucket}` via
                                   `choreDaysRemaining`; project bars gain
                                   `planned` + `durationMin`; DELETE `heatColor`
                                   + `loadColor` + the `weekShouldHeat` fold +
                                   the `heat` return field)
- `src/lib/schedule/weekView.js`  (DELETE `weekShouldHeat` + `choreHeat` +
                                   `HEAT_RUNWAY` — superseded by warn/due)
- `src/components/ui.jsx`          (new `WarmingBadge` (ClockAlert, ×N, hover
                                   names); LoadSpine rewrite — chore=`--c-chore`,
                                   no counts, conflict triangle in a bg chip
                                   (F23), project height∝duration + unplanned
                                   blue cross-hatch `HATCH_UNPLANNED` (F26);
                                   DELETE WeekStrip `header` layout +
                                   `weekHeatColor` + `heat`/`heatByISO`)
- `src/components/ScheduleSidebars.jsx` (WarmingBadge on DayRailSpine chore
                                   rows, count hidden — F24b)
- `src/pages/Schedule.jsx`        (thread `farm.warming.byBucket` into
                                   spineBlocks; WarmingBadge in the day-load
                                   summary line — F24a; drop `heat=`/`layout=`
                                   from the WeekStrip call)
- `…/round3/verify-farmload.mjs`  (drop the heat assertion; assert warn/due are
                                   empty for daily block chores)
- `public/style-guide/DESIGN-SYSTEM.md` + `components.html` (WarmingBadge +
                                   LoadSpine kind-color + WeekStrip + day-load
                                   color docs)

**What slice D does (F22–F26):**
- **F22** — the base day-load already renders regardless of assignment (the
  LoadSpine reads `farm.spine`, never assignment-gated); the two-lane "who's on
  what" pane that *was* assignment-gated is slice E's removal, not this.
- **F23** — day-load chore bars are the chore color (`--c-chore` amber), with
  per-bar counts dropped; a man-down block shows a small conflict triangle (in a
  `--c-bg` chip for legibility on amber), not the old warn hatch.
- **F24/F25** — warming collapses from the continuous should-heat gradient to a
  BINARY signal: DUE (deadline today → red `--c-cat-processing`) vs WARN (due
  later this same week → `--c-warn`), surfaced by a Lucide ClockAlert
  (`WarmingBadge`) inline in the day-load summary (`×N`, hover names each chore +
  days-left) and repeated on the affected DayRailSpine chore-block row.
- **F26** — day-load project bars are slate, height ∝ block duration; PLANNED =
  solid, UNPLANNED = blue cross-hatch (the F11/F26 shared util). `planned` is a
  project_node placed in the gap, or the first gap when an active project
  auto-pulls in.
- NO-LEGACY cleanup rode along: `weekShouldHeat`/`choreHeat`/`heatColor`/
  `loadColor` + the dead WeekStrip `header` layout all DELETED.

**Draft message:**
```
feat: day-load silhouette + binary warming (harvest-remix findings D)

Recolor the Schedule day-load by KIND and collapse warming to a binary
warn/due signal, replacing the continuous should-heat gradient.
- LoadSpine bars color by kind, not a load-state ramp: chore = --c-chore
  (amber), project = --c-project (slate). Per-bar item counts are dropped;
  a man-down block carries a conflict triangle instead of the warn hatch
  (F23).
- Project bars get duration-driven height and a planned/unplanned read:
  solid slate when planned, a blue cross-hatch when unplanned (F26). A gap
  is planned when a project step lands in it (or the first gap auto-pulls
  the active project).
- Warming is now binary (F24/F25): DUE (deadline today -> red) vs WARN (due
  later this week -> warn), surfaced by a ClockAlert WarmingBadge inline in
  the day-load summary (xN, hover names the chores + days-left) and on the
  affected block row. farmLoad computes it from choreDaysRemaining, so it
  can't disagree with the chore pills.
- NO-LEGACY: weekShouldHeat/choreHeat/heatColor/loadColor and the dead
  WeekStrip phone "header" layout are deleted; the day-load no longer paints
  a heat gradient anywhere.
View-layer only; build green; farmLoad regression 14/14; light+dark
verified on Sun 28 (amber chores + solid/hatched projects), zero
console/page errors.
```

**QA note:** built green; farmLoad regression 14/14. Visual QA via
`.ignored/audit/sliced-shoot.mjs` on Sun 28 (a day with timed blocks + projects
+ a man-down), light + dark: amber chore bars, one solid-slate planned project +
three blue cross-hatched unplanned projects, no per-bar counts, the week pane
unchanged (green count bars, E/conflict symbols, no heat tick) — zero
console/page errors both themes. **NOT exercised on live data:** the populated
ClockAlert (Sun 28 has no deferrable chore near a deadline, so `warming` is
empty — correct, and verified by the regression's empty-case assertion + the
design-library demo). Re-check the WarmingBadge on a day with a `weekly_window`/
`once`/anytime chore inside its week (James's "Modellon, 3 days left" case).

**Addendum — chore identity recolor (James, 2026-06-30, same commit):** James
killed amber/yellow as the chore identity (it was overloaded and collided with
the `warn` UI). Chore identity recolored **amber-glow → teal**
(`--c-chore`: light `#0c7e6e`, dark `#2bb6a2`); **mulberry** (`#9c2e6c`/`#cf5b9f`)
+ **terracotta** (`#9c3f23`/`#cf6742`) added to the palette as new ramps
(unmapped). `KindBadge` gained a 16% same-hue background wash
(`bg-<kind>/[0.16]`) so adjacent C/P/E read as distinct (the three identity hues
are close). Extra files in this commit: `index.html`, `src/styles.css`,
`public/style-guide/assets/ds.css` (token + ramp changes), `src/components/ui.jsx`
(KindBadge wash), + the three design-lib faces (foundations color ramps +
chore=teal, components KindBadge/LoadSpine, DESIGN-SYSTEM color ref). EXERCISED
LIVE both themes: WARN warming on **Mon 29** (real `m-lawn-mow`, amber ClockAlert
×4 + per-row badges) and DUE warming on **Tue 30** via a `once`-dated test chore
(red ClockAlert) — test chore inserted + screenshotted + DELETED (active count
back to 50; teardown clean). Teal chore bars + tinted C/P/E badges verified
light+dark, zero console/page errors. (Tooling: prod writes need
`dangerouslyDisableSandbox` — sandboxed curl POST/DELETE hangs.)

**Addendum 2 — warming/layout refinements (James, 2026-06-30, same commit):**
- `WarmingBadge`: dropped the background fill + padding — now an inline colored
  glyph only. In the day-load summary it sits in the count run after a `·`
  (`68 items · 5 blocks · 4 projects · ⏰×4`).
- **Warming now shows in the WEEK PANE too** (right sidebar): factored
  `dayWarming(...)` as an exported farmLoad fn; Schedule computes
  `weekWarmingByISO` per week day (mirrors `weekConflictsByISO`) and passes it
  to `WeekStrip`, which renders a ClockAlert on each warming day (+ the left
  `DayRailSpine` rows already had it). Verified: Mon 29 shows ⏰ in the week
  pane.
- **Project-bar tooltip bug fixed:** farmLoad labelled every project gap with
  `activeProjects[0].title`, which leaked the real project "Schedule time off"
  onto unrelated free time. Now the spine bar reads "Project · <who> free"
  (planned) or "Free project block · <who> free" (unplanned) — describes the
  GAP, not a borrowed name.
- **Left day-rail sidebar** `bg-surface` → `bg-bg` so it blends with the page
  like the right week aside (no more white panel).
- **Confirm/action row alignment:** `items-start` → `items-center` so the
  conflicts/Time-off/Add-chore buttons center against the tall Confirm button.
Files added to the commit: (above) + `src/components/ScheduleSidebars.jsx`
(bg-bg). Verified light+dark on Mon 29, zero console/page errors.

**Addendum 3 — now-marker + teal-in-center + week alignment (James review,
2026-06-30, same commit):**
- `NowRule` was rendering wrong (label BELOW the line). Fixed to the
  style-guide layout: dot + "Now · time" inline at left, green hairline fills
  the rest to the right. Kept only for the phone Today glance.
- The desktop Schedule no longer uses a now RULE — new `NowTag` (small "Now" in
  primary green) marks the current block ON the row + a faint green-accent fill
  (`bg-accent/[0.08]`), in the block-list sidebar, the whole-day list, and the
  master-detail header (James: "the now rule isn't necessary… better as a green
  accent background + the word NOW in primary green in the row").
- **Teal reached the center pane:** the master-detail header + whole-day list
  now use the teal `KindBadge` C (was the `BlockBadge` sun glyph); the
  `DayRailSpine` chore load rail fills in `--c-chore` teal (was `accent-deep`
  green). `BlockBadge` import dropped from Schedule.jsx (unused).
- **Week pane (right sidebar):** the per-day symbol cell is now a fixed
  `w-[58px]`, LEFT-aligned, so every day's mini-spine is the same width and the
  badges line up in a column (first-badge-under-first-badge — James's request).
  The warn/due ClockAlert already shows there (Addendum 2).
- `WarmingBadge` already lost its bg in Addendum 2; confirmed inline here.
Files: `src/components/ui.jsx` (NowRule, NowTag, WeekStrip cell),
`ScheduleSidebars.jsx` (NowTag + teal rail), `Schedule.jsx` (NowTag, KindBadge
in center, drop BlockBadge/NowRule), all 3 design-lib faces. Verified light+dark
Tue 30, zero console/page errors.

**Addendum 4 — overnight + events + active border (James review, 2026-06-30,
same commit):**
- **Overnight wrap** in the left `DayRailSpine` now reads "Overnight" (not
  "Chores") + a teal `Moon` on the row's right edge.
- **Week pane** (right) marks each day an overnight chore touches with a teal
  `Moon` (`weekOvernightISOs` in Schedule, derived from the focal day's
  overnight entries → both calendar days a night spans; lead = yesterday+today,
  trail = today+tomorrow). The symbol cell widened to `w-20` for up to 4 badges.
  NOTE: overnight is delta-driven and only the focal day + neighbors load
  deltas, so this reflects the overnight IN VIEW, not a week-wide scan (a true
  per-day overnight needs fetching each day's neighbor deltas — deferred).
- **Active rows** in the left sidebar now use the green `border-resolved`
  (matching the week pane), not the neutral `border-line`.
- **Events featured** in the left sidebar where present: `eventEntries` added to
  `navSegments`, rendered as a periwinkle **E** `KindBadge` + title + time
  (same source as the center timeline; shows only on days with a derived event).
Files: `ScheduleSidebars.jsx` (overnight label/Moon, event row, green border),
`Schedule.jsx` (events→navSegments, `weekOvernightISOs`), `ui.jsx` (WeekStrip
Moon + wider cell), DESIGN-SYSTEM.md + components.html. Verified light+dark
Tue 30 (overnight "Overnight" + Moon, week Moon on Mon 29 + Tue 30, green active
border), zero console/page errors.

---

## Commit 12 — findings slice E (remove two-lane + trim recap)

**Files:**
- `src/lib/load/farmLoad.js`      (DELETE the `lanes` fold — the conditional
                                   `buildPersonLanes` block + the `lanes` return
                                   field + the `buildPersonLanes`/`ADMINS`
                                   imports; header comment updated)
- `src/components/schedule/DayRibbon.jsx`  (DELETED — only consumer was the
                                   removed overlay)
- `src/lib/schedule/personLoad.js`         (DELETED — only consumer was
                                   farmLoad's lanes fold)
- `src/pages/Schedule.jsx`        (drop the `DayRibbon` import + the
                                   `farm.lanes && <DayRibbon/>` overlay (F27);
                                   the two recap warn boxes → passive
                                   `AlertStrip` (F28): count-led, names behind a
                                   "Details" toggle, `onDismiss` ✕; import
                                   `AlertStrip`, add `showChangeDetail` state)
- `src/components/ui.jsx`         (`AlertStrip` gains optional `onDismiss` → a
                                   trailing ✕; import `X`)
- `src/components/ScheduleReview.jsx`  (DROP "for learning the routine, not
                                   grading" caption (F29); Review row labels
                                   `text-[14px]` → `text-[13px]` to match the
                                   body ramp (F31))
- `public/style-guide/DESIGN-SYSTEM.md` + `components.html` (AlertStrip count-led
                                   + Details/onDismiss; slice-E summary line)

**What slice E does (F27–F31):**
- **F27** — the two-lane "who's on what" overlay is DELETED, not hidden
  (NO-LEGACY). It leaned on per-chore assignment the farm doesn't commit to, so
  it was empty on a normal day and noisy otherwise. `buildPersonLanes` +
  `personsFor` (`personLoad.js`) and `DayRibbon.jsx` had no other consumers →
  both files removed; `farmLoad` drops the `lanes` field + its `ADMINS` import.
- **F28** — the Schedule recap ("N changes since you confirmed" + "Yesterday — N
  must-dos unfinished") collapses to passive `AlertStrip`s. They lead with the
  COUNT; the per-item names sit behind an on-demand "Details" toggle (the
  changes strip), not an inline list of every name. Both keep dismiss (the
  new `AlertStrip onDismiss` ✕).
- **F29** — the "for learning the routine, not grading" caption is dropped from
  the Review "Routine drift" header (the principle stays; the on-screen line
  goes — cf. memory chores-accountability).
- **F31** — Review row labels were `text-[14px]`, above the 12–13px body ramp
  and uneven beside their 12–13px data; normalized to `text-[13px]`.
- **F30** ("Looking back" heading) PARKED — James waffled to "fine"; left as-is.
  **F33** (project checkbox) explicit no-op.

**Draft message:**
```
feat: remove two-lane pane + trim recap (harvest-remix findings E)

Strip the assignment-dependent two-lane day-load overlay and quiet the
Schedule recap to a passive count.
- Delete the two-lane "who's on what" DayRibbon overlay and its whole
  supporting fold: farmLoad's lanes field, buildPersonLanes/personsFor
  (personLoad.js), and DayRibbon.jsx. It depended on per-chore assignment
  the farm never commits to, so it was empty on a normal day and noise on
  others (F27). NO-LEGACY: removed, not hidden.
- Collapse the recap to passive AlertStrips that lead with the count, not
  a list of every changed/unfinished name. The "N changes since you
  confirmed" strip keeps the names behind an on-demand Details toggle;
  "Yesterday — N must-dos unfinished" is a bare count. Both still dismiss
  via a new AlertStrip onDismiss (F28).
- Drop the "for learning the routine, not grading" caption from the Review
  drift header — the principle stays, the on-screen line goes (F29).
- Normalize the Review row labels from 14px to the 13px body ramp so they
  sit evenly with their adjacent times/deltas (F31).
View-layer only; build green; farmLoad regression 14/14; light+dark
verified, zero console/page errors. ("Looking back" heading parked per
James; project checkbox a deliberate no-op.)
```

**QA note:** built green; farmLoad regression 14/14 (no lanes assertion existed,
so the prune is clean). Visual QA via `.ignored/audit/slicee-shoot.mjs`,
light + dark, zero console/page errors: Day view shows the day-load silhouette
with NO two-lane pane beneath it, and "Yesterday — 61 must-dos unfinished."
rendered as the passive AlertStrip (inset warn rule, count only, dismiss ✕).
Review view confirmed the drift caption now reads "Average start, last 14 days
vs before." and the rows read at one even 13px size. **NOT exercised live:** the
"N changes since you confirmed" strip needs a confirmed day with drift (today is
unconfirmed → "Confirm today" shown), so the Details-toggle path is
build/design-lib-verified only — re-check after confirming a day that then
diverges.

---

## Commit 13 — findings slice F (project continuity)

**Files:**
- `src/lib/projects.js`            (new pure `nextProjectStepFor(project,
                                   excludeStepIds)`; `nextProjectStep` refactored
                                   to call it — DRY)
- `src/pages/Schedule.jsx`         (thread `carryProjectId` + `seenStepIds` down
                                   `projectEntries`; add `continueFrom` to empty
                                   later Project blocks; render a "Continue
                                   ⟨project⟩" button (CornerDownRight) that
                                   `addProject`s the carried project's next step
                                   at the block start; import `nextProjectStepFor`
                                   + `CornerDownRight`)
- `public/style-guide/DESIGN-SYSTEM.md`  (slice-F changelog line)

**What slice F does (F32):**
- A project can now span the whole day. The first Project gap still auto-pulls
  the top active project's next step (the `occupant`); each EMPTY later gap now
  offers a **"Continue ⟨project⟩"** button that copies that same project's NEXT
  undone step down into the gap (a placed `project_node` at the block start).
- `projectEntries` threads two running values down the day's blocks:
  `carryProjectId` (the project featured in the block above — seeded from the
  first block's occupant or a placed step) and `seenStepIds` (every step placed
  or auto-shown above), so Continue always copies the next step, never one
  already used above; when the project runs out of steps the block falls back to
  "free — nothing planned".
- `nextProjectStepFor(project, excludeStepIds)` is the focused, reusable
  substrate; `nextProjectStep` now delegates to it.
- F33 (project checkbox semantics) stays deferred — no change.

**Draft message:**
```
feat: continue a project across the day (harvest-remix findings F)

Let one project span multiple Schedule Project blocks instead of only the
first gap.
- Each empty later Project block offers a "Continue <project>" button that
  copies the carried project's next undone step down into that gap (F32) —
  one tap to keep working the same project across the day, no re-search.
- projectEntries threads carryProjectId (the project in the block above)
  and seenStepIds (steps already placed/auto-shown above) down the day, so
  Continue always advances to the NEXT step and a project that runs out of
  steps falls back to "free — nothing planned".
- Add nextProjectStepFor(project, excludeStepIds) and refactor
  nextProjectStep to delegate to it.
View-layer only; build green; farmLoad regression 14/14; light+dark
verified, zero console/page errors.
```

**QA note:** built green; farmLoad regression 14/14 (the `nextProjectStep`
refactor is behavior-preserving). Visual QA via `.ignored/audit/slicef-shoot.mjs`,
light + dark: focusing the 3 PM Project block (a later gap) shows "↳ Continue
Schedule time off" in project color — the carried top project ("Schedule time
off", steps "Get Dad's time off" → "Add time off to calendar in the app"); the
first gap auto-pulls step 1, the later gap offers step 2. **EXERCISED LIVE on
prod** (`.ignored/audit/slicef-click.mjs`): clicking Continue placed "Add time
off to calendar in the app" (PROJECT · Schedule time off) into the 3 PM block —
the Continue button disappeared, the step rendered as a 0/1 placed item, the
day-load bar flipped hatched→solid slate (F26 planned), and the count rose 54→55.
Test commitment `8af7b7ae-…` then DELETED by exact id; project_node commitments
back to baseline `[]` (teardown clean). Zero console/page errors both themes.
