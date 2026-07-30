# Chores

The subsystem the dashboard exists for. Everything else — Schedule,
projects, places, metrics — was built either to feed chores or to
consume them. This chapter covers the chore model, time blocks, Rounds,
anchors, per-place completions, modifiers, assignment rules, the
2026-06-04 clean-slate rebuild, and the automations→processes collapse
(processes are event-anchored chore generators, so they live here).

Naming hazard, load-bearing throughout: **`batch 41` alone is the
chores rebuild** (`b0ff48f`); **`batch 41.N` is the Schedule feature**
(`e6668c0` onward). Same number, two unrelated features. And every
F-number below carries its audit date, because four independent
F1-based numbering universes exist (m4 §1e).

## Evolutions

**2026-05-03 — the organic seed set.** Chores began as a static JS
file: `bbcbd0b` shipped `src/data/choreSeeds.js` with 50-odd
definitions, frequency patterns, and a hardcoded processing-day
schedule; `0184cc9` gave completions a Supabase home (migration 0002 —
`chore_completions`, `activity_log`, `batch_assignments`) with
optimistic updates and realtime. The model was three periods
(morning/afternoon/evening), a `category` string for display grouping,
and clock-hour deadlines. It grew by accretion for three days and then
became "too tangled to keep extending" (ROADMAP.md:2887).

**2026-05-06 — the four-agent workshop, and the decisions that
still hold.** `bfb8f8b` slotted a chores overhaul as Batches 7–10
(later extended to 12), jumping the whole original queue on the
grounds that "chores + scheduling are the primary problem the
dashboard exists to solve" (ROADMAP.md:2887). Four decisions from that
day survived every subsequent rewrite (m2 §2026-05-06):

- **Sites are first-class and per-instance** — Brooder One and Mobile
  Brooder are different rows, shared across chores, observations,
  metrics, and pasture work. (Sites later collapsed into the recursive
  `places` tree in `acfd246`; see `places-and-farm-map.md`.)
- **Blocks, not clock times** — a chore belongs to a named daily
  window, and deadlines are expressed relative to blocks.
- **Accountability is about time, not people** — "Chores all must be
  finished, period … Accountability means we know when chores were
  started and finished within the designated block"
  (`.ignored/workshop-follow-up.txt`, quoted in m3). No leaderboards,
  no initials, no per-person splits; **"overrun" replaces "DNF"**
  (memory `feedback_chores_accountability`, m4 §2). This is the one
  design principle in the whole repo that lives only in memory and in
  shipped code — no tracked spec states it.
- **Modifiers land early, UI later** — the `chore_modifiers` table
  ships with the foundation but has no editor until Processes.

The full plan lived in `~/.claude/plans/chores-overhaul-v2.md`
(repo-external); the rejected ontologies were in
`.ignored/chores-overhaul*.txt`, flagged for deletion in m3 §56
because the model they debated has since been replaced twice. Also on
2026-05-06: the doing-surface was renamed from "Chore Doer" to
**Rounds** in `9aff149` — anyone reading old plans should read Doer as
Rounds (m2 §"Chore Doer").

**2026-05-07 — foundation, then Rounds.** `82fe686` (batch 7,
migration 0009, ROADMAP.md:259) built the two-level site model,
`chore_blocks` with sun-anchored start/end via SunCalc,
`chore_modifiers`, `chore_runs`, and site/location/block/sort_order on
`chore_definitions`. `1359516` (batch 8.1, ROADMAP.md:367) shipped the
**Rounds takeover**: `App.jsx` gains a `roundsOpen` state and the
entire chrome disappears — no TopBar, no Sidebar — because rounds are
done on a phone in a field. A run is one row per
`(block_id, run_date)`, materialized lazily by "Start rounds"; "done"
is derived from completions, never asserted; the sidebar entry becomes
a live countdown. The **"Anytime" bucket was born here** as the
null-block home — a decision that took the rest of the project's life
so far to undo. `afe3fc6` (8.2) added the quick-actions tray (Note /
Condition / Mortality) writing typed run events to `activity_log`
(migration 0010); `f55ae1c` (8.3) added Move + Sweep sheets; `b3f59d1`
(batch 9) turned those emissions into the Observations page.

