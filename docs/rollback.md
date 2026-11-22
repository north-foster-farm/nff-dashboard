# Rollback

The dashboard is a static app and three Netlify functions
(`heartbeat`, `notify-run-done`, `schedule-reminder`) over one
production Supabase project. A bad release is undone in one of two
places: the deploy, which Netlify can swap back in seconds, or the
database, which is restored only in a disaster. Almost every rollback
is the first kind.

Written 2026-11-22 for #75 (F2.1, the branch flow). The flow it
assumes, `next` to `staging` to `main`, is described in `CLAUDE.md`;
until James applies its rulesets, `main` takes pull requests directly
and the "revert" path below lands on `main` through a pull request.

## Decide

Roll back when a release breaks something the farm needs today
(sign-in, the day plan, chores, captures) and a fix cannot be merged
within the hour. A wrong word or a layout fault is fixed forward.

A code rollback never loses data. The app writes straight to
Supabase, so every row the bad release wrote stays, and the older
code reads it.

## Publish a previous deploy (the fast path)

Netlify keeps every deploy as an atomic snapshot of the built app and
its functions. Publishing an older one runs no build.

1. **Find the target**: the last good production deploy. In the
   Netlify UI: Projects, `nff-dashboard`, Deploys, filter by branch
   `main`. Or with the CLI (site id
   `e07c8869-c182-4f21-8300-3dde1e8ffc06`):
   ```
   netlify api listSiteDeploys \
     --data '{"site_id":"e07c8869-c182-4f21-8300-3dde1e8ffc06","branch":"main","per_page":5}'
   ```
   Each deploy's `commit_ref` names the commit it built.
2. **Publish it.** UI: open the deploy, "Publish deploy". CLI:
   ```
   netlify api restoreSiteDeploy \
     --data '{"site_id":"e07c8869-c182-4f21-8300-3dde1e8ffc06","deploy_id":"<target id>"}'
   ```
3. **Lock auto publishing**, so the next merge to `main` builds but
   does not replace the rollback. UI: Deploys, "Lock to stop auto
   publishing". CLI:
   ```
   netlify api lockDeploy --data '{"deploy_id":"<target id>"}'
   ```
4. **Confirm it is live**: load https://admin.northfosterfarm.com,
   sign in, and open Now and the day plan. The service worker
   (`public/sw.js`) caches no app shell, so a reload serves the
   older build at once.
5. **Write it down** in the gitignored `.ignored/incidents/`: what
   broke, the times, both deploy ids. A public issue says only that an
   incident happened; the repository is public and the dashboard
   holds customer and farm records.

**Undo:** publish the bad release's deploy again, or the fix's, then
unlock (`netlify api unlockDeploy --data '{"deploy_id":"<id>"}'`).
Unlock within a day: the lock blocks every publish from `main`.

**Env vars.** A republished deploy keeps the values it was built
with; Netlify applies an env change only to a new build. After a
Supabase key rotation, a deploy built before it holds the old key:
never publish one built before a key was revoked. Revert instead
(next section), which builds with today's values.

## Revert and merge (the lasting path)

For a rollback that must outlive the lock, or when the target deploy
is gone or predates a key change.

1. On a branch from `origin/main` (from `origin/next` once the flow is
   live), revert the release's commits:
   ```
   git -C <dashboard> fetch origin
   git -C <dashboard> switch -c fix/revert-<name> origin/main
   git -C <dashboard> revert --no-edit <first bad commit>^..<last bad commit>
   ```
2. Open a pull request. `check` must pass, and James merges it; under
   the flow it lands on `next` and is promoted to `staging` and
   `main` like any release, nothing skipped.
3. If auto publishing was locked, unlock so the revert's build
   publishes.

Nothing is pushed to `main` around its ruleset. If GitHub Actions is
down and `check` cannot pass, only James can lift the ruleset, and the
fast path above needs none of this.

## What a code rollback does not undo

- **The schema.** Migrations are additive-only (`CLAUDE.md`, "Data
  safety"), so the database stays ahead of the older code: new
  tables and columns sit unused, and older code must not depend on a
  column a later migration dropped. Before rolling back past a
  release that applied a migration, read that migration: a
  `drop` or a `not null` on an existing column means the older code
  may fail, and the fix goes forward instead. Never roll a
  migration back by hand.
- **Rows the bad release wrote.** They stay. If they are wrong,
  correct them with exact-id writes, each logged, after a backup.
- **Push subscriptions and sent notices.** Web push already sent
  cannot be recalled.
- **Scheduled functions.** The published deploy's schedule is the one
  that runs.
- **Offline writes.** A phone's outbox replays its queued writes to
  Supabase whichever build it runs.

## Restore the database (disaster only)

Only for lost or corrupted data that exact-id fixes cannot repair:
a table emptied, a bad bulk write. It replaces rows; it is not a
rollback of code.

1. **Back up what is there now**, even if it is damaged:
   `node scripts/backup-db.mjs`. It is read-only and writes
   `.backups/<timestamp>/`. Check the row counts it prints; the tables
   flagged `*` (events, chores, the schedule) must be non-empty in
   the backup you restore from.
2. **Pick the backup** to restore: the newest `.backups/<timestamp>/`
   taken before the damage. Backups are manual and live on James's
   Mac only (E3, #69, plans more).
3. **Restore one table at a time** where you can:
   ```
   node scripts/restore-db.mjs .backups/<timestamp> --only=<table>[,<table>] --yes
   ```
   Without `--only` it replaces every table in the backup. It deletes
   the current rows of each table it restores and reinserts the
   backup's verbatim, ids preserved, parents before children. A table
   whose shape changed since the backup is logged and skipped.
4. **Check consistency**: `node scripts/check-consistency.mjs`
   (read-only) confirms chore blocks and farm-map bindings resolve.
5. **Write it down** in `.ignored/incidents/`, with the backup used
   and the tables restored.

Every row written between the backup and the restore is lost from
the restored tables. That is why step 1 comes first: its export holds
them, for repair by hand.

A restore writes production. James runs it, or approves it in the
moment; an agent never does.

## Not verified

- That `restoreSiteDeploy` leaves auto publishing unlocked (the site's
  `docs/rollback.md` assumes so; no one has checked on this project).
- That `netlify api` works from James's Mac today: on 2026-11-22 the
  CLI answered `Unauthorized` to an agent's read.
- A rehearsal of either path. The first staging back end (F1.1, #73)
  is where to rehearse a restore without touching production.
