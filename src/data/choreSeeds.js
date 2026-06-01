// Chore seed data. Kept in JS (not JSON) so we can use factories to avoid
// repeating the huge number of shared fields across morning/afternoon/evening
// variants of the same routine. The shape returned is the canonical chore
// definition record; when we migrate to Supabase, a seed script reads this
// module and inserts one row per entry.
//
// Chore definition schema:
//   id: string                           stable identifier
//   title: string                        short human-readable label
//   category: string                     mobile_coops | sheep | chicken_tractors | brooders | wash_eggs
//   description?: string                 optional extra context
//   frequency: object                    see below
//   period: "morning" | "afternoon" | "evening" | "anytime"
//   startTime: "HH:MM"                   24h. Evening chores use the 20:00 placeholder but the UI renders them as "after sunset".
//   deadline: object                     see below
//   assignment: null | {default, byDayOfWeek?}
//   tags: string[]
//
// frequency variants:
//   {type:"daily"}                                      — every day
//   {type:"specific_days", days:[2,5]}                  — Tue & Fri (JS Sun=0…Sat=6)
//   {type:"weekly_window", preferredDay, latestDay}     — do Mon, may slip through Fri
//   {type:"monthly_last_week_window", preferredDay, latestDay}  — last week of month, ditto
//
// deadline variants:
//   {type:"offset_hours", hours:2}           — N hours after startTime
//   {type:"end_of_day"}                      — 23:59 same day
//   {type:"end_of_week_friday"}              — Fri 23:59 of the containing week
//   {type:"end_of_month_week_friday"}        — Fri 23:59 of the last week of month

const DAILY = { type: "daily" };
const DEADLINE_2H = { type: "offset_hours", hours: 2 };
const DEADLINE_EOD = { type: "end_of_day" };
const DEADLINE_FRI = { type: "end_of_week_friday" };
const DEADLINE_MONTH_FRI = { type: "end_of_month_week_friday" };

// Factory for a daily chore in a given period.
function daily({ id, title, category, description, tags = [], period, startTime, deadline }) {
  return {
    id, title, category, description,
    frequency: DAILY, period, startTime,
    deadline: deadline || (period === "evening" ? DEADLINE_EOD : DEADLINE_2H),
    assignment: null,
    tags
  };
}

// Groups of chores that share the same (period, startTime, category) except
// for id/title/description/tags. Reduces repetition.
function dailyGroup(period, startTime, category, items) {
  return items.map(([id, title, description, tags = []]) =>
    daily({ id, title, category, description, tags, period, startTime })
  );
}

const MORNING = ["morning", "08:00"];
const AFTERNOON = ["afternoon", "14:00"];
const EVENING = ["evening", "20:00"];

const LAYERS = ["layers"];
const BROILERS = ["broilers"];
const SHEEP = ["sheep"];
const DATA = (...rest) => [...rest, "data-capture"];

