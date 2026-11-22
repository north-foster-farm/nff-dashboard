# Projects

The governing model, stated plainly in the processes-as-generators plan
(`docs/history/records/processes-as-chore-generators-plan.md:8`):
**chores are what the farm requires of us; projects are what we curate
to fit the space that remains.** Every pivot in this chapter is an
attempt to make that second half literal — to let a ranked list of
projects decide what fills the day's non-chore, non-event gaps — and
the arc ends with that ambition deliberately abandoned in favour of a
one-click manual quick-add.

## Evolutions

**2026-05-04 — the flat stub.** `projects` arrives in the first
reference-data migration (`0006_threads_orders_updates_projects.sql`,
`4a23921`) as one of four "schema only, empty at launch" tables. Its
header records the whole intent: "Multi-step initiatives.
Overview.jsx filters by `status === "in_progress"`. Stub schema —
fields chosen to support a future Kanban-style board if that
materializes, without forcing it." A title, a status string, dates.
That status column is the original sin of this chapter: it never
leaves. The rewrite was Batch 6 in the original 22-batch plan (m2 §1
Era 0, `4a8ed2c`), pushed to 7 by the in-app roadmap page (`12b40c1`),
to 11 by the chores overhaul (`bfb8f8b`), and finally to **22**
(m2 §3) — so "Batch 6 projects" is pre-`bfb8f8b` vocabulary.

**2026-06-01 — Batch 22 ships the hierarchy** (`8515eb7`,
v0.10.19-alpha). `0017_projects_subsystem.sql` extends the stub
additively and adds seven tables: `project_phases`, `project_steps`,
`project_checklists`, `project_checklist_items`, `project_links`,
`project_dependencies`, `project_attachments`, plus the `project-files`
Storage bucket (policies created only when the migration owns
`storage.objects`, else a notice to add them via the Dashboard). Two
commitments worth keeping: the **completeness rule is computed, never
stored** — phases > 1 → milestones drive the percentage, phases == 1 →
steps do (`0017` header; `src/lib/projects.js:96`) — and the dependency
graph stores only "X blocks Y" edges, with the date-shuffle math in
pure client code (`ROADMAP.md:1784`). Links were modelled for four
target kinds; the picker shipped events + chores only
(`ROADMAP.md:1831`).

**2026-06-01 → 06-02 — projects as process output, then not.** The
processes engine (`0018`) expanded an event into a project — one phase,
one step per task — with provenance on `projects.process_expansion_id`
(`ROADMAP.md:1858`). The automations rework reversed that a day later:
expansions emit **chores** (`0025`, `3cbd183`), and
`0026_cleanup_prep_projects.sql` deleted the prep projects already on
prod. Two legacy project-based expansions survive there
(`ROADMAP.md:4616`).

**2026-06-03 — the feature handoff names the real rework.**
`87a5178` folds James's verbatim capture
(`docs/handoffs/2026-06-03-feature-handoff.md`) into the roadmap as a
standing section. Its Projects entry (`ROADMAP.md:5034`) is the vision
statement this chapter turns on: a **single forced-ranked list** with
no plural priority flags, where the top is *the* focus and working on
anything else should be "painful by design"; **dates as light-touch
metadata, never fed into scheduling** (durations are unknowable under
constant context-switching); **lock-to-date** as the only escape
hatch, at any level, with the schedule flowing around it;
**tandem work possible but not the happy path**; a **~30s debounced
reflow** plus a manual button; and a **stale indicator** so the view
"never silently rearranges — the user deliberately syncs."
Explicitly rejected in the same capture: a Templates folder (clone
from a stub instead) and time tracking (`ROADMAP.md:5097`).

