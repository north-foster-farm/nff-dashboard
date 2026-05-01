import { T } from "../theme.js";

export default function EmptyState({ label }) {
  return (
    <div style={{ padding: "64px 0", textAlign: "center" }}>
      <div style={{ display: "inline-block", padding: "32px 48px", border: `1px dashed ${T.border}` }}>
        <p style={{ fontSize: 13, color: T.textDim, margin: 0, marginBottom: 6 }}>No {label.toLowerCase()} captured yet.</p>
        <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>Drop bullets in chat to populate this section.</p>
      </div>
    </div>
  );
}
