import { useState, useEffect, useMemo } from "react";
import {
  Sprout, Home, Bird, Egg, PawPrint, Building2, Wrench, Truck, Wheat,
  Calendar, ListChecks, Tent, Sparkles, Package,
  FolderKanban, Workflow, NotebookPen, MessageCircleQuestion,
  ChevronLeft, ChevronRight, X
} from "lucide-react";

// ===============================================================
// DATA — single source of truth. Extract by parsing this const.
// ===============================================================
const NFF_DATA = {
  meta: {
    version: "0.6.0",
    lastUpdated: "2026-05-01",
    businessName: "North Foster Farm",
    location: "Foster, Rhode Island",
    users: [
      { name: "James", role: "owner_operator" },
      { name: "Jim", role: "partner" }
    ]
  },
  livestock: {
    species: [
      {
        id: "layers", name: "Layers", purpose: "Egg production", trackingModel: "generation",
        breed: "Red Sex Link",
        feedRegimen: ["layer feed", "grit", "calcium"],
        feedNote: "All generations of layers eat the same feed, grit, and calcium.",
        acquisition: "Acquired as pullets, sourced from a small set of preferred individual suppliers.",
        groups: [
          { id: "layers_no_band", label: "No bands", ordinal: 1, count: null, arrivalDate: null, knownAge: null, currentLocation: "MC2", cohabits: "Shares MC2 with blue bands and orange bands." },
          { id: "layers_blue_band", label: "Blue bands", ordinal: 2, count: null, arrivalDate: null, knownAge: null, currentLocation: "MC2", cohabits: "Shares MC2 with no bands and orange bands." },
          { id: "layers_orange_band", label: "Orange bands", ordinal: 3, count: null, arrivalDate: "2025-10-14", knownAge: null, currentLocation: "MC2", cohabits: "Shares MC2 with no bands and blue bands." },
          { id: "layers_gold_band", label: "Gold bands", ordinal: 4, count: 200, arrivalDate: "2026-04-01", knownAge: { weeks: 16, asOfDate: "2026-05-03" }, currentLocation: "MC1", cohabits: "Kept separate. Future generations will also be kept separate from older generations." }
        ]
      },
      {
        id: "broilers", name: "Broilers", purpose: "Meat", breed: "Cornish Rock Hybrid", trackingModel: "batch",
        acquisition: "Day-old chicks shipped via USPS; shipped the same day they hatch.",
        lifecycle: [
          { stage: "Brooder", duration: "Weeks 1–3 (sometimes 4)", graduationCriteria: "Birds must be fully feathered (typically around 3 weeks).", notes: "Brooder temperature starts at 85°F in week 1 and decreases each successive week." },
          { stage: "Pasture (chicken tractors)", duration: "From brooder graduation through processing day", notes: "Chicken tractors are mobile pens with feed, water, and fencing. Moved twice daily." }
        ],
        processingTimeline: "5–7 weeks from arrival on farm",
        feedTracking: "Feed amount changes week to week; total batch feed consumption must be tracked.",
        brooderToTractorTransition: "All birds are crated and carried from the brooder to the chicken tractors.",
        constraints: [
          "Pasture-raised classification requires 51% of the bird's natural life spent on pasture. App computes this as a soft KPI per batch.",
          "Temperatures below 50°F (day or night) are considered too cold for the birds."
        ],
        groups: [
          { id: "broilers_batch_1", label: "Batch 1", ordinal: 1, count: 275, arrivalDate: null, knownAge: null, currentLocation: null, cohabits: null },
          { id: "broilers_batch_2", label: "Batch 2", ordinal: 2, count: 275, arrivalDate: null, knownAge: null, currentLocation: null, cohabits: null }
        ]
      },
      {
        id: "sheep", name: "Sheep", purpose: "Pets — no production", breed: "Katahdin", trackingModel: "individual",
        feedRegimen: ["hay"],
        feedNote: "Sheep receive flakes of hay; the chore 'give sheep a flake of hay' captures the regular feeding.",
        acquisition: "TBD",
        groups: [
          { id: "sheep_pets", label: "Lily, Ivy, and Violet", ordinal: null, count: null, arrivalDate: null, knownAge: null, currentLocation: null, cohabits: null }
        ]
      }
    ]
  },
  spaces: {
    kinds: [
      { id: "mobile_coop", label: "Mobile coop", description: "Wooden chicken coop on running gear, moved on rotation within the layer pasture.", movementMethod: "Towed by the tractor via drawbar hitch.", usedBy: "layers" },
      { id: "brooder", label: "Brooder", description: "Heated enclosure where broiler chicks spend their first 3–4 weeks. Temperature starts at 85°F in week 1 and decreases weekly.", usedBy: "broilers" },
      { id: "pasture", label: "Pasture", description: "Outdoor grazing/foraging land. The layer pasture houses mobile coops on rotation; broilers rotate via chicken tractors." },
      { id: "chicken_tractor", label: "Chicken tractor", description: "Mobile pen with feed, water, and fencing. Houses broilers from brooder graduation through processing. Moved twice daily.", usedBy: "broilers" }
    ],
    items: [
      { id: "mc1", label: "MC1", kindId: "mobile_coop", currentResidents: "Gold bands", notes: "Houses the newest layer generation; kept separate." },
      { id: "mc2", label: "MC2", kindId: "mobile_coop", currentResidents: "No bands, blue bands, and orange bands (cohabit)", notes: null },
      { id: "b1", label: "B1", kindId: "brooder", currentResidents: null, notes: "Specs TBD." },
      { id: "b2", label: "B2", kindId: "brooder", currentResidents: null, notes: "Specs TBD." },
      { id: "layer_pasture", label: "Layer pasture", kindId: "pasture", currentResidents: "Mobile coops MC1 and MC2 rotate through this pasture.", notes: "Dimensions and satellite-image boundary pending." }
    ]
  },
  machines: [
    { id: "kubota_tractor", label: "Tractor", category: "agricultural_tractor", manufacturer: "Kubota", model: "TBD", uses: ["Move mobile coops within the layer pasture via drawbar hitch."], notes: "The farm's primary agricultural utility vehicle." },
    { id: "jd_backhoe", label: "Backhoe", category: "backhoe", manufacturer: "John Deere", model: "TBD", uses: [], notes: null },
    { id: "jd_excavator", label: "Excavator", category: "excavator", manufacturer: "John Deere", model: "TBD", uses: [], notes: null }
  ],
  suppliers: [
    { id: "supplier_pullet_sources", label: "Pullet sources (preferred)", category: "pullet_source", supplies: ["pullets — juvenile female layers"], notes: "Names, contacts, and terms TBD." },
    { id: "supplier_chick_hatchery", label: "Broiler chick hatchery", category: "hatchery", supplies: ["day-old broiler chicks (Cornish Rock Hybrid)"], notes: "Specific hatchery TBD." },
    { id: "supplier_feed_mill", label: "Feed mill", category: "feed_supplier", supplies: ["broiler starter", "broiler grower", "broiler finisher", "layer feed"], notes: "Specific mill TBD." },
    { id: "supplier_hay", label: "Hay supplier", category: "hay_supplier", supplies: ["sheep hay"], notes: "Specific supplier TBD." }
  ],
  feeds: [
    { id: "broiler_starter", name: "Broiler starter", description: "High-protein crumbles for chicks weeks 1–3.", supplierId: "supplier_feed_mill", unit: "lb", packageSize: { amount: 50, unit: "lb", label: "50-lb bag" }, costPerUnit: { amount: 0.55, currency: "USD", unit: "lb" }, reorderPoint: { amount: 100, unit: "lb" }, reorderQuantity: { amount: 500, unit: "lb" }, leadTimeDays: 7, notes: "Costs illustrative — see thread_feed_specifics." },
    { id: "broiler_grower", name: "Broiler grower", description: "Medium-protein pellets for weeks 3–4.", supplierId: "supplier_feed_mill", unit: "lb", packageSize: { amount: 50, unit: "lb", label: "50-lb bag" }, costPerUnit: { amount: 0.50, currency: "USD", unit: "lb" }, reorderPoint: { amount: 200, unit: "lb" }, reorderQuantity: { amount: 1500, unit: "lb" }, leadTimeDays: 7, notes: "Illustrative figures." },
    { id: "broiler_finisher", name: "Broiler finisher", description: "Lower-protein pellets for weeks 5–7 leading into processing.", supplierId: "supplier_feed_mill", unit: "lb", packageSize: { amount: 50, unit: "lb", label: "50-lb bag" }, costPerUnit: { amount: 0.48, currency: "USD", unit: "lb" }, reorderPoint: { amount: 200, unit: "lb" }, reorderQuantity: { amount: 1500, unit: "lb" }, leadTimeDays: 7, notes: "Illustrative figures." },
    { id: "layer_feed", name: "Layer feed", description: "Layer pellets, supplemented with grit and oyster shell.", supplierId: "supplier_feed_mill", unit: "lb", packageSize: { amount: 50, unit: "lb", label: "50-lb bag" }, costPerUnit: { amount: 0.45, currency: "USD", unit: "lb" }, reorderPoint: { amount: 100, unit: "lb" }, reorderQuantity: { amount: 500, unit: "lb" }, leadTimeDays: 7, notes: "Illustrative figures." },
    { id: "sheep_hay", name: "Sheep hay", description: "Square bales of grass hay for the sheep trio.", supplierId: "supplier_hay", unit: "bale", packageSize: { amount: 1, unit: "bale", label: "Square bale (~40 lb, ~10 flakes)" }, costPerUnit: { amount: 5.00, currency: "USD", unit: "bale" }, reorderPoint: { amount: 5, unit: "bale" }, reorderQuantity: { amount: 20, unit: "bale" }, leadTimeDays: 5, notes: "Illustrative figures." }
  ],
  feedSchedules: [
    {
      id: "broiler_standard", name: "Standard broiler schedule", speciesId: "broilers",
      description: "Day-old chick to processing day, 5–7 weeks total. Anchored to batch arrival.",
      cycleAnchorLabel: "Days from arrival",
      stages: [
        { id: "stage_starter", name: "Starter (free choice)", startDay: 0, endDay: 14, feedTypeId: "broiler_starter", consumption: { type: "free_choice" }, notes: "Chicks have unlimited access for the first two weeks." },
        { id: "stage_grower_w3", name: "Week 3", startDay: 14, endDay: 21, feedTypeId: "broiler_grower", consumption: { type: "metered", amount: 100, unit: "lb", per: "day", basis: "batch" }, notes: "100 lb/day for a batch of 275 birds." },
        { id: "stage_grower_w4", name: "Week 4", startDay: 21, endDay: 28, feedTypeId: "broiler_grower", consumption: { type: "metered", amount: 75, unit: "lb", per: "day", basis: "batch" }, notes: "75 lb/day. Decreasing pattern unusual — see thread_broiler_feed_pattern." },
        { id: "stage_finisher", name: "Weeks 5–7 (TBD)", startDay: 28, endDay: 49, feedTypeId: "broiler_finisher", consumption: { type: "tbd" }, notes: "Specific amounts not yet captured." }
      ],
      assignedGroupIds: ["broilers_batch_1", "broilers_batch_2"]
    },
    {
      id: "layer_standard", name: "Standard layer feed", speciesId: "layers",
      description: "Layer feed available free choice. Grit and oyster shell supplemented separately.",
      cycleAnchorLabel: "Ongoing",
      stages: [
        { id: "stage_layer_main", name: "Layer feed (ongoing)", startDay: 0, endDay: null, feedTypeId: "layer_feed", consumption: { type: "free_choice" }, notes: "Free choice; grit and calcium also provided." }
      ],
      assignedGroupIds: ["layers_no_band", "layers_blue_band", "layers_orange_band", "layers_gold_band"]
    },
    {
      id: "sheep_hay_regimen", name: "Sheep hay regimen", speciesId: "sheep",
      description: "One flake of hay daily for the trio.",
      cycleAnchorLabel: "Ongoing",
      stages: [
        { id: "stage_sheep_hay", name: "Daily flake", startDay: 0, endDay: null, feedTypeId: "sheep_hay", consumption: { type: "metered", amount: 1, unit: "flake", per: "day", basis: "group" }, notes: "One flake (~4 lb) for the trio per day." }
      ],
      assignedGroupIds: ["sheep_pets"]
    }
  ],
  chores: {
    definitions: [
      { id: "open_mobile_coops", title: "Open mobile coops", description: "Open the doors of the mobile coops to release layers for the day.", when: "TBD", how: "TBD", who: "TBD", tags: ["layers", "daily"] },
      { id: "give_sheep_hay", title: "Give sheep a flake of hay", description: "Provide hay to Lily, Ivy, and Violet.", when: "TBD", how: "TBD", who: "TBD", tags: ["sheep"] },
      { id: "log_brooder_temp", title: "Log brooder temperature", description: "Record the current brooder temperature so it can be tracked against the weekly target.", when: "TBD", how: "TBD", who: "TBD", tags: ["broilers", "brooder", "data-capture"] },
      { id: "move_chicken_tractor", title: "Move chicken tractor", description: "Move a chicken tractor to fresh pasture.", when: "Twice daily — morning and afternoon", how: "TBD", who: "TBD", tags: ["broilers", "pasture", "daily"] },
      { id: "move_mobile_coop", title: "Move mobile coop", description: "Relocate a mobile coop within the layer pasture using the tractor and drawbar hitch.", when: "TBD", how: "TBD", who: "TBD", tags: ["layers", "tractor"] },
      { id: "feed_broiler_batch", title: "Feed a batch of broilers", description: "Provide the appropriate weekly ration to a broiler batch and log feed amount provided.", when: "TBD", how: "TBD", who: "TBD", tags: ["broilers", "feed", "data-capture"] },
      { id: "collect_eggs", title: "Collect eggs", description: "Collect eggs from layer coops.", when: "TBD", how: "TBD", who: "TBD", tags: ["layers", "data-capture"] }
    ],
    completions: [],
    modelNotes: [
      "A chore definition describes a recurring activity. Each occurrence is an instance, and a completion is a ChoreCompletionLog entry.",
      "Edit scopes adopt the Google Calendar pattern: this instance / this and following / all instances. Past completions are immutable.",
      "Recurrence model supports specific times, ranges, multiple times/ranges, sunrise/sunset anchors, and conditional state-based recurrence."
    ]
  },
  events: {
    kinds: [
      {
        id: "farmers_market", label: "Farmers markets", description: "Recurring weekly farmers markets NFF attends during market season.",
        instances: [
          { id: "scituate_rotary", label: "Scituate Rotary Farmers Market", recurrence: { type: "weekly", dayOfWeek: 6, startTime: "09:00", endTime: "13:00", seasonStart: "2026-05-09", seasonEnd: "2026-11-01" }, location: { name: "Scituate Rotary", address: "46 Institute Lane, North Scituate, RI" } },
          { id: "foster_market", label: "Foster Farmers Market", recurrence: { type: "weekly", dayOfWeek: 0, startTime: "09:00", endTime: "12:00", seasonStart: "2026-06-01", seasonEnd: "2026-11-01" }, location: { name: "Foster Farmers Market", address: "164 Danielson Pike, Foster, RI" } },
          { id: "tilted_barn", label: "Summer Market at Tilted Barn", recurrence: { type: "weekly", dayOfWeek: 3, startTime: "16:00", endTime: "19:00", seasonStart: "2025-06-03", seasonEnd: "2026-08-26" }, location: { name: "Tilted Barn", address: "One Hemsley Place, Exeter, RI 02822" }, notes: "14-month range — likely a typo. See thread_tilted_barn_date_range." }
        ]
      },
      {
        id: "popup_event", label: "Pop-up events", description: "One-off selling occasions outside the regular weekly schedule.",
        instances: [
          { id: "warwick_summer_celebration", label: "Summer Celebration", subtitle: "Marketplace / Food Trucks", date: "2026-07-10", startTime: "18:00", endTime: "20:30", location: { name: "Warwick City Hall Plaza", address: "3275 Post Rd, Warwick, RI 02886" } },
          { id: "rocky_point_july_concert", label: "Summer Concert", subtitle: "Marketplace / Food Trucks", date: "2026-07-18", startTime: "11:00", endTime: "15:00", location: { name: "Rocky Point", address: "1 Rocky Point Ave, Warwick, RI 02889" } },
          { id: "warwick_july_concert", label: "Summer Concert", subtitle: "Marketplace / Food Trucks", date: "2026-07-22", startTime: "17:00", endTime: "20:00", location: { name: "Warwick City Hall Plaza", address: "3275 Post Rd, Warwick, RI 02886" } },
          { id: "rocky_point_august_concert", label: "Summer Concert", subtitle: "Marketplace / Food Trucks", date: "2026-08-08", startTime: "11:00", endTime: "15:00", location: { name: "Rocky Point", address: "1 Rocky Point Ave, Warwick, RI 02889" } },
          { id: "warwick_august_concert", label: "Summer Concert", subtitle: "Marketplace / Food Trucks", date: "2026-08-26", startTime: "17:00", endTime: "20:00", location: { name: "Warwick City Hall Plaza", address: "3275 Post Rd, Warwick, RI 02886" } },
          { id: "warwick_apple_fest", label: "Apple Fest", subtitle: "Concert, vendors & food trucks", date: "2026-09-19", startTime: "12:00", endTime: "15:00", location: { name: "Warwick City Hall Plaza", address: "3275 Post Rd, Warwick, RI 02886" } }
        ],
        notes: "Pop-up dates from the source image had no year — assumed 2026."
      },
      {
        id: "egg_drop", label: "Egg drop", description: "Off-season customer pickup at the same farmers market site.",
        instances: [
          { id: "scituate_egg_drop", label: "Scituate Egg Drop", recurrence: { type: "weekly", dayOfWeek: 6, startTime: "10:00", endTime: "11:00", seasonStart: "2026-11-02", seasonEnd: "2027-04-30" }, location: { name: "Scituate Rotary", address: "46 Institute Lane, North Scituate, RI" }, notes: "Continues meeting regular customers at the farmers market site after market season ends." }
        ]
      }
    ],
    modelNotes: [
      "'Event' in NFF's domain language means sales occasions only — markets, pop-ups, egg drops.",
      "Recurring instances carry a recurrence pattern; single instances carry an explicit date."
    ]
  },
  schedule: {
    modelNotes: [
      "Aggregator over chores, scheduled projects, and event instances — anything date-bound.",
      "Sync to Google Calendar is push-only.",
      "Prototype scope: month-grid calendar, chronological timeline, filter chips, click-to-detail. Drag-and-drop, in-place editing, GCal API call deferred."
    ]
  },
  logging: {
    modelNotes: [
      "Polymorphic discriminated union with `type` field. Base: { type, id, logTime, actor, subjects }.",
      "Subtypes: ChoreCompletionLog, TemperatureLog, FeedLog, MortalityLog, EggCollectionLog, WeightLog.",
      "'Event' must NOT appear in log type names. Storage architecture open — see thread_log_storage."
    ]
  },
  projects: [],
  processes: [],
  notes: [],
  threads: [
    { id: "thread_customers_in_admin", title: "Customers: same app or separate app?", question: "Will customers log in to this same admin app to see their orders, or get a separate customer-facing app?", status: "open" },
    { id: "thread_sheep_data", title: "Sheep are unaccounted for in livestock", question: "Sheep referenced in chore but no livestock data provided.", status: "resolved", resolution: "3 Katahdin sheep — Lily, Ivy, Violet. Pets, no production. Consolidated into a single group 'Lily, Ivy, and Violet'." },
    { id: "thread_spaces_section", title: "Spaces / Infrastructure as a top-level section?", question: "First-class entities or inline labels?", status: "resolved", resolution: "Yes — top-level section with kinds + items structure." },
    { id: "thread_suppliers_section", title: "Suppliers as a top-level section?", question: "Top-level Suppliers, or kept inline?", status: "resolved", resolution: "Yes — top-level section." },
    { id: "thread_chore_recurrence_model", title: "Chore recurrence semantics", question: "Need a recurrence model rich enough for daily, twice-daily, weekly, and conditional schedules.", status: "resolved", resolution: "Specific times, ranges, multiple times/ranges, sunrise/sunset anchors, and conditional state-based recurrence." },
    { id: "thread_chore_edit_scope_ux", title: "Chore edit scope UX", question: "Adopt Google Calendar's edit-scope pattern?", status: "resolved", resolution: "Yes. 'This instance / this and following / all instances.' Past completions are immutable." },
    { id: "thread_events_taxonomy", title: "Generic event/log substrate?", question: "What's the data model for chore completions, temp readings, feed logs?", status: "resolved", resolution: "Polymorphic discriminated union. 'Event' is reserved for sales occasions and is its own top-level menu category." },
    { id: "thread_pasture_compliance", title: "Pasture-raised compliance computation", question: "Hard alert or soft KPI?", status: "resolved", resolution: "Soft KPI." },
    { id: "thread_log_naming_convention", title: "Log naming convention", question: "Naming for the polymorphic log base type.", status: "resolved", resolution: "'LogEntry' base; subtypes follow '<Domain>Log'." },
    { id: "thread_tractor_terminology", title: "Tractor terminology convention", question: "'Tractor' is overloaded.", status: "resolved", resolution: "'Tractor' (unqualified) means the Kubota or future agricultural utility vehicle. 'Chicken tractor' means the mobile broiler pens." },
    { id: "thread_market_details", title: "Farmers market details", question: "Which market(s)? Day(s), location, season dates, vendor fees.", status: "resolved", resolution: "Three markets captured: Scituate Rotary (Sat 9–1, May 9 – Nov 1, North Scituate); Foster Farmers Market (Sun 9–12, Jun 1 – Nov 1, Foster); Summer Market at Tilted Barn (Wed 4–7pm, Jun 3 2025 – Aug 26 2026, Exeter — date range to verify). Vendor fees and setup/breakdown still TBD." },
    { id: "thread_egg_drop_details", title: "Egg drop details", question: "Location, day/time, customer list management, products sold.", status: "resolved", resolution: "Scituate Egg Drop, Saturdays 10–11 AM, Nov 2 – April 30, at 46 Institute Lane (same site as Scituate Rotary). Customer list management and product range still TBD." },
    { id: "thread_broiler_batches_data", title: "Broiler batches need their own structured data", question: "Each batch needs arrival, count, processing date, week-by-week feed, mortality, location.", status: "open", notes: "Partially populated: Batch 1 and Batch 2 captured (count=275 each). Still TBD: arrival/processing dates, locations, status, feed consumption, mortality." },
    { id: "thread_brooder_temp_schedule", title: "Full brooder temperature schedule", question: "Week 1 = 85°F. The full week-by-week schedule wasn't specified.", status: "open" },
    { id: "thread_feed_schedule", title: "Full broiler feed schedule (amounts)", question: "Week-by-week feed amounts for the broiler cycle.", status: "open", notes: "Stage feed types resolved (starter / grower / finisher). Amounts captured for weeks 1–4. Weeks 5–7 still TBD." },
    { id: "thread_chore_completion_ux", title: "Chore completion UX (likely mobile-first)", question: "Confirm mobile-first design priority for the completion flow.", status: "open" },
    { id: "thread_recurrence_state_model", title: "State model for conditional chore recurrence", question: "Conditional recurrence needs a state expression language.", status: "open" },
    { id: "thread_layer_pasture_specs", title: "Layer pasture specs", question: "Need dimensions and satellite-image boundary.", status: "open" },
    { id: "thread_chicken_tractor_inventory", title: "Chicken tractor inventory and specs", question: "How many? Identifiers? Capacity?", status: "open" },
    { id: "thread_brooder_specs", title: "Brooder specs", question: "B1 and B2 — physical location, capacity, heat source, dimensions.", status: "open" },
    { id: "thread_mobile_coop_specs", title: "Mobile coop specs", question: "MC1 and MC2 — capacity, dimensions, build details.", status: "open" },
    { id: "thread_specific_suppliers", title: "Specific supplier identities", question: "Names, contacts, terms for pullet sources and chick hatchery.", status: "open" },
    { id: "thread_machine_management", title: "Machine management depth", question: "Maintenance logs, hours tracking, attachments inventory — or lightweight reference list for now?", status: "open" },
    { id: "thread_sheep_location", title: "Sheep enclosure / location", question: "Where do Lily, Ivy, and Violet live? Should their enclosure be a Space?", status: "open" },
    { id: "thread_layer_arrival_history", title: "Arrival dates for older layer generations", question: "No bands and blue bands have unknown arrival dates.", status: "open" },
    { id: "thread_age_format_gap", title: "Age formatting: 5–8 week gap", question: "Spec listed [1-4] weeks then [2-11] months. Confirm interpretation (currently: weeks for ≤4 weeks, months for 1–11 months, '1 year' exact, then 'Y years, M months').", status: "open" },
    { id: "thread_log_storage", title: "Log storage architecture", question: "Where do LogEntry instances live? Single global array vs. distributed by domain.", status: "open" },
    { id: "thread_tilted_barn_date_range", title: "Tilted Barn market date range", question: "Captured range is 'June 3, 2025 – August 26, 2026' — 14 months continuous, unusual for a summer market. Likely a typo (should both years be 2026?). Confirm.", status: "open" },
    { id: "thread_popup_event_year", title: "Year on pop-up event dates", question: "The source image listed pop-up dates without a year. Claude assumed 2026. Confirm.", status: "open" },
    { id: "thread_feed_specifics", title: "Feed specifics — supplier, prices, lead times", question: "Cost-per-lb figures, reorder points, reorder quantities, lead times, and package sizes are illustrative placeholders. Replace with real figures from the actual feed mill and hay supplier.", status: "open" },
    { id: "thread_broiler_feed_pattern", title: "Broiler feed amount pattern (decreasing?)", question: "Week 3 = 100 lb/day, week 4 = 75 lb/day. Decreasing consumption is unusual for Cornish Rock. Confirm pattern direction and fill in weeks 5–7.", status: "open" },
    { id: "thread_schedule_full_scope", title: "Schedule view — full feature set deferred", question: "Prototype has calendar, timeline, filters, click-to-detail. Deferred: drag-and-drop, in-place editing, GCal push-sync, multi-month views.", status: "open" },
    { id: "thread_chore_schedule_population", title: "Chores need specific times to populate Schedule", question: "Most chores still have when=TBD. Until specific times are defined, the Schedule's Chores filter has nothing to render.", status: "open" }
  ]
};

