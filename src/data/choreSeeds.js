// Chore seed data — REBUILT to the chore spec
// (docs/specs/nff-chores-spec.md), per the staged plan in
// docs/history/records/chores-rebuild-reconciliation.md. This module is the
// source of truth Phase C reads to (re)insert chore_definitions on the
// live DB; it writes no rows itself.
//
// What changed vs. the organically-grown seed set:
//   * The 3-period model (morning/afternoon/evening) is replaced by the
//     spec's 5 daily BLOCKS (morning, midmorning, early_afternoon,
//     late_afternoon, end_of_day), referenced by stable slug.
//   * Chores carry an OWNER (the animal/equipment they belong to and
//     follow around the farm), not a display `category`. The `layers`
//     owner is gone — egg work at the house is place-scoped.
//   * Deadlines are BLOCK-REFERENCE jsonb (Option A hybrid), not
//     clock-hour offsets.
//   * Recurrence gains the generalized `every_n` variant (months, etc.).
//   * Checklists ride on the chore (mkt-load-vehicle) — Phase C splits
//     them into chore_checklist_items (migration 0033).
//   * Event/process- and batch-triggered chores (§5, §6) live in their
//     own exports with `trigger` metadata; the recurring engine treats
//     them as inert (`frequency.type === "event"`).
//   * The two demo_* chores are dropped.
//
// Manual landmarks are ON HOLD (no engine foundation yet). The six
// post-return chores are captured in DEFERRED_LANDMARK_CHORES but are
// NOT seeded.
//
// ── Chore definition schema (new shape) ──────────────────────────────
//   id:          string   stable identifier
//   title:       string   short human-readable label (spec "name")
//   type:        "chore" | "chore_modifier"
//   block:       BlockSlug | null   one of the 5 block slugs below
//   owner:       "brooder" | "chicken_tractor" | "mobile_coop" |
//                "sheep" | "none" | "event"
//   place:       PlaceSlug | "derived" | null
//                fixed: brooder_one | mobile_brooder | pasture | barn |
//                house | cold_storage. "derived" = resolved from a
//                mobile owner's current location. null = place-less.
//   activation:  "owner_occupied" | "sheep_present" | "always" | "event"
//   frequency:   Frequency  (see below)
//   deadline:    Deadline   (block-reference jsonb, see below)
//   description?: string | null
//   tags?:       string[]
//   checklist?:  { label, optional }[]   (mkt-load-vehicle only)
//   trigger?:    { kind, ref, offset? }  (event/batch/landmark chores)
//   scheduleOffsetDays?: int  spawn day relative to the event/trigger
//   timeWindow?: { start, end }  fixed clock window (proc-load-crates)
//   immediate?:  bool  created at trigger time (landmark chores)
//
// frequency variants:
//   { type:"daily" }
//   { type:"weekly", days:[1] }              JS Sun=0…Sat=6 (1 = Mon)
//   { type:"monthly_last_week", day:1 }      last week of month, weekday
//   { type:"every_n", n:3, unit:"months", day:1 }
//                                            unit ∈ days|weeks|months|years
//   { type:"event" }                         triggered, no recurrence
//
// deadline variants (Option A hybrid — block slugs, rename-proof):
//   { kind:"following_block" }               due by start of next block
//   { kind:"block", block:"end_of_day" }     due by that block, same day
//   { kind:"midnight" }                      natural end of calendar day
//   { kind:"block_on_weekday", weekday:5,
//     block:"end_of_day" }                   next weekday ≥ sched. date
//   { kind:"block_at_offset", offset_days:-1,
//     block:"end_of_day" }                   block N days from the event
//   { kind:"none" }                          no deadline (externally forced)

// ── Block slugs ──────────────────────────────────────────────────────
const MORNING = "morning";
const MIDMORNING = "midmorning";
const EARLY_AFTERNOON = "early_afternoon";
const LATE_AFTERNOON = "late_afternoon";
const END_OF_DAY = "end_of_day";

// Weekday constants (JS getDay(): Sun=0…Sat=6).
const MON = 1;
const WED = 3;
const FRI = 5;

// ── Deadline builders ────────────────────────────────────────────────
const followingBlock = () => ({ kind: "following_block" });
const byBlock = (block) => ({ kind: "block", block });
const byMidnight = () => ({ kind: "midnight" });
const noDeadline = () => ({ kind: "none" });
const byWeekdayBlock = (weekday, block) =>
  ({ kind: "block_on_weekday", weekday, block });
