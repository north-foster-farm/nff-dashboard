# nff-dashboard — project rules

Project-specific conventions for this repo. These override default
behavior; follow them exactly.

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

## Data safety — back up before any destructive DB op

The linked Supabase project holds **real, irreplaceable data**. Two
kinds in particular must never be lost: **events** (`event_series`,
`event_occurrences`, `event_instances`, `event_links`) and **chores**
(`chore_definitions`, `chore_blocks`, `chore_runs`, `chore_modifiers`,
`chore_completions`, `chore_assignment_rules`). Re-importing afterward is
acceptable; silently losing what's in the DB is not.

Because the pre-production rule **amends migrations in place**, picking
up an amended migration means resetting the DB — which is destructive.
So, before **any** destructive DB operation (`supabase db reset`,
re-applying amended migrations to the linked project, or any drop/
truncate):

1. **Run `node scripts/backup-db.mjs` first.** It does a read-only,
   full export of every table to a timestamped, gitignored
   `.backups/<ts>/` folder (`SUPABASE_URL` + `SUPABASE_SECRET_KEY` from
   `.env.local`). The events/chores tables above are flagged `*` in its
   summary.
2. **Confirm the row counts look right** (non-empty event/chore tables)
   before proceeding with anything destructive.
3. If a reset wipes the linked DB, restore with
   `node scripts/restore-db.mjs <backupDir> --yes`.

### Pre-rollout reset/restore loop (until v1.0)

While migrations are amended in place, treat the DB as disposable:
**back up → reset → restore** on every reset.

    node scripts/backup-db.mjs                    # snapshot all tables
    supabase db reset --linked                    # apply amended migrations
    node scripts/restore-db.mjs <backupDir> --yes # put data back

`restore-db.mjs` is **replace-mode**: it deletes the just-seeded rows
and re-inserts the backup verbatim (uuids preserved, FK-safe order) so
the backup is authoritative and references stay consistent. It is
per-table tolerant — a table whose **schema changed** (column
renamed/dropped) won't reinsert and is logged + skipped; that's the
"handle case-by-case" path, and it's usually fine because the migration
re-seeds that table. At v1.0 rollout this loop ends: migrations go
additive-only and data persists across deploys.

## Pre-commit checklist

Run through this before every commit:

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
