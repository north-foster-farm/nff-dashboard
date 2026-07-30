# Migration spec — chores "activity collapse"

Status: DRAFT FOR HUMAN REVIEW. This is a design document, not an
applied migration. Nothing here has run against the live database. The
app is in production (since 2026-06-01) and every schema change is
**additive-only**; this spec proposes only `CREATE TABLE` /
`ALTER TABLE … ADD COLUMN` / new indexes / backfill `UPDATE`s — no
`DROP`, no `TRUNCATE`, no `db reset`, no column removals.

Proposed migration file (when approved): `0030_chore_activities.sql`
(next number after `0029_chores_rebuild_foundation.sql`).


## A. Goal & non-goals

**Goal.** Collapse the "one chore-definition per block" identity into a
single *activity* with a multi-block set, and move the
occurrence/completion grain from `(chore_id, place, date)` — where the
block is smuggled into the `chore_id` string (`m-coop-feed`,
`mm-coop-feed`, `ea-coop-feed`, `la-coop-feed`, `eod-coop-feed` are five
rows for one real task, "Fill feeders") — to an explicit
`(activity, block, place, date)` grain. "Fill feeders" at a mobile coop
becomes ONE activity bound to the block set
`{morning, midmorning, early_afternoon, late_afternoon, end_of_day}`;
at a brooder the SAME activity title binds a *different* block set
(four blocks — there is no early-afternoon brooder feed in the seeds:
`src/data/choreSeeds.js:164-262`). Per-block completion must be
recordable and queryable, and the existing irreplaceable production data
(`chore_completions`, `chore_modifiers`) must be remapped losslessly.

**Non-goals / explicitly deferred.**
- No destructive operations of any kind. Old columns
  (`chore_definitions.block_id`, the block-encoded `chore_completions.
  chore_id` strings) are **retained**, not dropped — they are the
  rollback surface (§H).
- No per-block assignment UI and no per-block deadline-override UI in
  this pass (the *columns* exist so the data model is complete; the
  authoring UI is later — §B, AC 2/3).
- Rounds stay one-block-per-round; this spec does not change the
  `chore_runs` `(block_id, run_date)` grain (AC 7).
- This is a spec only. The DDL sketches are illustrative; the real
  migration is authored, reviewed, backed-up-before, and pushed as a
  separate explicitly-authorized step (§F).


## B. Target schema

### Decision: NEW tables (`chore_activities` + `chore_activity_blocks`)

Two candidate shapes were considered:

1. **Reuse `chore_definitions`**, drop `block_id` from its
   identity role, add a `chore_activity_blocks` join.
2. **New `chore_activities` table** as the activity-grain parent, plus
   a `chore_activity_blocks` binding/block-set child, leaving
   `chore_definitions` in place as the legacy/source table.

**Recommend option 2 (new tables).** Reasons:

- **Additive-only forbids the cleanest version of option 1.** Option 1
  wants `block_id` to stop being part of identity, but `block_id` is a
  real column referenced live by `chore_definitions_block_idx`
  (`0009:377`), the assignment resolver's block-scoped path
  (`src/lib/chores.js:329-333`), and the deadline `following_block`
  resolver (`src/lib/chores.js:239-245`). We cannot remove it. So option
  1 in practice still means "add a new join table and a new identity
  column," i.e. it is option 2 wearing `chore_definitions`'s name while
  carrying dead per-block rows. A clean parent table is less confusing.
- **`chore_definitions.id` is `text` and block-encoded today**
  (`m-coop-feed`…). Those ids are referenced by `chore_completions.
  chore_id` (text, no FK — `0002:28-35`), `chore_modifiers.
  target_chore_id` (`0009:254-255`, FK with `ON DELETE CASCADE`),
  `chore_assignment_rules.scope_id` (`0012:25-26`), and
  `chore_checklist_items.chore_id` (`0029:64-65`). Keeping
  `chore_definitions` intact preserves every one of those references
  during the soak window; the new tables are written *alongside*.
- **Per-binding block sets (FACT 6) are naturally a child table.** "One
  activity, different block set per place-binding" is a many-to-many
  between an activity and its blocks, scoped by binding — exactly a join
  row. Forcing it onto `chore_definitions` (one row = one block) cannot
  express it without inventing the join anyway.