const byEventOffsetBlock = (offsetDays, block) =>
  ({ kind: "block_at_offset", offset_days: offsetDays, block });

// ── Frequency builders ───────────────────────────────────────────────
const DAILY = { type: "daily" };
const weekly = (...days) => ({ type: "weekly", days });
const monthlyLastWeek = (day) => ({ type: "monthly_last_week", day });
const everyN = (n, unit, day) => ({ type: "every_n", n, unit, day });
const EVENT = { type: "event" };

// ── Owner / place / activation presets ───────────────────────────────
// "Chores belong to the animal or movable equipment, not the place they
// occupy." Mobile owners derive their place from current location.
const BROODER = { owner: "brooder", place: "derived",
  activation: "owner_occupied" };
const TRACTOR = { owner: "chicken_tractor", place: "derived",
  activation: "owner_occupied" };
const COOP = { owner: "mobile_coop", place: "derived",
  activation: "owner_occupied" };
const SHEEP_BARN = { owner: "sheep", place: "barn",
  activation: "sheep_present" };
const AT_HOUSE = { owner: "none", place: "house", activation: "always" };
const AT_COLD = { owner: "none", place: "cold_storage",
  activation: "always" };

// Build a chore record, dropping undefined optional keys so the seed
// stays tidy. `base` carries the owner/place/activation preset.
function chore(base, o) {
  const rec = {
    id: o.id,
    title: o.title,
    type: o.type || "chore",
    block: o.block ?? null,
    owner: base.owner,
    place: base.place,
    activation: base.activation,
    frequency: o.frequency || DAILY,
    deadline: o.deadline,
    description: o.description ?? null,
    tags: o.tags ?? [],
  };
  if (o.checklist) rec.checklist = o.checklist;
  if (o.trigger) rec.trigger = o.trigger;
  if (o.scheduleOffsetDays != null) {
    rec.scheduleOffsetDays = o.scheduleOffsetDays;
  }
  if (o.timeWindow) rec.timeWindow = o.timeWindow;
  if (o.immediate) rec.immediate = true;
  return rec;
}

// ── §6.3 mkt-load-vehicle checklist ──────────────────────────────────
const MKT_LOAD_CHECKLIST = [
  { label: "Tent", optional: false },
  { label: "Tent weights", optional: false },
  { label: "Black crate with yellow lid", optional: false },
  { label: "Clear crate", optional: false },
  { label: "8' table", optional: false },
  { label: "6' table", optional: true },
  { label: "Chair(s)", optional: false },
  { label: "Sandwich board with graphics", optional: false },
  { label: "Sandwich board with prices", optional: false },
  { label: "Cash box", optional: false },
  { label: "Coolers of eggs", optional: false },
  { label: "Coolers of chicken", optional: false },
  { label: "Shopping bags", optional: false },
  { label: "Hand truck", optional: true },
  { label: "2 × green straps", optional: false },
  { label: "Hanging photography", optional: true },
];