// ===============================================================
// SECTION REGISTRY
// ===============================================================
const SECTIONS = [
  { id: "overview", group: null, label: "Overview", icon: Home, description: "Single-glance state of the farm", getCount: () => null },
  { id: "livestock_layers", group: "Livestock", label: "Layers", icon: Egg, getCount: (d) => d.livestock.species.find(s => s.id === "layers")?.groups.length ?? 0 },
  { id: "livestock_broilers", group: "Livestock", label: "Broilers", icon: Bird, getCount: (d) => d.livestock.species.find(s => s.id === "broilers")?.groups.length ?? 0 },
  { id: "livestock_sheep", group: "Livestock", label: "Sheep", icon: PawPrint, getCount: (d) => d.livestock.species.find(s => s.id === "sheep")?.groups.length ?? 0 },
  { id: "spaces", group: "Entities", label: "Spaces", icon: Building2, description: "Physical locations: coops, brooders, pasture, chicken tractors", getCount: (d) => d.spaces.items.length },
  { id: "machines", group: "Entities", label: "Machines", icon: Wrench, description: "Powered equipment owned by the farm", getCount: (d) => d.machines.length },
  { id: "suppliers", group: "Entities", label: "Suppliers", icon: Truck, description: "Vendors and sources NFF buys from", getCount: (d) => d.suppliers.length },
  { id: "feeds", group: "Entities", label: "Feeds", icon: Wheat, description: "Feed types, suppliers, costs, and reorder rules", getCount: (d) => d.feeds.length },
  { id: "schedule", group: "Activity", label: "Schedule", icon: Calendar, description: "Calendar and timeline view of everything date-bound", getCount: () => null },
  { id: "chores", group: "Activity", label: "Chores", icon: ListChecks, description: "Recurring scheduled work and the activity log", getCount: (d) => d.chores.definitions.length },
  { id: "events_farmers_market", group: "Events", label: "Farmers markets", icon: Tent, getCount: (d) => d.events.kinds.find(k => k.id === "farmers_market")?.instances.length ?? 0 },
  { id: "events_popup_event", group: "Events", label: "Pop-up events", icon: Sparkles, getCount: (d) => d.events.kinds.find(k => k.id === "popup_event")?.instances.length ?? 0 },
  { id: "events_egg_drop", group: "Events", label: "Egg drop", icon: Package, getCount: (d) => d.events.kinds.find(k => k.id === "egg_drop")?.instances.length ?? 0 },
  { id: "projects", group: "Planning", label: "Projects", icon: FolderKanban, description: "Discrete, time-bound work", getCount: (d) => d.projects.length },
  { id: "processes", group: "Planning", label: "Processes", icon: Workflow, description: "Repeatable workflows and SOPs", getCount: (d) => d.processes.length },
  { id: "notes", group: "Planning", label: "Notes", icon: NotebookPen, description: "Uncategorized brain dumps", getCount: (d) => d.notes.length },
  { id: "threads", group: "Meta", label: "Threads", icon: MessageCircleQuestion, description: "Open questions and resolved decisions", getCount: (d) => d.threads.filter(t => t.status === "open").length }
];

