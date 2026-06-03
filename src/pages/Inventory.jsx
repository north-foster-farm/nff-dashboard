import { useMemo, useState } from "react";
import {
  Boxes, ChevronDown, ChevronRight, MapPin, Plus, Trash2,
} from "lucide-react";
import { useProducts } from "../lib/data/useProducts.js";
import { useInventory } from "../lib/data/useInventory.js";
import { useSites } from "../lib/data/useSites.js";
import { expandSkus, skuLabel } from "../lib/productCatalog.js";
import { formatDate } from "../lib/dates.js";

// The Inventory page (Batch 28.1) — the real, DB-backed inventory
// replacing the Batch-4 static stub.
//
// Lot-based: a lot is "12 whole chickens, 3.5–4 lb, processed Jun 23,
// in the Fred freezer". Lots are created here (e.g. as the final step
// of a processing day, or after an egg count), adjusted when a
// recount / spoilage happens, and decremented automatically by POS
// sales (Batch 28.2). Storage locations are places from the farm map
// tree — add freezers/fridges under House / Barn / Fred via Edit
// places.

export default function Inventory({ startCreating = false }) {
  const catalog = useProducts();
  const inv = useInventory();
  const { places, placesById, loading: sitesLoading } = useSites();
  const [creating, setCreating] = useState(startCreating);

  // Lots grouped by product kind, in catalog (ordinal) order. Kinds
  // with no lots don't render a group.
  const groups = useMemo(() => {
    const byKind = new Map();
    for (const lot of inv.lots) {
      if (!byKind.has(lot.productKindId)) byKind.set(lot.productKindId, []);
      byKind.get(lot.productKindId).push(lot);
    }
    const out = [];
    for (const product of catalog.products) {
      const lots = byKind.get(product.id);
      if (lots) out.push({ product, lots });
      byKind.delete(product.id);
    }
    // Lots whose product was archived still show, at the end.
    for (const [kindId, lots] of byKind) {
      const product = catalog.productsById.get(kindId);
      if (product) out.push({ product, lots });
    }
    return out;
  }, [inv.lots, catalog.products, catalog.productsById]);

  const loading = catalog.loading || inv.loading || sitesLoading;

  return (
    <div className="max-w-[920px] flex flex-col gap-5">
      <div className="text-[11px] text-muted leading-relaxed max-w-[700px]">
        What&rsquo;s in the freezers and the fridge, lot by lot — which
        processing day it came from, where it lives, and how much is
        left. Selling through the Products page&rsquo;s POS draws lots
        down automatically, oldest first.
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SummaryStrip groups={groups} />
        <button
          onClick={() => setCreating(c => !c)}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          <Plus size={13} /> New lot
        </button>
      </div>

      {creating && (
        <NewLotForm
          products={catalog.products}
          places={places}
          onSave={async (fields) => {
            await inv.createLot(fields);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="bg-surface border border-line px-6 py-10 text-center">
          <Boxes size={20} className="text-faint mx-auto mb-3" />
          <div className="text-[13px] text-muted">
            No inventory lots yet.
          </div>
          <div className="text-[11px] text-faint leading-relaxed max-w-[520px] mx-auto mt-2">
            Chicken lots get created as the final step of a processing
            day — sort by size and cut, then add one lot per size
            bracket. Egg lots come from carton counts before a market.
          </div>
        </div>
      ) : (
        groups.map(group => (
          <LotGroup
            key={group.product.id}
            product={group.product}
            lots={group.lots}
            inv={inv}
            places={places}
            placesById={placesById}
          />
        ))
      )}
    </div>
  );
}

// ── summary strip ──────────────────────────────────────────────────────

function SummaryStrip({ groups }) {
  const tiles = groups
    .map(g => ({
      product: g.product,
      total: g.lots.reduce((a, l) => a + l.quantity, 0),
    }))
    .filter(t => t.total > 0);

  if (tiles.length === 0) return <div />;
  return (
    <div className="flex items-stretch gap-3 flex-wrap">
      {tiles.map(t => (
        <div
          key={t.product.id}
          className="bg-surface border border-line px-4 py-3 min-w-[140px]"
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-heading text-[26px] font-semibold leading-none text-fg">
              {t.total}
            </span>
            <span className="text-[11px] text-dim">
              {t.product.saleUnit ?? "units"}
            </span>
          </div>
          <div className="text-[10px] text-faint uppercase tracking-[0.12em] mt-1.5">
            {t.product.name}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── product groups ─────────────────────────────────────────────────────

function LotGroup({ product, lots, inv, places, placesById }) {
  const total = lots.reduce((a, l) => a + l.quantity, 0);
  const open = lots.filter(l => l.quantity > 0);
  const depleted = lots.filter(l => l.quantity === 0);
  const [showDepleted, setShowDepleted] = useState(false);

  return (
    <section className="flex flex-col">
      <header className="flex items-baseline gap-2.5 pb-2">
        <span className="font-heading text-[17px] font-semibold text-fg">
          {product.name}
        </span>
        <span className="text-[12px] text-dim">
          {total} {product.saleUnit ?? "units"} on hand
          · {open.length} open lot{open.length === 1 ? "" : "s"}
        </span>
      </header>
      <div className="flex flex-col gap-px bg-line border border-line">
        {open.map(lot => (
          <LotRow
            key={lot.id}
            lot={lot}
            product={product}
            inv={inv}
            places={places}
            placesById={placesById}
          />
        ))}
        {open.length === 0 && (
          <div className="bg-surface px-4 py-4 text-[12px] text-dim italic">
            Nothing on hand — every lot of {product.name} is sold out.
          </div>
        )}
      </div>
      {depleted.length > 0 && (
        <button
          onClick={() => setShowDepleted(s => !s)}
          className="self-start inline-flex items-center gap-1.5 bg-transparent border-0 text-faint hover:text-dim font-[inherit] text-[10px] font-semibold uppercase tracking-[0.12em] px-0 pt-2 cursor-pointer"
        >
          {showDepleted
            ? <ChevronDown size={11} className="shrink-0" />
            : <ChevronRight size={11} className="shrink-0" />}
          {depleted.length} depleted lot{depleted.length === 1 ? "" : "s"}
        </button>
      )}
      {showDepleted && depleted.length > 0 && (
        <div className="flex flex-col gap-px bg-line border border-line mt-2 opacity-70">
          {depleted.map(lot => (
            <LotRow
              key={lot.id}
              lot={lot}
              product={product}
              inv={inv}
              places={places}
              placesById={placesById}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── lot rows ───────────────────────────────────────────────────────────

function LotRow({ lot, product, inv, places, placesById }) {
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const bracket = (product.sizeBrackets ?? [])
    .find(b => b.id === lot.bracketId) ?? null;
  const place = lot.placeId ? placesById?.get(lot.placeId) : null;
  const movements = inv.movementsByLot.get(lot.id) ?? [];

  return (
    <div className="bg-surface">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 font-[inherit] text-left cursor-pointer"
      >
        {expanded
          ? <ChevronDown size={13} className="shrink-0 text-dim" />
          : <ChevronRight size={13} className="shrink-0 text-dim" />}
        <div className="flex-1 min-w-0">
          <span className="text-[13px] text-fg">
            {skuLabel(product, bracket)}
          </span>
          <span className="text-[11px] text-dim">
            {" "}· {formatDate(lot.lotDate)}
          </span>
          {place && (
            <span className="text-[11px] text-muted">
              {" "}· <MapPin size={10} className="inline -translate-y-px" />
              {" "}{place.name}
            </span>
          )}
          {lot.notes && (
            <div className="text-[11px] text-muted mt-0.5 truncate">
              {lot.notes}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-heading text-[18px] font-semibold text-fg">
            {lot.quantity}
          </span>
          <span className="text-[10px] text-faint">
            {" "}/ {lot.initialQuantity}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-10 flex flex-col gap-3 border-t border-line pt-3">
          <LotActions
            lot={lot}
            inv={inv}
            places={places}
            onError={setErrorMsg}
          />
          {errorMsg && (
            <div className="text-[11px] text-warn">{errorMsg}</div>
          )}
          <MovementLog movements={movements} />
        </div>
      )}
    </div>
  );
}

const inputCls =
  "bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none " +
  "focus:border-accent font-[inherit]";
const labelCls = "text-[9px] text-faint uppercase tracking-[0.12em] mb-1";
const btnGhostCls =
  "bg-transparent border border-line text-dim font-[inherit] text-[10px] " +
  "font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 cursor-pointer " +
  "hover:text-fg disabled:opacity-50";

// Per-lot actions: recount / spoilage adjustment, move to a different
// place, and delete (mistakes only).
function LotActions({ lot, inv, places, onError }) {
  const [draftQty, setDraftQty] = useState(String(lot.quantity));
  const [reason, setReason] = useState("adjustment");
  const [pending, setPending] = useState(false);

  const run = async (fn) => {
    setPending(true);
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(e?.message ?? "That didn't save.");
    } finally {
      setPending(false);
    }
  };

  const commitAdjust = () => {
    const n = Number(draftQty);
    if (!Number.isFinite(n) || n < 0 || n === lot.quantity) return;
    run(() => inv.adjustLot(lot.id, n, { reason }));
  };

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div>
        <div className={labelCls}>Count</div>
        <input
          type="number"
          min="0"
          value={draftQty}
          onChange={(e) => setDraftQty(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitAdjust(); }}
          disabled={pending}
          className={inputCls + " w-20"}
        />
      </div>
      <div>
        <div className={labelCls}>Reason</div>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={pending}
          className={inputCls}
        >
          <option value="adjustment">Recount</option>
          <option value="spoilage">Spoilage</option>
        </select>
      </div>
      <button
        onClick={commitAdjust}
        disabled={pending || Number(draftQty) === lot.quantity}
        className={btnGhostCls}
      >
        Update count
      </button>

      <div className="ml-auto flex items-end gap-3">
        <div>
          <div className={labelCls}>Move to</div>
          <select
            value={lot.placeId ?? ""}
            onChange={(e) =>
              run(() => inv.moveLot(lot.id, e.target.value || null))}
            disabled={pending}
            className={inputCls}
          >
            <option value="">— nowhere recorded —</option>
            {places.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            if (!window.confirm(
              "Delete this lot and its history? Only do this for "
              + "lots created by mistake.")) return;
            run(() => inv.removeLot(lot.id));
          }}
          disabled={pending}
          title="Delete this lot (mistakes only)"
          className={btnGhostCls + " text-warn hover:text-warn"}
        >
          <Trash2 size={12} className="inline -translate-y-px" /> Delete
        </button>
      </div>
    </div>
  );
}

// The movement audit trail under an expanded lot.
function MovementLog({ movements }) {
  if (movements.length === 0) return null;
  const reasonLabel = {
    created: "Created",
    sale: "Sold",
    adjustment: "Recount",
    spoilage: "Spoilage",
  };
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-1.5">
        History
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-1">
        {movements.map(m => (
          <li
            key={m.id}
            className="text-[11px] text-muted flex items-baseline gap-2"
          >
            <span className={
              "font-semibold tabular-nums " +
              (m.delta < 0 ? "text-warn" : "text-resolved")
            }>
              {m.delta > 0 ? `+${m.delta}` : m.delta}
            </span>
            <span>{reasonLabel[m.reason] ?? m.reason}</span>
            {m.notes && <span className="text-faint">— {m.notes}</span>}
            <span className="text-faint ml-auto">
              {new Date(m.createdAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── new lot form ───────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function NewLotForm({ products, places, onSave, onCancel }) {
  // SKU = product × bracket, the same expansion the pricing grid uses.
  // Bundles are never lotted — they're assembled from component lots.
  const skus = useMemo(
    () => expandSkus(products.filter(p => !p.isBundle)),
    [products]
  );
  const [skuIdx, setSkuIdx] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lotDate, setLotDate] = useState(todayISO());
  const [placeId, setPlaceId] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    setErrorMsg(null);
    const sku = skus[Number(skuIdx)];
    if (!sku) { setErrorMsg("Pick a product."); return; }
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      setErrorMsg("Quantity must be a positive number.");
      return;
    }
    setPending(true);
    try {
      await onSave({
        productKindId: sku.product.id,
        bracketId: sku.bracket?.id ?? null,
        lotDate,
        quantity: q,
        placeId: placeId || null,
        notes,
      });
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't save.");
      setPending(false);
    }
  };

  return (
    <div className="bg-surface border border-accent p-4 flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
        New lot
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[220px]">
          <div className={labelCls}>Product</div>
          <select
            value={skuIdx}
            onChange={(e) => setSkuIdx(e.target.value)}
            disabled={pending}
            className={inputCls + " w-full"}
          >
            <option value="">— pick a product —</option>
            {skus.map((sku, i) => (
              <option key={i} value={i}>
                {skuLabel(sku.product, sku.bracket)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className={labelCls}>Quantity</div>
          <input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            disabled={pending}
            placeholder="12"
            className={inputCls + " w-20"}
          />
        </div>
        <div>
          <div className={labelCls}>Lot date</div>
          <input
            type="date"
            value={lotDate}
            onChange={(e) => setLotDate(e.target.value)}
            disabled={pending}
            className={inputCls}
          />
        </div>
        <div>
          <div className={labelCls}>Stored at</div>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            disabled={pending}
            className={inputCls}
          >
            <option value="">— nowhere recorded —</option>
            {places.filter(p => p.isActive).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className={labelCls}>Notes</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          placeholder="Optional — e.g. which freezer shelf, cut notes"
          className={inputCls + " w-full"}
        />
      </div>
      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add lot"}
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className={btnGhostCls}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
