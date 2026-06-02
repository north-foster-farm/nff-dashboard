import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, GripVertical,
  History, PackagePlus, Trash2, Truck,
} from "lucide-react";
import { useFeeds } from "../lib/data/useFeeds.js";
import {
  projectReorder, consolidationSummary, formatAmount, formatOrderDate,
} from "../lib/feedConsumption.js";
import { formatDate } from "../lib/dates.js";

// The Feed page (Batch 25.1) — group-cards layout.
//
//   - Feeds group by animal (livestock_species), drag-orderable
//     within each group (persists feed_types.sort_order).
//   - Each card leads with amount remaining + next order date; last
//     price paid (from feed_orders) is the secondary line.
//   - The next order date is projected from the feed schedules: every
//     assigned group's metered consumption is walked forward day by
//     day until stock hits the reorder point, then snapped to the
//     closest business day on or before the trigger.
//   - When any feed needs ordering soon, a consolidation banner shows
//     every feed's stock so the order can be combined into one
//     delivery (one freight charge).
//   - Past orders are recorded and browsed per card.

export default function Feeds({ data }) {
  const db = useFeeds();

  // Projection context: schedules + livestock come from the app-wide
  // reference data (already realtime-refreshed); feeds come from the
  // hook so edits here reflect instantly.
  const ctx = useMemo(() => ({
    feedSchedules: data.feedSchedules ?? [],
    livestock: data.livestock ?? { species: [] },
  }), [data.feedSchedules, data.livestock]);

  // Group feeds by species. Species render in their ordinal order;
  // feeds pointing at no (or an unknown) species land in "Other".
  const groups = useMemo(() => {
    const species = data.livestock?.species ?? [];
    const byId = new Map(species.map(sp => [sp.id, sp]));
    const out = [];
    const other = [];
    const used = new Set();
    for (const sp of species) {
      const feeds = db.feeds.filter(f => f.speciesId === sp.id);
      feeds.forEach(f => used.add(f.id));
      if (feeds.length > 0) out.push({ species: sp, feeds });
    }
    for (const f of db.feeds) {
      if (!used.has(f.id) && !byId.has(f.speciesId)) other.push(f);
    }
    if (other.length > 0) out.push({ species: null, feeds: other });
    return out;
  }, [db.feeds, data.livestock]);

  const consolidation = useMemo(
    () => consolidationSummary(db.feeds, ctx),
    [db.feeds, ctx]
  );

  if (db.loading) {
    return <div className="text-[12px] text-dim italic">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-[11px] text-muted leading-relaxed max-w-[700px]">
        Feed types grouped by the animals that eat them, drag-orderable
        within each group. Order dates are projected from the feed
        schedules — what every batch eats per day, walked forward until
        stock hits the reorder point — and snapped to the closest
        business day before the trigger. Recording an order keeps the
        price history that the &ldquo;last paid&rdquo; line reads from.
      </div>

      {consolidation.anyDue && (
        <ConsolidationBanner rows={consolidation.rows} />
      )}

      {groups.map(group => (
        <SpeciesGroup
          key={group.species?.id ?? "other"}
          species={group.species}
          feeds={group.feeds}
          db={db}
          ctx={ctx}
          suppliers={data.suppliers ?? []}
        />
      ))}

      {db.feeds.length === 0 && (
        <div className="bg-surface border border-line px-6 py-10 text-center">
          <div className="text-[13px] text-muted">
            No feed types recorded yet.
          </div>
        </div>
      )}
    </div>
  );
}

