import { useMemo } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { iconForSpecies } from "../components/animalIcons.jsx";
import { useMetricDefinitions } from "../lib/data/useMetricDefinitions.js";
import { useWeightSamples } from "../lib/data/useWeightSamples.js";
import { useEggCollections } from "../lib/data/useEggCollections.js";
import { useMortalityLog } from "../lib/data/useMortalityLog.js";
import { useProcessingDates } from "../lib/data/useProcessingDates.js";
import { useInventory } from "../lib/data/useInventory.js";
import { useProducts } from "../lib/data/useProducts.js";
import {
  averageDailyGain, feedConversionRatio, fmtMetric, henHousedProduction,
  isLayerSpecies, isMeatSpecies, layerFeedEfficiency, layingRate,
  mortalityStats, bodyWeightTrend, uniformity, weeksTimeline,
} from "../lib/metrics.js";
import { navigate, pathForBatch } from "../lib/router.js";
import { Pane } from "../components/ui.jsx";

// The Metrics page (Batch 26.2) — the "how are we doing?" surface.
//
// Three sections:
//   1. Broiler batches — the cross-batch comparison sheet: one row per
//      batch of every meat species, every per-batch metric side by
//      side. This is the record sheet the roadmap describes (weeks on
//      farm, feed eaten, feed cost, mortality, FCR, ADG, uniformity,
//      cuts ordered).
//   2. Layer flocks — same idea for egg production.
//   3. Metric definitions — the registry (seeded in 0023): what each
//      number means, how it's computed, and what range is healthy.
//
// All math comes from src/lib/metrics.js; per-cohort capture lives on
// the batch pages (Batch 26.1).

export default function Metrics({ data }) {
  const { byAppliesTo, loading: defsLoading } = useMetricDefinitions();
  // null group id → every group's rows, one query each.
  const { samples } = useWeightSamples(null);
  const { collections } = useEggCollections(null);
  const { events: mortalityEvents } = useMortalityLog(null);
  const { processingDateByBatchId } = useProcessingDates();
  // Real inventory lots (Batch 28.1) — the "cuts ordered" column reads
  // these instead of the retired static JSON chicken lots.
  const { lots: inventoryLots } = useInventory();
  const { productsById } = useProducts();

  const ctx = useMemo(() => ({
    feedSchedules: data.feedSchedules ?? [],
    feeds: data.feeds ?? [],
  }), [data.feedSchedules, data.feeds]);

  const samplesByGroup = useMemo(
    () => groupBy(samples, s => s.groupId), [samples]);
  const collectionsByGroup = useMemo(
    () => groupBy(collections, c => c.groupId), [collections]);
  const mortalityByGroup = useMemo(
    () => groupBy(mortalityEvents, e => e.groupId), [mortalityEvents]);

  const species = data.livestock?.species ?? [];
  const meatSpecies = species.filter(isMeatSpecies);
  const layerSpecies = species.filter(isLayerSpecies);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-dim leading-relaxed m-0 max-w-[70ch]">
        Every number the dashboard can compute about how the animals are
        performing, side by side. The math runs on what's been captured —
        weigh-ins and egg counts come from the batch pages and the Rounds
        quick actions; feed is projected from the feed schedules.
      </p>

      {meatSpecies.map(sp => (
        <BroilerComparison
          key={sp.id}
          species={sp}
          samplesByGroup={samplesByGroup}
          mortalityByGroup={mortalityByGroup}
          processingDateByBatchId={processingDateByBatchId}
          inventoryLots={inventoryLots}
          productsById={productsById}
          ctx={ctx}
        />
      ))}

      {layerSpecies.map(sp => (
        <LayerComparison
          key={sp.id}
          species={sp}
          samplesByGroup={samplesByGroup}
          collectionsByGroup={collectionsByGroup}
          mortalityByGroup={mortalityByGroup}
          ctx={ctx}
        />
      ))}

      <Registry byAppliesTo={byAppliesTo} loading={defsLoading} />
    </div>
  );
}

// ── broiler cross-batch comparison ────────────────────────────────────

