# Schedule Feature — Scope Document

**Status:** SETTLED 2026-06-24. This is the output of the Scope Workshop
(6 lenses + reserve round) plus James's decisions on every open question.
It defines **what the Schedule feature is, what's in v1, what's deferred,
and how we'll know it's done.** It is the input to the **Design Bracket**
(the visual/interaction-design competition that comes next).

**Reads with:** `story-set.md` (the behavior catalog, S1–S129 / BD1–BD44 —
the acceptance detail), `scope-workshop-synthesis.md` (how we got here),
`versioned-capture-substrate.md` (the storage substrate design),
`verbatim-requirements.md` (James's seed).

---

## 1. Purpose — one sentence

The **Schedule** is the farm's **commitment layer**: a day-atomic plan
(with week/month zooms) that auto-composes chores + project work + events
into one **draft**, which the operators **confirm** — turning "what's
generatively due" and "what's on the calendar" into one agreed, durable,
glanceable day that **Rounds** then executes.

It is a **thin junction**, not a new source of truth: it references
chores/projects/events, never redefines them, and it exists to stop chores
stringing through the whole day and to build a stable, measurable routine
(accountability = time, never per-person leaderboards).

---

## 2. The settled model

**One unified store, derive the rest.** All six lenses independently
converged on **store-deltas-derive-the-draft**; James's decisions then
chose the most-unified realization of it.

### 2.1 `commitments` (the one timeline table — physically subsumes `chore_runs`)
The unit is a **commitment**: a single claim on a block of someone's time.
- `source_type` / `source_ref` — `chore_block` / `event` / `project_node`
  / `ad_hoc` / `note` / `reservation` / `buffer` (polymorphic, the shape
  `event_links` / `project_links` already use).
- placement — `date`, `block_id` *or* `clock_time`, `assignee`.
- pact — `reason` ("why today"), `protected` flag, `overrides` jsonb
  (instance time/duration overrides, scoped to the schedule, never leaking
  to source globals — S64/BD19).
- exec (folded in from `chore_runs`, nullable, work-type rows only) —
  `state` (scheduled/in_progress/done/canceled), `started_at`,
  `ended_at`, `started_by_email`, `ended_by_email`.
- **Sparse-but-materializing:** a pure auto-draft item with no delta and
  no execution has **no row** (it's derived). A row exists when there's a
  placement delta *or* execution begins (today's `chore_runs` behavior).
- `reservations` (non-work + buffers) are commitments of source_type
  `reservation`/`buffer`; whether they get their own table or stay rows in
  `commitments` is a **Design-Bracket implementation detail** (BD23 buffer
  config is explicitly Bracket territory).

### 2.2 The draft is derived every load
Recomputed in JS from the live sources (chore anchor fan-out via
`getChoresForDay`/`obligationPlaceIds`, event occurrences, projects by
`sort_order`) with `commitments` deltas folded over. Clear the deltas and
the pure draft returns — regenerable (S21). **Computed client-side so it
works offline** (no dependency on a server view).

### 2.3 No `activity` base table, no user-facing parent-concept word
A render-time adapter unions the kinds into "what's on the day";
work-vs-reserved is a *derived* property, not an ontology. This sidesteps
the `activity_log` naming collision (BD24) entirely. The UI shows one flat
notion ("what's on the schedule"); the type lives under the hood.

### 2.4 Confirm writes a versioned `capture`
- The **live unconfirmed day is not stored** — it's the derived draft.
- **Confirming (whole-day, one tap) writes one `captures` row**:
  `schema_id='schedule.confirmed_day'`, the frozen **planned shape** —
  block boundaries as agreed, which should-chores were pulled vs deferred
  (+ why + their hard-deadline at the time), the deltas in force, a
  reference+label manifest (so a later-deleted source still renders), and
  planned vs (eventually) actual per-person start times.
- See §4 for the substrate. **Retention contract (locked):** confirmed-day
  captures are never garbage-collected; routine-drift history (Epic L) is
  structurally durable.

### 2.5 One completion truth; one write-back
- Ticking writes `chore_completions` through the existing **outbox**
  (offline-safe); the Schedule never stores completion (S103/BD5). The
  block-level commitment `state` rolls up from completions.
- The **only** source write-back is the **event this/all-future** prompt
  (`EventScopePrompt`/`splitSeries`) — S31/S67. No silent source mutation
  (BD20/BD44).
- Per-person **start time is auto-captured** from the first started/
  completed item (resolves S129's open question).

### 2.6 One timeline, three zooms
Day / week / month are `group-by` over the one `commitments`-backed
timeline; **Calendar = that timeline filtered to event-kind commitments**
(the wide zoom). The old events surface `Schedule.jsx` is absorbed into
this, not kept as a separate sibling. One door (fully resolves Dad's "two
surfaces, one word" worry). `buildTimelineItems` and the `timeline_items`
SQL view are **deleted**; Overview embeds the one renderer read-only.

---

## 3. Decisions ledger (every resolved question)

| Question | Decision |
|----------|----------|
| Confirm scope (Q1) | **Whole-day, one tap.** Musts render as non-negotiable; the value is agreeing the should/ad-hoc band + dropping the accountability anchor. |
| Surface count (Q2) | **One timeline, three zooms.** Calendar folds in as the event-filtered wide zoom. |
| Retention (Q3) | **Yes — locked**, and realized via a full **versioned-schema storage substrate** (§4), not just a contract. |
| `chore_runs` (Q3-impl) | **Physically generalize** into `commitments` (backed-up additive→verify→drop migration). |
| Server schema enforcement | **Client `ajv` + server `pg_jsonschema`** (defense-in-depth). |
| Metrics into the substrate | **Later** — confirmed-day snapshot is the first consumer; `egg_collections`/`weight_samples` migrate in a separate batch. |
| Capture naming | **`captures` / `capture_schemas` / `record_capture` / `src/lib/capture/`.** |
| Commitment table name | **`commitments`.** |
| Schema publish | **Migration per schema version.** |
| Man-down machinery (Q from synthesis F) | Inline flag + conflict list (jump / next-prev) + **covering-person acknowledgment** (S60a). **Defer S60b** (invalidate-on-edit-with-diff) and session undo/rollback. |
| Search ambition (G) | Ship **dedup + place/occurrence narrowing** (S33a–c); full token grammar (S33d) is a later stretch. Reuse `useSearchIndex`. |
| Confirm-snapshot thinness (E) | The **planned shape** (not just labels, not a full content copy) — bounded, versioned (§4). |
| Start time (H) | **Auto-captured.** |
| `buildTimelineItems` / view (I) | **Deleted**; timeline assembled in JS; `timeline_items` view retired/demoted to a past-history optimization. |

---

## 4. In scope — the versioned-capture substrate

Ships **with** this feature (the confirmed-day snapshot is its first
consumer); built as an app-wide precedent for daily metrics / KPI /
telemetry. Full design in `versioned-capture-substrate.md`. Scope:

- **`capture_schemas`** — DB-published mirror of in-repo JSON Schema files;
  `(schema_id, version)` + `json_schema` + `app_version` (the codebase tie)
  + status. Append-only; old versions retained to read old documents.
- **`captures`** — append-only document store: client-UUID id,
  `(schema_id, schema_version)`, polymorphic subject, `captured_on` (daily
  grain), `doc` jsonb, `supersedes`. Written via `record_capture`
  `SECURITY DEFINER` RPC, riding the outbox.
- **`src/lib/capture/`** — JSON Schema files (source of truth) + pure
  **upcasters** (chain old→latest on read so consumers only see the current
  shape) + `ajv` validation. New dependency: **`ajv`**.
- **Validation:** client `ajv` pre-write + server `jsonb_matches_schema`
  (needs `create extension pg_jsonschema`).
- **v1 schemas:** `schedule.confirmed_day` (v1). Metrics/KPI schemas land
  as later consumers.

---

## 5. In scope — the Schedule itself (definition of done, by area)

The behavior detail is the story set; this is the v1 acceptance bar. **In
scope for v1** unless a story is listed in §6.

- **Draft → confirm (Epic A).** Auto-populated draft each day; one-tap
  whole-day confirm; draft/confirmed state visible; re-open + diverge
  tracking; confirm is fast, not a gate to seeing the day; partial-confirm
  allowed; day-fullness glance; yesterday's unfinished musts surfaced.
- **Auto-population, must vs should (Epic B).** Chores slotted into blocks
  with must/should emphasis + deadline escalation; project work by global
  `sort_order` into the projects window; events at clock time; ad-hoc
  placement rules; reproducible draft; overcommit shows what fits vs
  defers; anchored chores only where animals/equipment are.
- **Search-to-add (Epic C).** Add one-off tasks, chores, project nodes
  (any level, that node only), events (via this/all-future). **Chore search
  dedup + place/batch/occurrence narrowing (S33a–c)** in v1; full token
  grammar (S33d) deferred to a stretch. Multi-day add; dedupe-on-readd;
  free-text notes; "anytime" chore = any block valid.
- **Time & availability (Epic D).** Days off, appointments, breaks;
  projects-only window (global + per-day override); per-person; multi-day
  + recurring reservations; off-person musts flagged for reassignment;
  reservations protected from schedule-over.
- **Conflicts, alerts, buffers (Epic E).** Man-down (person-off and
  no-one-available); double-book; live recompute; context-specific alerts
  at the conflict; conflict list with jump + next/prev; buffers
  before/after/both, all-occurrences + single-instance; **covering-person
  acknowledgment (S60/S60a)**. **S60b (invalidate-on-edit + diff) deferred.**
- **Editing, overrides, protection (Epic F).** Instance date/time
  customization scoped to the schedule; protected-by-default with a
  double-confirm that names *why*; reorder within a block; split a block
  for one day; **any item movable incl. a must past its deadline**
  (hard-warn, never block); events via this/all-future; per-commitment
  **modification history** (S74, lightweight — falls out of the delta
  model; session-undo/rollback deferred). **S69 deferred.**
- **Today / week / month (Epic G).** Today is home; whole integrated day
  on one surface; now-marker + forward focus; glanceable status; jump-to-
  now. Week + month as zooms of the one timeline; pre-commit future days;
  bunching/deadline visibility; backward-planning from market/processing.
- **People, routine, accountability (Epic H).** Whoever's-available
  assignment (no 50/50, no leaderboards); two-up by default; start time +
  overrun; reassign for the day; unassigned allowed; solo-day sanity;
  mid-day hand-off; **per-person start time prominent** on today + week.
- **Source changes & lifecycle (Epic I).** Live draft reflects sources;
  a source change to a **confirmed** day is surfaced + prompted, never
  auto-applied (BD44); event cancel clears slot + flags prep; completed-
  elsewhere shows done; deletes don't corrupt past confirmed days
  (captures hold); spawned chores/events land on the right draft.
- **Mobile, offline, field (Epic J).** One-handed legible day; tick offline
  via outbox; read + queue offline; phone defaults to today; confirmed day
  as a glanceable checklist; quick-log rides the whole day.
- **Reminders & ritual (Epic K).** One build/confirm nudge; man-down /
  hard-deadline push when it matters; reminders respect non-work time;
  lightweight glance→confirm→go; "tomorrow looks heavy" heads-up;
  role-agnostic notifications.
- **Looking back / drift (Epic L).** Plan-vs-actual per past day; chores-
  creeping-later detection; should-chore slippage; confirmed day as the
  record unit; learning-not-grading; recurring-conflict spotting. **Powered
  by confirmed-day captures (§4); this is why the retention contract and
  versioned snapshot exist.**

---

## 6. Explicitly deferred / out of scope

- **Deferred within the feature:** full token-grammar search (S33d);
  S60b acknowledgment-invalidation-on-edit + change-diff; session-level
  undo / rollback-to-arbitrary-point (S74 extras); S69 (per-day
  un-protect); marking a whole farm "down day" (S49, cut in review).
- **Substrate later:** folding `egg_collections`/`weight_samples` and KPI
  capture into `captures` (separate batch).
- **Out of v1 entirely (BD31–37, BD26):** two-way Google Calendar sync;
  weather-aware scheduling; travel-time/leave-by routing; season-template
  libraries; visual automation/rule builder; customer-facing event pages;
  voice/NL entry; any resource-leveling solver or per-person hour-budget
  math beyond availability + conflict flags.
- **Never (BD38–42):** a generic PM/CRM/to-do app; a place to define new
  recurring obligations (those are chores); a notification firehose; a
  second source of truth for completion/dates/priority; mandatory-to-use.

---

## 7. Reserved for the Design Bracket (next stage)

The Bracket is the visual/interaction-design competition (4 lenses, two
rounds: wireframe → coded hi-fi mockup). It decides *look and interaction*,
not scope. Carried in:

- **Buffer config placement (BD23).** James's lean: a reusable buffer-
  config component + a "bufferable" interface objects expose, kept out of
  the source subsystems. Bracket proposes the realization.
- **The one-timeline rendering & zoom interaction** — how day/week/month
  zoom, how Calendar's wide zoom reads, the now-marker, forward-focus
  dimming, the phone-vs-desktop tiering.
- **Reservation as its own table vs rows in `commitments`** (an
  implementation detail the Bracket's data-touching pitches may weigh in
  on).
- **The confirm gesture, the man-down resolution flow, search-to-add
  ergonomics, drag interactions** — the high-frequency interactions
  Field-ergonomics flagged.
- **UI-density restraint (BD43)** — flow-first vs minimalist tension; the
  reason S69 is deferred.

---

## 8. Completion criteria (how we know v1 is done)

1. Opening the Schedule lands on **today**, pre-populated with a draft
   that **regenerates** identically after clearing deltas.
2. A day can be **confirmed in one tap**; confirming writes a
   `schedule.confirmed_day` **capture** validated by both `ajv` and
   `pg_jsonschema`; the captured day **renders unchanged after a referenced
   source is later deleted**.
3. **`chore_runs` is gone**; Rounds executes against `commitments`;
   row-count parity verified against a backup before the drop; one
   completion truth preserved (ticking from the Schedule, Now, and Rounds
   writes the same `chore_completions`).
4. The **timeline is one renderer**: `buildTimelineItems` and
   `timeline_items` deleted; Overview embeds it read-only; Calendar is the
   event-filtered zoom.
5. **Offline:** the day reads, ticks queue, and the draft derives with no
   signal; edits reconcile via the outbox.
6. **Man-down** flags correctly, lists with jump/next-prev, and requires
   the **covering** person's acknowledgment.
7. **Confirmed-day captures are never GC'd**; a past day shows
   plan-vs-actual and feeds at least one **routine-drift** read (Epic L).
8. No silent source mutation; the only write-backs are event this/all-
   future and chore completion; a source change to a confirmed day is
   surfaced + prompted.

---

## 9. Risks carried forward (from the synthesis)

1. **The derive-and-fold merge is the richest bug surface** — esp. an
   **orphaned commitment** pointing at a source that no longer emits.
   Needs an explicit resolution path, not an afterthought.
2. **The `chore_runs`→`commitments` migration touches irreplaceable
   production data.** Backup + row-count parity + additive→verify→drop is
   mandatory (no `db reset`, no in-place destruction before verification).
3. **Offline re-derivation cost** — the client-side chore fan-out +
   recurrence expansion + project sort runs on Dad's phone every load; if
   too heavy we may be forced toward a cached day, denting "pure
   regenerable draft." Engineering unknown to validate early.
4. **Confirm snapshot is the one sanctioned crack in "never a copy"** —
   keep it to the planned *shape*, not source content; the versioning +
   upcasters are what make that durable rather than brittle.
5. **The substrate is a precedent** — its schema/upcaster ergonomics will
   be copied across the app, so the first schema (`schedule.confirmed_day`)
   and the upcaster harness must be exemplary, not expedient.
