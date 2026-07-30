# nff-dashboard — project rules

Project-specific conventions for this repo. These override default
behavior; follow them exactly.

## Test-driven development (core workflow, 2026-07-02)

TDD is how code gets written in this repo. `npm test` runs the unit
suite (vitest, the pure-logic layer — `src/lib` plus a few pure
helpers beside their component); a green `npm run check` (suite +
lint + format — see Quality gates below) is a hard commit
requirement, enforced by `.githooks/pre-commit` (installed
per-clone via `scripts/setup-hooks.sh`; never bypass with
`--no-verify`).

The loop, exactly:

1. **Step 0 is a failing test.** Write the test that asserts the
   thing you're about to build already works. Run it; it must fail —
   that failure sets up the loop.
2. **Smallest possible steps, on both sides.** Whether adding to the
   test or the solution, add as little code as possible — just enough
   to move the failure toward success. Never leapfrog the test by
   writing the whole feature and testing after the fact. If the test
   isn't literally informing what and how you write every new line,
   it isn't doing its job.
3. **Test code is well-written code.** Extract concerns; descriptive
   variables instead of magic numbers and hardcoded strings; failure
   output must tell a story (`expected $toesCount = 10`, never
   `expected $tC to = 10`). Tell a story in the test body too — it's
   worth a whole line to reassign a variable to a better name if that
   makes the subject of the test plain.
4. **As few tests as possible.** Commit a test only when it adds
   measurable value; a bad test is worse than no test. It's fine to
   write a test that existed only to shape the design and delete it
   before committing (redundant coverage, flimsy guarantees). Cull
   tests that stop working, go obsolete, or duplicate coverage — all
   the time.
5. **Tests are living code.** Update and refactor them as the
   codebase changes; a suite left to rot stops catching bugs and
   stops feeling valuable.

## Quality gates & invariants (H5, 2026-07-30)

`npm run check` is the single definition of "ready to commit" — the
pre-commit hook runs it. It chains eslint (errors gate; warnings are
the visible improvement backlog), stylelint, the unit suite with
coverage thresholds, and `scripts/check-format.sh`.

Everything below is a RATCHET — limits tighten as code improves and
never loosen to make a commit pass:

- **Complexity/size limits** (`eslint.config.js`): complexity 15 /
  max-depth 4 / max-params 5 for new code;
  max-lines-per-function 120 on the pure lib layer. Legacy hotspots
  sit in explicit waiver buckets (25/40/80) in the config; when a
  refactor brings a file under its bucket, move it down or out —
  never add a new file to a bucket.
- **Coverage thresholds** (`vitest.config.js`): measured on the pure
  lib layer only; raise them to just under the new mark when real
  coverage rises.
- **Format** (`scripts/check-format.sh`): no trailing whitespace
  repo-wide (markdown may end a line with EXACTLY two spaces — the
  hard break); max-len 80 checked on ADDED non-template lines only
  (.js/.mjs/.sql/.sh/.css; JSX/HTML exempt).
- **Lib purity** (`src/lib/libPurity.test.js`): impurity lives only
  in `src/lib/data/` (supabase, outbox, capture I/O, use* hooks) and
  `src/lib/browser/` (React + browser APIs). Nothing else under
  `src/lib` may import react/supabase or reach into those zones.
- **Identity invariants** (`src/lib/identityInvariants.test.js`,
  F5): user-renameable rows (blocks, places, projects) are
  identified by primary key only — never `.name`/`.slug` compared
  to a literal, never `.name.toLowerCase()` comparisons.
- **Prod referential integrity**:
  `node scripts/check-consistency.mjs` (READ-ONLY) verifies every
  chore block reference and farm-map binding resolves. Run it after
  anything that touches blocks, deadlines, places, or the map SVG.

## Branch & merge — THIS REPO OVERRIDES the global flow (2026-07-30)

Since deploys fire on anything reaching main, main is gated by a
GitHub ruleset (James's H5 call): **no direct pushes**. The global
squash/fast-forward-push strategy does not apply here.

- Work on a feature branch; squash to atomic commits as usual.
- Open a PR; the `check` workflow (`.github/workflows/check.yml`)
  must pass — it's the required status.
- Merge with GitHub's **"Rebase and merge"** (keeps history linear;
  commits get new SHAs; the PR shows Merged natively — the old
  force-push-then-fast-forward dance is retired for this repo).
- Delete the branch after merge. Netlify deploys the merge — so a
  deploy can only ever be a checked commit.

## Commit style

Every commit on this repo follows one consistent shape. Match it.

### Subject line

`<type>: <summary>`

- **Types:** `feat`, `fix`, `docs`, `chore`.
- Summary is lowercase, no trailing period — a short description of the
  change.
- **Feature batches** use a dedicated form:
  `feat: batch N — <summary> (vX.Y.Z-alpha)`
  - Em-dash (`—`) separator before the summary.
  - Version in parentheses at the very end.
  - Sub-batches are `batch N.M`, e.g. `feat: batch 14.2 — drag
    interactions + processing workspace (v0.10.9-alpha)`.
