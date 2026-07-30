# Processes as event-anchored chore generators

Scoped plan (2026-06-28). Reframe owner: James. See memory
`project_chores_vs_projects_model` + `project_chore_generators_bug`.

## North star

**Chores = what the farm requires of us. Projects = what we curate to
fit the space that remains.** Everything a process emits, and every
routine lifecycle task, is a CHORE — schema-identical to a user-defined
chore, never a project-block item, never `block_id=null`.

A **process** is an event-anchored chore generator: it owns a set of
chore *templates*, each a full chore definition (title, chore block,
time window, default assignment, place, etc.) **plus** an `offset_days`
from the process's **anchoring event date**. Binding a process to a real
event instance instantiates schema-conformant chores with dates resolved
from the event date.

Two concrete processes (today's reality, to be unified):
- Broiler **processing** → chores anchored to the *processing-day* event.
  (Currently: process expansion — `src/lib/processes.js`,
  `useProcessRunner.js`.)
- Broiler **pasture/lifecycle** → chores anchored to the *chicks-delivery*
  event. (Currently MIS-modeled as an automation —
  `fire_batch_created_automations()` trigger + `AutomationsPanel`. To be
  RETIRED and rebuilt as a process.)

## Decisions locked

- Unify automations INTO the process model (retire the automation
  mechanism per no-legacy).
- The chore-template editing UI lives **inside the Process editor**,
  reusing the existing chore-CRUD field-set (one source of truth).
- Build the proper per-step config (not a morning-floor shortcut).
- **Phase 0 (2026-06-28):** `kind 'task' -> 'chore'` renamed now (data +
  enum + the two writers), not deferred. `block_id` is **soft** — FK
  `ON DELETE SET NULL`, no hard CHECK; never-null is guaranteed by the
  editor default + the Phase 1 expansion floor (James: hard checks fight
  drafts/deletes; the expansion floor is the real safety net).
  Animal anchors (`anchor_species_id`/`anchor_batch_id`), `frequency`,
  `category`, `period` are event-derived/computed — NOT step columns.

## Phases

### Phase 0 — Schema foundation (NEW additive migration — push auth)
**AUTHORED 2026-06-28: `supabase/migrations/0037_process_steps_chore_template.sql`
(+ writer edits in `pages/Processes.jsx`, `data/processSeeds.js`). Build
green. NOT pushed — awaiting James's push auth (backup → row-count →
push).**
- DONE — columns on `process_steps`: `block_id`, `last_chance_block_id`
  (FK chore_blocks, ON DELETE SET NULL), `start_time`, `deadline` jsonb,
  `assignment` jsonb, `anchor_type` (enum-checked), `anchor_kind_tag`,
  `place_id`, `at_place_id` (FK places). `offset_days`/`modifier_*` stay.
  `anchor_species_id`/`anchor_batch_id` intentionally OMITTED (event-
  derived). Decision: columns on `process_steps` (not a child table).
- DONE — `kind 'task' -> 'chore'`: existing rows renamed, enum tightened
  to `('chore','chore_modifier')`, default → 'chore'; both writers + the
  `taskStep`→`choreStep` helper updated.
- DONE — backfilled existing chore steps to the morning block (authoring
  default; guarded no-op if absent).
- DEFERRED to Phase 3 — retire automation generator (drop trigger
  `fire_batch_created_*` + fn), only after the pasture process exists.

### Phase 1 — Expansion rewrite (code) — DONE 2026-06-28 (commit
29669c3, build green, unit-verified AND live-verified end-to-end via a
marked prod test — real client runner emitted a block-correct chore,
exact-ID cleanup, baseline restored. NOT pushed to origin.)
- `splitSteps` carries the full chore template (block, time, deadline,
  assignment, place anchor) into each chore plan; `tasks`→`chores`.
- `processChoreRow` emits from the template: ALWAYS sets `block_id`
  (`chore.blockId ?? morningBlockId` floor), carries
  start_time/deadline/assignment/last_chance_block_id, computes
  `frequency.date` from `eventDate + offset_days`, dropped the hardcoded
  `period:"morning"`. New `resolveChoreAnchor`: step authors anchor
  *shape*, event supplies batch/species id; unauthored 'none' inherits
  the event's batch (pre-Phase-1 behavior). `useProcessRunner` resolves
  the batch's species_id + the morning block, passes them through.
- `useProcesses`: STEP_COLS/shapeStep/stepPatch carry the new columns;
  `createStep` default kind 'task'→'chore' + optional block_id seed.
- DEFERRED to Phase 3: move pasture/cleanout emission off the SQL
  trigger into a pasture process (one code path). Not touched here.

### Phase 2 — Process editor UI (code)
- Extract the chore-field editor out of `Chores.jsx` into a reusable
  `<ChoreFieldsEditor>` (title, block, time window, assignment, place,
  frequency). Embed it per step in the Process editor (`Processes.jsx`).
- Author the "broiler pasture" process + steps (Move to pasture, Brooder
  cleanout) with correct blocks/times, anchored to chicks-delivery.

### Phase 3 — Data migration / cleanup (push auth)
- Recreate the existing automation behavior as the pasture process
  (seed/insert). Migrate any automation config. Remove `AutomationsPanel`
  + automation tables/columns that are now dead (no-legacy).

### Phase 4 — Finish F30 (remove "Anytime" dead code)
- With generators fixed, delete every "Anytime" derivation/fallback:
  `deriveDay.js` (bucket 29-44, fold 114-156), `Schedule.jsx`
  (startKey fallback, isReal checks), `BlockBadge.jsx` "Anytime" label,
  `weekView.js`, `choreSeeds.js` anytime label.

## Already done (prereq)
- Deleted 39 invalid `block_id=null` chores from prod (backup
  `.backups/2026-06-28T09-40-33-338Z/`). Anytime bucket gone from live
  schedule. Generators NOT yet fixed → they can still re-emit invalid
  chores until Phase 1.

## Open / to confirm during build
- Exact chore fields a process step needs vs. what's event-derived
  (batch/species come from the bound event — not authored per step).
- Whether processing + pasture share one process "kind" abstraction.
