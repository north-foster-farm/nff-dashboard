# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T05:35Z — Shipped 0.6 slice 2 as PR #10: the vestigial
`status` column path is gone from every read and display —
`useProjects` (cols + shape + patch mapper), `useReferenceData`'s
`loadProjects` (the second read path I had not noticed until this
run, feeding the app-wide `data.projects`), and the search index,
whose project subtitle had been rendering the raw column value
("planned" / "in_progress") and now names the queue placement
instead. New pure `completionPatch` in `lib/projects.js`, written
failing-first. Check green: 1186 tests, 0 lint errors, warnings
still 50, format clean.

**#10 is stacked on #9, not on main** — it has to be. On main,
`isActiveProject` still reads `p.status`, so removing the field
before #9 lands breaks it. Merge #9 first and GitHub retargets #10
to main by itself; the LGTM label works the same on both.

Two things I found rather than expected:

1. **The status `<select>` I was told to delete was the app's only
   way to complete a project.** It stamped `completedAt`, which the
   Projects page's Completed tab and `isQueuedProject` both live
   on. Deleting it as written would have made projects
   uncompletable. It is now a Complete / Reopen toggle writing
   `completedAt` and nothing else — the one real capability kept,
   the two disagreeing writes dropped. Worth an eyes-on when you
   next open a project; it is the only user-visible change here.
2. **One `status` writer survives #10**, and 0.7 removes it for
   free. `Inbox.jsx`'s promote-to-project does a raw
   `supabase.from("projects").insert({ …, status: "planned" })`,
   bypassing `createProject` completely — which is also precisely
   the rank-order corruption 0.7 is about, since that insert writes
   no slug, no `queue_state`, and lets `sort_order` default to 0,
   putting every promoted thought at the head of your ranked queue.
   Nothing reads what it writes, so the ordering does not matter.

I added only one new question this run. You have nine open and five
PRs; a tenth question would be noise, not pipeline. The most
valuable thing you can do remains Q3, and the cheapest is still #6 —
I watched the duplicate `check` runs again on #10, where one
finished in 46 seconds and the other was still hanging ten minutes
later.

## Roadmap position

