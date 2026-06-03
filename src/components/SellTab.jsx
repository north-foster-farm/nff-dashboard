import { useMemo, useState } from "react";
import { Banknote, Minus, Plus } from "lucide-react";
import {
  SALE_CHANNELS, currentPriceMap, fmtCents, parseDollarsToCents,
  expandSkus, skuKey, skuLabel,
} from "../lib/productCatalog.js";
import { LABEL_CLS } from "./ui.jsx";

// The Sell tab (Batch 28.2) — the point-of-sale register.
//
// Top: every sellable SKU (products × brackets, plus bundles) as a
// row — name · current price · on hand · quantity stepper. Bottom:
// the cart — per-line totals (auto from the pricing grid, editable),
// grand total, date / channel / notes, and the Record button.
//
// Recording writes one product_sales row per cart line, then draws
// inventory lots down FIFO via allocateToSale; bundles expand to
// their components. The "Family" channel is the internal-consumption
// flow: line totals prefill to $0 (it's not revenue) but inventory
// still decrements. Shortfalls warn, never block — the sale already
// happened in the real world; it's the counts that need fixing.

const inputCls =
  "bg-bg border border-line text-fg text-[13px] px-2.5 py-2 outline-none " +
  "focus:border-accent font-[inherit] w-full";
const labelCls = LABEL_CLS;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
    String(d.getDate()).padStart(2, "0");
}

