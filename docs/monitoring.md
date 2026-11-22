# Monitoring

Nothing pages anyone when the dashboard breaks. Each signal below is
something James looks at, in the daily check (`docs/daily-check.md`)
or after a deploy; none of them pushes a phone or sends an email on
failure. Written 2026-11-22 for #84 (G2); the gaps at the end are the
work that would change that.

## The pieces

| What | Where it runs | What it proves | How to look |
| --- | --- | --- | --- |
| Supabase keep-alive | `heartbeat` (`netlify/functions/heartbeat.mjs`), Netlify schedule `@daily` | The production database is awake and the function's secret key works | The `heartbeat` row's `last_ping`, below |
| Morning plan nudge | `schedule-reminder` (`netlify/functions/schedule-reminder.mjs`), `0 11 * * *` (UTC: 6:00 or 7:00 on the farm) | Push delivery works end to end | A "review and confirm today's plan" push on a subscribed phone on any morning the plan was not yet confirmed |
| Chore-run push | `notify-run-done` (`netlify/functions/notify-run-done.mjs`), called by the app when a run ends | The same, on demand | A push when a chore run is ended |
| Deploys | Netlify, on every merge to `main` | The build passed and was published | Netlify UI: Projects, `nff-dashboard`, Deploys |
| `check` | GitHub Actions (`.github/workflows/check.yml`), every push and PR | Lint, format and the unit suite with coverage pass | `gh run list`, below |
| Code scanning and dependencies | GitHub code scanning and Dependabot alerts (both answered, with none open, on 2026-11-22) | No open finding or advisory | The two `gh api` reads below |
| Referential integrity | `scripts/check-consistency.mjs`, by hand | Every chore block reference and farm-map binding resolves | Below |

## The commands

All of these only read. The two that reach production read through
the secret key in `.env.local`, so they run on James's Mac.

```
# When the heartbeat last wrote (production, read-only)
bash scripts/prod-read.sh 'heartbeat?select=id,last_ping'

# The last three check runs on main
gh run list -R north-foster-farm/nff-dashboard --workflow check.yml \
  --branch main --limit 3

# Open code-scanning findings and Dependabot advisories
gh api 'repos/north-foster-farm/nff-dashboard/code-scanning/alerts?state=open' \
  --jq 'length'
gh api 'repos/north-foster-farm/nff-dashboard/dependabot/alerts?state=open' \
  --jq 'length'

# Chore blocks and map bindings resolve (production, read-only)
node scripts/check-consistency.mjs
```

## What each signal means

- **`last_ping` older than 26 hours.** The heartbeat has missed a run.
  Supabase's free tier pauses a project after about seven days with
  no database activity, so one miss is a warning, not an outage.
  Open the function's log (Netlify UI: Logs, Functions, `heartbeat`):
  a 500 with "Missing SUPABASE_URL or SUPABASE_SECRET_KEY" means the
  env vars are gone; any other error is Supabase's message. Invoke it
  by hand once fixed:
  `curl -X POST https://admin.northfosterfarm.com/.netlify/functions/heartbeat`
  answers `{"ok":true,...}`.
- **No morning push when the plan was unconfirmed.** Look at the
  `schedule-reminder` log. A push service answering 404 or 410
  removes that subscription; re-subscribe the phone from the app.
  Missing `VAPID_*` vars fail every push.
- **A failed deploy.** Production keeps serving the last good deploy;
  nothing is broken for the farm. Read the build log, fix forward
  through a pull request.
- **A red `check` on `main`.** Something landed that the suite now
  rejects, or a flaky test. Fix forward; never revert by pushing.
- **An open finding or advisory.** File it as an issue in this repo
  with its severity, and fix it under the dependency policy (#30).
- **`check-consistency` reports a dangling reference.** A block,
  place or map binding was renamed or deleted under a reference.
  Repair by exact id, after `node scripts/backup-db.mjs`.

## Gaps

- **No alert on any failure.** A heartbeat that stops, a function that
  throws, a failed deploy: each is seen only when someone looks. The
  site pages James through UptimeRobot and Healthchecks
  (`north-foster-farm/docs/monitoring.md`); the dashboard has neither.
- **No health endpoint.** Nothing answers "is the app and its database
  up" from outside.
- **No log of production writes** until C2 (#56) lands.
