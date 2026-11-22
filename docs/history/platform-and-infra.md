# Platform & infrastructure

Supabase and the migration regime, Netlify deploys, auth, backups, the
git hooks, the vitest suite, and the arrival of TDD. The chapter about
the ground everything else stands on — and about the moment
(2026-06-01) when that ground stopped being disposable.

Batch numbers are as-shipped commit-subject numbers per
`.ignored/housekeeping/mining/m1-commits.md` §2; roadmap-era numbers
are flagged as such, because the roadmap was renumbered six times
(m1 §5). Every F-number carries its audit date — four independent
F-universes exist.

## Evolutions

**2026-05-01 — a dashboard becomes a project.** `a074dfb` opens the
repo with a hand-assembled dashboard; `7352c0b` restructures it into a
standard Vite + React app. That choice still governs everything: a
static SPA with no backend of its own, all state in hosted Postgres.
"Infrastructure" here therefore means a handful of scripts, one
Netlify config, and a migrations folder.

**2026-05-03 — auth is settled in one commit and never revisited.**
`9878f1e` adds Supabase auth, Google OAuth and an admin allowlist:
an `admins` table plus `current_user_is_admin()` (migration
`0001_auth_admins.sql`, landed in `4a23921`). Every policy written
since scopes to the `authenticated` role. No roles, no tenants, no
per-user partitioning — an authenticated session is a trusted
session. That assumption is load-bearing, and it is the single
biggest thing a public storefront breaks.

**2026-05-03/04 — JSON→Postgres in four batches.** The seed data moved
out of a checked-in blob across `8aa463f`, `cc8ff63`, `c85f8b5`,
`db12916`, with throwaway generators still in the tree
(`scripts/gen-batch{2,3,4}-seed.mjs`). One residue is deliberate:
`src/data/nff-data.json` still supplies `meta.version` (rendered by
`TopBar.jsx`) and some test fixtures. `4a23921` then lands migrations
0001–0006 in a single commit — the last time that was acceptable —
and `67bd7cb` adds `netlify.toml` plus
`netlify/functions/heartbeat.mjs`, a daily scheduled function whose
only job is upserting one row so Supabase's free tier does not
auto-pause after ~7 idle days. `4b4e822` swaps the legacy
`service_role` JWT for the `sb_secret_…` format; `d846b43` folds the
handoff docs into `README.md`.

**2026-05-07 — noindex, three layers deep.** `f2523d9` adds
`public/robots.txt` (`Disallow: /`), a `<meta name="robots">` tag, and
an `X-Robots-Tag` response header in `netlify.toml`. The config's own
comment gives the reasoning: robots.txt stops well-behaved crawlers,
the header stops anything that fetches the page anyway. This is an
admin tool that must never appear in a search result — precisely the
posture a storefront has to invert.

**2026-05-08 — the first governance failure.** `8d0d48c` fixes version
drift: `TopBar` rendered v0.10.1-alpha while `package.json` had run
ahead to v0.10.9-alpha, unnoticed for days. The fix was manual; the
lesson became a hook three weeks later.

**2026-05-31 — the governance commit.** `3e7a6ac` is where the repo
starts enforcing conventions instead of hoping. It writes the
commit-style guide into `CLAUDE.md` (types, the `feat: batch N — …
(vX.Y.Z-alpha)` form, the deliberate no-`Co-Authored-By` rule) and
adds `scripts/check-version-sync.sh` as a Claude Code `PreToolUse`
hook via `.claude/settings.json`: it reads the tool payload from stdin,
acts only on `git commit`, compares `package.json`→`.version` against
`src/data/nff-data.json`→`.meta.version`, and exits 2 on disagreement.
It enforces *equality only* — bumping per batch is still human work.

