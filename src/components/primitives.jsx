import { T } from "../theme.js";

export function DataField({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 16, padding: "8px 0", borderBottom: `1px solid ${T.surfaceAlt}` }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", paddingTop: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

export function Subsection({ title, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function Tile({ label, value }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "18px 20px" }}>
      <div style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 500, lineHeight: 1, color: value > 0 ? T.text : T.textMuted, marginBottom: 8 }}>{String(value).padStart(2, "0")}</div>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
    </div>
  );
}

export function TabStrip({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, marginBottom: 24, flexWrap: "wrap" }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            background: "transparent", border: "none",
            borderBottom: isActive ? `2px solid ${T.accent}` : "2px solid transparent",
            color: isActive ? T.text : T.textDim, fontFamily: "inherit", fontSize: 11, fontWeight: 500,
            padding: "10px 14px", cursor: "pointer", marginBottom: -1,
            textTransform: "uppercase", letterSpacing: "0.12em"
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

export function Row({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}
