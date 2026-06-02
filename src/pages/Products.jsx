import { useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, Camera, ChevronDown, ChevronRight, ImageOff,
  Plus, Tag, Trash2, X,
} from "lucide-react";
import { useProducts } from "../lib/data/useProducts.js";
import PricingGrid from "../components/PricingGrid.jsx";
import {
  CONTENT_SLOTS, currentPriceMap, fmtCents, groupProductsByAnimal,
  skuCostFloor, skuKey,
} from "../lib/productCatalog.js";
import {
  computeBroilerCostPerBird, computeBroilerCutCostPerLb, fmtUSD,
} from "../lib/productCost.js";

// The Products page (Batch 27) — the real catalog.
//
//   Catalog tab — products grouped by animal (plus "Not animal-
//   specific" and Bundles), each expandable into the full editor:
//   photo (product-photos bucket), the four-slot description content,
//   size brackets, sold-out flag. (Batch 27.1)
//   Pricing tab — the bulk pricing grid: every SKU with live margin
//   against its cost floor, compare-at, quick-fill, history.
//   (Batch 27.2 — components/PricingGrid.jsx)
//
// Content patterns follow the 2026-06-02 research pass over Pat's
// Pastured / Polyface / White Oak: fixed price per weight bracket,
// products named "Animal, Cut", sold-out items stay visible, the
// four-part description recipe.
//
// The Sales tab (record-a-sale + sales-over-time, Batch 27.3) lands
// next.

export default function Products({ data }) {
  const db = useProducts();
  const [tab, setTab] = useState("catalog");
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Cost floors come from the JSON-side cost model (lib/productCost):
  // chick + feed + slaughter + packaging. Still partial — missing
  // components render as caveats, never silently as $0.
  const perBird = useMemo(
    () => computeBroilerCostPerBird(data), [data]);
  const cutCtx = useMemo(
    () => computeBroilerCutCostPerLb(data), [data]);

  const priceMap = useMemo(
    () => currentPriceMap(db.prices), [db.prices]);

  const species = data.livestock?.species ?? [];
  const visible = showArchived ? db.archived : db.products;
  const groups = useMemo(
    () => groupProductsByAnimal(visible, species),
    [visible, species]
  );

  return (
    <div className="max-w-[920px] flex flex-col gap-5">
      {/* tabs + actions */}
      <div className="flex items-center gap-1 border-b border-line">
        <Tab
          active={tab === "catalog"}
          onClick={() => setTab("catalog")}
          label={`Catalog · ${db.products.length}`}
        />
        <Tab
          active={tab === "pricing"}
          onClick={() => setTab("pricing")}
          label="Pricing"
        />
        {tab === "catalog" && (
          <>
            <button
              onClick={() => setShowArchived(s => !s)}
              className={
                "ml-auto shrink-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 mb-2 border cursor-pointer " +
                (showArchived
                  ? "bg-surface-alt text-fg border-line"
                  : "bg-transparent text-dim border-line hover:text-fg")
              }
            >
              Archived · {db.archived.length}
            </button>
            <button
              onClick={() => setCreating(c => !c)}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 mb-2 cursor-pointer"
            >
              <Plus size={13} /> New product
            </button>
          </>
        )}
      </div>

      {db.loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : tab === "pricing" ? (
        <PricingGrid
          db={db}
          products={db.products}
          perBird={perBird}
          cutCtx={cutCtx}
        />
      ) : (
        <>
          {creating && (
            <NewProductForm
              species={species}
              onCancel={() => setCreating(false)}
              onSave={async (fields) => {
                await db.createProduct(fields);
                setCreating(false);
              }}
            />
          )}

          {visible.length === 0 ? (
            <div className="bg-surface border border-line px-6 py-10 text-center">
              <Tag size={20} className="text-faint mx-auto mb-3" />
              <div className="text-[13px] text-muted">
                {showArchived
                  ? "Nothing archived."
                  : "No products yet — add the first one."}
              </div>
            </div>
          ) : (
            groups.map(group => (
              <ProductGroup
                key={group.key}
                group={group}
                db={db}
                species={species}
                priceMap={priceMap}
                perBird={perBird}
                cutCtx={cutCtx}
              />
            ))
          )}

          <CostFloorReference perBird={perBird} cutCtx={cutCtx} />
        </>
      )}
    </div>
  );
}

