# Versioned Capture Substrate — design note

**What this is:** a concrete design for the reusable **versioned-JSON
data-capture** layer James asked for (2026-06-24 Scope-Workshop decision
Q7+). The Schedule's **confirmed-day snapshot** is its first consumer, but
it is built as an app-wide precedent for long-term capture of daily
metrics, KPIs, and business telemetry. This note also reconciles the
Schedule model to the **"one timeline, three zooms"** decision (Q2).

Grounded against the repo (Explore survey 2026-06-24). Key facts it
respects:
- **No versioned-JSON pattern exists** — this is new, not a duplicate.
- Existing append-only patterns to match: `activity_log` (kind + jsonb
  payload, written only via `SECURITY DEFINER` RPC/triggers),
  `inventory_movements` (ledger), `egg_collections`/`weight_samples`
  (daily captures, INSERT-only, client-UUID idempotent).
- The **outbox** (`src/lib/outbox.js`, IndexedDB queue + per-op EXECUTOR,
  idempotent via natural keys / client UUIDs / additive merges) is the
  data-capture workhorse — the substrate rides it, never bypasses it.
- **No validation lib** (no ajv/zod). JSON Schema validation is a
  deliberate new dependency. Supabase ships **`pg_jsonschema`** for
  server-side jsonb-against-schema validation.
- `meta.version` (`nff-data.json`) is display-only — schema versions are a
  *separate* monotonic concept, not hung off it, but stamped with the
  app version that introduced them.

---

## 1. The problem this solves

