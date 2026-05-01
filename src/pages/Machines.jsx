import { T } from "../theme.js";

export default function Machines({ data }) {
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
