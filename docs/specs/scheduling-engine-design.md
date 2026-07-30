# Scheduling engine — design + slice plan

_2026-06-30. The deferred hard part of the Projects rework. Grounded in a
full architecture survey of the scheduling subsystem. Slice 1 (the pure
engine core) is DONE (`src/lib/schedule/reflow.js`, committed + smoke-
tested); the rest is the wiring, decomposed below._

## The premise (from ROADMAP "Projects rework")
Chores are non-negotiable and events are external; **projects fill the
remaining time**. The forced-ranked list decides *which* project fills the
day's non-chore/non-event gaps — top project first, until it runs dry,
then the next (tandem work is the accommodated exception, via manual
placement, not the happy path). Dates are light-touch metadata, **never
scheduled on**; `locked_date` is the only date-driven escape hatch.

## The one load-bearing architecture decision (resolved)
The schedule is **live-derived, never persisted** — `deriveDay()`
regenerates every render; only *deltas* (placed steps, overrides,
reservations, buffers) persist in the `commitments` table. The roadmap
wants "never silently rearrange; the user deliberately syncs," which
sounds like it needs persisted, sticky placements + a stored "reflowed_at".

**It doesn't.** Staleness is **DERIVED**: the schedule is stale when the
currently-committed project placements differ from what `reflowPlan()`
would produce from the *current* ranking. Reordering the list makes the
would-be plan diverge from what's committed → surfaces as "stale" until
the user (or the debounced auto-fallback) reflows, which writes the new
plan as deltas so committed == would-be again. **No new schema, no
migration** — it fits the regenerable model exactly.

## What already exists (reuse, don't rebuild)
- `projectGaps()` (`lib/schedule/partition.js:142`) — the day's free
  windows, already trimmed by reservations/buffers/min-gap + who's-free.
  This is the engine's INPUT.
- `nextProjectStep()` (`lib/projects.js:42`) — the current auto-pull:
  top project's next step into the **first gap only**, live. The engine
  generalizes this to **all gaps across a horizon**, on the new queue
  model (`reflow.js` supersedes it for the ranked list).
- Placed project steps are already **deltas** in `commitments` (a
  `source_type` for a placed project node). Reflow output = writing/
  reconciling those deltas. See `useScheduleDeltas.js` (insert/delete/
  update ops + 80ms realtime debounce) and `outbox.js` (offline-safe).
- `farmLoad()` (`lib/load/farmLoad.js:85`) — the one day-load model all
  pages read (Schedule, Overview, Now, week pane). Extend it to carry the
  stale flag and every surface auto-updates.
- Debounce pattern: `useReferenceData.js:50` `debounced()` factory.
- Realtime + user_preferences cross-device sync: `useUserPreferences.js`
  (has `schedule_reminder_*` fields; extend if we ever want a stored
  reflow cadence — but staleness itself needs nothing stored).

## Slice plan
- **Slice 1 — pure engine core. ✅ DONE.** `src/lib/schedule/reflow.js`:
  `rankedActiveProjects` (new queue model, dates ignored), `rankedStepQueue`
  (incomplete steps flattened in project-rank→step-sort order), `reflowPlan`
  ({rankedProjects, gapsByDate, excludeStepIds} → placements; one step per
  gap, drains in rank order over the horizon), and derived staleness
  (`planSignature` / `isStale`, order-independent). 9/9 smoke tests pass.
- **Slice 2 — reflow action (the wiring). ✅ DONE (today-only).**
  `reflowBridge.js` (delta↔plan, tested) + `useScheduleReflow` hook:
  computes today's `projectGaps()`, plans, derives staleness, and
  `syncNow()` reconciles into `origin:"auto"` `commitments` deltas via
  addProject/removeDelta. `addProject` now threads `source_ref.origin`;
  `useProjects` hydrates `steps`. Write path **VERIFIED live 2026-07-01**
  (surgical round-trip: 4 correct auto-placements written + rendered on
  Schedule + cleaned up by exact ID). Original spec kept below.
- **Slice 2 (orig spec) — horizon gaps + reflow action (the wiring).** A hook/helper
  that: builds `gapsByDate` by calling `projectGaps()` for each day in a
  horizon (decide horizon — see OPEN below); reads the ranked projects
  (with hydrated steps) via `useProjects`/`useProject`; computes
  `reflowPlan`; and RECONCILES it against the committed project-step deltas
  (insert new placements, delete stale ones, keep manual overrides via
  `excludeStepIds`). Reuse `useScheduleDeltas` ops + outbox. This is where
  the delta shape for a placed project node must be matched exactly (read
  how Schedule.jsx currently places a swapped step).
- **Slice 3 — stale indicator + manual sync. ✅ DONE on Projects** (a
  flush info `AlertStrip` + "Sync today" above the ranked list, live-
  verified). REMAINING: also surface placements + a Sync on the Schedule
  page. Original spec below.
- **Slice 3 (orig) — stale indicator + manual sync.** Compute `isStale(plan,
  committed)` live; surface a "schedule out of sync — Sync" affordance on
  the Projects page (by the ranked list) and on the Schedule header. The
  Sync button runs the Slice-2 reflow action. Never auto-rearrange.
- **Slice 4 — debounced auto-reflow. ✅ DONE.** `useScheduleReflow` auto-
  calls `syncNow()` after 30s of quiet while stale + enabled (effect
  re-runs on `syncNow` identity change → timer resets → debounce). On by
  default; per-device "Auto-sync on/off" toggle (usePersistedState) in the
  Projects ranked-list header; nudge hints "auto-sync shortly". Fires while
  mounted (Projects page); app-wide mount = later. The 30s auto-fire not
  live-exercised (calls the verified syncNow). Original spec below.