**2026-05-31 — backups arrive on the eve of needing them.** `acfd246`
(batch 15, the places collapse) adds `scripts/backup-db.mjs` and
`restore-db.mjs` plus the first data-safety section in `CLAUDE.md`.
Backup = read-only full export of every REST-exposed table into a
timestamped, gitignored `.backups/<ts>/`, credentials from
`.env.local` at runtime; restore = replace-mode, uuid-preserving,
per-table tolerant. Both were written *for* the amend-in-place
workflow (back up → reset → reapply → restore) and outlived it by
becoming the pre-push safety net.

**2026-05-31 — the amend-in-place era ends, precisely.** Migrations
0001–0013 were amended in place and the linked DB reset whenever the
schema moved (`b37ed73`, `14addbe`, `acfd246`, `dd941ed`). The **last
DB reset** was `dd941ed`, batch 16.1, 2026-05-31 — the per-place
completion re-key, whose roadmap entry records the era's discipline:
"backup → reset → restore loop run; all priority tables verified
non-empty before reset" (`ROADMAP.md:1214-1216`).

**2026-06-01 — the production cutover.** `fd1cd2d` (batch 19,
automations) carries the sentence the whole regime hangs on: the
linked DB is live, migrations are additive-only from here, and
`CLAUDE.md`'s data-safety section is rewritten accordingly. The
**first additive-only migration** is `0014_chore_anchors.sql`, shipped
the same day in `f7df449` (batch 18.1) with a plain `db push` after a
safety backup — "the amend-in-place / reset era is over"
(`ROADMAP.md:1449-1451`). Since then the schema is append-only
history: 0001 through 0050, none ever rewritten.

The push protocol hardened into three *separate* commands, and the
separation is the point: `node scripts/backup-db.mjs` (fresh — an
earlier same-session backup does not count), then eyeball priority
row counts in the new backup dir (event and chore tables non-empty),
then `supabase db push`. A chained `backup && push` is rejected for
skipping the human confirmation. Each push needs per-push
authorization; a general "proceed" does not cover it (memory:
`feedback_pre_production_migrations`, learned at batch 25). Batch 26.1
added an ordering rule the hard way: if a migration adds columns a
hook SELECTs by name, it must reach prod *before* the frontend, or
PostgREST errors and live data loads break. Order: db push → verify →
git push.

**2026-06-01 — no local Supabase, ever.** The same day James stopped an
attempt at a local stack: `supabase start` stalls indefinitely, no
output, no image pulls (memory: `feedback_no_local_supabase`). Every
DB verification since happens against production under a surgical
protocol — clearly marked test rows, exact-ID cleanup, standing
approval for that pattern only. The repo bears the trace: `supabase/`
contains **only** `migrations/`, with no `config.toml`, because the
local stack was never successfully initialized.

**2026-06-01 — field-hardening, four commits in a day.** The phone
rollout exposed what desktop had hidden. `fff8d20` ends the surprise
sign-outs: the admin verdict is cached per user id and persisted to
localStorage, so hourly token refreshes reuse it rather than
re-hitting the network, and a transient RPC failure falls back to the
last known verdict instead of dumping an authorized user on "Not
authorized" — written up as the "no surprise sign-outs" contract in
`src/components/LoginGate.jsx`. `328db1a` kills the sticky nav;
`9614564` adds text zoom with a density-exempt map; `a611ec0` adds
`src/lib/router.js`, a history-API router with no react-router
dependency, so reloads reopen the same screen and screens deep-link —
which is why `netlify.toml` carries the SPA rewrite (`/*` →
`/index.html`, status 200, deliberately not a 301).

**2026-06-03 — the phone becomes a first-class client.** `980c9d6`
(batch 35) is a responsive pass over 41 routes at 390×844 plus a PWA
install prompt; `public/manifest.webmanifest` and `public/sw.js`
arrived earlier with web push (migration `0011`), and `sw.js` still
states it owns push only and caches nothing. `70296d4` (batch 33) adds
the cmd-K palette (`src/components/CommandPalette.jsx`) as purely
client-side search — the Postgres `tsvector` version and per-row
detail routes for customers/products/orders were both deferred in that
commit, so search jumps to list pages only.