- **Roadmap / doc-only edits:** `docs: roadmap — <summary>` (no
  version).
- Batch subjects intentionally run long (well over 50 chars). That is
  the house style — keep it one readable line; don't truncate.

### Body

- Blank line after the subject. Wrap the body at ~72 characters.
- Open with a 1–3 sentence context paragraph: what this change is,
  where it sits in a larger arc, and what's explicitly deferred.
- Use `-` for substantive bullets and `*` for sub-bullets nested under
  a `-`. Optional `Label:` lead-ins group bullets by area, e.g.
  `User preferences (user_preferences):`.
- Be concrete and technical — name migrations, tables, hooks,
  components, and files; describe exact behavior. Arrows (`->`) are
  fine.
- When a change defers scope, close with a `Roadmap:` line saying what
  was deferred and what's next.

### Author / trailer

- **Do not add a `Co-Authored-By` trailer.** Commits are authored
  solely by James. This deliberately overrides the default of appending
  a versioned Claude trailer — we don't want a model-version
  fingerprint in commit metadata.
- The body simply ends at its last content line (often the `Roadmap:`
  note).
- Reading history: the first ~45 commits predate this rule and carry
  `Co-Authored-By: Claude Opus 4.x …` trailers. Leave them as-is; the
  no-trailer rule applies going forward only.

### Example

    docs: roadmap — Farm Map overhaul as Batches 15–18, renumber to 38

    Inserts the Farm Map UI overhaul (settled at the 2026-05-31
    workshop) as Batches 15–18 right after 14.2, pushing the
    Events-overhaul tail to 19–20 and renumbering the rest to Batch 38.

    - Batches 15–18: place-model foundation, per-place completion +
      offline outbox, Now surface + hardened Rounds, map renderer +
      place pages + nav restructure.
    - Absorbs the old Resources rethink (Batch 21) into the place-model
      collapse; re-points the old Pasture simulator into the Rotation
      planner (Batch 37).

    Roadmap: the farm-map north-star artifacts are now retired — this
    file is the capture point.

## Data safety — the app is LIVE in production

**As of 2026-06-01 the linked Supabase project is in production.**
It holds real, irreplaceable data. Three kinds in particular must never
be lost:

- **events** — `event_series`, `event_occurrences`, `event_links`, and
  the legacy `event_instances` (superseded by series/occurrences but
  still populated).
- **chores** — `chore_definitions`, `chore_blocks`, `chore_modifiers`,
  `chore_completions`, `chore_assignment_rules`.
- **the schedule** — `commitments` and `captures` (plus
  `capture_schemas`). These hold every confirmed day and every
  reservation; they are the day plan's only record.

Corrected 2026-07-29: this list previously named `chore_runs`, which
migration 0036 dropped on 2026-06-26, and omitted `commitments` /
`captures`, which superseded it. Keep the list honest — a stale
must-never-lose list is worse than none.

Production rules:

1. **Migrations are additive-only.** Every schema change is a new
   migration file. Never amend an already-applied migration; never
   run `supabase db reset --linked`, drop, or truncate.
2. **Back up before every `supabase db push`.** Run
   `node scripts/backup-db.mjs` first — a read-only, full export of
   every table to a timestamped, gitignored `.backups/<ts>/` folder
   (`SUPABASE_URL` + `SUPABASE_SECRET_KEY` from `.env.local`). The
   events/chores tables above are flagged `*` in its summary.
3. **Confirm the row counts look right** (non-empty event/chore
   tables) before applying anything.
4. Disaster recovery only: restore with
   `node scripts/restore-db.mjs <backupDir> --yes` (replace-mode,
   uuid-preserving, per-table tolerant).

## Pre-commit checklist

Run through this before every commit:

0. **The checks are green** (`npm run check` — suite + lint +
   format; see Quality gates above). The
   `.githooks/pre-commit` hook enforces this; don't lean on it —
   run the suite yourself first.
1. The message follows **Commit style** above (including no
   `Co-Authored-By` trailer).
2. **Version bump (batch commits only).** For a `feat: batch N` commit,
   increment the **patch** number — keeping the permanent `-alpha`
   suffix — in **both** of:
   - `package.json` → `version`
   - `src/data/nff-data.json` → `meta.version` (this is what the
     dashboard header renders via `TopBar.jsx`)

   Non-batch commits (`docs` / `fix` / `chore`) normally don't bump.
3. **The two version strings must be equal.** A `PreToolUse` hook
   (`.claude/settings.json` → `scripts/check-version-sync.sh`) blocks
   any `git commit` while they disagree. The hook enforces only
   equality; bumping per batch (step 2) is yours to remember.
4. **Update `ROADMAP.md`** as the final step of every batch.
5. **Never amend a commit already pushed to `origin/main`** — follow-up
   fixes go in a new commit. Ask before each commit; don't push unless
   asked.