// ─────────────────────────────────────────────────────────────────────
// §4 — RECURRING CHORE CATALOG
// ─────────────────────────────────────────────────────────────────────
export const CHORE_SEEDS = [
  // ── 4.1 Morning ────────────────────────────────────────────────────
  // Daily — deadline "midmorning" = the following block.
  chore(BROODER, { id: "m-brood-water", title: "Fill waterer",
    block: MORNING, deadline: followingBlock() }),
  chore(BROODER, { id: "m-brood-feed", title: "Fill feeder",
    block: MORNING, deadline: followingBlock() }),
  chore(TRACTOR, { id: "m-tractor-broiler-water", title: "Fill waterer",
    block: MORNING, deadline: followingBlock() }),
  chore(TRACTOR, { id: "m-tractor-broiler-feed", title: "Fill feeder",
    block: MORNING, deadline: followingBlock(),
    tags: ["feed"],
    description:
      "Last feed the day before processing — the withhold "
      + "(mod-proc-no-feed) starts midmorning, so this one stands." }),
  chore(TRACTOR, { id: "m-tractor-move",
    title: "Move chicken tractor to fresh grass",
    block: MORNING, deadline: followingBlock() }),
  chore(COOP, { id: "m-coop-open", title: "Open mobile coop",
    block: MORNING, deadline: followingBlock() }),
  chore(COOP, { id: "m-coop-feed", title: "Fill feeders",
    block: MORNING, deadline: followingBlock() }),
  chore(COOP, { id: "m-coop-water", title: "Fill waterers",
    block: MORNING, deadline: followingBlock() }),
  chore(SHEEP_BARN, { id: "m-sheep-water", title: "Fill waterer",
    block: MORNING, deadline: followingBlock() }),

  // Weekly — Monday.
  chore(COOP, { id: "m-coop-move-weekly",
    title: "Move mobile coop to fresh grass",
    block: MORNING, frequency: weekly(MON),
    deadline: followingBlock() }),
  chore(COOP, { id: "m-coop-pwash-equip",
    title: "Pressure wash waterers and feeders",
    block: MORNING, frequency: weekly(MON),
    deadline: byBlock(END_OF_DAY) }),
  chore(AT_HOUSE, { id: "m-lawn-mow", title: "Mow the lawn",
    block: MORNING, frequency: weekly(MON),
    deadline: byWeekdayBlock(FRI, LATE_AFTERNOON) }),

  // Monthly — last week of month, Monday.
  chore(SHEEP_BARN, { id: "m-sheep-minerals", title: "Fill minerals",
    block: MORNING, frequency: monthlyLastWeek(MON),
    deadline: followingBlock() }),
  chore(SHEEP_BARN, { id: "m-sheep-pwash-trough",
    title: "Pressure wash sheep water trough",
    block: MORNING, frequency: monthlyLastWeek(MON),
    deadline: followingBlock() }),

  // ── 4.2 Midmorning ─────────────────────────────────────────────────
  // Daily.
  chore(BROODER, { id: "mm-brood-water", title: "Fill waterers",
    block: MIDMORNING, deadline: followingBlock() }),
  chore(BROODER, { id: "mm-brood-feed", title: "Fill feeders",
    block: MIDMORNING, deadline: followingBlock() }),
  chore(TRACTOR, { id: "mm-tractor-water", title: "Fill waterer",
    block: MIDMORNING, deadline: followingBlock() }),
  chore(TRACTOR, { id: "mm-tractor-feed", title: "Fill feeder",
    block: MIDMORNING, deadline: followingBlock(), tags: ["feed"],
    description:
      "Withheld the day before processing — see mod-proc-no-feed." }),
  chore(COOP, { id: "mm-coop-water", title: "Fill waterers",
    block: MIDMORNING, deadline: followingBlock() }),
  chore(COOP, { id: "mm-coop-feed", title: "Fill feeders",
    block: MIDMORNING, deadline: followingBlock() }),
  chore(COOP, { id: "mm-coop-eggs", title: "Collect eggs",
    block: MIDMORNING, deadline: followingBlock(),
    tags: ["data-capture"] }),

  // Monthly — last week of month, Monday.
  chore(COOP, { id: "mm-coop-pwash-interior",
    title: "Pressure wash nest boxes and coop interior",
    block: MIDMORNING, frequency: monthlyLastWeek(MON),
    deadline: byWeekdayBlock(FRI, END_OF_DAY) }),

  // Every 3 months — Monday.
  chore(AT_HOUSE, { id: "mm-egg-washer-clean", title: "Clean egg washer",
    block: MIDMORNING, frequency: everyN(3, "months", MON),
    deadline: byWeekdayBlock(FRI, END_OF_DAY) }),

  // Weekly — Mon / Wed / Fri.
  chore(AT_HOUSE, { id: "mm-compost-eggs",
    title: "Compost discarded eggs",
    block: MIDMORNING, frequency: weekly(MON, WED, FRI),
    deadline: byBlock(END_OF_DAY) }),

  // ── 4.3 Early Afternoon ────────────────────────────────────────────
  chore(BROODER, { id: "ea-brood-water", title: "Fill waterers",
    block: EARLY_AFTERNOON, deadline: followingBlock() }),
  chore(BROODER, { id: "ea-brood-feed", title: "Fill feeders",
    block: EARLY_AFTERNOON, deadline: followingBlock() }),
  chore(COOP, { id: "ea-coop-water", title: "Fill waterers",
    block: EARLY_AFTERNOON, deadline: followingBlock() }),
  chore(COOP, { id: "ea-coop-feed", title: "Fill feeders",
    block: EARLY_AFTERNOON, deadline: followingBlock() }),

  // ── 4.4 Late Afternoon ─────────────────────────────────────────────
  // Daily — "collect eggs" deadline is the following block (decision #3).
  chore(BROODER, { id: "la-brood-water", title: "Fill waterers",
    block: LATE_AFTERNOON, deadline: followingBlock() }),
  chore(BROODER, { id: "la-brood-feed", title: "Fill feeders",
    block: LATE_AFTERNOON, deadline: followingBlock() }),
  chore(COOP, { id: "la-coop-eggs", title: "Collect eggs",
    block: LATE_AFTERNOON, deadline: followingBlock(),
    tags: ["data-capture"] }),
  chore(COOP, { id: "la-coop-water", title: "Fill waterers",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY) }),
  chore(COOP, { id: "la-coop-feed", title: "Fill feeders",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY) }),
  chore(TRACTOR, { id: "la-tractor-rinse-water",
    title: "Rinse and refill waterer",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY),
    description:
      "The late-afternoon tractor water fill (thorough: rinse first)." }),
  chore(TRACTOR, { id: "la-tractor-feed", title: "Fill feeder",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY), tags: ["feed"],
    description:
      "Withheld the day before processing — see mod-proc-no-feed." }),
  chore(AT_HOUSE, { id: "la-wash-eggs", title: "Wash eggs",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY) }),
  chore(COOP, { id: "la-coop-raise-perches", title: "Raise perches",
    block: LATE_AFTERNOON, deadline: byBlock(END_OF_DAY) }),

  // Weekly — Monday.
  chore(COOP, { id: "la-coop-grit", title: "Fill grit",
    block: LATE_AFTERNOON, frequency: weekly(MON),
    deadline: byWeekdayBlock(FRI, END_OF_DAY) }),
  chore(COOP, { id: "la-coop-oyster", title: "Fill oyster shell",
    block: LATE_AFTERNOON, frequency: weekly(MON),
    deadline: byWeekdayBlock(FRI, END_OF_DAY) }),

  // ── 4.5 End of Day ─────────────────────────────────────────────────
  chore(COOP, { id: "eod-coop-close", title: "Close mobile coop",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY) }),
  chore(COOP, { id: "eod-coop-lower-perches", title: "Lower perches",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY) }),
  chore(COOP, { id: "eod-coop-water", title: "Fill waterers",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY) }),
  chore(COOP, { id: "eod-coop-feed", title: "Fill feeders",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY) }),
  chore(TRACTOR, { id: "eod-tractor-water", title: "Fill waterer",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY) }),
  chore(TRACTOR, { id: "eod-tractor-feed", title: "Fill feeder",
    block: END_OF_DAY, deadline: byBlock(END_OF_DAY), tags: ["feed"],
    description:
      "Withheld the day before processing — see mod-proc-no-feed." }),
  chore(AT_HOUSE, { id: "eod-pack-cartons",
    title: "Pack eggs into cartons",
    block: END_OF_DAY, deadline: byMidnight() }),
  chore(AT_HOUSE, { id: "eod-add-cartons-inventory",
    title: "Add cartons to inventory",
    block: END_OF_DAY, deadline: byMidnight(),
    tags: ["data-capture"] }),
  chore(AT_COLD, { id: "eod-refrigerate-eggs", title: "Refrigerate eggs",
    block: END_OF_DAY, deadline: byMidnight() }),
];

