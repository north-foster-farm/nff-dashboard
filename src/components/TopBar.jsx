import { useState } from "react";
import { Sprout } from "lucide-react";
import { T } from "../theme.js";

export default function TopBar({ data }) {
  return (
    <header style={{ borderBottom: `1px solid ${T.border}`, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.bg, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <LogoMark />
        <span style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>Admin · v{data.meta.version}</span>
      </div>
      <div style={{ fontSize: 12, color: T.textDim }}>{data.meta.users.map(u => u.name).join(" + ")}</div>
    </header>
  );
}

function LogoMark() {
  // Tries /logo.svg first, then /logo.png, then falls back to the Sprout icon.
  // Drop the real logo into /public/logo.svg (preferred) or /public/logo.png.
  const [idx, setIdx] = useState(0);
  const sources = ["/logo.svg", "/logo.png"];
  if (idx >= sources.length) {
    return <Sprout size={32} color={T.accent} strokeWidth={2} />;
  }
  return (
    <img
      src={sources[idx]}
      alt="North Foster Farm logo"
      onError={() => setIdx(i => i + 1)}
      style={{
        height: 48,
        width: "auto",
        display: "block",
        // Tint whatever logo you drop in to the accent green for brand cohesion.
        // Remove this filter if your logo is already multi-color and you want it as-is.
        filter: "brightness(0) saturate(100%) invert(82%) sepia(14%) saturate(523%) hue-rotate(48deg) brightness(98%) contrast(88%)"
      }}
    />
  );
}
