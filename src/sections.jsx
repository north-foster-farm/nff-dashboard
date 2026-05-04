import {
  Home, Bird, Egg, PawPrint, Wrench, Truck, Wheat,
  Calendar, ListChecks, Tent, Sparkles, Package, Tag, Boxes, Activity,
  FolderKanban, Workflow, NotebookPen, MessageCircleQuestion,
  Receipt, PackagePlus, Banknote, Users, ShoppingBag, Scissors,
  CalendarRange, Layers, Tractor, Container, Caravan, TreePine,
  Store, Cog, Box,
  UserPlus, ClipboardList, CalendarDays, Newspaper
} from "lucide-react";

// Updates flagged as needing attention — anything sitting in or past review.
// Surfaced as the counter on both Farm updates and Content calendar.
function countUpdatesNeedingAttention(d) {
  return (d.updates ?? []).filter(u => u.status === "ready_for_review" || u.status === "reviewed").length;
}

// Top-level sidebar entries. `kind`:
//   "page"    → normal navigation item (default)
//   "spacer"  → renders only as a vertical gap
//   "action"  → renders with an arrow indicator (action-style item)
//   "flyout"  → renders with a chevron; opens a submenu pane with `children`
//   "hidden"  → not rendered in the sidebar; reachable by other UI (e.g.
//               settings via the header avatar)
//
// `comingSoon: true` flags a section that should render the ComingSoon
// placeholder when navigated to.
export const SECTIONS = [
  { id: "overview", group: null, label: "Dashboard", icon: Home, description: "Single-glance state of the farm", getCount: () => null },

  { kind: "spacer" },

  { id: "schedule", group: "Planning", label: "Schedule", icon: Calendar, description: "Calendar and timeline view of everything date-bound", getCount: () => null },
  { id: "chores", group: "Planning", label: "Chores", icon: ListChecks, description: "Recurring scheduled work and the activity log",
    // "Chores left to do today". With no completion log modeled yet, fall back to the
    // total count of chore definitions (i.e. nothing has been logged as done yet).
    // 0 when there are no chores at all.
    getCount: (d) => d.chores.definitions.length },
  { id: "projects", group: "Planning", label: "Projects", icon: FolderKanban, description: "Discrete, time-bound work",
    // Projects active today and not yet complete.
    getCount: (d) => {
      const today = new Date().toISOString().slice(0, 10);
      return d.projects.filter(p => p.status !== "completed" && (!p.start || p.start <= today) && (!p.end || p.end >= today)).length;
    }
  },
  { id: "processes", group: "Planning", label: "Processes", icon: Workflow, description: "Repeatable workflows and SOPs", comingSoon: true, getCount: () => null },

  { id: "products", group: "Products", label: "All Products", icon: Tag, description: "What NFF sells — SKUs by size bracket, with cost-floor and pricing-recommendation surface", getCount: () => null },
  { id: "inventory", group: "Products", label: "Inventory", icon: Boxes, description: "Current stock — egg cartons in the fridge, chicken lots in freezers, FIFO-ordered", getCount: () => null },
  { id: "add_to_inventory", group: "Products", label: "Add to inventory", icon: PackagePlus, kind: "action", description: "Quick form to record new lots — eggs collected, broiler lots after processing day. Placeholder.", getCount: () => null },

  { id: "orders", group: "Sales", label: "Orders", icon: Receipt, description: "Customer orders against inventory and event sales — placeholder until the sales model is built.",
    // Open orders. No order model yet → 0.
    getCount: (d) => (d.orders ?? []).filter(o => o.status === "open").length },
  { id: "point_of_sale", group: "Sales", label: "Point of sale", icon: Banknote, kind: "action", description: "Record a sale on the spot at a market or event — drains inventory FIFO. Placeholder.", getCount: () => null },

  { id: "events_all", group: "Events", label: "All events", icon: CalendarRange, description: "Every event in chronological order, with type filters and a date-range selector.", getCount: () => null },
  { id: "events_all_types", group: "Events", label: "Event types", flyoutTitle: "Types of events", icon: Layers, kind: "flyout",
    children: [
      // Sorted alphabetically by label.
      { id: "events_deliveries", label: "Deliveries", icon: Truck, description: "Deliveries to wholesale or restaurant partners. Placeholder." },
      { id: "events_egg_drop", label: "Egg drop", icon: Package, description: "Off-season egg pickup at the same farmers market site." },
      { id: "events_farmers_market", label: "Farmers markets", icon: Tent, description: "Recurring weekly farmers markets NFF attends during market season." },
      { id: "events_farm_visits", label: "Farm visits", icon: Users, description: "Visitors coming to the farm. Placeholder." },
      { id: "events_pickups", label: "Pick-ups", icon: ShoppingBag, description: "Customer pick-ups directly from the farm. Placeholder." },
      { id: "events_popup_event", label: "Pop-ups", icon: Sparkles, description: "One-off selling occasions outside the regular weekly schedule." },
      { id: "events_processing_days", label: "Processing days", icon: Scissors, description: "Broiler-processing day events. Placeholder until process is formalized." }
      // Note: keep ids in sync with data.events.kinds[].id (after the `events_` prefix).
    ]
  },

  { id: "livestock_layers", group: "Animals", label: "Layers", icon: Egg, getCount: () => null },
  { id: "livestock_broilers", group: "Animals", label: "Broilers", icon: Bird, getCount: () => null },
  { id: "livestock_sheep", group: "Animals", label: "Sheep", icon: PawPrint, getCount: () => null },
  { id: "manage_feed_schedule", group: "Animals", label: "Manage feed", icon: Wheat, kind: "action", description: "Edit the per-species feed schedule by week of life. Placeholder.", getCount: () => null },

  { id: "customers", group: "CRM", label: "Customers", icon: Users, description: "Customer directory \u2014 placeholder until the CRM model is built.", getCount: () => null },
  { id: "manage_lists", group: "CRM", label: "Lists", icon: ClipboardList, description: "Customer lists \u2014 segmentation, mailing groups, etc. Placeholder.", getCount: () => null },
  { id: "add_new_customer", group: "CRM", label: "Add new customer", icon: UserPlus, kind: "action", description: "Create a new customer record. Placeholder.", getCount: () => null },

  // "Items needing attention" — drafts that have been pushed to review and are
  // awaiting a decision. Shared count between Farm updates and Content calendar
  // so the two surfaces stay in sync.
  { id: "farm_news_updates", group: "Communication", label: "Farm updates", icon: Newspaper, description: "Drafted, in-review, and published farm updates.",
    getCount: countUpdatesNeedingAttention },
  { id: "content_calendar", group: "Communication", label: "Content calendar", icon: CalendarDays, description: "Plan and schedule customer-facing communication. Placeholder.",
    getCount: countUpdatesNeedingAttention },

  { id: "resources_all", group: "Resources", label: "Resource types", flyoutTitle: "Types of resources", icon: Layers, kind: "flyout",
    children: [
      // Sorted alphabetically by label.
      { id: "resources_brooders", label: "Brooders", icon: Box, description: "Heated enclosures for chicks. Placeholder." },
      { id: "resources_chicken_tractors", label: "Chicken tractors", icon: Tractor, description: "Mobile bottomless pens used on pasture. Placeholder." },
      { id: "resources_containers", label: "Containers", icon: Container, description: "Storage containers and bins. Placeholder." },
      { id: "resources_equipment", label: "Equipment", icon: Wrench, description: "General equipment — egg washer, processing tools, etc. Placeholder." },
      { id: "resources_feed", label: "Feed", icon: Wheat, description: "Feed types, suppliers, costs, and reorder rules." },
      { id: "resources_machinery", label: "Machinery", icon: Cog, description: "Powered equipment owned by the farm." },
      { id: "resources_mobile_coops", label: "Mobile coops", icon: Caravan, description: "Wheeled hen coops moved across paddocks. Placeholder." },
      { id: "resources_pastures", label: "Pastures", icon: TreePine, description: "Paddocks and grazing areas. Placeholder." },
      { id: "resources_suppliers", label: "Suppliers", icon: Store, description: "Vendors and sources NFF buys from." },
      { id: "resources_trailers", label: "Trailers", icon: Truck, description: "Towable trailers used for transport." }
    ]
  },

  { id: "activity", group: "Other", label: "Activity", icon: Activity, description: "Every action logged across the farm — chore completions, temperature readings, weight logs, sales, and more.", getCount: () => null },
  { id: "notes", group: "Other", label: "Notes", icon: NotebookPen, description: "Uncategorized brain dumps", getCount: () => null },
  { id: "threads", group: "Other", label: "Threads", icon: MessageCircleQuestion, description: "Open questions and resolved decisions", getCount: (d) => d.threads.filter(t => t.status === "open").length },

  // Reachable only via the header avatar (UserAvatarMenu).
  { id: "settings", kind: "hidden", label: "Settings", description: "Per-user preferences" }
];

export function findSection(id) {
  for (const s of SECTIONS) {
    if (s.kind === "spacer") continue;
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

export function resolveSectionDescription(section, data) {
  if (section.description) return section.description;
  const sp = getSpeciesFromSectionId(section.id, data);
  if (sp) return `${sp.purpose} · Tracked by ${sp.trackingModel}`;
  const ek = getEventKindFromSectionId(section.id, data);
  if (ek) return ek.description;
  return "";
}
