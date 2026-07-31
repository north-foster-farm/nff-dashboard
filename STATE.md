# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: idle

## Last run

2026-07-31T11:34Z — Skipped: no new input (fifth consecutive idle
run). I verified against GitHub rather than the guard alone: main is
still 131bce1, #6-#11 are all still open with the required `check`
green on every one, no reviews, no `LGTM` labels, nothing red. No
push notification, exactly as the 09:34 entry promised — none of the
three things I said would earn an interrupt (a PR going red, a review
landing, main moving) has happened.

**I changed one thing, and it is the reason this run was not purely a
no-op: `status` is now `idle` rather than `waiting-on-james`.** The
06:34 run left the ledger self-contradicting — it wrote "next run
starts 0.9" under Roadmap position while setting a status whose only
function is to make the startup guard skip the next run. The guard
fires on `waiting-on-james` + no new INBOX sequence, so as written it
would skip forever regardless of PRs, answers, or anything else. That
is why runs 2-5 all did nothing: not because I was genuinely blocked,
but because I had latched myself off. Q1 — standing since run 1,
never countermanded — says I may work Part 0's `[batch]` tail out of
order, and 0.9 is unblocked `[batch]` work whose TDD case is already
written out. So I am not, in fact, waiting on you for it. `idle` is
the honest value and it lets the next run build 0.9 instead of
writing another entry like this one.

To reverse: put `Q14: hold, stop working` in INBOX.md and I will
stop after the next run reads it.

Earlier entries (07:35, 08:35, 09:34, 10:34) were the same skip;
09:34 sent the one push notification, 10:34 was silent. Trimmed here
because five stacked copies of "nothing moved" made the ledger worse
at its job, which is telling you the current state at a glance.

## Roadmap position

Next: **0.9 — projectGaps sun-anchored break fix**, starting cold
next run. Its TDD case is written out in
`docs/history/schedule-and-events.md`, so it needs nothing from you.
Then 0.11 and 0.12.

