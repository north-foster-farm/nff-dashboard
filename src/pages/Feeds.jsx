import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { T } from "../theme.js";
import { supabase } from "../lib/supabase.js";

export default function Feeds({ data }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Master list of feed types. Each feed references a supplier and carries a unit cost, package size, reorder rule, and lead time. Setting a feed's on-hand amount at or below its reorder point fires the feed-reorder automation (a feed-order chore + a delivery event).
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
  const belowReorder = feed.onHand != null && feed.reorderPoint != null
    && Number(feed.onHand.amount) <= Number(feed.reorderPoint.amount);
  return (
    <div style={{ background: T.surface, padding: "18px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {feed.name}
            {belowReorder && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: T.uiLabel, fontWeight: 600, color: T.warn, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                <AlertTriangle size={12} /> Reorder
              </span>
            )}
          </div>
          {feed.description && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{feed.description}</div>}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 18, color: T.accent }}>{cost}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}` }}>
        <FeedDetail label="Supplier" value={supplier?.label || feed.supplierId} />
        <FeedDetail label="Package" value={feed.packageSize.label} />
        <OnHandEditor feed={feed} />
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

// Editable on-hand amount. Commits on blur / Enter; writes the same
// {amount, unit} jsonb shape as reorder_point. Crossing the reorder
// threshold fires the feed-reorder automation server-side.
function OnHandEditor({ feed }) {
  const unit = feed.onHand?.unit || feed.reorderPoint?.unit || feed.unit || "";
  const [draft, setDraft] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const current = feed.onHand?.amount;

  const commit = async () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (!Number.isFinite(n) || n < 0 || n === current) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("feed_types")
      .update({
        on_hand: { amount: n, unit },
        on_hand_updated_at: new Date().toISOString(),
      })
      .eq("id", feed.id);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>
        On hand
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          min={0}
          value={draft ?? (current ?? "")}
          placeholder="—"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          disabled={saving}
          style={{
            width: 64, fontSize: 12, color: T.text, background: T.surfaceAlt,
            border: `1px solid ${T.border}`, padding: "3px 6px",
            fontFamily: "inherit", outline: "none",
          }}
        />
        <span style={{ fontSize: 11, color: T.textDim }}>{unit}</span>
        {saved && <Check size={12} style={{ color: T.accent }} />}
      </div>
      {error && (
        <div style={{ fontSize: 10, color: T.warn, marginTop: 3 }}>
          {error.message ?? "Save failed"}
        </div>
      )}
    </div>
  );
}