// ── consolidation banner ──────────────────────────────────────────────
// Shown when any feed is at/below its reorder point or projected to
// hit it within two weeks. Lists EVERY feed so the order can be
// consolidated into one delivery.
function ConsolidationBanner({ rows }) {
  const urgent = rows.filter(r =>
    r.projection.kind === "order_now" ||
    (r.projection.kind === "projected" && r.projection.daysUntil <= 14)
  );
  const rest = rows.filter(r => !urgent.includes(r));

  return (
    <section className="border border-warn bg-surface">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-warn/40">
        <Truck size={16} className="text-warn shrink-0" />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-fg">
            Feed order coming up
          </div>
          <div className="text-[11px] text-dim mt-0.5 leading-relaxed">
            Anything else running low can ride on the same delivery —
            one freight charge instead of two.
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-px bg-line">
        {urgent.map(({ feed, projection }) => (
          <BannerRow key={feed.id} feed={feed} projection={projection} loud />
        ))}
        {rest.map(({ feed, projection }) => (
          <BannerRow key={feed.id} feed={feed} projection={projection} />
        ))}
      </div>
    </section>
  );
}

function BannerRow({ feed, projection, loud = false }) {
  return (
    <div className="bg-surface px-4 py-2 flex items-baseline gap-3 flex-wrap">
      <span
        className={
          "text-[12px] min-w-[140px] " +
          (loud ? "font-semibold text-fg" : "text-dim")
        }
      >
        {feed.name}
      </span>
      <span className="text-[12px] text-fg">
        {formatAmount(feed.onHand) ?? (
          <span className="text-faint italic">not tracked</span>
        )}
      </span>
      <span className="text-[11px] ml-auto">
        <ProjectionLabel projection={projection} />
      </span>
    </div>
  );
}

