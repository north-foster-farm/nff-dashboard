LEASE: 2026-08-01T03:36:21Z run-20260801T033621Z
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: waiting-on-james

## Last run

2026-08-01T02:35Z — **Idle, 11th consecutive skipped run.** INBOX
`sequence: 1` is still not greater than `inbox-processed: 1` and
status is `waiting-on-james`, so the new-input guard fired. Before
standing down I re-listed all fifteen PRs: #6–#15 open, none merged,
none closed, no labels, no comments, every `updated_at` still within
a minute of its own `created_at`. Nothing has touched the queue since
#15 was opened at 2026-07-31T15:42Z, eleven hours ago. Lease taken
and released cleanly; no push notification this run, as promised last
run — git stays the channel unless something genuinely changes or
breaks.

The reason has not changed either: every next step is behind an
answer from you. The cheapest unblock is still **one `LGTM` label**
(Q13), which merges a green PR by itself; the permanent one is
**Q1**, which turns future runs back into build time.

2026-07-31T15:34Z — **Shipped 1.5 (self-host Lora + Inter) as #15,
green.** Nine `latin`-subset woff2 files vendored into
`public/fonts/`, the CDN `<link>`s gone from `index.html`, and a new
`src/lib/fontLoading.test.js` pinning the Accept line.

Two things worth your attention. **First, the style guide was on the
CDN too** — all five pages under `public/style-guide/`, which deploy
from `public/` exactly like the app. I widened the invariant to every
deployed surface rather than just `index.html`; the faces are declared
once in `assets/ds.css`, which already vendored Nacelle at the same
absolute `/fonts/` paths. `docs/history/` mockups stay on the CDN —
they are records, not pages.

**Second, and I want to be plain about it: 1.5 does not make the app
work offline, and the roadmap line overstates it.** `public/sw.js`
deliberately caches nothing yet — Batch 33 owns the app-shell
precache. What self-hosting fixes today is fallback type whenever the
CDN is unreachable but the shell is in the browser's HTTP cache, plus
the render delay on a flaky connection. It is a prerequisite for
Batch 33, not a substitute.

Surprise worth recording: **I cannot fetch Netlify deploy previews.**
The agent proxy 403s the CONNECT to `*.netlify.app`. My first attempt
looked like a clean pass — every grep returned zero — because the
responses were empty, not because the pages were clean. I caught it
only by checking the HTTP status. Preview-based verification is off
the table for me permanently; I verified against local `dist/`
instead, where all fourteen faces land and no CDN reference survives
in the built HTML or CSS.

## Roadmap position

Unchanged for eleven runs — nothing picked up this hour.

Next, cold start, still no dependency on anything you answer: **1.4 —
design-doc drift lint** (`[batch]`). Accept is "a deleted ramp fails
the suite". Resume point is exact: extend the `pathCitations` pattern
in `src/lib/` with a second assertion — every ramp named in
`public/style-guide/foundations.html` resolves to a `--c-*` custom
property in `src/styles.css`. `styleGuideRamps.test.js` already
parses the ramp side and is the file to read first. Write it
failing-first by deleting a ramp locally and watching it go red.

After that I am out of session-independent `[batch]` work in Part 1:
1.2 and 1.3 both implement the 1.1 design session. That is the real
cliff, and it is one item away.

`ROADMAP.md` still untouched across #6–#15 — **ten** branches would
now conflict on that one file. Q2 remains the cheapest answer you can
give me.

## Open PRs

Ten, re-verified this run. All green on the required `check`; none
carries a label, a comment or a review.

- #15 https://github.com/north-foster-farm/nff-dashboard/pull/15 —
  `fix: self-host Lora + Inter — no external font requests` (1.5).
  Newest of the ten, opened 2026-07-31T15:42Z.
- #14 https://github.com/north-foster-farm/nff-dashboard/pull/14 —
  `docs: bank the multi-device concurrency lesson` (0.12).
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
  `chore: scope the check workflow's push trigger to main`. Thirteen
  runs old.

## QUESTIONS

Q13 (CARRIED, still first — 30 seconds on a phone): will you drain
    the PR queue? Ten green PRs now, nothing merged in over a day.
    #5 shipped LGTM-label auto-merge, so applying the `LGTM` label
    merges a PR once `check` is green — no approval needed, which is
    the point, since you cannot approve your own branches.
  Recommendation: label #6, #7, #8, #9, #10, #11, #12, #13, #14, #15
  — in that order, so #9 lands before #10. They touch separate files
  apart from that pair. If you only do one, do #6: it halves every CI
  run from here on, including the ones on the other nine.

Q9 (CARRIED, 9th ask — reproduced again): make a clean clone of
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
  held off only because it touches the toolchain. This now blocks
  real work: 3.1 (React 19 + Vite 8) cannot be done honestly on a
  lockfile `npm ci` refuses, and 3.1's own Accept line names the
  esbuild advisory.

