import { T } from "../theme.js";
import { SECTIONS } from "../sections.jsx";

export default function Sidebar({ current, onSelect, data }) {
  let lastGroup = undefined;
  return (
    <nav style={{ width: 220, borderRight: `1px solid ${T.border}`, padding: "20px 0", flexShrink: 0, overflowY: "auto" }}>
      {SECTIONS.map(s => {
        const showHeader = s.group !== lastGroup;
        lastGroup = s.group;
        const Icon = s.icon;
        const count = s.getCount(data);
        const active = s.id === current;
        return (
          <div key={s.id}>
            {showHeader && s.group !== null && (
              <div style={{ padding: "16px 24px 6px", fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.18em" }}>{s.group}</div>
            )}
            {showHeader && s.group === null && <div style={{ padding: "0 24px 6px" }} />}
            <button onClick={() => onSelect(s.id)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 22px",
              background: active ? T.surface : "transparent", border: "none",
              borderLeft: active ? `2px solid ${T.accent}` : "2px solid transparent",
              color: active ? T.text : T.textDim, fontFamily: "inherit", fontSize: 13,
              cursor: "pointer", textAlign: "left"
            }}>
              <Icon size={14} />
              <span style={{ flex: 1 }}>{s.label}</span>
              {count !== null && <span style={{ fontSize: 11, color: count > 0 ? T.textDim : T.textFaint }}>{count}</span>}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