**2026-05-07 — the first collapse.** `b37ed73` (batch 10,
ROADMAP.md:538) is the template for how this repo changes its mind: the
block model collapsed from start+end to **start + duration**;
`chore_groups` and `chore_group_members` were **dropped entirely**
along with their Groups tab, hook, preference column, and dnd-kit
reorder UI — a Batch 5 feature killed two days after shipping, because
block-driven partitioning made it redundant (m2 §2026-05-07, ~70 KB of
client JS with it). Move and Sweep left the tray; Sweep folded into the
main UI as `AllDoneButton`. Migrations 0008/0009/0010 were amended in
place, which was still legal pre-production.

**2026-05-07/08 — deadlines, telemetry, push, rules.** `14addbe`
(11.1) added the last-chance block, `choreDaysRemaining`, and
`ChoreRemainingPill`. `fab3e94` (11.2) shipped the Performance sub-tab
over `src/lib/runMetrics.js` — late-start rate, overrun rate, duration
quantiles, start-time histogram, all **block-level aggregates only**,
honoring the accountability stance (m1 §1.1). `2104ad2` (11.3) added
web push (migration 0011, VAPID, a `notify-run-done` Netlify
function). `f40395f` (batch 12, migration 0012, ROADMAP.md:794) closed
the umbrella with the assignment-rules engine: a day-of-week DSL,
chore- and block-scoped, resolved by `resolveAssignees` on an explicit
precedence ladder.

**2026-06-01 — anchors: "chores follow the animals."** The single most
important correction in the chapter. `f7df449` (batch 18.1, migration
0014 — the **first additive-only migration**, ROADMAP.md:1443) was
inserted mid-farm-map because the place-only model proved a rollout
blocker: chores were vanishing from Pasture B when the mobile coops and
their layers moved to Pasture C, "but those were never the *pasture's*
chores to begin with." The fix gives every chore an **anchor** —
`none` / `place` / `occupied_place` / `place_kind` / `species` /
`batch` — and derives *where the obligation appears* from it, with an
optional `anchor_kind_tag` housing filter and an `at_place_id` fixed
work place ("wash eggs" belongs to the layers but happens at the
House). A chore whose anchor resolves nowhere is **dormant**, not
broken. Migration 0040 later added `former_occupancy` for the inverse
case — brooder cleanout must fire on the brooders a batch *left*
(`cc72b04`).

Around it: `dd941ed` (16.1) moved completions to a **(chore, place,
date)** grain so one chore fans out into independently completable
obligations per occupied place; `547ca44` (16.2) put every write behind
an IndexedDB outbox so a tick in a dead zone survives an app kill;
`b21e892` (17) added the Now surface and the offline run lifecycle;
`0b4d003` fixed the "22 hours and climbing" Rounds bug with a
stale-run sweep, added Finish, and made runs multi-person (migration
0019).

**2026-06-01 — automations, and the production cutover.** `fd1cd2d`
(batch 19, migration 0015, ROADMAP.md:1597) put a rule engine in
Postgres so rules fire regardless of client: a broiler batch-lifecycle
rule (arrival + pasture-move + processing events, plus a brooder
cleanout chore), an edge-triggered feed-reorder rule, one-time `once`
chores, and `automation_emissions` provenance. **This commit declared
the linked DB live** — the amend-in-place era ends here.

