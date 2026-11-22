# Recorded GitHub answers for bin/promote main

`f2.1-promote-approval.test.js` serves these to `bin/promote main`
through `../../fake-gh`. Each is a real answer from GitHub, recorded
with `gh api` against north-foster-farm/nff-dashboard and scrubbed,
never written by hand. The coordinator records them; the test agent
and the implementer do not.

## What a file holds

```json
{
  "_source": { "recorded": "YYYY-MM-DD", "by": "...", "scrubbed": "..." },
  "request": "GET repos/north-foster-farm/nff-dashboard/pulls?state=open&base=main&per_page=100",
  "response": []
}
```

`request` is the call the answer was recorded for. The fake answers a
call only with the recording whose request matches it (query
parameters in any order), so the implementation makes these calls, as
the site's approval() does. `response` is the body GitHub sent, one
page.

One placeholder: `SANDBOX_HEAD`, written in by the scrub wherever the
answer names the commit being promoted (a pull request's `head.sha`,
an activity entry's `after`). The test fills it in with a commit only
its sandbox has. Logins and anything else private are scrubbed to
placeholders; timestamps are kept as recorded.

## The recordings

All but the first three are of one staging-to-main pull request, so
its number in `timeline-*` requests is the number in `pulls-staging-*`.

| File | Request | What it must show |
| --- | --- | --- |
| `pulls-none-from-staging` | pulls | open PRs into main, none with head `staging` |
| `pulls-other-branch` | pulls | an open PR into main from another branch of this repo, head `SANDBOX_HEAD` |
| `pulls-fork-staging` | pulls | an open PR into main from a fork's `staging`, head `SANDBOX_HEAD` |
| `pulls-staging-lgtm` | pulls | the staging PR, head `SANDBOX_HEAD`, LGTM on |
| `pulls-staging-no-lgtm` | pulls | the same PR without LGTM |
| `timeline-no-lgtm` | timeline | its timeline before any LGTM |
| `timeline-lgtm` | timeline | an LGTM `labeled` event later than the push in `activity-staging-push` |
| `timeline-lgtm-removed` | timeline | that `labeled` event, then `unlabeled` |
| `timeline-fork-lgtm` | timeline | the fork PR's, with LGTM later than the push |
| `timeline-other-branch-lgtm` | timeline | the other-branch PR's, with LGTM later than the push |
| `activity-staging-push` | activity | a push to staging, `after` `SANDBOX_HEAD`, before the label |
| `activity-staging-push-after-label` | activity | a push to staging, `after` `SANDBOX_HEAD`, later than the label in `timeline-lgtm` |

The requests, as the site's approval() makes them:

- pulls: `GET repos/north-foster-farm/nff-dashboard/pulls?state=open&base=main&per_page=100`
- timeline: `GET repos/north-foster-farm/nff-dashboard/issues/N/timeline?per_page=100`
- activity: `GET repos/north-foster-farm/nff-dashboard/activity?ref=refs/heads/staging&activity_type=push&per_page=100`

One sequence gives every staging recording: open the staging PR
(`timeline-no-lgtm`, `pulls-staging-no-lgtm`); push A to staging
(`activity-staging-push`, A scrubbed to `SANDBOX_HEAD`); add LGTM
(`timeline-lgtm`, `pulls-staging-lgtm`); push B to staging
(`activity-staging-push-after-label`, B scrubbed); remove LGTM
(`timeline-lgtm-removed`).