- **Slice 4 (orig) — debounced auto-reflow (the fallback).** After a ranking
  change, a debounce timer (~30s ceiling, per roadmap) fires the reflow
  action automatically unless the user synced first. Manual button always
  available. Consider a per-user on/off + cadence in `user_preferences`.
- **Slice 5a — Now integration. ✅ DONE.** Now.jsx shows the top-ranked
  project's next step (calm flush card + slate "P" badge, under the round
  CTA), via rankedActiveProjects + rankedStepQueue. Verified in-app.
- **Slice 5b — retire the old first-gap auto-pull. ✅ DONE.** Removed
  Schedule.jsx's `nextProjectStep` occupant (computation + render + the
  `completeOccupant` handler + the summary branch + the import), net −56
  lines. `continueFrom` stays (carries from placed items now). Empty gaps
  read "free — nothing planned" until a reflow. Build green; Schedule
  verified in-app (gaps render empty/free, 0 errors).
- **Slice 5 (orig) — Today / Now integration.** Surface the top ranked project's
  next step(s) on `Now.jsx` (after the active-round button, before the
  overdue list) and confirm the Schedule page renders the full multi-gap
  plan (not just the first-gap auto-pull it renders today — retire that
  path, NO-LEGACY).
- **Slice 6 — locks. ✅ DONE (project + step level).** reflowPlan pins a
  step whose effective lock (`step.lockedDate ?? project.lockedDate`) is on
  a horizon day, jumping that day's queue; drops steps locked off-horizon;
  unlocked flow around. The existing project lock UI now drives scheduling.
  5 new unit cases + prior suite green. REMAINING: phase-level precedence
  (needs phase hydration) + the step/phase/item lock UI (only project-level
  is settable today).
- **Slice 7 — conflict-awareness. ✅ DONE (gap-free).** reflowPlan skips a
  gap where `who.freeCount === 0` (nobody free) — flows around it. Heavier
  man-down/double-book flagging (`computeManDown`/`doubleBookConflicts`)
  left as a future refinement.

## Remaining refinements (each larger than a tweak — do fresh)
- **Step lock UI ✅ DONE** (ProjectPage step rows; planner honors it).
- **Phase / checklist-item lock UI + phase planner precedence** — needs
  phase hydration in the list hook; then `effectiveLock = step ?? phase ??
  project` in rankedStepQueue.
- **App-wide auto-reflow mount** — mount a headless engine daemon in
  App.jsx so auto-reflow fires off the Projects page. BLOCKER:
  `usePersistedState` is per-mount sessionStorage with NO cross-component
  sync, so the on/off toggle can't reach a separate daemon. Fix: App owns
  the pref + drills `autoReflow`/`setAutoReflow` through SectionContent to
  Projects (Projects drops its local usePersistedState), OR add a shared
  reactive store (useSyncExternalStore). Also means always-on projects/
  deltas subscriptions. Central-file work — do it deliberately.
- **Widen past today-only** — the engine builds `gapsByDate` for TODAY via
  one `useScheduleDeltas(dateISO)`. A rolling N-day horizon needs per-day
  `projectGaps()` (each day's blocks + that day's reservations/buffers) AND
  multi-day committed-placement reconciliation (the deltas hook is single-
  date — needs a multi-date fetch/overlay). Real data-layer change; the
  pure planner + reconcile already accept a multi-day `gapsByDate`.

## RESOLVED decisions (James, 2026-06-30 — went with the recs)
Slice 2 ships the **lowest-risk intersection**, then later slices widen:
1. **Horizon.** Target end state = **today + a rolling 7-day** window
   (makes the ranking's consequences legible — you see P1 hand off to P2).
   BUT **Slice 2 starts today-only** to prove the delta reconciliation,
   then widens (the planner already takes `gapsByDate`, so it's just the
   caller's day range).
2. **Reflow scope vs. manual overrides.** Reflow REPLACES only the
   **auto-placed** project steps and PRESERVES manual swaps/placements +
   completed steps (via `excludeStepIds` + tagging deltas auto vs manual).
   This is also how tandem / out-of-rank work happens (manual placement is
   the accommodated exception; reflow flows around it).
3. **Auto-reflow.** Build **manual-first** (Slices 2–3: stale indicator +
   a manual Sync button). Enable **auto (~30s debounce)** in Slice 4 once
   reconciliation is proven non-destructive; end state = auto on by default
   with a `user_preferences` off switch.

## Slice 2 build spec (next session)
1. **Tag placement deltas** `auto` vs `manual` (a field on the placed-
   project-step `commitments` delta) — read Schedule.jsx's current
   swap/place path + `useScheduleDeltas` ops + `deriveDay.foldDeltas` to
   match the exact delta shape, then add the tag (additive).
2. **Build `gapsByDate` for TODAY** by calling `projectGaps()` for today.
3. **Read ranked projects with hydrated steps** (`useProjects` — needs each
   project's `steps`; confirm the list hook hydrates them or extend it).
4. **`reflowPlan()`** with `excludeStepIds` = manually-placed + completed
   step ids → the planned placements.
5. **`reconcilePlan({ planned, committedAuto })`** (PURE, added to
   `reflow.js` this session — see below) → `{ toPlace, toRemove }`; leave
   unchanged placements alone (idempotent, no delta churn).
6. **Apply**: insert `toPlace` / delete `toRemove` as `auto` deltas via the
   existing `useScheduleDeltas` ops + outbox. A manual **Sync** trigger
   drives it (no auto yet).
7. **Derive `isStale`** live (planned vs committedAuto) for Slice 3's UI.
