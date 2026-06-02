import { useMemo, useState } from "react";
import {
  ChartLine, Egg, Plus, Scale, Trash2, TrendingDown, TrendingUp,
} from "lucide-react";
import { useWeightSamples } from "../lib/data/useWeightSamples.js";
import { useEggCollections } from "../lib/data/useEggCollections.js";
import { useMortalityLog } from "../lib/data/useMortalityLog.js";
import {
  averageDailyGain, bodyWeightTrend, feedConversionRatio, fmtMetric,
  henHousedProduction, isLayerSpecies, isMeatSpecies, layerFeedEfficiency,
  layingRate, mortalityStats, summarizeSamples, uniformity, weeksTimeline,
} from "../lib/metrics.js";
import { formatDate } from "../lib/dates.js";

// Batch / flock metrics section (Batch 26.1) — the per-cohort slice of
// the Metrics & analytics subsystem, embedded on BatchPage.
//
//   Broiler batches (meat species)  → Performance card (FCR, ADG,
//     uniformity, mortality, weeks remaining) + Weigh-ins card.
//   Layer flocks (egg species)      → Production card (hen-housed,
//     laying rate, feed per dozen, feed per lb egg mass, body-weight
//     trend with condition flags, mortality) + Weigh-ins + Egg log.
//
// Every number comes from src/lib/metrics.js pure functions; anything
// that can't be computed honestly shows its caveat instead of a wrong
// number. The cross-batch comparison + Metrics page land in 26.2.

export default function BatchMetricsSection({
  batch, species, data, processingISO,
}) {
  const isLayer = isLayerSpecies(species);
  const isMeat = isMeatSpecies(species);
  const { samples, recordSample, removeSample } = useWeightSamples(batch.id);
  const { events: mortalityEvents } = useMortalityLog(batch.id);
  // Always scoped to this batch — for a meat batch the query just
  // comes back empty (cheaper than loading every flock's collections).
  const {
    collections, recordCollection, removeCollection,
  } = useEggCollections(batch.id);

  // The metrics engine wants placedCount on the group; data.livestock
  // carries it once the DB column lands. Fall back to live count +
  // logged losses (mortalityStats does this internally too).
  const ctx = useMemo(() => ({
    feedSchedules: data.feedSchedules ?? [],
    feeds: data.feeds ?? [],
  }), [data.feedSchedules, data.feeds]);

  // Sheep / pets: no metrics defined for this species — render nothing.
  if (!isLayer && !isMeat) return null;

  return (
    <>
      {isMeat && (
        <PerformanceCard
          batch={batch}
          species={species}
          samples={samples}
          mortalityEvents={mortalityEvents}
          ctx={ctx}
          processingISO={processingISO}
        />
      )}
      {isLayer && (
        <ProductionCard
          batch={batch}
          samples={samples}
          collections={collections}
          mortalityEvents={mortalityEvents}
          ctx={ctx}
        />
      )}
      <div className={"grid gap-4 " + (isLayer ? "sm:grid-cols-2" : "")}>
        <WeighInsCard
          samples={samples}
          onRecord={recordSample}
          onRemove={removeSample}
        />
        {isLayer && (
          <EggLogCard
            collections={collections}
            onRecord={recordCollection}
            onRemove={removeCollection}
          />
        )}
      </div>
    </>
  );
}

// ── broiler performance ───────────────────────────────────────────────

