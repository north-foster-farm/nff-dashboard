import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";

// Feeds + feed orders data hook (Batch 25.1).
//
//   useFeeds() → {
//     feeds,            // camelCase rows incl. speciesId / sortOrder,
//                       // sorted (species, sort_order, name)
//     ordersByFeed,     // Map<feedTypeId, [orders newest-first]>
//     lastOrderByFeed,  // Map<feedTypeId, most recent order>
//     loading, error,
//     updateFeed(id, patch),          // camelCase patch
//     reorderFeeds(idsInOrder),       // persists sort_order = index
//     recordOrder({ feedTypeId, orderedOn, quantity, totalCost,
//                   supplierId, notes, addToOnHand }),
//     updateOrder(id, patch), removeOrder(id),
//   }
//
// `data.feeds` from useReferenceData stays the read-path for other
// pages; this hook is the Feed page's own read+write surface (same
// pattern as useCustomers / useProjects).

const FEED_COLS =
  "id, name, description, supplier_id, species_id, sort_order, unit, " +
  "package_size, cost_per_unit, reorder_point, reorder_quantity, " +
  "lead_time_days, notes, on_hand, on_hand_updated_at";

const ORDER_COLS =
  "id, feed_type_id, supplier_id, ordered_on, received_on, quantity, " +
  "total_cost, notes, created_at, updated_at";

const TABLES = ["feed_types", "feed_orders"];

function shapeFeed(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    supplierId: r.supplier_id,
    speciesId: r.species_id,
    sortOrder: r.sort_order ?? 0,
    unit: r.unit,
    packageSize: r.package_size,
    costPerUnit: r.cost_per_unit,
    reorderPoint: r.reorder_point,
    reorderQuantity: r.reorder_quantity,
    leadTimeDays: r.lead_time_days,
    notes: r.notes,
    onHand: r.on_hand,
    onHandUpdatedAt: r.on_hand_updated_at,
  };
}

function shapeOrder(r) {
  return {
    id: r.id,
    feedTypeId: r.feed_type_id,
    supplierId: r.supplier_id,
    orderedOn: r.ordered_on,
    receivedOn: r.received_on,
    quantity: r.quantity,
    totalCost: r.total_cost == null ? null : Number(r.total_cost),
    notes: r.notes,
    createdAt: r.created_at,
    // Derived: per-unit price for "last price paid".
    pricePerUnit:
      r.total_cost != null && Number(r.quantity?.amount) > 0
        ? Number(r.total_cost) / Number(r.quantity.amount)
        : null,
  };
}