function Tab({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={
        "bg-transparent border-0 font-[inherit] text-[12px] font-semibold " +
        "uppercase tracking-[0.12em] px-3 pb-2 pt-1 cursor-pointer " +
        (active
          ? "text-fg shadow-[inset_0_-2px_0_0_var(--c-accent)]"
          : "text-dim hover:text-fg")
      }
    >
      {label}
    </button>
  );
}

// ── groups ─────────────────────────────────────────────────────────────

function ProductGroup({ group, db, species, priceMap, perBird, cutCtx }) {
  const [openId, setOpenId] = useState(null);
  return (
    <section>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
        {group.label} · {group.products.length}
      </div>
      <div className="flex flex-col gap-3">
        {group.products.map(p => (
          <ProductCard
            key={p.id}
            product={p}
            db={db}
            species={species}
            priceMap={priceMap}
            perBird={perBird}
            cutCtx={cutCtx}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          />
        ))}
      </div>
    </section>
  );
}

// ── product card ───────────────────────────────────────────────────────

function ProductCard({
  product: p, db, species, priceMap, perBird, cutCtx, open, onToggle,
}) {
  const photoUrl = db.photoUrls.get(p.id) ?? null;

  // "From $X" — lowest current price across brackets (Pat's pattern).
  const fromPrice = useMemo(() => {
    const brackets = p.sizeBrackets.length > 0
      ? p.sizeBrackets : [{ id: null }];
    const cents = brackets
      .map(b => priceMap.get(skuKey(p.id, b.id))?.priceCents)
      .filter(c => c != null);
    if (cents.length === 0) return null;
    const min = Math.min(...cents);
    return {
      min,
      uniform: cents.length === brackets.length
        && cents.every(c => c === min),
      complete: cents.length === brackets.length,
    };
  }, [p, priceMap]);

  const descriptionPreview = CONTENT_SLOTS
    .map(slot => p.content?.[slot.key])
    .find(text => text && text.trim());

  return (
    <section className="bg-surface border border-line">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer font-[inherit] text-left"
      >
        {open
          ? <ChevronDown size={14} className="text-dim shrink-0" />
          : <ChevronRight size={14} className="text-dim shrink-0" />}

        {/* photo thumb */}
        <div className="w-12 h-12 shrink-0 bg-surface-alt border border-line flex items-center justify-center overflow-hidden">
          {photoUrl
            ? <img src={photoUrl} alt={p.name}
                className="w-full h-full object-cover" />
            : <ImageOff size={16} className="text-faint" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-[15px] font-semibold text-fg">
              {p.name}
            </span>
            {p.soldOut && (
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-warn border border-warn px-1.5 py-0.5">
                Sold out
              </span>
            )}
            {p.isBundle && (
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-dim border border-line px-1.5 py-0.5">
                Bundle
              </span>
            )}
          </div>
          <div className="text-[11px] text-dim mt-0.5 truncate">
            {[
              p.saleUnit && `sold by ${p.saleUnit}`,
              p.sizeBrackets.length > 0 &&
                `${p.sizeBrackets.length} size${p.sizeBrackets.length === 1 ? "" : "s"}`,
              descriptionPreview,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {fromPrice ? (
            <div className="font-heading text-[15px] text-accent">
              {fromPrice.uniform
                ? fmtCents(fromPrice.min)
                : `From ${fmtCents(fromPrice.min)}`}
            </div>
          ) : (
            <div className="text-[11px] text-faint italic">no price set</div>
          )}
        </div>
      </button>

      {open && (
        <ProductEditor
          product={p}
          db={db}
          species={species}
          priceMap={priceMap}
          perBird={perBird}
          cutCtx={cutCtx}
        />
      )}
    </section>
  );
}

// ── product editor ─────────────────────────────────────────────────────

const inputCls =
  "bg-bg border border-line text-fg text-[13px] px-2.5 py-2 outline-none " +
  "focus:border-accent font-[inherit] w-full";
const labelCls =
  "text-[9px] text-faint uppercase tracking-[0.12em] mb-1";
const btnGhostCls =
  "bg-transparent border border-line text-dim font-[inherit] text-[11px] " +
  "font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer " +
  "hover:text-fg";
const btnAccentCls =
  "bg-accent text-on-accent border border-accent font-[inherit] " +
  "text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 " +
  "cursor-pointer disabled:opacity-50";

function ProductEditor({ product: p, db, species, priceMap, perBird, cutCtx }) {
  const [name, setName] = useState(p.name ?? "");
  const [speciesId, setSpeciesId] = useState(p.sourceSpeciesId ?? "");
  const [saleUnit, setSaleUnit] = useState(p.saleUnit ?? "");
  const [avgPerPackage, setAvgPerPackage] = useState(
    p.averagePerPackage ?? "");
  const [content, setContent] = useState(p.content ?? {});
  const [brackets, setBrackets] = useState(p.sizeBrackets ?? []);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const dirty =
    name !== (p.name ?? "")
    || speciesId !== (p.sourceSpeciesId ?? "")
    || saleUnit !== (p.saleUnit ?? "")
    || avgPerPackage !== (p.averagePerPackage ?? "")
    || JSON.stringify(content) !== JSON.stringify(p.content ?? {})
    || JSON.stringify(brackets) !== JSON.stringify(p.sizeBrackets ?? []);

  const save = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await db.updateProduct(p.id, {
        name,
        sourceSpeciesId: speciesId || null,
        saleUnit: saleUnit.trim() || null,
        averagePerPackage: avgPerPackage,
        content,
        sizeBrackets: brackets,
      });
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
    }
    setPending(false);
  };

  return (
    <div className="border-t border-line px-4 py-4 flex flex-col gap-5">
      <div className="grid sm:grid-cols-[160px_1fr] gap-5">
        <PhotoBox product={p} db={db} />

        <div className="flex flex-col gap-3 min-w-0">
          {/* identity */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <div className={labelCls}>Name</div>
              <input value={name} className={inputCls}
                onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className={labelCls}>Animal</div>
              <select
                value={speciesId}
                onChange={(e) => setSpeciesId(e.target.value)}
                className={inputCls}
              >
                <option value="">Not animal-specific</option>
                {species.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className={labelCls}>Sold by</div>
              <input value={saleUnit} className={inputCls}
                placeholder="each / dozen / package / lb"
                onChange={(e) => setSaleUnit(e.target.value)} />
            </div>
            <div>
              <div className={labelCls}>Average per package</div>
              <input value={avgPerPackage} className={inputCls}
                placeholder='e.g. "Average 8 per package" (optional)'
                onChange={(e) => setAvgPerPackage(e.target.value)} />
            </div>
          </div>

          {/* sold out — writes immediately */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={p.soldOut}
              onChange={(e) =>
                db.updateProduct(p.id, { soldOut: e.target.checked })
                  .catch(() => {})}
            />
            <span className="text-[12px] text-fg">
              Sold out
              <span className="text-faint"> — stays visible in the
              catalog, flagged (the Pat's pattern)</span>
            </span>
          </label>
        </div>
      </div>

      {/* description content slots */}
      <div>
        <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
          Description
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {CONTENT_SLOTS.map(slot => (
            <div key={slot.key}>
              <div className={labelCls}>{slot.label}</div>
              <textarea
                value={content[slot.key] ?? ""}
                onChange={(e) => setContent(c =>
                  ({ ...c, [slot.key]: e.target.value }))}
                placeholder={slot.hint}
                rows={3}
                className={inputCls + " resize-y leading-relaxed"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* size brackets */}
      {!p.isBundle && (
        <BracketsEditor
          product={p}
          brackets={brackets}
          setBrackets={setBrackets}
          priceMap={priceMap}
          perBird={perBird}
          cutCtx={cutCtx}
        />
      )}

      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}

      {/* footer actions */}
      <div className="flex items-center gap-2 border-t border-line pt-3">
        {p.archivedAt ? (
          <>
            <button
              onClick={() => db.unarchiveProduct(p.id).catch(() => {})}
              className={btnGhostCls + " inline-flex items-center gap-1.5"}
            >
              <ArchiveRestore size={13} /> Restore
            </button>
            <button
              onClick={() => {
                if (!window.confirm(
                  `Delete "${p.name}" forever? Fails if it has recorded ` +
                  "lots or sales — archive covers that case.")) return;
                db.removeProduct(p.id).catch(err =>
                  window.alert(err?.code === "23503"
                    ? "This product has lots or sales recorded against " +
                      "it, so it can't be deleted — keep it archived."
                    : err?.message ?? "Delete failed."));
              }}
              className={btnGhostCls +
                " inline-flex items-center gap-1.5 !text-warn"}
            >
              <Trash2 size={13} /> Delete forever
            </button>
          </>
        ) : (
          <button
            onClick={() => db.archiveProduct(p.id).catch(() => {})}
            className={btnGhostCls + " inline-flex items-center gap-1.5"}
          >
            <Archive size={13} /> Archive
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="text-[11px] text-dim italic">
              unsaved changes
            </span>
          )}
          <button
            onClick={save}
            disabled={pending || !dirty}
            className={btnAccentCls}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── photo ──────────────────────────────────────────────────────────────

function PhotoBox({ product: p, db }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photoUrl = db.photoUrls.get(p.id) ?? null;

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { await db.uploadPhoto(p, file); }
    catch (err) { window.alert(err?.message ?? "Upload failed."); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square bg-surface-alt border border-line flex items-center justify-center overflow-hidden">
        {photoUrl
          ? <img src={photoUrl} alt={p.name}
              className="w-full h-full object-cover" />
          : <Camera size={22} className="text-faint" />}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="flex gap-1">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={btnGhostCls + " flex-1 text-center"}
        >
          {busy ? "Uploading…" : photoUrl ? "Replace" : "Add photo"}
        </button>
        {photoUrl && (
          <button
            onClick={() => {
              setBusy(true);
              db.removePhoto(p)
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
            disabled={busy}
            title="Remove photo"
            className={btnGhostCls + " px-2"}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="text-[10px] text-faint leading-relaxed">
        Staged product shot — packaged or plated, clean background.
      </div>
    </div>
  );
}

// ── size brackets ──────────────────────────────────────────────────────

function BracketsEditor({
  product: p, brackets, setBrackets, priceMap, perBird, cutCtx,
}) {
  const setBracket = (i, patch) => {
    setBrackets(list => list.map((b, idx) =>
      idx === i ? { ...b, ...patch } : b));
  };

  const addBracket = () => {
    const id = `${p.id.slice(0, 8)}_${Date.now().toString(36)}`;
    setBrackets(list => [...list, { id, label: "", minLb: null, maxLb: null }]);
  };

  return (
    <div>
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
        Size brackets
        <span className="normal-case tracking-normal text-faint">
          {" "}— each gets its own fixed price (priced on the Pricing tab)
        </span>
      </div>

      {brackets.length === 0 ? (
        <div className="text-[12px] text-faint italic mb-2">
          No size brackets — the product is priced as a single SKU.
        </div>
      ) : (
        <div className="flex flex-col gap-px bg-line border border-line mb-2">
          {brackets.map((b, i) => {
            const price = priceMap.get(skuKey(p.id, b.id));
            const floor = skuCostFloor(p, b, perBird, cutCtx);
            return (
              <div
                key={b.id ?? i}
                className="bg-bg px-3 py-2 grid grid-cols-[1fr_90px_90px_auto_auto] gap-2 items-center"
              >
                <input
                  value={b.label ?? ""}
                  onChange={(e) => setBracket(i, { label: e.target.value })}
                  placeholder="Label — e.g. 3–3.5 lb"
                  className={inputCls + " !py-1.5 !text-[12px]"}
                />
                <input
                  value={b.minLb ?? ""}
                  onChange={(e) => setBracket(i, {
                    minLb: e.target.value === ""
                      ? null : Number(e.target.value),
                  })}
                  placeholder="min lb"
                  type="number"
                  step="0.25"
                  className={inputCls + " !py-1.5 !text-[12px]"}
                />
                <input
                  value={b.maxLb ?? ""}
                  onChange={(e) => setBracket(i, {
                    maxLb: e.target.value === ""
                      ? null : Number(e.target.value),
                  })}
                  placeholder="max lb"
                  type="number"
                  step="0.25"
                  className={inputCls + " !py-1.5 !text-[12px]"}
                />
                <div className="text-right text-[11px] min-w-[110px]">
                  <span className="text-faint">
                    {price ? fmtCents(price.priceCents) : "no price"}
                  </span>
                  {floor != null && (
                    <span className="text-dim"> · floor {fmtUSD(floor)}</span>
                  )}
                </div>
                <button
                  onClick={() => setBrackets(list =>
                    list.filter((_, idx) => idx !== i))}
                  title="Remove bracket"
                  className="bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={addBracket}
        className={btnGhostCls + " inline-flex items-center gap-1.5"}
      >
        <Plus size={13} /> Add bracket
      </button>
    </div>
  );
}

// ── new product form ───────────────────────────────────────────────────

function NewProductForm({ species, onSave, onCancel }) {
  const [name, setName] = useState("");
  const [speciesId, setSpeciesId] = useState("");
  const [saleUnit, setSaleUnit] = useState("");
  const [isBundle, setIsBundle] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    if (!name.trim()) return;
    setPending(true);
    setErrorMsg(null);
    try {
      await onSave({
        name,
        sourceSpeciesId: speciesId || null,
        saleUnit: saleUnit.trim() || null,
        isBundle,
        // category stays null for user-created products — the legacy
        // broiler_whole / broiler_cut categories only matter to the
        // cost-floor model, which seeded rows already carry.
        category: null,
      });
    } catch (err) {
      setErrorMsg(err?.message ?? "Save failed.");
      setPending(false);
    }
  };

  return (
    <div className="bg-surface border border-line p-4 flex flex-col gap-3">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em]">
        New product
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className={inputCls} autoFocus
          placeholder='Name — "Chicken, Ground" sorts by animal' />
        <select
          value={speciesId}
          onChange={(e) => setSpeciesId(e.target.value)}
          className={inputCls}
        >
          <option value="">Not animal-specific</option>
          {species.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input value={saleUnit} onChange={(e) => setSaleUnit(e.target.value)}
          className={inputCls}
          placeholder="Sold by — each / dozen / package" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={isBundle}
          onChange={(e) => setIsBundle(e.target.checked)} />
        <span className="text-[12px] text-fg">
          Bundle
          <span className="text-faint"> — a curated pack of other
          products at its own price (contents picked after creating)</span>
        </span>
      </label>
      {errorMsg && <div className="text-[11px] text-warn">{errorMsg}</div>}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} disabled={pending} className={btnGhostCls}>
          Cancel
        </button>
        <button onClick={submit} disabled={pending || !name.trim()}
          className={btnAccentCls}>
          {pending ? "Creating…" : "Create product"}
        </button>
      </div>
    </div>
  );
}

// ── cost-floor reference ───────────────────────────────────────────────
// Compact version of the old Products page's cost banner: what the
// known per-bird floor is built from and what's still missing. The
// full margin-aware pricing surface is the Pricing tab (Batch 27.2).

function CostFloorReference({ perBird, cutCtx }) {
  return (
    <section className="bg-surface border border-line px-5 py-4">
      <div className="text-[10px] text-dim uppercase tracking-[0.12em] mb-2">
        Cost floor reference — broilers
      </div>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="text-[11px] text-dim">
          Known cost per bird (whole, batch of {perBird.batchSize})
        </div>
        <div className="font-heading text-[18px] text-accent">
          {fmtUSD(perBird.knownTotal)}
        </div>
      </div>
      {cutCtx && (
        <div className="flex items-baseline justify-between flex-wrap gap-2 mt-1">
          <div className="text-[11px] text-dim">
            Allocated cost per sellable lb of cuts
          </div>
          <div className="font-heading text-[15px] text-accent">
            {fmtUSD(cutCtx.costPerSellableLb)} / lb
          </div>
        </div>
      )}
      {perBird.missing.length > 0 && (
        <div className="mt-2 text-[11px] text-warn leading-relaxed">
          <span className="uppercase tracking-[0.12em] text-[9px] mr-2">
            Missing
          </span>
          {perBird.missing.join(", ")} — floors shown are partial.
        </div>
      )}
    </section>
  );
}
