import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "./supabase.js";
import { orderTotalCents, saleChannelForOrder } from "../orders.js";
import { skuLabel } from "../productCatalog.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Orders data hook (Batch 29) — orders, their lines, their shipments,
// and the shipping settings singleton.
//
//   useOrders() → {
//     orders,           // shaped orders, lines attached, newest first
//     ordersById,
//     byStatus,         // { open: [], ready: [], fulfilled: [],
//                       //   cancelled: [] }
//     shipmentsByOrder, // Map<orderId, shipments with parcels attached>
//     shippingSettings, // { allowedStates: [], notes } (29.3)
//     loading, error,
//     createOrder({ customerId, customerName, fulfillmentMethod,
//                   shipTo, shippingCents, notes, lines }),
//     updateOrder(id, patch),    // open orders only (caller enforces)
//     setLines(orderId, lines),  // replace-all line write
//     removeOrder(id),           // hard delete (mistakes only)
//     markReady(id),             // open → ready          (29.2)
//     reopenOrder(id),           // ready/cancelled → open (29.2)
//     cancelOrder(id),           // open/ready → cancelled (29.2)
//     setPaid(id, { method }),   // payment capture        (29.2)
//     clearPaid(id),
//     fulfillOrder(id, { soldOn, recordSale, allocateToSale,
//                        productsById, paymentMethod }),
//                                // → { shortfalls }       (29.2)
//     createShipment(orderId, { shipTo, notes }),         // (29.3)
//     updateShipment(id, patch),
//     setShipmentStatus(id, status),
//     setParcels(shipmentId, parcels),  // replace-all
//     removeShipment(id),
//     updateShippingSettings({ allowedStates, notes }),
//   }

const ORDER_COLS =
  "id, customer_id, customer_name, status, total_cents, " +
  "shipping_cents, notes, placed_at, ready_at, fulfilled_at, " +
  "cancelled_at, paid_at, payment_method, fulfillment_method, " +
  "ship_to, created_by, updated_at";
const LINE_COLS =
  "id, order_id, product_kind_id, bracket_id, quantity, " +
  "unit_price_cents, total_cents, notes, sort_order, sale_id, " +
  "created_at";
const SHIPMENT_COLS =
  "id, order_id, status, ship_to, carrier, service_level, ship_date, " +
  "label_cost_cents, tracking_number, tracking_url, delivered_at, " +
  "notes, created_by, created_at, updated_at";
const PARCEL_COLS =
  "id, shipment_id, length_in, width_in, height_in, weight_lb, " +
  "dry_ice_lb, notes, created_at";
const SETTINGS_COLS = "id, allowed_states, notes, updated_at";

const TABLES = [
  "orders", "order_lines", "shipments", "shipment_parcels",
  "shipping_settings",
];

function shapeOrder(r) {
  return {
    id: r.id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    status: r.status,
    totalCents: r.total_cents,
    shippingCents: r.shipping_cents,
    notes: r.notes,
    placedAt: r.placed_at,
    readyAt: r.ready_at,
    fulfilledAt: r.fulfilled_at,
    cancelledAt: r.cancelled_at,
    paidAt: r.paid_at,
    paymentMethod: r.payment_method,
    fulfillmentMethod: r.fulfillment_method,
    shipTo: r.ship_to,
    createdBy: r.created_by,
    updatedAt: r.updated_at,
    lines: [],
  };
}

function shapeLine(r) {
  return {
    id: r.id,
    orderId: r.order_id,
    productKindId: r.product_kind_id,
    bracketId: r.bracket_id,
    quantity: Number(r.quantity),
    unitPriceCents: r.unit_price_cents,
    totalCents: r.total_cents,
    notes: r.notes,
    sortOrder: r.sort_order ?? 0,
    saleId: r.sale_id,
    createdAt: r.created_at,
  };
}

function shapeShipment(r) {
  return {
    id: r.id,
    orderId: r.order_id,
    status: r.status,
    shipTo: r.ship_to,
    carrier: r.carrier,
    serviceLevel: r.service_level,
    shipDate: r.ship_date,
    labelCostCents: r.label_cost_cents,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,
    deliveredAt: r.delivered_at,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    parcels: [],
  };
}

