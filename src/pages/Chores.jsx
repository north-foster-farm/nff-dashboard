import { T } from "../theme.js";
import { Subsection } from "../components/primitives.jsx";

export default function Chores({ data }) {
  return (
    <div>
      <Subsection title={`Definitions · ${data.chores.definitions.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border, marginBottom: 28 }}>
          {data.chores.definitions.map(c => <ChoreRow key={c.id} chore={c} />)}
        </div>
      </Subsection>
      <Subsection title="Activity log">
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>No completions logged yet.</div>
          <div style={{ fontSize: 11, color: T.textFaint }}>Inspectable history of who completed which chore at what time will appear here.</div>
        </div>
      </Subsection>
      <Subsection title="Model notes">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.textDim, lineHeight: 1.8 }}>
          {data.chores.modelNotes.map((note, idx) => <li key={idx}>{note}</li>)}
        </ul>
      </Subsection>
    </div>
  );
}

export function ChoreRow({ chore }) {
  return (
    <div style={{ background: T.surface, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>{chore.title}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chore.tags.map(tag => (
            <span key={tag} style={{ fontSize: 9, color: T.textDim, background: T.surfaceAlt, border: `1px solid ${T.border}`, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{tag}</span>
          ))}
        </div>
      </div>
      {chore.description && <p style={{ fontSize: 12, color: T.textDim, lineHeight: 1.6, margin: 0, marginBottom: 10 }}>{chore.description}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, fontSize: 11 }}>
        <ChoreField label="When" value={chore.when} />
        <ChoreField label="How" value={chore.how} />
        <ChoreField label="Who" value={chore.who} />
      </div>
    </div>
  );
}

function ChoreField({ label, value }) {
  const isTBD = value === "TBD";
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: isTBD ? T.warn : T.text, fontStyle: isTBD ? "italic" : "normal" }}>{value}</div>
    </div>
  );
}
