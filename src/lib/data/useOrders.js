import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { orderTotalCents } from "../orders.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Orders data hook (Batch 29.1) — orders, their lines, and (29.3)
// their shipments.
//
//   useOrders() → {
//     orders,           // shaped orders, lines attached, newest first
//     ordersById,
//     byStatus,         // { open: [], ready: [], fulfilled: [],
//                       //   cancelled: [] }
//     shipmentsByOrder, // Map<orderId, shipments with parcels attached>
//     loading, error,
//     createOrder({ customerId, customerName, fulfillmentMethod,
//                   shipTo, shippingCents, notes, lines }),
//     updateOrder(id, patch),    // open orders only (caller enforces)
//     setLines(orderId, lines),  // replace-all line write
//     removeOrder(id),           // hard delete (mistakes only)
//   }
//
// Lifecycle transitions (ready / fulfill / cancel) and payment land in
// 29.2; shipment mutations land in 29.3. The reads are all here from
// day one so those slices only add mutations.

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

const TABLES = ["orders", "order_lines", "shipments", "shipment_parcels"];

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
    const [orderRes, lineRes, shipRes, parcelRes] = await Promise.all([
      supabase.from("orders").select(ORDER_COLS)
        .order("placed_at", { ascending: false }),
      supabase.from("order_lines").select(LINE_COLS)
        .order("sort_order"),
      supabase.from("shipments").select(SHIPMENT_COLS)
        .order("created_at", { ascending: false }),
      supabase.from("shipment_parcels").select(PARCEL_COLS)
        .order("created_at"),
    ]);
    const failed = [orderRes, lineRes, shipRes, parcelRes]
      .find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      orders: (orderRes.data ?? []).map(shapeOrder),
      lines: (lineRes.data ?? []).map(shapeLine),
      shipments: (shipRes.data ?? []).map(shapeShipment),
      parcels: (parcelRes.data ?? []).map(shapeParcel),
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

  return {
    orders,
    ordersById,
    byStatus,
    shipmentsByOrder,
    loading: tables === null,
    error,
    createOrder,
    updateOrder,
    setLines,
    removeOrder,
  };
}