- **Anchors stay on the activity.** The 6-way anchor model
  (`anchor_type ∈ none|place|occupied_place|place_kind|species|batch`
  plus `anchor_species_id`, `anchor_batch_id`, `anchor_kind_tag`,
  `at_place_id`, `place_id`; `0014:38-46`) is identical across all
  blocks of a collapsed activity (the five `*-coop-feed` rows are all
  `species=layers, kind_tag=coop`). Anchors move to `chore_activities`
  verbatim; `obligationPlaceIds` (`src/lib/chores.js:802-881`) runs
  unchanged off the activity row.

### New table — `chore_activities`

One row per real task. Carries the anchor (copied from the merged
definitions), frequency, owner/place metadata, and activity-level
deadline default. Blocks live in the child table.

```sql
create table if not exists public.chore_activities (
  id text primary key,                       -- stable activity id, e.g.
                                             -- 'coop-feed', 'brood-feed'
  title text not null,
  description text,
  -- anchor (mirrors chore_definitions; one anchor per activity)
  anchor_type text not null default 'none'
    check (anchor_type in
      ('none','place','occupied_place','place_kind','species','batch')),
  anchor_kind_tag text,
  anchor_species_id text
    references public.livestock_species(id) on delete set null,
  anchor_batch_id text
    references public.livestock_groups(id) on delete set null,
  at_place_id uuid references public.places(id) on delete set null,
  place_id uuid references public.places(id) on delete set null,
  -- recurrence (jsonb; same variants as chore_definitions.frequency)
  frequency jsonb not null default '{"type":"daily"}'::jsonb,
  -- activity-level deadline default; per-block override lives on the
  -- join row. nullable: NULL means "each block resolves its own".
  deadline jsonb,
  tags text[] not null default '{}',
  sort_order int not null default 0,
  retired_at timestamptz,                    -- prefer retire over delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS, the `touch_*_updated_at` trigger, and realtime publication follow
the exact pattern every chores table already uses
(`0009:73-97`, `0009:533-571`) — admin-scoped read/write via
`current_user_is_admin()`.

### New table — `chore_activity_blocks` (the binding / block-set)

The heart of FACT 6. One row per `(activity, block)` *within a binding
family*. A "binding" groups the blocks that apply to one place-shape of
the activity. For most activities there is exactly one binding (the
default), so the column can be null and the row is simply
`(activity, block)`. When the same activity title needs different block
sets at different place-shapes — feeders are 5 blocks at coops, 4 at
brooders — those are two distinct activities (`coop-feed`, `brood-feed`)
each with their own binding, which is the simplest correct encoding and
matches the seeds (the seeds already separate `*-coop-feed` from
`*-brood-feed`). The `place_binding_tag` column is therefore present for
the rarer case where ONE activity id must fan to different block sets by
place kind without splitting the activity.

```sql
create table if not exists public.chore_activity_blocks (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null
    references public.chore_activities(id) on delete cascade,
  block_id uuid not null
    references public.chore_blocks(id) on delete cascade,
  -- FACT 6: optional per-binding scoping. NULL = applies to every
  -- obligation place of the activity (the common case). A kind_tag here
  -- ('coop','brooder',…) restricts this block to obligation places of
  -- that kind, letting one activity carry different block sets per
  -- place shape without splitting it into two activities.
  place_binding_tag text,
  -- per-block deadline override (AC 2). NULL = inherit: the generator
  -- resolves the deadline from the block's position in the set (the
  -- following_block / terminal-fallback rule, §C). Non-null = exact
  -- jsonb deadline ({kind:…}) for this block only.
  deadline_override jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- One block appears once per (activity, binding).
create unique index if not exists chore_activity_blocks_uniq
  on public.chore_activity_blocks
     (activity_id, block_id, coalesce(place_binding_tag, ''));

create index if not exists chore_activity_blocks_activity_idx
  on public.chore_activity_blocks (activity_id, sort_order);
create index if not exists chore_activity_blocks_block_idx
  on public.chore_activity_blocks (block_id);
```

### `chore_completions` — add `block_id` (AC 1, NON-NEGOTIABLE)

The grain becomes `(chore_id|activity_id, block_id, place_id,
completion_date)`. We add the column additively. During the soak the
table keeps serving both shapes: legacy rows have `block_id = NULL` and
a block-encoded `chore_id`; new rows carry an explicit `block_id` and
(after the app flip, §F.5) an `activity_id`.

```sql
alter table public.chore_completions
  add column if not exists block_id uuid
    references public.chore_blocks(id) on delete set null;
alter table public.chore_completions
  add column if not exists activity_id text
    references public.chore_activities(id) on delete set null;