Q3 (CARRIED, still the most valuable thing needing a real terminal):
    settle migration 0043 — `supabase migration list --linked`, and
    if unapplied, back up and push. ~5 minutes.
  Recommendation: do this before anything else in the terminal. It is
  the only open item with a live production failure mode — while 0043
  sits unapplied, un-confirming a day silently no-ops under RLS and
  nothing tells you. The same command confirms 0041 is applied, which
  #9, #10 and #11 all assume.

Q19 (CARRIED, pipeline — the shortest real decision on the board, and
    four batches sit behind it): 4.2b is the egg inventory model,
    marked `[session, short]`. Two calls:
      a. count-before-market, or log-as-collected?
      b. where does grading happen — at collection, or at pack time?
  Recommendation: **log-as-collected, graded at pack time.**
  Collection already happens daily and `egg_collections` already
  exists, so logging as collected adds no new ritual and gives
  per-place, per-day provenance that count-before-market throws away
  — and that provenance is what later feeds `avg_egg_weight_oz`.
  Grading at collection would put a sorting decision inside a
  twice-daily chore, where the friction is worst and the answer is
  not yet needed; grade only matters once eggs go into cartons.
  Worth knowing before you answer: 4.2c is **already written assuming
  this** ("cartons at pack time, dozens by grade"), so confirming it
  costs nothing and contradicting it means rewriting 4.2c. If you
  disagree, the place to say so is here, not after the chain is
  built.

Q18 (CARRIED, pipeline — same pre-staging offer as Q12 and Q17): 4.2a
    is the catalog ↔ price-list reconciliation, marked
    `[batch → James]` — I enumerate the gaps, you confirm and
    authorize the write. The write is yours and I will not touch it.
    May I do the whole first half now: enumerate every gap between
    `src/lib/productCatalog.js` and
    `docs/ecommerce/proposed-prices-summer-2026.md`, and stage the
    seed migration with a dry-run diff you can read?
  Recommendation: yes. Both sides are tracked files, so the entire
  enumeration is offline work needing no credentials — the only thing
  I genuinely cannot do is apply it. It turns your step from
  "rediscover which SKUs are missing" into "read a diff and say go".
  Flagging the limit honestly: I cannot verify against
  `product_prices` (no rows exist yet by the roadmap's own account,
  but I cannot confirm that), so the dry-run is against the tracked
  files only and the prod-read in the Accept line stays yours.

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

Q20 (CARRIED, and it is pure data entry — 2 minutes, no tooling):
    4.2f asks you for arrival dates for Batches 1 and 2, plus Batch
    4's tractor spread. They are null in prod today, and that null is
    load-bearing: no arrival date means no age, so no lifecycle
    state and no per-batch metrics for either batch.
  Recommendation: reply with the dates here even if they are
  approximate, and mark them approximate — an approximate arrival
  date yields a usable age; a null yields nothing at all. I cannot
  read or write prod, so this one is yours end to end, but I can
  stage the update statement for you once I have the numbers.

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

Q17 (CARRIED, pipeline): 2.3 is the quote/artwork rotation,
    `[batch]` plus a curation pass marked `[James]`. The curation is
    genuinely yours — it is taste — but the spec and a candidate
    dataset are not. May I write `docs/specs/quote-rotation.md` plus
    a tracked candidate list you strike through, so your pass is
    deleting lines rather than starting from a blank file?
  Recommendation: yes, but after 1.4, not instead of it. It converts
  a ~4h batch with a blocking taste gate into a batch whose gate is a
  five-minute read on a phone. Flagging one real risk: I cannot see
  the app, so anything about how the rotation *looks* stays out of
  the spec and belongs in 1.1 or 0.2.

Q16 (CARRIED, but now partly answered by my own action): may I work
    1.4 and 1.5 under Q1's standing permission, given neither depends
    on what the 1.1 design session decides? I built 1.5 this run on
    the assumption that yes.
  Recommendation: yes, and 1.4 next. If you disagree, #15 is one
  label away from never merging and I will hold.

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
  one that spends its first hour on archaeology. This is now the
  highest-value thing you can unblock after the PR queue: 1.2 and 1.3
  are the whole rest of Part 1 and both wait on 1.1.

Q7 (CARRIED): 0.13 — start capturing real sales at the next market
    with whatever ad-hoc prices you are charging.
  Recommendation: yes, as pure data capture, not the 4.2g milestone.
  It is the only item where waiting destroys something: every
  unrecorded market is a week of real pricing data that cannot be
  reconstructed.

Q1 (CARRIED, 12th ask): may I keep working `[batch]` items out of
    order while the `[session]` and `[James]` items wait on you?
  Recommendation: yes — I am proceeding on that assumption, and 0.11,
  0.12 and 1.5 shipping are what it buys. Say "no, hold" and I stop.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or
    mark it done? Ten PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6–#15, more
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
