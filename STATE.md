LEASE: 2026-07-31T05:35:15Z run-0535
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T04:34Z — Shipped the first of three slices of 0.6 as
PR #9, CI green. `src/lib/projects.js` now has two honest predicates
where one dishonest one used to be: `isQueuedProject` (ranked, not
completed, not archived — the one activity model) and
`projectRunsOnDay` (queued AND actually running on that day).
`isActiveProject` is gone, and with it `nextProjectStep` /
`nextProjectStepFor`, which had no app callers left. F16 closes:
the old predicate read a missing `startedAt` as "started forever
ago", which is exactly why an undated project rendered "All day ·
today" on every day. Written failing-first throughout. Net
1196 -> 1184 tests — I deleted 14 tests belonging to the three
retired functions and folded deriveDay's two project-folding cases
into one.

**A fresh clone of `main` is not green, and that is new.** Two
independent causes, neither of which touches your laptop:

1. `npm ci` fails outright here. CI pins node 26 (`check.yml:19`);
   this container has node 22, and npm 10 rejects the lockfile —
   "Missing: @esbuild/openbsd-x64@0.28.1 from lock file" and eleven
   more platform packages. I worked around it with
   `npm install --no-save`, which leaves `package-lock.json`
   untouched, and I verified it did.
2. Then the suite is red: the same two F15 sun-anchored tests in
   `availability.test.js` that Q4 has been about for three runs.
   This is no longer hypothetical — I watched them fail, and passed
   only by exporting `TZ=America/New_York` by hand, which is what
   `check.yml` does for CI and what your laptop does by accident.

So `main` is green in exactly two places (CI, and your machine) and
red everywhere else. Q9 below is the fix and it is small.

One thing I decided rather than asked, flagged because it is
user-visible: a project in the **Unprioritized** bucket no longer
counts toward the sidebar badge and no longer offers its steps to
the Schedule search. That bucket explicitly replaces On Hold, and
the quick-add already read the ranked queue only — so this makes
the surfaces agree instead of disagree. One line to reverse in
`Schedule.jsx` if you disagree.

You now have **four** PRs waiting on you and a shiny new LGTM label
that merges them from a phone. #6 is still the cheapest — it is the
one that stops every push firing two `check` runs, which I watched
happen again on #9 this run.

## Roadmap position