-- New block-grained uniqueness, NULL-safe like the existing pair
-- (0009:403-408). These ADD to the existing indexes; the old ones stay
-- valid for legacy (block_id IS NULL) rows during the soak.
create unique index if not exists chore_completions_uniq_placed_blocked
  on public.chore_completions
     (chore_id, place_id, block_id, completion_date)
  where place_id is not null and block_id is not null;
create unique index if not exists chore_completions_uniq_unplaced_blocked
  on public.chore_completions
     (chore_id, block_id, completion_date)
  where place_id is null and block_id is not null;
create index if not exists chore_completions_block_idx
  on public.chore_completions (block_id) where block_id is not null;
```

Note: `chore_completions.chore_id` has NO foreign key (`0002:28-35`), so
adding `block_id` and remapping `chore_id` values is free of FK
contention. The completion triggers `log_chore_completion` /
`log_chore_uncompletion` (`0010:159-251`) must be re-defined to fold
`block_id` into the logged payload and the 10-second debounce match key
(currently keyed on `chore_id + completion_date + place_id`,
`0010:209-211`); add `block_id` to that `is not distinct from` chain so
un-ticking the coop morning feed never cancels the just-logged coop
midmorning feed.

### `chore_assignment_rules` — already block-aware (AC 3)

No DDL needed. `scope ∈ ('chore','block')` with `scope_id` text already
supports a block dimension (`0012:24-26`); the table is seeded EMPTY
today, so there is nothing to migrate. When per-block assignment UI
arrives later it writes `scope='block'` rows; the resolver already reads
them (`src/lib/chores.js:329-333`). We keep this dimension verbatim.

### `chore_modifiers` — add `(activity, block)` targeting (AC 4)

Today a modifier targets an exact `target_chore_id` (FK to
`chore_definitions`, `0009:254-255`) plus optional `target_place_id`.
We add nullable activity/block target columns; the existing
`target_chore_id` stays valid (and FK-intact) until the soak ends.

```sql
alter table public.chore_modifiers
  add column if not exists target_activity_id text
    references public.chore_activities(id) on delete cascade;
alter table public.chore_modifiers
  add column if not exists target_block_id uuid
    references public.chore_blocks(id) on delete set null;

create index if not exists chore_modifiers_activity_idx
  on public.chore_modifiers (target_activity_id, occurs_on)
  where target_activity_id is not null;
```

`target_block_id IS NULL` under a non-null `target_activity_id` means
"all blocks of the activity"; a non-null `target_block_id` suppresses
exactly that one block (this is what `mod-proc-no-feed` needs — see §D
and §G).


## C. Occurrence generation

Occurrences stay **virtual** (computed per day, as today —
`getChoresForDay`, `src/lib/chores.js:384-392`), not materialized. The
generator gains a block-set inner loop. Pseudocode for one `date`:

```
for each activity A (where A.retired_at is null):
    if not firesOn(A.frequency, date):            # isChoreActiveOn,
        continue                                   #   chores.js:61-98
    obligationPlaces = obligationPlaceIds(A, ctx)  # chores.js:802-881
                                                   # (anchor fan-out,
                                                   #  occupancy-aware,
                                                   #  UNCHANGED — FACT 6)
    if obligationPlaces is empty:                  # dormant; emit nothing
        continue
    blockRows = blocksForActivity(A.id)            # chore_activity_blocks
    orderedSet = sortByResolvedStart(blockRows, date)
    for each place P in obligationPlaces:
        for each blockRow B in orderedSet:
            if place_binding_tag set and
               kindTag(P) != B.place_binding_tag:  # FACT 6 per-binding
                continue
            deadline = resolveDeadline(A, B, orderedSet, date, blocks)
            emit Occurrence{
                activity:  A.id,
                block:     B.block_id,
                place:     P,                       # may be null (farm)
                date:      date,
                deadlineAt: deadline,
            }
```

`resolveDeadline(A, B, orderedSet, date, blocks)`:

```
d = B.deadline_override
    ?? A.deadline
    ?? {kind: "following_block"}        # default for daily fill chores
switch d.kind:
  case "following_block":
     idx = orderedSet.indexOf(B)
     if B is the TERMINAL block of the set (idx == last):
         # AC 2 terminal-block fallback: there is no "next block",
         # so a following_block deadline collapses to end_of_day.
         return resolveBlockDeadline({kind:"block", block:"end_of_day"},
                                     date, blocks)
     else:
         nextBlock = orderedSet[idx+1]
         return startOf(nextBlock, date)
  case "block" / "block_on_weekday" / "block_at_offset" /
       "midnight" / "none":
     return resolveBlockDeadline(d, date, blocks)   # chores.js:234-264