**2026-06-03/04 — the walkthrough-audit pipeline.** `c99476b` adds
`scripts/process-audit.sh`: ffmpeg pulls audio from a screen
recording, whisper.cpp transcribes with timestamps, ffmpeg grabs a
frame at each spoken segment's midpoint, and the script stitches a
per-clip `transcript.md` interleaving `[mm:ss] text → frame.jpg`.
Nothing leaves the machine. `b0ce1d8` adds `--cleanup`, moving each
processed clip to the macOS Trash — recoverable, never a hard delete —
since the source `.mov` files run to hundreds of megabytes. This
produced the 2026-06-04 walkthrough audit: F1–F132 at capture in
`68c65f7`, now 138 findings in `audits/2026-06-04/findings.md`
(F133–F138 added during the fix phase). Three more rounds followed
(2026-06-03, 06-28, 07-01/02), each with its own independent
F-numbering.

**2026-06-26 — a property test, outside the gate.** The overnight and
project-blocks work brought `scripts/test-schedule-partition.mjs`, a
~4,000-run randomized property test over the ribbon partitioner's
invariants (`npm run test:partition`). It predates the unit suite and
is *not* part of `npm test`, so it is not part of the commit gate;
`src/lib/schedule/partition.test.js` says so and positions itself as
the complement — hand-traced values versus invariants.

**2026-06-30 — read-only prod access, by construction.** `3d06fb5`
tracks `scripts/prod-read.sh`, whose comment states the reasoning:
allowlisting bare `curl` would also permit writes and exfiltration to
arbitrary URLs, so the wrapper pins the method to GET (`curl --get`,
never `-X`/`-d`) and the host to the project's Supabase REST endpoint.
That constraint is what makes it safe to auto-allow — which is what
lets an agent be proactive about prod data instead of waiting to be
asked (memory: `feedback_proactive_prod_data`).

**2026-07-01 — the deploy path verified end to end.** `657a1c2`
anchors the version-sync hook to the project root (it had resolved
relative to the session cwd, breaking whenever the shell sat in a
subdirectory). The same day the pipeline was verified: `git push
origin main` → Netlify auto-builds and publishes
**admin.northfosterfarm.com** in about two minutes, no manual step.
Freshness is checked by content marker — curl the live bundle for a
string only the new commit contains — not by comparing bundle hashes
to a local build, which once produced a false "not deployed" alarm.
Two quirks from the same note: use the installed `netlify` binary,
never `npx netlify-cli`; and `.claude/settings.json` needs `git add
-f`, because the global `~/.gitignore` ignores `.claude/` (memory:
`reference_netlify_deploy`).

**2026-07-02 — the day this repo got a test suite.** Fourteen months of
features had shipped with zero automated tests. `08c523d` lands vitest
with 18 files / 558 tests over the pure lib modules, plus a
`vitest.config.js` kept separate from `vite.config.js` on purpose
(`node` environment, no react or tailwind plugins — the target is
business logic, not the DOM). It records the fixture traps the suite
had to settle: blocks must carry real `CHORE_BLOCK_IDS` uuids;
`childrenByParent` maps to arrays of place *objects*; `definitions: []`
silently triggers the 67-seed `CHORE_SEEDS` fallback, so an "empty
day" needs a never-firing event chore. It found a bug immediately —
`pickCoverPerson` in `manDown.js` offered "James" as cover for a
non-admin assignee, because the no-other-admin guard was dead code
(`ADMINS.find` always matched the first admin).

`fffc7aa` finished the sweep (13 more files, 485 more tests, 31 files /
1043 green over five consecutive runs) and honestly listed what was
skipped as not unit-testable: `supabase.js`, `outbox.js`, the weather
hook, `router.js`'s `navigate`/`usePath`. The pass surfaced **six
latent edge-case bugs**, fixed in `4de195c`: `advanceDate`'s `setMonth`
overflow (Jan 31 + 1 month landed on Mar 3, breaking month paging from
day-31 dates); `eventToBlock` reading `endTime: "00:00"` as falsy and
defaulting to 60 minutes instead of midnight-closes-the-day; two
`feedCost` NaN/TypeError paths poisoning per-batch feed cost;
`runOverrunMinutes` reporting 0 for any midnight-crossing run;
`salesByMonth` throwing on an all-empty month list; `bracketMidpointLb`
crashing rather than degrading to "—". None was user-visible yet — each
needed a data shape prod did not hold — but all were real.

