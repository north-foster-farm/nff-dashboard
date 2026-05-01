import { T } from "../theme.js";
import { Subsection } from "../components/primitives.jsx";

export default function Threads({ data }) {
  const open = data.threads.filter(t => t.status === "open");
  const resolved = data.threads.filter(t => t.status === "resolved");
  return (
    <div>
      <Subsection title={`Open · ${open.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, marginBottom: 28 }}>
          {open.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
      <Subsection title={`Resolved · ${resolved.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
          {resolved.map(t => <ThreadRow key={t.id} thread={t} />)}
        </div>
      </Subsection>
    </div>
  );
}

function ThreadRow({ thread }) {
  const isResolved = thread.status === "resolved";
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 500, color: T.text }}>{thread.title}</div>
        <span style={{ fontSize: 10, color: isResolved ? T.resolved : T.warn, textTransform: "uppercase", letterSpacing: "0.12em", flexShrink: 0 }}>{thread.status}</span>
      </div>
      <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7, margin: 0, marginBottom: isResolved || thread.notes ? 10 : 0 }}>{thread.question}</p>
      {thread.notes && <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.7, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic" }}>{thread.notes}</div>}
      {isResolved && thread.resolution && (
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}` }}>
          <span style={{ fontSize: 10, color: T.resolved, textTransform: "uppercase", letterSpacing: "0.12em", marginRight: 8 }}>→</span>{thread.resolution}
        </div>
      )}
    </div>
  );
}
