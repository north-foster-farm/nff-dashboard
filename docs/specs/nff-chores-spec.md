# NFF Daily Ops — Chore Definitions (Rebuild Spec)

> **Status:** Draft, ready for handoff. Clean-slate redefinition of the chore set,
> intended to replace the existing (organically-grown) chore data.
> Prepared for a Claude Code instance to implement.
>
> Covers all five daily blocks (morning → end of day) plus three event families:
> **processing day**, **broiler batch move to pasture**, and **farmers market /
> pop-up**. All previously open questions are resolved (see §9).

---

## 1. Overview

Chores are organized into a fixed daily sequence of **chore blocks**. Most chores
recur (daily / weekly / monthly / every-N-months). A subset are **event-triggered** —
created by a farm event (processing day, a farmers market), by a **batch attribute
being set** (a broiler batch's move-to-pasture date), or by a **manual landmark
action** in the dashboard (e.g. "returned from processor"). Some rules are **chore
modifiers** that suppress otherwise-scheduled chores under specific conditions.

---

## 2. Core Concepts & Data Model

### 2.1 Chore Blocks

A **chore block** is a named window in the daily schedule. Blocks have a fixed daily
order; "deadline" and "following block" references resolve against this ordering.

| Order | Block             | Approx. time | Notes                                   |
|-------|-------------------|--------------|-----------------------------------------|
| 1     | `morning`         | early AM     | a.k.a. early morning                    |
| 2     | `midmorning`      | ~10:00 AM    | the "10 AM chore block"                 |
| 3     | `early_afternoon` | early PM     |                                         |
| 4     | `late_afternoon`  | late PM      |                                         |
| 5     | `end_of_day`      | end of day   | last block; "evening" / "end of day"    |

> "Evening" and "end of day" are used interchangeably and both map to `end_of_day`.

### 2.2 Owner / Association

Every chore **belongs to** an entity (its *owner*). The owner — not the place — is
what the chore is tied to. When the owner is mobile, **the chore follows the owner
around the farm**, regardless of which physical place it currently occupies.

Owner types:

- `brooder` — instances **Brooder One**, **Mobile Brooder**. Most brooder chores
  apply to **any occupied brooder** rather than a specific instance.
- `chicken_tractor` — the pen/enclosure occupied by broilers in pasture (up to five).
- `mobile_coop` — a mobile coop housing layers; lives in a pasture.
- `sheep` — the flock.

> Some chores have no animal/equipment owner and are **place-scoped** instead
> (e.g. egg handling at the house). Place derivation for mobile owners (which
> pasture/pen a coop or tractor is in) is handled by an existing mechanism and is
> out of scope for this list.

> **Key rule (stated repeatedly):** chores belong to the *animal or movable
> equipment*, **not** the pasture/place they occupy. Fill-feeder chores belong to
> the **mobile coop**, not the pasture; the sheep waterer chore belongs to the
> **sheep**, not the barn.

### 2.3 Place

Where the chore is physically performed. For mobile owners this is usually
**derived** from the owner's current location; for some chores it is **fixed**.

Places:

- `brooder_one`, `mobile_brooder`
- `pasture` (any of the pastures / up to five pens)
- `barn`
- `house`
- `cold_storage` — the cold storage container (formerly "meat warehouse"),
  located at the house.

### 2.4 Activation Condition

Predicate determining whether a chore instance exists for a given day. Most common:
**owner is occupied** (brooder / tractor / coop occupied), or **sheep present**. If
false, the chore does not appear at all.

### 2.5 Recurrence

- `daily`
- `weekly{ days }` — e.g. Monday; also multi-day (e.g. Mon/Wed/Fri)
- `monthly{ week: "last", day }` — "last week of the month" + day-of-week
- `every_n_months{ n, day }` — e.g. every 3 months on a Monday
- `event_triggered` — created by an event, a batch-attribute set, or a manual
  landmark (see §2.7)

### 2.6 Deadline

Expressed as a **chore-block reference**, not a clock time. Patterns:

- **Following block** — due by the start of the next block.
- **End of day** — due by the `end_of_day` block (same day).
- **Calendar midnight** — natural end of the calendar day (used by some egg-handling
  end-of-day chores).
- **Future-dated block** — e.g. "late afternoon Friday of the same week," or "the
  following Friday's last block."

### 2.7 Events, Batch Triggers & Event-Triggered Chores

Some chores exist only because of a trigger. Triggers come in three forms:

1. **Calendar events** — scheduled events that spawn chores on the event day and/or
   on offset days (`-1` day before, `0` day of, `+1` day after).
   - `processing_day` — the day birds go to the processor.
   - `farmers_market_or_popup` — a market or pop-up sale.

2. **Batch attribute set** — a chore is created when a value is populated on a batch
   record.
   - `move_to_pasture_date` on a **broiler batch** — empty at batch creation, set
     **manually per batch**. When set, it both populates the move date and schedules
     the dependent chore (see §6.2). The system should also surface a reminder/need
     to get this date filled at some point.

3. **Manual landmark events** — timing can't be known in advance and must be recorded
   by the user via a dashboard action. When landmarked, dependent chores are created
   **immediately**, with a **trigger-time override** (the chore's scheduled time is
   the moment of the trigger rather than a fixed block) and a deadline of **end of
   day**.
   - **"Picked up from processor" / "Heading back from processor"** — landmarks the
     return so post-pickup chores can be created.
   - **"Returned from market / pop-up"** — landmarks the return so post-market chores
     can be created.

### 2.8 Chore Modifiers

A **chore modifier** is a trigger-driven rule that **alters or suppresses** an
otherwise-scheduled chore under specific conditions. A suppressed chore must **not
appear in the schedule at all** (not shown-as-skipped).

### 2.9 Checklists

A chore may carry a **checklist** of sub-items (some optional). Used for packing/
loading chores. Checklist items are not separate chores.

---

## 3. Proposed Chore Schema (for implementation)

```
Chore {
  id:                  string        // stable surrogate id
  name:                string        // task label, e.g. "Fill waterer"
  type:                "chore" | "chore_modifier"
  block:               BlockEnum     // morning | midmorning | early_afternoon | late_afternoon | end_of_day
  owner:               OwnerRef      // brooder | chicken_tractor | mobile_coop | sheep | none(place-scoped) | event-scoped
  place:               PlaceRef      // fixed place, or "derived from owner location"
  activation:          Condition     // owner_occupied | sheep_present | always | event-scoped predicate
  recurrence:          Recurrence    // daily | weekly{days} | monthly{week,day} | every_n_months{n,day} | event
  deadline:            DeadlineRef   // following_block | end_of_day | midnight | {weekday, block} | {offset, block}
  checklist?:          { item: string, optional: bool }[]

  // event/batch/landmark-triggered chores only:
  trigger?:            { kind: "event"|"batch_attr"|"landmark", ref: string, offset?: int }
  immediate?:          bool          // true => created at trigger time, time-override applied

  // chore_modifier only:
  modifier_target?:    ChoreRef[]    // which chore(s) it affects
  modifier_effect?:    "suppress"    // removed from schedule entirely
  modifier_condition?: Condition
}
```

---

## 4. Recurring Chore Catalog

Organized by block, then frequency. IDs are provisional slugs.

### 4.1 Morning

#### Daily

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `m-brood-water` | Fill waterer | brooder (any) | derived | occupied | midmorning |
| `m-brood-feed` | Fill feeder | brooder (any) | derived | occupied | midmorning |
| `m-tractor-broiler-water` | Fill waterer | chicken_tractor | pasture (derived) | occupied | midmorning |
| `m-tractor-broiler-feed` | Fill feeder | chicken_tractor | pasture (derived) | occupied | midmorning |
| `m-tractor-move` | Move chicken tractor to fresh grass | chicken_tractor | pasture (derived) | occupied | midmorning |
| `m-coop-open` | Open mobile coop | mobile_coop | pasture (derived) | occupied | midmorning |
| `m-coop-feed` | Fill feeders | mobile_coop | pasture (derived) | occupied | midmorning |
| `m-coop-water` | Fill waterers | mobile_coop | pasture (derived) | occupied | midmorning |
| `m-sheep-water` | Fill waterer | sheep | barn | sheep present | midmorning |

#### Weekly — Monday

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `m-coop-move-weekly` | Move mobile coop to fresh grass | mobile_coop | pasture (derived) | occupied | midmorning |
| `m-coop-pwash-equip` | Pressure wash waterers and feeders | mobile_coop | pasture (derived) | occupied | end_of_day (same day) |
| `m-lawn-mow` | Mow the lawn | — (place-scoped) | house | — | late afternoon, Friday (same week) |

#### Monthly — last week of month, Monday

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `m-sheep-minerals` | Fill minerals | sheep | barn | sheep present | midmorning |
| `m-sheep-pwash-trough` | Pressure wash sheep water trough | sheep | barn | sheep present | midmorning |

### 4.2 Midmorning

#### Daily

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `mm-brood-water` | Fill waterers | brooder (any) | derived | occupied | following block |
| `mm-brood-feed` | Fill feeders | brooder (any) | derived | occupied | following block |
| `mm-coop-eggs` | Collect eggs | mobile_coop | pasture (derived) | occupied | following block |

#### Monthly — last week of month, Monday (scheduled at midmorning)

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `mm-coop-pwash-interior` | Pressure wash nest boxes and coop interior | mobile_coop | pasture (derived) | occupied | following Friday, end_of_day |

#### Every 3 months — Monday (scheduled at midmorning)

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `mm-egg-washer-clean` | Clean egg washer | — (place-scoped) | house | — | Friday, end_of_day (same week) |

#### Weekly — Mon / Wed / Fri (scheduled at midmorning)

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `mm-compost-eggs` | Compost discarded eggs | — (place-scoped) | house | — | end_of_day |

### 4.3 Early Afternoon

#### Daily

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `ea-brood-water` | Fill waterers | brooder (any) | derived | occupied | following block |
| `ea-brood-feed` | Fill feeders | brooder (any) | derived | occupied | following block |

### 4.4 Late Afternoon

#### Daily

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `la-coop-eggs` | Collect eggs | mobile_coop | pasture (derived) | occupied | following block |
| `la-tractor-rinse-water` | Rinse and refill waterer | chicken_tractor | pasture (derived) | occupied | end_of_day |
| `la-wash-eggs` | Wash eggs | — (place-scoped) | house | — | end_of_day |
| `la-coop-raise-perches` | Raise perches | mobile_coop | pasture (derived) | occupied | end_of_day |

#### Weekly — Monday

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `la-coop-grit` | Fill grit | mobile_coop | pasture (derived) | occupied | Friday, end_of_day (same week) |
| `la-coop-oyster` | Fill oyster shell | mobile_coop | pasture (derived) | occupied | Friday, end_of_day (same week) |

### 4.5 End of Day

#### Daily

| id | Name | Owner | Place | Activation | Deadline |
|----|------|-------|-------|------------|----------|
| `eod-coop-close` | Close mobile coop | mobile_coop | pasture (derived) | occupied | end_of_day |
| `eod-coop-lower-perches` | Lower perches | mobile_coop | pasture (derived) | occupied | end_of_day |
| `eod-pack-cartons` | Pack eggs into cartons | — (place-scoped) | house | — | midnight |
| `eod-add-cartons-inventory` | Add cartons to inventory | — (place-scoped) | house | — | midnight |
| `eod-refrigerate-eggs` | Refrigerate eggs | — (place-scoped) | cold_storage | — | midnight |

---

## 5. Processing Day (`processing_day`)

### 5.1 Day before — offset −1

| id | Name | Owner | Place | Block | Notes |
|----|------|-------|-------|-------|-------|
| `proc-stage-crates-trailer` | Stage chicken crates and trailer | chicken_tractor (occupied by batch due for processing) | pasture (derived) | late_afternoon | |
| `proc-stage-coolers` | Stage coolers for processing | (event) | house | late_afternoon | |

### 5.2 Day of — offset 0

| id | Name | Owner | Place | Block / Time | Deadline |
|----|------|-------|-------|--------------|----------|
| `proc-load-crates` | Load chickens into crates | chicken_tractor (occupied) | pasture (derived) | 3:00 AM–5:30 AM | none (forced by departure for processor) |
| `proc-pwash-crates` | Pressure wash chicken crates | (event) | barn | early_afternoon | early_afternoon |
| `proc-pwash-deck` | Pressure wash deck over trailer | (event) | barn | early_afternoon | early_afternoon |
| `proc-tractor-reset` | Clean out and reset chicken tractors | chicken_tractor (previously occupied by birds sent for processing) | pasture (derived) | early_afternoon | early_afternoon |

### 5.3 Day after — offset +1

| id | Name | Owner | Place | Block | Deadline |
|----|------|-------|-------|-------|----------|
| `proc-pickup` | Pick up chicken from processor | (event) | — (place-less) | morning | late afternoon, Friday (same week) |

> `proc-pickup` is scheduled for the morning of the day after processing, but the
> deadline is late-afternoon Friday of the same week, giving a variable window
> depending on the processing weekday (Mon → 4 days, Wed → 2 days). Always
> overridable.

### 5.4 On return — manual landmark `returned_from_processor`

All immediate (trigger-time override), deadline **end of day**.

| id | Name | Owner | Place | Deadline |
|----|------|-------|-------|----------|
| `proc-sort-freezers` | Sort chicken by lot in freezers | (event) | cold_storage | end_of_day |
| `proc-log-inventory` | Log chicken in inventory | (event) | cold_storage | end_of_day |
| `proc-sanitize-coolers` | Sanitize coolers | (event) | house | end_of_day |

> `proc-sort-freezers` + `proc-log-inventory` together cover creating inventory lots
> from a processing run; no separate lot-creation chore is needed.

---

## 6. Other Triggered Chores

### 6.1 Chore Modifier — pre-processing feed withhold

| id | Trigger | Condition | Effect |
|----|---------|-----------|--------|
| `mod-proc-no-feed` | `processing_day`, offset −1 (day before) | Any chicken tractor occupied by a batch due for processing the following day | **Suppress** the fill-feeder chore for those tractors across `early_afternoon`, `late_afternoon`, and `end_of_day`. Suppressed chores are removed from the schedule entirely. Rationale: birds should not be fed after midday before processing. |

### 6.2 Broiler Batch Move to Pasture (batch-attribute trigger)

A broiler batch has a `move_to_pasture_date` attribute, **empty at batch creation**
and **set manually per batch**. There is no standalone "move to tractors" event —
setting this date is the trigger. (Originating context: a broiler batch is received,
then someone sets its move-to-pasture date.) When the date is set, schedule:

| id | Name | Owner | Place | Schedule | Deadline |
|----|------|-------|-------|----------|----------|
| `batch-clean-brooders` | Clean out previously occupied brooders | brooder (just vacated by this batch) | derived | midmorning on the move_to_pasture_date | midmorning |

> The move normally happens in the morning block, so the clean-out is scheduled for
> midmorning that day (computed from the date, not contingent on the actual move
> time). The system should also surface a standing need to get `move_to_pasture_date`
> filled in for batches where it's still empty.

### 6.3 Farmers Market / Pop-up (`farmers_market_or_popup`)

#### Before the market

| id | Name | Owner | Place | Schedule | Deadline |
|----|------|-------|-------|----------|----------|
| `mkt-prep-preorders` | Prep preorders | (event) | house | 3 days prior, midmorning | end_of_day the night before the market |
| `mkt-load-vehicle` | Load farmers market equipment into vehicle | (event) | house | 1 day prior | early_afternoon, day of market |

**`mkt-load-vehicle` checklist:**

- tent
- tent weights
- black crate with yellow lid
- clear crate
- 8' table
- 6' table *(optional)*
- chair(s)
- sandwich board with graphics
- sandwich board with prices
- cash box
- coolers of eggs
- coolers of chicken
- shopping bags
- hand truck *(optional)*
- 2 × green straps
- hanging photography *(optional)*

#### On return — manual landmark `returned_from_market`

All immediate (trigger-time override), deadline **end of day**.

| id | Name | Owner | Place | Deadline |
|----|------|-------|-------|----------|
| `mkt-return-inventory` | Return unsold product to inventory | (event) | cold_storage | end_of_day |
| `mkt-cash-out` | Cash out the cash box | (event) | house | end_of_day |
| `mkt-sanitize-coolers` | Sanitize coolers | (event) | house | end_of_day |

---

## 7. Dashboard Requirements (non-chore)

- **Manual landmark actions** to record events whose timing isn't known in advance:
  - "Picked up from processor" / "Heading back from processor" → fires
    `returned_from_processor` (creates `proc-sort-freezers`, `proc-log-inventory`,
    `proc-sanitize-coolers`).
  - "Returned from market / pop-up" → fires `returned_from_market` (creates
    `mkt-return-inventory`, `mkt-cash-out`, `mkt-sanitize-coolers`).
- Landmark-triggered chores are created **immediately** with a **trigger-time
  override** and an **end-of-day** deadline.
- **Batch `move_to_pasture_date`** is a manually-set, per-batch field; setting it
  schedules `batch-clean-brooders`. Surface a reminder when it's unset.
- All event/batch/landmark-derived chores must be **manually overridable** on the fly.

---

## 8. Personal / One-off TODOs (not system chores)

- Shoot new photos of the farm to hang at the market.

---

## 9. Resolved Decisions

1. **Sheep activation** — sheep chores carry a **"sheep present" occupancy
   condition**; they don't appear when the sheep aren't on the farm.
2. **Place derivation** — handled by an existing mechanism, **out of scope** here.
   Derived-place chores can assume the current pasture/pen is resolvable.
3. **Late-afternoon "collect eggs" deadline** — **following block**.
4. **`proc-pickup` location** — **place-less**; processor is not a registry place.
5. **Egg-handling owner** — egg chores at the house are **place-scoped** (house /
   cold_storage), no animal owner; the `layers` owner type was removed.
6. **Broiler move trigger** — not a standalone event; triggered by the batch's
   **`move_to_pasture_date`** being set manually (§6.2).
7. **Inventory lots from processing** — covered by `proc-sort-freezers` +
   `proc-log-inventory`; no separate lot-creation chore needed.
