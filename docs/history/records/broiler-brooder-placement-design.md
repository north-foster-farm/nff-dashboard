# Broiler batch ↔ brooder placement + brooder cleanout

_Investigation + design fork, 2026-06-28. Queue item 1b. Parked pending
one decision from James (see "THE QUESTION")._

## Goal (James, 2026-06-28, "critical")

A broiler batch's brooder location must be recorded **at the batch
level**. A batch can:
- (a) live in **one** brooder the whole time,
- (b) be **moved** between brooders,
- (c) be **split across both** brooders at once.

That batch→brooder record is the **only viable lookup** for which
brooders need cleanout and when. The whole batch shares **one "move to
pasture" date** even if split. The **brooder-cleanout chore belongs to
the BROODER (place), not the batch** that has left it — so the cleanout
obligation must resolve to the brooder(s) the batch occupied (via the
placement record), then the pasture process's cleanout step anchors
there.

## What already exists (investigation)

- **`placements`** table (migration `0009_chores_overhaul_foundation.sql`,
  ~L100–150): `id, place_id, occupant_type, occupant_id, moved_in (date,
  NOT NULL), moved_out (date, NULL = currently here), notes`. Partial
  **UNIQUE `(occupant_type, occupant_id) WHERE moved_out IS NULL`** —
  i.e. **at most one OPEN placement per occupant**. History is preserved
  (moves close the old row, open a new one).
- **Hook `src/lib/data/useSites.js`**: maps to camelCase
  `{ id, placeId, occupantType, occupantId, movedIn, movedOut, notes }`.
  Mutators: `assignOccupant(placeId, type, id, movedIn?)` (atomically
  closes any open placement for the occupant, opens a new one),
  `moveOutOccupant(placementId, movedOut?)`, `updatePlacement(id,
  patch)`. Exposes `placementsByPlaceId` = **current** occupancy only
  (movedOut IS NULL).
- **Batch model `livestock_groups`** (0004): no place/brooder column;
  location lives entirely in `placements` (Batch 15 place-model
  collapse). `BatchPage.jsx` shows a **read-only "Where" card** of the
  current placement (no edit / move UI). Setting placement today happens
  only in **`SitesAdmin.jsx`** (Resources → Sites).
- **Anchor resolution `src/lib/chores.js` `obligationPlaceIds`
  (~L802–881)**: for a batch-anchored chore it walks
  `placementsByPlaceId` (CURRENT only), collects the place(s) the batch
  occupies, optionally filters by `anchorKindTag`, optionally pins to
  `atPlaceId`. **It already consults placements — but only the OPEN
  ones.**
- **Cleanout chore**: now emitted by the active **"Broiler pasture
  (lifecycle)" process** (Phase 3), step "Brooder cleanout" at +22d,
  anchored to "the event's batch" (anchorType=batch, no kindTag, no
  atPlace). So today it resolves to **wherever the batch currently
  is** — which at +22d (after the +21d "Move to pasture") is the
  PASTURE if placement was updated, or still the brooder if it wasn't.
  Either way it's not reliably the brooder. **This is the bug.**

## The two real gaps

1. **Cleanout follows the batch's LIVE location.** It must instead
   resolve to the brooder(s) the batch **occupied** — i.e. read
   placement **history** (open OR closed) filtered to `kindTag =
   'brooder'`. This handles (a) one brooder and (b) moved-between
   correctly *for cleanout purposes* even with today's single-open-
   placement model, because a move leaves a closed brooder row behind.

2. **"Split across both brooders at once" is not representable.** The
   partial unique constraint allows only one OPEN placement. NOTE:
   *for the cleanout obligation specifically, concurrency doesn't
   matter* — cleanout must fire for every brooder the batch ever
   touched, which a history scan gives whether the two brooder stints
   were concurrent or sequential. Concurrency only matters for "where do
   I feed/water this batch RIGHT NOW", which for a split batch is
   genuinely ambiguous and a separate question from cleanout.

## Recommended architecture

**History-based brooder resolution for the cleanout step**, plus a
batch-level brooder editor:

- **Resolver:** add a resolution path so a chore can anchor to "the
  brooders this batch has occupied" = scan ALL placements for the batch
  (not just open) where the place's `kindTag === 'brooder'`, dedup to
  place ids. Wire the pasture process's cleanout step to use it. This
  yields one cleanout obligation per brooder the batch occupied, and
  stops following the batch to pasture. Correct for (a)/(b)/(c).
  - Needs `placements` history available to the resolver (currently the
    hook only surfaces current occupancy → add an all-history map or a
    by-occupant index).
- **Batch-page UI:** extend `BatchPage.jsx` "Where" card with set/move
  controls (reuse `assignOccupant` / `moveOutOccupant`), brooder-scoped
  for broilers. For (c) split, see the question.
- **Move-to-pasture:** the +21d step stays one shared date for the whole
  batch; it updates the batch's CURRENT placement to the pasture (a
  single open placement is fine — split only ever applied to the brooder
  phase).

## ✅ DECIDED BY JAMES (2026-06-28)

> "I would prefer to add a migration if the resulting schema is a better
> domain model. Brooders aren't the only place a batch can be split — one
> batch is split across 5+ chicken tractors out in the field, possibly
> other scenarios too."