function getSpeciesFromSectionId(id, data) {
  if (!id.startsWith("livestock_")) return null;
  return data.livestock.species.find(s => s.id === id.replace("livestock_", "")) ?? null;
}
function getEventKindFromSectionId(id, data) {
  if (!id.startsWith("events_")) return null;
  return data.events.kinds.find(k => k.id === id.replace("events_", "")) ?? null;
}
function resolveSectionDescription(section, data) {
  if (section.description) return section.description;
  const sp = getSpeciesFromSectionId(section.id, data);
  if (sp) return `${sp.purpose} · Tracked by ${sp.trackingModel}`;
  const ek = getEventKindFromSectionId(section.id, data);
  if (ek) return ek.description;
  return "";
}

// ===============================================================
// THEME
// ===============================================================
const T = {
  bg: "#181c19", surface: "#23291f", surfaceAlt: "#1f2520",
  border: "#2f3631",
  text: "#e8e4d8", textDim: "#9a9484", textMuted: "#5e6a5e", textFaint: "#3f4a40",
  accent: "#a0b87f", accentDim: "#7a9e5e", warn: "#d4a346", resolved: "#7a9e5e",
  cat: { farmers_market: "#a0b87f", popup_event: "#d4a346", egg_drop: "#7ea3b5", chore: "#9a9484" },
  serif: "'Fraunces', Georgia, serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace"
};

