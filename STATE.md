LEASE: 2026-07-31T03:34:52Z run-0331
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T02:35Z — Shipped Roadmap 0.4 (test-gate completeness) as
PR #7, both halves, in two commits. The partition property test is
folded into vitest as
`src/lib/schedule/partition.property.test.js` and the standalone
`scripts/` runner plus its `test:partition` script are deleted; the
version-sync guard grew a `--check` door that `.githooks/pre-commit`
calls, so a commit typed in a terminal now hits it too. `npm run
check` green (43 files, 1210 tests, 0 eslint errors, format clean),
and I proved the hook end-to-end by cloning the branch into a
throwaway tree, installing the hook and watching a drifted commit get
refused. Three things worth your attention. (1) **The mutation check
found a real hole in the property test** — deleting the sub-gap floor
in `projectGaps` (partition.js:222) left the old suite green, because
that branch is only reachable when a buffer splits a gap and no
generated day had buffers; the standalone runner had the identical
blind spot since it was written. Generating buffers closes it — the
same mutation now fails 386 assertions. (2) **Coverage did not rise**
(93.84 / 86.06 / 96.28 / 95.46, unchanged), so the ratchet stayed put
— your roadmap note predicted a rise, but partition.js/placement.js
were already line-covered by their hand-written suites and a property
test buys input diversity, not reached statements. (3) Two `check`
runs still fire per push because #6 is not merged yet; that is #6's
whole job.

Standing environment steps for this clone, now two: install node 26
via nvm (npm ci fails on the default node 22), and run the suite with
`TZ=America/New_York` — the same value `check.yml:19` sets. On a UTC
box the two F15 sun-anchored tests in `availability.test.js` fail on
untouched `main`. That cost me a detour and is what Q4 is about.

## Roadmap position

0.4 done, pending your merge of #7. 0.1 still pending your merge of
#6. Next unblocked `[batch]` is **0.5 — outbox.js unit coverage**,
started cold next run.

Scouting done so 0.5 does not stall:
- **0.5's Accept line cannot be met as written.** It says "coverage
  ratchet raised", but `src/lib/data/outbox.js` sits in the impure
  zone that `vitest.config.js` explicitly EXCLUDES from coverage
  (`exclude: ["src/lib/data/**"]`). Writing tests for it therefore
  moves the measured number by exactly zero. See Q5 — my plan is to
  extract the pure logic rather than dilute the coverage signal.
- The additive-merge guarantee is the target and it is genuinely
  pure at its core: `next = Math.max(0, group.count - p.delta)` in
  `execMortalityDecrement` (outbox.js:291-310), wrapped in two
  supabase round-trips. Extracting the delta application + the
  zero-clamp + the FIFO/dedup queue reasoning into a pure module
  under `src/lib/` leaves the I/O behind, makes the property
  testable without mocking supabase, and lands the new file inside
  the measured layer.
- The file is 756 lines with 8 exports (`enqueueOp`, `flushOutbox`,
  `retryFailedOps`, `discardFailedOps`, `initOutbox`,
  `subscribeOutbox`, `outboxOps`, `outboxSyncing`) over IndexedDB
  plumbing with an in-memory fallback. Op lifecycle is
  pending -> synced (removed) | failed (kept, retried with 5s->60s
  backoff).
- Four distinct conflict policies are documented in the header
  (outbox.js:13-30) and only the additive one is in 0.5's scope:
  completions are idempotent row-presence writes, run events are
  at-least-once appends, egg collections are uuid-keyed inserts,
  run lifecycle is last-write-wins on (block_id, run_date).

## Open PRs

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. CI green.
  Unchanged since last run; still needs your merge. I cannot merge it.
- #7 https://github.com/north-foster-farm/nff-dashboard/pull/7 —
  `chore: test-gate completeness`. Roadmap 0.4, both halves. CI green.
  Branches from `main` rather than from #6, so the two ROADMAP edits
  are separate bullets and merge cleanly in either order.

