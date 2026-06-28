import { getSpeciesFromSectionId, getEventKindFromSectionId } from "../sections.jsx";
import ComingSoon from "./ComingSoon.jsx";
import { useRoute } from "../lib/router.js";
import Now from "../pages/Now.jsx";
import MapPage from "../pages/MapPage.jsx";
import Overview from "../pages/Overview.jsx";
import Machines from "../pages/Machines.jsx";
import Suppliers from "../pages/Suppliers.jsx";
import Feeds from "../pages/Feeds.jsx";
import Chores from "../pages/Chores.jsx";
import Threads from "../pages/Threads.jsx";
import Calendar from "../pages/Calendar.jsx";
import Schedule from "../pages/Schedule.jsx";
import SpeciesPage from "../pages/SpeciesPage.jsx";
import BatchPage from "../pages/BatchPage.jsx";
import Products from "../pages/Products.jsx";
import Inventory from "../pages/Inventory.jsx";
import Trailers from "../pages/Trailers.jsx";
import Activity from "../pages/Activity.jsx";
import Observations from "../pages/Observations.jsx";
import Settings from "../pages/Settings.jsx";
import Roadmap from "../pages/Roadmap.jsx";
import RethinkerGallery from "../pages/RethinkerGallery.jsx";
import SitesPage from "../pages/SitesPage.jsx";
import Inbox from "../pages/Inbox.jsx";
import Projects from "../pages/Projects.jsx";
import ProjectPage from "../pages/ProjectPage.jsx";
import Processes from "../pages/Processes.jsx";
import Customers from "../pages/Customers.jsx";
import FeedSchedulesPage from "../pages/FeedSchedulesPage.jsx";
import Metrics from "../pages/Metrics.jsx";
import Orders from "../pages/Orders.jsx";

export default function SectionContent({
  section, data, onOpenEvent, onNavigate, onOpenRounds,
}) {
  // Batch lifecycle deep links (/livestock/<species>/<batchId>) carry
  // the batch id on the route.
  const route = useRoute();

  // Sections explicitly flagged with comingSoon get the full-page placeholder.
  if (section.comingSoon) return <ComingSoon featureName={section.label} />;

  if (section.id.startsWith("livestock_")) {
    const sp = getSpeciesFromSectionId(section.id, data);
    if (!sp) return <ComingSoon featureName={section.label} />;
    // Batch lifecycle page (Batch 20).
    if (route.kind === "section" && route.batchId) {
      const batch = sp.groups.find(g => g.id === route.batchId) ?? null;
      return <BatchPage
        batch={batch}
        species={sp}
        data={data}
        onOpenEvent={onOpenEvent}
        onNavigate={onNavigate}
        key={route.batchId}
      />;
    }
    return <SpeciesPage species={sp} data={data} />;
  }
  if (section.id === "events_all") {
    // Folded into Schedule's Agenda view (Batch 14.1). Deep links
    // to /events/all keep landing here; the page just opens with a
    // different default view.
    return <Calendar data={data} onOpenEvent={onOpenEvent} initialView="agenda" />;
  }
  if (section.id.startsWith("events_")) {
    // Per-kind sidebar children → Schedule with that kind's filter
    // pre-applied (Batch 14.2). The standalone EventKindPage retired.
    const ek = getEventKindFromSectionId(section.id, data);
    if (!ek) return <ComingSoon featureName={section.label} />;
    return <Calendar
      data={data}
      onOpenEvent={onOpenEvent}
      initialFilter={ek.id}
      key={ek.id}
    />;
  }
  switch (section.id) {
    case "now": return <Now onOpenRounds={onOpenRounds} />;
    case "map":
      return <MapPage
        data={data}
        onOpenRounds={onOpenRounds}
        onNavigate={onNavigate}
        onOpenEvent={onOpenEvent}
      />;
    case "overview": return <Overview data={data} onNavigate={onNavigate} />;
    // The Metrics & analytics page (Batch 26.2).
    case "metrics": return <Metrics data={data} />;
    case "machines":
    case "resources_machinery":
      return <Machines data={data} />;
    case "suppliers":
    case "resources_suppliers":
      return <Suppliers data={data} />;
    case "feeds":
    case "resources_feed":
      return <Feeds data={data} />;
    // The feed schedule editor (Batch 25.2) — the "Manage feed"
    // sidebar action under Animals.
    case "manage_feed_schedule":
      return <FeedSchedulesPage data={data} />;
    case "resources_trailers": return <Trailers data={data} />;
    case "products": return <Products data={data} />;
    case "inventory": return <Inventory data={data} />;
    // The Sales group (Batch 29.1). "Point of sale" is the Sell tab on
    // the Products page (shipped in 28.2 — this deep link was the
    // missing wiring); "Add to inventory" opens Inventory with the
    // new-lot form already open (same pattern, Batch 28.1 leftover).
    case "orders": return <Orders />;
    case "point_of_sale":
      return <Products data={data} initialTab="sell" key="sell" />;
    case "add_to_inventory":
      return <Inventory data={data} startCreating key="new-lot" />;
    case "calendar": return <Calendar data={data} onOpenEvent={onOpenEvent} />;
    case "schedule": return <Schedule data={data} />;
    case "chores": return <Chores data={data} />;
    case "projects":
      // Project detail deep links (/projects/<projectId>) carry the
      // project id on the route (Batch 22).
      if (route.kind === "section" && route.projectId) {
        return <ProjectPage
          projectId={route.projectId}
          data={data}
          onOpenEvent={onOpenEvent}
          key={route.projectId}
        />;
      }
      return <Projects />;
    case "processes": return <Processes data={data} />;
    // Customers + Lists (Batch 24). Three sidebar entries, one page:
    // the Lists entry lands on the Lists tab, the add-customer action
    // lands on Directory with the new-customer form open.
    case "customers": return <Customers />;
    case "manage_lists": return <Customers initialTab="lists" key="lists" />;
    case "add_new_customer":
      return <Customers startCreating key="new-customer" />;
    case "inbox": return <Inbox onOpenEvent={onOpenEvent} />;
    case "activity": return <Activity />;
    case "observations": return <Observations />;
    case "threads": return <Threads data={data} />;
    case "settings": return <Settings />;
    case "roadmap": return <Roadmap />;
    case "rethinker": return <RethinkerGallery />;
    case "resources_sites": return <SitesPage data={data} />;
    default: {
      const items = data[section.id] ?? [];
      if (items.length === 0) return <ComingSoon featureName={section.label} />;
      return <GenericItemList items={items} />;
    }
  }
}

function GenericItemList({ items }) {
  return (
    <div className="flex flex-col gap-px bg-line">
      {items.map((item, idx) => (
        <div key={idx} className="bg-surface px-5 py-4">
          <div className="font-heading text-[16px] font-semibold mb-1">
            {item.title || item.name || "Untitled"}
          </div>
          {item.description && (
            <p className="text-[12px] text-dim leading-relaxed m-0">
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