// ─────────────────────────────────────────────────────────────────────
// §5 / §6.3 — EVENT-TRIGGERED CHORES
// Spawned by a calendar event (processing day, farmers market). Phase B2
// wires these onto the Processes subsystem (process_steps spawning
// chores, not tasks — audit F85). `frequency: EVENT` keeps them inert in
// the recurring engine. `trigger.offset` / `scheduleOffsetDays` are the
// spawn day relative to the event date.
// ─────────────────────────────────────────────────────────────────────
const EVENT_OF = (ref, offset) => ({ kind: "event", ref, offset });
const PROC = "processing_day";
const MARKET = "farmers_market_or_popup";
const AS_EVENT = { owner: "event", place: "house", activation: "event" };
const AS_EVENT_BARN = { owner: "event", place: "barn",
  activation: "event" };
const AS_EVENT_COLD = { owner: "event", place: "cold_storage",
  activation: "event" };
const AS_EVENT_NOWHERE = { owner: "event", place: null,
  activation: "event" };

export const EVENT_CHORES = [
  // ── §5.1 Processing — day before (offset −1) ───────────────────────
  chore(TRACTOR, { id: "proc-stage-crates-trailer",
    title: "Stage chicken crates and trailer",
    block: LATE_AFTERNOON, frequency: EVENT,
    trigger: EVENT_OF(PROC, -1), scheduleOffsetDays: -1,
    deadline: byBlock(END_OF_DAY),
    description:
      "Tractor occupied by the batch due for processing tomorrow." }),
  chore(AS_EVENT, { id: "proc-stage-coolers",
    title: "Stage coolers for processing",
    block: LATE_AFTERNOON, frequency: EVENT,
    trigger: EVENT_OF(PROC, -1), scheduleOffsetDays: -1,
    deadline: byBlock(END_OF_DAY) }),

  // ── §5.2 Processing — day of (offset 0) ────────────────────────────
  chore(TRACTOR, { id: "proc-load-crates",
    title: "Load chickens into crates",
    block: MORNING, frequency: EVENT,
    trigger: EVENT_OF(PROC, 0), scheduleOffsetDays: 0,
    timeWindow: { start: "03:00", end: "05:30" },
    deadline: noDeadline(),
    description: "Forced by departure for the processor." }),
  chore(AS_EVENT_BARN, { id: "proc-pwash-crates",
    title: "Pressure wash chicken crates",
    block: EARLY_AFTERNOON, frequency: EVENT,
    trigger: EVENT_OF(PROC, 0), scheduleOffsetDays: 0,
    deadline: byBlock(EARLY_AFTERNOON) }),
  chore(AS_EVENT_BARN, { id: "proc-pwash-deck",
    title: "Pressure wash deck over trailer",
    block: EARLY_AFTERNOON, frequency: EVENT,
    trigger: EVENT_OF(PROC, 0), scheduleOffsetDays: 0,
    deadline: byBlock(EARLY_AFTERNOON) }),
  chore(TRACTOR, { id: "proc-tractor-reset",
    title: "Clean out and reset chicken tractors",
    block: EARLY_AFTERNOON, frequency: EVENT,
    trigger: EVENT_OF(PROC, 0), scheduleOffsetDays: 0,
    deadline: byBlock(EARLY_AFTERNOON),
    description:
      "Tractors previously occupied by birds sent for processing." }),

  // ── §5.3 Processing — day after (offset +1) ────────────────────────
  // Place-less: the processor is not a registry place (decision #4).
  chore(AS_EVENT_NOWHERE, { id: "proc-pickup",
    title: "Pick up chicken from processor",
    block: MORNING, frequency: EVENT,
    trigger: EVENT_OF(PROC, 1), scheduleOffsetDays: 1,
    deadline: byWeekdayBlock(FRI, LATE_AFTERNOON),
    description:
      "Variable window — due late-afternoon Friday of the same week." }),

  // ── §6.3 Farmers market / pop-up — before the market ───────────────
  chore(AS_EVENT, { id: "mkt-prep-preorders", title: "Prep preorders",
    block: MIDMORNING, frequency: EVENT,
    trigger: EVENT_OF(MARKET, -3), scheduleOffsetDays: -3,
    deadline: byEventOffsetBlock(-1, END_OF_DAY),
    description: "Due end of day the night before the market." }),
  chore(AS_EVENT, { id: "mkt-load-vehicle",
    title: "Load farmers market equipment into vehicle",
    block: null, frequency: EVENT,
    trigger: EVENT_OF(MARKET, -1), scheduleOffsetDays: -1,
    deadline: byEventOffsetBlock(0, EARLY_AFTERNOON),
    checklist: MKT_LOAD_CHECKLIST }),
];

