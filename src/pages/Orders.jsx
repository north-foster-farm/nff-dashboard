import { useMemo, useState } from "react";
import {
  Ban, Banknote, Check, ChevronDown, ChevronRight, Package,
  PackageCheck, Pencil, Plus, Receipt, RotateCcw, Settings2, Trash2,
  Truck, X,
} from "lucide-react";
import { useOrders } from "../lib/data/useOrders.js";
import { useCustomers } from "../lib/data/useCustomers.js";
import { useProducts } from "../lib/data/useProducts.js";
import { useInventory } from "../lib/data/useInventory.js";
import {
  EMPTY_ADDRESS, FULFILLMENT_METHODS, ORDER_STATUSES, PAYMENT_METHODS,
  cleanAddress, formatAddress, fulfillmentLabel, orderCustomerName,
  orderTotalCents, parcelsSummary, paymentMethodLabel,
  shipmentStatusLabel, stateAllowed,
} from "../lib/orders.js";
import {
  currentPriceMap, expandSkus, fmtCents, parseDollarsToCents, skuKey,
  skuLabel,
} from "../lib/productCatalog.js";
import { formatDate } from "../lib/dates.js";

// The Orders page (Batch 29) — customer orders against the catalog,
// from promise to fulfillment to the box on the porch.
//
// An order is a promise: lines, a customer, a fulfillment method, and
// a total. Nothing touches product_sales or inventory until the order
// is fulfilled — fulfilling writes one sale row per line and draws
// the freezer counts down FIFO (same path as the POS). Lifecycle:
// open → ready → fulfilled, plus cancelled; open orders can be edited
// or deleted freely, fulfilled orders are frozen. Payment is a paid
// stamp + method, capturable at any point.
//
// Shipping orders (29.3) carry a ship-to address (prefilled from the
// customer's default, snapshotted per order) and any number of
// shipments — parcels with dims / weight / dry ice, a manual label
// workflow (buy on PirateShip/Shippo, paste tracking in), and a
// cold-chain state allowlist that warns when the destination is
// farther than frozen product should travel.
//
// Sidebar wiring: Sales → Orders lands here; the dashboard's "Open
// orders" card counts the open + ready groups.

const inputCls =
  "bg-bg border border-line text-fg text-[12px] px-2 py-1.5 outline-none " +
  "focus:border-accent font-[inherit]";
const labelCls = "text-[9px] text-faint uppercase tracking-[0.12em] mb-1";
const btnGhostCls =
  "bg-transparent border border-line text-dim font-[inherit] text-[10px] " +
  "font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 cursor-pointer " +
  "hover:text-fg disabled:opacity-50";
const btnAccentCls =
  "inline-flex items-center gap-1.5 bg-accent text-on-accent border " +
  "border-accent font-[inherit] text-[11px] font-semibold uppercase " +
  "tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50";

