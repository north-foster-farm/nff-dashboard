import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { skuKey } from "../productCatalog.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";

// Inventory data hook (Batch 28.1) — lots + their movement audit
// trail.
//
//   useInventory() → {
//     lots,            // shaped inventory_lots rows, newest lot first
//     openLots,        // lots with quantity > 0
//     movementsByLot,  // Map<lotId, shaped movements, newest first>
//     onHand,          // Map<skuKey, total open quantity>
//     loading, error,
//     createLot({ productKindId, bracketId, lotDate, quantity,
//                 placeId, notes }),
//     adjustLot(lotId, newQuantity, { reason, notes }),
//     moveLot(lotId, placeId),
//     removeLot(lotId),
//     allocateToSale({ saleId, productKindId, bracketId, quantity })
//       → { allocated, short },        // FIFO draw-down (Batch 28.2)
//     reverseSale(saleId),             // restore a deleted sale's lots
//   }
//
// On-hand grouping uses productCatalog's skuKey (product kind ×
// bracket) so the Products page, the POS allocation (28.2), and the
// inventory rollup all agree on what "one SKU" means.

const LOT_COLS =
  "id, product_kind_id, bracket_id, lot_date, quantity, " +
  "initial_quantity, place_id, notes, created_by, created_at, " +
  "updated_at";
const MOVEMENT_COLS =
  "id, lot_id, delta, reason, sale_id, notes, created_by, created_at";

const TABLES = ["inventory_lots", "inventory_movements"];

