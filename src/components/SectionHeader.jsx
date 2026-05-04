import { ArrowLeft } from "lucide-react";
import { T } from "../theme.js";

// Section subheadings were dropped globally; the header is now just a title.
// `noBottomBorder` is preserved for pages (e.g. species pages) that render
// their own subnav directly underneath and don't want a divider in between.
// Page-specific headers (e.g. Chores with its tabs + actions) opt out of this
// component entirely by rendering their own title row.
//
// `parent` (optional) — if supplied, renders a small back-link above the
// title pointing to the parent section. Used for flyout children to make the
// hierarchy visible.
export default function SectionHeader({ section, parent, onNavigate, noBottomBorder }) {
  return (
    <div style={{
      marginBottom: noBottomBorder ? 20 : 28,
      paddingBottom: noBottomBorder ? 0 : 14,
      borderBottom: noBottomBorder ? "none" : `1px solid ${T.border}`
    }}>
      {parent && (
        <button
          onClick={() => onNavigate?.(parent.id)}
          disabled={!onNavigate}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none",
            color: T.textDim,
            fontFamily: T.uiLabel, fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.14em",
            padding: 0, marginBottom: 8,
            cursor: onNavigate ? "pointer" : "default"
          }}
        >
          <ArrowLeft size={12} />
          {parent.flyoutTitle || parent.label}
        </button>
      )}
      <h2 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: T.text }}>{section.label}</h2>
      {section.description && parent && (
        <div style={{ fontSize: 13, color: T.textDim, marginTop: 6, lineHeight: 1.5 }}>
          {section.description}
        </div>
      )}
    </div>
  );
}