// ===============================================================
// HELPERS — date, age, recurrence, cost
// ===============================================================
function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}
function formatISODate(d) { return d.toISOString().slice(0, 10); }
function isSameDay(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}
function todayUTC() {
  const t = new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
}

function computeAge(knownAge) {
  if (!knownAge || knownAge.weeks == null || !knownAge.asOfDate) return "Unknown";
  const asOfMs = Date.parse(knownAge.asOfDate + "T00:00:00Z");
  if (isNaN(asOfMs)) return "Unknown";
  const dayDiff = Math.round((Date.now() - asOfMs) / 86400000);
  return formatAge(Math.max(0, knownAge.weeks * 7 + dayDiff));
}
function formatAge(days) {
  if (days <= 28) { const w = Math.max(1, Math.round(days / 7)); return `${w} week${w === 1 ? "" : "s"}`; }
  const totalMonths = days / 30.4375;
  if (totalMonths < 12) { const m = Math.max(1, Math.round(totalMonths)); return `${m} month${m === 1 ? "" : "s"}`; }
  const wholeYears = Math.floor(totalMonths / 12);
  const remM = Math.round(totalMonths - wholeYears * 12);
  if (remM === 0) return `${wholeYears} year${wholeYears === 1 ? "" : "s"}`;
  if (remM === 12) return `${wholeYears + 1} year${wholeYears + 1 === 1 ? "" : "s"}`;
  return `${wholeYears} year${wholeYears === 1 ? "" : "s"}, ${remM} month${remM === 1 ? "" : "s"}`;
}
function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
function formatLongDate(iso) {
  if (!iso) return iso;
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
function formatTime12h(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${period === "PM" ? " PM" : " AM"}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function expandWeekly(instance, kind, fromDate, toDate) {
  const r = instance.recurrence;
  const seasonStart = parseISODate(r.seasonStart);
  const seasonEnd = parseISODate(r.seasonEnd);
  if (!seasonStart || !seasonEnd) return [];
  const effStart = seasonStart > fromDate ? seasonStart : fromDate;
  const effEnd = seasonEnd < toDate ? seasonEnd : toDate;
  if (effStart > effEnd) return [];
  const out = [];
  const cursor = new Date(effStart);
  while (cursor.getUTCDay() !== r.dayOfWeek) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor > effEnd) return out;
  }
  while (cursor <= effEnd) {
    out.push({
      date: formatISODate(cursor), startTime: r.startTime, endTime: r.endTime,
      kindId: kind.id, kindLabel: kind.label,
      instanceId: instance.id, instanceLabel: instance.label,
      subtitle: instance.subtitle, location: instance.location, recurring: true
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}
function expandSingle(instance, kind, fromDate, toDate) {
  const d = parseISODate(instance.date);
  if (!d || d < fromDate || d > toDate) return [];
  return [{
    date: instance.date, startTime: instance.startTime, endTime: instance.endTime,
    kindId: kind.id, kindLabel: kind.label,
    instanceId: instance.id, instanceLabel: instance.label,
    subtitle: instance.subtitle, location: instance.location, recurring: false
  }];
}
function getEventOccurrences(eventsData, fromDate, toDate, filters) {
  const all = [];
  for (const kind of eventsData.kinds) {
    if (filters && filters[kind.id] === false) continue;
    for (const inst of kind.instances) {
      if (inst.recurrence) all.push(...expandWeekly(inst, kind, fromDate, toDate));
      else if (inst.date) all.push(...expandSingle(inst, kind, fromDate, toDate));
    }
  }
  all.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startTime || "").localeCompare(b.startTime || ""));
  return all;
}

function computeStageCost(stage, feed) {
  if (!feed || !stage.consumption) return null;
  if (stage.consumption.type !== "metered") return null;
  if (stage.endDay == null) return null;
  const days = stage.endDay - stage.startDay;
  if (days <= 0) return null;
  if (stage.consumption.unit !== feed.costPerUnit.unit) return { unitMismatch: true };
  const totalAmount = stage.consumption.amount * days;
  const cost = totalAmount * feed.costPerUnit.amount;
  return { totalAmount, totalUnit: stage.consumption.unit, cost, days };
}

// ===============================================================
// ROOT
// ===============================================================
export default function App() {
  const [currentSection, setCurrentSection] = useState("overview");
  const [scheduleDetail, setScheduleDetail] = useState(null);

  useEffect(() => {
    if (document.querySelector("link[data-nff-fonts]")) return;
    const link = document.createElement("link");
    link.dataset.nffFonts = "true";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  const section = SECTIONS.find(s => s.id === currentSection) || SECTIONS[0];
  const isSpeciesPage = section.id.startsWith("livestock_");

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: T.mono, fontSize: 13 }}>
      <TopBar />
      <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
        <Sidebar current={currentSection} onSelect={setCurrentSection} />
        <main style={{ flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 }}>
          <SectionHeader section={section} data={NFF_DATA} noBottomBorder={isSpeciesPage} />
          <SectionContent section={section} data={NFF_DATA} onShowDetail={setScheduleDetail} />
        </main>
      </div>
      {scheduleDetail && <DetailModal item={scheduleDetail} onClose={() => setScheduleDetail(null)} />}
    </div>
  );
}