function shapeParcel(r) {
  return {
    id: r.id,
    shipmentId: r.shipment_id,
    lengthIn: r.length_in == null ? null : Number(r.length_in),
    widthIn: r.width_in == null ? null : Number(r.width_in),
    heightIn: r.height_in == null ? null : Number(r.height_in),
    weightLb: r.weight_lb == null ? null : Number(r.weight_lb),
    dryIceLb: r.dry_ice_lb == null ? null : Number(r.dry_ice_lb),
    notes: r.notes,
    createdAt: r.created_at,
  };
}

// UI line drafts → order_lines rows.
function lineRows(orderId, lines) {
  return (lines ?? []).map((l, i) => ({
    order_id: orderId,
    product_kind_id: l.productKindId,
    bracket_id: l.bracketId ?? null,
    quantity: l.quantity,
    unit_price_cents: l.unitPriceCents ?? null,
    total_cents: l.totalCents ?? 0,
    notes: (l.notes ?? "").trim() || null,
    sort_order: i,
  }));
}

export function useOrders() {
  const instanceId = useId();
  const userEmail = useCurrentUserEmail();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [orderRes, lineRes, shipRes, parcelRes, settingsRes] =
      await Promise.all([
        supabase.from("orders").select(ORDER_COLS)
          .order("placed_at", { ascending: false }),
        supabase.from("order_lines").select(LINE_COLS)
          .order("sort_order"),
        supabase.from("shipments").select(SHIPMENT_COLS)
          .order("created_at", { ascending: false }),
        supabase.from("shipment_parcels").select(PARCEL_COLS)
          .order("created_at"),
        supabase.from("shipping_settings").select(SETTINGS_COLS)
          .maybeSingle(),
      ]);
    const failed = [orderRes, lineRes, shipRes, parcelRes, settingsRes]
      .find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      orders: (orderRes.data ?? []).map(shapeOrder),
      lines: (lineRes.data ?? []).map(shapeLine),
      shipments: (shipRes.data ?? []).map(shapeShipment),
      parcels: (parcelRes.data ?? []).map(shapeParcel),
      settings: {
        allowedStates: settingsRes.data?.allowed_states ?? [],
        notes: settingsRes.data?.notes ?? null,
      },
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; fetchAll(); }, 80);
    };
    let channel = realtimeChannel(`orders:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  // ── derived shapes ─────────────────────────────────────────────────
  const orders = useMemo(() => {
    const linesByOrder = new Map();
    for (const line of tables?.lines ?? []) {
      if (!linesByOrder.has(line.orderId)) {
        linesByOrder.set(line.orderId, []);
      }
      linesByOrder.get(line.orderId).push(line);
    }
    return (tables?.orders ?? []).map(o => ({
      ...o,
      lines: linesByOrder.get(o.id) ?? [],
    }));
  }, [tables]);

  const ordersById = useMemo(
    () => new Map(orders.map(o => [o.id, o])),
    [orders]
  );

  const byStatus = useMemo(() => {
    const groups = { open: [], ready: [], fulfilled: [], cancelled: [] };
    for (const o of orders) (groups[o.status] ?? groups.open).push(o);
    return groups;
  }, [orders]);

  const shipmentsByOrder = useMemo(() => {
    const parcelsByShipment = new Map();
    for (const p of tables?.parcels ?? []) {
      if (!parcelsByShipment.has(p.shipmentId)) {
        parcelsByShipment.set(p.shipmentId, []);
      }
      parcelsByShipment.get(p.shipmentId).push(p);
    }
    const m = new Map();
    for (const s of tables?.shipments ?? []) {
      if (!m.has(s.orderId)) m.set(s.orderId, []);
      m.get(s.orderId).push({
        ...s,
        parcels: parcelsByShipment.get(s.id) ?? [],
      });
    }
    return m;
  }, [tables]);

  // ── mutations ──────────────────────────────────────────────────────

  // Create an order with its lines in one go. total_cents is the
  // denormalized sum (lines + shipping) so the sidebar count / Overview
  // card never need the lines table.
  const createOrder = useCallback(async ({
    customerId = null, customerName = null, fulfillmentMethod = "pickup",
    shipTo = null, shippingCents = null, notes = null, lines = [],
  }) => {
    if (!customerId && !(customerName ?? "").trim()) {
      throw new Error("Pick a customer or type a name.");
    }
    if (lines.length === 0) {
      throw new Error("An order needs at least one line.");
    }
    if (lines.some(l => l.totalCents == null)) {
      throw new Error("Every line needs a price.");
    }
    const { data: created, error: insErr } = await supabase
      .from("orders")
      .insert({
        customer_id: customerId,
        customer_name: (customerName ?? "").trim() || null,
        status: "open",
        total_cents: orderTotalCents(lines, shippingCents),
        shipping_cents: shippingCents,
        notes: (notes ?? "").trim() || null,
        fulfillment_method: fulfillmentMethod,
        ship_to: shipTo,
        created_by: userEmail,
      })
      .select(ORDER_COLS)
      .single();
    if (insErr) throw insErr;
    const { error: lineErr } = await supabase.from("order_lines")
      .insert(lineRows(created.id, lines));
    if (lineErr) throw lineErr;
    await fetchAll();
    return shapeOrder(created);
  }, [userEmail, fetchAll]);

  // Patch order header fields. Callers only offer this on open orders;
  // 29.2's lifecycle transitions get their own mutations.
  const updateOrder = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("customerId" in patch) dbPatch.customer_id = patch.customerId;
    if ("customerName" in patch) {
      dbPatch.customer_name = patch.customerName?.trim() || null;
    }
    if ("notes" in patch) dbPatch.notes = patch.notes?.trim() || null;
    if ("fulfillmentMethod" in patch) {
      dbPatch.fulfillment_method = patch.fulfillmentMethod;
    }
    if ("shipTo" in patch) dbPatch.ship_to = patch.shipTo;
    if ("shippingCents" in patch) {
      dbPatch.shipping_cents = patch.shippingCents;
    }
    if ("totalCents" in patch) dbPatch.total_cents = patch.totalCents;
    const { error: err } = await supabase.from("orders")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Replace an order's lines wholesale (the edit form saves the whole
  // set), and keep the denormalized total in sync.
  const setLines = useCallback(async (orderId, lines) => {
    const order = ordersById.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (lines.length === 0) {
      throw new Error("An order needs at least one line.");
    }
    if (lines.some(l => l.totalCents == null)) {
      throw new Error("Every line needs a price.");
    }
    const { error: delErr } = await supabase.from("order_lines")
      .delete().eq("order_id", orderId);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase.from("order_lines")
      .insert(lineRows(orderId, lines));
    if (insErr) throw insErr;
    const { error: upErr } = await supabase.from("orders")
      .update({
        total_cents: orderTotalCents(lines, order.shippingCents),
      })
      .eq("id", orderId);
    if (upErr) throw upErr;
    await fetchAll();
  }, [ordersById, fetchAll]);

  // Hard delete — for mistakes only (lines cascade). Fulfilled orders
  // should never be deleted: their lines point at product_sales rows.
  const removeOrder = useCallback(async (id) => {
    const { error: err } = await supabase.from("orders")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── lifecycle (Batch 29.2) ─────────────────────────────────────────
  // open → ready → fulfilled, plus cancelled. Each transition stamps
  // its timestamp column; moving back to open clears them. Fulfillment
  // is below (it also writes sales + inventory).

  const markReady = useCallback(async (id) => {
    const { error: err } = await supabase.from("orders")
      .update({ status: "ready", ready_at: new Date().toISOString() })
      .eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Ready / cancelled → back to open. Clears whichever timestamp the
  // departed status had stamped.
  const reopenOrder = useCallback(async (id) => {
    const { error: err } = await supabase.from("orders")
      .update({ status: "open", ready_at: null, cancelled_at: null })
      .eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Cancelling an open/ready order costs nothing — no sales were
  // written, no inventory moved. Fulfilled orders can't be cancelled.
  const cancelOrder = useCallback(async (id) => {
    const { error: err } = await supabase.from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── payment (Batch 29.2) ───────────────────────────────────────────
  // A paid stamp + method on the order; live payment APIs are
  // Batch 30. An order can be paid at any point in its life (deposit
  // up front, cash at pickup, an invoice settled later).

  const setPaid = useCallback(async (id, { method }) => {
    if (!method) throw new Error("Pick a payment method.");
    const { error: err } = await supabase.from("orders")
      .update({
        paid_at: new Date().toISOString(),
        payment_method: method,
      })
      .eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const clearPaid = useCallback(async (id) => {
    const { error: err } = await supabase.from("orders")
      .update({ paid_at: null, payment_method: null })
      .eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── fulfillment (Batch 29.2) ───────────────────────────────────────
  // The moment an order becomes real money and real freezer movement:
  // every line becomes a product_sales row (channel derived from the
  // fulfillment method, order_id pointing back), inventory draws down
  // FIFO (bundles expand to their components — same path as the POS),
  // and the order is stamped fulfilled.
  //
  // recordSale / allocateToSale / productsById are injected from
  // useProducts / useInventory so the data hooks stay independent.
  //
  // Failure tolerance: each line's sale_id is written immediately
  // after its sale row lands, and lines that already carry a sale_id
  // are skipped — so re-running fulfillOrder after a partial failure
  // never double-records a sale. Inventory shortfalls warn, never
  // block: the handoff already happened in the real world.
  const fulfillOrder = useCallback(async (orderId, {
    soldOn, recordSale, allocateToSale, productsById,
    paymentMethod = null,
  }) => {
    const order = ordersById.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === "fulfilled" || order.status === "cancelled") {
      throw new Error("Only open or ready orders can be fulfilled.");
    }
    const channel = saleChannelForOrder(order.fulfillmentMethod);
    const shortfalls = [];
    for (const line of order.lines) {
      if (line.saleId) continue; // already recorded (partial retry)
      const product = productsById?.get(line.productKindId);
      const bracket = (product?.sizeBrackets ?? [])
        .find(b => b.id === line.bracketId) ?? null;
      const sale = await recordSale({
        soldOn,
        productKindId: line.productKindId,
        bracketId: line.bracketId,
        quantity: line.quantity,
        totalCents: line.totalCents,
        channel,
        notes: line.notes,
        orderId: order.id,
      });
      const { error: linkErr } = await supabase.from("order_lines")
        .update({ sale_id: sale.id }).eq("id", line.id);
      if (linkErr) throw linkErr;
      // Inventory draw-down: bundles expand to components; plain SKUs
      // allocate directly.
      const targets = product?.isBundle
        ? (product.bundleContents ?? []).map(c => ({
            productKindId: c.productKindId,
            bracketId: c.bracketId ?? null,
            quantity: (c.quantity || 1) * line.quantity,
            label: `${product.name} → ${c.productKindId}`,
          }))
        : [{
            productKindId: line.productKindId,
            bracketId: line.bracketId,
            quantity: line.quantity,
            label: product
              ? skuLabel(product, bracket)
              : line.productKindId,
          }];
      for (const t of targets) {
        const { short } = await allocateToSale({
          saleId: sale.id,
          productKindId: t.productKindId,
          bracketId: t.bracketId,
          quantity: t.quantity,
        });
        if (short > 0) shortfalls.push({ label: t.label, short });
      }
    }
    // Stamp the order fulfilled — and paid, if payment was captured at
    // handoff and the order wasn't already paid.
    const patch = {
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    };
    if (paymentMethod && !order.paidAt) {
      patch.paid_at = new Date().toISOString();
      patch.payment_method = paymentMethod;
    }
    const { error: upErr } = await supabase.from("orders")
      .update(patch).eq("id", orderId);
    if (upErr) throw upErr;
    await fetchAll();
    return { shortfalls };
  }, [ordersById, fetchAll]);

  // ── shipments (Batch 29.3) ─────────────────────────────────────────
  // One shipment per physical handoff to a carrier. The order's
  // ship_to is snapshotted onto the shipment at creation (the order's
  // copy can keep being edited; the shipment's copy is what the label
  // gets bought for). Status workflow: draft → label_purchased →
  // shipped → delivered, plus cancelled. Labels are bought by hand
  // (PirateShip/Shippo) until the Batch 30 live API.

  const createShipment = useCallback(async (orderId, {
    shipTo = null, notes = null,
  } = {}) => {
    const order = ordersById.get(orderId);
    if (!order) throw new Error("Order not found.");
    const snapshot = shipTo ?? order.shipTo;
    if (!snapshot) {
      throw new Error("The order needs a ship-to address first.");
    }
    const { data: created, error: err } = await supabase
      .from("shipments")
      .insert({
        order_id: orderId,
        status: "draft",
        ship_to: snapshot,
        notes: (notes ?? "").trim() || null,
        created_by: userEmail,
      })
      .select(SHIPMENT_COLS)
      .single();
    if (err) throw err;
    await fetchAll();
    return shapeShipment(created);
  }, [ordersById, userEmail, fetchAll]);

  // Patch shipment fields — label details, tracking, ship-to, notes.
  const updateShipment = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("shipTo" in patch) dbPatch.ship_to = patch.shipTo;
    if ("carrier" in patch) {
      dbPatch.carrier = patch.carrier?.trim() || null;
    }
    if ("serviceLevel" in patch) {
      dbPatch.service_level = patch.serviceLevel?.trim() || null;
    }
    if ("shipDate" in patch) dbPatch.ship_date = patch.shipDate || null;
    if ("labelCostCents" in patch) {
      dbPatch.label_cost_cents = patch.labelCostCents;
    }
    if ("trackingNumber" in patch) {
      dbPatch.tracking_number = patch.trackingNumber?.trim() || null;
    }
    if ("trackingUrl" in patch) {
      dbPatch.tracking_url = patch.trackingUrl?.trim() || null;
    }
    if ("notes" in patch) dbPatch.notes = patch.notes?.trim() || null;
    const { error: err } = await supabase.from("shipments")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Status transitions. Delivered stamps delivered_at; leaving
  // delivered clears it.
  const setShipmentStatus = useCallback(async (id, status) => {
    const patch = { status };
    patch.delivered_at = status === "delivered"
      ? new Date().toISOString()
      : null;
    const { error: err } = await supabase.from("shipments")
      .update(patch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Replace a shipment's parcels wholesale (the parcel editor saves
  // the whole set, same pattern as order lines).
  const setParcels = useCallback(async (shipmentId, parcels) => {
    const { error: delErr } = await supabase.from("shipment_parcels")
      .delete().eq("shipment_id", shipmentId);
    if (delErr) throw delErr;
    const rows = (parcels ?? []).map(p => ({
      shipment_id: shipmentId,
      length_in: p.lengthIn ?? null,
      width_in: p.widthIn ?? null,
      height_in: p.heightIn ?? null,
      weight_lb: p.weightLb ?? null,
      dry_ice_lb: p.dryIceLb ?? null,
      notes: (p.notes ?? "").trim() || null,
    }));
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("shipment_parcels")
        .insert(rows);
      if (insErr) throw insErr;
    }
    await fetchAll();
  }, [fetchAll]);

  // Hard delete — draft shipments only (callers enforce); parcels
  // cascade.
  const removeShipment = useCallback(async (id) => {
    const { error: err } = await supabase.from("shipments")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── shipping settings (Batch 29.3) ─────────────────────────────────
  // The singleton allowlist row (id locked to true by the schema).
  const updateShippingSettings = useCallback(async ({
    allowedStates, notes,
  }) => {
    const patch = {};
    if (allowedStates !== undefined) {
      patch.allowed_states = allowedStates;
    }
    if (notes !== undefined) patch.notes = (notes ?? "").trim() || null;
    const { error: err } = await supabase.from("shipping_settings")
      .update(patch).eq("id", true);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    orders,
    ordersById,
    byStatus,
    shipmentsByOrder,
    shippingSettings: tables?.settings
      ?? { allowedStates: [], notes: null },
    loading: tables === null,
    error,
    createOrder,
    updateOrder,
    setLines,
    removeOrder,
    markReady,
    reopenOrder,
    cancelOrder,
    setPaid,
    clearPaid,
    fulfillOrder,
    createShipment,
    updateShipment,
    setShipmentStatus,
    setParcels,
    removeShipment,
    updateShippingSettings,
  };
}
