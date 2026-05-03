import { T } from "../theme.js";

export default function Trailers({ data }) {
  const trailers = data.trailers ?? [];
  if (trailers.length === 0) {
    return <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", padding: "32px 0", textAlign: "center" }}>No trailers captured yet.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
      {trailers.map(t => <TrailerRow key={t.id} trailer={t} />)}
    </div>
  );
}

function TrailerRow({ trailer }) {
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600 }}>{trailer.label}</div>
        {trailer.category && <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{trailer.category}</div>}
      </div>
      {(trailer.uses?.length ?? 0) > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: T.text, lineHeight: 1.7 }}>
          {trailer.uses.map((u, idx) => <li key={idx}>{u}</li>)}
        </ul>
      )}
      {trailer.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{trailer.notes}</div>}
    </div>
  );
}