// ===============================================================
// TOP BAR
// ===============================================================
function TopBar() {
  return (
    <header style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Sprout size={18} color={T.accent} />
        <h1 style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>North Foster Farm</h1>
        <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Admin · v{NFF_DATA.meta.version}</span>
      </div>
      <div style={{ fontSize: 11, color: T.textMuted }}>{NFF_DATA.meta.users.map(u => u.name).join(" + ")}</div>
    </header>
  );
}

// ===============================================================
// SIDEBAR
// ===============================================================
function Sidebar({ current, onSelect }) {
  let lastGroup = undefined;
  return (
    <nav style={{ width: 220, borderRight: `1px solid ${T.border}`, padding: "20px 0", flexShrink: 0, overflowY: "auto", maxHeight: "calc(100vh - 57px)" }}>
      {SECTIONS.map(s => {
        const showHeader = s.group !== lastGroup;
        lastGroup = s.group;
        const Icon = s.icon;
        const count = s.getCount(NFF_DATA);
        const active = s.id === current;
        return (
          <div key={s.id}>
            {showHeader && s.group !== null && (
              <div style={{ padding: "16px 24px 6px", fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.18em" }}>{s.group}</div>
            )}
            {showHeader && s.group === null && <div style={{ padding: "0 24px 6px" }} />}
            <button onClick={() => onSelect(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 22px",
              background: active ? T.surface : "transparent", border: "none",
              borderLeft: active ? `2px solid ${T.accent}` : "2px solid transparent",
              color: active ? T.text : T.textDim, fontFamily: "inherit", fontSize: 13,
              cursor: "pointer", textAlign: "left"
            }}>
              <Icon size={14} />
              <span style={{ flex: 1 }}>{s.label}</span>
              {count !== null && <span style={{ fontSize: 11, color: count > 0 ? T.textDim : T.textFaint }}>{count}</span>}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

// ===============================================================
// SECTION HEADER + ROUTER
// ===============================================================
function SectionHeader({ section, data, noBottomBorder }) {
  const description = resolveSectionDescription(section, data);
  return (
    <div style={{
      marginBottom: noBottomBorder ? 20 : 28,
      paddingBottom: noBottomBorder ? 0 : 14,
      borderBottom: noBottomBorder ? "none" : `1px solid ${T.border}`
    }}>
      <h2 style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", margin: 0, marginBottom: 4 }}>{section.label}</h2>
      {description && <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>{description}</p>}
    </div>
  );
}

function SectionContent({ section, data, onShowDetail }) {
  if (section.id.startsWith("livestock_")) {
    const sp = getSpeciesFromSectionId(section.id, data);
    if (!sp) return <EmptyState label={section.label} />;
    return <SpeciesPage species={sp} data={data} />;
  }
  if (section.id.startsWith("events_")) {
    const ek = getEventKindFromSectionId(section.id, data);
    if (!ek) return <EmptyState label={section.label} />;
    return <EventKindPage kind={ek} />;
  }
  switch (section.id) {
    case "overview": return <OverviewContent data={data} />;
    case "spaces": return <SpacesContent data={data} />;
    case "machines": return <MachinesContent data={data} />;
    case "suppliers": return <SuppliersContent data={data} />;
    case "feeds": return <FeedsContent data={data} />;
    case "schedule": return <SchedulePage data={data} onShowDetail={onShowDetail} />;
    case "chores": return <ChoresContent data={data} />;
    case "threads": return <ThreadsContent data={data} />;
    default: {
      const items = data[section.id] ?? [];
      if (items.length === 0) return <EmptyState label={section.label} />;
      return <GenericItemList items={items} />;
    }
  }
}

function EmptyState({ label }) {
  return (
    <div style={{ padding: "64px 0", textAlign: "center" }}>
      <div style={{ display: "inline-block", padding: "32px 48px", border: `1px dashed ${T.border}` }}>
        <p style={{ fontSize: 13, color: T.textDim, margin: 0, marginBottom: 6 }}>No {label.toLowerCase()} captured yet.</p>
        <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Drop bullets in chat to populate this section.</p>
      </div>
    </div>
  );
}

// ===============================================================
// SHARED PRIMITIVES
// ===============================================================
function DataField({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16, padding: "8px 0", borderBottom: `1px solid ${T.surfaceAlt}` }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", paddingTop: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}
function Subsection({ title, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Tile({ label, value }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 20px" }}>
      <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, lineHeight: 1, color: value > 0 ? T.text : T.textMuted, marginBottom: 8 }}>{String(value).padStart(2, "0")}</div>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
    </div>
  );
}
function TabStrip({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: isActive ? `2px solid ${T.accent}` : "2px solid transparent",
            color: isActive ? T.text : T.textDim, fontFamily: "inherit", fontSize: 11, fontWeight: 500,
            padding: "10px 14px", cursor: "pointer", marginBottom: -1,
            textTransform: "uppercase", letterSpacing: "0.12em"
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

// ===============================================================
// OVERVIEW
// ===============================================================
function OverviewContent({ data }) {
  const livestockGroups = data.livestock.species.reduce((a, s) => a + s.groups.length, 0);
  const open = data.threads.filter(t => t.status === "open").length;
  const resolved = data.threads.filter(t => t.status === "resolved").length;
  const tiles = [
    { label: "Livestock groups", value: livestockGroups },
    { label: "Spaces", value: data.spaces.items.length },
    { label: "Machines", value: data.machines.length },
    { label: "Suppliers", value: data.suppliers.length },
    { label: "Feeds", value: data.feeds.length },
    { label: "Open threads", value: open }
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        {tiles.map(t => <Tile key={t.label} {...t} />)}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: 24 }}>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 14 }}>Status</div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: T.text, margin: 0, marginBottom: 12 }}>
          Captured: livestock ({data.livestock.species.length} species, {livestockGroups} groups), {data.spaces.items.length} spaces, {data.machines.length} machines, {data.suppliers.length} suppliers, {data.feeds.length} feeds, {data.feedSchedules.length} feed schedules, {data.chores.definitions.length} chores, and {data.events.kinds.reduce((a, k) => a + k.instances.length, 0)} event instances across {data.events.kinds.length} kinds.
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: T.textDim, margin: 0 }}>
          {open} threads open, {resolved} resolved. The Threads section is the most actionable surface — each open one is a decision needed before scope sharpens further.
        </p>
      </div>
    </div>
  );
}

// ===============================================================
// SPECIES PAGE — Groups, Feed schedule, Chores, Activity Log, More info
// ===============================================================
function SpeciesPage({ species, data }) {
  const [tab, setTab] = useState("groups");
  const speciesChores = data.chores.definitions.filter(c => c.tags.includes(species.id));
  const speciesSchedules = data.feedSchedules.filter(fs => fs.speciesId === species.id);

  return (
    <div>
      <TabStrip
        tabs={[
          { id: "groups", label: `Groups · ${species.groups.length}` },
          { id: "feed", label: `Feed schedule · ${speciesSchedules.length}` },
          { id: "chores", label: `Chores · ${speciesChores.length}` },
          { id: "activity", label: `Activity Log · 0` },
          { id: "more", label: "More info" }
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "groups" && <GroupsTab species={species} />}
      {tab === "feed" && <FeedScheduleTab species={species} schedules={speciesSchedules} feeds={data.feeds} />}
      {tab === "chores" && <SpeciesChoresTab species={species} chores={speciesChores} />}
      {tab === "activity" && <ActivityLogTab species={species} />}
      {tab === "more" && <MoreInfoView species={species} />}
    </div>
  );
}

function GroupsTab({ species }) {
  if (species.groups.length === 0) {
    return <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", padding: "32px 0", textAlign: "center" }}>No groups recorded yet.</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
      {species.groups.map(g => <GroupCard key={g.id} group={g} species={species} />)}
    </div>
  );
}

function GroupCard({ group, species }) {
  const isSheep = species.id === "sheep";
  const showCount = species.trackingModel !== "individual";
  const age = computeAge(group.knownAge);
  const arrivalDisplay = formatDate(group.arrivalDate) || "Unknown";
  const countDisplay = group.count != null ? group.count.toLocaleString() : "Unknown";
  const locationValue = group.currentLocation || "Unknown";
  const locationKnown = locationValue !== "Unknown" && locationValue !== "TBD";
  const fields = [
    ...(!isSheep ? [{ label: "Age", value: age }] : []),
    ...(showCount && !isSheep ? [{ label: "Count", value: countDisplay }] : []),
    ...(!isSheep ? [{ label: "Arrived", value: arrivalDisplay }] : []),
    ...(!isSheep ? [{ label: "Location", value: locationValue, highlight: locationKnown }] : [])
  ];
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>{group.label}</div>
          {species.breed && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{species.breed}</div>}
        </div>
        {group.ordinal != null && <div style={{ fontSize: 10, color: T.textMuted }}>#{group.ordinal}</div>}
      </div>
      {fields.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 5, columnGap: 12, marginTop: 10 }}>
          {fields.map(f => {
            const isUnknown = f.value === "Unknown" || f.value === "TBD";
            return (
              <div key={f.label} style={{ display: "contents" }}>
                <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", paddingTop: 2 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: isUnknown ? T.textFaint : (f.highlight ? T.accent : T.text), fontStyle: isUnknown ? "italic" : "normal" }}>{f.value}</div>
              </div>
            );
          })}
        </div>
      )}
      {group.cohabits && (
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, lineHeight: 1.5 }}>{group.cohabits}</div>
      )}
    </div>
  );
}

