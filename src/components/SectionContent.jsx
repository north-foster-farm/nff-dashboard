import { getSpeciesFromSectionId, getEventKindFromSectionId } from "../sections.jsx";
import ComingSoon from "./ComingSoon.jsx";
import { T } from "../theme.js";
import Overview from "../pages/Overview.jsx";
import Spaces from "../pages/Spaces.jsx";
import Machines from "../pages/Machines.jsx";
import Suppliers from "../pages/Suppliers.jsx";
import Feeds from "../pages/Feeds.jsx";
import Chores from "../pages/Chores.jsx";
import Threads from "../pages/Threads.jsx";
import Schedule from "../pages/Schedule.jsx";
import SpeciesPage from "../pages/SpeciesPage.jsx";
import Products from "../pages/Products.jsx";
import Inventory from "../pages/Inventory.jsx";
import Trailers from "../pages/Trailers.jsx";
import Activity from "../pages/Activity.jsx";
import Observations from "../pages/Observations.jsx";
import Settings from "../pages/Settings.jsx";
import Roadmap from "../pages/Roadmap.jsx";
import SitesPage from "../pages/SitesPage.jsx";

export default function SectionContent({ section, data, onOpenEvent, onNavigate }) {
  // Sections explicitly flagged with comingSoon get the full-page placeholder.
  if (section.comingSoon) return <ComingSoon featureName={section.label} />;

  if (section.id.startsWith("livestock_")) {
    const sp = getSpeciesFromSectionId(section.id, data);
    if (!sp) return <ComingSoon featureName={section.label} />;
    return <SpeciesPage species={sp} data={data} />;
  }
  if (section.id === "events_all") {
    // Folded into Schedule's Agenda view (Batch 14.1). Deep links
    // to /events/all keep landing here; the page just opens with a
    // different default view.
    return <Schedule data={data} onOpenEvent={onOpenEvent} initialView="agenda" />;
  }
  if (section.id.startsWith("events_")) {
    // Per-kind sidebar children → Schedule with that kind's filter
    // pre-applied (Batch 14.2). The standalone EventKindPage retired.
    const ek = getEventKindFromSectionId(section.id, data);
    if (!ek) return <ComingSoon featureName={section.label} />;
    return <Schedule
      data={data}
      onOpenEvent={onOpenEvent}
      initialFilter={ek.id}
      key={ek.id}
    />;
  }
  switch (section.id) {
    case "overview": return <Overview data={data} onNavigate={onNavigate} />;
    case "spaces": return <Spaces data={data} />;
    case "machines":
    case "resources_machinery":
      return <Machines data={data} />;
    case "suppliers":
    case "resources_suppliers":
      return <Suppliers data={data} />;
    case "feeds":
    case "resources_feed":
      return <Feeds data={data} />;
    case "resources_trailers": return <Trailers data={data} />;
    case "products": return <Products data={data} />;
    case "inventory": return <Inventory data={data} />;
    case "schedule": return <Schedule data={data} onOpenEvent={onOpenEvent} />;
    case "chores": return <Chores data={data} />;
    case "activity": return <Activity />;
    case "observations": return <Observations />;
    case "threads": return <Threads data={data} />;
    case "settings": return <Settings />;
    case "roadmap": return <Roadmap />;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ background: T.surface, padding: "16px 20px" }}>
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{item.title || item.name || "Untitled"}</div>
          {item.description && <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, margin: 0 }}>{item.description}</p>}
        </div>
      ))}
    </div>
  );
}
