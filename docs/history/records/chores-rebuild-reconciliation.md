# Chores rebuild — spec → schema reconciliation (Step 1)

> Read-only planning artifact. **Commits to nothing, writes no DB rows.**
> Input spec: `docs/specs/nff-chores-spec.md` (the contract).
> Goal: replace the organically-grown chore set with the spec's set,
> cleanly, on the **live** DB, per the project's prod-safety rules.

---

## ▶ RESUME HERE — CUT OVER on prod, awaiting James's verification

**To resume:** read this file. The soft cutover is LIVE on prod
(2026-06-04). **Next step is JAMES VERIFYING in the new UI**, then
Phase D hard-delete after sign-off.

**DONE 2026-06-04:**
- **Engine rewrite** (`src/lib/chores.js`) to the block/owner/deadline
  model: new frequency (`weekly`/`monthly_last_week`/`every_n`/`event`)
  + block-reference deadline resolution (`following_block`/`block`/
  `midnight`/`block_on_weekday`/`block_at_offset`). Legacy paths kept.
- **Pages** (`Overview`/`Chores`/`SpeciesPage`) render by block + owner
  (anchor). Build green. **Code is UNCOMMITTED.**
- **Cutover** (`scripts/chores-cutover.mjs`, dry-run default, applied):
  backup → cold-storage place (under House) → blocks renumbered 1..5 →
  retired 76 old defs (`retired_at`, REVERSIBLE) → inserted 38 new defs
  (anchors mirror existing: brooder=occupied_place@Brooders,
  tractor=species/broilers/tractor, coop=species/layers/coop,
  sheep=species/sheep, none=place@House/cold_storage) → inserted 2
  processes (off): "Broiler processing day" + "Farmers market / pop-up".
- **0029 push DEFERRED** — not needed: engine resolves blocks via the
  hardcoded `CHORE_BLOCK_IDS` map; the market checklist rides in the
  process-step `body_md`. (Push later only if you want the rename-proof
  `chore_blocks.slug` + the `chore_checklist_items` table.)
- Backup: `.backups/2026-06-04T19-56-54-986Z/`.

**FOR JAMES — verify, then sign off:**
1. Run the NEW frontend against prod (deploy, or `npm run dev`) — the
   data cutover only renders right with the rewritten engine.
2. Check Today / All Chores / Blocks / Schedule / Processes: right
   chores in right blocks, owners, deadlines, occupancy.
3. **Enable** "Broiler processing day" + "Farmers market / pop-up" and
   **disable** legacy "Processing day prep" (both processing-day
   processes are linked to `processing_days`; only one should be on).
4. ROLLBACK if needed: clear `retired_at` on the 76 old defs and
   `retired_at=now()` on the 38 new (or restore from the backup).

**AFTER SIGN-OFF — Phase D (hard delete, still owed):** delete the 76
retired defs by exact id; wipe disposable history (`chore_completions`
=2, `chore_runs`=1, `chore_run_participants`, `chore_messages`, stale
`chore_assignment_rules`=5). Backup-gated, exact-id, authorized.

**Deferred (not in this cutover):** the 6 manual-landmark post-return
chores (`DEFERRED_LANDMARK_CHORES`) — need landmark engine support;
`batch-clean-brooders` still rides the existing 0015 automation (trigger
differs from spec — audit F69); F85 `process_steps.kind='task'` rename
(later migration); audit UI fixes F65–F93.

- **B1 ✅ DONE (2026-06-04):** `src/data/choreSeeds.js` rewritten to the
  spec in the new shape. `npm run build` green. Contents:
  * `CHORE_SEEDS` — 38 recurring (§4 + tractor feed/water fill-out),
    new shape (block slug, owner, activation, block-ref `deadline`
    jsonb, `every_n` frequency).
  * `EVENT_CHORES` — 9 (§5 processing minus landmarks: 7; §6.3
    before-market: 2), `frequency:{type:"event"}` (inert in engine),
    `trigger`/`scheduleOffsetDays`/`timeWindow`.
  * `BATCH_CHORES` — 1 (`batch-clean-brooders`, `move_to_pasture_date`).
  * `CHORE_MODIFIER_SEEDS` — 1 (`mod-proc-no-feed`).
  * `DEFERRED_LANDMARK_CHORES` — 6, captured but NOT seeded (landmarks
    on hold).
  * `mkt-load-vehicle` checklist inline (→ `chore_checklist_items`).
  * Metadata: `CHORE_BLOCK_IDS` (live uuids), `CHORE_BLOCKS_META`,
    `CHORE_OWNERS`. **Legacy `CHORE_CATEGORIES`/`CHORE_PERIODS` kept**
    as deprecated compat so the un-migrated engine/UI still build (DB
    still serves old period/category shape until Phase C).
  * Dropped: `layers` owner, both `demo_*`, the 3-period model.