function SpeciesChoresTab({ species, chores }) {
  if (chores.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>No chores tagged for {species.name.toLowerCase()}.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
        Recurring chore definitions tagged for {species.name.toLowerCase()}. Once the recurrence engine generates instances, upcoming ones will appear here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {chores.map(c => <ChoreRow key={c.id} chore={c} />)}
      </div>
    </div>
  );
}

function ActivityLogTab({ species }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "36px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>No activity logged yet for {species.name.toLowerCase()}.</div>
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
        This tab will show LogEntry instances relevant to {species.name.toLowerCase()} — chore completions, feed logs, weight logs, and species-specific entries. Storage architecture is open — see thread_log_storage.
      </div>
    </div>
  );
}

function MoreInfoView({ species }) {
  return (
    <div>
      <DataField label="Acquisition" value={species.acquisition} />
      <DataField label="Feed regimen" value={species.feedRegimen ? species.feedRegimen.join(", ") + (species.feedNote ? `. ${species.feedNote}` : "") : null} />
      <DataField label="Processing" value={species.processingTimeline} />
      <DataField label="Feed tracking" value={species.feedTracking} />
      <DataField label="Brooder→Tractor" value={species.brooderToTractorTransition} />
      {species.lifecycle && species.lifecycle.length > 0 && (
        <Subsection title="Lifecycle">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {species.lifecycle.map((stage, idx) => (
              <div key={idx} style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500 }}>{stage.stage}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{stage.duration}</div>
                </div>
                {stage.graduationCriteria && <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, marginBottom: 4 }}><span style={{ color: T.accent }}>→</span> {stage.graduationCriteria}</div>}
                {stage.notes && <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6 }}>{stage.notes}</div>}
              </div>
            ))}
          </div>
        </Subsection>
      )}
      {species.constraints && species.constraints.length > 0 && (
        <Subsection title="Constraints">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: T.text, lineHeight: 1.8 }}>
            {species.constraints.map((c, idx) => <li key={idx}>{c}</li>)}
          </ul>
        </Subsection>
      )}
    </div>
  );
}

// ===============================================================
// SPACES, MACHINES, SUPPLIERS (unchanged from v0.5.0)
// ===============================================================
function SpacesContent({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {data.spaces.kinds.map(kind => {
        const items = data.spaces.items.filter(i => i.kindId === kind.id);
        return <SpaceKindPanel key={kind.id} kind={kind} items={items} />;
      })}
    </div>
  );
}
function SpaceKindPanel({ kind, items }) {
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <header style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
        <h3 style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, margin: 0 }}>{kind.label}</h3>
        {kind.usedBy && <p style={{ fontSize: 11, color: T.textDim, margin: 0, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Used by {kind.usedBy}</p>}
      </header>
      <div style={{ padding: "16px 24px" }}>
        <p style={{ fontSize: 13, color: T.text, lineHeight: 1.7, margin: 0, marginBottom: kind.movementMethod ? 10 : 0 }}>{kind.description}</p>
        {kind.movementMethod && <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, margin: 0 }}><span style={{ color: T.accent }}>→</span> {kind.movementMethod}</p>}
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "20px 24px", background: T.surfaceAlt }}>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>Instances · {items.length}</div>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic" }}>No instances recorded.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {items.map(item => <SpaceItemCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
function SpaceItemCard({ item }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "12px 14px" }}>
      <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500, marginBottom: 8 }}>{item.label}</div>
      {item.currentResidents ? (
        <div style={{ fontSize: 11, color: T.accent, lineHeight: 1.6, marginBottom: 6 }}>{item.currentResidents}</div>
      ) : (
        <div style={{ fontSize: 11, color: T.textFaint, fontStyle: "italic", marginBottom: 6 }}>No current residents</div>
      )}
      {item.notes && <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.surfaceAlt}` }}>{item.notes}</div>}
    </div>
  );
}

function MachinesContent({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {data.machines.map(m => <MachineRow key={m.id} machine={m} />)}
    </div>
  );
}
function MachineRow({ machine }) {
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 500 }}>{machine.label}</div>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{machine.category}</div>
      </div>
      <div style={{ fontSize: 11, color: T.textDim, marginBottom: 10 }}>{machine.manufacturer} · Model {machine.model}</div>
      {machine.uses.length > 0 && <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: T.text, lineHeight: 1.7 }}>{machine.uses.map((u, idx) => <li key={idx}>{u}</li>)}</ul>}
      {machine.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{machine.notes}</div>}
    </div>
  );
}

function SuppliersContent({ data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {data.suppliers.map(s => <SupplierRow key={s.id} supplier={s} />)}
    </div>
  );
}
function SupplierRow({ supplier }) {
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500 }}>{supplier.label}</div>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{supplier.category}</div>
      </div>
      <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Supplies</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: T.text, lineHeight: 1.7 }}>{supplier.supplies.map((s, idx) => <li key={idx}>{s}</li>)}</ul>
      {supplier.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{supplier.notes}</div>}
    </div>
  );
}

// ===============================================================
// CHORES + THREADS + GENERIC (unchanged from v0.5.0)
// ===============================================================
function ChoresContent({ data }) {
  return (
    <div>
      <Subsection title={`Definitions · ${data.chores.definitions.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, marginBottom: 28 }}>
          {data.chores.definitions.map(c => <ChoreRow key={c.id} chore={c} />)}
        </div>
      </Subsection>
      <Subsection title="Activity log">
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>No completions logged yet.</div>
          <div style={{ fontSize: 11, color: T.textFaint }}>Inspectable history of who completed which chore at what time will appear here.</div>
        </div>
      </Subsection>
      <Subsection title="Model notes">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.textDim, lineHeight: 1.8 }}>
          {data.chores.modelNotes.map((note, idx) => <li key={idx}>{note}</li>)}
        </ul>
      </Subsection>
    </div>
  );
}
function ChoreRow({ chore }) {
  return (
    <div style={{ background: T.surface, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500 }}>{chore.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chore.tags.map(tag => (
            <span key={tag} style={{ fontSize: 9, color: T.textDim, background: T.surfaceAlt, border: `1px solid ${T.border}`, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{tag}</span>
          ))}
        </div>
      </div>
      {chore.description && <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, margin: 0, marginBottom: 10 }}>{chore.description}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 11 }}>
        <ChoreField label="When" value={chore.when} />
        <ChoreField label="How" value={chore.how} />
        <ChoreField label="Who" value={chore.who} />
      </div>
    </div>
  );
}
function ChoreField({ label, value }) {
  const isTBD = value === "TBD";
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: isTBD ? T.warn : T.text, fontStyle: isTBD ? "italic" : "normal" }}>{value}</div>
    </div>
  );
}