`bdf8aaf` closed the loop: `.githooks/pre-commit` runs `npx vitest run`
and blocks on red, `scripts/setup-hooks.sh` installs it per clone via
`git config core.hooksPath`, and `CLAUDE.md` gains the TDD loop as
*the* way code is written here — failing test first, smallest steps on
both sides, narrative test code, as few tests as possible, cull
ruthlessly. The hook's own error message declares `--no-verify` "not
the workflow".

**2026-07-02 — two devices, one debounce.** The Schedule's auto-reflow
planner produced the only genuine concurrency bugs this repo has had,
and both were root-caused in code that no longer exists — Round 5's
NO-LEGACY pass retired the planner and deleted `reflowPlan`,
`placementKey`, `planSignature`, `isStale`, `reconcilePlan`, the
`useScheduleReflow` hook and `reflowBridge` with it (the gravestone is
`src/lib/schedule/reflow.js:55-59`). The findings are banked here
because the *shape* of the bug outlives the module: any future feature
where two clients write derived rows off the same realtime trigger
gets both of these for free.

- **Duplicate placements.** James runs two devices. Their debounce
  timers reset on the *same* realtime events, so they fired in the
  same instant and each inserted the same (step, gap) pair under a
  different uuid. Reconciliation then hid the damage: duplicate
  placement keys counted as in-plan, so `toPlace` and `toRemove` both
  came back empty and the duplicate never healed, while `stale` stayed
  true forever. **The mitigation is the durable part —** dedupe by
  placement key and keep the **lexically smallest id**. Every device
  computes the same survivor from the same rows, so concurrent healers
  delete the same extra rows instead of fighting over which to keep.
  No lock, no leader election, no server round-trip: a total order the
  clients already share is enough.
- **The engine borrowing the user's delete.** Found underneath the
  first, and worse. `syncNow` reused the user-facing `removeDelta` —
  which *tombstones* — for its own stale placements, so an engine MOVE
  tombstoned the step it was moving, excluding it from the very plan
  doing the moving; on the next sync the step fell off the day
  entirely. The fix separated the two paths: a `hardRemove` (plain
  delete, never tombstones) for engine reconciliation, `removeDelta`
  left as the user path. The general rule: a tombstone records a
  *human's* intent, and machinery that reuses it inherits an exclusion
  it did not mean.

Both were verified live against prod, which is the only way this repo
can verify anything (see the prod-only test protocol below). The
contemporaneous write-up was Round 4 of the audit-v2 feedback, which
survives only in untracked `.ignored/` and in Roadmap v1 — recoverable
as `git show db18151^:ROADMAP.md`, around line 4142.

**2026-07-29 — the housekeeping arc.** `f77e6bc` scaffolds
`docs/history/` and `docs/ecommerce/PREP.md`; `063ffb7` lands the H1
promotion, moving durable planning docs out of untracked `.ignored/`
into `docs/specs/`, `docs/workshops/`, `docs/research/` and
`docs/history/records/` so chapters cite tracked paths. `b19b4e1` adds
`scripts/export-pixelmator-palette.py`.

## Current state

**Build and dependencies.** `package.json` at `0.10.99-alpha`, ESM,
private. Six scripts: `dev`, `build`, `preview`, `test` (`vitest
run`), `test:watch`, `test:partition`. Fourteen runtime deps
(`@supabase/supabase-js`, React 18.3, three `@dnd-kit` packages,
`lucide-react`, `rrule`, `suncalc`, `pluralize`, `marked`,
`dompurify`, `ajv`, `web-push`) and five dev deps (vite 5.4, vitest
4.1, tailwindcss 4.2 + `@tailwindcss/vite`, `@vitejs/plugin-react`).
**No linter, no formatter, no type checker.** React 18→19 and Vite
5→latest are Roadmap v2 items, not housekeeping (`PLAN.md`, H4/A2).
`vite.config.js` is three plugins and a dev port.