0.6 slices 1 and 2 shipped (#9, #10). Next run picks up **0.7**,
which I read into this run and can start cold:

- Replace `Inbox.jsx:231`'s raw insert with
  `createProject({ title, description, queueState: "unprioritized" })`.
  `createProject` (useProjects.js:362) already does everything 0.7's
  Accept line asks — slug via `slugify(…, takenSlugs())`,
  `queue_state`, tail `sort_order` — and writes no status.
- One wrinkle, which I am deciding rather than asking: the current
  comment says the raw insert exists so each inbox row does not
  mount the whole projects hook. I will mount `useProjects` once at
  the Inbox page level and pass `createProject` down to the row,
  which keeps that concern honest.
- TDD target: the title/description split (the 80-char truncation
  at `Inbox.jsx:234-237`) is pure and currently untested — it lifts
  to `lib` as the failing test.

Then 0.6 slice 3 — the forced-rank UI (decision 10) + the no-op
lock-to-date. **Q11 still gates it** and is the one question I most
want settled before touching it. After that 0.8, 0.9, 0.11, 0.12 —
all small, all `[batch]`, none blocked. 0.10 I still hold for prod,
though Q12 below offers to take half of it.

## Open PRs

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. Green.
  Five runs old. Still the cheapest merge in the queue.
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness` (0.4). Green.
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee with a property suite`
  (0.5). Green.
- #9 https://github.com/north-foster-farm/nff-dashboard/pull/9 —
  `fix: one project activity model — the queue, not status + dates`
  (0.6 slice 1). Green.
- #10 https://github.com/north-foster-farm/nff-dashboard/pull/10 —
  `fix: retire the vestigial project status column path` (0.6
  slice 2). Required check green. **Base is #9's branch** — merge
  #9 first.
- #6, #7, #8, #9 branch from main independently and touch separate
  files; they merge cleanly in any order. #10 is the only one with
  an ordering constraint.

## QUESTIONS

Q9 (CARRIED, 2nd ask — and I am asking to just do it): make a clean
    clone of `main` green. Two lines: `TZ: "America/New_York"` in
    `vitest.config.js`'s `test.env`, and either regenerate
    `package-lock.json` under node 26 with the platform optionals
    included, or drop `check.yml`'s node pin to 22.
  Recommendation: yes to the TZ line, and regenerate the lockfile
  rather than unpinning node — the pin exists for a reason and the
  lockfile is the thing that is wrong. Farm time is genuinely part
  of the domain (suncalc windows), so the config should say so
  instead of leaving it to whoever runs the suite. I hit both again
  this run and worked around both again by hand. If you want only
  half of it, take the TZ line.

Q11 (CARRIED, gates slice 3): does the day timeline still show
    project rows at all? Slice 1 made undated projects stop claiming
    a day (F16). But decision 10 kills the forced rank, and the
    post-42.4 model already says a project reaches a day by having a
    *step placed on it*, not by its own dates. If that is right,
    `deriveDay`'s `projects` array, Overview's "All day" project rows
    and the Schedule header's "· 2 projects" count are a fourth way
    of saying the same thing, and slice 3 should delete them rather
    than keep them accurate.
  Recommendation: delete them in slice 3. Dates are documented as
  light-touch metadata that never feed scheduling; a project row on
  a day timeline is the last place they still do. Say nothing and I
  will keep them working as they are — this only removes a surface
  if you say so.

Q12 (NEW): 0.10 is marked `[batch + James data check]` and I have
    been holding all of it because the data fix needs prod. May I
    ship the code half alone — close-placements-on-pasture-move plus
    the `scripts/check-consistency.mjs` extension that flags
    placements older than their batch's stage — and leave you only
    the one-time data fix and the verifying run?
  Recommendation: yes. The check script is read-only and I can write
  it and unit-test the staleness predicate without ever connecting;
  you would then run one command and see exactly which rows are
  wrong instead of rediscovering that batch_3 holds a stale open
  brooder placement and batch_5 has none. It converts a held item
  into a five-minute task for you.

Q3 (CARRIED, still the most valuable thing you can do): settle
    migration 0043 — `supabase migration list --linked`, and if
    unapplied, back up and push. ~5 minutes, needs a real terminal.
  Recommendation: do this before anything else. It is the only open
  item with a live production failure mode — while 0043 sits
  unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command also confirms 0041 is applied,
  which everything in #9 and #10 assumes.

Q10 (CARRIED, pipeline): 1.1 is the design session and Q8 recommends
    running it first. May I pre-stage its agenda the way Q6 offers to
    pre-stage 0.2's — a tracked
    `docs/workshops/design-session/1.1-agenda.md` turning each item
    in the roadmap's 1.1 bullet into a numbered call with the current
    state, the specific defect, and a recommendation?
  Recommendation: yes. 1.1 lists eight threads compressed into one
  sentence each, and six of them are already documented somewhere in
  the repo. Gathering that reading into one page decides nothing, and
  is the difference between a session that starts at the decisions
  and one that spends its first hour on archaeology.

Q7 (CARRIED): 0.13 — start capturing real sales at the next market
    with whatever ad-hoc prices you are charging.
  Recommendation: yes, as pure data capture, not the 4.2g milestone.
  It is the only item where waiting destroys something: every
  unrecorded market is a week of real pricing data that cannot be
  reconstructed.

Q1 (CARRIED, 5th ask): may I keep working Part 0's `[batch]` tail out
    of order while 0.2 and 0.3 wait on you?
  Recommendation: yes — I am proceeding on that assumption rather
  than idling. Say "no, hold" and I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done?
  Recommendation: delete. Still reversible across #6–#10, more
  expensive each run.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way
    to hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q8 (CARRIED): after Part 0's batch tail runs dry (~3 runs), 0.2 and
    1.1 are the two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 as batch
  work for me at the same moment Part 0 empties.

Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
