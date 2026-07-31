LEASE: 2026-07-31T02:35:18Z cloud-run-2026-07-31T0235Z
# RELAY STATE — cloud agent ledger

inbox-processed: 1
status: working

## Last run

2026-07-31T01:41Z — First real run. Shipped Roadmap 0.1 (CI trigger
scope) as PR #6: `check.yml`'s push trigger scoped to `[main]`, plus
a new repo invariant (`src/lib/ciWorkflows.test.js`) that fails if
any workflow ever triggers on unscoped push again. Written
failing-first; `npm run check` green locally (42 files, 1197 tests,
0 eslint errors, coverage unchanged) and green in CI. The PR proves
itself — it drew exactly one `check` run, from `pull_request`, where
the previous five merges each drew two. Two surprises worth
recording. (1) The cloud clone's default node is 22 / npm 10, and
`npm ci` FAILS there — the lockfile only resolves under node 26's
npm 11, which is what CI uses. I install node 26 via nvm at the top
of each run; that is now a standing step, not a one-off. (2) I had
to add `js-yaml` as an explicit devDependency to parse the workflow
YAML honestly (it was already in the tree transitively, so the
lockfile grew one line) — flagging it because adding a dependency is
the kind of call you may want to keep for yourself.

## Roadmap position

0.1 done, pending your merge of #6. Next unblocked `[batch]` is
**0.4 — test-gate completeness**. Deliberately NOT started this run:
it edits `ROADMAP.md` in the same place #6 does, so branching it
before #6 merges buys a guaranteed conflict. Next run picks it up
once #6 is in.

Scouting done so 0.4 starts cold next run:
- `scripts/test-schedule-partition.mjs` (194 lines) is a standalone
  runner — its own `check()` failure accumulator, a seeded LCG, and
  `process.exit(1)`. Folding it into vitest means turning the four
  property groups into `it()` blocks and collecting failures into
  arrays asserted with `toEqual([])` (the house shape used by
  pathCitations/libPurity), not a rewrite of the generators.
- It must land under `src/` — vitest's `include` is
  `src/**/*.test.js`. `src/lib/schedule/partition.property.test.js`
  fits both that and the coverage `include`.
- Folding it will genuinely RAISE measured coverage on
  `src/lib/schedule/partition.js` + `placement.js`, so the ratchet in
  `vitest.config.js` gets raised to just under the new mark in the
  same PR (CLAUDE.md rule).
- The second half — moving version-sync into `.githooks/pre-commit`
  — has a wrinkle: `scripts/check-version-sync.sh` currently reads a
  Claude Code PreToolUse JSON payload off stdin and greps it for
  `git commit`. As a git hook there is no such payload. It needs a
  second entry path (flag or arg) sharing one comparison, so the two
  callers can't drift.
- `npm run test:partition` in `package.json` goes away with the fold.

## Open PRs

- #6 https://github.com/north-foster-farm/nff-dashboard/pull/6 —
  `chore: scope the check workflow's push trigger to main`. CI green
  (`check` success). Ready for your LGTM label. I can't merge it.

## QUESTIONS

Q1: While 0.2 (QA walkthrough, [session]) and 0.3 (migration 0043,
    [James]) wait on you, may I work the later Part 0 `[batch]`
    items out of order — 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.11, 0.12?
  Recommendation: Yes — and I am proceeding on that assumption
  rather than idling, so this is a confirmation, not a blocker. Say
  "no, hold" and I stop. Reasoning: the roadmap says one linear
  sequence and a part's exit gates the next part, but my brief says
  to take the next unblocked `[batch]`, and none of those eight
  depend on the walkthrough's findings or on 0043 — they're
  repo-local code and test work. Read strictly, your two items block
  me completely and I'd have nothing to do but write questions.
  (0.10 is the one I'd still hold: its data fix needs prod, which I
  can't touch.)

Q2: When I finish a roadmap item, should I delete its bullet from
    `ROADMAP.md`, or leave it marked done?
  Recommendation: Delete it, which is what #6 does — v2 says it's
  forward-looking and never grows a history section, so a shipped
  item leaving the file is the consistent read, and the commit plus
  the PR are the durable record. Easy to reverse if you'd rather see
  a strikethrough; I just need to know before I do it eight more
  times.

Q3: 0.3 — settle migration 0043. Needs a real terminal login:
    `supabase migration list --linked`, and if 0043 is unapplied,
    back up (`node scripts/backup-db.mjs`) and push it. ~5 minutes.
  Recommendation: Do this one before the others. It's the only open
  Part 0 item with a live production failure mode — while 0043 sits
  unapplied, un-confirming a day silently no-ops under RLS, so the
  app quietly disagrees with the database and nothing tells you.
  Everything else in Part 0 is cosmetic or internal by comparison.
  I have no Supabase credentials, so this can only ever be you.
