# Docs

The working rules are in `CLAUDE.md` at the repo root, and the plan is
`ROADMAP.md`. This folder holds the rest.

## Operating the dashboard

- [monitoring.md](monitoring.md): what watches production, what each
  signal means, and the gaps where nothing does.
- [daily-check.md](daily-check.md): the five-minute morning look, each
  step with its pass condition.
- [rollback.md](rollback.md): undoing a bad release (publish a
  previous deploy, or revert), and the disaster-only database restore.
- [integrations-and-credentials.md](integrations-and-credentials.md):
  every outside account and key, and how each is set up.
- [agent-relay.md](agent-relay.md): the hourly cloud routine and its
  hand-off branch.

Still to come: staging (F1.2, #74), backups beyond one laptop (E3,
#69), secrets and rotation (E2, #68), security (E5, #71). Each is
linked here when it lands.

## Reference

- [history/](history/README.md): one chapter per feature, how each got
  to where it is. Backward-looking; `ROADMAP.md` is the forward plan.
- [specs/](specs/): design specs (scheduling engine, chores, farm map,
  capture substrate, agent integration, pasture rotation).
- [workshops/](workshops/README.md): the scope workshop, design
  bracket and QA walkthrough playbooks, with worked runs.
- [ecommerce/](ecommerce/): pricing worksheets and the commerce prep
  brief. `PREP.md`'s Stripe and Hugo-rewrite anchors are stale (the
  site launched on Square); read it for background only.
- [research/](research/): livestock metrics and device API notes.
- [handoffs/](handoffs/): dated feature hand-offs.
- The design system lives in `public/style-guide/` (in the app under
  Style guide).
