import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { realtimeChannel, supabase } from "../supabase.js";
import { useCurrentUserEmail } from "./useCurrentUserEmail.js";
import { slugifyProductId } from "../productCatalog.js";

// Products + pricing + sales data hook (Batch 27).
//
//   useProducts() → {
//     products,         // active (non-archived), sorted by ordinal
//     archived,
//     productsById,     // Map over both active + archived
//     prices,           // shaped product_prices rows, newest first
//     sales,            // shaped product_sales rows, newest first
//     photoUrls,        // Map<productId, signed url> for photo_paths
//     loading, error,
//     createProduct({ name, category, saleUnit, sourceSpeciesId,
//                     isBundle }),
//     updateProduct(id, patch),
//     archiveProduct(id), unarchiveProduct(id), removeProduct(id),
//     setPrice(productKindId, bracketId,
//              { priceCents, compareAtCents, note }),
//     setPrices([{ productKindId, bracketId, priceCents, ... }]),
//     recordSale({ soldOn, productKindId, bracketId, quantity,
//                  totalCents, channel, notes }),
//     removeSale(id),
//     uploadPhoto(product, file), removePhoto(product),
//   }

export const PHOTO_BUCKET = "product-photos";

const PRODUCT_COLS =
  "id, name, category, sale_unit, source_species_id, source_material, " +
  "yield_share_of_dressed_weight, size_brackets, ordinal, content, " +
  "photo_path, sold_out, is_bundle, bundle_contents, " +
  "average_per_package, archived_at, created_at";
const PRICE_COLS =
  "id, product_kind_id, bracket_id, price_cents, compare_at_cents, " +
  "note, created_by, created_at";
const SALE_COLS =
  "id, sold_on, product_kind_id, bracket_id, quantity, total_cents, " +
  "channel, notes, order_id, created_by, created_at";

const TABLES = ["product_kinds", "product_prices", "product_sales"];

function shapeProduct(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    saleUnit: r.sale_unit,
    sourceSpeciesId: r.source_species_id,
    sourceMaterial: r.source_material,
    yieldShareOfDressedWeight: r.yield_share_of_dressed_weight,
    sizeBrackets: r.size_brackets ?? [],
    ordinal: r.ordinal,
    content: r.content ?? {},
    photoPath: r.photo_path,
    soldOut: r.sold_out,
    isBundle: r.is_bundle,
    bundleContents: r.bundle_contents ?? [],
    averagePerPackage: r.average_per_package,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  };
}