**2026-06-01/02 — processes arrive, and start eating the
automations.** `e9ced07` (batch 23, migration 0018, ROADMAP.md:1837)
shipped processes — a template linked to event kinds that expands when
a matching occurrence enters its lookahead window — plus the
long-deferred modifier-conflict UI (priority-ordered winner, losers
rendered ghosted, tap-to-explain). `3cbd183` (27.4, migrations
0025 + 0026, ROADMAP.md:2297) then reshaped the batch-lifecycle rule so
a **pasture move is a chore, not an event**, and stopped auto-creating
processing events; 0026 is a deliberate prod-DML cleanup whose header
records a hard-won lesson — a `DO` block's DML silently no-ops under
the CLI migration role. `94d38fb` (27.5) moved the rules UI onto the
species and feed pages and retired the Heads-up lane; `6d4828c` (27.6)
left a parked tail, a prod cleanup sweep blocked on a stale pre-27.4
client.

**2026-06-04 — the clean-slate rebuild (batch 41).** James wrote
`docs/specs/nff-chores-spec.md` — a from-scratch redefinition of the
whole chore set: five blocks, an owner model where "chores belong to
the *animal or movable equipment*, not the pasture they occupy" (§2.2),
block-reference deadlines, `every_n` recurrence, checklists, three
event families (processing day, batch move to pasture, market/pop-up),
and three trigger kinds (event, batch attribute, **manual landmark**).
`docs/history/records/chores-rebuild-reconciliation.md` mapped spec to
schema and named the gaps honestly: deadlines were the "biggest
semantic gap" (hours-based vs block-reference), checklists didn't
exist, `every_n_months` was new, and manual landmarks had **no engine
foundation at all**. Four decisions locked with James that day
(reconciliation §8): slug-referenced deadline jsonb; checklists reuse
the project-checklist pattern; generalized `every_n_{unit}`;
`cold_storage` as a place under the house. Landmarks went **on hold**;
history was declared disposable.

`b0ff48f` (batch 41, ROADMAP.md:2826) executed it — `choreSeeds.js`
rebuilt to 38-then-48 recurring chores, `chores.js` taught the new
frequency and deadline vocab, `processSeeds.js` adding two event
processes — via a **soft, reversible cutover on the live DB**
(`scripts/chores-cutover.mjs`): backup, create Cold storage, renumber
`chore_blocks.sort_order` chronologically (Late Afternoon had been
sorting before Mid-Morning), `retired_at` on 76 old definitions,
insert the new set. Plan: A→B→C→**James verifies**→D (hard delete).
`6d08edb` captured the verification as F133–F138 (06-04 audit) —
"seems to be working pretty well" — and `3a0477a` / `bde196c` /
`fce874b` / `06e2420` fixed four. **Phase D never ran.**

**2026-06-05 — the collapse that was decided and never built.**
`.ignored/chores-design-critique/` argued that a chore conflates
what/when/where, one-chore-per-block being the root cause, and drafted
`0030_chore_activities.sql` to collapse the five feeder rows into one
activity with a block dimension. James's **no-legacy rule** killed the
migration path (memory `feedback_no_legacy_paths`: fold old in and
DELETE it, never a dual-source shim), pivoting to a view/editor
collapse over `chore_definitions`. m3 §379 marks all four files for
deletion; the acceptance criteria and the domain hazard it surfaced
survive only in memory `project_chores_collapse_decision` — because
`mod-proc-no-feed` must spare the morning feed while suppressing the
later three, **the five feeder rows *are* the block dimension** and
cannot be collapsed naively. **Never started.**

**2026-06-24/26 — runs leave their own table.** The Schedule feature
(batch 41.**1**, `e6668c0`) generalized `chore_runs` into a
`commitments` superset with a `source_type` discriminator; `b4c217d`
(41.28, migration 0036) then **dropped `chore_runs` and the
`timeline_items` view** — the only schema drop in the project, applied
to prod 2026-06-26 with an orphan check of 0. Rounds now reads
`commitments` where `source_type = 'chore_block'`. In the same window
the paused rebuild migration was renumbered 0029→0030→0031→0032→**0033**
as Schedule migrations landed (m1 §5). `e474993` was a rounds and
quick-log polish pass off a chores design critique (R1–R8, D2), with
the model/collapse work explicitly deferred.

