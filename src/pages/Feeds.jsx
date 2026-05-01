import { T } from "../theme.js";

export default function Feeds({ data }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Master list of feed types. Each feed references a supplier and carries a unit cost, package size, reorder rule, and lead time. Costs and lead times here are illustrative — see <em>thread_feed_specifics</em>.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {data.feeds.map(f => <FeedRow key={f.id} feed={f} suppliers={data.suppliers} />)}
      </div>
    </div>
  );
}

function FeedRow({ feed, suppliers }) {
  const supplier = suppliers.find(s => s.id === feed.supplierId);
  const cost = `$${feed.costPerUnit.amount.toFixed(2)} / ${feed.costPerUnit.unit}`;
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 500 }}>{feed.name}</div>
          {feed.description && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{feed.description}</div>}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 18, color: T.accent }}>{cost}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <FeedDetail label="Supplier" value={supplier?.label || feed.supplierId} />
        <FeedDetail label="Package" value={feed.packageSize.label} />
        <FeedDetail label="Reorder at" value={`${feed.reorderPoint.amount} ${feed.reorderPoint.unit}`} />
        <FeedDetail label="Reorder qty" value={`${feed.reorderQuantity.amount} ${feed.reorderQuantity.unit}`} />
        <FeedDetail label="Lead time" value={`${feed.leadTimeDays} days`} />
      </div>
      {feed.notes && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.surfaceAlt}`, fontStyle: "italic", lineHeight: 1.5 }}>{feed.notes}</div>}
    </div>
  );
}

function FeedDetail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12, color: T.text }}>{value}</div>
    </div>
  );
}
