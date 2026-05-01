import { T } from "../theme.js";

export default function Suppliers({ data }) {
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