- **✅ Resolved with James (2026-06-04):** §4 was missing later-day
  tractor feed/water chores. Added chicken-tractor `Fill waterer` +
  `Fill feeder` in midmorning (`mm-tractor-*`), a feeder in late
  afternoon (`la-tractor-feed`; existing `la-tractor-rinse-water` is the
  late-afternoon water fill), and both at end of day (`eod-tractor-*`).
  `mod-proc-no-feed` now suppresses the three later feeders
  (`mm-/la-/eod-tractor-feed`) via `modifierTargetIds`, blocks
  midmorning→EOD; the MORNING feed stands (last feed before the
  withhold).
- **B2 ✅ DONE (2026-06-04):** `src/data/processSeeds.js` — source of
  truth for the event-driven processes, imports chore content from
  `choreSeeds.js`. `PROCESS_SEEDS` = two templates, both seeded
  `isActive:false` (real events on the schedule; James enables after
  review):
  * **Broiler processing day** → event_kind `processing_days`. 7 task
    steps (the §5 chores, offsets −1/0/+1, `proc-load-crates` carries
    its 3:00–5:30 window) + 3 `chore_modifier` skip steps at −1
    (`mm-/la-/eod-tractor-feed`) = the §6.1 feed withhold expressed in
    the engine's per-target form.
  * **Farmers market / pop-up** → event_kinds `farmers_market` +
    `popup_event`. 2 task steps (`mkt-prep-preorders` −3,
    `mkt-load-vehicle` −1 with the packing checklist rendered into the
    step body). `EVENT_KIND_LINKS` exported for the link inserts.
  * `batch-clean-brooders` (§6.2) is left to the existing
    "Broiler batch lifecycle" automation (0015) — note its trigger
    differs from spec (auto arrival+3wk vs manual `move_to_pasture_date`,
    cleanout offset +1 vs spec offset 0); reconcile in the audit (F69).
  * **Engine gap captured:** the current runner only carries title+body
    onto spawned one-time chores (period "morning", no block/deadline/
    checklist/place). Every task step records `choreId` so the
    Processes-rebuild engine work (F84–F93) can spawn block/deadline/
    checklist-aware chores. Until then the checklist also lives in the
    step body.
  * **Phase C must retire the legacy "Processing day prep" process**
    (0018) so it and "Broiler processing day" don't both expand on
    `processing_days`.
  * Landmarks: the 6 post-return chores are NOT steps (deferred).
- **Status:** Phase A migration **authored, not pushed** —
  `supabase/migrations/0029_chores_rebuild_foundation.sql` (adds
  `chore_blocks.slug` + `chore_checklist_items`). Live blocks verified
  (ids/slugs in §4). DB **unchanged**.
- **Plan:** A (schema) → B (rewrite seeds) → C (soft cutover) →
  **James verifies** → D (hard delete). Details in §7.
- **Open before push** (Phase A2/A3, with James): leave
  `chore_assignment_rules` empty? keep `activation` derived? + the
  block `sort_order` re-number (§4). None block Phase B.

---

## Decisions locked (from James, 2026-06-04)

1. **History is disposable** — `chore_completions` / `chore_runs` /
   `chore_run_participants` are alpha test data. Clean break; no
   slug-continuity needed.
2. **Soft-delete → test → hard-delete** — staged, reversible.
3. **Full scope** — definitions **and** modifiers, assignment rules,
   messages are all replaced from the spec.
4. **Reconcile process-driven chores** — the processing-day / market /
   move-to-pasture work is part of the rebuild.

---

## 1. Scope — the eight `chore_*` tables, and what happens to each