function PerformanceCard({
  batch, species, samples, mortalityEvents, ctx, processingISO,
}) {
  const fcr = feedConversionRatio(batch, samples, ctx, processingISO);
  const adg = averageDailyGain(samples, batch);
  const uni = uniformity(samples);
  const mort = mortalityStats(batch, mortalityEvents);
  const weeks = weeksTimeline(batch, species, processingISO);

  const caveats = dedupe([
    ...fcr.caveats, ...adg.caveats, ...uni.caveats,
    ...mort.caveats, ...weeks.caveats,
  ]);

  return (
    <Card title="Performance" icon={ChartLine}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-5 gap-y-4">
        <MetricStat
          label="Feed conversion"
          value={fmtMetric(fcr.value)}
          sub={fcr.value != null
            ? bandLabel(fcr.value, 2.2, 3.0, "pasture target 2.2–3.0")
            : null}
          tone={fcr.value != null && fcr.value > 3.0 ? "warn" : null}
        />
        <MetricStat
          label="Daily gain"
          value={fmtMetric(adg.value, { digits: 3 })}
          sub={adg.value != null ? "lb/bird/day" : null}
        />
        <MetricStat
          label="Uniformity"
          value={fmtMetric(uni.value, { digits: 1, suffix: "%" })}
          sub={uni.value != null
            ? (uni.value <= 8 ? "tight (under 8%)" : "loose (over 8%)")
            : null}
          tone={uni.value != null && uni.value > 8 ? "warn" : null}
        />
        <MetricStat
          label="Mortality"
          value={fmtMetric(mort.ratePct, { digits: 1, suffix: "%" })}
          sub={mort.placed != null
            ? `${mort.lost} of ${mort.placed} placed`
            : null}
        />
        <MetricStat
          label="Weeks remaining"
          value={weeks.weeksRemaining != null
            ? Math.max(0, weeks.weeksRemaining).toFixed(1)
            : "—"}
          sub={weeks.weeksOnFarm != null
            ? `week ${Math.floor(weeks.weeksOnFarm) + 1} of ` +
              (weeks.basis === "processing_event"
                ? "scheduled processing"
                : `target ${species.targetProcessWeeks}`)
            : null}
        />
      </div>
      {fcr.feedLb > 0 && (
        <div className="text-[11px] text-dim mt-3">
          Feed eaten (projected from schedule):{" "}
          <span className="text-fg font-semibold">
            {Math.round(fcr.feedLb).toLocaleString()} lb
          </span>
          {fcr.feedCost != null && (
            <>
              {" · "}
              <span className="text-fg font-semibold">
                ${fcr.feedCost.toFixed(0)}
              </span>
              {" feed cost"}
            </>
          )}
        </div>
      )}
      <CaveatList caveats={caveats} />
    </Card>
  );
}

// ── layer production ──────────────────────────────────────────────────

function ProductionCard({ batch, samples, collections, mortalityEvents, ctx }) {
  const hh = henHousedProduction(batch, collections);
  const rate = layingRate(batch, collections);
  const eff = layerFeedEfficiency(batch, collections, ctx);
  const weight = bodyWeightTrend(samples);
  const mort = mortalityStats(batch, mortalityEvents);

  const caveats = dedupe([
    ...hh.caveats, ...rate.caveats, ...eff.caveats,
    ...weight.caveats, ...mort.caveats,
  ]);

  return (
    <Card title="Production" icon={Egg}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-5 gap-y-4">
        <MetricStat
          label="Hen-housed"
          value={fmtMetric(hh.value, { digits: 1 })}
          sub={hh.value != null
            ? "eggs/hen placed · target 280–320/yr"
            : null}
        />
        <MetricStat
          label="Laying rate"
          value={rate.value != null
            ? `${Math.round(rate.value * 100)}%`
            : "—"}
          sub={rate.value != null
            ? `last ${rate.windowDays} days`
            : null}
        />
        <MetricStat
          label="Feed / dozen"
          value={fmtMetric(eff.perDozen, { digits: 1 })}
          sub={eff.perDozen != null ? "lb per dozen" : null}
        />
        <MetricStat
          label="Feed / lb egg"
          value={fmtMetric(eff.perLbEggMass, { digits: 1 })}
          sub={eff.perLbEggMass != null ? "lb per lb egg mass" : null}
        />
        <MetricStat
          label="Mortality"
          value={fmtMetric(mort.ratePct, { digits: 1, suffix: "%" })}
          sub={mort.placed != null
            ? `${mort.lost} of ${mort.placed} placed`
            : null}
        />
      </div>
      <BodyWeightStrip weight={weight} />
      <CaveatList caveats={caveats} />
    </Card>
  );
}

// Body-weight trend line + the "burning reserves / getting fat"
// condition flags from the roadmap.
function BodyWeightStrip({ weight }) {
  if (weight.trend == null) return null;
  const Icon = weight.trend === "losing" ? TrendingDown
    : weight.trend === "gaining" ? TrendingUp
      : null;
  return (
    <div className="flex items-center gap-2.5 mt-3 text-[12px]">
      <span className="text-dim">Body weight:</span>
      <span className="text-fg font-semibold inline-flex items-center gap-1">
        {Icon && <Icon size={13} className="shrink-0" />}
        {weight.trend === "baseline"
          ? `${fmtMetric(weight.latestAvg)} lb baseline`
          : `${fmtMetric(weight.latestAvg)} lb · ` +
            `${weight.pctChange >= 0 ? "+" : ""}` +
            `${weight.pctChange.toFixed(1)}% since last weigh-in`}
      </span>
      {weight.flag === "burning_reserves" && (
        <FlagBadge text="Burning reserves — laying off body weight, will crash" />
      )}
      {weight.flag === "getting_fat" && (
        <FlagBadge text="Gaining fat — production drop / fatty liver risk" />
      )}
    </div>
  );
}