function ThreadsContent({ data }) {
  const open = data.threads.filter(t => t.status === "open");
  const resolved = data.threads.filter(t => t.status === "resolved");
  return (
    <div>
      <Subsection title={`Open · ${open.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, marginBottom: 28 }}>
          {open.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
      <Subsection title={`Resolved · ${resolved.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
          {resolved.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
    </div>
  );
}
function ThreadRow({ thread }) {
  const isResolved = thread.status === "resolved";
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.text }}>{thread.title}</div>
        <span style={{ fontSize: 10, color: isResolved ? T.resolved : T.warn, textTransform: "uppercase", letterSpacing: "0.12em", flexShrink: 0 }}>{thread.status}</span>
      </div>
      <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7, margin: 0, marginBottom: isResolved || thread.notes ? 10 : 0 }}>{thread.question}</p>
      {thread.notes && <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic" }}>{thread.notes}</div>}
      {isResolved && thread.resolution && (
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}` }}>
          <span style={{ fontSize: 10, color: T.resolved, textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8 }}>→</span>{thread.resolution}
        </div>
      )}
    </div>
  );
}

function GenericItemList({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ background: T.surface, padding: "16px 20px" }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{item.title || item.name || "Untitled"}</div>
          {item.description && <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, margin: 0 }}>{item.description}</p>}
        </div>
      ))}
    </div>
  );
}

// ===============================================================
// FEEDS
// ===============================================================
function FeedsContent({ data }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Master list of feed types. Each feed references a supplier and carries a unit cost, package size, reorder rule, and lead time. Costs and lead times here are illustrative — see <em>thread_feed_specifics</em>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {data.feeds.map(f => <FeedRow key={f.id} feed={f} suppliers={data.suppliers} />)}
      </div>
    </div>
  );
}
function FeedRow({ feed, suppliers }) {
  const supplier = suppliers.find(s => s.id === feed.supplierId);
  const cost = `$${feed.costPerUnit.amount.toFixed(2)} / ${feed.costPerUnit.unit}`;
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500 }}>{feed.name}</div>
          {feed.description && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{feed.description}</div>}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 18, color: T.accent }}>{cost}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <FeedDetail label="Supplier" value={supplier?.label || feed.supplierId} />
        <FeedDetail label="Package" value={feed.packageSize.label} />
        <FeedDetail label="Reorder at" value={`${feed.reorderPoint.amount} ${feed.reorderPoint.unit}`} />
        <FeedDetail label="Reorder qty" value={`${feed.reorderQuantity.amount} ${feed.reorderQuantity.unit}`} />
        <FeedDetail label="Lead time" value={`${feed.leadTimeDays} days`} />
      </div>
      {feed.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{feed.notes}</div>}
    </div>
  );
}
function FeedDetail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.text }}>{value}</div>
    </div>
  );
}

// ===============================================================
// FEED SCHEDULE TAB (on species page)
// ===============================================================
function FeedScheduleTab({ species, schedules, feeds }) {
  if (schedules.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted }}>No feed schedule defined for {species.name.toLowerCase()}.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
        Read-only display of feed schedules for {species.name.toLowerCase()}. Editor and full week-by-week customization coming.
      </div>
      {schedules.map(s => <FeedSchedulePanel key={s.id} schedule={s} feeds={feeds} species={species} />)}
    </div>
  );
}
function FeedSchedulePanel({ schedule, feeds, species }) {
  const stagesWithCost = schedule.stages.map(stage => ({
    ...stage,
    feed: feeds.find(f => f.id === stage.feedTypeId),
    costInfo: computeStageCost(stage, feeds.find(f => f.id === stage.feedTypeId))
  }));
  const meteredCosts = stagesWithCost.filter(s => s.costInfo && s.costInfo.cost != null);
  const totalCost = meteredCosts.reduce((sum, s) => sum + s.costInfo.cost, 0);
  const totalAmount = meteredCosts.reduce((sum, s) => sum + s.costInfo.totalAmount, 0);
  const totalUnit = meteredCosts[0]?.costInfo.totalUnit || "";
  const assignedLabels = schedule.assignedGroupIds.map(gid => species.groups.find(g => g.id === gid)?.label || gid);
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <header style={{ padding: "18px 22px", borderBottom: `1px solid ${T.border}` }}>
        <h3 style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 500, margin: 0 }}>{schedule.name}</h3>
        {schedule.description && <p style={{ fontSize: 12, color: T.textDim, margin: "4px 0 0", lineHeight: 1.6 }}>{schedule.description}</p>}
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}` }}>
          <span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8, fontSize: 9 }}>Assigned to</span>
          {assignedLabels.join(", ") || "No groups assigned"}
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {stagesWithCost.map(s => <StageRow key={s.id} stage={s} anchorLabel={schedule.cycleAnchorLabel} />)}
      </div>
      {meteredCosts.length > 0 && (
        <div style={{ padding: "16px 22px", background: T.surfaceAlt, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Total estimated cost (metered stages)
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.accent }}>${totalCost.toFixed(2)}</div>
        </div>
      )}
      {meteredCosts.length > 0 && (
        <div style={{ fontSize: 10, color: T.textFaint, padding: "0 22px 14px", lineHeight: 1.5, fontStyle: "italic" }}>
          {totalAmount.toLocaleString()} {totalUnit} across {meteredCosts.length} metered stage{meteredCosts.length === 1 ? "" : "s"}. Excludes free-choice and TBD stages.
        </div>
      )}
    </section>
  );
}
function StageRow({ stage, anchorLabel }) {
  const dayRange = stage.endDay == null ? `Day ${stage.startDay}+` : `Days ${stage.startDay}–${stage.endDay}`;
  const days = stage.endDay == null ? null : stage.endDay - stage.startDay;
  let consumptionText, costText;
  if (stage.consumption.type === "free_choice") {
    consumptionText = "Free choice";
    costText = "Not estimated";
  } else if (stage.consumption.type === "tbd") {
    consumptionText = "TBD";
    costText = "Not yet computable";
  } else if (stage.consumption.type === "metered") {
    consumptionText = `${stage.consumption.amount} ${stage.consumption.unit} / ${stage.consumption.per} per ${stage.consumption.basis}`;
    if (stage.costInfo && stage.costInfo.cost != null) {
      costText = `$${stage.costInfo.cost.toFixed(2)} (${stage.costInfo.totalAmount.toLocaleString()} ${stage.costInfo.totalUnit} × $${stage.feed.costPerUnit.amount.toFixed(2)}/${stage.feed.costPerUnit.unit})`;
    } else if (stage.costInfo?.unitMismatch) {
      costText = "Unit mismatch — cost not computable";
    } else {
      costText = "Ongoing — not estimated";
    }
  } else {
    consumptionText = "Unknown";
    costText = "—";
  }
  return (
    <div style={{ background: T.surface, padding: "14px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 500 }}>{stage.name}</div>
        <div style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {dayRange}{days != null && ` · ${days} day${days === 1 ? "" : "s"}`}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 11 }}>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Feed</span><span style={{ color: T.text }}>{stage.feed?.name || stage.feedTypeId}</span></div>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Amount</span><span style={{ color: T.text }}>{consumptionText}</span></div>
        <div><span style={{ color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, marginRight: 6 }}>Cost</span><span style={{ color: stage.costInfo?.cost != null ? T.accent : T.textDim }}>{costText}</span></div>
      </div>
      {stage.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{stage.notes}</div>}
    </div>
  );
}

// ===============================================================
// EVENT KIND PAGE — Farmers markets, Pop-up events, Egg drop
// ===============================================================
function EventKindPage({ kind }) {
  if (kind.instances.length === 0) {
    return <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", padding: "32px 0", textAlign: "center" }}>No instances captured yet.</div>;
  }
  // Sort: recurring first by season start, then single-date by date
  const sorted = [...kind.instances].sort((a, b) => {
    if (a.recurrence && b.recurrence) return a.recurrence.seasonStart.localeCompare(b.recurrence.seasonStart);
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.recurrence) return -1;
    return 1;
  });
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(inst => <EventInstanceCard key={inst.id} instance={inst} />)}
      </div>
      {kind.notes && (
        <div style={{ marginTop: 18, padding: "12px 16px", background: T.surfaceAlt, border: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, lineHeight: 1.6, fontStyle: "italic" }}>{kind.notes}</div>
      )}
    </div>
  );
}
function EventInstanceCard({ instance }) {
  const isRecurring = !!instance.recurrence;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 500, lineHeight: 1.2 }}>{instance.label}</div>
        {instance.subtitle && <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{instance.subtitle}</div>}
      </div>
      {isRecurring ? <RecurringScheduleBlock recurrence={instance.recurrence} /> : <SingleDateBlock instance={instance} />}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Location</div>
        <div style={{ fontSize: 13, color: T.text }}>{instance.location.name}</div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{instance.location.address}</div>
      </div>
      {instance.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{instance.notes}</div>}
    </div>
  );
}
function RecurringScheduleBlock({ recurrence }) {
  const dayName = DAY_NAMES[recurrence.dayOfWeek];
  const time = `${formatTime12h(recurrence.startTime)} – ${formatTime12h(recurrence.endTime)}`;
  const season = `${formatDate(recurrence.seasonStart)} – ${formatDate(recurrence.seasonEnd)}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, fontSize: 11 }}>
      <div><div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Day</div><div style={{ fontSize: 13, color: T.text }}>{dayName}s</div></div>
      <div><div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Time</div><div style={{ fontSize: 13, color: T.text }}>{time}</div></div>
      <div><div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Season</div><div style={{ fontSize: 13, color: T.text }}>{season}</div></div>
    </div>
  );
}
function SingleDateBlock({ instance }) {
  const dateLong = formatLongDate(instance.date);
  const time = `${formatTime12h(instance.startTime)} – ${formatTime12h(instance.endTime)}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 11 }}>
      <div><div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Date</div><div style={{ fontSize: 13, color: T.text }}>{dateLong}</div></div>
      <div><div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Time</div><div style={{ fontSize: 13, color: T.text }}>{time}</div></div>
    </div>
  );
}

// ===============================================================
// SCHEDULE PAGE — Calendar / Timeline / Filters
// ===============================================================
function SchedulePage({ data, onShowDetail }) {
  const [view, setView] = useState("calendar");
  const today = useMemo(() => todayUTC(), []);
  const [viewDate, setViewDate] = useState(() => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  const [filters, setFilters] = useState({ farmers_market: true, popup_event: true, egg_drop: true, chore: false });

  const { fromDate, toDate } = useMemo(() => {
    if (view === "calendar") {
      const y = viewDate.getUTCFullYear(), m = viewDate.getUTCMonth();
      const start = new Date(Date.UTC(y, m, 1));
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 41);
      return { fromDate: start, toDate: end };
    }
    const start = today;
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 60);
    return { fromDate: start, toDate: end };
  }, [view, viewDate, today]);

  const occurrences = useMemo(
    () => getEventOccurrences(data.events, fromDate, toDate, filters),
    [data.events, fromDate, toDate, filters]
  );

  const goToPrevMonth = () => {
    setViewDate(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  };
  const goToNextMonth = () => {
    setViewDate(d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)));
  };
  const goToToday = () => {
    setViewDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
  };

  return (
    <div>
      <ScheduleControls
        view={view} onViewChange={setView}
        viewDate={viewDate}
        onPrev={goToPrevMonth} onNext={goToNextMonth} onToday={goToToday}
        filters={filters} onFiltersChange={setFilters}
        events={data.events}
      />
      {view === "calendar" ? (
        <CalendarView
          year={viewDate.getUTCFullYear()} month={viewDate.getUTCMonth()}
          occurrences={occurrences} today={today} onClickItem={onShowDetail}
        />
      ) : (
        <TimelineView occurrences={occurrences} today={today} onClickItem={onShowDetail} />
      )}
      <SyncNotice />
    </div>
  );
}