```

This makes explicit a rule that today is *implicit in the seed data*:
the coop feed set uses `followingBlock()` for `morning…late_afternoon`
but the terminal `eod-coop-feed` is hand-authored as
`byBlock(END_OF_DAY)` (`src/data/choreSeeds.js:181-300`). The brooder
set is uniformly `followingBlock()` through its terminal
`la-brood-feed` (`choreSeeds.js:259-262`) — note this currently leaves
the terminal brooder block resolving to end-of-day only via the
generator fallback in `resolveBlockDeadline` (`chores.js:243-244`,
`m == null → endOfDay`). The new rule makes that fallback **intentional
and uniform** rather than incidental: every set's terminal block resolves
`following_block → end_of_day`, and a non-terminal `following_block`
resolves to the next block's start. Per-block override
(`deadline_override`) lets a specific block opt out (no UI required).

**Where `src/lib/chores.js` changes:**
- `getAllChoreDefinitions` / `getChoresForDay`
  (`chores.js:30-33`, `384-392`): read `chore_activities` +
  `chore_activity_blocks` instead of flat definitions; add the block-set
  inner loop above.
- `computeDeadline` / `resolveBlockDeadline` (`chores.js:234-287`):
  accept the ordered block set and apply the explicit terminal-fallback
  branch instead of relying on the `m == null` accident.
- `expandChoreForDay` (`chores.js:366-378`): emit one instance per
  `(activity, block, place)` and carry `block` on the instance so the
  completion key (`useChoreCompletions.keyOf`) can include it.
- `obligationPlaceIds` (`chores.js:802-881`): **unchanged** (AC 6).


## D. Backfill plan (idempotent, assertion-gated)

This is the irreplaceable-data step. It runs *inside the same migration*
after the tables exist, is safe to re-run (every write is guarded), and
**deletes/retires nothing** until the assertion passes (and even then
prefers `retired_at`).

### D.1 Build the `chore_definitions → (activity, block)` map

For every live `chore_definitions` row (`retired_at is null`), derive:
- `activity_id` = the block-stripped identity (see §E merge rules).
- `block_id` = the row's existing `block_id`
  (`chore_definitions.block_id`, `0009:367`). For legacy rows whose
  `block_id` is null but whose `period` text is set, resolve via
  `chore_blocks.name`/`slug` (the same join `0009:524-529` /
  `0029:46-55` already use).

Materialize this as a temp mapping table inside the `DO` block (or a
CTE) keyed `old_chore_id → (activity_id, block_id)`.

### D.2 Upsert `chore_activities` (one row per distinct activity)

```sql
insert into public.chore_activities
  (id, title, description, anchor_type, anchor_kind_tag,
   anchor_species_id, anchor_batch_id, at_place_id, place_id,
   frequency, deadline, tags, sort_order)
select
   m.activity_id,
   min(cd.title),                          -- identical within a merge
   min(cd.description),
   min(cd.anchor_type), min(cd.anchor_kind_tag),
   min(cd.anchor_species_id), min(cd.anchor_batch_id),
   min(cd.at_place_id), min(cd.place_id),
   min(cd.frequency::text)::jsonb,
   null,                                    -- activity-level default;
                                            -- per-block deadlines kept
                                            -- on the join (D.3)
   coalesce(min(cd.tags), '{}'),
   min(cd.sort_order)
from mapping m
join public.chore_definitions cd on cd.id = m.old_chore_id
group by m.activity_id
on conflict (id) do nothing;             -- idempotent re-run
```

### D.3 Insert `chore_activity_blocks` (the block set + per-block deadline)

**Q6 = NORMALIZE (decided 2026-06-05).** The activity carries a default
deadline *rule* in `chore_activities.deadline` (set in D.2 to the modal
deadline across the merged rows — `following_block` for the feeder/water
families). A block stores a `deadline_override` **only** where its old
deadline differs from what that rule resolves to at the block's position
(§C, terminal `following_block → end_of_day` fallback included). Equal →
`NULL` override, and the deadline is driven purely by block position.

```sql
-- resolved_block_deadline(activity_id, block_id) is a helper defined
-- earlier in 0030: it applies the activity's deadline RULE to the block's
-- position within that activity's ordered block set, including the
-- terminal-block end_of_day fallback (§C). Pure function of the new rows.
insert into public.chore_activity_blocks
  (activity_id, block_id, deadline_override, sort_order, place_binding_tag)