## QUESTIONS

Q1: While 0.2 (QA walkthrough, [session]) and 0.3 (migration 0043,
    [James]) wait on you, may I work the later Part 0 `[batch]`
    items out of order — 0.5, 0.6, 0.7, 0.8, 0.9, 0.11, 0.12?
  Recommendation: Yes — still unanswered, and I am still proceeding
  on that assumption rather than idling, so this is a confirmation,
  not a blocker. Say "no, hold" and I stop. None of those depend on
  the walkthrough's findings or on 0043; they are repo-local code
  and test work. (0.10 is the one I hold regardless: its data fix
  needs prod, which I cannot touch.)

Q2: When I finish a roadmap item, should I delete its bullet from
    `ROADMAP.md`, or leave it marked done?
  Recommendation: Delete it — what #6 and now #7 both do. v2 is
  forward-looking and grows no history section, so a shipped item
  leaving the file is the consistent read, and the commit plus the
  PR are the durable record. Still easy to reverse across both PRs,
  but it gets more expensive each run — this is the cheapest moment
  to say "strikethrough instead".

Q3: 0.3 — settle migration 0043. Needs a real terminal login:
    `supabase migration list --linked`, and if 0043 is unapplied,
    back up (`node scripts/backup-db.mjs`) and push it. ~5 minutes.
  Recommendation: Do this one before the others. It is the only open
  Part 0 item with a live production failure mode — while 0043 sits
  unapplied, un-confirming a day silently no-ops under RLS, so the
  app quietly disagrees with the database and nothing tells you.
  Everything else in Part 0 is cosmetic or internal by comparison.
  I have no Supabase credentials, so this can only ever be you.

Q4: Should the test suite pin its own timezone — `TZ` set inside
    `vitest.config.js` — instead of relying on the caller's box?
  Recommendation: Yes, and it is a ten-minute change I can fold into
  the next PR. Today the two F15 sun-anchored tests in
  `availability.test.js` pass only because CI happens to export
  `TZ: America/New_York` (check.yml:19) and your laptop happens to
  sit in farm time. Any contributor, container or CI runner on UTC
  sees a red suite on untouched `main` and has to go find that line
  to know why — which is exactly what happened to me this run. Farm
  time is genuinely part of the domain, so pinning it in the config
  makes the suite say so instead of leaving it to the environment.

Q5: 0.5 says "coverage ratchet raised", but `outbox.js` lives in
    `src/lib/data/`, which `vitest.config.js` excludes from coverage
    by design. Do I extract the pure merge logic into a measured
    module under `src/lib/`, or test outbox.js where it sits and
    drop the ratchet clause?
  Recommendation: Extract. The additive-merge guarantee — apply the
  delta, clamp at zero, keep FIFO order — is pure logic currently
  sandwiched between two supabase calls; lifting it into
  `src/lib/outboxMerge.js` lets the property be tested without
  mocking the client, satisfies the ratchet clause honestly, and
  moves the repo the direction the purity boundary already points.
  The alternative — widening the coverage `include` to count
  `data/` — would raise the number by diluting exactly the signal
  the config says it is protecting. Unless you say otherwise I will
  extract, and I will keep the extraction to the merge path only
  rather than turning it into a rewrite of the file.

Q6: 0.2 is your walkthrough to run, but the prep is not. Want me to
    write the QA Walkthrough playbook out as a checklist doc first —
    every listed surface, both viewports, with the specific thing to
    look for on each — so your session is pure walking and ticking?
  Recommendation: Yes, and let me do it on the next run that has
  room. 0.2 currently reads as one line naming eight surfaces; the
  triage is the valuable part and the recall is the expensive part.
  A checklist I can build from the code and the H5 bug history turns
  a vague evening into something you can do in twenty minutes on a
  phone and hand back as a list of findings. This is the one piece
  of a `[session]` item I can move without deciding anything.
