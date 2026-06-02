import { useMemo, useState } from "react";
import { History, TriangleAlert, X } from "lucide-react";
import {
  currentPriceMap, fmtCents, marginInfo, parseDollarsToCents,
  priceHistoryFor, skuCostFloor, skuKey, bundleCostFloor,
} from "../lib/productCatalog.js";
import { fmtUSD } from "../lib/productCost.js";

// The pricing grid (Batch 27.2) — the bulk price-setting surface.
//
// The Shopify-bulk-editor pattern from the pricing workshop: one row
// per SKU (product × size bracket), every row showing cost floor,
// current price, an editable new price + compare-at, and a LIVE margin
// % + profit readout that recomputes as you type. Prices below their
// cost floor render in the warn color. "Save all" writes every dirty
// row as one append-only product_prices insert (history preserved).
//
// The target-margin quick-fill is the Faire keystone idea adapted to
// our cost floors: type a margin %, and every SKU with a known floor
// gets a suggested price of floor / (1 − margin) filled into its
// input (only where the input is still untouched/empty).

export default function PricingGrid({ db, products, perBird, cutCtx }) {
  // drafts: Map<skuKey, { price: string, compareAt: string }>
  const [drafts, setDrafts] = useState(new Map());
  const [historyKey, setHistoryKey] = useState(null);
  const [targetMargin, setTargetMargin] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const priceMap = useMemo(
    () => currentPriceMap(db.prices), [db.prices]);

  // Rows grouped by product, each product expanded into its SKUs.
  const productRows = useMemo(() => {
    return products.map(p => {
      const brackets = p.isBundle || (p.sizeBrackets ?? []).length === 0
        ? [null]
        : p.sizeBrackets;
      const skus = brackets.map(bracket => {
        const floor = p.isBundle
          ? bundleCostFloor(p, db.productsById, perBird, cutCtx)
          : skuCostFloor(p, bracket, perBird, cutCtx);
        return {
          key: skuKey(p.id, bracket?.id),
          product: p,
          bracket,
          floor,
          current: priceMap.get(skuKey(p.id, bracket?.id)) ?? null,
        };
      });
      return { product: p, skus };
    });
  }, [products, db.productsById, priceMap, perBird, cutCtx]);

  const setDraft = (key, patch) => {
    setDrafts(prev => {
      const next = new Map(prev);
      const cur = next.get(key) ?? { price: "", compareAt: "" };
      next.set(key, { ...cur, ...patch });
      return next;
    });
  };

  const clearDraft = (key) => {
    setDrafts(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  // A row is dirty when its draft parses to a price different from
  // the current one (or sets a price where none exists).
  const dirtyEntries = useMemo(() => {
    const entries = [];
    for (const { skus } of productRows) {
      for (const sku of skus) {
        const draft = drafts.get(sku.key);
        if (!draft) continue;
        const priceCents = parseDollarsToCents(draft.price);
        const compareAtCents = parseDollarsToCents(draft.compareAt);
        if (priceCents == null) continue;
        const changed =
          priceCents !== (sku.current?.priceCents ?? null)
          || (compareAtCents ?? null)
            !== (sku.current?.compareAtCents ?? null);
        if (!changed) continue;
        entries.push({
          productKindId: sku.product.id,
          bracketId: sku.bracket?.id ?? null,
          priceCents,
          compareAtCents,
        });
      }
    }
    return entries;
  }, [productRows, drafts]);

  const saveAll = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await db.setPrices(dirtyEntries);
      setDrafts(new Map());
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
    }
    setPending(false);
  };

  // Quick-fill: price = floor / (1 − margin). Only fills rows whose
  // draft price is empty AND whose floor is known.
  const quickFill = () => {
    const pct = Number(targetMargin);
    if (isNaN(pct) || pct <= 0 || pct >= 100) return;
    setDrafts(prev => {
      const next = new Map(prev);
      for (const { skus } of productRows) {
        for (const sku of skus) {
          if (sku.floor == null) continue;
          const existing = next.get(sku.key);
          if (existing?.price) continue;
          const price = sku.floor / (1 - pct / 100);
          next.set(sku.key, {
            price: price.toFixed(2),
            compareAt: existing?.compareAt ?? "",
          });
        }
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-dim leading-relaxed m-0 max-w-[70ch]">
        Every SKU in one sheet. Type a price and the margin against the
        known cost floor updates as you type — anything priced below
        its floor goes red. Changes only land when you hit Save; every
        save is a new entry in the price history, never an overwrite.
      </p>

      {/* target-margin quick fill */}
      <div className="flex items-center gap-2 flex-wrap bg-surface border border-line px-4 py-3">
        <span className="text-[11px] text-dim uppercase tracking-[0.12em]">
          Quick fill
        </span>
        <span className="text-[12px] text-dim">
          price every un-priced SKU with a known floor at
        </span>
        <input
          value={targetMargin}
          onChange={(e) => setTargetMargin(e.target.value)}
          placeholder="50"
          type="number"
          min="1"
          max="99"
          className="w-16 bg-bg border border-line text-fg text-[13px] px-2 py-1 outline-none focus:border-accent font-[inherit] text-right"
        />
        <span className="text-[12px] text-dim">% margin</span>
        <button
          onClick={quickFill}
          disabled={!targetMargin}
          className="bg-transparent border border-line text-dim hover:text-fg font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-40"
        >
          Fill
        </button>
      </div>

      {/* the grid */}
      <div className="bg-surface border border-line overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-[9px] text-faint uppercase tracking-[0.12em] text-left">
              <th className="px-4 py-2 font-semibold">SKU</th>
              <th className="px-3 py-2 font-semibold text-right">
                Cost floor
              </th>
              <th className="px-3 py-2 font-semibold text-right">
                Current
              </th>
              <th className="px-3 py-2 font-semibold">New price</th>
              <th className="px-3 py-2 font-semibold">Compare-at</th>
              <th className="px-3 py-2 font-semibold text-right">Margin</th>
              <th className="px-3 py-2 font-semibold text-right">
                Profit / unit
              </th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {productRows.map(({ product, skus }) => (
              <ProductSection
                key={product.id}
                product={product}
                skus={skus}
                drafts={drafts}
                setDraft={setDraft}
                clearDraft={clearDraft}
                historyKey={historyKey}
                setHistoryKey={setHistoryKey}
                prices={db.prices}
              />
            ))}
          </tbody>
        </table>
      </div>

      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}

      {/* save bar */}
      <div className="flex items-center justify-end gap-3">
        {dirtyEntries.length > 0 && (
          <span className="text-[11px] text-dim italic">
            {dirtyEntries.length} price{dirtyEntries.length === 1 ? "" : "s"}
            {" "}to save
          </span>
        )}
        <button
          onClick={saveAll}
          disabled={pending || dirtyEntries.length === 0}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-4 py-2 cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save all"}
        </button>
      </div>
    </div>
  );
}

// ── one product's section of rows ──────────────────────────────────────

function ProductSection({
  product, skus, drafts, setDraft, clearDraft, historyKey, setHistoryKey,
  prices,
}) {
  return (
    <>
      <tr>
        <td colSpan={8}
          className="px-4 pt-4 pb-1 border-t border-line">
          <span className="font-heading text-[14px] font-semibold text-fg">
            {product.name}
          </span>
          {product.soldOut && (
            <span className="ml-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-warn">
              sold out
            </span>
          )}
        </td>
      </tr>
      {skus.map(sku => (
        <SkuRow
          key={sku.key}
          sku={sku}
          draft={drafts.get(sku.key)}
          setDraft={setDraft}
          clearDraft={clearDraft}
          historyOpen={historyKey === sku.key}
          onToggleHistory={() =>
            setHistoryKey(historyKey === sku.key ? null : sku.key)}
          prices={prices}
        />
      ))}
    </>
  );
}

// ── one SKU row ────────────────────────────────────────────────────────

function SkuRow({
  sku, draft, setDraft, clearDraft, historyOpen, onToggleHistory, prices,
}) {
  const draftCents = parseDollarsToCents(draft?.price);
  // The margin readout follows what's in the input when it parses,
  // otherwise the saved current price — so the column is always live.
  const effectiveCents = draftCents ?? sku.current?.priceCents ?? null;
  const margin = marginInfo(effectiveCents, sku.floor);
  const isDraft = draftCents != null
    && draftCents !== (sku.current?.priceCents ?? null);

  const cellInputCls =
    "w-24 bg-bg border text-fg text-[12px] px-2 py-1 outline-none " +
    "font-[inherit] text-right " +
    (margin?.belowFloor && isDraft
      ? "border-warn focus:border-warn"
      : "border-line focus:border-accent");

  return (
    <>
      <tr className={isDraft ? "bg-row-active-dim" : ""}>
        <td className="px-4 py-1.5 pl-7 text-fg">
          {sku.bracket && sku.bracket.id !== "default"
            ? sku.bracket.label
            : sku.product.saleUnit
              ? `per ${sku.product.saleUnit}`
              : "—"}
        </td>
        <td className="px-3 py-1.5 text-right text-dim whitespace-nowrap">
          {sku.floor != null ? fmtUSD(sku.floor) : "—"}
        </td>
        <td className="px-3 py-1.5 text-right whitespace-nowrap">
          {sku.current ? (
            <>
              {sku.current.compareAtCents != null && (
                <span className="text-faint line-through mr-1.5">
                  {fmtCents(sku.current.compareAtCents)}
                </span>
              )}
              <span className="text-accent font-heading text-[13px]">
                {fmtCents(sku.current.priceCents)}
              </span>
            </>
          ) : (
            <span className="text-faint italic">none</span>
          )}
        </td>
        <td className="px-3 py-1.5">
          <input
            value={draft?.price ?? ""}
            onChange={(e) =>
              setDraft(sku.key, { price: e.target.value })}
            placeholder={sku.current
              ? (sku.current.priceCents / 100).toFixed(2)
              : "0.00"}
            inputMode="decimal"
            className={cellInputCls}
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            value={draft?.compareAt ?? ""}
            onChange={(e) =>
              setDraft(sku.key, { compareAt: e.target.value })}
            placeholder="—"
            inputMode="decimal"
            title='"Was" price — renders struck through (sale pricing)'
            className="w-20 bg-bg border border-line text-fg text-[12px] px-2 py-1 outline-none focus:border-accent font-[inherit] text-right"
          />
        </td>
        <td className={
          "px-3 py-1.5 text-right whitespace-nowrap font-heading text-[13px] " +
          (margin == null ? "text-faint"
            : margin.belowFloor ? "text-warn" : "text-accent")
        }>
          {margin == null ? "—"
            : `${margin.marginPct.toFixed(0)}%`}
          {margin?.belowFloor && (
            <TriangleAlert size={12} className="inline ml-1 mb-0.5" />
          )}
        </td>
        <td className={
          "px-3 py-1.5 text-right whitespace-nowrap " +
          (margin == null ? "text-faint"
            : margin.belowFloor ? "text-warn" : "text-fg")
        }>
          {margin == null ? "—" : fmtUSD(margin.profit)}
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap text-right">
          {isDraft && (
            <button
              onClick={() => clearDraft(sku.key)}
              title="Discard this row's change"
              className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer align-middle"
            >
              <X size={13} />
            </button>
          )}
          <button
            onClick={onToggleHistory}
            title="Price history"
            className={
              "bg-transparent border-0 p-1 cursor-pointer align-middle " +
              (historyOpen ? "text-accent" : "text-muted hover:text-fg")
            }
          >
            <History size={13} />
          </button>
        </td>
      </tr>
      {historyOpen && (
        <tr>
          <td colSpan={8} className="px-7 pb-3">
            <PriceHistory sku={sku} prices={prices} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── price history ──────────────────────────────────────────────────────

function PriceHistory({ sku, prices }) {
  const history = priceHistoryFor(
    prices, sku.product.id, sku.bracket?.id ?? null);

  if (history.length === 0) {
    return (
      <div className="text-[11px] text-faint italic bg-bg border border-line px-3 py-2">
        No price set yet for this SKU.
      </div>
    );
  }

  return (
    <div className="bg-bg border border-line">
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] px-3 pt-2 pb-1">
        Price history
      </div>
      {history.map(row => (
        <div
          key={row.id}
          className="px-3 py-1.5 flex items-baseline gap-3 border-t border-line text-[11px]"
        >
          <span className="text-accent font-heading text-[12px]">
            {fmtCents(row.priceCents)}
          </span>
          {row.compareAtCents != null && (
            <span className="text-faint line-through">
              {fmtCents(row.compareAtCents)}
            </span>
          )}
          <span className="text-dim ml-auto">
            {new Date(row.createdAt).toLocaleDateString(undefined, {
              year: "numeric", month: "short", day: "numeric",
            })}
          </span>
          {row.createdBy && (
            <span className="text-faint">{row.createdBy}</span>
          )}
        </div>
      ))}
    </div>
  );
}