**2026-06-28 — the automations→processes collapse (Phases 0–4).**
F30 (06-28 audit) reported a junk "Anytime" bucket in the Schedule.
Root cause: chore generators were emitting `block_id = NULL` chores —
39 invalid rows had to be deleted from prod before the fix could even
be verified (`docs/history/records/processes-as-chore-generators-plan.md`
§"Already done"). The plan's north star is now the canonical model
statement for the whole app: **"Chores = what the farm requires of us.
Projects = what we curate to fit the space that remains"** — and *a
process is an event-anchored chore generator*, whose emissions are
schema-identical to hand-authored chores. Five commits, all
2026-06-28:

- `3ec1e63` Phase 0 — migration 0037 gives `process_steps` the full
  chore template (block, last-chance block, start time, deadline,
  assignment, anchor shape, places) and renames `kind 'task'` →
  `'chore'`, closing F85 (06-04 audit). `block_id` is deliberately
  **soft** (FK `ON DELETE SET NULL`, no CHECK): "hard checks fight
  drafts/deletes; the expansion floor is the real safety net."
- `29669c3` Phase 1 — expansion emits from the template and *always*
  sets a block, flooring to morning. `resolveChoreAnchor` splits
  authorship: the step authors the anchor **shape**, the bound event
  supplies the concrete batch/species id.
- `13c32a6` Phase 2 — `ChoreFieldsEditor` extracted from `Chores.jsx`
  so step editor and chore editor share one field-set.
- `ba8849a` Phase 3 — migration 0038 (on prod) trims the
  batch-created trigger to **arrival-event-only**; lifecycle chores
  now come from a "Broiler pasture (lifecycle)" process. Two
  deviations from the written plan: the trigger *keeps* arrival-event
  creation, and the `automations` table survives because feed reorder
  still uses it (m4 §2, memory `project_chore_generators_bug`).
- `1d1ad4a` Phase 4 — "Anytime" retired as a chore choice, dead
  `CHORE_PERIODS` deleted. The Schedule's `anytime` bucket was
  deliberately **kept**: it turned out to be live orphan-tolerance for
  deltas, not dead code.

`5df5ed2` then made the global `sort_order` rank authoritative
everywhere a chore appears (F49, 06-28 audit), applied *inside* each
place group so an activity lands in the same position at every place it
fans out to.

**2026-07-02 — species scoping, and a rename refused.** `5bdf362`
(42.16, migration 0049) scoped processes to a species so broiler and
layer lifecycles can't cross-fire on the shared `batch_milestones`
event kind; `bd41834` (42.17, migration 0050) added the layer
lifecycle process. `da2f414` (42.19) closed F20 and **retired F26**
(both 07-02 audit): renaming Automations to Processes was rejected
because they are genuinely distinct subsystems — keep both terms.
The same week, `08c523d`…`bdf8aaf` made a green vitest suite a
pre-commit requirement; the chores layer now carries 235 unit tests
(115 `chores.test.js`, 50 `processes.test.js`, 39 `runMetrics.test.js`,
31 `modifiers.test.js`).

## Current state

Verified 2026-07-29 against `src/`, `supabase/migrations/`, and
read-only prod queries via `scripts/prod-read.sh`.

**Schema (prod).** `chore_definitions` (block-reference `deadline`
jsonb, anchor columns, `sort_order`, `retired_at`), `chore_blocks`
(five rows, **slug present and populated**), `chore_modifiers`,
`chore_assignment_rules`, `chore_completions` at (chore, place, date),
`chore_run_participants`, `chore_messages`, `chore_checklist_items`
(exists, **empty**), `processes` / `process_steps` /
`process_event_kind_links` / `process_expansions`, and `automations` /
`automation_emissions`. Runs live in `commitments`
(`source_type = 'chore_block'`) — `chore_runs` is gone (0036).