function FlagBadge({ text }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold text-warn border border-warn/50 px-2 py-0.5">
      {text}
    </span>
  );
}

// ── weigh-ins capture + history ───────────────────────────────────────

function WeighInsCard({ samples, onRecord, onRemove }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10));
  const [weightsText, setWeightsText] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const parsed = useMemo(
    () => weightsText.split(/[,\s]+/).map(Number).filter(Number.isFinite),
    [weightsText]
  );
  const sums = useMemo(() => summarizeSamples(samples).reverse(), [samples]);

  const submit = async () => {
    if (parsed.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onRecord({ sampledOn: date, weights: parsed, notes });
      setWeightsText("");
      setNotes("");
      setOpen(false);
    } catch (e) {
      setError(e.message ?? "Couldn't save the weigh-in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Weigh-ins" icon={Scale}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="self-start inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
        >
          <Plus size={13} className="shrink-0" /> Record a sample
        </button>
      ) : (
        <div className="flex flex-col gap-3 border border-line bg-surface-alt px-3.5 py-3">
          <div className="flex items-end gap-3 flex-wrap">
            <FieldLabel label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls + " w-[150px]"}
              />
            </FieldLabel>
            <div className="text-[11px] text-dim pb-2">
              {parsed.length} weight{parsed.length === 1 ? "" : "s"} entered
              {parsed.length > 0 &&
                ` · avg ${fmtMetric(
                  parsed.reduce((a, b) => a + b, 0) / parsed.length)} lb`}
            </div>
          </div>
          <FieldLabel label="Individual weights (lb) — separate with spaces or commas">
            <textarea
              autoFocus
              value={weightsText}
              onChange={(e) => setWeightsText(e.target.value)}
              rows={3}
              placeholder="4.2 4.5 3.9 4.1 4.4 …  (grab a random 10–20 birds)"
              className={inputCls + " resize-y leading-relaxed"}
            />
          </FieldLabel>
          <FieldLabel label="Notes (optional)">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Hanging scale, before morning feed"
              className={inputCls}
            />
          </FieldLabel>
          {error && <div className="text-[12px] text-warn">{error}</div>}
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={saving || parsed.length === 0}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save weigh-in"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(null); }}
              disabled={saving}
              className="bg-transparent border border-line text-dim font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sums.length > 0 && (
        <ul className="m-0 mt-3 p-0 list-none flex flex-col divide-y divide-line">
          {sums.map((s) => (
            <li key={s.id} className="flex items-baseline gap-3 py-2">
              <span className="text-[12px] text-dim w-[88px] shrink-0">
                {formatDate(s.dateISO)}
              </span>
              <span className="text-[13px] text-fg font-semibold">
                {fmtMetric(s.avg)} lb avg
              </span>
              <span className="text-[11px] text-dim">
                {s.n} bird{s.n === 1 ? "" : "s"}
                {s.cv != null && ` · CV ${s.cv.toFixed(1)}%`}
              </span>
              {s.notes && (
                <span className="text-[11px] text-faint truncate">
                  {s.notes}
                </span>
              )}
              <button
                onClick={() => onRemove(s.id)}
                className="ml-auto bg-transparent border-0 p-1 text-faint hover:text-warn cursor-pointer"
                title="Delete this weigh-in"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {sums.length === 0 && !open && (
        <div className="text-[12px] text-dim italic mt-3">
          No weigh-ins yet. A weekly random 10–20 bird sample powers the
          gain, conversion, and uniformity numbers.
        </div>
      )}
    </Card>
  );
}

// ── egg log capture + history ─────────────────────────────────────────

function EggLogCard({ collections, onRecord, onRemove }) {
  const [date, setDate] = useState(
    () => new Date().toISOString().slice(0, 10));
  const [count, setCount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const recent = (collections ?? []).slice(0, 14);
  const last7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const iso = cutoff.toISOString().slice(0, 10);
    return (collections ?? [])
      .filter((c) => c.collectedOn >= iso)
      .reduce((a, c) => a + (c.count ?? 0), 0);
  }, [collections]);

  const parsedCount = Number(count);
  const canSubmit = Number.isFinite(parsedCount) && parsedCount > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onRecord({ collectedOn: date, count: parsedCount });
      setCount("");
    } catch (e) {
      setError(e.message ?? "Couldn't log the eggs.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Egg log"
      icon={Egg}
      subtitle={last7 > 0 ? `${last7} this week` : null}
    >
      <div className="flex items-end gap-3 flex-wrap">
        <FieldLabel label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls + " w-[150px]"}
          />
        </FieldLabel>
        <FieldLabel label="Eggs">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="0"
            className={inputCls + " w-[90px]"}
          />
        </FieldLabel>
        <button
          onClick={submit}
          disabled={saving || !canSubmit}
          className="inline-flex items-center gap-1.5 bg-accent text-on-accent border-0 font-[inherit] text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-2 cursor-pointer disabled:opacity-50"
        >
          {saving ? "Saving…" : "Log"}
        </button>
      </div>
      <p className="text-[11px] text-faint leading-relaxed m-0 mt-2">
        Counts also come in from the Eggs quick action in Rounds — both
        land in the same log.
      </p>
      {error && <div className="text-[12px] text-warn mt-2">{error}</div>}

      {recent.length > 0 && (
        <ul className="m-0 mt-3 p-0 list-none flex flex-col divide-y divide-line">
          {recent.map((c) => (
            <li key={c.id} className="flex items-baseline gap-3 py-2">
              <span className="text-[12px] text-dim w-[88px] shrink-0">
                {formatDate(c.collectedOn)}
              </span>
              <span className="text-[13px] text-fg font-semibold">
                {c.count} egg{c.count === 1 ? "" : "s"}
              </span>
              {c.notes && (
                <span className="text-[11px] text-faint truncate">
                  {c.notes}
                </span>
              )}
              <button
                onClick={() => onRemove(c.id)}
                className="ml-auto bg-transparent border-0 p-1 text-faint hover:text-warn cursor-pointer"
                title="Delete this entry"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {recent.length === 0 && (
        <div className="text-[12px] text-dim italic mt-3">
          No egg counts yet. Hen-housed production and feed-per-dozen
          start computing once counts come in.
        </div>
      )}
    </Card>
  );
}

// ── shared pieces ─────────────────────────────────────────────────────

const inputCls =
  "bg-surface border border-line text-fg text-[13px] px-2.5 py-2 " +
  "outline-none focus:border-accent font-[inherit] w-full";

function Card({ title, icon: Icon, subtitle, children }) {
  return (
    <section className="bg-surface border border-line py-4 px-5 flex flex-col">
      <header className="flex items-baseline gap-2.5 mb-3">
        {Icon && <Icon size={14} className="text-dim translate-y-0.5" />}
        <div className="font-ui text-[11px] text-fg uppercase tracking-[0.14em] font-bold">
          {title}
        </div>
        {subtitle && (
          <div className="text-[12px] text-dim ml-auto">{subtitle}</div>
        )}
      </header>
      {children}
    </section>
  );
}

function MetricStat({ label, value, sub, tone }) {
  return (
    <div>
      <div className="text-[9px] text-faint uppercase tracking-[0.12em] mb-0.5">
        {label}
      </div>
      <div
        className={
          "font-heading text-[22px] font-semibold leading-tight " +
          (tone === "warn" ? "text-warn" : "text-fg")
        }
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function FieldLabel({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-semibold">
        {label}
      </span>
      {children}
    </label>
  );
}

// "within pasture target 2.2–3.0" / "above pasture target 2.2–3.0"
function bandLabel(value, low, high, bandText) {
  if (value < low) return `below ${bandText}`;
  if (value > high) return `above ${bandText}`;
  return `within ${bandText}`;
}

function CaveatList({ caveats }) {
  if (!caveats?.length) return null;
  return (
    <ul className="m-0 mt-3 p-0 list-none flex flex-col gap-1">
      {caveats.map((c, i) => (
        <li key={i} className="text-[11px] text-faint leading-relaxed">
          · {c}
        </li>
      ))}
    </ul>
  );
}

function dedupe(arr) {
  return [...new Set(arr)];
}