select
   m.activity_id, m.block_id,
   case
     when cd.deadline is not distinct from
          resolved_block_deadline(m.activity_id, m.block_id)
       then null                   -- matches the rule → no override (clean)
     else cd.deadline              -- genuine deviation → keep exact jsonb
   end,
   coalesce(cd.sort_order, 0),
   null                            -- single-binding default; set only for
                                   -- the rare one-activity-many-kinds case
from mapping m
join public.chore_definitions cd on cd.id = m.old_chore_id
on conflict (activity_id, block_id, coalesce(place_binding_tag,''))
  do nothing;
```

Normalize changes the *representation*, not the behavior: the coop
`Fill feeders` set ends up with **zero** overrides (late-PM's old
`byBlock(END_OF_DAY)` equals the rule's next-block result, and the
terminal `end_of_day` falls back to end-of-day anyway), so its deadlines
are entirely block-position-driven. Overrides survive only for genuine
deviations (e.g. `la-coop-grit` → `byWeekdayBlock(FRI, END_OF_DAY)`). The
D.6 assertion proves equivalence: rule + block-position + overrides must
reproduce **every** old chore's deadline exactly, or the migration fails.

### D.4 Remap historical `chore_completions` (production data)

Every existing completion's `chore_id` IS a block-encoded definition id.
Stamp the block (and activity) onto the row; **keep `chore_id`
unchanged** so legacy reads and rollback still work.

```sql
update public.chore_completions cc
set block_id    = m.block_id,
    activity_id = m.activity_id
from mapping m
where cc.chore_id = m.old_chore_id
  and cc.block_id is null;        -- idempotent: only un-stamped rows
```

A completion whose `chore_id` does not appear in the map (e.g. a chore
deleted long ago) is **left untouched** — `block_id` stays null, the row
is still readable under the legacy unique index. The assertion (D.6)
reports these but does not fail on them (they have no activity to map
to); they are listed for James to eyeball.

### D.5 Remap `chore_modifiers` (preserve the morning-feed spare — AC 4)

The single live modifier is `mod-proc-no-feed`
(`src/data/choreSeeds.js:431-450`). Its **verbatim** seed:

```js
export const CHORE_MODIFIER_SEEDS = [
  {
    id: "mod-proc-no-feed",
    title: "Withhold tractor feed before processing",
    type: "chore_modifier",
    trigger: EVENT_OF(PROC, -1),
    modifierEffect: "suppress",
    modifierCondition:
      "tractor_occupied_by_batch_due_for_processing_next_day",
    // Exact chores suppressed (owner chicken_tractor, the feeders from
    // midmorning on); the morning feeder is intentionally NOT here.
    modifierTargetIds: [
      "mm-tractor-feed", "la-tractor-feed", "eod-tractor-feed",
    ],
    modifierBlocks: [MIDMORNING, LATE_AFTERNOON, END_OF_DAY],
    description:
      "Birds shouldn't be fed after the morning the day before "
      + "processing.",
  },
];
```

The three exact ids `mm-tractor-feed`, `la-tractor-feed`,
`eod-tractor-feed` all collapse into ONE activity (`tractor-feed`), and
each maps to its block (`midmorning`, `late_afternoon`, `end_of_day`).
`m-tractor-broiler-feed` (the MORNING feed) is **deliberately absent** —
the gut-empty-before-processing rule: the bird gets its last feed the
morning before processing, then the feeder is withheld from midmorning
on (`choreSeeds.js:168-175`, `426-429`). So the remap must produce three
`(activity=tractor-feed, block ∈ {midmorning, late_afternoon,
end_of_day})` modifier rows and **must not** produce a `morning` row.

For any live `chore_modifiers` row whose `target_chore_id` is in the
map, set `target_activity_id` and `target_block_id` from the map:

```sql
update public.chore_modifiers mo
set target_activity_id = m.activity_id,
    target_block_id    = m.block_id
from mapping m
where mo.target_chore_id = m.old_chore_id
  and mo.target_activity_id is null;
```

Because the suppression is now keyed `(activity, block)`, a single
generator check (`is this (activity, block, occurrence) modifier-
suppressed for this date/place?`) covers the three later blocks and the
morning block is never matched — the spare is structural, asserted by
§G. (If `mod-proc-no-feed` is not yet seeded in the live DB, this is a
no-op and the seed is inserted directly in the new `(activity, block)`
shape — three rows, no morning row.)

### D.6 BACKFILL ASSERTION (fail the migration if violated)

Inside the `DO` block, before committing and before any retire:

```sql
-- (a) every mapped old chore resolves to EXACTLY ONE (activity, block)
if exists (
  select 1 from mapping
  group by old_chore_id
  having count(*) <> 1
) then
  raise exception 'backfill: a chore_id mapped to <>1 (activity,block)';