**Finding: migration 0033 IS applied.** The dossiers flag
`0033_chores_rebuild_foundation` as authored-but-never-pushed (m1 §3,
ROADMAP.md:2826 "authored but not pushed"). Prod disagrees:
`chore_blocks.slug` is populated with the spec's BlockEnum and
`chore_checklist_items` exists. Migration **0040** is likewise applied
— prod accepts `anchor_type = 'former_occupancy'` on both
`chore_definitions` and `process_steps`, and one live row of each uses
it. Treat both as applied; the roadmap and m1 need correcting.

**Blocks.** Five, chronological `sort_order` 1–5, named on prod
**Sunrise** (sunrise +120m), Mid-Morning (10:00 +30m), Early Afternoon
(13:00 +60m), Late Afternoon (16:00 +60m), **Sunset** (sunset +30m).
Note the drift: the reconciliation recorded them as "Morning" and "End
of Day" (records §4); the slugs (`morning`, `end_of_day`) are the
rename-proof key, which is exactly why they exist.

**Definitions.** 56 active: the **48 spec recurring chores** (`m-*`,
`mm-*`, `ea-*`, `la-*`, `eod-*` — the staged feed/water fill-out
insert did land) plus 8 live process-emitted one-time chores. **Zero
active chores with a null `block_id`** — F30 (06-28 audit) is closed
at the data level. Deadlines are block-reference jsonb in production
(`following_block`, `block`, `block_on_weekday`). **55 pre-rebuild
definitions are still sitting soft-retired** with
`retired_at = 2026-06-04T19:57:48Z`.

**Engine.** `src/lib/chores.js` (1,005 lines) owns frequency firing
(`isChoreActiveOn`, including `every_n` anchored to the epoch),
deadline resolution (`computeDeadline` → `resolveBlockDeadline`),
assignee precedence (`resolveAssignees`), the days-remaining pill, and
`obligationPlaceIds` / `choreIsDormant` / `describeChoreAnchor` — the
anchor→places resolver every surface shares. `src/lib/modifiers.js`
resolves modifier conflicts deterministically (priority desc, then
newest); `src/lib/processes.js` plans expansions, splits steps into
chore plans and modifier rows, and builds the emitted
`chore_definitions` row; `src/lib/runMetrics.js` computes the
block-level run aggregates.