**Tests, measured today.** `npx vitest run` → **37 files, 1178 tests,
all green, 1.67s**. Thirty-six sit under `src/lib/` (twelve in
`src/lib/schedule/`, plus `docdata/liveDoc` and `load/farmLoad`); one
is `src/components/animalIcons.test.js` — real drift from the docs,
since both `CLAUDE.md` and the `vitest.config.js` header describe the
suite as covering "the pure `src/lib` layer" while the include glob is
`src/**/*.test.js`. Fix the description, not the test.

**Hooks — two gates of two different kinds.**

- `.githooks/pre-commit` runs the full suite; red blocks the commit.
  Installed per clone by `scripts/setup-hooks.sh`, so a fresh clone is
  ungated until someone runs it.
- `.claude/settings.json` → `PreToolUse(Bash)` →
  `scripts/check-version-sync.sh` blocks `git commit` on version
  drift. This one binds *agents only* — a human committing from a
  terminal is not covered.

**Scripts (`scripts/`, 14 files).** Live: `backup-db.mjs`,
`restore-db.mjs`, `prod-read.sh`, `check-version-sync.sh`,
`setup-hooks.sh`, `process-audit.sh`, `test-schedule-partition.mjs`,
`generate-vapid-keys.mjs`, `export-pixelmator-palette.py`. Spent
one-shots: `gen-batch{2,3,4}-seed.mjs` (the 2026-05 seed generation)
and `chores-cutover.mjs` (the 2026-06-04 prod chore surgery, narrated
in `docs/history/records/chores-rebuild-reconciliation.md`) — four H3
candidates. Note the deliberate absence: no `db:reset`, no force-push,
nothing destructive in `package.json` (memory:
`feedback_no_destructive_repo_scripts`).

**Netlify.** `netlify.toml` = build (`npm run build` → `dist`), a
functions directory on the esbuild ESM bundler, the SPA 200-rewrite,
and a site-wide `X-Robots-Tag: noindex, nofollow, noarchive,
nosnippet`. Three functions: `heartbeat.mjs` (daily, `config.schedule`
inline, keeps the free tier awake), `notify-run-done.mjs` (web push on
run completion, RLS-bypassing cross-user read), and
`schedule-reminder.mjs` (the daily confirm-today nudge, which reads
only the cheap `schedule.confirmed_day` capture signal rather than
recomputing the day server-side). All need `SUPABASE_SECRET_KEY` from
Netlify env; two also need the VAPID trio.

**Database.** `supabase/migrations/` holds exactly **50** files,
`0001_auth_admins.sql` → `0050_layer_lifecycle.sql`, additive since
0014. Three destructive/DML events are on record (m1 §3): `0026`
(deliberate prod DML cleanup — deletes prep projects, tombstones auto
events), `0036` (the only schema drop to date: the `timeline_items`
view and the `chore_runs` table, applied 2026-06-26 with an orphan
check of 0), and `0038` (retires the chore-creating half of the
broiler automation).

**Three migrations' commits say they were never pushed. Two of the
three were in fact applied** — verified 2026-07-29 by read-only probe:

- `0033` (chores-rebuild foundation, renumbered 0029→0033 as Schedule
  migrations landed) — **applied.** `chore_blocks.slug` is present and
  populated; `chore_checklist_items` exists (empty).
- `0040` (`anchor_type` former-occupancy CHECK widening; `cc72b04` says
  "needs an authorized push") — **applied.** A live `chore_definitions`
  row ("Brooder cleanout") carries `anchor_type = 'former_occupancy'`,
  which the pre-0040 CHECK would have rejected.
