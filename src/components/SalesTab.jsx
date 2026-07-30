import { useMemo, useState } from "react";
import { ArrowUpRight, Banknote, Trash2 } from "lucide-react";
import {
  SALE_CHANNELS, fmtCents,
  saleGroupLabel, salesByMonth, skuLabel,
} from "../lib/productCatalog.js";

// The Sales tab (Batch 27.3) — sales over time + recent sales.
//
//   Sales over time — stacked monthly bars, split by product group
//   (the catalog's animal grouping), SVG in the house chart style
//   (ChoresPerformanceTab histogram).
//   Recent sales — newest first, deletable (typo recovery). Deleting
//   a sale restores whatever inventory it drew down (Batch 28.2).
//
// The Batch-27.3 manual record-a-sale form retired in Batch 28.2 —
// recording happens on the Sell tab (the POS register), which is
// inventory-aware. This tab is the analytics side; both read
// product_sales, which Orders (Batch 29) will write into too.

// Stacking palette: stable order, themed CSS vars.
const GROUP_COLORS = [
  "var(--c-accent)",
  "var(--c-cat-fm)",
  "var(--c-cat-egg)",
  "var(--c-cat-popup)",
  "var(--c-cat-deliveries)",
  "var(--c-text-muted)",
];

export default function SalesTab({ db, inv, species, onGoSell }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Recording moved to the Sell tab (Batch 28.2) — keep a
          pointer where the form used to be. */}
      <button
        onClick={onGoSell}
        className="self-start inline-flex items-center gap-2 bg-surface border border-line text-fg font-[inherit] text-[12px] font-semibold px-3.5 py-2.5 cursor-pointer hover:border-accent"
      >
        <Banknote size={14} className="text-accent-deep shrink-0" />
        Record sales on the Sell tab
        <ArrowUpRight size={13} className="shrink-0 text-dim" />
      </button>
      <SalesChart db={db} species={species} />
      <RecentSales db={db} inv={inv} />
    </div>
  );
}

// ── sales over time ────────────────────────────────────────────────────

function SalesChart({ db, species }) {
  const months = useMemo(
    () => salesByMonth(db.sales, db.productsById),
    [db.sales, db.productsById]);

  // Stable group order across all months → stable stack order + legend.
  const groupKeys = useMemo(() => {
    const keys = new Set();
    for (const m of months) for (const k of m.byGroup.keys()) keys.add(k);
    return [...keys].sort();
  }, [months]);

  if (months.length === 0) {
    return (
      <div className="bg-surface border border-line px-6 py-10 text-center">
        <div className="text-[13px] text-muted">
          No sales recorded yet — the chart appears with the first one.
        </div>
      </div>
    );
  }

  const colorFor = (key) =>
    GROUP_COLORS[groupKeys.indexOf(key) % GROUP_COLORS.length];

  const W = 600;
  const H = 160;
  const padTop = 14;
  const padBot = 20;
  const padX = 4;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBot;
  const maxCents = Math.max(...months.map(m => m.totalCents), 1);
  const slotW = innerW / months.length;
  const barW = Math.min(slotW * 0.6, 48);

  const totalAll = months.reduce((sum, m) => sum + m.totalCents, 0);

  return (
    <div className="bg-surface border border-line p-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
          Sales over time
        </div>
        <div className="text-[11px] text-dim">
          {fmtCents(totalAll)} across {db.sales.length} sale
          {db.sales.length === 1 ? "" : "s"}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block"
        style={{ height: H }}
        role="img"
        aria-label="Monthly sales, stacked by product group"
      >
        {months.map((m, i) => {
          const x = padX + i * slotW + (slotW - barW) / 2;
          let yCursor = padTop + innerH;
          return (
            <g key={m.month}>
              {groupKeys.map(key => {
                const cents = m.byGroup.get(key) ?? 0;
                if (cents === 0) return null;
                const h = (cents / maxCents) * innerH;
                yCursor -= h;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={yCursor}
                    width={barW}
                    height={h}
                    fill={colorFor(key)}
                    opacity={0.9}
                  >
                    <title>
                      {`${m.label}: ${saleGroupLabel(key, species)} ` +
                        fmtCents(cents)}
                    </title>
                  </rect>
                );
              })}
              {m.totalCents > 0 && (
                <text
                  x={x + barW / 2}
                  y={yCursor - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--c-text-dim)"
                  style={{ fontFamily: "inherit" }}
                >
                  {fmtCents(m.totalCents)}
                </text>
              )}
              <text
                x={padX + i * slotW + slotW / 2}
                y={padTop + innerH + 14}
                textAnchor="middle"
                fontSize={9}
                fill="var(--c-text-faint)"
                style={{ fontFamily: "inherit", letterSpacing: "0.06em" }}
              >
                {m.label}
              </text>
            </g>
          );
        })}
        {/* Baseline */}
        <line
          x1={padX}
          x2={padX + innerW}
          y1={padTop + innerH}
          y2={padTop + innerH}
          stroke="var(--c-border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {groupKeys.map(key => (
          <span key={key}
            className="inline-flex items-center gap-1.5 text-[10px] text-dim">
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ background: colorFor(key) }}
            />
            {saleGroupLabel(key, species)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── recent sales ───────────────────────────────────────────────────────

function RecentSales({ db, inv }) {
  const [showAll, setShowAll] = useState(false);
  const sales = showAll ? db.sales : db.sales.slice(0, 12);

  // Deleting a sale puts back whatever inventory it drew down, THEN
  // removes the sale row. Reversal must come first — the movements'
  // sale_id is how they're found, and deleting the sale nulls it.
  // reverseSale is retry-safe, so a failure between the two steps is
  // fixed by clicking delete again.
  const remove = async (saleId) => {
    await inv.reverseSale(saleId);
    await db.removeSale(saleId);
  };

  if (db.sales.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
        Recent sales
      </div>
      <div className="flex flex-col gap-px bg-line border border-line">
        {sales.map(sale => {
          const product = db.productsById.get(sale.productKindId);
          const bracket = product?.sizeBrackets
            ?.find(b => b.id === sale.bracketId) ?? null;
          const channel = SALE_CHANNELS
            .find(c => c.id === sale.channel)?.label ?? sale.channel;
          return (
            <div key={sale.id}
              className="bg-surface px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-[13px] text-fg">
                  {product ? skuLabel(product, bracket) : sale.productKindId}
                </span>
                <span className="text-[11px] text-dim ml-2">
                  × {sale.quantity}
                </span>
              </div>
              <div className="text-[11px] text-dim shrink-0 hidden sm:block">
                {channel}
              </div>
              <div className="text-[11px] text-dim shrink-0">
                {sale.soldOn}
              </div>
              <div className="font-heading text-[14px] text-accent shrink-0 min-w-[70px] text-right">
                {fmtCents(sale.totalCents)}
              </div>
              <button
                onClick={() => {
                  if (!window.confirm(
                    "Delete this sale record? Any inventory it sold "
                    + "goes back into its lots.")) return;
                  remove(sale.id).catch(() => {});
                }}
                title="Delete sale"
                className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {db.sales.length > 12 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-2 bg-transparent border-0 p-0 text-[11px] text-dim hover:text-fg cursor-pointer font-[inherit]"
        >
          {showAll ? "Show fewer" : `Show all ${db.sales.length}`}
        </button>
      )}
    </div>
  );
}
