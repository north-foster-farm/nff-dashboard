# Playbooks

Reusable methods for working on this app. Two are **design** playbooks
(run *before* building); one is a **QA** playbook (run *after*).

## Design track — two methods, one pipeline

Design a feature by running several AI agents in parallel as competing
designers, then narrowing to one decision a human can act on. The two
methods are **complementary stages of one pipeline**:

```
  fuzzy idea ──►  SCOPE WORKSHOP  ──►  Scope Document  ──►  DESIGN BRACKET  ──►  the Design
                  (what to build)      (binding handoff)    (what it looks like)   (build reference)
```

- **Scope Workshop** decides *what to build* — the model, the entities,
  what's in and out of scope. Several agents each pitch a design from a
  fixed, deliberately different **lens** (scope-cutter, maximalist,
  reframer, conventions, first-principles, the non-technical "Dad" operator,
  …). The orchestrator synthesizes all pitches into one recommendation plus
  a decision table. Output: a **Scope Document**. It deliberately leaves the
  *look and feel* open.

- **Design Bracket** picks up where the Scope Workshop stops: it decides
  *what the feature looks like and how it feels to use*, within settled
  scope it does not relitigate. It's an **elimination funnel** — four design
  stances produce cheap wireframes (Round 1), a gate narrows the field to
  ~two, only those get built as real clickable coded mockups (Round 2), and
  one wins. Output: **the Design** (a running mockup + a short decision
  spec).

Read `scope-workshop/` first — the Design Bracket assumes its vocabulary
(lenses, counter-pressure, blind parallel agents, orchestrator-owned
synthesis, the Dad reserve lens).

## QA track — verifying what got built

- **QA Walkthrough** is the post-build counterpart: record a
  screen-and-voice walkthrough of the running app (OBS, desktop + iOS
  side by side), process each clip locally into a transcript + frames,
  and write a triaged findings backlog, then triage and fix. It reuses
  the same "narrate against a still frame" discipline and the lens set.
  Output: `findings.md` (and the fixes). It is **not** part of the
  design pipeline above — it closes the loop after a feature ships.

## Layout

```
docs/workshops/
  main-agent-loop.md               ← the preface: the whole 6-step working loop, first-person
  scope-workshop/
    scope-workshop-playbook.md     ← the method (the operating manual)
    examples/
      chores/                      ← the FIRST run (2026-05-06): the four agent prompts verbatim,
                                     the only place an assembled prompt survives. Inputs only —
                                     the pitches and synthesis are lost (see its README)
      events/                      ← the second run, same day, compact single-document style
      farm-map/                    ← a brief-seeded run (the lighter variant)
      schedule/                    ← a story-set-seeded run, full chain → Scope Document
  design-bracket/
    design-bracket-playbook.md     ← the method
    DESIGN-SYSTEM.md               ← frozen 2026-06-28 snapshot (see the staleness note below)
    examples/
      schedule/                    ← the canonical run: brief → wireframes → coded mockups → the Design
                                     (0-scope-document.md is the handoff IN from the Scope Workshop)
      harvest-remix/               ← a three-round run against an existing UI (recon → wireframes →
                                     gate → joint build plan), not a greenfield feature
  qa-walkthrough/
    qa-walkthrough-playbook.md     ← the QA method (OBS capture → process → findings → triage → fix)
                                     runs against .ignored/audit-v2/ (scratch); findings land in audits/<date>/
```

`design-bracket/DESIGN-SYSTEM.md` is a **frozen snapshot** taken
2026-06-28, kept because it is the artifact that run produced. It is not
the live design system — that is `public/style-guide/DESIGN-SYSTEM.md`,
which has grown well past this copy. Read the snapshot as history; build
against the tracked one.

The two `schedule/` example sets are the **same feature run end-to-end**:
the Scope Workshop's output (`scope-workshop/examples/schedule/5-scope-document.md`)
is the Design Bracket's binding input
(`design-bracket/examples/schedule/0-scope-document.md` — the same file). So
the Schedule example shows the whole pipeline, scope through pixels.

## A note on paths inside these docs

The playbooks and examples were extracted from a real project (a small farm-
management app, "NFF Dashboard"). In-text references to `src/...`,
`.ignored/...`, real chore/place names, and "James" (the project owner) are
**historical context from that project**, not files in this bundle — they're
left intact so the examples stay concrete and honest about how each run
actually happened. The only paths that navigate *this bundle* are the
relative links between the two playbook files and their `examples/` folders.