export default function SellTab({ db, inv, products }) {
  const priceMap = useMemo(
    () => currentPriceMap(db.prices), [db.prices]);
  // Sellable SKUs: product × bracket rows plus bundles (which expand
  // to a single row — their components allocate behind the scenes).
  const skus = useMemo(() => expandSkus(products), [products]);

  // The cart: sku index → quantity. Price overrides: sku index →
  // dollars string the user typed for that LINE (not per unit).
  const [qtys, setQtys] = useState(() => new Map());
  const [overrides, setOverrides] = useState(() => new Map());
  const [soldOn, setSoldOn] = useState(todayISO());
  const [channel, setChannel] = useState("farmers_market");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null); // { count, shortfalls: [] }
  const [errorMsg, setErrorMsg] = useState(null);

  const isFamily = channel === "family";

  // On-hand per SKU. Bundles compute from their components: the
  // number of complete bundles the freezers could assemble right now.
  const onHandFor = (sku) => {
    if (sku.product.isBundle) {
      const contents = sku.product.bundleContents ?? [];
      if (contents.length === 0) return null;
      let min = Infinity;
      for (const c of contents) {
        const have = inv.onHand.get(
          skuKey(c.productKindId, c.bracketId ?? null)) ?? 0;
        min = Math.min(min, Math.floor(have / (c.quantity || 1)));
      }
      return Number.isFinite(min) ? min : null;
    }
    return inv.onHand.get(
      skuKey(sku.product.id, sku.bracket?.id ?? null)) ?? 0;
  };

  // A line's auto total: unit price × qty; $0 on the family channel.
  const suggestedLineCents = (sku, qty) => {
    if (isFamily) return 0;
    const price = priceMap.get(
      skuKey(sku.product.id, sku.bracket?.id ?? null))?.priceCents
      ?? priceMap.get(skuKey(sku.product.id, null))?.priceCents;
    if (price == null) return null;
    return Math.round(price * qty);
  };

  const setQty = (i, next) => {
    setResult(null);
    setQtys(prev => {
      const m = new Map(prev);
      if (next <= 0) m.delete(i); else m.set(i, next);
      return m;
    });
    // A quantity change invalidates that line's hand-typed total.
    setOverrides(prev => {
      if (!prev.has(i)) return prev;
      const m = new Map(prev);
      m.delete(i);
      return m;
    });
  };

  const cartLines = useMemo(() => {
    const lines = [];
    for (const [i, qty] of qtys) {
      const sku = skus[i];
      if (!sku || qty <= 0) continue;
      const suggested = suggestedLineCents(sku, qty);
      const override = overrides.get(i);
      const cents = override != null
        ? parseDollarsToCents(override)
        : suggested;
      lines.push({ i, sku, qty, cents, suggested, override });
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtys, overrides, skus, priceMap, isFamily]);

  const grandTotal = cartLines.reduce(
    (a, l) => a + (l.cents ?? 0), 0);
  const everyLinePriced = cartLines.every(l => l.cents != null);

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    setResult(null);
    const shortfalls = [];
    let recorded = 0;
    try {
      for (const line of cartLines) {
        const sale = await db.recordSale({
          soldOn,
          productKindId: line.sku.product.id,
          bracketId: line.sku.bracket?.id ?? null,
          quantity: line.qty,
          totalCents: line.cents ?? 0,
          channel,
          notes,
        });
        recorded += 1;
        // Inventory draw-down: bundles expand to components; plain
        // SKUs allocate directly.
        const targets = line.sku.product.isBundle
          ? (line.sku.product.bundleContents ?? []).map(c => ({
              productKindId: c.productKindId,
              bracketId: c.bracketId ?? null,
              quantity: (c.quantity || 1) * line.qty,
              label: `${line.sku.product.name} → ${c.productKindId}`,
            }))
          : [{
              productKindId: line.sku.product.id,
              bracketId: line.sku.bracket?.id ?? null,
              quantity: line.qty,
              label: skuLabel(line.sku.product, line.sku.bracket),
            }];
        for (const t of targets) {
          const { short } = await inv.allocateToSale({
            saleId: sale.id,
            productKindId: t.productKindId,
            bracketId: t.bracketId,
            quantity: t.quantity,
          });
          if (short > 0) shortfalls.push({ label: t.label, short });
        }
      }
      setQtys(new Map());
      setOverrides(new Map());
      setNotes("");
      setResult({ count: recorded, shortfalls });
    } catch (e) {
      setErrorMsg(
        (e?.message ?? "Save failed.")
        + (recorded > 0
          ? ` (${recorded} line${recorded === 1 ? "" : "s"} already`
            + " recorded — check Recent sales before retrying.)"
          : ""));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* SKU rows */}
      <div className="flex flex-col gap-px bg-line border border-line">
        {skus.map((sku, i) => (
          <SkuRow
            key={skuKey(sku.product.id, sku.bracket?.id ?? null)}
            sku={sku}
            price={priceMap.get(
              skuKey(sku.product.id, sku.bracket?.id ?? null))
              ?? priceMap.get(skuKey(sku.product.id, null))}
            onHand={onHandFor(sku)}
            qty={qtys.get(i) ?? 0}
            onQty={(q) => setQty(i, q)}
            disabled={pending}
          />
        ))}
        {skus.length === 0 && (
          <div className="bg-surface px-4 py-6 text-[12px] text-dim italic text-center">
            No products in the catalog yet — add them on the Catalog
            tab first.
          </div>
        )}
      </div>

      {/* Cart */}
      {cartLines.length > 0 && (
        <div className="bg-surface border border-accent p-4 flex flex-col gap-3 sticky bottom-4 shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
          <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
            This sale
          </div>
          <div className="flex flex-col gap-1.5">
            {cartLines.map(line => (
              <div key={line.i} className="flex items-center gap-3">
                <span className="flex-1 text-[13px] text-fg min-w-0 truncate">
                  {skuLabel(line.sku.product, line.sku.bracket)}
                  <span className="text-dim"> × {line.qty}</span>
                </span>
                <div className="shrink-0 w-24">
                  <input
                    value={line.override != null
                      ? line.override
                      : line.suggested != null
                        ? (line.suggested / 100).toFixed(2)
                        : ""}
                    onChange={(e) => {
                      setOverrides(prev => {
                        const m = new Map(prev);
                        m.set(line.i, e.target.value);
                        return m;
                      });
                    }}
                    placeholder="0.00"
                    inputMode="decimal"
                    disabled={pending}
                    className={inputCls + " text-right"}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-2.5">
            <span className="text-[11px] text-dim uppercase tracking-[0.12em]">
              Total
            </span>
            <span className="font-heading text-[22px] font-semibold text-fg">
              {fmtCents(grandTotal)}
            </span>
          </div>
          {isFamily && (
            <div className="text-[11px] text-dim leading-relaxed">
              Family — not revenue, so totals prefill to $0; the
              freezer counts still go down.
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <div className={labelCls}>Date</div>
              <input type="date" value={soldOn} className={inputCls}
                disabled={pending}
                onChange={(e) => setSoldOn(e.target.value)} />
            </div>
            <div>
              <div className={labelCls}>Channel</div>
              <select value={channel} className={inputCls}
                disabled={pending}
                onChange={(e) => {
                  setChannel(e.target.value);
                  // Channel changes re-derive every untouched price
                  // (family ↔ paid switches the $0 prefill).
                  setOverrides(new Map());
                }}>
                {SALE_CHANNELS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelCls}>Notes</div>
              <input value={notes} className={inputCls}
                placeholder="optional"
                disabled={pending}
                onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {errorMsg && (
            <div className="text-[11px] text-warn">{errorMsg}</div>
          )}
          <button
            onClick={submit}
            disabled={pending || !everyLinePriced}
            className="inline-flex items-center justify-center gap-2 bg-accent text-on-accent border border-accent font-[inherit] text-[12px] font-semibold uppercase tracking-[0.12em] px-4 py-2.5 cursor-pointer disabled:opacity-50"
          >
            <Banknote size={14} />
            {pending
              ? "Recording…"
              : `Record ${cartLines.length} line`
                + `${cartLines.length === 1 ? "" : "s"}`
                + ` — ${fmtCents(grandTotal)}`}
          </button>
          {!everyLinePriced && (
            <div className="text-[10px] text-faint text-center">
              Every line needs a price — set one in the Pricing tab or
              type the total.
            </div>
          )}
        </div>
      )}

      {/* Post-sale result */}
      {result && (
        <div className={
          "border p-4 text-[12px] leading-relaxed "
          + (result.shortfalls.length > 0
            ? "bg-surface border-warn text-fg"
            : "bg-surface border-line text-resolved")
        }>
          {result.count} sale line{result.count === 1 ? "" : "s"} recorded.
          {result.shortfalls.length > 0 && (
            <div className="text-warn mt-1.5">
              Inventory came up short — the sale is recorded, but the
              freezer counts didn&rsquo;t cover it:
              <ul className="m-0 mt-1 pl-5">
                {result.shortfalls.map((s, i) => (
                  <li key={i}>
                    {s.label}: {s.short} short
                  </li>
                ))}
              </ul>
              Fix the lots on the Inventory page if the counts are
              wrong.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One sellable SKU row: label · price · on hand · stepper.
function SkuRow({ sku, price, onHand, qty, onQty, disabled }) {
  const inCart = qty > 0;
  const soldOut = sku.product.soldOut;
  return (
    <div className={
      "bg-surface px-4 py-3 flex items-center gap-3 "
      + (soldOut && !inCart ? "opacity-55" : "")
    }>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-fg">
          {skuLabel(sku.product, sku.bracket)}
          {soldOut && (
            <span className="text-[10px] text-warn uppercase tracking-[0.1em] ml-2">
              marked sold out
            </span>
          )}
        </div>
        <div className="text-[11px] text-dim mt-0.5">
          {price ? fmtCents(price.priceCents) : "no price set"}
          {onHand != null && (
            <span className={onHand === 0 ? " text-warn" : ""}>
              {" "}· {onHand} on hand
            </span>
          )}
        </div>
      </div>
      <Stepper
        qty={qty}
        onQty={onQty}
        disabled={disabled}
      />
    </div>
  );
}

// [-] qty [+] — qty is directly editable for by-weight quantities
// (1.5 dozen, 12.4 lb).
function Stepper({ qty, onQty, disabled }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <StepBtn
        onClick={() => onQty(Math.max(0, qty - 1))}
        disabled={disabled || qty <= 0}
        ariaLabel="One fewer"
      >
        <Minus size={13} />
      </StepBtn>
      <input
        value={qty || ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onQty(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        placeholder="0"
        inputMode="decimal"
        disabled={disabled}
        className={
          "w-14 bg-bg border border-line text-fg text-[14px] px-2 py-1.5 " +
          "outline-none focus:border-accent font-[inherit] text-center " +
          (qty > 0 ? "border-accent font-semibold" : "")
        }
      />
      <StepBtn
        onClick={() => onQty(qty + 1)}
        disabled={disabled}
        ariaLabel="One more"
      >
        <Plus size={13} />
      </StepBtn>
    </div>
  );
}

function StepBtn({ onClick, disabled, ariaLabel, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="bg-surface border border-line text-dim hover:text-fg font-[inherit] w-9 h-9 cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}
