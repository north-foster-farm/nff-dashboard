# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T14:36Z — **Banked 0.12 and opened #14; Part 0's batch tail
is now empty.** The lesson is written into
`docs/history/platform-and-infra.md` as a dated 2026-07-02 Evolutions
entry plus a standing Current-state constraint, and
`docs/history/projects.md`'s "unbanked" thread now points at it.

Recovering it went better than budgeted. The mitigation was not in
deleted *source* at all — `reconcilePlan` never existed as tracked
code in this repo, so no amount of `git log -S` over `src/` would have
found it. It survived only in Roadmap v1 prose, which H6 replaced:
`git show db18151^:ROADMAP.md` around line 4142. I cited that recovery
command in the doc, since a lesson about things not surviving deletion
should say where it was nearly lost.

The second bug in that write-up is the better one and was almost
missed: `syncNow` reused the user's *tombstoning* `removeDelta` for
engine moves, so a MOVE tombstoned the step it was moving. That
generalizes past the schedule — a tombstone records a human's intent,
and machinery reusing it inherits an exclusion it did not mean. Banked
alongside the survivor rule.

**The correction that matters most this run:** last run I said Part 0
emptying leaves me with no buildable work. That was wrong. 1.4 and 1.5
are `[batch]` items that do not depend on the 1.1 session's output —
1.5 especially is mechanical and I verified it (`index.html:14-18`
still pulls Inter + Lora off the Google Fonts CDN; Nacelle is already
self-hosted in `public/fonts/` and shows the exact pattern). So the
cliff is not next run. Q16 asks you to confirm that reading rather
than my acting on it silently.

Doc-only, so no test — called out in the commit body rather than left
implicit. Q9 reproduced a 7th time; `npm install` + discard the
lockfile again. `check` double-ran on #14's single commit, the #6 cost
for the second run running.

## Roadmap position

**0.12 done — #14, green on both `check` runs.** That closes Part 0's
`[batch]` tail: 0.1/0.4/0.5/0.6/0.7/0.9/0.11/0.12 all shipped or in
review, 0.8 treated as already shipped, 0.2 and 0.3 are yours, 0.10
held for prod (Q12), 0.13 is yours (Q7), 0.6 slice 3 parked on Q11.

Next, cold start, no dependency on anything you answer: **1.5 —
self-host Lora + Inter** (`[batch, small]`). Resume point is exact:
fetch the woff2 files for the weights `index.html:18` currently
requests (Inter 500/600/700; Lora 400/500/600/700 roman + 400/500
italic), drop them beside the Nacelle files in `public/fonts/`, add
`@font-face` blocks matching the existing Nacelle shape at
`index.html:23-56`, delete the two `preconnect` lines and the
stylesheet `<link>`. Accept is "no external font requests" — a source
scan asserting `index.html` contains no `fonts.googleapis.com` /
`fonts.gstatic.com` is the invariant to write failing-first. Both
fonts are OFL, so self-hosting is licence-clean. Then **1.4**
(design-doc drift lint), which is also session-independent.

`ROADMAP.md` still untouched across #6-#14 — nine branches would now
conflict on that one file. Q2 remains the cheapest answer you can give
me; the moment it lands I do the whole backlog in one commit.

## Open PRs

Nine. All green on the required `check`.

- #14 https://github.com/north-foster-farm/nff-dashboard/pull/14 —
  `docs: bank the multi-device concurrency lesson` (0.12). NEW this
  run. Docs only, 2 files, no `src/` change. Preview:
  https://deploy-preview-14--nff-dashboard.netlify.app
- #13 https://github.com/north-foster-farm/nff-dashboard/pull/13 —
  `fix: finish the "Anytime" removal — no surface renders the bucket`
  (0.11).
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
  `chore: scope the check workflow's push trigger to main`. Ten runs
  old. It cost me again this run: #14 got two `check` runs on the
  same commit, 19 seconds apart.

## QUESTIONS

Q13 (CARRIED, still first — 30 seconds on a phone): will you drain
    the PR queue? Nine green PRs now, nothing merged in over a day.
    #5 shipped LGTM-label auto-merge, so applying the `LGTM` label
    merges a PR once `check` is green — no approval needed, which is
    the point, since you cannot approve your own branches.
  Recommendation: label #6, #7, #8, #9, #10, #11, #12, #13, #14 — in
  that order, so #9 lands before #10. They touch separate files apart
  from that pair. If you only do one, do #6: it halves every CI run
  from here on, including the ones on the other eight.

