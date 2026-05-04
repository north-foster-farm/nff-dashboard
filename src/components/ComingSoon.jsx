import { Sparkles } from "lucide-react";
import { T } from "../theme.js";

export default function ComingSoon({ featureName }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 360, padding: 32
    }}>
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        padding: "40px 48px",
        textAlign: "center",
        maxWidth: 480
      }}>
        <Sparkles
          size={28}
          color={T.accent}
          style={{ marginBottom: 14 }}
        />
        <div style={{
          fontFamily: T.heading,
          fontSize: 22, fontWeight: 700,
          letterSpacing: "-0.01em",
          color: T.text,
          marginBottom: 8
        }}>
          {featureName ? `${featureName} — coming soon` : "Coming soon"}
        </div>
        <div style={{
          fontSize: 12, color: T.textDim, lineHeight: 1.6
        }}>
          This page is on the roadmap. Check back after the next batch
          lands.
        </div>
      </div>
    </div>
  );
}
