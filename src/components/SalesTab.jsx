import { useMemo, useState } from "react";
import { Banknote, Trash2 } from "lucide-react";
import {
  SALE_CHANNELS, currentPriceMap, fmtCents, parseDollarsToCents,
  saleGroupKey, saleGroupLabel, salesByMonth, skuKey, skuLabel,
} from "../lib/productCatalog.js";

// The Sales tab (Batch 27.3) — record-a-sale + sales over time.
//
//   Record a sale — date / product / size / quantity / total /
//   channel. The total pre-fills from the SKU's current price ×
//   quantity when one is set (editable — markets round, bundles
//   discount).
//   Sales over time — stacked monthly bars, split by product group
//   (the catalog's animal grouping), SVG in the house chart style
//   (ChoresPerformanceTab histogram).
//   Recent sales — newest first, deletable (typo recovery).
//
// product_sales is also the table POS (Batch 28) and Orders (Batch
// 29) will write into, so this chart's source never changes.

// Stacking palette: stable order, themed CSS vars.
const GROUP_COLORS = [
  "var(--c-accent)",
  "var(--c-cat-fm)",
  "var(--c-cat-egg)",
  "var(--c-cat-popup)",
  "var(--c-cat-deliveries)",
  "var(--c-text-muted)",
];

export default function SalesTab({ db, products, species }) {
  return (
    <div className="flex flex-col gap-5">
      <RecordSaleForm db={db} products={products} />
      <SalesChart db={db} species={species} />
      <RecentSales db={db} />
    </div>
  );
}

// ── record a sale ──────────────────────────────────────────────────────

const inputCls =
  "bg-bg border border-line text-fg text-[13px] px-2.5 py-2 outline-none " +
  "focus:border-accent font-[inherit] w-full";
const labelCls = "text-[9px] text-faint uppercase tracking-[0.12em] mb-1";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
    String(d.getDate()).padStart(2, "0");
}

function RecordSaleForm({ db, products }) {
  const [soldOn, setSoldOn] = useState(todayISO());
  const [productId, setProductId] = useState("");
  const [bracketId, setBracketId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [total, setTotal] = useState("");
  const [totalTouched, setTotalTouched] = useState(false);
  const [channel, setChannel] = useState("farmers_market");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const priceMap = useMemo(
    () => currentPriceMap(db.prices), [db.prices]);

  const product = products.find(p => p.id === productId) ?? null;
  const brackets = product && !product.isBundle
    ? (product.sizeBrackets ?? []) : [];

  // Pre-fill total = current price × quantity unless the user has
  // typed their own number.
  const suggestedCents = useMemo(() => {
    if (!product) return null;
    const price = priceMap.get(
      skuKey(product.id, bracketId || null))?.priceCents
      ?? priceMap.get(skuKey(product.id, null))?.priceCents;
    const qty = Number(quantity);
    if (price == null || isNaN(qty) || qty <= 0) return null;
    return Math.round(price * qty);
  }, [product, bracketId, quantity, priceMap]);

  const effectiveTotal = totalTouched
    ? total
    : suggestedCents != null ? (suggestedCents / 100).toFixed(2) : total;

  const submit = async () => {
    const totalCents = parseDollarsToCents(effectiveTotal);
    setPending(true);
    setErrorMsg(null);
    try {
      await db.recordSale({
        soldOn,
        productKindId: productId,
        bracketId: bracketId || null,
        quantity: Number(quantity) || 1,
        totalCents,
        channel,
        notes,
      });
      // Keep date + channel (markets log many sales in a row); clear
      // the rest.
      setProductId("");
      setBracketId("");
      setQuantity("1");
      setTotal("");
      setTotalTouched(false);
      setNotes("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
    }
    setPending(false);
  };

  const canSubmit = productId
    && parseDollarsToCents(effectiveTotal) != null
    && !pending;

  return (
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
        Record a sale
      </div>
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <div className={labelCls}>Date</div>
          <input type="date" value={soldOn} className={inputCls}
            onChange={(e) => setSoldOn(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <div className={labelCls}>Product</div>
          <select
            value={productId}
            onChange={(e) => {
              const next = products.find(p => p.id === e.target.value);
              const nextBrackets = next && !next.isBundle
                ? (next.sizeBrackets ?? []) : [];
              setProductId(e.target.value);
              // Single-bracket products (eggs · 1 dozen) auto-select
              // their bracket so the price suggestion kicks in.
              setBracketId(nextBrackets.length === 1
                ? nextBrackets[0].id : "");
              setTotalTouched(false);
            }}
            className={inputCls}
          >
            <option value="">— pick a product —</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.soldOut ? " (sold out)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Size</div>
          <select
            value={bracketId}
            onChange={(e) => {
              setBracketId(e.target.value);
              setTotalTouched(false);
            }}
            disabled={brackets.length === 0}
            className={inputCls + " disabled:opacity-40"}
          >
            <option value="">
              {brackets.length === 0 ? "—" : "— any —"}
            </option>
            {brackets.map(b => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Quantity</div>
          <input
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setTotalTouched(false);
            }}
            type="number" min="0" step="any"
            className={inputCls}
          />
        </div>
        <div>
          <div className={labelCls}>Total $</div>
          <input
            value={effectiveTotal}
            onChange={(e) => {
              setTotal(e.target.value);
              setTotalTouched(true);
            }}
            placeholder="0.00"
            inputMode="decimal"
            className={inputCls}
          />
          {!totalTouched && suggestedCents != null && (
            <div className="text-[10px] text-faint mt-1">
              from current price
            </div>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-[200px_1fr] gap-3">
        <div>
          <div className={labelCls}>Channel</div>
          <select value={channel} className={inputCls}
            onChange={(e) => setChannel(e.target.value)}>
            {SALE_CHANNELS.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Notes</div>
          <input value={notes} className={inputCls}
            placeholder="optional"
            onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}
      <div className="flex items-center justify-end gap-3">
        {savedFlash && (
          <span className="text-[11px] text-resolved">Sale recorded.</span>
        )}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-4 py-2 cursor-pointer disabled:opacity-50"
        >
          <Banknote size={13} />
          {pending ? "Saving…" : "Record sale"}
        </button>
      </div>
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

function RecentSales({ db }) {
  const [showAll, setShowAll] = useState(false);
  const sales = showAll ? db.sales : db.sales.slice(0, 12);

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
                  if (!window.confirm("Delete this sale record?")) return;
                  db.removeSale(sale.id).catch(() => {});
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
