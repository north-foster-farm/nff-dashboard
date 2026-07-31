LEASE: 2026-07-31T04:34:48Z run-0731-0434
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T03:35Z — Shipped Roadmap 0.5 (outbox additive-merge
coverage) as PR #8, one commit, CI green. Extracted
`planMortalityMerge` into a new pure `src/lib/outboxMerge.js` and
left `execMortalityDecrement` holding only its two supabase
round-trips; the clamp, the gone/uncounted skip and the Batch 8.3
auto move-out all moved across unchanged. The suite is a 500-trial
seeded property — replay a queue of deltas in generated order and
shuffled, both must land on `max(0, start - sum)` — plus three
narrow tests. Written failing-first throughout; the property was red
on the missing zero-clamp (`expected -9 to be +0`) before the clamp
went in. `npm run check` green: 42 files, 1200 tests, 0 eslint
errors, format clean.

Two things worth your attention.

(1) **I raised the coverage ratchet, but not because coverage rose.**
It measures 93.85 / 86.08 / 96.29 / 95.46 — a hair above the 07-30
mark, same as last run. The thresholds were sitting at
92 / 84 / 95 / 94, i.e. 1.5-2 points of slack below the real number,
which is enough for a whole module to fall out of coverage without
the gate saying anything. I moved them to 93.8 / 86 / 96.2 / 95.4,
which is what `vitest.config.js`'s own comment already said the rule
was ("set just under the measurement") — the numbers had drifted
from the stated policy. If you'd rather keep a couple of points of
headroom so unrelated PRs don't trip on noise, that is a one-line
revert in the PR.

(2) **Q5 is now answered by action rather than by you.** I extracted
rather than testing outbox.js in place, as I said I would absent an
answer. It is cheap to reverse today (one new file, one call site)
and I have retired the question — but if extraction was the wrong
call, say so before 0.6 lands on top of it.

No answers arrived in INBOX this run (sequence still 1), so Q1-Q4
and Q6 carry forward unchanged, and Q6 is materially corrected below
— I had it wrong.

## Roadmap position

0.5 done, pending your merge of #8. 0.1 (#6) and 0.4 (#7) still
pending your merge. Next unblocked `[batch]` is **0.6 — projects
model collapse**, started cold next run.

Scouting done so 0.6 does not stall:
- **0.6 needs no migration and no prod access — it is pure app-side
  work.** I had assumed otherwise. Migration 0041 already added
  `queue_state` (default `'ranked'`, constrained to
  ranked/unprioritized) and `archived_at`/`completed_at` already
  existed from 0017. 0041's own header says it explicitly: "No
  column is dropped: status stays physically for now (the app stops
  [using it])." So the batch is entirely a code change and I can do
  all of it.
- `isActiveProject` has 19 references over 6 real call sites:
  `lib/projects.js:44` (its own re-use),
  `lib/schedule/deriveDay.js:119`, `pages/Overview.jsx:375` and
  `:907`, `pages/Schedule.jsx:934`, `sections.jsx:95`. Plus
  `lib/projects.test.js`, which is 7 tests written directly against
  the function being retired — those get rewritten against the new
  selector, not deleted wholesale.
- The single shared selector is the leverage: F16 (undated projects
  render "All day") is a bug in the same predicate, so replacing
  `isActiveProject` once fixes it at every call site rather than six
  times. That is the TDD entry point — F16's failing case first.
- The forced-rank UI (decision 10) is the other half and it is
  spread wider: `rank` appears in Projects.jsx, Now.jsx,
  ProjectPage.jsx, Schedule.jsx, Proposals.jsx and
  CommandPalette.jsx. I will land the selector collapse and the rank
  deletion as two commits on one branch so the diff is readable.
- One caveat I cannot clear myself: all of the above assumes 0041 is
  actually applied in prod. The app already writes `queueState`, so
  it almost certainly is — but the `supabase migration list --linked`
  in Q3 answers 0041 and 0043 in the same breath.