export default function Orders({ startCreating = false }) {
  const db = useOrders();
  const crm = useCustomers();
  const catalog = useProducts();
  const inv = useInventory();
  const [creating, setCreating] = useState(startCreating);
  const [showSettings, setShowSettings] = useState(false);

  const customersById = useMemo(
    () => new Map(
      [...crm.customers, ...crm.archived].map(c => [c.id, c])),
    [crm.customers, crm.archived]
  );
  const priceMap = useMemo(
    () => currentPriceMap(catalog.prices), [catalog.prices]);
  const skus = useMemo(
    () => expandSkus(catalog.products), [catalog.products]);

  const loading = db.loading || crm.loading || catalog.loading;

  // Saving an order: create/update, then optionally write the entered
  // ship-to back to the customer record as their default address.
  const saveCustomerDefault = async (fields) => {
    if (fields.saveAddressAsDefault && fields.customerId
      && fields.shipTo) {
      await crm.updateCustomer(fields.customerId, {
        address: fields.shipTo,
      });
    }
  };

  return (
    <div className="max-w-[920px] flex flex-col gap-5">
      <div className="text-[11px] text-muted leading-relaxed max-w-[700px]">
        Customer orders — what&rsquo;s been promised, to whom, and for
        how much. An order doesn&rsquo;t touch the sales record or the
        freezer counts until it&rsquo;s fulfilled, so cancelling an open
        order costs nothing.
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SummaryStrip byStatus={db.byStatus} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(s => !s)}
            aria-label="Shipping settings"
            className={btnGhostCls + " py-[7px]"}
          >
            <Settings2 size={13} />
          </button>
          <button
            onClick={() => setCreating(c => !c)}
            className={btnAccentCls}
          >
            <Plus size={13} /> New order
          </button>
        </div>
      </div>

      {showSettings && (
        <ShippingSettingsPanel
          db={db}
          onClose={() => setShowSettings(false)}
        />
      )}

      {creating && (
        <OrderForm
          customers={crm.customers}
          skus={skus}
          priceMap={priceMap}
          onHand={inv.onHand}
          allowedStates={db.shippingSettings.allowedStates}
          onSave={async (fields) => {
            await db.createOrder(fields);
            await saveCustomerDefault(fields);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : db.orders.length === 0 ? (
        <div className="bg-surface border border-line px-6 py-10 text-center">
          <Receipt size={20} className="text-faint mx-auto mb-3" />
          <div className="text-[13px] text-muted">No orders yet.</div>
          <div className="text-[11px] text-faint leading-relaxed max-w-[520px] mx-auto mt-2">
            Orders are for sales that happen over time — a customer
            calls ahead, the order sits open while it&rsquo;s gathered,
            and fulfilling it records the sale and draws down
            inventory. For on-the-spot sales, use the Sell tab on the
            Products page instead.
          </div>
        </div>
      ) : (
        ORDER_STATUSES.map(status => (
          <StatusGroup
            key={status.id}
            status={status}
            orders={db.byStatus[status.id] ?? []}
            db={db}
            crm={crm}
            customersById={customersById}
            catalog={catalog}
            skus={skus}
            priceMap={priceMap}
            inv={inv}
          />
        ))
      )}
    </div>
  );
}

// ── summary strip ──────────────────────────────────────────────────────

function SummaryStrip({ byStatus }) {
  const open = byStatus.open ?? [];
  const ready = byStatus.ready ?? [];
  const awaiting = [...open, ...ready];
  const awaitingCents = awaiting.reduce(
    (a, o) => a + (o.totalCents ?? 0), 0);

  const tiles = [
    { label: "Open", value: open.length },
    { label: "Ready", value: ready.length },
    { label: "Awaiting value", value: fmtCents(awaitingCents) },
  ];
  return (
    <div className="flex items-stretch gap-3 flex-wrap">
      {tiles.map(t => (
        <div
          key={t.label}
          className="bg-surface border border-line px-4 py-3 min-w-[110px]"
        >
          <div className="font-heading text-[26px] font-semibold leading-none text-fg">
            {t.value}
          </div>
          <div className="text-[10px] text-faint uppercase tracking-[0.12em] mt-1.5">
            {t.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── status groups ──────────────────────────────────────────────────────

function StatusGroup({
  status, orders, db, crm, customersById, catalog, skus, priceMap,
  inv,
}) {
  // Fulfilled / cancelled groups collapse by default; open / ready are
  // the working set and stay expanded.
  const workingSet = status.id === "open" || status.id === "ready";
  const [expanded, setExpanded] = useState(workingSet);

  // Empty non-working groups don't render at all; an empty Open group
  // still shows so the page never looks broken.
  if (orders.length === 0 && status.id !== "open") return null;

  return (
    <section className="flex flex-col">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-baseline gap-2.5 pb-2 bg-transparent border-0 font-[inherit] text-left cursor-pointer w-full"
      >
        {expanded
          ? <ChevronDown size={13} className="shrink-0 text-dim self-center" />
          : <ChevronRight size={13} className="shrink-0 text-dim self-center" />}
        <span className="font-heading text-[17px] font-semibold text-fg">
          {status.label}
        </span>
        <span className="text-[12px] text-dim">
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-px bg-line border border-line">
          {orders.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              db={db}
              crm={crm}
              customersById={customersById}
              catalog={catalog}
              skus={skus}
              priceMap={priceMap}
              inv={inv}
            />
          ))}
          {orders.length === 0 && (
            <div className="bg-surface px-4 py-4 text-[12px] text-dim italic">
              No open orders.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── order rows ─────────────────────────────────────────────────────────

function OrderRow({
  order, db, crm, customersById, catalog, skus, priceMap, inv,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillResult, setFulfillResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pending, setPending] = useState(false);
  const isOpen = order.status === "open";
  const isReady = order.status === "ready";
  const isCancelled = order.status === "cancelled";

  // Wrap a mutation: clear stale errors, surface failures inline.
  const run = async (fn) => {
    setErrorMsg(null);
    setPending(true);
    try {
      await fn();
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't work.");
    } finally {
      setPending(false);
    }
  };

  if (editing) {
    return (
      <div className="bg-surface p-4">
        <OrderForm
          order={order}
          customers={crm.customers}
          skus={skus}
          priceMap={priceMap}
          onHand={inv.onHand}
          allowedStates={db.shippingSettings.allowedStates}
          onSave={async (fields) => {
            // Lines first (recomputes the total against the order's
            // old shipping charge), then the header patch — which
            // includes the final total with the new shipping charge.
            await db.setLines(order.id, fields.lines);
            await db.updateOrder(order.id, {
              customerId: fields.customerId,
              customerName: fields.customerName,
              fulfillmentMethod: fields.fulfillmentMethod,
              notes: fields.notes,
              shipTo: fields.shipTo,
              shippingCents: fields.shippingCents,
              totalCents: orderTotalCents(
                fields.lines, fields.shippingCents),
            });
            if (fields.saveAddressAsDefault && fields.customerId
              && fields.shipTo) {
              await crm.updateCustomer(fields.customerId, {
                address: fields.shipTo,
              });
            }
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

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
            {orderCustomerName(order, customersById)}
          </span>
          <span className="text-[11px] text-dim">
            {" "}· {formatDate(order.placedAt?.slice(0, 10))}
            {" "}· {order.lines.length} line
            {order.lines.length === 1 ? "" : "s"}
          </span>
          {order.fulfillmentMethod !== "pickup" && (
            <span className="text-[11px] text-muted">
              {" "}· <Truck size={10} className="inline -translate-y-px" />
              {" "}{fulfillmentLabel(order.fulfillmentMethod)}
            </span>
          )}
          {order.notes && (
            <div className="text-[11px] text-muted mt-0.5 truncate">
              {order.notes}
            </div>
          )}
        </div>
        <PaymentChip order={order} />
        <div className="shrink-0 font-heading text-[18px] font-semibold text-fg">
          {fmtCents(order.totalCents)}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-10 flex flex-col gap-3 border-t border-line pt-3">
          <LineList order={order} catalog={catalog} />
          <ShipToBlock shipTo={order.shipTo} />
          <Lifecycle order={order} />
          {order.fulfillmentMethod === "shipping" && !isCancelled && (
            <ShipmentsBlock order={order} db={db} />
          )}
          {fulfillResult && <FulfillResult result={fulfillResult} />}
          {errorMsg && (
            <div className="text-[11px] text-warn">{errorMsg}</div>
          )}

          {fulfilling ? (
            <FulfillPanel
              order={order}
              db={db}
              catalog={catalog}
              inv={inv}
              onDone={(result) => {
                setFulfilling(false);
                setFulfillResult(result);
              }}
              onCancel={() => setFulfilling(false)}
            />
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* forward transitions */}
              {isOpen && (
                <button
                  onClick={() => run(() => db.markReady(order.id))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  <Check size={11} className="inline -translate-y-px" />
                  {" "}Mark ready
                </button>
              )}
              {(isOpen || isReady) && (
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    setFulfillResult(null);
                    setFulfilling(true);
                  }}
                  disabled={pending}
                  className={btnGhostCls + " text-fg"}
                >
                  <PackageCheck size={11} className="inline -translate-y-px" />
                  {" "}Fulfill…
                </button>
              )}

              {/* backward transitions */}
              {isReady && (
                <button
                  onClick={() => run(() => db.reopenOrder(order.id))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  <RotateCcw size={11} className="inline -translate-y-px" />
                  {" "}Back to open
                </button>
              )}
              {isCancelled && (
                <button
                  onClick={() => run(() => db.reopenOrder(order.id))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  <RotateCcw size={11} className="inline -translate-y-px" />
                  {" "}Reopen
                </button>
              )}

              {/* edit — open only */}
              {isOpen && (
                <button
                  onClick={() => { setErrorMsg(null); setEditing(true); }}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  <Pencil size={11} className="inline -translate-y-px" />
                  {" "}Edit
                </button>
              )}

              {/* payment — any non-cancelled order */}
              {!isCancelled && (
                <PaymentControl
                  order={order}
                  db={db}
                  run={run}
                  pending={pending}
                />
              )}

              {/* destructive — pushed right */}
              {(isOpen || isReady) && (
                <button
                  onClick={() => {
                    if (!window.confirm(
                      "Cancel this order? Nothing has been recorded "
                      + "yet, so cancelling costs nothing.")) return;
                    run(() => db.cancelOrder(order.id));
                  }}
                  disabled={pending}
                  className={btnGhostCls + " text-warn hover:text-warn ml-auto"}
                >
                  <Ban size={11} className="inline -translate-y-px" />
                  {" "}Cancel order
                </button>
              )}
              {(isOpen || isCancelled) && (
                <button
                  onClick={() => {
                    if (!window.confirm(
                      "Delete this order? Only do this for orders "
                      + "created by mistake.")) return;
                    run(() => db.removeOrder(order.id));
                  }}
                  disabled={pending}
                  className={
                    btnGhostCls + " text-warn hover:text-warn"
                    + (isCancelled ? " ml-auto" : "")
                  }
                >
                  <Trash2 size={11} className="inline -translate-y-px" />
                  {" "}Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Unpaid / paid chip on the collapsed row.
function PaymentChip({ order }) {
  if (order.status === "cancelled") return null;
  return order.paidAt ? (
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-resolved border border-resolved/40 px-1.5 py-0.5">
      Paid{order.paymentMethod
        ? ` · ${paymentMethodLabel(order.paymentMethod)}` : ""}
    </span>
  ) : (
    <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-dim border border-line px-1.5 py-0.5">
      Unpaid
    </span>
  );
}

// Status timestamps for the expanded view — the order's life so far.
function Lifecycle({ order }) {
  const stamps = [
    { label: "Placed", at: order.placedAt },
    { label: "Ready", at: order.readyAt },
    { label: "Fulfilled", at: order.fulfilledAt },
    { label: "Cancelled", at: order.cancelledAt },
    { label: "Paid", at: order.paidAt },
  ].filter(s => s.at);
  if (stamps.length <= 1) return null;
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[10px] text-faint">
      {stamps.map(s => (
        <span key={s.label}>
          <span className="uppercase tracking-[0.12em]">{s.label}</span>
          {" "}{formatDate(s.at.slice(0, 10))}
        </span>
      ))}
    </div>
  );
}

// Mark-paid control: unpaid orders get a method picker that records
// payment on selection; paid orders show the receipt with an undo.
function PaymentControl({ order, db, run, pending }) {
  if (order.paidAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-resolved">
        <Banknote size={11} />
        Paid · {paymentMethodLabel(order.paymentMethod)}
        <button
          onClick={() => {
            if (!window.confirm(
              "Clear the payment record on this order?")) return;
            run(() => db.clearPaid(order.id));
          }}
          disabled={pending}
          aria-label="Clear payment"
          className="bg-transparent border-0 text-dim hover:text-warn cursor-pointer p-0 font-[inherit] inline-flex"
        >
          <X size={11} />
        </button>
      </span>
    );
  }
  return (
    <select
      value=""
      onChange={(e) => {
        if (!e.target.value) return;
        run(() => db.setPaid(order.id, { method: e.target.value }));
      }}
      disabled={pending}
      className={
        "bg-transparent border border-line text-dim font-[inherit] " +
        "text-[10px] font-semibold uppercase tracking-[0.12em] px-2 " +
        "py-1.5 cursor-pointer hover:text-fg outline-none " +
        "disabled:opacity-50"
      }
    >
      <option value="">Mark paid…</option>
      {PAYMENT_METHODS.map(m => (
        <option key={m.id} value={m.id}>{m.label}</option>
      ))}
    </select>
  );
}

// ── fulfillment (Batch 29.2) ───────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
    String(d.getDate()).padStart(2, "0");
}

// The confirm step between "Fulfill…" and the writes: pick the sale
// date, optionally capture payment, see what inventory will be drawn,
// then record. Shortfalls warn after the fact (the handoff already
// happened in the real world); they never block.
function FulfillPanel({ order, db, catalog, inv, onDone, onCancel }) {
  const [soldOn, setSoldOn] = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      const result = await db.fulfillOrder(order.id, {
        soldOn,
        recordSale: catalog.recordSale,
        allocateToSale: inv.allocateToSale,
        productsById: catalog.productsById,
        paymentMethod: paymentMethod || null,
      });
      onDone(result);
    } catch (e) {
      setErrorMsg(e?.message ?? "Fulfillment failed.");
      setPending(false);
    }
  };

  return (
    <div className="bg-bg border border-accent p-4 flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
        Fulfill this order
      </div>
      <div className="text-[11px] text-muted leading-relaxed">
        This writes {order.lines.length} sale
        line{order.lines.length === 1 ? "" : "s"} to the sales record
        and draws the freezer counts down. A fulfilled order is frozen
        — it can&rsquo;t be edited or cancelled afterwards.
      </div>

      <FulfillPreview order={order} catalog={catalog} inv={inv} />

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <div className={labelCls}>Sale date</div>
          <input
            type="date"
            value={soldOn}
            onChange={(e) => setSoldOn(e.target.value)}
            disabled={pending}
            className={inputCls}
          />
        </div>
        {!order.paidAt && (
          <div>
            <div className={labelCls}>Payment</div>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={pending}
              className={inputCls}
            >
              <option value="">— not paid yet —</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.id} value={m.id}>
                  Paid by {m.label.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className={btnAccentCls}
        >
          <PackageCheck size={13} />
          {pending
            ? "Recording…"
            : `Record fulfillment — ${fmtCents(order.totalCents)}`}
        </button>
        <button onClick={onCancel} disabled={pending} className={btnGhostCls}>
          Back
        </button>
      </div>
    </div>
  );
}

// Per-line preview of the inventory draw. Bundles expand to their
// components; draws are summed per SKU so the have/need comparison is
// honest when two lines hit the same freezer count.
function FulfillPreview({ order, catalog, inv }) {
  const draws = [];
  for (const line of order.lines) {
    const product = catalog.productsById.get(line.productKindId);
    if (product?.isBundle) {
      for (const c of product.bundleContents ?? []) {
        const component = catalog.productsById.get(c.productKindId);
        draws.push({
          label: `${product.name} → ${component?.name ?? c.productKindId}`,
          key: skuKey(c.productKindId, c.bracketId ?? null),
          quantity: (c.quantity || 1) * line.quantity,
        });
      }
    } else {
      const bracket = (product?.sizeBrackets ?? [])
        .find(b => b.id === line.bracketId) ?? null;
      draws.push({
        label: product ? skuLabel(product, bracket) : line.productKindId,
        key: skuKey(line.productKindId, line.bracketId ?? null),
        quantity: line.quantity,
      });
    }
  }
  const needByKey = new Map();
  for (const d of draws) {
    needByKey.set(d.key, (needByKey.get(d.key) ?? 0) + d.quantity);
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
        Inventory draw
      </div>
      {draws.map((d, i) => {
        const have = inv.onHand.get(d.key) ?? 0;
        const short = (needByKey.get(d.key) ?? 0) > have;
        return (
          <div key={i} className="text-[12px] flex items-baseline gap-2">
            <span className="flex-1 text-fg">{d.label}</span>
            <span className={
              "tabular-nums " + (short ? "text-warn" : "text-dim")
            }>
              −{d.quantity} of {have} on hand
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Post-fulfillment result: success, or the list of SKUs the freezer
// counts didn't cover (mirrors the POS shortfall warning).
function FulfillResult({ result }) {
  return (
    <div className={
      "border p-3 text-[12px] leading-relaxed "
      + (result.shortfalls.length > 0
        ? "bg-bg border-warn text-fg"
        : "bg-bg border-line text-resolved")
    }>
      Order fulfilled — sales recorded and inventory drawn down.
      {result.shortfalls.length > 0 && (
        <div className="text-warn mt-1.5">
          Inventory came up short — the sales are recorded, but the
          freezer counts didn&rsquo;t cover them:
          <ul className="m-0 mt-1 pl-5">
            {result.shortfalls.map((s, i) => (
              <li key={i}>{s.label}: {s.short} short</li>
            ))}
          </ul>
          Fix the lots on the Inventory page if the counts are wrong.
        </div>
      )}
    </div>
  );
}

// ── addresses (Batch 29.3) ─────────────────────────────────────────────

// Ship-to entry, Shippo-shaped: name / phone, street, city / state /
// zip. Controlled by a single address object.
function AddressFields({ value, onChange, disabled }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  const field = (key, placeholder, extra = "") => (
    <input
      value={value[key] ?? ""}
      onChange={(e) => set(key, e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={inputCls + " " + extra}
    />
  );
  return (
    <div className="flex flex-col gap-2 max-w-[480px]">
      <div className="grid sm:grid-cols-2 gap-2">
        {field("name", "Recipient name")}
        {field("phone", "Phone")}
      </div>
      {field("street1", "Street address")}
      {field("street2", "Apt / unit (optional)")}
      <div className="grid grid-cols-[1fr_72px_100px] gap-2">
        {field("city", "City")}
        {field("state", "State")}
        {field("zip", "ZIP")}
      </div>
    </div>
  );
}

// ── shipments (Batch 29.3) ─────────────────────────────────────────────

// A shipping order's shipments: each one is a box (or boxes) headed
// to the door. The manual workflow until the live carrier API
// (Batch 30): build the shipment (parcels + dry ice), buy the label
// by hand, paste tracking in, then walk it through label_purchased →
// shipped → delivered.
function ShipmentsBlock({ order, db }) {
  const shipments = db.shipmentsByOrder.get(order.id) ?? [];
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const create = async () => {
    setErrorMsg(null);
    setPending(true);
    try {
      await db.createShipment(order.id, {});
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't work.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
        Shipments
      </div>
      {shipments.map(s => (
        <ShipmentCard
          key={s.id}
          shipment={s}
          db={db}
          allowedStates={db.shippingSettings.allowedStates}
        />
      ))}
      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <button
        onClick={create}
        disabled={pending || !order.shipTo}
        className={btnGhostCls + " self-start"}
      >
        <Package size={11} className="inline -translate-y-px" />
        {" "}New shipment
      </button>
      {!order.shipTo && (
        <div className="text-[10px] text-faint">
          The order needs a ship-to address first — edit the order and
          add one.
        </div>
      )}
    </div>
  );
}

// One shipment: status header, parcels, label details, and the status
// workflow buttons.
function ShipmentCard({ shipment, db, allowedStates }) {
  const isDraft = shipment.status === "draft";
  const isLabelled = shipment.status === "label_purchased";
  const isShipped = shipment.status === "shipped";
  const editable = isDraft || isLabelled;

  const [expanded, setExpanded] = useState(isDraft);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  // Label fields, editable while draft / label_purchased.
  const [carrier, setCarrier] = useState(shipment.carrier ?? "");
  const [serviceLevel, setServiceLevel] = useState(
    shipment.serviceLevel ?? "");
  const [shipDate, setShipDate] = useState(shipment.shipDate ?? "");
  const [labelCostText, setLabelCostText] = useState(
    shipment.labelCostCents != null
      ? (shipment.labelCostCents / 100).toFixed(2)
      : "");
  const [trackingNumber, setTrackingNumber] = useState(
    shipment.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(
    shipment.trackingUrl ?? "");

  const run = async (fn) => {
    setErrorMsg(null);
    setPending(true);
    try {
      await fn();
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't work.");
    } finally {
      setPending(false);
    }
  };

  // The label-field patch as currently typed.
  const labelPatch = () => ({
    carrier,
    serviceLevel,
    shipDate: shipDate || null,
    labelCostCents: parseDollarsToCents(labelCostText),
    trackingNumber,
    trackingUrl,
  });

  const stateWarn = shipment.shipTo?.state
    && !stateAllowed(shipment.shipTo.state, allowedStates);

  return (
    <div className="bg-bg border border-line">
      {/* header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-transparent border-0 font-[inherit] text-left cursor-pointer"
      >
        {expanded
          ? <ChevronDown size={12} className="shrink-0 text-dim" />
          : <ChevronRight size={12} className="shrink-0 text-dim" />}
        <span className={
          "text-[9px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 border "
          + (shipment.status === "delivered"
            ? "text-resolved border-resolved/40"
            : shipment.status === "cancelled"
              ? "text-faint border-line"
              : "text-fg border-line")
        }>
          {shipmentStatusLabel(shipment.status)}
        </span>
        <span className="flex-1 text-[11px] text-muted truncate">
          {parcelsSummary(shipment.parcels)}
          {shipment.carrier && ` · ${shipment.carrier}`}
          {shipment.trackingNumber && ` · ${shipment.trackingNumber}`}
        </span>
        <span className="text-[10px] text-faint shrink-0">
          {formatDate(shipment.createdAt?.slice(0, 10))}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pl-8 flex flex-col gap-3 border-t border-line pt-2.5">
          {/* ship-to snapshot */}
          <ShipToBlock shipTo={shipment.shipTo} />
          {stateWarn && (
            <div className="text-[11px] text-warn leading-relaxed">
              {shipment.shipTo.state.trim().toUpperCase()} isn&rsquo;t
              on the cold-chain allowed-states list — double-check
              transit time before buying a label.
            </div>
          )}

          {/* parcels */}
          <ParcelsEditor shipment={shipment} db={db} editable={editable} />

          {/* label details */}
          {editable ? (
            <div className="flex flex-col gap-2">
              <div className={labelCls}>Label</div>
              <div className="flex items-end gap-2 flex-wrap">
                <input
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  disabled={pending}
                  placeholder="Carrier (USPS, UPS…)"
                  className={inputCls + " w-36"}
                />
                <input
                  value={serviceLevel}
                  onChange={(e) => setServiceLevel(e.target.value)}
                  disabled={pending}
                  placeholder="Service (Priority…)"
                  className={inputCls + " w-36"}
                />
                <input
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                  disabled={pending}
                  className={inputCls}
                />
                <input
                  value={labelCostText}
                  onChange={(e) => setLabelCostText(e.target.value)}
                  disabled={pending}
                  inputMode="decimal"
                  placeholder="Label cost"
                  className={inputCls + " w-24 text-right"}
                />
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={pending}
                  placeholder="Tracking number"
                  className={inputCls + " w-56"}
                />
                <input
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  disabled={pending}
                  placeholder="Tracking URL (optional)"
                  className={inputCls + " flex-1 min-w-[200px]"}
                />
              </div>
            </div>
          ) : (
            (shipment.carrier || shipment.trackingNumber) && (
              <div className="text-[12px] text-fg">
                {[shipment.carrier, shipment.serviceLevel]
                  .filter(Boolean).join(" · ")}
                {shipment.trackingNumber && (
                  <span className="text-muted">
                    {" "}· {shipment.trackingUrl ? (
                      <a
                        href={shipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline"
                      >
                        {shipment.trackingNumber}
                      </a>
                    ) : shipment.trackingNumber}
                  </span>
                )}
                {shipment.labelCostCents != null && (
                  <span className="text-dim">
                    {" "}· label {fmtCents(shipment.labelCostCents)}
                  </span>
                )}
              </div>
            )
          )}

          {errorMsg && (
            <div className="text-[11px] text-warn">{errorMsg}</div>
          )}

          {/* status workflow */}
          <div className="flex items-center gap-2 flex-wrap">
            {isDraft && (
              <>
                <button
                  onClick={() => run(async () => {
                    await db.updateShipment(shipment.id, labelPatch());
                    await db.setShipmentStatus(
                      shipment.id, "label_purchased");
                  })}
                  disabled={pending}
                  className={btnGhostCls + " text-fg"}
                >
                  Label purchased
                </button>
                <button
                  onClick={() => run(() =>
                    db.updateShipment(shipment.id, labelPatch()))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  Save details
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm("Delete this shipment?")) return;
                    run(() => db.removeShipment(shipment.id));
                  }}
                  disabled={pending}
                  className={btnGhostCls + " text-warn hover:text-warn ml-auto"}
                >
                  <Trash2 size={11} className="inline -translate-y-px" />
                  {" "}Delete
                </button>
              </>
            )}
            {isLabelled && (
              <>
                <button
                  onClick={() => run(async () => {
                    await db.updateShipment(shipment.id, labelPatch());
                    await db.setShipmentStatus(shipment.id, "shipped");
                  })}
                  disabled={pending}
                  className={btnGhostCls + " text-fg"}
                >
                  <Truck size={11} className="inline -translate-y-px" />
                  {" "}Mark shipped
                </button>
                <button
                  onClick={() => run(() =>
                    db.updateShipment(shipment.id, labelPatch()))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  Save details
                </button>
                <button
                  onClick={() => run(() =>
                    db.setShipmentStatus(shipment.id, "draft"))}
                  disabled={pending}
                  className={btnGhostCls}
                >
                  Back to draft
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(
                      "Cancel this shipment? (Void / refund the label "
                      + "with the carrier separately.)")) return;
                    run(() =>
                      db.setShipmentStatus(shipment.id, "cancelled"));
                  }}
                  disabled={pending}
                  className={btnGhostCls + " text-warn hover:text-warn ml-auto"}
                >
                  Cancel shipment
                </button>
              </>
            )}
            {isShipped && (
              <button
                onClick={() => run(() =>
                  db.setShipmentStatus(shipment.id, "delivered"))}
                disabled={pending}
                className={btnGhostCls + " text-fg"}
              >
                <Check size={11} className="inline -translate-y-px" />
                {" "}Mark delivered
              </button>
            )}
            {shipment.status === "delivered" && shipment.deliveredAt && (
              <span className="text-[10px] text-faint">
                Delivered {formatDate(shipment.deliveredAt.slice(0, 10))}
              </span>
            )}
            {shipment.status === "cancelled" && (
              <button
                onClick={() => {
                  if (!window.confirm("Delete this cancelled shipment?")) {
                    return;
                  }
                  run(() => db.removeShipment(shipment.id));
                }}
                disabled={pending}
                className={btnGhostCls + " text-warn hover:text-warn"}
              >
                <Trash2 size={11} className="inline -translate-y-px" />
                {" "}Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// The boxes in a shipment: dims / weight / dry ice per parcel,
// replace-all save (same pattern as order lines). Read-only once the
// shipment is past label_purchased.
function ParcelsEditor({ shipment, db, editable }) {
  // Drafts mirror shipment.parcels until edited.
  const [drafts, setDrafts] = useState(() =>
    shipment.parcels.map(parcelToDraft));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const patch = (i, key, v) => {
    setDirty(true);
    setDrafts(prev => prev.map((d, j) =>
      j === i ? { ...d, [key]: v } : d));
  };

  const save = async () => {
    setErrorMsg(null);
    setPending(true);
    try {
      await db.setParcels(shipment.id, drafts.map(draftToParcel));
      setDirty(false);
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't save.");
    } finally {
      setPending(false);
    }
  };

  if (!editable) {
    return shipment.parcels.length > 0 ? (
      <div className="flex flex-col gap-1">
        <div className={labelCls}>Parcels</div>
        {shipment.parcels.map((p, i) => (
          <div key={p.id ?? i} className="text-[12px] text-fg">
            {parcelLabel(p)}
          </div>
        ))}
      </div>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={labelCls}>Parcels</div>
      {drafts.map((d, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <input
              value={d.lengthIn}
              onChange={(e) => patch(i, "lengthIn", e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="L"
              className={inputCls + " w-14 text-center"}
            />
            <span className="text-[10px] text-faint">×</span>
            <input
              value={d.widthIn}
              onChange={(e) => patch(i, "widthIn", e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="W"
              className={inputCls + " w-14 text-center"}
            />
            <span className="text-[10px] text-faint">×</span>
            <input
              value={d.heightIn}
              onChange={(e) => patch(i, "heightIn", e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="H"
              className={inputCls + " w-14 text-center"}
            />
            <span className="text-[10px] text-faint">in</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={d.weightLb}
              onChange={(e) => patch(i, "weightLb", e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="Weight"
              className={inputCls + " w-20 text-right"}
            />
            <span className="text-[10px] text-faint">lb</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              value={d.dryIceLb}
              onChange={(e) => patch(i, "dryIceLb", e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="Dry ice"
              className={inputCls + " w-20 text-right"}
            />
            <span className="text-[10px] text-faint">lb dry ice</span>
          </div>
          <button
            onClick={() => {
              setDirty(true);
              setDrafts(prev => prev.filter((_, j) => j !== i));
            }}
            disabled={pending}
            aria-label="Remove parcel"
            className="bg-transparent border border-line text-dim hover:text-warn font-[inherit] w-7 h-7 cursor-pointer flex items-center justify-center disabled:opacity-40"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setDirty(true);
            setDrafts(prev => [...prev, {
              lengthIn: "", widthIn: "", heightIn: "", weightLb: "",
              dryIceLb: "",
            }]);
          }}
          disabled={pending}
          className={btnGhostCls}
        >
          <Plus size={11} className="inline -translate-y-px" /> Add box
        </button>
        {dirty && (
          <button
            onClick={save}
            disabled={pending}
            className={btnGhostCls + " text-fg"}
          >
            {pending ? "Saving…" : "Save parcels"}
          </button>
        )}
      </div>
    </div>
  );
}

function parcelToDraft(p) {
  const s = (v) => v == null ? "" : String(v);
  return {
    lengthIn: s(p.lengthIn), widthIn: s(p.widthIn),
    heightIn: s(p.heightIn), weightLb: s(p.weightLb),
    dryIceLb: s(p.dryIceLb),
  };
}

function draftToParcel(d) {
  const n = (v) => {
    const x = Number(v);
    return v !== "" && Number.isFinite(x) && x > 0 ? x : null;
  };
  return {
    lengthIn: n(d.lengthIn), widthIn: n(d.widthIn),
    heightIn: n(d.heightIn), weightLb: n(d.weightLb),
    // Dry ice can legitimately be 0; only blank means null.
    dryIceLb: d.dryIceLb === "" ? null : Math.max(0, Number(d.dryIceLb) || 0),
  };
}

function parcelLabel(p) {
  const dims = [p.lengthIn, p.widthIn, p.heightIn].every(v => v != null)
    ? `${p.lengthIn}×${p.widthIn}×${p.heightIn} in`
    : null;
  return [
    dims,
    p.weightLb != null ? `${p.weightLb} lb` : null,
    p.dryIceLb ? `${p.dryIceLb} lb dry ice` : null,
  ].filter(Boolean).join(" · ") || "box";
}

// ── shipping settings (Batch 29.3) ─────────────────────────────────────

// The cold-chain allowlist: which states frozen product may ship to
// (transit time caps how far dry ice lasts). Comma-separated state
// codes; empty = not configured, no warnings anywhere.
function ShippingSettingsPanel({ db, onClose }) {
  const settings = db.shippingSettings;
  const [statesText, setStatesText] = useState(
    settings.allowedStates.join(", "));
  const [notes, setNotes] = useState(settings.notes ?? "");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const save = async () => {
    setErrorMsg(null);
    setPending(true);
    try {
      const allowedStates = statesText
        .split(/[,\s]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
      await db.updateShippingSettings({ allowedStates, notes });
      onClose();
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't save.");
      setPending(false);
    }
  };

  return (
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
        Shipping settings
      </div>
      <div className="text-[11px] text-muted leading-relaxed max-w-[600px]">
        Frozen product ships with dry ice, so transit time caps how far
        it can go. Orders and shipments headed to a state not listed
        here get a warning (never a block). Leave empty to turn the
        check off.
      </div>
      <div>
        <div className={labelCls}>Allowed states</div>
        <input
          value={statesText}
          onChange={(e) => setStatesText(e.target.value)}
          disabled={pending}
          placeholder="RI, MA, CT, NY, NH, VT, ME"
          className={inputCls + " w-full max-w-[480px]"}
        />
      </div>
      <div>
        <div className={labelCls}>Notes</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          placeholder="Optional — carrier notes, dry-ice supplier…"
          className={inputCls + " w-full max-w-[480px]"}
        />
      </div>
      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={pending} className={btnAccentCls}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        <button onClick={onClose} disabled={pending} className={btnGhostCls}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// The expanded order's lines, read-only.
function LineList({ order, catalog }) {
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-1.5">
        Lines
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-1">
        {order.lines.map(line => {
          const product = catalog.productsById.get(line.productKindId);
          const bracket = (product?.sizeBrackets ?? [])
            .find(b => b.id === line.bracketId) ?? null;
          return (
            <li
              key={line.id}
              className="text-[12px] text-fg flex items-baseline gap-2"
            >
              <span className="flex-1 min-w-0">
                {product ? skuLabel(product, bracket) : line.productKindId}
                <span className="text-dim"> × {line.quantity}</span>
                {line.notes && (
                  <span className="text-faint"> — {line.notes}</span>
                )}
              </span>
              <span className="tabular-nums">
                {fmtCents(line.totalCents)}
              </span>
            </li>
          );
        })}
        {order.shippingCents != null && (
          <li className="text-[12px] text-muted flex items-baseline gap-2">
            <span className="flex-1">Shipping</span>
            <span className="tabular-nums">
              {fmtCents(order.shippingCents)}
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

function ShipToBlock({ shipTo }) {
  const lines = formatAddress(shipTo);
  if (!lines) return null;
  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-1.5">
        Ship to
      </div>
      <div className="text-[12px] text-fg leading-relaxed">
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

// ── the order form (create + edit) ─────────────────────────────────────

// Line drafts: { skuIdx: string, qty: string, totalText: string|null }.
// totalText is null until hand-edited; the rendered value falls back to
// current price × qty so price changes flow through untouched lines.
function draftFromLine(line, skus) {
  const idx = skus.findIndex(s =>
    s.product.id === line.productKindId
    && (s.bracket?.id ?? null) === (line.bracketId ?? null));
  return {
    skuIdx: idx >= 0 ? String(idx) : "",
    qty: String(line.quantity),
    totalText: (line.totalCents / 100).toFixed(2),
  };
}

function OrderForm({
  order = null, customers, skus, priceMap, onHand, allowedStates = [],
  onSave, onCancel,
}) {
  // Customer: a real customer id, or "" for walk-in free text.
  const [customerId, setCustomerId] = useState(order?.customerId ?? "");
  const [customerName, setCustomerName] = useState(
    order?.customerName ?? "");
  const [fulfillmentMethod, setFulfillmentMethod] = useState(
    order?.fulfillmentMethod ?? "pickup");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [drafts, setDrafts] = useState(() =>
    order
      ? order.lines.map(l => draftFromLine(l, skus))
      : [{ skuIdx: "", qty: "1", totalText: null }]);
  // Shipping (29.3): ship-to address, the charge passed to the
  // customer, and whether to save the address back to the customer
  // record as their default. Merge field-by-field so a stored null
  // never replaces the empty string the inputs expect.
  const [shipTo, setShipTo] = useState(() => {
    const merged = { ...EMPTY_ADDRESS };
    for (const k of Object.keys(EMPTY_ADDRESS)) {
      const v = order?.shipTo?.[k];
      if (v != null) merged[k] = String(v);
    }
    return merged;
  });
  const [shippingText, setShippingText] = useState(
    order?.shippingCents != null
      ? (order.shippingCents / 100).toFixed(2)
      : "");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const isShipping = fulfillmentMethod === "shipping";
  const shippingCents = isShipping
    ? parseDollarsToCents(shippingText)
    : null;

  // Picking a customer prefills a blank ship-to from their default
  // address; the order keeps its own snapshot from there.
  const pickCustomer = (id) => {
    setCustomerId(id);
    const customer = customers.find(c => c.id === id);
    if (customer?.address && !cleanAddress(shipTo)) {
      setShipTo({ ...EMPTY_ADDRESS, ...customer.address });
    }
  };

  const suggestedCents = (draft) => {
    const sku = skus[Number(draft.skuIdx)];
    const qty = Number(draft.qty);
    if (!sku || !Number.isFinite(qty) || qty <= 0) return null;
    const price = priceMap.get(
      skuKey(sku.product.id, sku.bracket?.id ?? null))?.priceCents
      ?? priceMap.get(skuKey(sku.product.id, null))?.priceCents;
    if (price == null) return null;
    return Math.round(price * qty);
  };

  const draftCents = (draft) =>
    draft.totalText != null
      ? parseDollarsToCents(draft.totalText)
      : suggestedCents(draft);

  const patchDraft = (i, patch) => {
    setDrafts(prev => prev.map((d, j) => j === i ? { ...d, ...patch } : d));
  };

  // Changing the product or quantity: if the catalog can price the
  // resulting line, drop any manual total so it re-derives (qty × unit
  // price). If it can't (no catalog price — the common case here), keep
  // whatever total was already typed so an edit never silently blanks a
  // price the user set and breaks the save.
  const patchLineKeepingPrice = (i, patch) => {
    setDrafts(prev => prev.map((d, j) => {
      if (j !== i) return d;
      const next = { ...d, ...patch };
      return suggestedCents(next) != null
        ? { ...next, totalText: null }
        : next;
    }));
  };

  const validLines = drafts
    .map(d => {
      const sku = skus[Number(d.skuIdx)];
      const qty = Number(d.qty);
      if (!sku || !Number.isFinite(qty) || qty <= 0) return null;
      return {
        productKindId: sku.product.id,
        bracketId: sku.bracket?.id ?? null,
        quantity: qty,
        unitPriceCents: priceMap.get(
          skuKey(sku.product.id, sku.bracket?.id ?? null))?.priceCents
          ?? null,
        totalCents: draftCents(d),
      };
    })
    .filter(Boolean);
  const everyLinePriced = validLines.length > 0
    && validLines.every(l => l.totalCents != null);
  const totalCents = orderTotalCents(validLines, shippingCents);

  const submit = async () => {
    setErrorMsg(null);
    if (!customerId && !customerName.trim()) {
      setErrorMsg("Pick a customer or type a name.");
      return;
    }
    if (!everyLinePriced) {
      setErrorMsg("Every line needs a product, a quantity, and a price.");
      return;
    }
    setPending(true);
    try {
      await onSave({
        customerId: customerId || null,
        customerName: customerId ? null : customerName,
        fulfillmentMethod,
        notes,
        lines: validLines,
        shipTo: isShipping ? cleanAddress(shipTo) : null,
        shippingCents,
        saveAddressAsDefault: saveAsDefault,
      });
    } catch (e) {
      setErrorMsg(e?.message ?? "That didn't save.");
      setPending(false);
    }
  };

  return (
    <div className="bg-surface border border-accent p-4 flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
        {order ? "Edit order" : "New order"}
      </div>

      {/* customer + fulfillment */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="min-w-[220px]">
          <div className={labelCls}>Customer</div>
          <select
            value={customerId}
            onChange={(e) => pickCustomer(e.target.value)}
            disabled={pending}
            className={inputCls + " w-full"}
          >
            <option value="">— walk-in / no record —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        </div>
        {!customerId && (
          <div className="min-w-[180px]">
            <div className={labelCls}>Name</div>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={pending}
              placeholder="Who is this order for?"
              className={inputCls + " w-full"}
            />
          </div>
        )}
        <div>
          <div className={labelCls}>Fulfillment</div>
          <select
            value={fulfillmentMethod}
            onChange={(e) => setFulfillmentMethod(e.target.value)}
            disabled={pending}
            className={inputCls}
          >
            {FULFILLMENT_METHODS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ship-to + shipping charge (29.3) */}
      {isShipping && (
        <div className="flex flex-col gap-2 border-l-2 border-line pl-3">
          <div className={labelCls}>Ship to</div>
          <AddressFields
            value={shipTo}
            onChange={setShipTo}
            disabled={pending}
          />
          {shipTo.state.trim()
            && !stateAllowed(shipTo.state, allowedStates) && (
            <div className="text-[11px] text-warn leading-relaxed">
              {shipTo.state.trim().toUpperCase()} isn&rsquo;t on the
              cold-chain allowed-states list
              ({allowedStates.join(", ")}). The order can still be
              saved — check transit time before shipping frozen
              product this far.
            </div>
          )}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <div className={labelCls}>Shipping charge</div>
              <input
                value={shippingText}
                onChange={(e) => setShippingText(e.target.value)}
                disabled={pending}
                inputMode="decimal"
                placeholder="0.00"
                className={inputCls + " w-24 text-right"}
              />
            </div>
            {customerId && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  disabled={pending}
                />
                Save as this customer&rsquo;s default address
              </label>
            )}
          </div>
        </div>
      )}

      {/* lines */}
      <div className="flex flex-col gap-2">
        <div className={labelCls}>Lines</div>
        {drafts.map((draft, i) => {
          const sku = skus[Number(draft.skuIdx)];
          const have = sku
            ? onHand.get(skuKey(sku.product.id, sku.bracket?.id ?? null))
            : null;
          const cents = draftCents(draft);
          return (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <select
                value={draft.skuIdx}
                onChange={(e) => patchLineKeepingPrice(i, {
                  skuIdx: e.target.value,
                })}
                disabled={pending}
                className={inputCls + " min-w-[220px] flex-1"}
              >
                <option value="">— pick a product —</option>
                {skus.map((s, j) => (
                  <option key={j} value={j}>
                    {skuLabel(s.product, s.bracket)}
                  </option>
                ))}
              </select>
              <input
                value={draft.qty}
                onChange={(e) => patchLineKeepingPrice(i, {
                  qty: e.target.value,
                })}
                disabled={pending}
                inputMode="decimal"
                placeholder="qty"
                className={inputCls + " w-16 text-center"}
              />
              <input
                value={draft.totalText != null
                  ? draft.totalText
                  : cents != null ? (cents / 100).toFixed(2) : ""}
                onChange={(e) => patchDraft(i, { totalText: e.target.value })}
                disabled={pending}
                inputMode="decimal"
                placeholder="0.00"
                className={inputCls + " w-24 text-right"}
              />
              <button
                onClick={() => setDrafts(prev =>
                  prev.filter((_, j) => j !== i))}
                disabled={pending || drafts.length === 1}
                aria-label="Remove line"
                className="bg-transparent border border-line text-dim hover:text-warn font-[inherit] w-8 h-8 cursor-pointer flex items-center justify-center disabled:opacity-40"
              >
                <X size={13} />
              </button>
              {sku && have != null && (
                <span className={
                  "text-[10px] w-full sm:w-auto "
                  + (have <= 0 ? "text-warn" : "text-faint")
                }>
                  {have} on hand
                </span>
              )}
            </div>
          );
        })}
        <button
          onClick={() => setDrafts(prev =>
            [...prev, { skuIdx: "", qty: "1", totalText: null }])}
          disabled={pending}
          className={btnGhostCls + " self-start"}
        >
          <Plus size={11} className="inline -translate-y-px" /> Add line
        </button>
      </div>

      {/* notes + total */}
      <div>
        <div className={labelCls}>Notes</div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          placeholder="Optional — pickup day, special requests"
          className={inputCls + " w-full"}
        />
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-2.5">
        <span className="text-[11px] text-dim uppercase tracking-[0.12em]">
          Total
        </span>
        <span className="font-heading text-[22px] font-semibold text-fg">
          {fmtCents(totalCents)}
        </span>
      </div>

      {errorMsg && (
        <div className="text-[11px] text-warn">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className={btnAccentCls}
        >
          {pending
            ? "Saving…"
            : order ? "Save changes" : "Create order"}
        </button>
        <button onClick={onCancel} disabled={pending} className={btnGhostCls}>
          Cancel
        </button>
      </div>
    </div>
  );
}