So **Option A — multi-place occupancy is the general domain model**, not a
brooder edge case. A batch routinely occupies MANY places at once (e.g.
one broiler batch across 5+ chicken tractors). The migration:

- **Drop** `placements_one_open_per_occupant` (UNIQUE on
  `(occupant_type, occupant_id) WHERE moved_out IS NULL` — one open row
  per occupant).
- **Add** `placements_one_open_per_occupant_place` (UNIQUE on
  `(occupant_type, occupant_id, place_id) WHERE moved_out IS NULL`) — a
  batch may have many concurrent open placements, just not two open in
  the SAME place. Safe: no existing row violates it (old constraint
  allowed ≤1 open total). Additive constraint swap, no data change.
  → migration `supabase/migrations/0039_placements_multi_occupancy.sql`.

Sequenced build (each its own commit; 0039 + hook = Phase 0 foundation):
1. **Phase 0 — foundation** (this session): migration file 0039 + hook
   support (`addPlacement` = open without closing others;
   `placementsByOccupant` history index for the resolver). Additive,
   no behavior change. NOT yet pushed to prod (apply + UI + resolver
   land together next).
2. **Phase 1 — apply + occupancy UI.** `supabase db push` 0039 (backup
   first). SitesAdmin + a BatchPage "Where" editor that supports a SET
   of places: add a place, move out of a place, "move to pasture" as a
   bulk close-brooders + open-tractors action. `assignOccupant`
   (close-all-then-open) stays for true single-place moves; split uses
   `addPlacement`.
3. **Phase 2 — history-based cleanout.** Resolve the pasture process's
   "Brooder cleanout" step to the brooder(s) the batch occupied via
   placement history (closed brooder rows), so it fires per brooder
   regardless of where the batch is now. (Generalizes: any "clean the
   place after the batch leaves" chore.) Then live-verify batch_4 (now
   on pasture, brooder placement closed) surfaces a brooder cleanout,
   not a pasture one.

Readers to audit when applying (assume one current place today, but
`obligationPlaceIds` already collects ALL matching places so chores fan
out fine): BatchPage "Where" card (show a set), SitesAdmin occupant
assignment (offer add-vs-move), Rounds/PlacePage place context.

## (ARCHIVED) THE QUESTION for James (the one genuine fork)

How should "**split across both brooders at once**" be represented —
given that cleanout works from history regardless, this only affects how
we model concurrent brooder occupancy and "where is the batch right now"
during the brooder phase?

- **Option A — Relax the constraint.** Drop the partial unique index so
  a batch can hold multiple OPEN placements. Cleanest data model, but
  `assignOccupant` (closes prior open) and every reader that assumes one
  current place (Rounds, PlacePage, BatchPage "Where", feed/water chore
  resolution) must be audited — a batch in two brooders has two "current"
  places. Medium blast radius.
- **Option B — Sequential-only + history cleanout.** Don't support true
  concurrency in the model. The batch-page UI offers "set brooder" and
  "move to other brooder"; if birds are physically in both, you record
  it as two stints (or a note). Cleanout-via-history still fires for both
  brooders, so the stated goal ("the only viable lookup for cleanout") is
  met with ZERO model change. "Right now" location shows the latest open
  brooder. Lowest risk; the only loss is an honest "concurrently in two
  places" state.
- **Option C — Add `quantity`/share to placements.** Model a true split
  (e.g. 60/40). Heaviest; only worth it if per-brooder counts matter
  elsewhere (mortality-by-brooder, feed-by-brooder). Likely overkill now.

**Recommendation: Option B** — it satisfies the cleanout goal (the whole
point) with no risky migration, defers true-concurrency until there's a
second reason to need it, and composes with the farm-map place-model
work that's still the north star. Revisit A/C if "feed/observe a split
batch by brooder" becomes real.

## F50 is the same root cause (verified 2026-06-28)

F50 ("dormant mobile-brooder chores still appear") does **not** reproduce
as a code bug. The dormant-hiding logic in `obligationPlaceIds` is
correct — it hides chores for places with no active-animal placement.
The Mobile Brooder shows chores because `broilers_batch_4` still has an
**OPEN placement** there. But batch_4 arrived **2026-05-28** (31 days
ago); broilers move to pasture at ~21 days, so it should have left the
brooder ~Jun 18. **The placement is stale** — nothing updated it when the
batch moved to pasture. That is precisely the gap 1b closes (a
"move to pasture" that re-homes the batch's placement, + history-based
brooder cleanout). So F50 rides with 1b; no separate fix. (Did NOT touch
batch_4's placement — that's real farm state for James / 1b to resolve.)

## If proceeding with B (the safe build, once confirmed)

1. Surface placement **history** to the resolver (by-occupant index in
   `useSites`), additive.
2. Add a "brooders occupied (history)" resolution path in `chores.js`
   and point the pasture cleanout step at it (a step anchor flag, or a
   dedicated anchorType like `occupied_brooders`).
3. `BatchPage.jsx` "Where" card: set-brooder + move-brooder controls
   (brooder-kind places), reusing existing mutators. QA against a marked
   test batch with exact placement cleanup (standing approval).
4. Verify: a batch moved brooder1→brooder2→pasture yields cleanout
   obligations at brooder1 AND brooder2, none at the pasture.
