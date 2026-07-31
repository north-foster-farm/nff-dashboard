LEASE: 2026-07-31T14:36:38Z cloud-run-1785508598
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T13:35Z — **Built 0.11 and opened #13.** The "Anytime"
removal is finished: nothing under `src/` renders the bucket, and no
add or edit control offers it as a destination any more.

The find that shaped the batch: the obvious reading of 0.11 is wrong.
The old Phase 4 plan (`processes-as-chore-generators-plan.md`) says
to delete every Anytime derivation — but `1d1ad4a` deliberately KEPT
the `anytime` bucket key, because it turned out to be live orphan
tolerance: a delta whose `block_id` no longer resolves lands there
instead of vanishing from the day. Deleting it would silently drop
rows on a live app. So I split the concept in two — the key stays
(internal, orphan-catching), the *offer* and the *label* go — and put
both in one place, `placement.js`, where the sentinel already lived.

Three controls were still handing out the filing spot. One was a
straight hole rather than a leftover: `Chores.jsx`'s block
quick-edit could still clear a chore's block to null, which is the
exact invariant `ChoreFieldsEditor` says F30 established. That is the
generator bug re-openable by hand.

Q9 reproduced again, unchanged: 2 `availability.test.js` failures in
a clean clone, green under `TZ=America/New_York`; `npm ci` still
fails on main, so I ran `npm install` and discarded the lockfile.

Eight PRs open now. Nothing merged in over a day; INBOX still
untouched since run 1.

## Roadmap position

**0.11 done — #13, green.** Accept was "no surface renders an
'Anytime' bucket"; a new source-scan invariant
(`src/lib/anytimeRemoved.test.js`) pins it.

Next: **0.12 — bank the multi-device concurrency lesson** into
`docs/history/platform-and-infra.md`, starting cold next run.
Doc-only, unblocked, and the last `[batch]` in Part 0. The
deterministic-survivor mitigation (lexically smallest id) was
root-caused in deleted code, so the run will start by recovering it
from git history rather than from the working tree — budget for that.

**After 0.12, Part 0's batch tail is empty.** Q8 (which gate first —
0.2 or 1.1) then stops being a pipeline question and becomes the
thing that decides whether I have any buildable work at all. If Q8
and Q1 are both still unanswered next run, the run after it is
questions-only. That is the moment worth pre-empting.

0.9 done (#12). 0.7 done (#11). 0.8 treated as already shipped.
0.6 slices 1-2 done (#9, #10); slice 3 parked on Q11. 0.10 held for
prod pending Q12. 0.13 is yours (Q7).

`ROADMAP.md` still untouched across #6-#13, waiting on Q2. Eight
branches would now all conflict on that one file; the moment Q2 lands
I do the whole backlog in one commit.

## Open PRs

Eight. All green on the required `check` — #13's push-triggered
`check` passed; its PR-triggered duplicate was still running at
shutdown, on the same commit.

- #13 https://github.com/north-foster-farm/nff-dashboard/pull/13 —
  `fix: finish the "Anytime" removal — no surface renders the bucket`
  (0.11). NEW this run. 8 files across pages/components/lib. Preview:
  https://deploy-preview-13--nff-dashboard.netlify.app
- #12 https://github.com/north-foster-farm/nff-dashboard/pull/12 —
  `fix: sun-anchored breaks now trim the project gap` (0.9).
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
  `chore: scope the check workflow's push trigger to main`. Nine
  runs old. It cost me again this run, visibly: #13 got two `check`
  runs on the same commit, 27 seconds apart.

## QUESTIONS

Q13 (CARRIED, still first — 30 seconds on a phone): will you drain
    the PR queue? Eight green PRs, nothing merged in over a day. #5
    shipped LGTM-label auto-merge, so applying the `LGTM` label
    merges a PR once `check` is green — no approval needed, which is
    the point, since you cannot approve your own branches.
  Recommendation: label #6, #7, #8, #9, #10, #11, #12, #13 — in that
  order, so #9 lands before #10. They touch separate files apart from
  that pair. If you only do one, do #6: it halves every CI run from
  here on, including the ones on the other seven.

Q15 (NEW, 10 seconds, and it is live in #13 right now): the
    block-less bucket needed a name that is not "Anytime". I used
    **"No block"**. It is single-sourced as `NO_BLOCK_LABEL` in
    `placement.js`, so changing it is a one-line edit that moves
    every surface at once.
  Recommendation: keep "No block". It names the fallback as a
  fallback, which is the whole point of the batch — "Unscheduled"
  reads like a deliberate state someone chose, which is the exact
  impression F30 set out to kill. Say a different word and I change
  the one line.

Q9 (CARRIED, 6th ask — reproduced again this run): make a clean
    clone of `main` green. `check.yml` sets `TZ: America/New_York` at
    the workflow level; `vitest.config.js` sets no TZ. So CI passes
    and a local `npm test` fails 2 tests in `availability.test.js` on
    the sun-anchor cases. Second half: `npm ci` fails on `main`
    (esbuild 0.28.1 and its platform optionals are missing from
    `package-lock.json`), so I run `npm install` and discard the
    lockfile every single run.
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

Q14 (CARRIED, pipeline — unblocks a whole batch): 2.1 is the
    rehoming checklist, marked `[James, async]`, five one-line calls
    that gate the 2.2 Dashboard-retirement batch. Answer them and 2.2
    becomes buildable work for me. Reply with five words if you like:
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

Q1 (CARRIED, 9th ask): may I keep working Part 0's `[batch]` tail out
    of order while 0.2 and 0.3 wait on you?
  Recommendation: yes — I am proceeding on that assumption, and 0.11
  shipping this run is what that assumption buys. Say "no, hold" and
  I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done? Eight PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6-#13, more
  expensive each run.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way
    to hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q8 (CARRIED, and one item away from being urgent): after Part 0's
    batch tail runs dry — 0.12 is the last one — 0.2 and 1.1 are the
    two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 as batch
  work for me at the same moment Part 0 empties.

Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
