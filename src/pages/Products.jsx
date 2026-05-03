import { T } from "../theme.js";
import { Subsection } from "../components/primitives.jsx";
import {
  computeBroilerCostPerBird,
  computeBroilerCutCostPerLb,
  computeWholeBirdSkuCost,
  computeCutSkuCost,
  bracketMidpointLb,
  fmtUSD
} from "../lib/productCost.js";

export default function Products({ data }) {
  const perBird = computeBroilerCostPerBird(data);
  const cutCtx = computeBroilerCutCostPerLb(data);

  return (
    <div>
      <CostFloorBanner perBird={perBird} cutCtx={cutCtx} data={data} />
      {data.productKinds.map(kind => (
        <ProductKindPanel
          key={kind.id}
          kind={kind}
          perBird={perBird}
          cutCtx={cutCtx}
          data={data}
        />
      ))}
      <Subsection title="Notes & open threads">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: T.textDim, lineHeight: 1.8 }}>
          <li>Pricing recommendations require: chick cost (<em>thread_chick_cost</em>), packaging (<em>thread_packaging_cost</em>), full broiler feed schedule (<em>thread_feed_schedule</em>), and a target margin (<em>thread_pricing_targets</em>).</li>
          <li>Yield breakdown is industry default — see <em>thread_processing_yields</em>.</li>
          <li>Whole-vs-cut ratio is unset — see <em>thread_whole_vs_cut_ratio</em>.</li>
          <li>SKU brackets editable in <code>nff-data.json</code> at <code>productKinds[*].sizeBrackets</code>.</li>
        </ul>
      </Subsection>
    </div>
  );
}

function CostFloorBanner({ perBird, cutCtx, data }) {
  const c = data.costs.broilers;
  const rows = [
    ["Chick purchase", perBird.components.chick],
    ["Feed (per-bird share, known stages)", perBird.components.feed],
    ["Processing — slaughter", perBird.components.slaughter],
    ["Packaging (whole bird bag)", perBird.components.packagingWhole],
    ["Processing — cut extra", c.processingCutAdditionalPerBird],
    ["Packaging (per cut package)", c.packagingPerCutPackage]
  ];
  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "20px 24px", marginBottom: 24 }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Cost floor — broilers</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6, columnGap: 16, fontSize: 12, marginBottom: 12 }}>
        {rows.map(([label, val]) => {
          const known = val != null;
          return (
            <div key={label} style={{ display: "contents" }}>
              <div style={{ color: known ? T.text : T.textFaint, fontStyle: known ? "normal" : "italic" }}>{label}</div>
              <div style={{ color: known ? T.accent : T.textFaint, fontFamily: T.serif, textAlign: "right" }}>{known ? fmtUSD(val) : "TBD"}</div>
            </div>
          );
        })}
      </div>
      <div style={{ paddingTop: 12, borderTop: `1px solid ${T.surfaceAlt}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 11, color: T.textDim }}>
          Known cost-per-bird floor (whole, excluding cut extras): batch of {perBird.batchSize}
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 22, color: T.accent }}>{fmtUSD(perBird.knownTotal)}</div>
      </div>
      {cutCtx && (
        <div style={{ paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 11, color: T.textDim }}>
            Allocated cost per sellable lb of cuts (excludes frame {Math.round((c.yieldDressedBreakdown.frame_remainder ?? 0) * 100)}%)
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 18, color: T.accent }}>{fmtUSD(cutCtx.costPerSellableLb)} / lb</div>
        </div>
      )}
      {perBird.missing.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: T.warn, lineHeight: 1.6 }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 9, marginRight: 8 }}>Missing</span>
          {perBird.missing.join(", ")} — figure shown is a partial floor.
        </div>
      )}
    </section>
  );
}

function ProductKindPanel({ kind, perBird, cutCtx, data }) {
  const isEgg = kind.category === "egg";
  const isWhole = kind.category === "broiler_whole";
  const isCut = kind.category === "broiler_cut";

  return (
    <section style={{ background: T.surface, border: `1px solid ${T.border}`, marginBottom: 16 }}>
      <header style={{ padding: "16px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, margin: 0 }}>{kind.name}</h3>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {kind.category.replace("_", " ")} · sold by {kind.saleUnit}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted }}>
          {kind.sizeBrackets.length} SKU{kind.sizeBrackets.length === 1 ? "" : "s"}
        </div>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, background: T.border }}>
        {kind.sizeBrackets.map(bracket => (
          <SkuRow
            key={bracket.id}
            kind={kind}
            bracket={bracket}
            cost={
              isEgg ? null
              : isWhole ? computeWholeBirdSkuCost(bracket, perBird)
              : isCut ? computeCutSkuCost(kind, bracket, cutCtx)
              : null
            }
            isEgg={isEgg}
          />
        ))}
      </div>
    </section>
  );
}

function SkuRow({ kind, bracket, cost, isEgg }) {
  const mid = bracketMidpointLb(bracket);
  return (
    <div style={{ background: T.surface, padding: "12px 22px", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "baseline" }}>
      <div>
        <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600 }}>{bracket.label}</div>
        {mid != null && <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>midpoint {mid.toFixed(2)} lb</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>Cost floor</div>
        <div style={{ fontSize: 13, color: cost?.costFloor != null ? T.accent : T.textFaint, fontFamily: T.serif }}>
          {isEgg ? "TBD" : (cost ? fmtUSD(cost.costFloor) : "—")}
        </div>
        {cost?.costPerLbAtMidpoint != null && (
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{fmtUSD(cost.costPerLbAtMidpoint)} / lb</div>
        )}
      </div>
      <div style={{ textAlign: "right", minWidth: 110 }}>
        <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 2 }}>Recommended</div>
        <div style={{ fontSize: 12, color: T.warn, fontStyle: "italic" }}>set margin first</div>
      </div>
    </div>
  );
}