- `0043` (`unconfirm_day` DELETE policy) — **still unverified.** RLS
  policies are not readable through PostgREST, so `prod-read.sh` cannot
  settle it.

The lesson is symmetric, and worth carrying into H4: a commit body
saying "not pushed yet" is not evidence of current state, because the
follow-up push routinely left no commit. `ROADMAP.md:2867` and m1 §3
both still call `0033` unpushed and are wrong.

RLS posture, measured against the migration files: **79 tables
created, 79 with `enable row level security`** — no gaps. All ~166
policies target the `authenticated` role; there is **not one `anon`
policy** and no `using (true)` grant. The client ships only the
publishable key; the secret key exists solely in `.env.local` and
Netlify env, and `.env.example` documents why the split is safe and
warns against ever prefixing the secret with `VITE_`.

**Concurrent writers have no platform-level answer.** There is no
lock service, no leader election and no server-side arbitration — the
app is a static SPA talking straight to Postgres, and James genuinely
runs two devices at once. The one thing that has worked is the
lexically-smallest-id survivor rule (2026-07-02 above): when two
clients can derive the same row, give the row a key both compute
identically and let every client keep the same winner. The one
exception, `attachment_doc_data`, buys its safety with a Postgres
advisory lock and still has no same-key conflict banner
(`docs/history/projects.md`). Assume any new derived-row feature needs
one of those two answers chosen deliberately.

**Backups.** `.backups/` holds 56 exports, first `2026-05-31T23-09Z`,
last **`2026-07-03T02-37Z`**. Backups precede pushes and the last
migration push was 2026-07-02 (0044–0050 all landed that day), so the
cadence is internally consistent — but roughly four weeks of live farm
use since then has no local export. Nothing is scheduled.

**CI.** None. No `.github/`, no workflow, no remote gate of any kind.
Everything is enforced by two local hooks — one needing a per-clone
install, the other binding agents only — while `main` auto-deploys to
production ~2 minutes after a push.

**Loose secrets, still in the tree.** Two files remain in untracked
`.ignored/`: the Google OAuth web-client JSON (client id + secret,
project `nff-admin`, 2026-05-03) and `vapid-keys.txt` (the live
web-push keypair, mode 600, 2026-06-01). Neither is tracked by git
(`~/.gitignore:45` ignores `.ignored/`), and M3's reference check
found **zero** inbound references from `scripts/`, `src/`, `supabase/`,
`netlify*`, `package.json` or docs — the OAuth credential lives in the
Supabase dashboard config, the VAPID values in `.env.local` and
Netlify env. Both relocate with no code change, which is Phase H3's
job.

## Unresolved threads

- **Settle migration 0043.** 0033 and 0040 are confirmed applied (see
  Current state); 0043 is the one still open, and it cannot be probed
  read-only because PostgREST does not expose RLS policies. The
  definitive check is `supabase migration list --linked`, which needs
  `supabase login` first — no access token is configured in this
  environment. Note the failure mode if it is unapplied: a denied
  DELETE under RLS is a **silent no-op** (the policy removes rows from
  scope rather than raising), so un-confirming a day would appear to
  succeed while the day stayed confirmed. That is worse than an error,
  and it is why `ROADMAP.md:4173-4175`'s "404s until applied" is the
  wrong expectation to debug against.
- **No CI.** Agents commit to a repo where `main` auto-deploys to
  production in ~2 minutes, and the only gate is a local hook a fresh
  clone does not have until `setup-hooks.sh` runs. A GitHub Actions
  workflow running `npm test` + `npm run build` on push is already
  named as an H5 decision point (`PLAN.md`, Phase H5).
- **`npm test` does not run everything.** `test-schedule-partition.mjs`
  (~4,000 randomized runs over the partitioner — the richest bug
  surface in the Schedule engine) sits outside the gate. Fold it into
  vitest or add it to the hook; a property test nobody runs is
  decoration.
- **The version-sync hook binds agents only.** As a `PreToolUse` hook
  it is bypassed by a human `git commit`; moving the check into
  `.githooks/pre-commit` beside the suite would make it universal.