**Surfaces.** `pages/Chores.jsx` (Today / All chores / Blocks /
Performance / Activity log), `pages/Rounds.jsx` (outbox-backed
takeover), `pages/Processes.jsx`, `pages/Observations.jsx`, plus
`ChoreFieldsEditor` (the shared chore/step field-set),
`ChoresBlocksTab`, `ChoresPerformanceTab` (explicitly "no per-user
splits, no predictive nudges, no reason prompts — just data"),
`AssignmentRulesEditor`, `ChoreCheckRow`, `ChoreRemainingPill`,
`BlockBadge`, `ModifierBadge`, `QuickActionsTray`. Hooks:
`useChoreDefinitions` / `Blocks` / `Completions` / `Runs` /
`Modifiers` / `AssignmentRules` / `Messages` / `Lookup`,
`useRunHistory`, `useRunEvents`, `useProcesses`, `useProcessRunner`,
`useAutomations`.

**Finding: the rebuild's process cutover was never completed.** The
reconciliation's explicit verification step 3 was "enable *Broiler
processing day* + *Farmers market / pop-up* and **disable** legacy
*Processing day prep*" (records §"FOR JAMES"). On prod today, nearly
two months later: `Processing day prep` is `is_active = true`;
`Broiler processing day` and `Farmers market / pop-up` are both
`is_active = false`. Consequences, all live:

- The spec's processing and market chores (`proc-*`, `mkt-*`) never
  materialize. The processing chores that *do* appear ("Confirm
  processor appointment", "Check trailer hitch and tires") come from
  the pre-rebuild process and are not in the spec.
- The legacy process's one modifier step targets `ct_fill_feeders_pm`
  — a **retired** pre-rebuild chore id — with action `replace`. Four
  such `chore_modifiers` rows exist on prod (2026-08-03, 08-24,
  09-07), all pointing at a chore that no longer renders. **The
  pre-processing feed withhold is not working in production.** The
  correct spec steps (`skip` on `mm-`/`la-`/`eod-tractor-feed`) exist
  — on the disabled process.
- This is almost certainly the substance behind "Phase 3: verify
  processes end-to-end (F26/F29 — James has low faith they work)"
  (m4 §"Batch 42 / current arc" item 10).

**Finding: per-step config has schema but no data.** Migration 0037
gave steps `block_id`, `start_time`, `deadline`, `assignment`,
`last_chance_block_id` precisely so the build would be "the proper
per-step config (not a morning-floor shortcut)" (records, Decisions
locked). On prod, **all 19 chore-kind steps sit in the morning block
with `start_time`, `deadline`, `assignment`, and
`last_chance_block_id` all null** — the Phase 0 authoring-default
backfill was never revised, so the spec's late-afternoon staging,
early-afternoon pressure-washing, and the 3:00–5:30 AM
`proc-load-crates` window are all unexpressed.

**Finding: `AutomationsPanel` still ships**, mounted on `Feeds.jsx`
and `SpeciesPage.jsx`, with `useAutomations` reading the `automations`
table — even though the generators plan's Phase 3 said to remove both
"(no-legacy)". The deviation is deliberate (feed reorder is genuinely
an automation, and F26's rename was retired in `da2f414` because the
subsystems are distinct); the plan text was just never updated.

**Finding: legacy engine paths survive the no-legacy rule.**
`chores.js` still carries the pre-rebuild vocabulary — `period` /
`category`, the `specific_days` / `weekly_window` /
`monthly_last_week_window` frequencies, `offset_hours` /
`end_of_week_friday` deadlines, `getEarliestChoreInPeriod` +
`inPeriodWindow`, `CHORE_CATEGORIES`, and the
`isAnytime = !chore.blockId` branch of `choreDaysRemaining`. No active
prod row uses any of it; the rebuild kept them for back-compat
(ROADMAP.md:2846) and the 55 soft-retired rows are the only possible
consumer, so Phase D would turn all of it into deletable dead code.

## Unresolved threads

1. **Enable the spec's processes; disable `Processing day prep`.**
   The highest-value item in the chapter and probably a one-hour job:
   flip three `is_active` flags, re-point or delete the four orphaned
   `chore_modifiers` rows targeting `ct_fill_feeders_pm`, and confirm
   the feed withhold fires against `mm-`/`la-`/`eod-tractor-feed`.
   Until this happens the processing-day chore set on prod is the
   pre-rebuild one and the feed withhold is silently broken.
2. **Author real per-step blocks and time windows on process steps.**
   All 19 chore-kind steps are on the morning default. Needs the spec
   §5–§6 blocks, the `proc-load-crates` 3:00–5:30 window, and
   `proc-pickup`'s `block_on_weekday` Friday deadline.
3. **Chores rebuild Phase D — hard delete.** 55 pre-rebuild
   definitions still soft-retired since 2026-06-04, plus the
   disposable history (`chore_completions`, `chore_run_participants`,
   `chore_messages`, stale `chore_assignment_rules`). Backup-gated,
   exact-id, needs explicit authorization. Completing it also unblocks
   deleting the legacy engine paths in `chores.js`.
4. **Manual landmarks (six chores, still deferred).**
   `returned_from_processor` / `returned_from_market` need three
   engine capabilities that do not exist: a landmark trigger, a
   trigger-time override, and immediate creation. The six chores are
   captured in `choreSeeds.js` → `DEFERRED_LANDMARK_CHORES` but not
   seeded. Spec §5.4, §6.3, §7. Note these are the chores that close
   the processing and market loops into **inventory**
   (`proc-log-inventory`, `mkt-return-inventory`).
5. **Checklists are schema-only.** `chore_checklist_items` exists and
   is empty; the market load-out checklist rides in a process step's
   `body_md` as a stopgap (records §B2). One user so far
   (`mkt-load-vehicle`, 17 items).
6. **F69 (06-04 audit) — `batch-clean-brooders` trigger
   reconciliation.** The spec wants midmorning on a manually-set
   `move_to_pasture_date`; the shipped pasture process fires at
   arrival + 21/22 days. Never reconciled. Related: the spec also asks
   for a standing reminder when `move_to_pasture_date` is unset — not
   built.
7. **Chores collapse (multi-block WHEN).** Decided 2026-06-24, never
   started; the `0030_chore_activities` route was rejected, the
   surviving direction is a view/editor collapse over
   `chore_definitions` (memory `project_chores_collapse_decision`).
   Mind the feeder-row hazard above.
8. **F135 / F138 (06-04 audit) — Rounds single-actor
   start/stop/cancel rework.** Declared "next" on 2026-06-04, never
   confirmed done; later Rounds changes shipped in batch 42 but no
   record says the full rework landed (m4 §1c, flagged VERIFY).
9. **Chore-generators live-verify on the next real broiler batch** —
   Phases 0–4 were verified with a marked prod test row, not a real
   arrival (memory `project_chore_generators_bug`).
10. **The accountability principle is memory-only.** "Time, not
    people; overrun, not DNF" governs `runMetrics.js` and
    `ChoresPerformanceTab` but appears in no tracked spec. It should
    land in the design/voice docs before someone well-meaningly adds a
    per-person chart.
11. **F74 (06-04 audit) — the "whole farm" chore concept** is an open
    design call; `anchor_type = 'none'` renders as "Whole farm" with no
    considered surface behind it.
12. **Untriaged audit backlog.** The 06-04 audit's Chores clusters
    F65–F74 / F75–F83 and Processes cluster F84–F93 were never
    systematically triaged; the 06-28 round (F1–F80) is untriaged
    wholesale. m4 §1c warns the checkbox ledger in
    `audits/2026-06-04/findings.md` is not a reliable open/closed
    signal.

## E-commerce relevance

Real but narrow — chores are where physical product enters the
commerce system, and two of those handoffs are currently missing.

- **The inventory-creation chores are the deferred ones.** Spec §5.4
  covers a processing run with `proc-sort-freezers` +
  `proc-log-inventory` — "together cover creating inventory lots from a
  processing run; no separate lot-creation chore is needed" (spec
  §9.7). Both are landmark-triggered, so both sit in the deferred set
  (thread 4), as does `mkt-return-inventory` (unsold product back into
  stock). Until landmarks exist, **nothing in the chore layer prompts
  anyone to create the inventory lots an online catalog would sell
  from.**
- **The market/pop-up process is the fulfillment runbook, and it is
  disabled on prod** (thread 1). `mkt-prep-preorders` at −3 days is
  the hook a preorder or online-order flow fires into; the
  `mkt-load-vehicle` checklist (17 items, currently living in a
  markdown step body) is the pack-out list.
- **Egg packing already touches inventory.**
  `eod-add-cartons-inventory` is a live daily chore whose whole job is
  adding cartons to inventory, by hand. Anything automating or
  verifying egg stock should treat it as the existing integration
  point, not invent a new one.
- **Modeling lesson worth inheriting.** Anchors ("obligations follow
  the owner, not the place") and block-reference deadlines are both
  cases where a slug-keyed, rename-proof reference replaced a uuid or
  a display name — and it paid off: the blocks were renamed
  Morning→Sunrise *after* the slugs landed and nothing broke. Order and
  product identifiers deserve the same treatment.
- **No pricing, POS, or catalog dependency runs through chores** — no
  chore reads or writes `products`, `product_prices`, `orders`, or
  `product_sales`.