function BroilerComparison({
  species, samplesByGroup, mortalityByGroup, processingDateByBatchId,
  inventoryLots, productsById, ctx,
}) {
  // Newest batches first; batches with no arrival date sink to the
  // bottom (they can't compute much anyway).
  const batches = [...(species.groups ?? [])].sort((a, b) =>
    (b.arrivalDate ?? "").localeCompare(a.arrivalDate ?? ""));

  if (batches.length === 0) return null;

  const rows = batches.map(batch => {
    const samples = samplesByGroup.get(batch.id) ?? [];
    const mortality = mortalityByGroup.get(batch.id) ?? [];
    const processingISO = processingDateByBatchId.get(batch.id) ?? null;

    const fcr = feedConversionRatio(batch, samples, ctx, processingISO);
    const adg = averageDailyGain(samples, batch);
    const uni = uniformity(samples);
    const mort = mortalityStats(batch, mortality);
    const weeks = weeksTimeline(batch, species, processingISO);

    // "Cuts ordered": inventory lots created on this batch's
    // processing day (Batch 28.1 — real inventory_lots, not the old
    // static stub). The lot date is the join key, filtered to this
    // species' products so an egg count on the same day doesn't leak
    // in. initial_quantity, not quantity — sales drawing a lot down
    // shouldn't shrink what the processing day produced.
    const cuts = processingISO
      ? inventoryLots
        .filter(l => {
          const product = productsById.get(l.productKindId);
          return l.lotDate === processingISO
            && product?.sourceSpeciesId === species.id;
        })
        .reduce((a, l) => a + (l.initialQuantity ?? 0), 0)
      : null;

    return { batch, fcr, adg, uni, mort, weeks, cuts, processingISO };
  });

  return (
    <Pane
      title={`${species.name} — batch comparison`}
      icon={iconForSpecies(species.id)}
      subtitle={`${rows.length} batch${rows.length === 1 ? "" : "es"}`}
    >
      <ComparisonTable
        headers={[
          { label: "Batch", align: "left" },
          { label: "Placed" },
          { label: "Alive" },
          { label: "Weeks on farm" },
          { label: "Weeks left" },
          { label: "Feed eaten" },
          { label: "Feed cost" },
          { label: "Mortality" },
          { label: "FCR" },
          { label: "Daily gain" },
          { label: "Uniformity" },
          { label: "Cuts ordered" },
        ]}
        rows={rows.map(r => ({
          key: r.batch.id,
          onOpen: () => navigate(pathForBatch(species.id, r.batch.id)),
          cells: [
            { value: r.batch.label, align: "left", strong: true },
            { value: numOrDash(r.mort.placed) },
            { value: numOrDash(r.batch.count) },
            { value: r.weeks.weeksOnFarm != null
              && r.weeks.weeksOnFarm >= 0
              ? r.weeks.weeksOnFarm.toFixed(1) : "—" },
            { value: r.weeks.weeksRemaining != null
              ? Math.max(0, r.weeks.weeksRemaining).toFixed(1) : "—" },
            { value: r.fcr.feedLb > 0
              ? `${Math.round(r.fcr.feedLb).toLocaleString()} lb` : "—" },
            { value: r.fcr.feedCost != null
              ? `$${r.fcr.feedCost.toFixed(0)}` : "—" },
            { value: fmtMetric(r.mort.ratePct, { digits: 1, suffix: "%" }) },
            { value: fmtMetric(r.fcr.value),
              warn: r.fcr.value != null && r.fcr.value > 3.0 },
            { value: fmtMetric(r.adg.value, { digits: 3 }) },
            { value: fmtMetric(r.uni.value, { digits: 1, suffix: "%" }),
              warn: r.uni.value != null && r.uni.value > 8 },
            { value: r.cuts != null && r.cuts > 0
              ? r.cuts.toLocaleString() : "—" },
          ],
        }))}
      />
      <p className="text-[11px] text-faint leading-relaxed m-0 mt-3">
        Feed eaten and cost are projected from the feed schedules; FCR,
        gain, and uniformity need weigh-ins (batch page → Weigh-ins).
        Cuts ordered counts inventory lots whose lot date matches the
        batch's processing day, so a mistyped lot date leaves them out.
        Click a row to open the batch.
      </p>
    </Pane>
  );
}

// ── layer flock comparison ────────────────────────────────────────────

