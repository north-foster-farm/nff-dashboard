# Example — the chores overhaul workshop (2026-05-06)

The **first run of the four-lens scope workshop**, and the reason the
method exists. It produced the chores overhaul that shipped as batches
7–12 (`82fe686` … `f40395f`), and its model decisions — sites as
first-class per-instance things, blocks as named time windows,
time-based rather than per-person accountability, "overrun" instead of
"DNF" — were recorded in `bfb8f8b` and still hold today.

Promoted out of `.ignored/` on 2026-07-30 during the housekeeping arc.
Kept because it is the only surviving record of **what an assembled
agent prompt actually looked like**. The playbook's §6 calls the lenses
"the heart of the method" and describes them in prose; nothing else in
`docs/` shows one written out.

## What's here

- `agent-prompts-lenses-1-2.md` — the scope-cutter and maximalist
  prompts, verbatim.
- `agent-prompts-lenses-3-4.md` — the UI-conventions and reframer
  prompts, verbatim.

Each of the four is a complete, self-contained prompt: a shared context
block (project facts, tone rules, an explicit source-material reading
list, and James's verbatim requirements dump) followed by that agent's
lens. The context is repeated in full per agent, which is what the
playbook means by "the only deliberate variable is the lens".

Compare with `../events/workshop-prompt.md`, run the same day: that one
uses a **single document** with the context stated once and the four
lenses listed at the end. Two assembly styles for the same method, five
hours apart — the compact form is easier to write, the repeated form is
what you actually paste into four parallel agents.

## Reading notes

- The four lenses here are scope-cutter, maximalist, UI-conventions and
  reframer. The playbook's canonical lens set came later and is wider;
  treat this as the ancestor, not the reference.
- The prompts cite files that have since moved or gone —
  `ChoreGroupsTab.jsx` and `useChoreGroups.js` were deleted when
  `chore_groups` was retired in batch 10 (`b37ed73`), and
  `Schedule.jsx` here means what 41.4 renamed `Calendar.jsx`.
- The verbatim requirements dump appears in both files, identically —
  it was embedded once per agent prompt.
- For what became of all this, see `docs/history/chores.md`.

## What is missing, and is not recoverable

These are the workshop's **inputs**. Its outputs — the four pitches, the
orchestrator's synthesis, and the reserve-lens commentary — are gone:

- `~/.claude/plans/` is **empty** (checked 2026-07-30). The files that
  m1 and m2 cite as this workshop's source of truth
  (`chores-overhaul-v2.md`, `events-overhaul-v1.md`) and the original
  22-batch requirements dump (`i-want-to-make-cozy-kitten.md`) no
  longer exist anywhere.
- Session transcripts only reach back to 2026-07-01, so a 2026-05-06
  workshop cannot be mined from them.

Partial recovery, for anyone chasing this later: the first revision of
`ROADMAP.md` (`git show 4a8ed2c:ROADMAP.md`, 394 lines) opens with a
"How this plan was formed" section and the full 22-batch plan as
reconstructed on 2026-05-05 — a summary of the lost dump, not the dump.
And `bfb8f8b` records the chores workshop's model decisions in its
commit body.

That is why these prompt files were promoted rather than deleted: they
are the only primary source left for the run.