end if;

-- (b) every live, non-retired chore_definitions row got a mapping
if exists (
  select 1 from public.chore_definitions cd
  where cd.retired_at is null
    and not exists (select 1 from mapping m where m.old_chore_id = cd.id)
) then
  raise exception 'backfill: a live chore_definition has no mapping';
end if;

-- (c) the morning-feed spare survives: no modifier row targets the
--     morning block of the tractor-feed activity.
if exists (
  select 1 from public.chore_modifiers mo
  join public.chore_blocks b on b.id = mo.target_block_id
  where mo.target_activity_id = 'tractor-feed'
    and b.slug = 'morning'
) then
  raise exception 'backfill: mod-proc-no-feed must SPARE morning feed';
end if;
```

Only if all assertions pass does the migration proceed. **Old
`chore_definitions` rows are NOT retired in this migration** — they are
retired (`retired_at = now()`, never deleted) in a *later* migration
after the soak (§F.6).


## E. Identity / merge rules

A set of `chore_definitions` rows merges into one `chore_activities` row
iff they share **all** of:
- same `title` (after trim), AND
- same anchor tuple `(anchor_type, anchor_species_id, anchor_batch_id,
  anchor_kind_tag, at_place_id, place_id)`, AND
- same `frequency`, AND
- same place-binding family (same owner/place shape — in seed terms,
  same `owner`+`place` preset: `COOP`, `BROODER`, `TRACTOR`, …).

The derived `activity_id` is the block prefix stripped from the old id:
`m-coop-feed | mm-coop-feed | ea-coop-feed | la-coop-feed |
eod-coop-feed → coop-feed`; `m-brood-feed | mm-brood-feed |
ea-brood-feed | la-brood-feed → brood-feed`. (Practically: strip a
leading `m-|mm-|ea-|la-|eod-` block token. The migration computes this
from the *mapped block + remaining slug*, not by naive string surgery,
so an id without a recognized block prefix maps to a single-block
activity using its own id, §E "single-block weeklies".)

**Edge cases — each must be handled explicitly:**

- **Same title, different anchor → DO NOT MERGE.** "Fill waterer"
  exists for brooder (`m-brood-water`, anchor brooder/occupied_place),
  tractor (`m-tractor-broiler-water`, anchor species=broilers/tractor),
  coop (anchor species=layers/coop), and sheep (`m-sheep-water`, anchor
  species=sheep). These are FOUR activities, never one — the merge key
  includes the anchor tuple precisely to keep them apart.

- **"Anytime" chores (`block_id` NULL) — AC 5, none dropped.** Some
  rows have no block: in the new seeds `mkt-load-vehicle` is
  `block: null` (`choreSeeds.js:394-399`), and legacy "anytime" chores
  may have null `block_id`/`period`. Their defined home in the block-set
  model: a `chore_activity_blocks` row with a sentinel
  `block_id = (the 'anytime' block)`. We **seed one durable "Anytime"
  `chore_blocks` row** (additively, `on conflict do nothing`) with a
  stable `slug='anytime'` and a late/whole-day window, and map every
  null-block definition to `(activity, anytime-block)`. This keeps the
  grain uniform `(activity, block, place, date)` for completions and
  Rounds without a nullable-block special case. (Open question I.4
  covers whether "anytime" should appear in Rounds at all.)

- **Event/batch-triggered chores (`frequency.type === 'event'`).**
  These never fire in the recurring generator (`isChoreActiveOn`
  returns false for `event`, `chores.js:84-87`). They still get an
  activity + block-set row so the Processes engine can materialize
  `(activity, block, place, date)` occurrences the same way. Several
  share a title across owners (`proc-...`), but their anchors/triggers
  differ, so each stays its own activity per the anchor rule. They are
  mapped but the generator leaves them inert.

- **Single-block weeklies (e.g. "Fill grit" — `la-coop-grit`,
  `choreSeeds.js:285`).** A genuinely one-block activity: it maps to one
  `chore_activities` row with a single `chore_activity_blocks` entry
  (its own block). The terminal-fallback rule (§C) is a no-op for a
  one-block set unless its deadline is `following_block` — `la-coop-grit`
  uses `byWeekdayBlock(FRI, END_OF_DAY)`, preserved verbatim as the
  block's `deadline_override`.

- **Single-block but same title as a multi-block set.** "Collect eggs"
  appears at midmorning (`mm-coop-eggs`) and late afternoon
  (`la-coop-eggs`) with the same coop anchor → merges into one
  `coop-eggs` activity with a two-block set. Fine; the merge key holds.


## F. Cutover sequence (discrete, each DB step explicitly authorized)

Matches the production rules in `CLAUDE.md` ("Data safety") and the
recorded memory (backup → row-count check → push, each push separately
user-authorized). Each numbered step that touches the DB is its own
explicitly-authorized action.

1. **Backup.** `node scripts/backup-db.mjs` — full read-only export to a
   timestamped gitignored `.backups/<ts>/`. The events/chores tables are
   flagged `*` in its summary.
2. **Row-count sanity check.** Confirm `chore_definitions`,
   `chore_completions`, `chore_modifiers` are non-empty and the counts
   match expectation before applying anything. (Authorize/eyeball.)
3. **Apply the additive migration** (`0030_chore_activities.sql`):
   creates `chore_activities` + `chore_activity_blocks`, adds
   `chore_completions.block_id`/`activity_id` + indexes, adds
   `chore_modifiers.target_activity_id`/`target_block_id`, redefines the
   completion triggers to carry `block_id`. **No data destroyed.**
   Separate authorized `supabase db push`.
4. **Run the backfill with the assertion** (D.1–D.6). It is part of the
   same migration file's trailing `DO` block, so step 3 and step 4 land
   together atomically; if the assertion raises, the whole migration
   rolls back and nothing is half-applied. (This is why backfill lives
   in the migration, not a separate script.)
5. **Flip the app to read the new grain.** App-only change (no DB push):
   `getChoresForDay` reads activities + block sets; `useChoreCompletions`
   includes `block_id` in `keyOf` and writes it on toggle;
   `useChoreDefinitions` (or a new `useChoreActivities`) reads the new
   tables. Ship, soak. Legacy columns still populated, so a revert of
   this app change restores old behavior with zero data loss.
6. **After a soak (only once confident):** a *later* migration retires
   the old per-block `chore_definitions` rows via
   `retired_at = now()` (NEVER delete) and stops the app reading
   block-encoded `chore_id`s. The old columns
   (`chore_definitions.block_id`, `chore_completions.chore_id`) are
   **kept indefinitely** as the historical/rollback record. Separate
   authorized push.


## G. Test plan (concrete assertions)

All tests are pure-function tests against the generator + remap, runnable
without the live DB (fixtures mirror the seed shapes).

1. **`mod-proc-no-feed` block-granular suppression (AC 4) — the
   headline test.** Fixture: a tractor occupied by a broiler batch whose
   `processing` event is tomorrow. Generate occurrences for *today*
   (the −1 day) for activity `tractor-feed`. Assert:
   - the `morning` block occurrence **IS present** (the last feed
     stands — gut-empty rule);
   - the `midmorning`, `late_afternoon`, `end_of_day` block occurrences
     are **suppressed** (absent, not shown-as-skipped);
   - a tractor NOT due for processing tomorrow keeps all four feed
     blocks.

2. **Per-block completion independence (AC 1).** At one place, one date:
   tick the `morning` block of `coop-feed`. Assert `isDone(activity,
   morning, place)` is true and `isDone(activity, midmorning, place)` is
   false — i.e. the midmorning obligation is still outstanding. Then tick
   midmorning and assert both true, and that `doneCountForChore` reports
   `{done:2,total:5}` after two of five blocks.

3. **Deadline terminal-fallback (AC 2 / §C).** For the coop feed set
   with the terminal block carrying a `following_block` deadline (after
   dropping its override), assert the terminal block resolves to
   end-of-day, while a non-terminal `following_block` block resolves to
   the *next* block's start. Also assert that a block with an explicit
   `deadline_override` ignores the fallback and uses the override.

4. **Anchor fan-out survival (AC 6).** With two occupied tractors and
   three empty ones, assert `tractor-feed` emits exactly two
   obligations (one per occupied tractor) and zero when all tractors are
   empty (dormant). Assert `obligationPlaceIds` output is byte-identical
   to the pre-migration function for the same fixture (regression lock).

5. **Per-binding block sets (FACT 6).** Assert `coop-feed` yields a
   5-block set at a coop place and `brood-feed` yields a 4-block set at
   a brooder place (no early-afternoon brooder feed) — confirming
   different block sets per activity/binding.

6. **Backfill idempotency + assertion.** Run the backfill twice against
   a fixture DB; assert the second run inserts zero new
   `chore_activities`/`chore_activity_blocks` rows and re-stamps zero
   completions. Assert the assertion (D.6c) raises if a `morning`
   tractor-feed modifier row is injected.

7. **Completion remap losslessness.** A fixture of historical
   completions across all five `*-coop-feed` ids: after backfill, assert
   every row keeps its `chore_id`, gains the correct `block_id`, and the
   count of completions per `(activity, block, place, date)` is
   unchanged.


## H. Rollback / safety

Because the migration is additive-only, rollback is *not* a schema
reversal:

- **Nothing is dropped or truncated.** `chore_definitions` rows,
  `chore_completions.chore_id` strings, and `chore_modifiers.
  target_chore_id` all survive untouched.
- **Rollback = stop reading the new grain.** Revert the app change from
  §F.5 (read flat definitions + block-encoded `chore_id` again). The
  legacy unique indexes (`0009:403-408`) and legacy modifier targeting
  still function because their columns were never removed.
- The new tables and new columns simply sit unused after a revert; a
  re-flip forward needs no re-backfill (the backfill is idempotent and
  its results persist).
- The pre-push backup (§F.1) is the disaster-recovery floor; restore via
  `node scripts/restore-db.mjs <backupDir> --yes` only as last resort.
- The §F.6 retire step is the ONLY moment legacy identity stops being
  authoritative, and it is a separate, later, individually-authorized
  push that still only sets `retired_at` (never deletes).


## I. Open questions for James

**Decisions locked (2026-06-05, James):**

- **Q1 Schema → NEW TABLES.** `chore_activities` + `chore_activity_blocks`
  (§B). `chore_definitions` stays during the soak.
- **Q2 Occurrences → VIRTUAL.** Computed per day, as today (§C). No
  materialized occurrence table, no historical backfill of occurrences.
- **Q4 Anytime chores → NOW/TODAY ONLY.** Block-less activities do not
  appear in timed block rounds; they surface on Now + Today. A round
  stays one block's walk-shaped work (§E sentinel `anytime` block is
  kept for grouping but excluded from the Rounds sweep).
- **Q6 Deadlines → NORMALIZE.** Backfill stores a per-block override only
  where the old deadline deviates from the activity's rule-resolved value
  (§D.3); the D.6 assertion proves rule + position + overrides reproduces
  every old deadline exactly. Behavior-identical, cleaner data.

The remaining items below (Q3 `place_binding_tag`, Q5 id scheme, Q7
trigger redefinition) are lower-stakes and resolved as the spec
recommends unless James says otherwise.

1. **New tables vs. reuse `chore_definitions`.** This spec recommends
   new `chore_activities` + `chore_activity_blocks` (§B). The trade-off:
   cleaner model and zero risk to live references, at the cost of two
   sources of truth during the soak. Confirm, or say you'd rather grow
   `chore_definitions` in place.

2. **Virtual vs. materialized occurrences.** Recommend keeping
   occurrences virtual (computed per day, as today). Materializing
   `(activity, block, place, date)` rows would simplify some queries but
   adds a write path and a backfill of historical days. Confirm virtual.

3. **`place_binding_tag` — needed, or split into activities?** The seeds
   already separate `coop-feed` from `brood-feed`, so the column may be
   unused at launch. Keep it for future one-activity-many-kinds cases,
   or drop it from the design and always split into distinct activities?

4. **"Anytime" chores in Rounds.** §E maps null-block chores to a
   sentinel `anytime` block. Should "anytime" obligations appear in a
   Rounds round at all (and if so, which round), or only on the All
   Chores / Now surfaces? This affects whether the `anytime` block gets
   a `sort_order` slot in the round sweep.

5. **Activity id scheme.** Recommend block-stripped slugs
   (`coop-feed`, `tractor-feed`, `brood-feed`). Confirm you're happy
   with those exact ids, since they become stable keys referenced by the
   new modifier/assignment/checklist rows.

6. **Per-block deadline overrides at launch.** The backfill copies each
   old row's `deadline` onto its block as a `deadline_override` for
   bit-identical behavior (§D.3). Alternative: drop overrides where they
   equal the generator's computed value, so the set's deadlines are
   "clean" and driven by block position. Keep verbatim overrides
   (safest), or normalize?

7. **Completion trigger / debounce change.** Re-defining
   `log_chore_completion` / `log_chore_uncompletion` to include
   `block_id` (§B) is required for correct per-block un-tick debounce.
   Confirm OK to redefine those SECURITY DEFINER functions in `0030`
   (additive — same `create or replace` pattern as `0010`).