function LayerComparison({
  species, samplesByGroup, collectionsByGroup, mortalityByGroup, ctx,
}) {
  const flocks = [...(species.groups ?? [])].sort(
    (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));

  if (flocks.length === 0) return null;

  const rows = flocks.map(flock => {
    const samples = samplesByGroup.get(flock.id) ?? [];
    const collections = collectionsByGroup.get(flock.id) ?? [];
    const mortality = mortalityByGroup.get(flock.id) ?? [];

    const hh = henHousedProduction(flock, collections);
    const rate = layingRate(flock, collections);
    const eff = layerFeedEfficiency(flock, collections, ctx);
    const mort = mortalityStats(flock, mortality);
    const weight = bodyWeightTrend(samples);

    return { flock, hh, rate, eff, mort, weight };
  });

  return (
    <Pane
      title={`${species.name} — flock comparison`}
      icon={iconForSpecies(species.id)}
      subtitle={`${rows.length} flock${rows.length === 1 ? "" : "s"}`}
    >
      <ComparisonTable
        headers={[
          { label: "Flock", align: "left" },
          { label: "Placed" },
          { label: "Alive" },
          { label: "Eggs collected" },
          { label: "Hen-housed" },
          { label: "Laying rate" },
          { label: "Feed / dozen" },
          { label: "Feed / lb egg" },
          { label: "Body weight" },
          { label: "Mortality" },
        ]}
        rows={rows.map(r => ({
          key: r.flock.id,
          onOpen: () => navigate(pathForBatch(species.id, r.flock.id)),
          cells: [
            { value: r.flock.label, align: "left", strong: true },
            { value: numOrDash(r.mort.placed) },
            { value: numOrDash(r.flock.count) },
            { value: r.hh.eggs > 0 ? r.hh.eggs.toLocaleString() : "—" },
            { value: fmtMetric(r.hh.value, { digits: 1 }) },
            { value: r.rate.value != null
              ? `${Math.round(r.rate.value * 100)}%` : "—" },
            { value: fmtMetric(r.eff.perDozen, { digits: 1 }) },
            { value: fmtMetric(r.eff.perLbEggMass, { digits: 1 }) },
            { value: r.weight.latestAvg != null
              ? `${fmtMetric(r.weight.latestAvg)} lb` +
                (r.weight.pctChange != null
                  ? ` (${r.weight.pctChange >= 0 ? "+" : ""}` +
                    `${r.weight.pctChange.toFixed(1)}%)`
                  : "")
              : "—",
              warn: !!r.weight.flag },
            { value: fmtMetric(r.mort.ratePct, { digits: 1, suffix: "%" }) },
          ],
        }))}
      />
      <p className="text-[11px] text-faint leading-relaxed m-0 mt-3">
        Hen-housed production is cumulative eggs per hen placed (target
        280–320 in the first laying year). Feed efficiency needs a
        metered feed schedule — free-choice stages can't be projected.
        Click a row to open the flock.
      </p>
    </Pane>
  );
}

// ── metric registry ───────────────────────────────────────────────────

const FAMILY_LABELS = {
  broiler_batch: "Broiler batches",
  layer_flock: "Layer flocks",
};

function Registry({ byAppliesTo, loading }) {
  return (
    <Pane title="Metric definitions" icon={BookOpen}>
      {loading ? (
        <div className="text-[12px] text-dim italic">Loading…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {[...byAppliesTo.entries()].map(([family, defs]) => (
            <div key={family} className="flex flex-col gap-3">
              <div className="font-ui text-[10px] uppercase tracking-[0.14em] font-semibold text-muted">
                {FAMILY_LABELS[family] ?? family}
              </div>
              <ul className="m-0 p-0 list-none flex flex-col divide-y divide-line">
                {defs.map(d => (
                  <li key={d.id} className="py-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-fg">
                        {d.name}
                      </span>
                      {d.unit && (
                        <span className="text-[11px] text-dim">{d.unit}</span>
                      )}
                      {d.targetNote && (
                        <span className="text-[11px] text-accent-deep ml-auto">
                          {d.targetNote}
                        </span>
                      )}
                    </div>
                    {d.description && (
                      <p className="text-[12px] text-dim leading-relaxed m-0 mt-1">
                        {d.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Pane>
  );
}

// ── shared pieces ─────────────────────────────────────────────────────

// The comparison sheet itself. Plain table, horizontal scroll on
// narrow screens, whole rows clickable (deep link to the cohort page).
function ComparisonTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={
                  "font-ui text-[9px] uppercase tracking-[0.12em] " +
                  "font-semibold text-faint pb-2 px-2 first:pl-0 last:pr-0 " +
                  "whitespace-nowrap " +
                  (h.align === "left" ? "text-left" : "text-right")
                }
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.key}
              onClick={row.onOpen}
              className={
                "border-t border-line " +
                (row.onOpen ? "cursor-pointer hover:bg-row-hover" : "")
              }
            >
              {row.cells.map((c, i) => (
                <td
                  key={i}
                  className={
                    "py-2.5 px-2 first:pl-0 last:pr-0 whitespace-nowrap " +
                    (c.align === "left" ? "text-left" : "text-right") + " " +
                    (c.warn ? "text-warn " : "") +
                    (c.strong
                      ? "font-semibold text-fg"
                      : c.warn ? "" : "text-fg")
                  }
                >
                  {c.strong && row.onOpen ? (
                    <span className="inline-flex items-center gap-1">
                      {c.value}
                      <ArrowUpRight size={12} className="text-faint shrink-0" />
                    </span>
                  ) : c.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function numOrDash(n) {
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items ?? []) {
    const key = keyFn(item);
    if (key == null) continue;
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}
