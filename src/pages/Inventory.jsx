import { T } from "../theme.js";
import { Subsection } from "../components/primitives.jsx";
import { formatDate } from "../lib/dates.js";

export default function Inventory({ data }) {
  const eggLots = [...data.inventory.eggLots].sort(byDateAsc("collectionDate"));
  const chickenLots = [...data.inventory.chickenLots].sort(byDateAsc("processingDate"));
  const eggCartonTotal = eggLots.reduce((a, l) => a + (l.cartonCount ?? 0), 0);
  const chickenUnitTotal = chickenLots.reduce((a, l) => a + (l.quantity ?? 0), 0);

  return (
    <div>
      <SummaryStrip eggCartonTotal={eggCartonTotal} chickenUnitTotal={chickenUnitTotal} />
      <Subsection title={`Egg cartons · ${eggLots.length} lot${eggLots.length === 1 ? "" : "s"} · ${eggCartonTotal} dozen`}>
        {eggLots.length === 0 ? (
          <EmptyLotState
            line1="No egg lots recorded."
            line2="Egg inventory is currently created by counting cartons just before going to a market — a paper count by Jim, sometimes. The count goes here when entered."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
            {eggLots.map(l => <EggLotRow key={l.id} lot={l} />)}
          </div>
        )}
      </Subsection>
      <Subsection title={`Chicken lots · ${chickenLots.length} lot${chickenLots.length === 1 ? "" : "s"} · ${chickenUnitTotal} unit${chickenUnitTotal === 1 ? "" : "s"}`}>
        {chickenLots.length === 0 ? (
          <EmptyLotState
            line1="No chicken lots recorded."
            line2="Chicken inventory is created on broiler-processing day as a final step — sort by size and cut, then create one lot per (size bracket, processing date)."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
            {chickenLots.map(l => <ChickenLotRow key={l.id} lot={l} data={data} />)}
          </div>
        )}
      </Subsection>
      <Subsection title="Model notes">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.textDim, lineHeight: 1.8 }}>
          {data.inventory.modelNotes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </Subsection>
    </div>
  );
}

function SummaryStrip({ eggCartonTotal, chickenUnitTotal }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
      <SummaryTile label="Eggs in fridge" primary={eggCartonTotal} unit="dozen" />
      <SummaryTile label="Chicken in freezers" primary={chickenUnitTotal} unit="units" />
    </div>
  );
}

function SummaryTile({ label, primary, unit }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 600, color: primary > 0 ? T.text : T.textMuted }}>{primary}</span>
        <span style={{ fontSize: 11, color: T.textDim }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em" }}>{label}</div>
    </div>
  );
}

function EmptyLotState({ line1, line2 }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "28px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>{line1}</div>
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>{line2}</div>
    </div>
  );
}

function EggLotRow({ lot }) {
  return (
    <div style={{ background: T.surface, padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "baseline" }}>
      <div>
        <div style={{ fontSize: 13, color: T.text }}>Collected {formatDate(lot.collectionDate) || "Unknown"}</div>
        {lot.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{lot.notes}</div>}
      </div>
      <div style={{ fontSize: 11, color: T.textDim }}>{lot.status || "available"}</div>
      <div style={{ fontFamily: T.serif, fontSize: 16, color: T.accent, minWidth: 90, textAlign: "right" }}>
        {lot.cartonCount ?? "—"} <span style={{ fontSize: 11, color: T.textDim }}>doz</span>
      </div>
    </div>
  );
}

function ChickenLotRow({ lot, data }) {
  const kind = data.productKinds.find(k => k.id === lot.productKindId);
  const bracket = kind?.sizeBrackets.find(b => b.id === lot.sizeBracketId);
  return (
    <div style={{ background: T.surface, padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "baseline" }}>
      <div>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600 }}>{kind?.name || lot.productKindId} <span style={{ color: T.textDim, fontSize: 12, fontWeight: 400 }}>· {bracket?.label || lot.sizeBracketId}</span></div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
          Processed {formatDate(lot.processingDate) || "Unknown"}
          {lot.location && <> · {lot.location}</>}
        </div>
        {lot.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{lot.notes}</div>}
      </div>
      <div style={{ fontSize: 11, color: T.textDim }}>{lot.status || "available"}</div>
      <div style={{ fontFamily: T.serif, fontSize: 16, color: T.accent, minWidth: 90, textAlign: "right" }}>
        {lot.quantity ?? "—"} <span style={{ fontSize: 11, color: T.textDim }}>{kind?.saleUnit || "unit"}</span>
      </div>
    </div>
  );
}

function byDateAsc(field) {
  return (a, b) => (a[field] || "").localeCompare(b[field] || "");
}
