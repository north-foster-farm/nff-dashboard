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
      <h2 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, marginBottom: 6, color: T.text }}>{section.label}</h2>
      {description && <p style={{ fontSize: 13, color: T.textDim, margin: 0, lineHeight: 1.55 }}>{description}</p>}
    </div>
  );
}
