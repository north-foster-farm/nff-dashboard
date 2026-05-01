import { T } from "../theme.js";
import { resolveSectionDescription } from "../sections.jsx";

export default function SectionHeader({ section, data, noBottomBorder }) {
  const description = resolveSectionDescription(section, data);
  return (
    <div style={{
      marginBottom: noBottomBorder ? 20 : 28,
      paddingBottom: noBottomBorder ? 0 : 14,
      borderBottom: noBottomBorder ? "none" : `1px solid ${T.border}`
    }}>
      <h2 style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 500, letterSpacing: "-0.02em", margin: 0, marginBottom: 4 }}>{section.label}</h2>
      {description && <p style={{ fontSize: 12, color: T.textDim, margin: 0 }}>{description}</p>}
    </div>
  );
}
