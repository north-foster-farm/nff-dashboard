import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import { pathForBatch, pathForProject } from "../browser/router.js";

// App-wide search index (Batch 33). Builds a flat, in-memory list of
// searchable entries spanning every entity type, for the cmd-K command
// palette.
//
// Source split:
//   - Most entities are already in the global `data` prop loaded by
//     useReferenceData (batches, projects, suppliers, machines,
//     trailers, threads, orders) — we just reshape those, no fetch.
//   - Places, customers, and products live in per-page hooks, not the
//     global bag, so we load a lightweight slice (id + name) of those
//     three small tables once here. No migration, no tsvector — the
//     tables are tiny and this is a client-side palette.
//
// Each entry: { id, type, label, sublabel, keywords, path }. `keywords`
// is a pre-lowercased haystack the palette substring-matches against;
// `path` is where selecting it navigates. Entities without a per-row
// route (customers, products, orders, …) point at their list page —
// "find it, jump to where it lives".
//
// Entries are deliberately NOT including pages/sections — the palette
// folds those in from the static SECTIONS list so they're always
// available even before data loads.

const TYPE_META = {
  batch: { label: "Batch" },
  project: { label: "Project" },
  place: { label: "Place" },
  customer: { label: "Customer" },
  product: { label: "Product" },
  supplier: { label: "Supplier" },
  machine: { label: "Machine" },
  trailer: { label: "Trailer" },
  thread: { label: "Thread" },
  order: { label: "Order" },
};

export const SEARCH_TYPE_LABEL = (t) => TYPE_META[t]?.label ?? t;

function entry(id, type, label, sublabel, path, extraKeywords = "") {
  return {
    id: `${type}:${id}`,
    type,
    label: label ?? "(untitled)",
    sublabel: sublabel ?? null,
    path,
    keywords: `${label ?? ""} ${sublabel ?? ""} ${extraKeywords}`
      .toLowerCase(),
  };
}

export function useSearchIndex(data) {
  // Lightweight slices of the three tables not in the global bag.
  const [extra, setExtra] = useState({
    places: null, customers: null, products: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [placesRes, customersRes, productsRes] = await Promise.all([
        supabase.from("places")
          .select("id, name, code, kind, is_active"),
        supabase.from("customers")
          .select("id, name, email, phone"),
        supabase.from("product_kinds")
          .select("id, name, category, archived_at"),
      ]);
      if (cancelled) return;
      setExtra({
        places: placesRes.data ?? [],
        customers: customersRes.data ?? [],
        products: productsRes.data ?? [],
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const entries = useMemo(() => {
    const out = [];

    // Batches → real deep link. `speciesId` rides along so the palette
    // draws the batch's species glyph (F27), not a blanket Bird.
    for (const sp of data?.livestock?.species ?? []) {
      for (const g of sp.groups ?? []) {
        out.push({
          ...entry(
            g.id, "batch", g.label, sp.name,
            pathForBatch(sp.id, g.id), sp.id),
          speciesId: sp.id,
        });
      }
    }

    // Projects → real deep link. The sublabel qualifies a project only
    // when it sits outside the ranked queue; the legacy `status`
    // column it used to show has been retired (0.6).
    for (const p of data?.projects ?? []) {
      let queuePlacement = null;
      if (p.completedAt) queuePlacement = "Completed";
      else if (p.queueState === "unprioritized") {
        queuePlacement = "Unprioritized";
      }
      out.push(entry(
        p.id, "project", p.title, queuePlacement, pathForProject(p.id)));
    }

    // Places → /place/<id>.
    for (const p of extra.places ?? []) {
      if (p.is_active === false) continue;
      out.push(entry(
        p.id, "place", p.name, p.code || p.kind,
        `/place/${p.id}`, p.code ?? ""));
    }

    // Customers → directory (no per-customer route yet).
    for (const c of extra.customers ?? []) {
      out.push(entry(
        c.id, "customer", c.name || c.email || "(no name)",
        c.email, "/customers", `${c.email ?? ""} ${c.phone ?? ""}`));
    }

    // Products → catalog.
    for (const pr of extra.products ?? []) {
      if (pr.archived_at) continue;
      out.push(entry(
        pr.id, "product", pr.name, pr.category, "/products"));
    }

    // Suppliers / machines / trailers → their resource page.
    for (const s of data?.suppliers ?? []) {
      out.push(entry(s.id, "supplier", s.label, s.category,
        "/resources-suppliers", (s.supplies ?? []).join(" ")));
    }
    for (const m of data?.machines ?? []) {
      out.push(entry(m.id, "machine", m.label, m.manufacturer,
        "/resources-machinery"));
    }
    for (const tr of data?.trailers ?? []) {
      out.push(entry(tr.id, "trailer", tr.label, tr.category,
        "/resources-trailers"));
    }

    // Threads → the threads page.
    for (const th of data?.threads ?? []) {
      out.push(entry(th.id, "thread", th.title, th.status,
        "/threads", th.question ?? ""));
    }

    // Orders → the orders page (no per-order route).
    for (const o of data?.orders ?? []) {
      out.push(entry(
        o.id, "order",
        o.customer_name || "Order",
        o.status, "/orders", o.notes ?? ""));
    }

    return out;
  }, [data, extra]);

  return {
    entries,
    loading: extra.places === null,
  };
}