We are about to start freezing **durable historical records** — first the
confirmed-day snapshot (so routine-drift analysis over months is possible,
per the Maximalist's retention point), soon daily KPIs and telemetry. Two
forces collide:

1. **The record must survive forever**, even as the code that produces it
   changes shape every batch. A confirmed day from March must still render
   in a drift dashboard in December after the schedule model has evolved
   twice.
2. **The app is on additive-only, no-legacy footing** — we delete old code
   paths aggressively. We cannot keep five years of "read the old shape"
   branches scattered through the UI.

The reconciliation is the classic **schema-versioned document + upcasters**
pattern (event-sourcing's "upcasting," document-store versioning): store
each record as serialized JSON tagged with the exact schema version it was
written at; define each schema as a real **JSON Schema**; when the shape
changes, add a new schema version + a pure **upcaster** that lifts the old
shape to the new one. Every *reader* upcasts to the latest version on
load, so all consumer code (dashboards, KPI math) only ever handles the
current shape — the backward-compat lives in one tested chain of
upcasters, not in the UI. This is the precedent James wants.

---

## 2. The model — two tables + code

### 2.1 `capture_schemas` (the schema registry, in the DB)
The source of truth for each schema *is a JSON Schema file in the repo*;
this table is its **published mirror** so Postgres can validate writes and
so a historical document is self-describing forever.

- `schema_id` text — a stable logical document type, dotted namespace:
  `schedule.confirmed_day`, `metrics.egg_collection`, `metrics.weight_sample`,
  `telemetry.daily_kpi`. (Namespaced so the substrate spans the app.)
- `version` int — monotonic **per `schema_id`**, starting at 1.
- `json_schema` jsonb — the actual JSON Schema (draft 2020-12) document.
- `app_version` text — the `meta.version` (e.g. `0.11.0-alpha`) at which
  this schema version shipped. **This is the "versioned against the
  codebase" tie.**
- `status` text — `active` | `deprecated` (never deleted; old versions are
  retained precisely so old documents stay readable — the one sanctioned
  exception to no-legacy, because it's *data* backward-compat, not a
  code-path soak shim).
- `created_at`, `notes`.
- **PK (`schema_id`, `version`).** Append-only: a shape change = a new row,
  never an edit to an existing one.

### 2.2 `captures` (the document store)
- `id` uuid — **client-generated** (idempotent outbox replay, matching
  `egg_collections`).
- `schema_id` text + `schema_version` int — FK → `capture_schemas`; the
  version the doc was *written* at (never rewritten on read).
- `subject_type` text, `subject_id` text — polymorphic owner the capture is
  *about*, for querying: `('schedule_day', '2026-06-24')`,
  `('livestock_group', <uuid>)`, or null for farm-wide.
- `captured_on` date — the **business day** the data is for (the daily
  grain; what you group KPIs by).
- `captured_at` timestamptz, `actor_email` text — provenance.
- `doc` jsonb — the serialized document, valid against
  (`schema_id`, `schema_version`).
- `supersedes` uuid null — points at a prior capture this one corrects
  (append-only correction, never an in-place mutation; history holds).
- Indexes: `(schema_id, captured_on)`, `(subject_type, subject_id, captured_on)`.
- **Append-only**, written via a `SECURITY DEFINER` RPC (`record_capture`)
  exactly like `log_run_event` — clients never INSERT directly.

### 2.3 The code side (versioned with the repo)
```
src/lib/capture/
  registry.js                  -- maps schema_id -> { latestVersion, schema, upcasters }
  validate.js                  -- ajv (client-side pre-validation)
  upcast.js                    -- applyUpcasters(doc, from, to)
  schemas/
    schedule.confirmed_day/
      v1.schema.json
      v2.schema.json
      upcasters.js             -- { 1: (docV1) => docV2, ... } pure fns
    metrics.egg_collection/
      v1.schema.json
      ...
```
- **JSON Schema files are the source of truth.** A migration (or a small
  `scripts/publish-capture-schemas.mjs`) upserts each into
  `capture_schemas` with the current `app_version`. New version = new
  `vN.schema.json` + an upcaster `{N-1: fn}` + a migration row.
- **Upcasters are pure, total, tested.** `applyUpcasters(doc, k, n)` chains
  `k→k+1→…→n`. A golden-file test per version pins old fixtures rendering
  under the latest shape — that's the regression net for "March's day still
  renders in December."

### 2.4 Validation — two layers
- **Client (write path):** `ajv` validates the doc against the latest
  in-repo schema *before* `enqueueOp('capture_insert', …)`. Fast, offline,
  catches bugs at the source. (New dependency: `ajv` — the standard JSON
  Schema validator; ~the only real option given James said "JSON Schema,"
  not schema-as-code like zod.)
- **Server (enforcement):** `record_capture` RPC validates `doc` against
  the stored `capture_schemas.json_schema` via **`pg_jsonschema`**
  (`jsonb_matches_schema(schema, doc)`), rejecting a malformed write even
  if a client is stale/malicious. Needs the extension enabled on the
  Supabase project (verify + a migration `create extension`).

---

## 3. How the Schedule feature uses it (first consumer)

This is where the **derive-and-diff** model (unanimous workshop result)
and the **versioned-capture** substrate meet cleanly:

- **The live, unconfirmed day is NOT a capture.** It's derived every load
  from chores/events/projects + the sparse placement deltas. Regenerable,
  never frozen. (Exactly the workshop model.)
- **Confirming writes one capture:** `schema_id='schedule.confirmed_day'`,
  `subject=('schedule_day', date)`, `captured_on=date`, `doc` = the frozen
  **planned shape** — per the retention decision, NOT just display labels:
  - the per-block planned boundaries (start/end) as agreed,
  - which **should-chores were pulled in vs deferred**, each with its
    "why today" reason and its hard-deadline at the time,
  - the placement deltas (overrides, reassignments, reservations) in force,
  - a reference+label manifest (so a later-deleted source still renders),
  - planned vs (eventually) actual per-person start times.
- **Routine-drift analysis (Epic L)** reads confirmed-day captures across a
  date range, upcasting each to the latest shape, and asks "is power-wash
  slipping to its deadline every week" (S118), "does every market day
  collide with evening chores" (S121). Because the planned shape is frozen
  and versioned, this works no matter how the schedule model evolves.
- **Retention contract (locked):** confirmed-day captures + their placement
  deltas are **never garbage-collected.** Unconfirmed-day placement deltas
  *may* be (they're disposable draft state) — but the moment a day is
  confirmed its deltas are captured into the frozen `doc`, so nothing the
  drift analysis needs is ever on a GC-able row.

---

## 4. Reconciling "one timeline, three zooms" (Q2)

James chose Reframer's merge: Schedule + Calendar collapse into **one
commitment timeline** with day / week / month zooms (Calendar = the
event-filtered wide zoom). **And (decision Q3-impl) he chose the purest
form: physically generalize `chore_runs` into the unified commitment
store** — not the read-model-union compromise I'd recommended. The model:

- **The unit is a *commitment*** — `(source_ref, placement, pact, exec)` —
  the polymorphic shape the codebase already ships in `event_links` and
  `project_links`. Day/week/month are `group-by` over one timeline query;
  "Calendar" is that timeline filtered to event-kind commitments. One door
  (which fully resolves Dad's "two surfaces, one word" worry).
- **`commitments` physically subsumes `chore_runs`.** One table:
  - `source_type` / `source_ref` — `chore_block` / `event` / `project_node`
    / `ad_hoc` / `note` / `reservation` (+ `buffer`).
  - placement — `date`, `block_id` *or* `clock_time`, `assignee`.
  - pact — `reason` ("why today"), `protected` flag, `overrides` jsonb
    (instance time/duration overrides, scoped to the schedule).
  - **exec (folded in from `chore_runs`, nullable, meaningful only for
    work-type rows):** `state` (scheduled/in_progress/done/canceled),
    `started_at`, `ended_at`, `started_by_email`, `ended_by_email`. A
    chore-block commitment with these IS what `chore_runs` was.
- **Sparse-but-materializing.** Consistent with the unanimous derive-and-
  diff model: a pure auto-draft item with no delta and no execution has
  **no row** (it's derived). A `commitments` row exists when either (a)
  there's a placement delta, or (b) execution begins — which is exactly
  today's `chore_runs` behavior (a run row appears when the round starts).
- **What does NOT merge:** `chore_completions` stays the per-chore-item
  completion truth (finer grain than the block-level commitment); the
  one-completion-truth rule (S103/BD5) is untouched. Event edits still go
  through `splitSeries` (this/all-future). The commitment's block-level
  `state` rolls up from completions as today.

**Migration (respects production data-safety — irreplaceable `chore_runs`
data).** Additive-first, no in-place destruction until verified: (1) create
`commitments` + `reservations` + `captures` + `capture_schemas`; (2)
**copy** every `chore_runs` row into `commitments` (source_type=
`chore_block`, exec columns mapped 1:1), preserving uuids; (3) repoint
Rounds / `useChoreRuns` / completions roll-up to `commitments`; (4) verify
row-count parity against a fresh backup; (5) **then** drop `chore_runs`
(no-legacy: fold in and delete, no dual-source soak). Each step is its own
migration; `node scripts/backup-db.mjs` + row-count check before the push
that drops anything. The `timeline_items` SQL view and `buildTimelineItems`
are deleted; the timeline is assembled in JS (must derive offline).

---

## 5. Sub-decisions

1. **`pg_jsonschema` for server enforcement?** → **RESOLVED: adopt both.**
   Client `ajv` (fast/offline) + server `jsonb_matches_schema` in the
   `record_capture` RPC. Defense-in-depth; a stale/buggy client can't write
   a malformed durable record. Needs `create extension pg_jsonschema`.
2. **Fold existing daily captures in now, or later?** → **RESOLVED: later.**
   Substrate ships with the **confirmed-day snapshot as first consumer**;
   `egg_collections`/`weight_samples` migrate into `captures` as a
   deliberate separate batch.
3. **`chore_runs`: read-model union or physical merge?** → **RESOLVED:
   physical generalization** (see §4). `commitments` subsumes `chore_runs`;
   careful backed-up additive→verify→drop migration.
4. **Naming.** → *Pending James (§5 deferred Q).* Lean: keep `captures` /
   `capture_schemas` / `record_capture` / `src/lib/capture/` ("capture" is
   James's own word from the verbatim dump). Also pending: the commitment
   table noun — `commitments` vs `timeline_entries` vs `schedule_entries`.
5. **Schema publish mechanism.** → *Pending James (§5 deferred Q).* Lean:
   a checked-in **migration per schema version** (auditable, matches the
   additive-only house style) over a deploy-time sync script.
