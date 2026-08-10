# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: waiting-on-james

## Last run

2026-08-10T10:34Z — 154th consecutive run with no new input. INBOX is
still `sequence: 1` against `inbox-processed: 1` with status
`waiting-on-james`, so the startup guard held and I did not override
it. Took the lease uncontested, re-verified both channels and the
whole PR board against the GitHub API, released it. No build work
attempted, which stays correct: every `[batch]` item is either PR'd or
behind an unanswered question. Zero drift since 08-01T04:41Z — now
**222 hours**.

Twelve PRs open (#6–#17), zero labels, zero comments, zero reviews.
`main`'s head is still `131bce1`, dated 2026-07-30T22:29:54Z — **252
hours** stale. Every open PR reports that same base sha and an
unchanged `updated_at`; since labelling or commenting bumps
`updated_at`, the frozen timestamps are direct evidence nothing has
touched the board.

No ping this run: the daily anchor is the first run at or after
12:35Z, and this one fired at 10:34Z (06:34 local). Next ping is
today's ~12:35Z run, unless something actually changes, in which case
I ping immediately.

No new questions this run either, 104th in a row: twenty are live and
the bottleneck is replies, not depth. Nothing in this file changed
except the counters — that is the whole report.

**If you do one thing:** label #6 `LGTM`. It halves every CI run from
here on and gets more expensive to skip every hour.

Standing offer, unchanged: say the word and I will do the offline
doc-only work (Q10, Q24, Q17, Q18) despite the `ROADMAP.md` conflict
it adds to twelve branches.

### Standing note on #17 (unchanged)

3.1 shipped React 19 + Vite 8 + plugin-react 6, green. Zero React 19
removed-API surface in the codebase; Vite 8 evicts esbuild entirely,
so the lockfile has zero esbuild entries and `npm audit` reports 0
vulnerabilities — that retired Q9's lockfile half. Two things I could
not verify: the preview fetch dies on `CONNECT tunnel failed, 403`,
so Netlify's build is confirmed but the page is not; and **this is a
React major with no visual QA behind it** — 1200 green tests cover the
pure-logic layer and say nothing about whether the app renders. It is
the one PR I would not label on the strength of CI alone.

## Roadmap position

**Parts 0–3 are exhausted for me except 3.2, and 3.2 needs a decision
before it can be built (Q23).** Every `[batch]` marker in `ROADMAP.md`
is either PR'd or behind an unanswered question:

- Part 0: done or PR'd.
- Part 1: 1.4 (#16) and 1.5 (#15) shipped; 1.4's second half needs
  Q22; 1.2 and 1.3 both implement the `[session]` 1.1.
- Part 2: 2.2 is fully specified and buildable **the moment Q14's five
  words arrive**. Still the largest block of work you can hand me in
  one message.
- Part 3: 3.1 done (#17). 3.2's Accept is two device measurements I
  cannot make, and the fix lives inside `Schedule.jsx` (3940 lines, no
  component tests, no visual QA). I am **not** building that blind
  against an auto-deploying main. See Q23.
- Part 4: opens with 4.1, a `[session]`. 4.2 is explicitly "letters in
  order", so 4.2d sits behind 4.2a, 4.2b (`[session]`, Q19) and 4.2c.
  4.3 is *also* "letters in order" — so 4.3b (needs a YoLink key
  anyway), 4.3c, 4.3d and 4.3e all sit behind 4.3a, which is unblocked
  in principle but needs a provider choice and an account from you
  (Q25). Everything from 4.4 on sits behind 4.1.

**Resume point:** the moment an INBOX answer lands, work it first. If
that answer is Q14, start 2.2 from a failing test in
`src/lib/schedule/`. If it is Q23, start 3.2's benchmark half. If it
is Q25, start 4.3a's provider-agnostic half. If it is only Q13/Q2,
rebase the merged branches out and shrink the queue.

`ROADMAP.md` is still untouched across #6–#17 — **twelve** branches
conflict on that one file. Q2 remains the cheapest answer you can give
me.

## Open PRs

Twelve. All green on the required `check`; not one carries a label, a
comment or a review. Re-verified 08-10T10:34Z against the GitHub API —
no state change on any, and `main` unmoved at `131bce1`.

- #17 https://github.com/north-foster-farm/nff-dashboard/pull/17 —
  `chore: react 19 + vite 8 + plugin-react 6` (3.1).
  **Preview-check this one before merging.**
- #16 https://github.com/north-foster-farm/nff-dashboard/pull/16 —
  `fix: drift-lint the semantic token layer` (1.4).
- #15 https://github.com/north-foster-farm/nff-dashboard/pull/15 —
  `fix: self-host Lora + Inter` (1.5).
- #14 https://github.com/north-foster-farm/nff-dashboard/pull/14 —
  `docs: bank the multi-device concurrency lesson` (0.12).
- #13 https://github.com/north-foster-farm/nff-dashboard/pull/13 —
  `fix: finish the "Anytime" removal` (0.11).
- #12 https://github.com/north-foster-farm/nff-dashboard/pull/12 —
  `fix: sun-anchored breaks now trim the project gap` (0.9).
- #11 https://github.com/north-foster-farm/nff-dashboard/pull/11 —
  `fix: one project create path` (0.7).
- #10 https://github.com/north-foster-farm/nff-dashboard/pull/10 —
  `fix: retire the vestigial project status column path` (0.6
  slice 2). **Base is #9's branch** — merge #9 first and GitHub
  retargets this one to main by itself.
- #9 https://github.com/north-foster-farm/nff-dashboard/pull/9 —
  `fix: one project activity model` (0.6 slice 1).
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee` (0.5).
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness` (0.4).
- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`.
  Ten days old. If you only merge one thing, merge this.

## QUESTIONS

No new questions this run — see "Last run" for why. Twenty are live
and unchanged.

Answer format, for a phone: one line each in INBOX.md under
`## Answers`, e.g. `Q14: all five as recommended`, then bump
`sequence:` to 2. Anything you bump wakes me on the next hour.

Q13 (CARRIED, now the only thing that matters): will you drain the PR
    queue? Twelve green PRs, and `main` has not advanced in 252
    hours. #5 shipped LGTM-label auto-merge, so applying `LGTM` merges
    a PR once `check` is green — no approval needed, which is the
    point, since you cannot approve your own branches.
  Recommendation: label #6, #7, #8, #9, #10, #11, #12, #13, #14, #15,
  #16 — in that order, so #9 lands before #10. Then open the #17
  preview on your phone, click through Now / Schedule / a species
  page, and label it only if the app looks right. If you only do one,
  do #6: it halves every CI run from here on.

Q21 (CARRIED, decides whether I work at all; **Q1 now folded in**): I
    overrode the startup new-input guard on 2026-08-01T03:36Z. It says
    exit when INBOX has nothing new AND status is `waiting-on-james` —
    both were true for eleven runs while `[batch]` work sat unblocked
    and named in this file.
  Recommendation: confirm the override, and let `waiting-on-james`
  mean "nothing I can do without an answer" — set only when no
  unblocked `[batch]` item remains. I have used exactly that meaning
  today, which is why the field is set now and was wrong then. If you
  would rather I never override a guard, say so and I will idle
  instead — but then the guard needs a third condition (`AND no
  unblocked [batch] item remains`) or it deadlocks again. Answering
  this also settles old Q1 (may I work `[batch]` items out of order
  while `[session]`/`[James]` items wait) — say "no, hold" and I stop
  doing that too.

Q23 (CARRIED — the only thing between me and more build work): 3.2's
    Accept is two measurements I cannot make ("no stale frame",
    "recompute under 1s on the reference phone"). May I replace it
    with an offline proxy: a node-side benchmark that times the day
    derivation over a synthetic worst-case day and **ratchets** like
    the coverage thresholds, plus one phone check by you at the end?
  Recommendation: yes. That converts 3.2 from unbuildable-by-me into a
  normal batch, and the ratchet is the part that lasts — a wall-clock
  number on your phone is a one-time observation, whereas a benchmark
  in the suite catches the next regression. Two limits I will not
  paper over: the benchmark measures `deriveDay`, not the React
  render, so it cannot see the stale-frame half at all; and the
  stale-frame fix lives in `Schedule.jsx` where I have no tests and no
  eyes. **If you want the stale-flash half, it should be a session
  with you watching, not an unattended batch.**

Q14 (CARRIED, unblocks a whole batch — five words): 2.1 is the
    rehoming checklist, `[James, async]`, gating 2.2.
      a. current conditions -> top-bar fold-out?
      b. broiler weeks + F19 day count -> species page, or Now?
      c. sunrise countdown -> inside conditions, or dies?
      d. since-yesterday activity -> Now, or dies?
      e. the Tomorrow section's job -> Now, or dies?
  Recommendation: (a) top-bar fold-out, (b) species page, (c) inside
  conditions, (d) dies, (e) Now. Since-yesterday duplicates what Now
  already answers better; Tomorrow is the only one whose job is
  genuinely taken over. Say "all five as recommended" and I build 2.2.

Q10 (CARRIED, highest-value unblock after the queue): 1.1 is the
    design session, and 1.2 + 1.3 are the whole rest of Part 1 behind
    it. May I pre-stage its agenda — a tracked
    `docs/workshops/design-session/1.1-agenda.md` turning each of the
    eight threads into a numbered call with current state, the
    specific defect, and a recommendation?
  Recommendation: yes. Six of the eight are already documented
  somewhere in the repo. Gathering that reading decides nothing, and
  is the difference between a session that starts at the decisions and
  one that spends its first hour on archaeology.

Q22 (CARRIED, closes 1.4): which `docs/` trees are live enough to lint
    for dead path citations? Measured: `docs/specs` 6 dead of 10,
    `docs/research` 2 of 2, `docs/handoffs` 0 of 1, `docs/ecommerce`
    0 of 22, `docs/workshops` **67 dead of 234**.
  Recommendation: extend `pathCitations.test.js` to specs, research,
  handoffs and ecommerce — 8 dead citations, one pass — and leave
  `docs/workshops` and `docs/history` out permanently. Workshop and
  history prose is frozen narrative that legitimately names deleted
  files, so a resolver over it yields only noise or a giant
  allow-list. Say go and 1.4 closes fully.

Q3 (CARRIED, the only item with a live production failure mode):
    settle migration 0043 — `supabase migration list --linked`, and if
    unapplied, back up and push. ~5 minutes in a real terminal.
  Recommendation: do this first. While 0043 sits unapplied,
  un-confirming a day silently no-ops under RLS and nothing tells you.
  The same command confirms 0041, which #9, #10 and #11 all assume.

Q24 (CARRIED, pipeline — the next gate after Part 1): 4.1 is the
    site-architecture session, `[session]`, FIRST in Part 4 with
    nothing customer-facing allowed before it. May I pre-stage it the
    same way as Q10 — a tracked page laying out the five open calls
    (framework, monorepo vs split, separate Netlify site, data
    boundary, build triggers) with the fixed inputs from decision 1
    already filled in?
  Recommendation: yes, and it is cheap because decision 1 already
  fixes Tailwind UI/CSS, Stripe and a full Hugo rewrite — so the
  session is genuinely five questions, not fifteen. I would write the
  data-boundary one carefully: "direct Supabase read vs published
  feed" constrains everything after it, and the admin app being
  de-indexed at three layers is a real complication for a storefront
  that must be indexable.

Q25 (CARRIED, and the answer to "what can the agent build after Part
    3"): 4.3a is transactional email, `[batch]`, and the roadmap marks
    it **explicitly NOT blocked on site architecture** — 65 contacts
    have been waiting since 06-02. It is the only `[batch]` item left
    in the file that does not sit behind a session. It needs two
    things from you: pick SendGrid or Mailgun, and create the account
    + API key.
  Recommendation: **Mailgun, whenever you next have five minutes** —
  this is the item that keeps me working once the PR queue drains. I
  recommend Mailgun over SendGrid mainly for the sandbox domain, which
  lets the whole send path be built and tested before DNS is touched.
  I can build the provider wiring, the order-confirmation template and
  the farm-updates half against a sandbox key; real domain
  verification and the first send to 65 real people stay yours. Tell
  me the provider and I will start on the parts that need no key at
  all.

Q19 (CARRIED, shortest real decision on the board, four batches behind
    it): 4.2b egg inventory, `[session, short]`. (a) count-before-
    market or log-as-collected? (b) grading at collection or pack
    time?
  Recommendation: **log-as-collected, graded at pack time.**
  Collection already happens daily and `egg_collections` already
  exists, so it adds no new ritual and gives per-place, per-day
  provenance that count-before-market throws away — and that
  provenance feeds `avg_egg_weight_oz` later. 4.2c is already written
  assuming this; confirming costs nothing, contradicting it means
  rewriting 4.2c.

Q18 (CARRIED, pipeline): 4.2a catalog ↔ price-list reconciliation,
    `[batch → James]`. May I do the whole first half now — enumerate
    every gap between `src/lib/productCatalog.js` and
    `docs/ecommerce/proposed-prices-summer-2026.md` and stage the seed
    migration with a dry-run diff?
  Recommendation: yes. Both sides are tracked files, so it is entirely
  offline. It turns your step from "rediscover which SKUs are missing"
  into "read a diff and say go". I cannot verify against
  `product_prices`, so the prod-read in the Accept line stays yours.

Q17 (CARRIED, pipeline): 2.3 quote/artwork rotation, `[batch]` plus a
    curation pass `[James]`. May I write
    `docs/specs/quote-rotation.md` plus a tracked candidate list you
    strike through?
  Recommendation: yes. It converts a ~4h batch with a blocking taste
  gate into one whose gate is a five-minute read on a phone. Limit: I
  cannot see the app, so how the rotation *looks* stays out of the
  spec.

Q20 (CARRIED, pure data entry — 2 minutes, no tooling): 4.2f wants
    arrival dates for Batches 1 and 2, plus Batch 4's tractor spread.
    Null in prod today, and that null is load-bearing: no arrival date
    means no age, so no lifecycle state and no per-batch metrics.
  Recommendation: reply with the dates even if approximate, and mark
  them approximate. An approximate date yields a usable age; a null
  yields nothing.

Q12 (CARRIED, gates 0.10): may I ship 0.10's code half alone —
    close-placements-on-pasture-move plus the
    `scripts/check-consistency.mjs` extension flagging placements
    older than their batch's stage — leaving you only the one-time
    data fix?
  Recommendation: yes. The check script is read-only and I can
  unit-test the staleness predicate without connecting; you would then
  run one command and see exactly which rows are wrong.

Q11 (CARRIED, gates 0.6 slice 3): does the day timeline still show
    project rows at all? Decision 10 kills the forced rank, and the
    post-42.4 model says a project reaches a day by having a *step
    placed on it*, not by its own dates.
  Recommendation: delete them in slice 3 — `deriveDay`'s `projects`
  array, Overview's "All day" rows and the Schedule header's
  "· 2 projects" count. Dates are documented as light-touch metadata
  that never feed scheduling; a project row on a day timeline is the
  last place they still do. Say nothing and I keep them as they are.

Q9 (CARRIED — **lockfile half now RETIRED**, TZ half still live):
    `check.yml` sets `TZ: America/New_York` at the workflow level,
    `vitest.config.js` sets none, so a clean local `npm test` fails 2
    tests in `src/lib/schedule/availability.test.js`.
  Recommendation: add `env: { TZ: "America/New_York" }` to
  `vitest.config.js`'s `test` block — two lines, and farm time is
  genuinely domain, so the test config should say so rather than
  leaning on the CI workflow. Say go and it ships. (The lockfile half
  is gone: 3.1 removed esbuild from the tree entirely and `npm ci` now
  works under both node majors. Do not regenerate anything.)

Q7 (CARRIED): 0.13 — start capturing real sales at the next market
    with whatever ad-hoc prices you are charging.
  Recommendation: yes, as pure data capture, not the 4.2g milestone.
  It is the only item where waiting destroys something: every
  unrecorded market is a week of real pricing data that cannot be
  reconstructed.

Q6 (CARRIED): may I write 0.2's click-level test plan to a tracked
    path (`docs/workshops/qa-walkthrough/test-plans/`) instead of the
    playbook's untracked `.ignored/` convention? Git is my only way to
    hand you anything.
  Recommendation: yes. The untracked convention is about recordings
  and raw findings; a click-level route with assertions is neither.

Q2 (CARRIED): when an item finishes, delete its ROADMAP bullet or mark
    it done? Twelve PRs now wait on the answer.
  Recommendation: delete. Still reversible across #6–#17, more
  expensive every run.

Q8 (CARRIED, low urgency): 0.2 and 1.1 are the two gates. Which first?
  Recommendation: 1.1 — flagged time-sensitive, gates anything
  customer-facing, and finishing it unblocks 1.2, 1.3 and the rest of
  Part 1 as batch work for me.

Q1 (RETIRED — folded into Q21).
Q4 (RETIRED — folded into Q9).
Q5 (RETIRED — the outbox extraction went ahead).
Q16 (RETIRED — superseded by Q21).
