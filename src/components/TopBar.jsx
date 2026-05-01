import { Sprout } from "lucide-react";
import { T } from "../theme.js";

export default function TopBar({ data }) {
  return (
    <header style={{ borderBottom: `1px solid ${T.border}`, padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Sprout size={18} color={T.accent} />
        <h1 style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", margin: 0 }}>North Foster Farm</h1>
        <span style={{ fontSize: 10, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Admin · v{data.meta.version}</span>
      </div>
      <div style={{ fontSize: 11, color: T.textMuted }}>{data.meta.users.map(u => u.name).join(" + ")}</div>
    </header>
  );
}