**2026-06-04 — the walkthrough audit puts the old page on tape.**
Clips 10–11 produced F84–F111 (06-04 audit,
`audits/2026-06-04/findings.md`), the deepest single critique the
feature has had. The headline is **F96** (06-04 audit): the manual
status dropdown read "In progress" while the date-derived box below
read "Not started" — two notions of status disagreeing on screen.
**F106** rejects event links outright ("projects and events are
orthogonally separate") and asks for chores plus farm assets instead;
**F108** asks where attachments even go; **F111** wants completion to
roll up. m4 §1c is emphatic that this file's checkboxes are not a live
bug list — most were superseded by later arcs, not fixed one by one.

**2026-06-25 → 06-26 — the Schedule grows project surface first.**
Note the hazard: `batch 41` alone is the chores rebuild; **`41.N` is
the Schedule feature.** 41.14 (`7675ca3`) made an incomplete step of
an active project a schedulable "node" written as a `project_node`
commitment. 41.33 (`99fc42c`) went further and **auto-pulled**:
`nextProjectStep(projects, todayISO)` put the top active project's
next step in the day's *first* project gap, derived live and never
written on open (`ROADMAP.md:3886`). Ancestor of the reflow engine —
but it ranked by `sort_order` filtered through the old status/date
predicate; the ranked queue did not exist yet.

**2026-06-30 — the forced rank lands** (`c911ea4`, migration `0041`
applied to prod the same day, `385ff81`, lossless — the three existing
projects defaulted to `queue_state='ranked'`). `0041` adds
`queue_state` ('ranked' | 'unprioritized'), `timing_note`, and
`locked_date` at four levels (project / phase / step / checklist
item), plus a partial `projects_ranked_idx`. Its header is unusually
candid about the compromise: "No column is dropped: status stays
physically for now (the app stops treating it as priority; a later
cleanup migration may retire it once nothing reads it)."
`Projects.jsx` was rewritten around a dnd-kit ranked list with a
Focus accent edge on #1 and an Unprioritized bucket that "explicitly
replaces any On Hold concept"; status pills and filters disappeared
from the list page.

**2026-06-30 — the reflow engine, slices 1–7.** The design doc
(`docs/specs/scheduling-engine-design.md:16`–`:29`) resolved the one
load-bearing question first: because the schedule is **live-derived,
never persisted**, staleness needs **no schema** — it is derived by
comparing committed placements against what a fresh plan of the
current ranking would produce. Slices then shipped in a single day:
`f4b046e` (pure planner), `d0c43d4` (`reconcilePlan`),
`f890cb2` (delta bridge), `a94cf81` (hook + stale strip), `f3a8f7b`
(30s debounced auto-reflow), `b91fa59` (Now shows the top project),
`ecef8b7` (retire the 41.33 first-gap auto-pull, NO-LEGACY),
`28c4574` (lock-to-date honoured), `dc62fab` (conflict-aware gaps),
`a098999` (step-level lock UI). Placements wrote as `origin:"auto"`
`commitments` deltas so reflow replaced only its own work and left
manual swaps alone.

**2026-07-01 — mounted, then found leaky.** `8cbe932` fixed F59/F60
(07-01 audit): the engine only ran while the Projects page was
mounted, so the schedule could read "nothing planned" indefinitely.
Rounds 3 and 4 then exposed genuinely hard distributed bugs
(`ROADMAP.md:4132`, `:4142`): removing a placed step had to
**tombstone** the delta or reflow resurrected it; two devices whose
debounce timers reset on the same realtime events inserted the same
(step, gap) pair under different uuids, and `reconcilePlan` treated
duplicate keys as in-plan, so the duplicate never healed while
`stale` stayed true forever; and worse, `syncNow` used the
user-facing tombstoning removal for its *own* moves, excluding the
step from the very plan that was moving it. Each was root-caused and
fixed — dedupe by placement key keeping the lexically smallest id,
plus a non-tombstoning `hardRemove`.

**2026-07-02 — the pivot: auto-seeding is retired entirely.** Batch
42.4 (`54dc41b`, v0.10.81-alpha) records the decision in James's own
words: **"auto seeding is actually not the right thing"**
(`ROADMAP.md:4288`). `useScheduleReflow` and `reflowBridge.js` were
deleted; `reflow.js` was cut back to the ranked queue plus a new
`nextRankedStep`; the Projects page lost the stale strip and the
auto-sync toggle. What replaced it is one button: every project block
offers **"Add next task — <step>"**, the next highest-priority ranked
step not already on the day, and the "+ Add" menu quick-adds the same
into the anchored gap. Project step rows also became movable between
gaps (`ScheduleEditSheet` `gapTargets`, time-routed). The forced rank
survived; the machine that acted on it did not.

**2026-07-02 — live HTML docs** (42.8, `828088c`, migration `0045`).
An attached `.html` file opens as a working page in a sandboxed iframe
with its `localStorage` swapped for database-backed, realtime-synced
storage (`attachment_doc_data`, per-key rows so two editors can't
clobber each other; `attachment_doc_locks`, 90s stale-claimable
heartbeat). Project-shaped because attachments hang off projects and
steps — and the driving use case was the **pricing worksheet**
(`ROADMAP.md:4477`, m1 §4). `0045` also added
`project_attachments.phase_id`, "schema-ready; phase UI later".

**2026-07-02 — the URL slice** (42.10, `8d1d69c`, migration `0047`):
phase drag-reorder (`reorderPhases` existed unwired); project→project
links riding the unconstrained `project_links.target_kind`; immutable
`projects.slug` derived once by `src/lib/slug.js` and SQL-backfilled,
with the router resolving slug **or** uuid and canonicalizing;
attachment deep links `/projects/<slug>/files/<attachmentId>`; a
copy-URL button on every attachment row.

## Current state

Verified against `src/` and `supabase/migrations/` on `main` at
`063ffb7`.

**Schema.** The 0017 eight-table hierarchy, unchanged; `0041`'s
`queue_state` / `timing_note` / `locked_date`; `0047`'s `slug`;
`0045`'s doc-data pair. No projects table has ever been dropped.

**Pure lib.** `src/lib/projects.js` (220 lines) holds the completeness
rule (`progressOf`, `phaseDone`, `stepDone`, `checklistRollup`), the
dependency date-shuffle (`transitiveDependents`,
`computeDependentShifts`), `formatDateRange` — and, still, the
pre-rework `isActiveProject` / `nextProjectStep` /
`nextProjectStepFor`. `src/lib/schedule/reflow.js` is down to **67
lines**: `rankedActiveProjects`, `rankedStepQueue`, `nextRankedStep`,
and a comment block naming what was deleted (`reflowPlan`,
`placementKey`, `planSignature`, `isStale`, `reconcilePlan`, the hook,
the bridge). `src/lib/slug.js` and `src/lib/docdata/liveDoc.js`
complete the pure surface; `projects` / `reflow` / `slug` tests are 71
cases, green.

**Data layer.** `src/lib/data/useProjects.js` (851 lines) exposes
`useProjects` (list: `reorderProjects` writing the total order onto
`sort_order`, `setQueueState`, `setProjectLocked`, `setTimingNote`,
`createProject`, `createProjectTree`, archive/unarchive) and
`useProject` (detail: full CRUD across phases, steps, checklists,
items, links, dependencies, attachments). New projects join the
**tail** of the ranked list via `rankedTailSort()` and get a slug from
`slugify(title, takenSlugs())`. `useReferenceData.loadProjects`
hydrates each project's steps app-wide with `queueState` and
`lockedDate`.

**UI.** `Projects.jsx` (ranked list + Unprioritized bucket + Done +
Archived tabs; per-card lock control and timing note),
`ProjectPage.jsx` (1,010 lines: inline-editable title/description/
body, drag-reorderable phases, step rows with a lock control, links,
attachments, delete confirm), `ProjectStepModal.jsx`,
`ProjectBits.jsx` (`AttachmentsBlock`, `EditableText`,
`AssigneeChips`), `LiveDocViewer.jsx` + `useDocData.js`. Consumers:
`Now.jsx` (top ranked project's next step), `Schedule.jsx` (quick-add
via `nextRankedStep`, `placedStepIds` excluded), `Overview.jsx` and
`sections.jsx` (active-project counts), `Proposals.jsx` (approved MCP
proposal → `createProjectTree`), `Inbox.jsx` (promote a thought).

**Where the code contradicts the dossiers.**

- The dossiers and memory (`project_projects_rework`) read as
  "engine slices 1–7 shipped, remaining work = widen the horizon."
  The code shows the **planner itself is gone**, not merely unwired:
  lock-honouring, conflict-aware gap-skipping, `reconcilePlan` and
  derived staleness were all deleted at `54dc41b`. `ROADMAP.md:5044`
  is stale in the opposite direction — it still says slice 1 is "not
  yet wired in" and slices 2–7 are deferred.
- **Two project-activity models coexist.** The rework was declared
  no-legacy, but `isActiveProject` — the *status-and-dates* predicate
  (`projects.js:24`) — is still the filter for `deriveDay.js:114`,
  `Schedule.jsx:934` (the searchable project nodes), `Overview.jsx`
  (two call sites) and the sidebar count (`sections.jsx:93`). The
  ranked model (`queue_state`) governs only the Projects page, Now,
  and the quick-add. A project can therefore be #1 in the forced rank
  and invisible to the Schedule because its `target_date` has passed.
- **Lock-to-date is scheduling-inert.** It is settable at project and
  step level and rendered as a badge, and `rankedStepQueue` still
  computes an effective `lockedDate` per node — but no consumer reads
  that field, because the code that did (`reflowPlan`) is deleted.
  The handoff's "the schedule flows around locked items" is currently
  false.
- **`project_attachments.phase_id` is dead.** `0045` added it;
  `ATTACH_COLS`, `shapeAttachment` and `uploadAttachment`
  (`useProjects.js:45`, `:165`, `:774`) never select, shape, or write
  it, and the deep-link lookup searches project- and step-level
  attachments only.
- **`Inbox.jsx:231` bypasses the rework.** `promoteToProject` inserts
  straight into `projects` with `status: "planned"`, **no slug, no
  `queue_state`, no `sort_order`** — so a promoted thought gets a
  uuid-only URL forever (the 0047 backfill was one-time), writes the
  column the rework stopped writing, and lands at `sort_order` 0,
  i.e. **displacing the Focus project**. The roadmap says promoted
  thoughts should land in the Unprioritized bucket
  (`ROADMAP.md:5093`); they land at the top of the ranked list.
- **Retired-engine residue in the delta layer.** `useScheduleDeltas`
  still filters `source_ref.origin === "removed"` tombstone rows
  (`:105`–`:112`) and still threads `origin: "auto"` (`:174`), both
  explicitly annotated as leftovers of the retired engine. Stale
  comments point at deleted code in `useReferenceData.js:689`
  ("auto-pull the next one (nextProjectStep)") and `:715` ("so the
  Schedule can run the reflow engine").
- `nextProjectStep` / `nextProjectStepFor` have **no app callers** —
  only their own tests. Dead code with live tests.

## Unresolved threads

- **Decide what the forced rank is *for*, now that nothing acts on
  it.** Post-42.4 the ranking drives one button and one Now card.
  Either it earns back scheduling authority in some non-auto-seeding
  form (a "plan my day" action the user invokes?), or the ranking is
  honestly demoted to a focus list. Roadmap v2 should not carry the
  old engine language forward unresolved.
- **Collapse the two activity models.** Retire `isActiveProject` in
  favour of `queue_state` + `completed_at` + `archived_at` across
  `deriveDay`, `Schedule`, `Overview`, `sections`; then drop the
  vestigial `status` column and the `ProjectPage` status `<select>`
  (`ProjectPage.jsx:113`, `:154`). This also closes **F96** (06-04
  audit), which is still literally true on the detail page.
- **Lock-to-date: honour it or remove it.** Currently a settable
  no-op. Deferred siblings from the design doc: phase- and
  checklist-item-level lock UI, and `effectiveLock = step ?? phase ??
  project` precedence in the queue (needs phase hydration).
- **Fix `Inbox.jsx` promote-to-project** to go through
  `createProject({ queueState: "unprioritized" })` so it gets a slug,
  a bucket, and a tail rank. Small, and it is corrupting the rank
  order today.
- **Wire or drop `project_attachments.phase_id`** — the phase-level
  attachment UI named as 42.8's known follow-up
  (`ROADMAP.md:4501`).
- **Clean the retired-engine residue**, in code and on prod: the
  tombstone filter, the `origin` tag, the stale comments, and the
  `origin:'removed'` / `origin:'auto'` `commitments` rows themselves
  (this is the "prod cleanup sweep for project-shaped rows" that
  memory has carried as pending). No-legacy says these should not
  have survived the pivot.
- **Never-built handoff scope:** clone-from-stub for repeatable
  projects (`ROADMAP.md:5099`; Templates explicitly rejected, time
  tracking explicitly out); "just a thought" quick-convert to
  Project / Chore / Event (`:5109`).
- **Links are still half-modelled — F106** (06-04 audit). James asked
  for links to chores *and farm assets* (batches, places, equipment,
  products, orders, feed, customers, suppliers, machinery) and asked
  for events **not** to be linkable. Today `LINK_KINDS` is exactly
  `event_series`, `chore`, `project` (`ProjectPage.jsx:825`), so the
  one kind he rejected is still first in the list. **F107** (search-
  first picker; links need behaviour) is untouched — a link is inert.
- **F111** (06-04 audit) completion roll-up: no cascade exists
  (`setStepDone` / `toggleChecklistItem` write one row). Note the
  tension with the standing "no implicit mutation of committed data"
  rule — an auto-complete cascade is a write the user didn't ask for.
  Decide deliberately rather than by default.
- **The multi-device concurrency lesson is banked** (Roadmap v2 0.12).
  The duplicate-placement and tombstone/move bugs were root-caused in
  code that no longer exists; both, and the deterministic-survivor
  mitigation, now live in `docs/history/platform-and-infra.md` under
  2026-07-02 and in that chapter's Current state. Still open here is
  only the project-side consequence: any future feature where two
  devices write derived rows off the same trigger must pick its
  survivor rule deliberately.
- **Horizon, if scheduling ever returns:** the design doc's target was
  today + a rolling 7 days, blocked on multi-date deltas
  (`docs/specs/scheduling-engine-design.md:133`). The planner already
  accepted a multi-day `gapsByDate` — but it is deleted, so this is a
  rebuild, not a widening.

## E-commerce relevance

Real, though indirect — projects are the substrate two commerce-
adjacent capabilities already run on.

- **Live HTML doc attachments are how the pricing worksheet lives in
  the app** (42.8, `828088c`, migration `0045`; m1 §4): a project
  attachment rendered in a sandboxed iframe, `localStorage` persisted
  per key to `attachment_doc_data`, synced realtime under an advisory
  lock. If the arc wants a shared working tool (margin calculator,
  market packing list, price-change proposal) before a purpose-built
  UI exists, this pattern is already proven on prod. Known limitation:
  no same-key conflict banner if two people edit one key at once.
- **`project_links` is the app's only polymorphic link table** and
  `target_kind` is unconstrained text, so linking a project to a
  product, order, or customer needs **no migration** — only entries in
  `LINK_KINDS` and a navigation branch. F106 (06-04 audit) asked for
  exactly products / orders / customers / suppliers. Cheapest path to
  "the shelving project links to the products it holds."
- **The `project-files` bucket + `attachments.js` path convention** is
  the app's one working file-upload surface (`0017`; copied for event
  cut sheets in `0048`). Product photography beyond `product_photos`,
  or supplier documents, should reuse it rather than invent a third
  bucket layout.
- **A caution, not an asset:** do not model e-commerce work as ranked
  projects expecting the schedule to absorb it. The auto-seeding
  mechanism that would have done that is retired; a project's steps
  reach a day only when someone presses "Add next task".