// ─────────────────────────────────────────────────────────────────────
// §6.2 — BATCH-ATTRIBUTE-TRIGGERED CHORES
// Created when a broiler batch's move_to_pasture_date is set. The
// dashboard surfaces a standing need to fill that date when it's empty.
// ─────────────────────────────────────────────────────────────────────
export const BATCH_CHORES = [
  chore(BROODER, { id: "batch-clean-brooders",
    title: "Clean out previously occupied brooders",
    block: MIDMORNING, frequency: EVENT,
    trigger: { kind: "batch_attr", ref: "move_to_pasture_date" },
    scheduleOffsetDays: 0,
    deadline: followingBlock(),
    description:
      "Scheduled midmorning on the batch's move_to_pasture_date." }),
];

// ─────────────────────────────────────────────────────────────────────
// §6.1 — CHORE MODIFIERS (standing, condition-driven)
// A modifier suppresses an otherwise-scheduled chore. A suppressed chore
// does NOT appear in the schedule at all (not shown-as-skipped).
//
// The day before processing, broilers get their MORNING feed
// (m-tractor-broiler-feed stands) and then the feeder is withheld from
// midmorning on, emptying their gut for the processor. So this modifier
// suppresses the three later-block tractor feeders for any tractor
// occupied by the batch due for processing the next day. (Confirmed with
// James 2026-06-04: the later-block tractor feed/water chores were
// missing from §4 — now added in midmorning/late_afternoon/end_of_day.)
// ─────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────
// DEFERRED — manual-landmark post-return chores (§5.4, §6.3)
// Landmarks are ON HOLD: no engine foundation (no landmark trigger, no
// trigger-time override). Captured here for when/if landmarks are built;
// NOT seeded. Each is immediate (trigger-time override) with an
// end-of-day deadline.
// ─────────────────────────────────────────────────────────────────────
export const DEFERRED_LANDMARK_CHORES = [
  // returned_from_processor
  { id: "proc-sort-freezers", title: "Sort chicken by lot in freezers",
    owner: "event", place: "cold_storage", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_processor" },
    deadline: byBlock(END_OF_DAY) },
  { id: "proc-log-inventory", title: "Log chicken in inventory",
    owner: "event", place: "cold_storage", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_processor" },
    deadline: byBlock(END_OF_DAY) },
  { id: "proc-sanitize-coolers", title: "Sanitize coolers",
    owner: "event", place: "house", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_processor" },
    deadline: byBlock(END_OF_DAY) },
  // returned_from_market
  { id: "mkt-return-inventory",
    title: "Return unsold product to inventory",
    owner: "event", place: "cold_storage", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_market" },
    deadline: byBlock(END_OF_DAY) },
  { id: "mkt-cash-out", title: "Cash out the cash box",
    owner: "event", place: "house", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_market" },
    deadline: byBlock(END_OF_DAY) },
  { id: "mkt-sanitize-coolers", title: "Sanitize coolers",
    owner: "event", place: "house", immediate: true,
    trigger: { kind: "landmark", ref: "returned_from_market" },
    deadline: byBlock(END_OF_DAY) },
];

