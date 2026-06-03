import { useMemo, useState } from "react";
import {
  Ban, Banknote, Check, ChevronDown, ChevronRight, PackageCheck,
  Pencil, Plus, Receipt, RotateCcw, Trash2, Truck, X,
} from "lucide-react";
import { useOrders } from "../lib/data/useOrders.js";
import { useCustomers } from "../lib/data/useCustomers.js";
import { useProducts } from "../lib/data/useProducts.js";
import { useInventory } from "../lib/data/useInventory.js";
import {
  FULFILLMENT_METHODS, ORDER_STATUSES, PAYMENT_METHODS, formatAddress,
  fulfillmentLabel, orderCustomerName, orderTotalCents,
  paymentMethodLabel,
} from "../lib/orders.js";
import {
  currentPriceMap, expandSkus, fmtCents, parseDollarsToCents, skuKey,
  skuLabel,
} from "../lib/productCatalog.js";
import { formatDate } from "../lib/dates.js";

// The Orders page (Batches 29.1–29.2) — customer orders against the
// catalog, from promise to fulfillment.
//
// An order is a promise: lines, a customer, a fulfillment method, and
// a total. Nothing touches product_sales or inventory until the order
// is fulfilled — fulfilling writes one sale row per line and draws
// the freezer counts down FIFO (same path as the POS). Lifecycle:
// open → ready → fulfilled, plus cancelled; open orders can be edited
// or deleted freely, fulfilled orders are frozen. Payment is a paid
// stamp + method, capturable at any point. Shipments are 29.3.
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
        <button
          onClick={() => setCreating(c => !c)}
          className={btnAccentCls}
        >
          <Plus size={13} /> New order
        </button>
      </div>

      {creating && (
        <OrderForm
          customers={crm.customers}
          skus={skus}
          priceMap={priceMap}
          onHand={inv.onHand}
          onSave={async (fields) => {
            await db.createOrder(fields);
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
            customersById={customersById}
            customers={crm.customers}
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
  status, orders, db, customersById, customers, catalog, skus, priceMap,
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
              customersById={customersById}
              customers={customers}
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
  order, db, customersById, customers, catalog, skus, priceMap, inv,
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
          customers={customers}
          skus={skus}
          priceMap={priceMap}
          onHand={inv.onHand}
          onSave={async (fields) => {
            await db.updateOrder(order.id, {
              customerId: fields.customerId,
              customerName: fields.customerName,
              fulfillmentMethod: fields.fulfillmentMethod,
              notes: fields.notes,
            });
            await db.setLines(order.id, fields.lines);
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
  order = null, customers, skus, priceMap, onHand, onSave, onCancel,
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
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

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
  const totalCents = orderTotalCents(validLines, order?.shippingCents);

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
            onChange={(e) => setCustomerId(e.target.value)}
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
                onChange={(e) => patchDraft(i, {
                  skuIdx: e.target.value, totalText: null,
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
                onChange={(e) => patchDraft(i, {
                  qty: e.target.value, totalText: null,
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
