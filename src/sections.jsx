import {
  Home, Egg, Wrench, Truck, Wheat,
  Calendar, CalendarCheck, ListChecks, Tent, Sparkles, Package, Tag, Boxes, Activity,
  FolderKanban, Workflow, NotebookPen, MessageCircleQuestion,
  Receipt, PackagePlus, Banknote, Users, ShoppingBag, Scissors,
  CalendarRange, CalendarClock, Store, Cog, Sunrise, Telescope,
  UserPlus, ClipboardList, CalendarDays, Newspaper, Map, MapPin, Eye,
  Lightbulb, ChartLine, Palette, Bot
} from "lucide-react";
import { isQueuedProject } from "./lib/projects.js";
import { choresRemainingToday } from "./lib/chores.js";
import { Sheep, Chicken } from "./components/animalIcons.jsx";

// Updates flagged as needing attention — anything sitting in or past review.
// Surfaced as the counter on both Farm updates and Content calendar.
function countUpdatesNeedingAttention(d) {
  return (d.updates ?? []).filter(u => u.status === "ready_for_review" || u.status === "reviewed").length;
}

// ── Primary navigation (the sidebar) ─────────────────────────────────
//
// Restructured in Batch 18.2 (the farm-map IA overhaul): the sidebar
// carries the spatial/temporal surfaces — Now · Farm map · Dashboard,
// then Planning (Schedule / Events / Chores / Do rounds / Projects /
// Processes), the record-keeping groups (Products / Sales / Animals /
// CRM / Communication / Resources), which moved back here from the
// avatar records drawer in the 2026-06 chore-ux fixes, and finally
// the Other log pages (kept last in the menu).
//
// `kind`:
//   "page"    → normal navigation item (default)
//   "action"  → renders with an arrow indicator (action-style item)
//   "flyout"  → renders with a chevron; opens a submenu pane with `children`
//   "takeover"→ custom full-screen surface (Rounds)
//   "hidden"  → not rendered in the sidebar; reachable by other UI
//
// `comingSoon: true` flags a section that should render the ComingSoon
// placeholder when navigated to.
export const SECTIONS = [
  // The Now surface (Batch 17) — the time-anchored landing. Phones land
  // here by default (App.jsx).
  { id: "now", group: null, label: "Now", icon: Sunrise, description: "What needs doing right now — the active round plus every overdue chore, tagged with its place.", getCount: () => null },
  // The Farm map (Batch 18.2) — the place-anchored landing. Desktop
  // lands here by default (decision 2 of the farm-map workshop).
  { id: "map", group: null, label: "Farm map", icon: Map, description: "The farm from above — every zone tinted by what needs doing inside it. Click to drill into any place.", getCount: () => null },
  { id: "overview", group: null, label: "Dashboard", icon: Home, description: "Single-glance state of the farm", getCount: () => null },
  // The Metrics & analytics surface (Batch 26.2) — "how are we doing?"
  // with numbers: cross-batch comparison sheets + the metric registry.
  { id: "metrics", group: null, label: "Metrics", icon: ChartLine, description: "Performance numbers side by side — FCR, daily gain, uniformity, and mortality per broiler batch; hen-housed production and feed efficiency per layer flock.", getCount: () => null },

  { id: "schedule", group: "Planning", label: "Schedule", icon: CalendarCheck, description: "Today's plan — chores, projects, and events as one agreed day", getCount: () => null },
  // Availability (batch 42 slice 6, F50/F51): time off, per-person
  // working hours, and farm-wide breaks — the rows the schedule's
  // availability engine plans around.
  { id: "availability", group: "Planning", label: "Availability",
    icon: CalendarClock,
    description: "Who's here and when — time off, working hours, " +
      "and breaks the schedule plans around.",
    getCount: () => null },
  { id: "calendar", group: "Planning", label: "Calendar", icon: Calendar, description: "Calendar and timeline view of everything date-bound", getCount: () => null },
  { id: "events_all_types", group: "Planning", label: "Events", flyoutTitle: "Events", icon: CalendarRange, kind: "flyout",
    children: [
      // First child is the unfiltered Agenda view (replaces the
      // pre-14.2 "All events" top-level entry).
      { id: "events_all", label: "All events", icon: CalendarRange, description: "Every event in chronological order — Calendar with the Agenda view selected." },
      // Per-kind children are saved-filter chip presets — clicking
      // any of them lands on Calendar with that one kind's filter on
      // (Batch 14.2; per-kind pages retired. The surface was renamed
      // Schedule -> Calendar in 41.4, f712c14). Keep ids in sync with
      // data.events.kinds[].id (after the `events_` prefix).
      { id: "events_deliveries", label: "Deliveries", icon: Truck, description: "Deliveries to wholesale or restaurant partners — Calendar filtered to this kind." },
      { id: "events_egg_drop", label: "Egg drop", icon: Package, description: "Off-season egg pickup at the same farmers market site." },
      { id: "events_farmers_market", label: "Farmers markets", icon: Tent, description: "Recurring weekly farmers markets NFF attends during market season." },
      { id: "events_farm_visits", label: "Farm visits", icon: Users, description: "Visitors coming to the farm." },
      { id: "events_pickups", label: "Pick-ups", icon: ShoppingBag, description: "Customer pick-ups directly from the farm." },
      { id: "events_popup_event", label: "Pop-ups", icon: Sparkles, description: "One-off selling occasions outside the regular weekly schedule." },
      { id: "events_processing_days", label: "Processing days", icon: Scissors, description: "Broiler-processing day events." }
    ]
  },
  { id: "chores", group: "Planning", label: "Chores", icon: ListChecks, description: "Recurring scheduled work and the activity log",
    // "Chores left to do today": due today minus anything with a
    // completion logged (chore-level; Sidebar passes the ctx). Without
    // ctx (loading, or a caller that has none) everything due counts.
    getCount: (d, ctx) =>
      choresRemainingToday(d, ctx?.today ?? new Date(), ctx?.completedChoreIds) },
  // Custom takeover entry: clicking this opens the full-screen Rounds
  // surface, bypassing the normal layout. Sidebar.jsx detects
  // `kind: "takeover"` and renders a custom item with a live label.
  { id: "rounds", group: "Planning", label: "Do rounds", icon: ListChecks, description: "Full-screen surface for actually doing chores.", kind: "takeover", getCount: () => null },
  { id: "projects", group: "Planning", label: "Projects", icon: FolderKanban, description: "Discrete, time-bound work — phases, steps, and checklists with assignees, dates, and progress.",
    // Live work: the ranked queue, minus completed and archived
    // (0.6 — one activity model; dates no longer gate the count).
    getCount: (d) => d.projects.filter(isQueuedProject).length
  },
  { id: "processes", group: "Planning", label: "Processes", icon: Workflow, description: "Templates tied to event kinds — when a matching event lands on the schedule, the process expands into prep tasks and chore changes around it.", getCount: () => null },

  // ── Records (back in the sidebar, 2026-06 chore-ux fixes) ───────────
  // These lived in the avatar records drawer from Batch 18.2 until
  // James asked for them back in the left nav. Same ids, so every
  // deep link and SectionContent case keeps working unchanged.
  { id: "products", group: "Products", label: "All products", icon: Tag, description: "What NFF sells — the catalog: photos, descriptions, size brackets, and prices, grouped by animal", getCount: () => null },
  { id: "inventory", group: "Products", label: "Inventory", icon: Boxes, description: "Current stock — egg cartons in the fridge, chicken lots in freezers, FIFO-ordered", getCount: () => null },
  { id: "add_to_inventory", group: "Products", label: "Add to inventory", icon: PackagePlus, kind: "action", description: "Quick form to record new lots — eggs collected, broiler lots after processing day.", getCount: () => null },

  // Orders (Batch 29.1): the count is everything still awaiting action
  // — open plus ready-but-not-fulfilled.
  { id: "orders", group: "Sales", label: "Orders", icon: Receipt, description: "Customer orders — what's been promised, to whom, and for how much. Fulfilling an order records the sale and draws down inventory.",
    getCount: (d) => (d.orders ?? []).filter(o => o.status === "open" || o.status === "ready").length },
  { id: "point_of_sale", group: "Sales", label: "Point of sale", icon: Banknote, kind: "action", description: "Record a sale on the spot at a market or event — drains inventory FIFO. Opens the Products page's Sell tab.", getCount: () => null },

  { id: "livestock_layers", group: "Animals", label: "Layers", icon: Egg, getCount: () => null },
  { id: "livestock_broilers", group: "Animals", label: "Broilers", icon: Chicken, getCount: () => null },
  { id: "livestock_sheep", group: "Animals", label: "Sheep", icon: Sheep, getCount: () => null },
  { id: "manage_feed_schedule", group: "Animals", label: "Manage feed", icon: Wheat, kind: "action", description: "The feed programs by species — what each group eats, how much per day, and when the amounts change as the animals age. The Feed page's reorder projections run on these numbers.", getCount: () => null },

  { id: "customers", group: "CRM", label: "Customers", icon: Users, description: "The customer directory — names, emails, phones, and notes, searchable and editable.", getCount: () => null },
  { id: "manage_lists", group: "CRM", label: "Lists", icon: ClipboardList, description: "Named customer lists — mailing groups, egg-drop regulars, wholesale accounts.", getCount: () => null },
  { id: "add_new_customer", group: "CRM", label: "Add new customer", icon: UserPlus, kind: "action", description: "Create a new customer record.", getCount: () => null },

  { id: "farm_news_updates", group: "Communication", label: "Farm updates", icon: Newspaper, description: "Drafted, in-review, and published farm updates.",
    getCount: countUpdatesNeedingAttention },
  { id: "content_calendar", group: "Communication", label: "Content calendar", icon: CalendarDays, description: "Plan and schedule customer-facing communication. Placeholder.",
    getCount: countUpdatesNeedingAttention },

  { id: "resources_feed", group: "Resources", label: "Feed", icon: Wheat, description: "Feed types, suppliers, costs, and reorder rules.", getCount: () => null },
  { id: "resources_suppliers", group: "Resources", label: "Suppliers", icon: Store, description: "Vendors and sources NFF buys from.", getCount: () => null },
  { id: "resources_machinery", group: "Resources", label: "Machinery", icon: Cog, description: "Powered equipment owned by the farm.", getCount: () => null },
  { id: "resources_trailers", group: "Resources", label: "Trailers", icon: Truck, description: "Towable trailers used for transport.", getCount: () => null },
  { id: "resources_sites", group: "Resources", label: "Places", icon: MapPin, description: "The recursive place tree — every zone, area, and structure on the farm. The map renders this.", getCount: () => null },
  { id: "resources_equipment", group: "Resources", label: "Equipment", icon: Wrench, description: "General equipment — egg washer, processing tools, etc. Placeholder.", comingSoon: true, getCount: () => null },

  // ── Other — kept last in the menu (2026-06 chore-ux fixes) ──────────
  { id: "inbox", group: "Other", label: "Inbox", icon: Lightbulb, description: "Just-a-thought capture — ideas that aren't yet projects or chores. Pin, archive, or promote them to events.", getCount: () => null },
  { id: "proposals", group: "Other", label: "Proposals", icon: Bot, description: "Actions a Claude chat has proposed for the farm — new projects and more. Approve one and the app creates it for real; reject to discard. Nothing changes your data until you approve it.", getCount: () => null },
  { id: "roadmap", group: "Other", label: "What's coming", icon: Telescope, description: "Features on deck for upcoming releases.", getCount: () => null },
  // `external` (round 6): the nav link opens the static doc site in its
  // own tab — the in-app iframe page is gone (NO-LEGACY).
  { id: "style_guide", group: "Other", label: "Style guide", icon: Palette, external: "/style-guide/index.html", description: "The design system, component library, patterns, and tone & voice — the bounded source of truth for how the app looks and reads.", getCount: () => null },
  { id: "activity", group: "Other", label: "Activity", icon: Activity, description: "Every action logged across the farm — chore completions, temperature readings, weight logs, sales, and more.", getCount: () => null },
  { id: "observations", group: "Other", label: "Observations", icon: Eye, description: "Notes, condition flags, mortality, cohort moves, and infra sweeps logged from Rounds — filterable by site, kind, date, and author.", getCount: () => null },
  { id: "notes", group: "Other", label: "Notes", icon: NotebookPen, description: "Uncategorized brain dumps", getCount: () => null },
  { id: "threads", group: "Other", label: "Threads", icon: MessageCircleQuestion, description: "Open questions and resolved decisions", getCount: (d) => d.threads.filter(t => t.status === "open").length },

  // Reachable via the header avatar.
  { id: "settings", kind: "hidden", label: "Settings", description: "Per-user preferences" }
];

export function findSection(id) {
  for (const s of SECTIONS) {
    if (s.id === id) return s;
    if (s.children) {
      const c = s.children.find(ch => ch.id === id);
      if (c) return c;
    }
  }
  return null;
}

export function findFlyoutParentForChild(id) {
  for (const s of SECTIONS) {
    if (s.kind === "flyout" && s.children?.some(c => c.id === id)) return s;
  }
  return null;
}

export function getSpeciesFromSectionId(id, data) {
  if (!id.startsWith("livestock_")) return null;
  return data.livestock.species.find(s => s.id === id.replace("livestock_", "")) ?? null;
}

export function getEventKindFromSectionId(id, data) {
  if (!id.startsWith("events_")) return null;
  return data.events.kinds.find(k => k.id === id.replace("events_", "")) ?? null;
}