// Convenience: every active definition this rebuild seeds (recurring +
// event + batch). Excludes modifiers and the deferred landmark chores.
export const ALL_CHORE_DEFINITIONS = [
  ...CHORE_SEEDS, ...EVENT_CHORES, ...BATCH_CHORES,
];

// ── Block metadata + ids (live ids verified against prod 2026-06-04) ──
// Phase C maps `block` slug → block_id via CHORE_BLOCK_IDS. The display
// order here is chronological (the live sort_order is non-chronological
// and gets re-numbered to match during the cutover).
export const CHORE_BLOCK_IDS = {
  morning: "9f576986-7524-4e71-a6b4-4e0965f310ac",
  midmorning: "f6eeb73f-775d-48a6-9b2e-ead74acf72c0",
  early_afternoon: "b05763c7-0c46-4d0f-8d86-b4bfcaa893ad",
  late_afternoon: "e6bed0d7-931b-45d5-b61e-b6fff5306fb1",
  end_of_day: "34ca2d90-cfea-4b2d-9edb-6e9f4cf7cf5d",
};

export const CHORE_BLOCKS_META = {
  morning: { label: "Morning", hint: "early AM", order: 1 },
  midmorning: { label: "Mid-Morning", hint: "10 AM", order: 2 },
  early_afternoon: { label: "Early Afternoon", hint: "1 PM", order: 3 },
  late_afternoon: { label: "Late Afternoon", hint: "4 PM", order: 4 },
  end_of_day: { label: "End of Day", hint: "after sunset", order: 5 },
};

// Owner display metadata (supersedes CHORE_CATEGORIES).
export const CHORE_OWNERS = {
  brooder: { label: "Brooder", order: 1 },
  chicken_tractor: { label: "Chicken tractor", order: 2 },
  mobile_coop: { label: "Mobile coop", order: 3 },
  sheep: { label: "Sheep", order: 4 },
  none: { label: "Farm / house", order: 5 },
  event: { label: "Event", order: 6 },
};

// ── LEGACY display metadata — DEPRECATED ─────────────────────────────
// Retained only so the not-yet-migrated engine/UI (lib/chores.js,
// Overview.jsx, Chores.jsx, SpeciesPage.jsx) keep importing cleanly
// while the live DB still serves the old period/category shape. The
// block/owner model above supersedes both. Remove once the engine
// consumes blocks/owners (Phase C — engine swap, James-gated).
export const CHORE_CATEGORIES = {
  mobile_coops: { label: "Mobile coops", order: 1 },
  sheep: { label: "Sheep", order: 2 },
  chicken_tractors: { label: "Chicken tractors", order: 3 },
  brooders: { label: "Brooders", order: 4 },
  wash_eggs: { label: "Wash eggs", order: 5 },
  one_time: { label: "One-time", order: 6 },
};

