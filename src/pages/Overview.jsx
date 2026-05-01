import { T } from "../theme.js";
import { Tile } from "../components/primitives.jsx";

export default function Overview({ data }) {
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