export function useFeeds() {
  const instanceId = useId();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [feedRes, orderRes] = await Promise.all([
      supabase.from("feed_types").select(FEED_COLS)
        .order("sort_order").order("name"),
      supabase.from("feed_orders").select(ORDER_COLS)
        .order("ordered_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    const failed = [feedRes, orderRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      feeds: (feedRes.data ?? []).map(shapeFeed),
      orders: (orderRes.data ?? []).map(shapeOrder),
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
    let channel = realtimeChannel(`feeds:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const feeds = useMemo(() => tables?.feeds ?? [], [tables]);

  const ordersByFeed = useMemo(() => {
    const map = new Map();
    for (const o of tables?.orders ?? []) {
      const arr = map.get(o.feedTypeId) ?? [];
      arr.push(o);
      map.set(o.feedTypeId, arr);
    }
    return map;
  }, [tables]);

  const lastOrderByFeed = useMemo(() => {
    const map = new Map();
    for (const [feedId, orders] of ordersByFeed) {
      if (orders.length > 0) map.set(feedId, orders[0]);
    }
    return map;
  }, [ordersByFeed]);

  // ── feed mutations ─────────────────────────────────────────────────
  const updateFeed = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("description" in patch) dbPatch.description = patch.description;
    if ("supplierId" in patch) dbPatch.supplier_id = patch.supplierId;
    if ("speciesId" in patch) dbPatch.species_id = patch.speciesId;
    if ("sortOrder" in patch) dbPatch.sort_order = patch.sortOrder;
    if ("reorderPoint" in patch) dbPatch.reorder_point = patch.reorderPoint;
    if ("reorderQuantity" in patch) {
      dbPatch.reorder_quantity = patch.reorderQuantity;
    }
    if ("leadTimeDays" in patch) dbPatch.lead_time_days = patch.leadTimeDays;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    if ("onHand" in patch) {
      dbPatch.on_hand = patch.onHand;
      dbPatch.on_hand_updated_at = new Date().toISOString();
    }
    const { error: err } = await supabase.from("feed_types")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Persist a drag-reorder: sort_order = position in idsInOrder. Only
  // called with the ids of one species group, so cross-group orders
  // never clobber each other.
  const reorderFeeds = useCallback(async (idsInOrder) => {
    // Optimistic: apply the new order locally first so the cards don't
    // snap back while the writes are in flight.
    setTables(prev => {
      if (!prev) return prev;
      const orderOf = new Map(idsInOrder.map((id, i) => [id, i]));
      return {
        ...prev,
        feeds: prev.feeds.map(f =>
          orderOf.has(f.id) ? { ...f, sortOrder: orderOf.get(f.id) } : f
        ),
      };
    });
    for (let i = 0; i < idsInOrder.length; i++) {
      const { error: err } = await supabase.from("feed_types")
        .update({ sort_order: i }).eq("id", idsInOrder[i]);
      if (err) { await fetchAll(); throw err; }
    }
    await fetchAll();
  }, [fetchAll]);

  // ── order mutations ────────────────────────────────────────────────
  // Recording an order optionally bumps the feed's on-hand by the
  // ordered quantity (the common case: you record the order when the
  // delivery lands). Pass addToOnHand: false to log a historical order
  // without touching stock.
  const recordOrder = useCallback(async ({
    feedTypeId, orderedOn, receivedOn = null, quantity, totalCost,
    supplierId = null, notes = null, addToOnHand = true,
  }) => {
    if (!feedTypeId) throw new Error("feedTypeId required.");
    const amount = Number(quantity?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Order quantity must be a positive number.");
    }
    const row = {
      feed_type_id: feedTypeId,
      supplier_id: supplierId,
      ordered_on: orderedOn || new Date().toISOString().slice(0, 10),
      received_on: receivedOn,
      quantity,
      total_cost: totalCost == null || totalCost === ""
        ? null : Number(totalCost),
      notes: (notes ?? "").trim() || null,
    };
    const { data, error: err } = await supabase.from("feed_orders")
      .insert(row).select(ORDER_COLS).single();
    if (err) throw err;

    if (addToOnHand) {
      const feed = (tables?.feeds ?? []).find(f => f.id === feedTypeId);
      const current = Number(feed?.onHand?.amount);
      const unit = feed?.onHand?.unit ?? quantity.unit ?? feed?.unit;
      const next = (Number.isFinite(current) ? current : 0) + amount;
      const { error: feedErr } = await supabase.from("feed_types")
        .update({
          on_hand: { amount: next, unit },
          on_hand_updated_at: new Date().toISOString(),
        })
        .eq("id", feedTypeId);
      if (feedErr) throw feedErr;
    }

    await fetchAll();
    return data.id;
  }, [fetchAll, tables]);

  const updateOrder = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("orderedOn" in patch) dbPatch.ordered_on = patch.orderedOn;
    if ("receivedOn" in patch) dbPatch.received_on = patch.receivedOn;
    if ("quantity" in patch) dbPatch.quantity = patch.quantity;
    if ("totalCost" in patch) {
      dbPatch.total_cost = patch.totalCost == null || patch.totalCost === ""
        ? null : Number(patch.totalCost);
    }
    if ("supplierId" in patch) dbPatch.supplier_id = patch.supplierId;
    if ("notes" in patch) dbPatch.notes = patch.notes;
    const { error: err } = await supabase.from("feed_orders")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const removeOrder = useCallback(async (id) => {
    const { error: err } = await supabase.from("feed_orders")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  return {
    feeds,
    ordersByFeed,
    lastOrderByFeed,
    loading: tables === null,
    error,
    updateFeed,
    reorderFeeds,
    recordOrder,
    updateOrder,
    removeOrder,
  };
}