Q16 (NEW, and it is the one that decides what I build next): Part 0's
    `[batch]` tail is empty, but I do not think I am out of work. 1.4
    (design-doc drift lint) and 1.5 (self-host Lora + Inter) are
    `[batch]` items whose content does not depend on anything the 1.1
    design session decides — 1.5 is pure mechanics, and 1.4 asserts
    docs and `styles.css` agree, whatever they end up saying. May I
    work them under the same standing permission as Q1?
  Recommendation: yes, and let me start with 1.5. It is small, it is
  the only item on the list that fixes a real user-facing failure
  today (two of three type roles fall back to system fonts on a cold
  offline load — on a farm, offline is the normal case), and it
  cannot conflict with a design decision because it changes which
  server the same fonts come from, not which fonts they are. Say "no,
  hold" and I go questions-only next run.

Q9 (CARRIED, 7th ask — reproduced again): make a clean clone of
    `main` green. `check.yml` sets `TZ: America/New_York` at the
    workflow level; `vitest.config.js` sets no TZ. So CI passes and a
    local `npm test` fails 2 tests in `availability.test.js` on the
    sun-anchor cases. Second half: `npm ci` fails on `main` (esbuild
    0.28.1 and its platform optionals are missing from
    `package-lock.json`), so I run `npm install` and discard the
    lockfile every single run.
  Recommendation: add `env: { TZ: "America/New_York" }` to
  `vitest.config.js`'s `test` block, and regenerate
  `package-lock.json` under node 26 with platform optionals included
  rather than unpinning node in CI — the pin is right, the lockfile
  is wrong. Farm time is genuinely domain (suncalc windows), so the
  test config should say so instead of leaning on the CI workflow.
  **Say the word and I will do both myself in one small PR** — I have
  held off only because it touches the toolchain. Worth noting it now
  compounds: 3.1 (React 19 + Vite 8) cannot be done honestly on a
  lockfile `npm ci` refuses.

Q3 (CARRIED, still the most valuable thing needing a real terminal):
    settle migration 0043 — `supabase migration list --linked`, and
    if unapplied, back up and push. ~5 minutes.
  Recommendation: do this before anything else in the terminal. It is
  the only open item with a live production failure mode — while 0043
  sits unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command confirms 0041 is applied, which
  #9, #10 and #11 all assume.

Q15 (CARRIED, 10 seconds, live in #13): the block-less bucket needed
    a name that is not "Anytime". I used **"No block"**, single-
    sourced as `NO_BLOCK_LABEL` in `placement.js`, so changing it is
    a one-line edit that moves every surface at once.
  Recommendation: keep "No block". It names the fallback as a
  fallback — "Unscheduled" reads like a deliberate state someone
  chose, which is the exact impression F30 set out to kill.

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
  over — Now plus the Schedule already show the next day. Say "all
  five as recommended" and I will build 2.2.

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
  placement and batch_5 has none.

Q17 (NEW, pipeline — the same pre-staging offer as Q6 and Q10): 2.3
    is the quote/artwork rotation, `[batch]` plus a curation pass
    marked `[James]`. The curation is genuinely yours — it is taste —
    but the spec and a candidate dataset are not. May I write
    `docs/specs/quote-rotation.md` plus a tracked candidate list you
    strike through, so your pass is deleting lines rather than
    starting from a blank file?
  Recommendation: yes, but *after* 1.4 and 1.5, not instead of them.
  It converts a ~4h batch with a blocking taste gate into a batch
  whose gate is a five-minute read on a phone. Flagging one real
  risk: I cannot see the app, so anything about how the rotation
  *looks* stays out of the spec and belongs in 1.1 or 0.2.

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

Q1 (CARRIED, 10th ask): may I keep working `[batch]` items out of
    order while the `[session]` and `[James]` items wait on you?
  Recommendation: yes — I am proceeding on that assumption, and 0.11
  and 0.12 shipping are what it buys. Q16 is the same question
  extended past Part 0's boundary. Say "no, hold" and I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done? Nine PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6-#14, more
  expensive each run.

Q8 (CARRIED, but no longer urgent — Q16 defused it): 0.2 and 1.1 are
    the two gates. Which first?
  Recommendation: 1.1 — it is flagged time-sensitive, it gates
  anything customer-facing, and finishing it unblocks 1.2 and the
  rest of Part 1 as batch work for me.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way
    to hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