export const CHORE_SEEDS = [
  // ── MORNING (~8 AM) ──────────────────────────────────────────────────────
  // Titles are kept short — the category column ("Mobile coops", "Sheep",
  // etc.) is rendered next to the title everywhere a chore appears, so any
  // species/equipment qualifier in the title would be redundant.
  ...dailyGroup(...MORNING, "mobile_coops", [
    ["mc_open_am", "Open coops", "Open the doors of the mobile coops to release layers for the day.", LAYERS],
    ["mc_dump_feed_am", "Dump leftover feed", null, LAYERS],
    ["mc_fill_feeders_am", "Fill feeders", "Amount per feed schedule.", [...LAYERS, "feed"]],
    ["mc_fill_water_am", "Fill waterers / water reservoir", null, LAYERS],
    ["mc_collect_eggs_am", "Collect eggs", null, DATA(...LAYERS)],
    ["mc_log_obs_am", "Log mortalities and observations", null, DATA(...LAYERS)]
  ]),
  ...dailyGroup(...MORNING, "sheep", [
    ["sheep_feed_am", "Feed — 1 flake of hay", "Currently 1 flake of hay in the morning. See feed schedule.", [...SHEEP, "feed"]],
    ["sheep_water_am", "Check / fill waterer", null, SHEEP]
  ]),
  ...dailyGroup(...MORNING, "chicken_tractors", [
    ["ct_move_am", "Move to fresh grass", null, [...BROILERS, "pasture"]],
    ["ct_dump_feed_am", "Dump leftover feed", null, BROILERS],
    ["ct_fill_feeders_am", "Fill feeders", "Amount per feed schedule.", [...BROILERS, "feed"]],
    ["ct_dump_waterers_am", "Dump / rinse waterers", null, BROILERS],
    ["ct_fill_water_am", "Fill water reservoir", null, BROILERS],
    ["ct_log_obs_am", "Log mortalities and observations", null, DATA(...BROILERS)]
  ]),
  ...dailyGroup(...MORNING, "brooders", [
    ["brooder_dump_feed_am", "Dump leftover feed", null, BROILERS],
    ["brooder_fill_feeders_am", "Fill feeders", "Amount per feed schedule.", [...BROILERS, "feed"]],
    ["brooder_dump_waterers_am", "Dump / rinse waterers", null, BROILERS],
    ["brooder_fill_water_am", "Fill water reservoir", "If chicks are 10 days or younger, fill with 95°F water.", [...BROILERS, "brooder"]],
    ["brooder_check_bedding_am", "Check bedding", null, [...BROILERS, "brooder"]],
    ["brooder_log_temp_am", "Log temperature, mortalities, and observations", null, DATA(...BROILERS, "brooder")]
  ]),

  // ── AFTERNOON (~2 PM) ────────────────────────────────────────────────────
  ...dailyGroup(...AFTERNOON, "mobile_coops", [
    ["mc_dump_feed_pm", "Dump leftover feed", null, LAYERS],
    ["mc_fill_feeders_pm", "Fill feeders", "Amount per feed schedule.", [...LAYERS, "feed"]],
    ["mc_fill_water_pm", "Fill waterers / water reservoir", null, LAYERS],
    ["mc_collect_eggs_pm", "Collect eggs", null, DATA(...LAYERS)],
    ["mc_raise_perches_pm", "Raise perches", null, LAYERS],
    ["mc_log_obs_pm", "Log mortalities and observations", null, DATA(...LAYERS)]
  ]),
  ...dailyGroup(...AFTERNOON, "sheep", [
    ["sheep_feed_pm", "Feed — half scoop of grain", "Currently a half scoop of grain in the afternoon. See feed schedule.", [...SHEEP, "feed"]],
    ["sheep_water_pm", "Check / fill waterer", null, SHEEP]
  ]),
  ...dailyGroup(...AFTERNOON, "chicken_tractors", [
    ["ct_move_pm", "Move to fresh grass", null, [...BROILERS, "pasture"]],
    ["ct_dump_feed_pm", "Dump leftover feed", null, BROILERS],
    ["ct_fill_feeders_pm", "Fill feeders", "Amount per feed schedule.", [...BROILERS, "feed"]],
    ["ct_dump_waterers_pm", "Dump / rinse waterers", null, BROILERS],
    ["ct_fill_water_pm", "Fill water reservoir", null, BROILERS],
    ["ct_log_obs_pm", "Log mortalities and observations", null, DATA(...BROILERS)]
  ]),
  ...dailyGroup(...AFTERNOON, "brooders", [
    ["brooder_dump_feed_pm", "Dump leftover feed", null, BROILERS],
    ["brooder_fill_feeders_pm", "Fill feeders", "Amount per feed schedule.", [...BROILERS, "feed"]],
    ["brooder_dump_waterers_pm", "Dump / rinse waterers", null, BROILERS],
    ["brooder_fill_water_pm", "Fill water reservoir", "If chicks are 10 days or younger, fill with 95°F water.", [...BROILERS, "brooder"]],
    ["brooder_check_bedding_pm", "Check bedding", null, [...BROILERS, "brooder"]],
    ["brooder_log_temp_pm", "Log temperature, mortalities, and observations", null, DATA(...BROILERS, "brooder")]
  ]),
  ...dailyGroup(...AFTERNOON, "wash_eggs", [
    ["wash_eggs_pm", "Wash eggs collected during the day", "Wash all eggs collected during the day, leave out to dry.", LAYERS]
  ]),

  // ── EVENING (after sunset) ───────────────────────────────────────────────
  ...dailyGroup(...EVENING, "mobile_coops", [
    ["mc_close_eve", "Close coops", null, LAYERS],
    ["mc_lower_perches_eve", "Lower perches", null, LAYERS],
    ["mc_log_obs_eve", "Log mortalities and observations", null, DATA(...LAYERS)]
  ]),
  ...dailyGroup(...EVENING, "sheep", [
    ["sheep_water_eve", "Check / fill waterer", null, SHEEP]
  ]),
  ...dailyGroup(...EVENING, "chicken_tractors", [
    ["ct_move_eve", "Move to fresh grass", null, [...BROILERS, "pasture"]],
    ["ct_check_water_eve", "Check / fill water reservoir", null, BROILERS],
    ["ct_log_obs_eve", "Log mortalities and observations", null, DATA(...BROILERS)]
  ]),
  ...dailyGroup(...EVENING, "brooders", [
    ["brooder_check_water_eve", "Check / fill water reservoir", "If chicks are 10 days or younger, fill with 95°F water.", [...BROILERS, "brooder"]],
    ["brooder_log_temp_eve", "Log temperature, mortalities, and observations", null, DATA(...BROILERS, "brooder")]
  ]),
  ...dailyGroup(...EVENING, "wash_eggs", [
    ["eggs_pack_eve", "Pack eggs into cartons", null, LAYERS],
    ["eggs_refrigerate_eve", "Refrigerate eggs", null, LAYERS],
    ["eggs_inventory_eve", "Add cartons to inventory", null, DATA(...LAYERS)]
  ]),

  // ── TWICE WEEKLY (Tue & Fri ~9 AM) ───────────────────────────────────────
  {
    id: "move_mobile_coops", title: "Move coops", category: "mobile_coops",
    description: "Relocate mobile coops within the layer pasture using the tractor.",
    frequency: { type: "specific_days", days: [2, 5] },
    period: "morning", startTime: "09:00",
    deadline: DEADLINE_EOD,
    assignment: null, tags: [...LAYERS, "tractor"]
  },

  // ── WEEKLY (Mon ~2 PM, by sunset Fri) ────────────────────────────────────
  ...[
    ["weekly_grit", "Check / fill grit", "mobile_coops", [...LAYERS, "weekly"]],
    ["weekly_oyster_shell", "Check / fill oyster shell", "mobile_coops", [...LAYERS, "weekly"]],
    ["weekly_sheep_minerals", "Check / fill minerals", "sheep", [...SHEEP, "weekly"]],
    ["weekly_clean_nest_grate", "Clean dust from nest box grate", "mobile_coops", [...LAYERS, "weekly"]],
    ["weekly_powerwash_waterers", "Power wash waterers", "mobile_coops", ["weekly"]],
    ["weekly_powerwash_feeders", "Power wash feeders", "mobile_coops", ["weekly"]]
  ].map(([id, title, category, tags]) => ({
    id, title, category,
    frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    period: "afternoon", startTime: "14:00",
    deadline: DEADLINE_FRI,
    assignment: null, tags
  })),

  // ── MONTHLY (last week of month, Mon ~2 PM, by sunset Fri) ───────────────
  ...[
    ["monthly_mc_powerwash", "Interior power wash", [...LAYERS, "monthly"]],
    ["monthly_nest_deep_clean", "Nest box deep clean", [...LAYERS, "monthly"]]
  ].map(([id, title, tags]) => ({
    id, title, category: "mobile_coops",
    frequency: { type: "monthly_last_week_window", preferredDay: 1, latestDay: 5 },
    period: "afternoon", startTime: "14:00",
    deadline: DEADLINE_MONTH_FRI,
    assignment: null, tags
  })),

  // ── DEMO: overnight check (3 AM daily) ──────────────────────────────────
  // Exercises the schedule timeline's pre-morning highlight + the
  // "Tomorrow" subheading. Treated as an evening-period chore because
  // anything starting before 5 AM is bucketed there per the time-window
  // spec.
  daily({
    id: "demo_overnight_check",
    title: "Overnight brooder check",
    category: "brooders",
    description: "Demo chore — peek at the brooders before sunrise.",
    tags: ["demo", "overnight"],
    period: "evening",
    startTime: "03:00",
    deadline: DEADLINE_2H
  }),

  // ── DEMO: morning chores assigned to Jim ────────────────────────────────
  // Lets the schedule timeline show Tomorrow's morning chores under the
  // Tomorrow heading with the assignee's name in the right column.
  {
    ...daily({
      id: "demo_morning_assigned",
      title: "Walk the layers' coop perimeter",
      category: "mobile_coops",
      description: "Demo chore — pretend Jim takes morning today.",
      tags: ["demo", "assigned"],
      period: "morning",
      startTime: "08:00",
      deadline: DEADLINE_2H
    }),
    assignment: { default: "Jim" }
  }
];

// Category display metadata.
export const CHORE_CATEGORIES = {
  mobile_coops: { label: "Mobile coops", order: 1 },
  sheep: { label: "Sheep", order: 2 },
  chicken_tractors: { label: "Chicken tractors", order: 3 },
  brooders: { label: "Brooders", order: 4 },
  wash_eggs: { label: "Wash eggs", order: 5 },
  // One-time chores created by automations (feed orders, brooder
  // cleanouts after a batch moves to pasture). They retire on
  // completion instead of recurring.
  one_time: { label: "One-time", order: 6 }
};

// Period display metadata.
export const CHORE_PERIODS = {
  morning: { label: "Morning", hint: "8 AM", order: 1 },
  afternoon: { label: "Afternoon", hint: "2 PM", order: 2 },
  evening: { label: "Evening", hint: "after sunset", order: 3 },
  anytime: { label: "Anytime", hint: "", order: 4 }
};
