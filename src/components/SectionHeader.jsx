import { T } from "../theme.js";

// Section subheadings were dropped globally; the header is now just a title.
// `noBottomBorder` is preserved for pages (e.g. species pages) that render
// their own subnav directly underneath and don't want a divider in between.
// Page-specific headers (e.g. Chores with its tabs + actions) opt out of this
// component entirely by rendering their own title row.
export default function SectionHeader({ section, noBottomBorder }) {
  return (
    <div style={{
      marginBottom: noBottomBorder ? 20 : 28,
      paddingBottom: noBottomBorder ? 0 : 14,
      borderBottom: noBottomBorder ? "none" : `1px solid ${T.border}`
    }}>
      <h2 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: T.text }}>{section.label}</h2>
    </div>
  );
}