| Table | Role | Rebuild action |
|---|---|---|
| `chore_definitions` | the templates | **replace** (retire → reseed → delete) |
| `chore_blocks` | the 5 daily blocks | **keep & verify** — runs cascade off these; do not delete |
| `chore_modifiers` | per-date overrides | **wipe & reseed** the standing ones (e.g. `mod-proc-no-feed`); per-date manual ones are disposable |
| `chore_assignment_rules` | who's assigned | **wipe & reseed** from spec (mostly empty/default today) |
| `chore_messages` | sticky notes on chores | **wipe** (history, disposable; `chore_id` is a soft text ref) |
| `chore_completions` | completion history | **wipe** (disposable, decision #1) |
| `chore_runs` / `_run_participants` | per-block round state | **wipe** (disposable) — keyed off `chore_blocks`, not definitions |

Cross-subsystem references to reconcile (these point at
`chore_definitions.id`):
- `process_steps.target_chore_id` → `ON DELETE SET NULL` (chore-modifier
  steps; the spec's processing/market chores live here — see §5).
- `chore_definitions.process_expansion_id` → `process_expansions`
  (automation provenance).
- `chore_definitions.automation_emission_id` (legacy automation
  provenance).

---

## 2. Data-model mapping: spec concept → current schema

| Spec concept (§2) | Current schema | Fit |
|---|---|---|
| `block` (5: morning…end_of_day) | `chore_blocks` rows + `chore_definitions.block_id` | ✅ DB already has the 5 blocks (seen in the schedule day-view). **Seed file is stale** — `choreSeeds.js` still encodes only 3 `period`s (morning/afternoon/evening). |
| `owner` (brooder / chicken_tractor / mobile_coop / sheep / none / event) | `anchor_type` + `anchor_*` (0014): none / place / occupied_place / place_kind / species / batch, + legacy `category` text | ⚠️ mostly maps (see §3) but the vocab differs; the spec **dropped the `layers` owner** (egg chores are place-scoped) |
| `place` (incl. `cold_storage`, place-less) | `place_id` / `at_place_id` → `places` | ⚠️ needs a `cold_storage` place row; place-less = anchor `none` |
| `activation` (owner_occupied / sheep_present / always / event) | implicit in `anchor_type` + occupancy logic (`src/lib/chores.js`) | ⚠️ no explicit `activation` column — derived; confirm `sheep_present` is expressible |
| `recurrence` (daily / weekly{days} / monthly{last,day} / every_n_months / event) | `frequency` jsonb: daily / specific_days / weekly_window / monthly_last_week_window | ⚠️ **`every_n_months` is new** (`mm-egg-washer-clean`); weekly is `weekly_window{preferred,latest}` vs spec `weekly{days}` |
| `deadline` (following_block / end_of_day / midnight / {weekday,block} / {offset,block}) | `deadline` jsonb (offset_hours / end_of_day / end_of_week_friday / end_of_month_week_friday) + `last_chance_block_id` | ❌ **biggest semantic gap** — current deadlines are hours/Friday-based; spec is **block-reference** based. Needs a new deadline encoding. |
| `trigger` (event / batch_attr / **landmark**) + `immediate`/trigger-time override | processes (`process_steps`, event-triggered) + automations | ⚠️ event + batch_attr exist; **manual landmarks** ("returned_from_processor/market") + **trigger-time override** need confirming/adding (§5) |
| `checklist[]` (mkt-load-vehicle) | — none on `chore_definitions` | ❌ **new** — needs a checklist field/table |
| `chore_modifier` (suppress across blocks, by condition) | `chore_modifiers` (skip/replace/prepend/restrict_until, per `occurs_on` date, one target) | ⚠️ current modifier is one-chore-one-date; `mod-proc-no-feed` suppresses fill-feeder across 3 blocks **by condition** (tractor due for processing) → model as process-driven modifier steps |

---

## 3. Owner / anchor mapping

| Spec owner | → current `anchor_type` | Notes |
|---|---|---|
| `brooder` (any occupied) | `occupied_place` (brooder subtree) | "any occupied brooder" = the pre-0014 fan-out |
| `chicken_tractor` | `batch`/`occupied_place` in tractor `place_kind` | broilers in pasture pens |
| `mobile_coop` | `occupied_place` (coop) or `species` layers `at_place` | spec: chore follows the coop |
| `sheep` | `species` = sheep (+ `sheep_present` activation) | |
| `none` (place-scoped, e.g. house egg work) | `place` / `at_place_id` = house / cold_storage | spec **removed `layers` owner** for egg chores |
| event-scoped (proc-*, mkt-*) | process-driven; `anchor_type none` + event trigger | place-less for `proc-pickup` |

Legacy `category` (mobile_coops/sheep/chicken_tractors/brooders/wash_eggs)
is display metadata; it must be re-derived or dropped in favor of the
anchor/owner model.

---

## 4. Block alignment — VERIFIED against prod (read-only, 2026-06-04)

All 5 spec blocks already exist. `0029`'s conservative backfill matches
every name → **no null slugs**. Block id ↔ slug (for the seed rewrite):

| spec slug | live name | `chore_blocks.id` | start | sort_order |
|---|---|---|---|---|
| `morning` | Morning | `9f576986-7524-4e71-a6b4-4e0965f310ac` | sunrise | 1 |
| `midmorning` | Mid-Morning | `f6eeb73f-775d-48a6-9b2e-ead74acf72c0` | 10:00 | 4 |
| `early_afternoon` | Early Afternoon | `b05763c7-0c46-4d0f-8d86-b4bfcaa893ad` | 13:00 | 5 |
| `late_afternoon` | Late Afternoon | `e6bed0d7-931b-45d5-b61e-b6fff5306fb1` | 16:00 | 2 |
| `end_of_day` | End of Day | `34ca2d90-cfea-4b2d-9edb-6e9f4cf7cf5d` | sunset | 3 |

- **`choreSeeds.js`** still uses only 3 `period`s (morning/afternoon/
  evening) — Phase B splits those onto the 5 blocks above (reference by
  `block_id` or, post-0029, by slug).
- ⚠️ **`sort_order` is non-chronological** (Late Afternoon=2 sits before
  Mid-Morning=4). Chronological start times are correct, so "following
  block" should resolve by **start time**, not `sort_order` — but the
  display order is wrong and should be fixed (re-number to 1=morning,
  2=midmorning, 3=early_afternoon, 4=late_afternoon, 5=end_of_day) as a
  small data step in the cutover. Add to Phase B/C scope.
- **Do not recreate blocks** (runs cascade off them) — only add slugs
  (0029) and re-number sort_order.

---

## 5. Event / process / landmark reconciliation (spec §5–§7)

The spec's non-recurring chores map onto the **Processes** subsystem:

| Spec | Maps to |
|---|---|
| `processing_day` chores (§5.1–5.3, offsets −1/0/+1) | a "Processing day" **process** with `process_steps` (kind `task`→**chore** per F85) |
| `mod-proc-no-feed` (§6.1) | a process **chore_modifier step** (`skip`) conditioned on "tractor due for processing" |
| `batch-clean-brooders` (§6.2, move_to_pasture_date set) | the existing batch-attribute automation (audit F69 "Brooder cleanout — Batch N") |
| `farmers_market_or_popup` (§6.3) | a "Market/pop-up" process with steps + the load checklist |
| Manual landmarks `returned_from_processor` / `returned_from_market` (§5.4, §6.3, §7) | **NEW** — dashboard landmark actions firing immediate, trigger-time-override, EOD-deadline chores |

Gaps here:
- **Manual landmark trigger + trigger-time override + immediate
  creation** — confirm the automation/process engine supports this; if
  not, additive work.
- The spec's framing ("processes spawn **chores**, not tasks") is
  exactly audit **F85** — do that rename as part of this.
- `proc-pickup` is **place-less** with a future-dated block deadline
  (late-afternoon Friday same week) — needs the new deadline encoding
  (§2) + null place.

---

## 6. Schema changes required (all **additive** migrations)

Resolved with James 2026-06-04. None are destructive; each is a new
migration file.

1. **Block slug + deadline-as-block-reference** *(biggest item)* —
   *Decision: jsonb, slug-referenced (Option A hybrid).*
   - Add `slug text` to `chore_blocks` with the spec `BlockEnum`
     (`morning`/`midmorning`/`early_afternoon`/`late_afternoon`/
     `end_of_day`) — stable, rename-proof block identifiers.
   - Extend the `deadline` jsonb with block-reference variants:
     `{kind:"following_block"}`, `{kind:"block", block:<slug>}`,
     `{kind:"midnight"}`, `{kind:"block_on_weekday", weekday, block}`,
     `{kind:"block_at_offset", offset_days, block}`.
   - Fold the legacy `last_chance_block_id` into this unified model;
     update `computeDeadline()` / the remaining-pill logic
     (`chores.js:130`, `:402`).
2. **Checklists** — *reuse the project pattern* (`project_checklists` /
   `project_checklist_items`, migration 0017). The spec needs only one
   flat level, so a single `chore_checklist_items` table keyed to
   `chore_definitions(id)` with `label text`, `optional bool`,
   `sort_order` + the same RLS shape. (`mkt-load-vehicle` is the only
   user so far.)
3. **Generalized recurrence `every_n_{unit}`** — extend the `frequency`
   jsonb to `{type:"every_n", n, unit, day?}` where `unit ∈
   days|weeks|months|years` (supersedes the spec's `every_n_months`;
   covers `mm-egg-washer-clean` = every 3 months and any future cadence).
4. **`cold_storage` place** — add a `places` row **nested under the
   house**: the 20' shipping container holding the freezers/
   refrigerators. (parent = house.)
5. **Manual landmarks — ON HOLD.** No foundation exists in the engine
   (no landmark trigger, no trigger-time override). Deferred per James;
   may not be needed. The 6 post-return chores (`proc-sort-freezers`,
   `proc-log-inventory`, `proc-sanitize-coolers`, `mkt-return-inventory`,
   `mkt-cash-out`, `mkt-sanitize-coolers`) are **deferred** out of this
   rebuild until/if landmarks are built. Everything else in §5 ships.
6. **F85 — kill "tasks" from processes** is **in scope** for this
   migration: `process_steps.kind` collapses to chore-spawning only
   (no `task`), reconciling the processing-day / market processes.
7. **(Maybe) explicit `activation`** — only if the derived occupancy
   logic can't express `sheep_present` / `owner_occupied` cleanly;
   confirm during Phase A.

**Not needed:** a soft-delete flag — `chore_definitions.retired_at`
already exists (added 0015). Soft-delete = `set retired_at = now()`.

---

## 7. Staged execution plan (per prod-safety rules)

Every step attended, backed up, additive-only — never a drop/truncate.

**Phase A — Schema (additive migrations)**
- A1. ✅ **Authored** `0029_chores_rebuild_foundation.sql` — adds
  `chore_blocks.slug` (+ conservative name backfill, unique index) and
  the `chore_checklist_items` table (mirrors project checklists).
  Verified: RLS helper exists, FK type matches, next in sequence. **Not
  pushed.** (deadline jsonb / every_n / cold_storage / F85 deferred per §6.)
- A1b. ✅ **Verified** the live 5 `chore_blocks` (read-only) — all names
  match the backfill; no null slugs; ids recorded in §4. (Also found:
  `sort_order` is non-chronological — fix in B/C.)
- A2. `node scripts/backup-db.mjs` → confirm row counts.
- A3. Apply (`db push` individually authorized).

**Phase B — Reseed source of truth**
- B1. Rewrite `src/data/choreSeeds.js` to the spec (5 blocks, owner/
  anchor model, new deadlines, checklists, `every_n_months`). Drop the
  two `demo_*` chores.
- B2. Build the spec's processes + modifiers (§5) as seed/config.

**Phase C — Soft cutover (reversible)**
- C1. Backup.
- C2. `retired_at = now()` on **all current** `chore_definitions`
  (soft-delete) — they vanish from the UI but are fully recoverable.
- C3. Insert the spec definitions + block links + assignment rules +
  standing modifiers + processes.

**→ James verifies on his end** *(explicit gate — not Claude)*
- James reviews the live UI (Today / All Chores / Blocks / Schedule /
  Processes): right chores in right blocks, deadlines, occupancy
  activation, processing/market processes. Fix-forward on anything
  wrong. Hard delete does **not** proceed until James signs off.

**Phase D — Hard delete (after James signs off)**
- D1. Backup.
- D2. Delete the retired old definitions **by exact id**
  (`id = in.(…retired set…)`), and wipe the disposable history tables
  (`chore_completions`, `chore_runs`, `chore_run_participants`,
  `chore_messages`) + stale `chore_modifiers` / `chore_assignment_rules`.
  Exact-id / dry-run-first per the prod-delete rule.
- D3. Verify counts; processes/automations re-pointed (no orphan
  `process_steps.target_chore_id` you meant to keep).

---

## 8. Decisions resolved (2026-06-04)

1. **Deadline model:** ✅ Option A hybrid — add a stable `slug` to
   `chore_blocks`, encode deadlines as slug-referenced jsonb (§6.1).
2. **Checklists:** ✅ reuse the project checklist pattern; one flat
   `chore_checklist_items` table (§6.2).
3. **Recurrence:** ✅ generalized `every_n_{days|weeks|months|years}`
   (§6.3).
4. **`cold_storage`:** ✅ a `places` row nested under the house (the 20'
   container) (§6.4).
5. **Landmarks:** ✅ ON HOLD — net-new, no foundation; the 6 post-return
   chores deferred (§6.5).
6. **F85:** ✅ in scope — processes spawn chores, not tasks (§6.6).
7. **Plan shape:** ✅ A → B → C → **James verifies** → D (§7).

Still to confirm during Phase A (cheap, read-only):
- The 5 live `chore_blocks` rows + sort order, and whether "anytime"
  stays the null-block bucket. *(verify against prod read-only)*
- Whether `chore_assignment_rules` should be left empty post-rebuild
  (the spec assigns no people).
- Whether occupancy `activation` can stay derived or needs an explicit
  column (§6.7).
- Sequencing vs. the audit backlog: rebuild first (clean base), then
  layer audit UI fixes (F65–F83 Chores, F84–F93 Processes) on top.

---

### Next step
**Phase A** (author the additive migrations from §6) is the first thing
that touches the DB — backup-gated and individually authorized. Nothing
in this reconciliation has modified the database.