function shapeLot(r) {
  return {
    id: r.id,
    productKindId: r.product_kind_id,
    bracketId: r.bracket_id,
    lotDate: r.lot_date,
    quantity: Number(r.quantity),
    initialQuantity: Number(r.initial_quantity),
    placeId: r.place_id,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function shapeMovement(r) {
  return {
    id: r.id,
    lotId: r.lot_id,
    delta: Number(r.delta),
    reason: r.reason,
    saleId: r.sale_id,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export function useInventory() {
  const instanceId = useId();
  const userEmail = useCurrentUserEmail();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    const [lotRes, moveRes] = await Promise.all([
      supabase.from("inventory_lots").select(LOT_COLS)
        .order("lot_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("inventory_movements").select(MOVEMENT_COLS)
        .order("created_at", { ascending: false }),
    ]);
    const failed = [lotRes, moveRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      lots: (lotRes.data ?? []).map(shapeLot),
      movements: (moveRes.data ?? []).map(shapeMovement),
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
    let channel = realtimeChannel(`inventory:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  const lots = tables?.lots ?? [];
  const openLots = useMemo(
    () => lots.filter(l => l.quantity > 0),
    [lots]
  );
  const movementsByLot = useMemo(() => {
    const m = new Map();
    for (const mv of tables?.movements ?? []) {
      if (!m.has(mv.lotId)) m.set(mv.lotId, []);
      m.get(mv.lotId).push(mv);
    }
    return m;
  }, [tables]);
  const onHand = useMemo(() => {
    const m = new Map();
    for (const l of openLots) {
      const key = skuKey(l.productKindId, l.bracketId);
      m.set(key, (m.get(key) ?? 0) + l.quantity);
    }
    return m;
  }, [openLots]);

  // ── mutations ──────────────────────────────────────────────────────
  // Every quantity change writes the lot AND a movement row, so the
  // audit trail always explains the running total.

  const createLot = useCallback(async ({
    productKindId, bracketId = null, lotDate, quantity,
    placeId = null, notes = null,
  }) => {
    if (!productKindId) throw new Error("Pick a product.");
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      throw new Error("Quantity must be a positive number.");
    }
    const { data: created, error: insErr } = await supabase
      .from("inventory_lots")
      .insert({
        product_kind_id: productKindId,
        bracket_id: bracketId,
        lot_date: lotDate,
        quantity: q,
        initial_quantity: q,
        place_id: placeId,
        notes: (notes ?? "").trim() || null,
        created_by: userEmail,
      })
      .select(LOT_COLS)
      .single();
    if (insErr) throw insErr;
    const { error: mvErr } = await supabase
      .from("inventory_movements")
      .insert({
        lot_id: created.id,
        delta: q,
        reason: "created",
        created_by: userEmail,
      });
    if (mvErr) throw mvErr;
    await fetchAll();
    return shapeLot(created);
  }, [userEmail, fetchAll]);

  const adjustLot = useCallback(async (lotId, newQuantity, {
    reason = "adjustment", notes = null,
  } = {}) => {
    const lot = (tables?.lots ?? []).find(l => l.id === lotId);
    if (!lot) throw new Error("Lot not found.");
    const q = Number(newQuantity);
    if (!Number.isFinite(q) || q < 0) {
      throw new Error("Quantity must be zero or more.");
    }
    const delta = q - lot.quantity;
    if (delta === 0) return;
    const { error: upErr } = await supabase.from("inventory_lots")
      .update({ quantity: q, updated_at: new Date().toISOString() })
      .eq("id", lotId);
    if (upErr) throw upErr;
    const { error: mvErr } = await supabase
      .from("inventory_movements")
      .insert({
        lot_id: lotId,
        delta,
        reason,
        notes: (notes ?? "").trim() || null,
        created_by: userEmail,
      });
    if (mvErr) throw mvErr;
    await fetchAll();
  }, [tables, userEmail, fetchAll]);

  // Place moves don't change quantity, so no movement row.
  const moveLot = useCallback(async (lotId, placeId) => {
    const { error: err } = await supabase.from("inventory_lots")
      .update({
        place_id: placeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lotId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // Hard delete — for mistakes only (movements cascade). Lots that a
  // sale has drawn from should be adjusted/spoiled instead so the
  // sales history keeps pointing at something.
  const removeLot = useCallback(async (lotId) => {
    const { error: err } = await supabase.from("inventory_lots")
      .delete().eq("id", lotId);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── sale allocation (Batch 28.2 — the POS link) ────────────────────
  // Draw `quantity` of a SKU out of its open lots, oldest lot first
  // (FIFO — the oldest chicken leaves the freezer first). Each lot
  // touched gets a 'sale' movement carrying the sale_id. Returns
  // { allocated, short }: short > 0 means the sale exceeded what
  // inventory had — the sale still records, the caller surfaces the
  // shortfall so the counts get fixed up.
  const allocateToSale = useCallback(async ({
    saleId, productKindId, bracketId = null, quantity,
  }) => {
    let remaining = Number(quantity);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      return { allocated: 0, short: 0 };
    }
    // Oldest first; tie-break on created_at for same-day lots.
    const candidates = (tables?.lots ?? [])
      .filter(l =>
        l.productKindId === productKindId
        && (l.bracketId ?? null) === (bracketId ?? null)
        && l.quantity > 0)
      .sort((a, b) =>
        a.lotDate.localeCompare(b.lotDate)
        || a.createdAt.localeCompare(b.createdAt));

    let allocated = 0;
    for (const lot of candidates) {
      if (remaining <= 0) break;
      const take = Math.min(lot.quantity, remaining);
      const { error: upErr } = await supabase.from("inventory_lots")
        .update({
          quantity: lot.quantity - take,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lot.id);
      if (upErr) throw upErr;
      const { error: mvErr } = await supabase
        .from("inventory_movements")
        .insert({
          lot_id: lot.id,
          delta: -take,
          reason: "sale",
          sale_id: saleId,
          created_by: userEmail,
        });
      if (mvErr) throw mvErr;
      allocated += take;
      remaining -= take;
    }
    await fetchAll();
    return { allocated, short: remaining };
  }, [tables, userEmail, fetchAll]);

  // Undo a deleted sale's draw-down: every lot its movements touched
  // gets its quantity back, with a counter-movement explaining why
  // (movements stay append-only — nothing is erased). Must run BEFORE
  // the sale row is deleted: the movements' sale_id is what finds
  // them, and the FK nulls it on delete. Each reversed movement's
  // sale_id is cleared as it's processed, so a retry after a partial
  // failure never restores the same lot twice.
  const reverseSale = useCallback(async (saleId) => {
    const saleMovements = (tables?.movements ?? [])
      .filter(m => m.saleId === saleId && m.reason === "sale");
    for (const mv of saleMovements) {
      const lot = (tables?.lots ?? []).find(l => l.id === mv.lotId);
      if (lot) {
        const { error: upErr } = await supabase.from("inventory_lots")
          .update({
            quantity: lot.quantity + Math.abs(mv.delta),
            updated_at: new Date().toISOString(),
          })
          .eq("id", lot.id);
        if (upErr) throw upErr;
        const { error: mvErr } = await supabase
          .from("inventory_movements")
          .insert({
            lot_id: lot.id,
            delta: Math.abs(mv.delta),
            reason: "adjustment",
            notes: "Sale deleted — quantity restored",
            created_by: userEmail,
          });
        if (mvErr) throw mvErr;
      }
      // Mark this movement reversed (idempotency): clear its sale_id
      // — the delete's FK would null it anyway.
      const { error: clrErr } = await supabase
        .from("inventory_movements")
        .update({ sale_id: null })
        .eq("id", mv.id);
      if (clrErr) throw clrErr;
    }
    await fetchAll();
  }, [tables, userEmail, fetchAll]);

  return {
    lots,
    openLots,
    movementsByLot,
    onHand,
    loading: tables === null,
    error,
    createLot,
    adjustLot,
    moveLot,
    removeLot,
    allocateToSale,
    reverseSale,
  };
}
