# The daily check

Five minutes each morning, on the Mac, until something alerts on its
own (`docs/monitoring.md`, "Gaps"). Every step only reads. Written
2026-11-22 for #84 (G2).

1. **The heartbeat ran.**
   `bash scripts/prod-read.sh 'heartbeat?select=id,last_ping'`.
   Pass: `last_ping` is within the last 26 hours.
2. **The morning push came**, on a morning the plan was not yet
   confirmed by 6:00 (7:00 in summer time). Pass: the phone shows
   "review and confirm today's plan", or the plan was confirmed before
   then.
3. **Production is the last merge.** Netlify UI: Projects,
   `nff-dashboard`, Deploys. Pass: the top deploy is "Published", and
   its commit is the head of `main`
   (`git -C <dashboard> ls-remote origin main`).
4. **`check` is green on `main`.**
   `gh run list -R north-foster-farm/nff-dashboard --workflow check.yml --branch main --limit 1`.
   Pass: `completed success`.
5. **Nothing open in security.**
   `gh api 'repos/north-foster-farm/nff-dashboard/dependabot/alerts?state=open' --jq length`
   and the same for `code-scanning/alerts`. Pass: both `0`.

On a failure, `docs/monitoring.md` ("What each signal means") says
what it means and where to look. A failure that needs code is an
issue in this repo; one that needs production data repaired waits for
James.

After anything that touched blocks, deadlines, places or the map SVG,
also run `node scripts/check-consistency.mjs` (read-only). Pass: it
reports no dangling references.