function shapePrice(r) {
  return {
    id: r.id,
    productKindId: r.product_kind_id,
    bracketId: r.bracket_id,
    priceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

function shapeSale(r) {
  return {
    id: r.id,
    soldOn: r.sold_on,
    productKindId: r.product_kind_id,
    bracketId: r.bracket_id,
    quantity: Number(r.quantity),
    totalCents: r.total_cents,
    channel: r.channel,
    notes: r.notes,
    orderId: r.order_id,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

export function useProducts() {
  const instanceId = useId();
  const userEmail = useCurrentUserEmail();
  const [tables, setTables] = useState(null);
  const [error, setError] = useState(null);
  const [photoUrls, setPhotoUrls] = useState(new Map());

  const fetchAll = useCallback(async () => {
    const [prodRes, priceRes, saleRes] = await Promise.all([
      supabase.from("product_kinds").select(PRODUCT_COLS).order("ordinal"),
      supabase.from("product_prices").select(PRICE_COLS)
        .order("created_at", { ascending: false }),
      supabase.from("product_sales").select(SALE_COLS)
        .order("sold_on", { ascending: false }),
    ]);
    const failed = [prodRes, priceRes, saleRes].find(r => r.error);
    if (failed) { setError(failed.error); return; }
    setTables({
      products: (prodRes.data ?? []).map(shapeProduct),
      prices: (priceRes.data ?? []).map(shapePrice),
      sales: (saleRes.data ?? []).map(shapeSale),
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
    let channel = realtimeChannel(`products:stream:${instanceId}`);
    for (const t of TABLES) {
      channel = channel.on("postgres_changes",
        { event: "*", schema: "public", table: t }, refresh);
    }
    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instanceId, fetchAll]);

  // Signed URLs for every product photo. The bucket is private (same
  // as project-files), so the catalog needs short-lived signed URLs;
  // refreshed whenever the product set changes.
  useEffect(() => {
    const paths = (tables?.products ?? [])
      .filter(p => p.photoPath)
      .map(p => ({ id: p.id, path: p.photoPath }));
    if (paths.length === 0) { setPhotoUrls(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrls(paths.map(p => p.path), 60 * 60);
      if (cancelled || err || !data) return;
      const map = new Map();
      data.forEach((entry, i) => {
        if (entry?.signedUrl) map.set(paths[i].id, entry.signedUrl);
      });
      setPhotoUrls(map);
    })();
    return () => { cancelled = true; };
  }, [tables]);

  const allProducts = tables?.products ?? [];
  const products = useMemo(
    () => allProducts.filter(p => !p.archivedAt),
    [allProducts]
  );
  const archived = useMemo(
    () => allProducts.filter(p => p.archivedAt),
    [allProducts]
  );
  const productsById = useMemo(
    () => new Map(allProducts.map(p => [p.id, p])),
    [allProducts]
  );

  // ── product mutations ──────────────────────────────────────────────
  const createProduct = useCallback(async ({
    name, category = null, saleUnit = null, sourceSpeciesId = null,
    isBundle = false,
  }) => {
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new Error("A product needs a name.");
    const id = slugifyProductId(trimmed, allProducts.map(p => p.id));
    const maxOrdinal = Math.max(0,
      ...allProducts.map(p => p.ordinal ?? 0));
    const { error: err } = await supabase.from("product_kinds").insert({
      id,
      name: trimmed,
      category,
      sale_unit: saleUnit,
      source_species_id: sourceSpeciesId,
      is_bundle: isBundle,
      size_brackets: [],
      ordinal: maxOrdinal + 1,
    });
    if (err) throw err;
    await fetchAll();
    return id;
  }, [allProducts, fetchAll]);

  const updateProduct = useCallback(async (id, patch) => {
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name?.trim() || null;
    if ("category" in patch) dbPatch.category = patch.category;
    if ("saleUnit" in patch) dbPatch.sale_unit = patch.saleUnit;
    if ("sourceSpeciesId" in patch) {
      dbPatch.source_species_id = patch.sourceSpeciesId;
    }
    if ("sizeBrackets" in patch) dbPatch.size_brackets = patch.sizeBrackets;
    if ("ordinal" in patch) dbPatch.ordinal = patch.ordinal;
    if ("content" in patch) dbPatch.content = patch.content;
    if ("photoPath" in patch) dbPatch.photo_path = patch.photoPath;
    if ("soldOut" in patch) dbPatch.sold_out = patch.soldOut;
    if ("isBundle" in patch) dbPatch.is_bundle = patch.isBundle;
    if ("bundleContents" in patch) {
      dbPatch.bundle_contents = patch.bundleContents;
    }
    if ("averagePerPackage" in patch) {
      dbPatch.average_per_package = patch.averagePerPackage?.trim() || null;
    }
    if ("archivedAt" in patch) dbPatch.archived_at = patch.archivedAt;
    const { error: err } = await supabase.from("product_kinds")
      .update(dbPatch).eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  const archiveProduct = useCallback(
    (id) => updateProduct(id, { archivedAt: new Date().toISOString() }),
    [updateProduct]
  );
  const unarchiveProduct = useCallback(
    (id) => updateProduct(id, { archivedAt: null }),
    [updateProduct]
  );

  // Hard delete. Fails (FK restrict) if product_sales rows reference
  // the product — callers surface that as "archive instead".
  const removeProduct = useCallback(async (id) => {
    const { error: err } = await supabase.from("product_kinds")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── pricing ────────────────────────────────────────────────────────
  // Append-only: setting a price inserts a row; history is the table.
  const setPrice = useCallback(async (productKindId, bracketId, {
    priceCents, compareAtCents = null, note = null,
  }) => {
    if (priceCents == null || priceCents < 0) {
      throw new Error("Price required.");
    }
    const { error: err } = await supabase.from("product_prices").insert({
      product_kind_id: productKindId,
      bracket_id: bracketId ?? null,
      price_cents: priceCents,
      compare_at_cents: compareAtCents,
      note,
      created_by: userEmail,
    });
    if (err) throw err;
    await fetchAll();
  }, [userEmail, fetchAll]);

  // Bulk price update: one insert for many SKUs (the pricing grid's
  // "save all" writes every dirty row at once). entries:
  //   [{ productKindId, bracketId, priceCents, compareAtCents, note }]
  const setPrices = useCallback(async (entries) => {
    const rows = entries.map(e => ({
      product_kind_id: e.productKindId,
      bracket_id: e.bracketId ?? null,
      price_cents: e.priceCents,
      compare_at_cents: e.compareAtCents ?? null,
      note: e.note ?? null,
      created_by: userEmail,
    }));
    if (rows.some(r => r.price_cents == null || r.price_cents < 0)) {
      throw new Error("Every price needs a non-negative amount.");
    }
    if (rows.length === 0) return;
    const { error: err } = await supabase.from("product_prices")
      .insert(rows);
    if (err) throw err;
    await fetchAll();
  }, [userEmail, fetchAll]);

  // ── sales ──────────────────────────────────────────────────────────
  // Returns the shaped sale row so callers (the POS, Batch 28.2) can
  // link inventory movements to it via sale_id. Order fulfillment
  // (Batch 29.2) passes orderId so the sale points back at its order.
  const recordSale = useCallback(async ({
    soldOn, productKindId, bracketId = null, quantity = 1,
    totalCents, channel = null, notes = null, orderId = null,
  }) => {
    if (!productKindId) throw new Error("Pick a product.");
    if (totalCents == null || totalCents < 0) {
      throw new Error("Sale total required.");
    }
    const { data: created, error: err } = await supabase
      .from("product_sales")
      .insert({
        sold_on: soldOn,
        product_kind_id: productKindId,
        bracket_id: bracketId,
        quantity,
        total_cents: totalCents,
        channel,
        notes: (notes ?? "").trim() || null,
        order_id: orderId,
        created_by: userEmail,
      })
      .select(SALE_COLS)
      .single();
    if (err) throw err;
    await fetchAll();
    return shapeSale(created);
  }, [userEmail, fetchAll]);

  const removeSale = useCallback(async (id) => {
    const { error: err } = await supabase.from("product_sales")
      .delete().eq("id", id);
    if (err) throw err;
    await fetchAll();
  }, [fetchAll]);

  // ── photos (Supabase Storage) ──────────────────────────────────────
  const uploadPhoto = useCallback(async (product, file) => {
    // Path: <productId>/<timestamp>-<name>, sanitized so odd filenames
    // can't break out of the prefix (same convention as project-files).
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${product.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    // Best-effort delete of the old photo after the new one is in.
    if (product.photoPath) {
      await supabase.storage.from(PHOTO_BUCKET)
        .remove([product.photoPath]);
    }
    await updateProduct(product.id, { photoPath: path });
  }, [updateProduct]);

  const removePhoto = useCallback(async (product) => {
    if (!product.photoPath) return;
    const { error: rmErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .remove([product.photoPath]);
    if (rmErr) throw rmErr;
    await updateProduct(product.id, { photoPath: null });
  }, [updateProduct]);

  return {
    products,
    archived,
    productsById,
    prices: tables?.prices ?? [],
    sales: tables?.sales ?? [],
    photoUrls,
    loading: tables === null,
    error,
    createProduct,
    updateProduct,
    archiveProduct,
    unarchiveProduct,
    removeProduct,
    setPrice,
    setPrices,
    recordSale,
    removeSale,
    uploadPhoto,
    removePhoto,
  };
}