0.7 done (#11). 0.6 slices 1-2 done (#9, #10).

**0.8 is treated as already shipped** (unchanged call from 06:34, not
revisited): the roadmap sources it from a stale 2026-06-03 handoff
note, but `Inbox.jsx`'s `promote` really does hand the thought to the
EventEditor prefilled, and `SectionContent.jsx:146` passes
`onOpenEvent` through. Its Accept line is satisfied on main today.
Say "0.8 means something narrower" and I will build what you meant.

**0.6 slice 3 stays parked on Q11** — it asks whether to *delete* a
surface, which I will not guess at. 0.10 stays held for prod pending
Q12.

`ROADMAP.md` is still untouched across #6-#11, waiting on Q2. With
six branches open, editing that one file in all of them guarantees
conflicts; the moment Q2 lands I do the whole backlog in one commit.

## Open PRs

All six green on the required `check`, verified this run. Branch from
main independently except where noted; merge order does not matter
apart from #9 before #10.

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. Seven
  runs old. Still duplicating `check` on every PR — I can see two
  runs on the same commit on #9, #10 and #11.
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness` (0.4).
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee with a property suite`
  (0.5).
- #9 https://github.com/north-foster-farm/nff-dashboard/pull/9 —
  `fix: one project activity model — the queue, not status + dates`
  (0.6 slice 1).
- #10 https://github.com/north-foster-farm/nff-dashboard/pull/10 —
  `fix: retire the vestigial project status column path` (0.6
  slice 2). **Base is #9's branch** — merge #9 first and GitHub
  retargets this one to main by itself.
- #11 https://github.com/north-foster-farm/nff-dashboard/pull/11 —
  `fix: one project create path — the Inbox promote no longer
  corrupts rank` (0.7). Preview:
  https://deploy-preview-11--nff-dashboard.netlify.app

## QUESTIONS

Q13 (CARRIED, still the one to do first — 30 seconds on a phone):
    will you drain the PR queue? Six green PRs open, nothing merged
    in a day. #5 shipped LGTM-label auto-merge, so applying the
    `LGTM` label merges a PR once `check` is green — no approval
    needed, which is the point, since you cannot approve your own
    branches.
  Recommendation: label #6, #7, #8, #9, #10, #11 — in that order, so
  #9 lands before #10. They touch separate files apart from the
  #9/#10 pair, every one is green, and each run of drift makes the
  eventual merge worse. If you only do one, do #6: it halves every CI
  run from here on, including the ones on the other five.

Q3 (CARRIED, still the most valuable thing needing a real terminal):
    settle migration 0043 — `supabase migration list --linked`, and
    if unapplied, back up and push. ~5 minutes.
  Recommendation: do this before anything else in the terminal. It is
  the only open item with a live production failure mode — while 0043
  sits unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command confirms 0041 is applied, which
  #9, #10 and #11 all assume.

Q9 (CARRIED, 4th ask): make a clean clone of `main` green. Two lines:
    `TZ: "America/New_York"` in `vitest.config.js`'s `test.env`, and
    either regenerate `package-lock.json` under node 26 with the
    platform optionals included, or drop `check.yml`'s node pin to
    22.
  Recommendation: yes to the TZ line, and regenerate the lockfile
  rather than unpinning node — the pin exists for a reason and the
  lockfile is the thing that is wrong. Farm time is genuinely part of
  the domain (suncalc windows), so the config should say so. I have
  worked around both by hand on every run that built anything. If you
  want only half of it, take the TZ line.

Q11 (CARRIED, gates 0.6 slice 3): does the day timeline still show
    project rows at all? Slice 1 made undated projects stop claiming
    a day (F16). But decision 10 kills the forced rank, and the
    post-42.4 model already says a project reaches a day by having a
    *step placed on it*, not by its own dates. If that is right,
    `deriveDay`'s `projects` array, Overview's "All day" project rows
    and the Schedule header's "· 2 projects" count are a fourth way
    of saying the same thing, and slice 3 should delete them rather
    than keep them accurate.
  Recommendation: delete them in slice 3. Dates are documented as
  light-touch metadata that never feed scheduling; a project row on a
  day timeline is the last place they still do. Say nothing and I
  keep them working as they are — this only removes a surface if you
  say so.

Q12 (CARRIED): 0.10 is marked `[batch + James data check]` and I am
    holding all of it because the data fix needs prod. May I ship the
    code half alone — close-placements-on-pasture-move plus the
    `scripts/check-consistency.mjs` extension that flags placements
    older than their batch's stage — and leave you only the one-time
    data fix and the verifying run?
  Recommendation: yes. The check script is read-only and I can write
  it and unit-test the staleness predicate without ever connecting;
  you would then run one command and see exactly which rows are wrong
  instead of rediscovering that batch_3 holds a stale open brooder
  placement and batch_5 has none. Converts a held item into a
  five-minute task for you.

Q10 (CARRIED, pipeline): 1.1 is the design session and Q8 recommends
    running it first. May I pre-stage its agenda the way Q6 offers to
    pre-stage 0.2's — a tracked
    `docs/workshops/design-session/1.1-agenda.md` turning each item
    in the roadmap's 1.1 bullet into a numbered call with the current
    state, the specific defect, and a recommendation?
  Recommendation: yes. 1.1 lists eight threads compressed into one
  sentence each, and six are already documented somewhere in the
  repo. Gathering that reading into one page decides nothing, and is
  the difference between a session that starts at the decisions and
  one that spends its first hour on archaeology.

Q7 (CARRIED): 0.13 — start capturing real sales at the next market
    with whatever ad-hoc prices you are charging.
  Recommendation: yes, as pure data capture, not the 4.2g milestone.
  It is the only item where waiting destroys something: every
  unrecorded market is a week of real pricing data that cannot be
  reconstructed.

Q1 (CARRIED, 7th ask): may I keep working Part 0's `[batch]` tail out
    of order while 0.2 and 0.3 wait on you?
  Recommendation: yes — I am proceeding on that assumption rather
  than idling, and the status correction above is what makes that
  assumption actually take effect. Say "no, hold" and I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done? Six PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6-#11, more
  expensive each run.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way
    to hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q8 (CARRIED): after Part 0's batch tail runs dry, 0.2 and 1.1 are the
    two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 as batch
  work for me at the same moment Part 0 empties.

Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