// ── species group (drag-orderable card stack) ─────────────────────────
function SpeciesGroup({ species, feeds, db, ctx, suppliers }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const feedIds = feeds.map(f => f.id);

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = feedIds.indexOf(active.id);
    const to = feedIds.indexOf(over.id);
    if (from < 0 || to < 0) return;
    db.reorderFeeds(arrayMove(feedIds, from, to)).catch(() => {});
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-ui text-[11px] uppercase tracking-[0.16em] font-semibold text-muted m-0">
        {species?.name ?? "Not animal-specific"}
        {" · "}
        {feeds.length}
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={feedIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {feeds.map(feed => (
              <SortableFeedCard
                key={feed.id}
                feed={feed}
                db={db}
                ctx={ctx}
                suppliers={suppliers}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function SortableFeedCard({ feed, db, ctx, suppliers }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: feed.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-60 z-10 relative" : ""}
    >
      <FeedCard
        feed={feed}
        db={db}
        ctx={ctx}
        suppliers={suppliers}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

// ── the card ──────────────────────────────────────────────────────────
function FeedCard({ feed, db, ctx, suppliers, dragHandleProps }) {
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);

  const projection = useMemo(
    () => projectReorder(feed, ctx),
    [feed, ctx]
  );
  const orders = db.ordersByFeed.get(feed.id) ?? [];
  const lastOrder = db.lastOrderByFeed.get(feed.id) ?? null;
  const supplier = suppliers.find(s => s.id === feed.supplierId);
  const needsOrder = projection.kind === "order_now";

  return (
    <div
      className={
        "bg-surface border group " +
        (needsOrder ? "border-warn" : "border-line")
      }
    >
      {/* header row: drag handle, name, badges */}
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <span
          {...dragHandleProps}
          className="shrink-0 mt-1 text-faint hover:text-dim cursor-grab touch-none opacity-0 group-hover:opacity-100"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-heading text-[17px] font-semibold text-fg">
              {feed.name}
            </span>
            {needsOrder && (
              <span className="inline-flex items-center gap-1 text-[10px] font-ui font-semibold text-warn uppercase tracking-[0.1em]">
                <AlertTriangle size={12} /> Order now
              </span>
            )}
          </div>
          {feed.description && (
            <div className="text-[12px] text-dim mt-0.5 leading-relaxed">
              {feed.description}
            </div>
          )}
        </div>
      </div>

      {/* lead stats: remaining + order-by */}
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-4 items-end px-4 py-4 ml-[26px]">
        <div>
          <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1">
            Remaining
          </div>
          <OnHandEditor feed={feed} db={db} />
        </div>
        <div>
          <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1">
            Next order
          </div>
          <div className="font-heading text-[20px] leading-none">
            <ProjectionLabel projection={projection} />
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <button
            onClick={() => setRecording(r => !r)}
            className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            <PackagePlus size={13} /> Record order
          </button>
        </div>
      </div>

      {/* secondary: last price paid + reference details */}
      <div className="px-4 pb-3.5 ml-[26px] flex flex-col gap-1.5">
        <div className="text-[12px] text-fg">
          <LastPaidLine feed={feed} lastOrder={lastOrder} />
        </div>
        <div className="text-[11px] text-muted flex items-center gap-2 flex-wrap">
          {supplier && <span>{supplier.label}</span>}
          {feed.packageSize?.label && (
            <span>· {feed.packageSize.label}</span>
          )}
          {feed.reorderPoint && (
            <span>· reorder at {formatAmount(feed.reorderPoint)}</span>
          )}
          {feed.leadTimeDays != null && (
            <span>· {feed.leadTimeDays}-day lead</span>
          )}
        </div>
        <ProjectionCaveats projection={projection} />

        {/* phone-width record button */}
        <div className="sm:hidden mt-1">
          <button
            onClick={() => setRecording(r => !r)}
            className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
          >
            <PackagePlus size={13} /> Record order
          </button>
        </div>
      </div>

      {recording && (
        <RecordOrderForm
          feed={feed}
          db={db}
          suppliers={suppliers}
          onDone={() => setRecording(false)}
        />
      )}

      {/* order history toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 ml-0 border-t border-line bg-transparent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-fg cursor-pointer"
      >
        <History size={12} className="shrink-0" />
        {orders.length === 0
          ? "No orders recorded"
          : `${orders.length} past order${orders.length === 1 ? "" : "s"}`}
        {expanded
          ? <ChevronDown size={12} className="shrink-0" />
          : <ChevronRight size={12} className="shrink-0" />}
      </button>
      {expanded && (
        <OrderHistory feed={feed} orders={orders} db={db} />
      )}
    </div>
  );
}

// The projected-order-date label, shared by cards and the banner.
function ProjectionLabel({ projection }) {
  switch (projection.kind) {
    case "order_now":
      return <span className="text-warn font-semibold">Order now</span>;
    case "projected":
      return (
        <span className="text-accent">
          {formatOrderDate(projection.orderByDateISO)}
        </span>
      );
    case "untracked":
      return (
        <span className="text-faint italic text-[13px]">
          set on-hand to project
        </span>
      );
    case "no_reorder_point":
      return (
        <span className="text-faint italic text-[13px]">
          no reorder point
        </span>
      );
    case "beyond_horizon":
      return (
        <span className="text-dim text-[13px]">over a year out</span>
      );
    case "no_consumption":
    default:
      return (
        <span className="text-faint italic text-[13px]">
          nothing on a metered schedule
        </span>
      );
  }
}

// Schedule gaps that keep the projection partial (free-choice stages,
// missing arrival dates, unit mismatches). Collapsed to one line.
function ProjectionCaveats({ projection }) {
  const [open, setOpen] = useState(false);
  const caveats = projection.caveats ?? [];
  if (caveats.length === 0) return null;
  return (
    <div className="text-[11px] text-faint leading-relaxed">
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-transparent border-0 p-0 font-[inherit] text-[11px] text-faint italic underline decoration-dotted underline-offset-2 cursor-pointer hover:text-dim"
      >
        Projection is partial — {caveats.length}{" "}
        consumer{caveats.length === 1 ? "" : "s"} can&rsquo;t be metered
      </button>
      {open && (
        <ul className="m-0 mt-1 pl-4 flex flex-col gap-0.5">
          {caveats.map((c, i) => (
            <li key={i}>{c.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// "Last paid $0.52/lb — $26.00 for 50 lb on May 12" with catalog
// fallback when no orders exist yet.
function LastPaidLine({ feed, lastOrder }) {
  if (lastOrder) {
    const per = lastOrder.pricePerUnit != null
      ? `$${lastOrder.pricePerUnit.toFixed(2)}/${lastOrder.quantity?.unit ?? ""}`
      : null;
    const total = lastOrder.totalCost != null
      ? `$${lastOrder.totalCost.toFixed(2)}`
      : null;
    return (
      <span>
        {per && (
          <>
            Last paid{" "}
            <span className="text-accent font-semibold">{per}</span>
          </>
        )}
        {!per && "Last order"}
        {total && ` — ${total}`}
        {lastOrder.quantity &&
          ` for ${formatAmount(lastOrder.quantity)}`}
        {lastOrder.orderedOn && ` on ${formatDate(lastOrder.orderedOn)}`}
      </span>
    );
  }
  if (feed.costPerUnit?.amount != null) {
    return (
      <span className="text-dim">
        Catalog price ${Number(feed.costPerUnit.amount).toFixed(2)}/
        {feed.costPerUnit.unit} — no orders recorded yet
      </span>
    );
  }
  return <span className="text-faint italic">No price on record</span>;
}

// ── on-hand inline editor ─────────────────────────────────────────────
// Same commit-on-blur/Enter behavior the old page had; the number is
// the card's biggest figure since "how much is left" leads the design.
function OnHandEditor({ feed, db }) {
  const unit = feed.onHand?.unit ?? feed.reorderPoint?.unit ?? feed.unit ?? "";
  const current = feed.onHand?.amount;
  const [draft, setDraft] = useState(null); // null = not editing
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const commit = async () => {
    if (draft === null) return;
    const n = Number(draft);
    setDraft(null);
    if (!Number.isFinite(n) || n < 0 || n === current) return;
    setErrorMsg(null);
    try {
      await db.updateFeed(feed.id, { onHand: { amount: n, unit } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setErrorMsg(err.message ?? "Save failed");
    }
  };

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <input
          type="number"
          min={0}
          value={draft ?? (current ?? "")}
          placeholder="—"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
          className="w-[88px] font-heading text-[20px] text-fg bg-transparent border-0 border-b border-line focus:border-accent outline-none p-0 leading-none"
        />
        <span className="text-[12px] text-dim">{unit}</span>
        {saved && <Check size={13} className="text-resolved" />}
      </div>
      {errorMsg && (
        <div className="text-[10px] text-warn mt-1">{errorMsg}</div>
      )}
    </div>
  );
}

// ── record order ──────────────────────────────────────────────────────
function RecordOrderForm({ feed, db, suppliers, onDone }) {
  const unit = feed.onHand?.unit ?? feed.unit ?? "";
  const defaultQty = feed.reorderQuantity?.amount ?? "";
  const [amount, setAmount] = useState(String(defaultQty));
  const [totalCost, setTotalCost] = useState("");
  const [orderedOn, setOrderedOn] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [supplierId, setSupplierId] = useState(feed.supplierId ?? "");
  const [notes, setNotes] = useState("");
  const [addToOnHand, setAddToOnHand] = useState(true);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const submit = async () => {
    setPending(true);
    setErrorMsg(null);
    try {
      await db.recordOrder({
        feedTypeId: feed.id,
        orderedOn,
        quantity: { amount: Number(amount), unit },
        totalCost: totalCost === "" ? null : Number(totalCost),
        supplierId: supplierId || null,
        notes,
        addToOnHand,
      });
      onDone();
    } catch (err) {
      setErrorMsg(err.message ?? String(err));
    } finally {
      setPending(false);
    }
  };

  const perUnit = Number(totalCost) > 0 && Number(amount) > 0
    ? Number(totalCost) / Number(amount)
    : null;

  return (
    <div className="border-t border-line bg-surface-alt px-4 py-4 ml-0">
      <div className="flex items-end gap-4 flex-wrap">
        <FormField label={`Quantity (${unit})`}>
          <input
            type="number"
            min={0}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-[100px] bg-surface border border-line px-2 py-1.5 text-[13px] text-fg font-[inherit] outline-none focus:border-accent"
          />
        </FormField>
        <FormField label="Total cost ($)">
          <input
            type="number"
            min={0}
            step="0.01"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="—"
            className="w-[100px] bg-surface border border-line px-2 py-1.5 text-[13px] text-fg font-[inherit] outline-none focus:border-accent"
          />
        </FormField>
        <FormField label="Ordered on">
          <input
            type="date"
            value={orderedOn}
            onChange={(e) => setOrderedOn(e.target.value)}
            className="bg-surface border border-line px-2 py-1.5 text-[13px] text-fg font-[inherit] outline-none focus:border-accent"
          />
        </FormField>
        <FormField label="Supplier">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="bg-surface border border-line px-2 py-1.5 text-[13px] text-fg font-[inherit] outline-none focus:border-accent"
          >
            <option value="">—</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="flex items-end gap-4 flex-wrap mt-3">
        <FormField label="Notes">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-[260px] max-w-full bg-surface border border-line px-2 py-1.5 text-[13px] text-fg font-[inherit] outline-none focus:border-accent"
          />
        </FormField>
        <label className="flex items-center gap-2 text-[12px] text-fg cursor-pointer pb-1.5">
          <input
            type="checkbox"
            checked={addToOnHand}
            onChange={(e) => setAddToOnHand(e.target.checked)}
            className="cursor-pointer"
          />
          Add to on-hand stock
        </label>
      </div>
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          onClick={submit}
          disabled={pending || !Number(amount)}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border border-accent font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Recording…" : "Record order"}
        </button>
        <button
          onClick={onDone}
          className="bg-transparent text-dim border border-line font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer hover:text-fg"
        >
          Cancel
        </button>
        {perUnit != null && (
          <span className="text-[12px] text-dim">
            ${perUnit.toFixed(2)}/{unit}
          </span>
        )}
        {errorMsg && (
          <span className="text-[11px] text-warn">{errorMsg}</span>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

// ── order history ─────────────────────────────────────────────────────
function OrderHistory({ feed, orders, db }) {
  if (orders.length === 0) {
    return (
      <div className="border-t border-line px-4 py-4 text-[12px] text-muted italic">
        Orders recorded here build the price history — the card&rsquo;s
        &ldquo;last paid&rdquo; line reads from it.
      </div>
    );
  }
  return (
    <div className="border-t border-line flex flex-col gap-px bg-line">
      {orders.map(o => (
        <div
          key={o.id}
          className="bg-surface px-4 py-2.5 flex items-baseline gap-3 flex-wrap group/order"
        >
          <span className="text-[12px] text-fg font-medium min-w-[90px]">
            {formatDate(o.orderedOn)}
          </span>
          <span className="text-[12px] text-fg">
            {formatAmount(o.quantity)}
          </span>
          {o.totalCost != null && (
            <span className="text-[12px] text-accent">
              ${o.totalCost.toFixed(2)}
              {o.pricePerUnit != null && (
                <span className="text-dim">
                  {" "}(${o.pricePerUnit.toFixed(2)}/
                  {o.quantity?.unit ?? ""})
                </span>
              )}
            </span>
          )}
          {o.notes && (
            <span className="text-[11px] text-muted truncate">
              {o.notes}
            </span>
          )}
          <button
            onClick={() => {
              if (!window.confirm(
                `Delete this ${feed.name} order from the history?`
              )) return;
              db.removeOrder(o.id).catch(() => {});
            }}
            title="Delete order"
            className="ml-auto shrink-0 bg-transparent border-0 p-1 text-muted hover:text-warn cursor-pointer opacity-0 group-hover/order:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