## Open PRs

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. CI green.
  Unchanged for three runs; still needs your merge. I cannot merge it.
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness`. Roadmap 0.4. CI green. Needs merge.
- #8 https://github.com/north-foster-farm/nff-dashboard/pull/8 —
  `chore: pin the additive-merge guarantee with a property suite`.
  Roadmap 0.5. CI green. Needs merge.
- All three branch from `main` independently and touch separate
  ROADMAP bullets, so they merge cleanly in any order. Three `check`
  runs still fire per push because #6 is not merged — that is #6's
  whole job, and it is the cheapest of the three to merge.

## QUESTIONS

Q1: While 0.2 (QA walkthrough, [session]) and 0.3 (migration 0043,
    [James]) wait on you, may I work the later Part 0 `[batch]`
    items out of order — 0.6, 0.7, 0.8, 0.9, 0.11, 0.12?
  Recommendation: Yes — third run asking, and I am still proceeding
  on that assumption rather than idling, so this is a confirmation,
  not a blocker. Say "no, hold" and I stop. None of them depend on
  the walkthrough's findings or on 0043. (0.10 is the one I hold
  regardless: its data fix needs prod, which I cannot touch.)

Q2: When I finish a roadmap item, should I delete its bullet from
    `ROADMAP.md`, or leave it marked done?
  Recommendation: Delete it — what #6, #7 and now #8 all do. v2 is
  forward-looking and grows no history section, so a shipped item
  leaving the file is the consistent read, and the commit plus the
  PR are the durable record. Still reversible across all three PRs,
  but it gets more expensive each run — this is the cheapest moment
  to say "strikethrough instead".

Q3: 0.3 — settle migration 0043. Needs a real terminal login:
    `supabase migration list --linked`, and if 0043 is unapplied,
    back up (`node scripts/backup-db.mjs`) and push it. ~5 minutes.
  Recommendation: Do this one before the others. It is the only open
  Part 0 item with a live production failure mode — while 0043 sits
  unapplied, un-confirming a day silently no-ops under RLS, so the
  app quietly disagrees with the database and nothing tells you. The
  same one command also confirms 0041 is applied, which is the one
  assumption 0.6 rests on. I have no Supabase credentials, so this
  can only ever be you.

Q4: Should the test suite pin its own timezone — `TZ` set inside
    `vitest.config.js` — instead of relying on the caller's box?
  Recommendation: Yes, and it is a ten-minute change I can fold into
  the next PR. Today the two F15 sun-anchored tests in
  `availability.test.js` pass only because CI happens to export
  `TZ: America/New_York` (check.yml:19) and your laptop happens to
  sit in farm time. Any contributor, container or CI runner on UTC
  sees a red suite on untouched `main`. Farm time is genuinely part
  of the domain, so pinning it in the config makes the suite say so
  instead of leaving it to the environment. I have asked twice and
  am NOT proceeding on this one without a yes, because it changes
  how everyone's suite runs, not just mine.

Q6 (CORRECTED — I had this wrong last run): I offered to "write the
    QA Walkthrough playbook out as a checklist". It already exists:
    `docs/workshops/qa-walkthrough/qa-walkthrough-playbook.md`, 16KB,
    the full OBS + whisper method. The real gap for 0.2 is the thing
    that playbook calls the per-run `test-plan.md` — "a click-level
    script with inline assertions" for the eight surfaces 0.2 names.
    The catch: the playbook puts it under `.ignored/audit-v2/`, which
    is untracked, and git is my only way to hand you anything. May I
    write the 0.2 test plan to a TRACKED path instead —
    `docs/workshops/qa-walkthrough/test-plans/0.2-housekeeping-tail.md`?
  Recommendation: Yes. The untracked convention exists to keep
  recordings and raw findings off the repo, which is about privacy
  and bulk — a click-level route with assertions is neither, and it
  is exactly the kind of thing worth having in history. This is the
  one piece of a `[session]` item I can move without deciding
  anything, and it turns 0.2 from a vague evening into a list you
  walk top-to-bottom. Say yes and it is done next run.

Q7: 0.13 — start recording the live market cycle. Markets are
    running now, POS works, and it has recorded nothing so far.
    Want to start capturing real sales at the next market with
    whatever ad-hoc prices you're actually charging?
  Recommendation: Yes, and treat it as pure data capture — not the
  4.2g acceptance milestone, exactly as the roadmap says. This is
  the only item in Part 0 where waiting destroys something: every
  market that passes unrecorded is a week of real pricing and
  volume data that cannot be reconstructed later. Decision 9 already
  accepts that backups stay manual, so the sooner there is a cycle's
  worth of real sales in there, the sooner the pricing work has
  something true to sit on.

Q8: Part 0's `[batch]` tail is about four runs from empty (0.6 is
    the big one; 0.7, 0.8, 0.9, 0.11, 0.12 are small). After that
    everything I can reach is blocked behind two `[session]` items —
    0.2 (QA walkthrough) and 1.1 (design session). Which do you want
    to run first?
  Recommendation: 1.1, the design session. Two reasons. It is
  flagged time-sensitive in the roadmap itself ("Jim's learned
  habits calcify") and it is a hard gate for anything
  customer-facing, so its cost grows while it waits; 0.2's cost does
  not, and 0.2 mostly produces `[batch]` fix work that I can then
  chew through. Running 1.1 first also means 1.2 (ramp
  configuration) unblocks as batch work for me at the same moment
  Part 0 runs dry, so I never idle. If you'd rather do the cheaper
  one first, 0.2 is the shorter evening — but then expect me to be
  question-only for a run or two.
