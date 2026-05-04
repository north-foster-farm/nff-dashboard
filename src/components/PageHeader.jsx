import { ArrowLeft } from "lucide-react";
import { T } from "../theme.js";

// Header for non-top-level pages: shows a small back-link to the parent
// section above a large title, with optional subtitle. Top-level pages keep
// using SectionHeader (no back-link).
export default function PageHeader({
  title,
  subtitle,
  parentLabel,
  onBack,
  noBottomBorder
}) {
  return (
    <div style={{
      marginBottom: noBottomBorder ? 20 : 28,
      paddingBottom: noBottomBorder ? 0 : 14,
      borderBottom: noBottomBorder ? "none" : `1px solid ${T.border}`
    }}>
      {parentLabel && (
        <button
          onClick={onBack}
          disabled={!onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: T.textDim,
            fontFamily: T.uiLabel, fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.14em",
            padding: 0, marginBottom: 8,
            cursor: onBack ? "pointer" : "default"
          }}
        >
          <ArrowLeft size={12} />
          {parentLabel}
        </button>
      )}
      <h2 style={{
        fontFamily: T.heading, fontSize: 32, fontWeight: 700,
        letterSpacing: "-0.02em",
        margin: 0, color: T.text
      }}>
        {title}
      </h2>
      {subtitle && (
        <div style={{
          fontSize: 13, color: T.textDim, marginTop: 6, lineHeight: 1.5
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
