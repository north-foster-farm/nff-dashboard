# Agent relay protocol

An hourly cloud routine ("roadmap agent", Opus 5) works Roadmap v2
`[batch]` items unattended and keeps a queue of staged decisions
ready for James. It has no channel to any local machine — all
communication is through git.

## Channels

- **`agent/relay`** — a standing orphan branch, never merged. Two
  files:
  - `STATE.md` — cloud-owned ledger, rewritten in a fixed shape at
    the end of every run: last-run report, roadmap position, open
    PRs, numbered QUESTIONS (each with a recommendation), and the
    `inbox-processed` marker.
  - `INBOX.md` — James-owned. Numbered answers (`Q7: yes`) and
    free-form redirects. Its `sequence:` number is the new-input
    signal: the cloud agent works only when sequence exceeds
    STATE.md's `inbox-processed`.
- **`agent/wip-*` branches + PRs** — build output. main stays
  PR-only; review/merge is James's normal flow and doubles as an
  answer signal to the agent.

## Run guards (implemented in the routine prompt)

- **Overlap:** first push of a run is a `LEASE:` line into
  STATE.md; a lease under 2 hours old makes the next run exit
  immediately. A rejected lease push (race) also exits.
- **No new input:** status `waiting-on-james` + unchanged INBOX
  sequence → exit immediately. Idle hourly runs cost near zero.

## Hard boundaries (cloud side)

No prod access of any kind (no credentials); `[session]`/`[James]`
items are staged as questions, never decided; chores fence
respected; nothing visual-QA-shaped; never pushes main; never
merges its own PRs; never force-pushes.

## Local handoff

The `/relay` skill (`.claude/skills/relay/`) is the triage
playbook: read STATE.md, spoon-feed pending questions to James one
at a time, write answers into INBOX.md, bump `sequence`, push.
The next hourly run picks it up.
