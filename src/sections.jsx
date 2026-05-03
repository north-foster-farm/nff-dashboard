import {
  Home, Bird, Egg, PawPrint, Building2, Wrench, Truck, Wheat,
  Calendar, ListChecks, Tent, Sparkles, Package, Tag, Boxes,
  FolderKanban, Workflow, NotebookPen, MessageCircleQuestion
} from "lucide-react";

export const SECTIONS = [
  { id: "overview", group: null, label: "Overview", icon: Home, description: "Single-glance state of the farm", getCount: () => null },
  { id: "livestock_layers", group: "Livestock", label: "Layers", icon: Egg, getCount: (d) => d.livestock.species.find(s => s.id === "layers")?.groups.length ?? 0 },
  { id: "livestock_broilers", group: "Livestock", label: "Broilers", icon: Bird, getCount: (d) => d.livestock.species.find(s => s.id === "broilers")?.groups.length ?? 0 },
  { id: "livestock_sheep", group: "Livestock", label: "Sheep", icon: PawPrint, getCount: (d) => d.livestock.species.find(s => s.id === "sheep")?.groups.length ?? 0 },
  { id: "spaces", group: "Entities", label: "Spaces", icon: Building2, description: "Physical locations: coops, brooders, pasture, chicken tractors", getCount: (d) => d.spaces.items.length },
  { id: "machines", group: "Entities", label: "Machines", icon: Wrench, description: "Powered equipment owned by the farm", getCount: (d) => d.machines.length },
  { id: "suppliers", group: "Entities", label: "Suppliers", icon: Truck, description: "Vendors and sources NFF buys from", getCount: (d) => d.suppliers.length },
  { id: "feeds", group: "Entities", label: "Feeds", icon: Wheat, description: "Feed types, suppliers, costs, and reorder rules", getCount: (d) => d.feeds.length },
  { id: "products", group: "Commerce", label: "Products", icon: Tag, description: "What NFF sells — SKUs by size bracket, with cost-floor and pricing-recommendation surface", getCount: (d) => d.productKinds.reduce((a, k) => a + k.sizeBrackets.length, 0) },
  { id: "inventory", group: "Commerce", label: "Inventory", icon: Boxes, description: "Current stock — egg cartons in the fridge, chicken lots in freezers, FIFO-ordered", getCount: (d) => d.inventory.eggLots.length + d.inventory.chickenLots.length },
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