0.6, slice 1 of 3 shipped (PR #9). Exact resume point next run:

- **Slice 2 — the vestigial `status` column path.** Delete
  `ProjectPage.jsx`'s `setStatus` (`:113`) and its `<select>`
  (`:154`); drop `status` from `useProjects.js`'s `PROJECT_COLS`
  (`:26`), `shapeProject` (`:68`) and the patch mapper (`:268`).
  Closes F96 on the detail page. The column itself stays in the
  database — dropping it is a migration, which is yours, not mine.
- **Slice 3 — the forced-rank UI (decision 10) + the no-op
  lock-to-date.** The wider one: `rank` surfaces in Projects.jsx,
  Now.jsx, ProjectPage.jsx, Schedule.jsx, Proposals.jsx and
  CommandPalette.jsx. Decision 10 says the drag surface goes,
  buckets stay, and the Now card reads bucket order — so
  `rankedActiveProjects` survives as a filter but stops sorting on
  `sort_order`. Q11 is the one thing I want settled before I touch
  it.

Then 0.7, 0.8, 0.9, 0.11, 0.12 — all small, all `[batch]`, none
blocked. 0.10 I hold: its data fix needs prod.

## Open PRs

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. Green.
  Four runs old. Cheapest merge in the queue.
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness` (0.4). Green.
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee with a property suite`
  (0.5). Green.
- #9 https://github.com/north-foster-farm/nff-dashboard/pull/9 —
  `fix: one project activity model — the queue, not status + dates`
  (0.6 slice 1). Green.
- All four branch from `main` independently and touch separate
  files; they merge cleanly in any order.

## QUESTIONS

Q9 (NEW — supersedes Q4, and I am asking to just do it): make a
    clean clone of `main` green. Two lines: `TZ: "America/New_York"`
    in `vitest.config.js`'s `test.env`, and either regenerate
    `package-lock.json` under node 26 with the platform optionals
    included, or drop `check.yml`'s node pin to 22.
  Recommendation: yes to the TZ line, and regenerate the lockfile
  rather than unpinning node — the pin exists for a reason and the
  lockfile is the thing that is wrong. Farm time is genuinely part
  of the domain (suncalc windows), so the config should say so
  instead of leaving it to whoever runs the suite. I have asked
  about TZ three times and held off because it changes how
  *everyone's* suite runs; I am asking a fourth time with evidence
  rather than a hypothesis, because "main is red on a clean clone"
  is the kind of thing that quietly costs you an evening later. If
  you want only half of it, take the TZ line.

Q11 (NEW): does the day timeline still show project rows at all?
    0.6 slice 1 made undated projects stop claiming a day, which is
    what F16 asked for. But decision 10 kills the forced rank, and
    the post-42.4 model already says a project reaches a day by
    having a *step placed on it*, not by its own dates. If that is
    right, then `deriveDay`'s `projects` array, Overview's "All day"
    project rows and the Schedule header's "· 2 projects" count are
    all a fourth way of saying the same thing, and slice 3 should
    delete them rather than keep them accurate.
  Recommendation: delete them in slice 3. Dates are documented as
  light-touch metadata that never feed scheduling; a project row on
  a day timeline is the last place they still do. Say nothing and I
  will keep them working as they are now — this only removes a
  surface if you say so.

Q10 (NEW, pipeline): 1.1 is the design session and Q8 recommends
    running it first. May I pre-stage its agenda the way Q6 offers
    to pre-stage 0.2's — a tracked
    `docs/workshops/design-session/1.1-agenda.md` that turns each
    item in the roadmap's 1.1 bullet into a numbered call with the
    current state, the specific defect, and a recommendation, so
    the session is a walk-down rather than a rediscovery?
  Recommendation: yes. 1.1 lists eight threads compressed into one
  sentence each (category colour identity, F32 bars, the
  gray-as-disabled cluster, 20 unreviewed remix pages, the 06-28
  set, ramp canonicity, the brandmark handoff, duplicate ramps) —
  and six of them are already documented somewhere in the repo. I
  can gather that reading into one page without deciding anything,
  which is the difference between a session that starts at the
  decisions and one that spends its first hour on archaeology.

Q3 (CARRIED, still the most valuable thing you can do): settle
    migration 0043 — `supabase migration list --linked`, and if
    unapplied, back up and push. ~5 minutes, needs a real terminal.
  Recommendation: do this before anything else. It is the only open
  item with a live production failure mode — while 0043 sits
  unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command also confirms 0041 is
  applied, which everything I shipped in #9 assumes.

Q7 (CARRIED): 0.13 — start capturing real sales at the next market
    with whatever ad-hoc prices you are charging.
  Recommendation: yes, as pure data capture, not the 4.2g
  milestone. It is the only item where waiting destroys something:
  every unrecorded market is a week of real pricing data that
  cannot be reconstructed.

Q1 (CARRIED, 4th ask): may I keep working Part 0's `[batch]` tail
    out of order while 0.2 and 0.3 wait on you?
  Recommendation: yes — I am proceeding on that assumption rather
  than idling. Say "no, hold" and I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done?
  Recommendation: delete. Still reversible across #6–#9, more
  expensive each run.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of
    the playbook's untracked `.ignored/` convention? Git is my only
    way to hand you anything.
  Recommendation: yes. The untracked convention is about
  recordings and raw findings; a click-level route with assertions
  is neither.

Q8 (CARRIED): after Part 0's batch tail runs dry (~3 runs), 0.2 and
    1.1 are the two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 as batch
  work for me at the same moment Part 0 empties.

Q4 (RETIRED — folded into Q9 above).
Q5 (RETIRED last run — the outbox extraction went ahead).