- **House formatting is unenforced.** 80 columns, no trailing
  whitespace, `-`/`*` nesting — all manual. H5 scopes ESLint flat
  config (with complexity/size limits), stylelint and a whitespace
  check into the hook; none exists yet.
- **Backup cadence is manual and push-coupled.** Nothing backs up the
  DB during a month of feature-free use, and `restore-db.mjs` has
  never been exercised against a real loss — schedule both the backup
  and a restore rehearsal.
- **Secret relocation (H3).** Move the OAuth client JSON and
  `vapid-keys.txt` out of the repo tree. Zero code references, so pure
  hygiene — but a precondition for payments or customer-PII work.
- **The prod-only test protocol is permanent, not temporary.** With no
  local stack, every trigger, RPC and policy is verified by writing
  marked rows to production and deleting them by exact id. It has held,
  but it scales badly and is why a checkout flow could not be safely
  exercised today. A Supabase branch, or a second free project as a
  staging target, is the cheap way out and has never been evaluated.
- **Dead weight for the H3 sweep.** The four spent one-shot scripts
  above; `audits/` at 244 MB locally (mostly gitignored `processed/`
  trees plus `raw/`); the `CLAUDE.md` / `vitest.config.js` "pure
  `src/lib`" wording.

## E-commerce relevance

This chapter carries the most for the next arc, because nearly every
platform decision so far was made *because* the app is private.

- **Auth is allowlist-only and there is no anonymous path.** All 79
  tables have RLS on and every policy targets `authenticated`; zero
  `anon` policies, no public view. A storefront needs the opposite:
  anonymous read of a narrow, explicit surface (published products,
  current prices, availability) and anonymous write of nothing beyond
  a cart or order intent, ideally through an RPC or edge function
  rather than table-level grants. That surface is a first-class design
  task, not a policy tweak — and because `product_prices` is
  append-only, "current price" is a view or function, not a column.
- **Customer-facing means a second identity model.** `admins` +
  `current_user_is_admin()` cannot express "a customer who may see
  their own orders". Either customers never authenticate (magic-link
  order lookup, no accounts) or a genuine per-row ownership model
  arrives — the first time this schema would need one.
- **The whole app is deliberately de-indexed** at three layers,
  including a site-wide response header. A storefront must be
  indexable, so it cannot live behind the same headers — which argues
  for a separate Netlify site (or at minimum path-scoped headers)
  rather than a route inside the admin SPA. This intersects the still-
  open Hugo-vs-JS site-architecture decision recorded in `f2e08f7`.
- **`main` auto-deploys to production in ~2 minutes with no CI.**
  Today the blast radius of a bad push is two farmers reloading a
  dashboard; with a storefront it is a broken checkout in front of
  customers. A remote gate, and probably a branch-deploy/preview
  habit, stops being optional.
- **Secret handling is sound but thin for what is coming.**
  `.env.local` local, Netlify env for functions, nothing secret
  prefixed `VITE_`, `.env.example` as the documented contract — but no
  rotation story, and two live credentials still loose in `.ignored/`.
  Stripe, Shippo and QuickBooks keys (sequenced in
  `docs/integrations-and-credentials.md`) belong in Netlify env from
  day one, in test mode, with the loose files gone first.
- **Manual push-coupled backups fail an order book.** Losing a day of
  chore completions is annoying; losing a day of paid orders is not
  recoverable by re-entry. Scheduled backups plus a rehearsed restore
  are a precondition, not a nice-to-have.
- **Payments and webhooks need server compute this platform has barely
  used.** Three simple, RLS-bypassing Netlify functions exist today.
  Stripe webhooks, Shippo tracking callbacks and an order-state
  machine mean many more, with signature verification, idempotency
  and real error paths — a materially different operational posture
  from "upsert one heartbeat row".
- **There is no staging environment and no local DB.** Checkout is the
  one flow that cannot be tested by writing a marked row to prod and
  deleting it. Solve staging before writing payment code.
