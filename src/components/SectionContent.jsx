import { getSpeciesFromSectionId, getEventKindFromSectionId } from "../sections.jsx";
import EmptyState from "./EmptyState.jsx";
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
import EventKindPage from "../pages/EventKindPage.jsx";
import Products from "../pages/Products.jsx";
import Inventory from "../pages/Inventory.jsx";

export default function SectionContent({ section, data, onShowDetail }) {
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
    case "overview": return <Overview data={data} />;
    case "spaces": return <Spaces data={data} />;
    case "machines": return <Machines data={data} />;
    case "suppliers": return <Suppliers data={data} />;
    case "feeds": return <Feeds data={data} />;
    case "products": return <Products data={data} />;
    case "inventory": return <Inventory data={data} />;
    case "schedule": return <Schedule data={data} onShowDetail={onShowDetail} />;
    case "chores": return <Chores data={data} />;
    case "threads": return <Threads data={data} />;
    default: {
      const items = data[section.id] ?? [];
      if (items.length === 0) return <EmptyState label={section.label} />;
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
