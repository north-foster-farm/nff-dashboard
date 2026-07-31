LEASE: 2026-07-31T13:35:00Z run-13-35
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T12:35Z — **Built 0.9 and opened #12.** Un-latching the
status last run was the right call: this run did real work instead of
writing another "nothing moved" entry. `projectGaps` now resolves
break rows through the same exported `resolveWindow` the availability
engine uses, so a sun-anchored break trims the evening project gap.

The surprise: the defect was worse than
`docs/history/schedule-and-events.md` described. That note says a
sun-only break is *silently ignored* because `subtractIntervals` skips
`!(h.e > h.s)`. True only when BOTH sides are null. A real sun-anchored
row keeps its fixed side, so a null `startMin` compared as 0, the hole
spanned `0 -> endMin`, and it swallowed **the entire day's project
time**. My failing test returned `[]` — a day with no project segments
at all — not the untrimmed gap I expected. Corrected in that doc, and
unresolved thread 2 there is marked done.

Also confirmed the Q9 timezone defect from the other end, which
sharpens it: `check.yml` sets `TZ: America/New_York` at the workflow
level but `vitest.config.js` does not. So CI is green while a clean
clone fails 2 tests in `availability.test.js` — the suite is only
green where nobody runs it by hand. I wrote 0.9's test to be
TZ-independent (dated in December, asserted against
`sunMinutesOfDay` rather than a literal) so it holds either way.

Still nothing merged. Seven PRs open now, none reviewed, INBOX
untouched since run 1.

## Roadmap position

**0.9 done — #12, green.** Its Accept line was "the TDD case from
`docs/history/schedule-and-events.md` passes"; that case is written
and passing.

Next: **0.11 — finish the "Anytime" removal**, starting cold next
run. Unblocked `[batch]`, Accept is "no surface renders an Anytime
bucket". Then 0.12 (bank the multi-device concurrency lesson into
`platform-and-infra.md` — doc-only, also unblocked). That empties
Part 0's batch tail, and Q8 (which gate first, 0.2 or 1.1) becomes
the live question rather than a pipeline one.

0.7 done (#11). 0.8 treated as already shipped (unchanged call —
`Inbox.jsx`'s promote really does hand the thought to the EventEditor
prefilled). 0.6 slices 1-2 done (#9, #10); slice 3 parked on Q11.
0.10 held for prod pending Q12. 0.13 is yours (Q7).

`ROADMAP.md` still untouched across #6-#12, waiting on Q2. Seven
branches would now all conflict on that one file; the moment Q2 lands
I do the whole backlog in one commit.

## Open PRs

Seven, all green on the required `check`. All branch from main
independently except the #9/#10 pair.

- #12 https://github.com/north-foster-farm/nff-dashboard/pull/12 —
  `fix: sun-anchored breaks now trim the project gap` (0.9). NEW this
  run. Preview:
  https://deploy-preview-12--nff-dashboard.netlify.app
- #11 https://github.com/north-foster-farm/nff-dashboard/pull/11 —
  `fix: one project create path — the Inbox promote no longer
  corrupts rank` (0.7).
- #10 https://github.com/north-foster-farm/nff-dashboard/pull/10 —
  `fix: retire the vestigial project status column path` (0.6
  slice 2). **Base is #9's branch** — merge #9 first and GitHub
  retargets this one to main by itself.
- #9 https://github.com/north-foster-farm/nff-dashboard/pull/9 —
  `fix: one project activity model — the queue, not status + dates`
  (0.6 slice 1).
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee with a property suite`
  (0.5).
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness` (0.4).
- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. Eight
  runs old, and I watched it cost me again this run: #12 got two
  `check` runs on the same commit within twelve seconds.

## QUESTIONS

Q13 (CARRIED, still first — 30 seconds on a phone): will you drain
    the PR queue? Seven green PRs, nothing merged in over a day. #5
    shipped LGTM-label auto-merge, so applying the `LGTM` label
    merges a PR once `check` is green — no approval needed, which is
    the point, since you cannot approve your own branches.
  Recommendation: label #6, #7, #8, #9, #10, #11, #12 — in that
  order, so #9 lands before #10. They touch separate files apart from
  that pair. If you only do one, do #6: it halves every CI run from
  here on, including the ones on the other six.

Q9 (CARRIED, 5th ask — and I can now name the exact defect): make a
    clean clone of `main` green. `check.yml` sets
    `TZ: America/New_York` at the workflow level; `vitest.config.js`
    sets no TZ. So CI passes and a local `npm test` fails 2 tests in
    `availability.test.js` on the sun-anchor cases. Second half:
    `npm ci` fails on `main` (esbuild 0.28.1 and its platform
    optionals are missing from `package-lock.json`), so I run
    `npm install` and discard the lockfile every single run.
  Recommendation: add `env: { TZ: "America/New_York" }` to
  `vitest.config.js`'s `test` block, and regenerate
  `package-lock.json` under node 26 with platform optionals included
  rather than unpinning node in CI — the pin is right, the lockfile
  is wrong. Farm time is genuinely domain (suncalc windows), so the
  test config should say so instead of leaning on the CI workflow.
  **Say the word and I will do both myself in one small PR** — I have
  held off only because it touches the toolchain.

Q3 (CARRIED, still the most valuable thing needing a real terminal):
    settle migration 0043 — `supabase migration list --linked`, and
    if unapplied, back up and push. ~5 minutes.
  Recommendation: do this before anything else in the terminal. It is
  the only open item with a live production failure mode — while 0043
  sits unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command confirms 0041 is applied, which
  #9, #10 and #11 all assume.

Q14 (NEW, pipeline — unblocks a whole batch): 2.1 is the rehoming
    checklist, marked `[James, async]`, five one-line calls that gate
    the 2.2 Dashboard-retirement batch. Answer them and 2.2 becomes
    buildable work for me. Reply with five words if you like:
      a. current conditions -> top-bar fold-out?
      b. broiler weeks + F19 day count -> species page, or Now?
      c. sunrise countdown -> inside conditions, or dies?
      d. since-yesterday activity -> Now, or dies?
      e. the Tomorrow section's job -> Now, or dies?
  Recommendation: (a) top-bar fold-out, (b) species page, (c) inside
  conditions, (d) dies, (e) Now. Rationale for the two deletions:
  since-yesterday duplicates what the Now surface already answers
  better, and Tomorrow is the only one whose job is genuinely taken
  over — Now plus the Schedule already show the next day. Everything
  else has a real home. Say "all five as recommended" and I will
  build 2.2 when Part 0 empties.

Q11 (CARRIED, gates 0.6 slice 3): does the day timeline still show
    project rows at all? Slice 1 made undated projects stop claiming
    a day (F16). But decision 10 kills the forced rank, and the
    post-42.4 model says a project reaches a day by having a *step
    placed on it*, not by its own dates. If that is right,
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

Q1 (CARRIED, 8th ask): may I keep working Part 0's `[batch]` tail out
    of order while 0.2 and 0.3 wait on you?
  Recommendation: yes — I am proceeding on that assumption, and 0.9
  shipping this run is what that assumption buys. Say "no, hold" and
  I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done? Seven PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6-#12, more
  expensive each run.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way
    to hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q8 (CARRIED): after Part 0's batch tail runs dry — which is now two
    items away — 0.2 and 1.1 are the two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 as batch
  work for me at the same moment Part 0 empties.

Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
