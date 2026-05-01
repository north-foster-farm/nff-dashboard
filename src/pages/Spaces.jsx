import { T } from "../theme.js";

export default function Spaces({ data }) {
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