function ScheduleControls({ view, onViewChange, viewDate, onPrev, onNext, onToday, filters, onFiltersChange, events }) {
  const monthLabel = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", border: `1px solid ${T.border}`, background: T.surface }}>
            <ToggleBtn active={view === "calendar"} onClick={() => onViewChange("calendar")}>Calendar</ToggleBtn>
            <ToggleBtn active={view === "timeline"} onClick={() => onViewChange("timeline")}>Timeline</ToggleBtn>
          </div>
          {view === "calendar" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconBtn onClick={onPrev}><ChevronLeft size={14} /></IconBtn>
              <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500, minWidth: 160, textAlign: "center" }}>{monthLabel}</div>
              <IconBtn onClick={onNext}><ChevronRight size={14} /></IconBtn>
              <button onClick={onToday} style={{ marginLeft: 4, background: "transparent", border: `1px solid ${T.border}`, color: T.textDim, fontFamily: "inherit", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", padding: "5px 10px", cursor: "pointer" }}>Today</button>
            </div>
          )}
        </div>
      </div>
      <FilterChips filters={filters} onChange={onFiltersChange} events={events} />
    </div>
  );
}
function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.surfaceAlt : "transparent", border: "none",
      color: active ? T.text : T.textDim, fontFamily: "inherit", fontSize: 11,
      padding: "8px 14px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em"
    }}>{children}</button>
  );
}
function IconBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: T.surface, border: `1px solid ${T.border}`, color: T.textDim,
      padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
    }}>{children}</button>
  );
}

function FilterChips({ filters, onChange, events }) {
  const chipDefs = [
    { id: "farmers_market", label: "Markets", color: T.cat.farmers_market },
    { id: "popup_event", label: "Pop-ups", color: T.cat.popup_event },
    { id: "egg_drop", label: "Egg drop", color: T.cat.egg_drop },
    { id: "chore", label: "Chores", color: T.cat.chore, disabled: true }
  ];
  const toggle = id => onChange({ ...filters, [id]: !filters[id] });
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {chipDefs.map(c => {
        const active = filters[c.id];
        return (
          <button key={c.id} onClick={() => !c.disabled && toggle(c.id)} disabled={c.disabled} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: active ? T.surface : "transparent",
            border: `1px solid ${active ? c.color : T.border}`,
            color: c.disabled ? T.textFaint : (active ? T.text : T.textDim),
            fontFamily: "inherit", fontSize: 10, fontWeight: 500,
            padding: "6px 10px", cursor: c.disabled ? "not-allowed" : "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em",
            opacity: c.disabled ? 0.5 : 1
          }}>
            <span style={{ width: 8, height: 8, background: c.color, borderRadius: "50%" }} />
            {c.label}
            {c.disabled && <span style={{ fontSize: 8, fontStyle: "italic", textTransform: "none", letterSpacing: 0, marginLeft: 2 }}>no instances</span>}
          </button>
        );
      })}
    </div>
  );
}

function CalendarView({ year, month, occurrences, today, onClickItem }) {
  const start = new Date(Date.UTC(year, month, 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const dateStr = formatISODate(d);
    cells.push({ date: d, inMonth: d.getUTCMonth() === month, dateStr, items: occurrences.filter(o => o.date === dateStr), isToday: isSameDay(d, today) });
  }
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} style={{ padding: "10px 8px", fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((c, i) => <DayCell key={i} {...c} onClickItem={onClickItem} />)}
      </div>
    </div>
  );
}
function DayCell({ date, inMonth, items, isToday, onClickItem }) {
  return (
    <div style={{
      minHeight: 96, padding: "6px 6px 4px",
      borderRight: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`,
      background: isToday ? T.surfaceAlt : T.surface,
      opacity: inMonth ? 1 : 0.4, overflow: "hidden"
    }}>
      <div style={{ fontSize: 11, fontWeight: isToday ? 600 : 400, color: isToday ? T.accent : T.text, marginBottom: 4 }}>{date.getUTCDate()}</div>
      {items.slice(0, 2).map((it, idx) => (
        <button key={idx} onClick={() => onClickItem(it)} style={{
          display: "block", width: "100%", textAlign: "left", marginBottom: 2,
          background: T.cat[it.kindId] || T.textDim, border: "none", color: "#181c19",
          fontFamily: "inherit", fontSize: 9, fontWeight: 500,
          padding: "2px 5px", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>{formatTime12h(it.startTime).replace(" ", "")} {it.instanceLabel}</button>
      ))}
      {items.length > 2 && <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>+{items.length - 2} more</div>}
    </div>
  );
}

function TimelineView({ occurrences, today, onClickItem }) {
  if (occurrences.length === 0) {
    return (
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Nothing scheduled in the next 60 days.</div>
        <div style={{ fontSize: 11, color: T.textFaint }}>Try toggling a different filter or check back when more chores have specific times.</div>
      </div>
    );
  }
  // Group by date
  const byDate = {};
  for (const o of occurrences) { if (!byDate[o.date]) byDate[o.date] = []; byDate[o.date].push(o); }
  const dates = Object.keys(byDate).sort();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {dates.map(d => {
        const dDate = parseISODate(d);
        const isTodayRow = isSameDay(dDate, today);
        return (
          <div key={d}>
            <div style={{ fontSize: 11, color: isTodayRow ? T.accent : T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, fontWeight: isTodayRow ? 600 : 400 }}>
              {formatLongDate(d)}{isTodayRow && " · today"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
              {byDate[d].map((it, idx) => <TimelineRow key={idx} item={it} onClick={() => onClickItem(it)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
function TimelineRow({ item, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: T.surface, padding: "12px 16px", border: "none", textAlign: "left",
      cursor: "pointer", fontFamily: "inherit", display: "grid",
      gridTemplateColumns: "100px 4px 1fr auto", gap: 12, alignItems: "center"
    }}>
      <div style={{ fontSize: 11, color: T.textDim }}>{formatTime12h(item.startTime)}{item.endTime && ` – ${formatTime12h(item.endTime)}`}</div>
      <div style={{ width: 4, height: 28, background: T.cat[item.kindId] || T.textDim }} />
      <div>
        <div style={{ fontSize: 13, color: T.text, fontFamily: T.serif, fontWeight: 500 }}>{item.instanceLabel}</div>
        {item.subtitle && <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{item.subtitle}</div>}
      </div>
      <div style={{ fontSize: 11, color: T.textDim, textAlign: "right" }}>{item.location.name}</div>
    </button>
  );
}

function SyncNotice() {
  return (
    <div style={{ marginTop: 24, padding: "14px 16px", background: T.surfaceAlt, border: `1px dashed ${T.border}`, fontSize: 11, color: T.textMuted, lineHeight: 1.6 }}>
      <span style={{ color: T.warn, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 9, marginRight: 8 }}>Planned</span>
      Push-only sync to Google Calendar. Schedule changes here will publish to a linked GCal in a future build. Drag-and-drop reschedule, in-place editing of times, and the actual GCal API call are deferred — see <em>thread_schedule_full_scope</em>.
    </div>
  );
}

// ===============================================================
// DETAIL MODAL
// ===============================================================
function DetailModal({ item, onClose }) {
  const dateLong = formatLongDate(item.date);
  const time = item.endTime ? `${formatTime12h(item.startTime)} – ${formatTime12h(item.endTime)}` : formatTime12h(item.startTime);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, border: `1px solid ${T.border}`, padding: 28,
        maxWidth: 480, width: "100%", position: "relative"
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14, background: "transparent",
          border: "none", color: T.textDim, cursor: "pointer", padding: 4,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}><X size={16} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, background: T.cat[item.kindId] || T.textDim, borderRadius: "50%" }} />
          <span style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.14em" }}>{item.kindLabel}</span>
        </div>
        <h3 style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 500, margin: "0 0 4px", letterSpacing: "-0.01em" }}>{item.instanceLabel}</h3>
        {item.subtitle && <p style={{ fontSize: 12, color: T.textDim, margin: "0 0 18px" }}>{item.subtitle}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 18 }}>
          <Row label="Date" value={dateLong} />
          <Row label="Time" value={time} />
          <Row label="Location" value={<><div>{item.location.name}</div><div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{item.location.address}</div></>} />
          {item.recurring && <Row label="Recurrence" value="Recurring (weekly)" />}
        </div>
      </div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
