# Schedule feature — story coverage audit

**Date:** 2026-06-25. **Method:** 4 parallel read-only code audits (Explore
agents), one per epic-cluster, each verdict cited to file:line in the shipped
code (origin/main `baef9dc`, v0.10.57-alpha, batches 41.1–41.16). Cross-checked
against `scope-document.md` §5/§6 (what's in v1 vs deferred) and the
`story-set.md` (S1–S129, BD1–BD44).

**Headline:** the core spine is solidly built — draft→confirm (Epic A),
one-completion-truth marriage to Rounds, the derive-the-draft engine, search-
to-add (Epic C core), instance overrides + protection + history (Epic F core),
non-work time + man-down + cover/ack (Epics D/E core), today/week/month views
(Epic G, week/month just wired in 41.16), and mobile/offline (Epic J). The gaps
fall into three buckets: **(1) explicitly deferred by design** — fine; **(2)
the known remaining tail** — S10 reminders, S11 drift, buffers, DB cleanup;
**(3) genuine in-scope gaps not clearly tracked anywhere** — the surprises.

---

## Bucket 1 — explicitly deferred by design (no action; scope-doc §6)

- **S33d** token-grammar search — deferred stretch (scope §6).
- **S69** mark-item-not-protected-for-today — deferred (scope §6, UI-density).
- **S49** farm "down day" — CUT in review (scope §6).
- **S60b** invalidate-ack-on-edit + diff — deferred (scope §6).

## Bucket 2 — the known remaining tail (already on the roadmap)

- **Epic K / S10 — reminders** (S110–S115): NOT built. Needs a scheduled
  Netlify function (cron) + the existing web-push infra. This is the next
  planned batch.
- **Epic L / S11 — looking-back / drift** (S116–S121) incl. **S91**
  plan-vs-actual: NOT built. Pure-frontend read over `schedule.confirmed_day`
  captures + commitments exec history.
- **Buffers (S53, S54, S55, S57, S61, + S96 dependent-prep):** ✅ DONE in 41.21
  (`v0.10.62-alpha`). BD23 settled — a buffer is its own `buffer` commitment
  (a reservation bound to an activity, BD22); the bufferable interface = any
  time-anchored activity (event / focused block) offers Add buffer in its panel.
  Single-instance buffer + side (before/after/both) + setup/cleanup checklist
  shipped (S53 core/S55/S57/S61). DEFERRED: S54 all-occurrences (needs a
  recurring rule), S53 auto-reserve, S61 live squeeze-detection, S96 prep.
- **DB cleanup:** drop the dead `timeline_items` view + orphaned `chore_runs`.

## Bucket 3 — genuine in-scope gaps NOT clearly tracked (the surprises)

Ordered roughly by structural weight.

### 3a. The must/should distinction — the big one (Epic B core)
- **S13** must vs should emphasis, **S14** should surfaced when window opens +
  escalation toward hard deadline + "why today", **S15** should→must auto-
  promotion on deadline-today. **All MISSING.** Root cause: **chore_definitions
  has no must/should/critical flag** (confirmed in `overrides.js:82` "with no
  must/critical flag on chores"). The Design (`the-design.md` §4) drew the
  should→must boxed row ("why today: last clean before processing Thu · due
  Thu"); it can't be built without a chore-model field. Scope §5 Epic B lists
  this IN v1.
- Downstream of it: **S23** overcommit "what fits vs deferred", **S68** *defer*
  (vs delete) a should-chore + remove a *derived* chore, **S78** week/month
  "shoulds bunching / deadlines looming." All blocked on the same missing flag.
- **Decision needed:** add a `should`/deadline concept to chores (a real schema
  change to a LIVE table), or formally narrow Epic B for v1.

### 3b. Projects — auto-population vs. search-only
- **S16** project work auto-populates by global `sort_order`, **S20** placed in
  the projects-only window, **S84** single-project work across the horizon.
  **MISSING.** 41.14 shipped project STEPS as *search-add* only (`addProject`);
  nothing auto-fills the day from project priority, and there is no projects-
  only window. Scope §5 Epic B/D lists both in v1.
- **S42 / S43** projects-only window (global + per-day override): **MISSING.**

### 3c. Conflicts surfacing (Epic E)
- **S56a** all conflicts in one list (today + horizon), **S56b** jump-to +
  back, **S56c** next/prev: **MISSING** — man-down only surfaces inline on the
  viewed day; no Problems-panel (the Design §3.3 drew one).
- **S58** double-booking (same person, two assignments, no unavailability)
  distinct from man-down: **MISSING.**

### 3d. Reservations breadth (Epic D)
- **S45** multi-day reservation in one action, **S46** recurring non-work
  (every Sunday off / standing appt): **MISSING** — reservations are single-day
  only. Scope §5 Epic D lists both ("multi-day + recurring") in v1.
- **S80** week view shows each person's reserved non-work time: **MISSING.**
- **S48** off-person musts → reassignment: **PARTIAL** (man-down leak only).

### 3e. Events from the Schedule (Epics C/F/I)
- **S67** edit an event's time/date from the schedule via this/all-future
  (EventScopePrompt): **MISSING** — events render in the timeline (41.11) but
  are read-only there; editing redirects to Calendar. **S31** add/move event
  with scope is therefore **PARTIAL**, **S99** all-future propagation
  **PARTIAL.**

### 3f. Editing breadth (Epic F)
- **S72** split a chore block for one day: **MISSING** (scope §5 Epic F lists
  it).
- **S34** add the same item to several days at once: **MISSING.**

### 3g. People / accountability (Epic H)
- **S85** whoever's-available assignment: **PARTIAL** — assignment is static
  weekday rules, not "whoever isn't off today." **S87** start-time + overrun
  vs planned blocks: **PARTIAL** (no overrun deviation surfaced on the
  schedule). **S129** per-person start time prominent on today + week:
  **PARTIAL** (day shows now-time; week is silhouette-only, no start times).
  **S93** solo-day sanity / **S94** mid-day hand-off: **PARTIAL** (work via
  manual reassign, no dedicated affordance).

### 3h. Field niceties (Epic J / G)
- **S36** add a quick free-text NOTE to the day (not a task): **MISSING** —
  the `note` source_type exists in the data model but no UI reaches it. Cheap.
- **S12** yesterday's unfinished musts visible when building today: **MISSING.**
- **S108** confirmed plan as a stripped checklist while working: **MISSING /
  PARTIAL** (the day view doubles as it, but no dedicated glance mode).
- **S109** quick-log (eggs/mortality/notes) alongside the schedule: **MISSING**
  in the Schedule surface (exists elsewhere in the app).
- **S107** week/month not reachable on phone (tabs are `lg:` only): **PARTIAL**
  — by design so far (phone = day surface), but S107 wants the week "a tap
  away" on phone.
- **S82** future-day confirm not visually distinct from "today" (button always
  says "Confirm today"): **PARTIAL.**
- **S126** "missed" earlier items not explicitly marked (only done/not):
  **PARTIAL.**

---

## What's solidly covered (for the record)

Epic A: S1(chores+events; projects via 3b), S2–S9, S11. Epic B: S17, S18, S19,
S21, S22, S24, S26. Epic C: S27, S28, S29, S30, S32, S33a, S33b, S35, S37, S38.
Epic D: S39, S40, S41, S44, S47, S50. Epic E: S51, S52, S56, S59, S60, S60a,
S62. Epic F: S63, S64, S65, S70, S71, S73, S74. Epic G: S122–S125, S127, S75,
S76, S77, S79, S83. Epic H: S86, S88, S89, S90, S128. Epic I: S95, S97, S98,
S100, S101, S103. Epic J: S104, S105, S106.

---

## Suggested sequencing of the remaining work

1. **Decide the two structural forks first** (both touch the live chore model
   or a new window concept): **(a)** must/should + deadline on chores (3a) —
   schema change or scope-narrow; **(b)** buffers / BD23 (Bucket 2). These gate
   the most stories.
2. **Cheap genuine gaps** that need no schema and fit existing patterns: S36
   note, S34 multi-day add, S82 future-confirm label, S80 week reservations,
   S56a–c conflict list. Fold into a "coverage" batch.
3. **S10 reminders** (Epic K) — scheduled function + push.
4. **S11 drift / plan-vs-actual** (Epic L, incl. S91) — frontend over captures.
5. **DB cleanup** — drop `timeline_items` view + orphaned `chore_runs`.
6. Events-from-schedule (3e), split-block (S72), projects auto-pop (3b) as
   scoped follow-ups.

**Caveat:** verdicts are from an automated read of the code; spot-check 3a, 3b,
and S36 against intent before acting — they're the ones most likely to be
"deferred on purpose" rather than true misses.
