// Metrics & analytics engine (Batch 26.1).
//
// Pure functions only — every metric takes plain data (groups, weight
// samples, egg collections, mortality events, feed schedules) and
// returns { value, ... , caveats } shapes. Anything that can't be
// computed honestly (no samples yet, free-choice feed schedule, no
// arrival date) comes back as a caveat instead of a silently-wrong
// number — same philosophy as lib/feedConsumption.js.
//
// Units: weights are pounds unless a sample says otherwise; feed is
// pounds; egg mass uses ounces for per-egg weight and pounds for
// totals.

// Day-old Cornish Cross chick ≈ 40 g. Used as the gain baseline when a
// batch has weigh-ins but we need "weight at arrival".
export const CHICK_WEIGHT_LB = 0.09;

// USDA large egg ≈ 2 oz. Fallback when a collection doesn't record an
// average egg weight.
export const DEFAULT_EGG_WEIGHT_OZ = 2.0;

// ── small stats helpers ───────────────────────────────────────────────

export function mean(values) {
  if (!values?.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values) {
  if (!values || values.length < 2) return null;
  const m = mean(values);
  const variance = values.reduce((a, v) => a + (v - m) ** 2, 0)
    / (values.length - 1);
  return Math.sqrt(variance);
}

// Coefficient of variation as a percentage — the uniformity metric.
export function coefficientOfVariation(values) {
  const m = mean(values);
  const sd = stdDev(values);
  if (m == null || sd == null || m === 0) return null;
  return (sd / m) * 100;
}

// ── date helpers (local-noon to dodge DST edges) ─────────────────────

function atNoon(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetweenISO(fromISO, toISO) {
  const from = atNoon(fromISO);
  const to = atNoon(toISO);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// ── weight samples ────────────────────────────────────────────────────

// Normalize one weight_samples row into { dateISO, weights, avg, cv, n }.
// Tolerates malformed jsonb (non-numeric entries are dropped).
export function summarizeSample(sample) {
  const weights = (Array.isArray(sample.weights) ? sample.weights : [])
    .map(Number)
    .filter(Number.isFinite);
  return {
    id: sample.id,
    dateISO: sample.sampledOn,
    weights,
    n: weights.length,
    avg: mean(weights),
    cv: coefficientOfVariation(weights),
    unit: sample.unit ?? "lb",
    notes: sample.notes ?? null,
  };
}

// Chronologically-sorted summaries (oldest → newest), dropping empty
// samples.
export function summarizeSamples(samples) {
  return (samples ?? [])
    .map(summarizeSample)
    .filter(s => s.n > 0)
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
}

// Average Daily Gain in lb/bird/day.
//   2+ samples → slope between the first and latest sample averages.
//   1 sample + arrival date → anchored to day-old chick weight.
// Returns { value, fromISO, toISO, basis, caveats }.
export function averageDailyGain(samples, group) {
  const sums = summarizeSamples(samples);
  const caveats = [];
  if (sums.length === 0) {
    caveats.push("No weigh-ins recorded yet — log a 10–20 bird sample.");
    return { value: null, caveats };
  }
  const latest = sums[sums.length - 1];
  if (sums.length >= 2) {
    const first = sums[0];
    const days = daysBetweenISO(first.dateISO, latest.dateISO);
    if (!days) {
      caveats.push("All weigh-ins are on the same day — need two dates.");
      return { value: null, caveats };
    }
    return {
      value: (latest.avg - first.avg) / days,
      fromISO: first.dateISO,
      toISO: latest.dateISO,
      basis: "samples",
      caveats,
    };
  }
  if (!group?.arrivalDate) {
    caveats.push(
      "Only one weigh-in and no arrival date — can't anchor the gain.");
    return { value: null, caveats };
  }
  const days = daysBetweenISO(group.arrivalDate, latest.dateISO);
  if (!days || days <= 0) {
    caveats.push("Weigh-in is on or before the arrival date.");
    return { value: null, caveats };
  }
  return {
    value: (latest.avg - CHICK_WEIGHT_LB) / days,
    fromISO: group.arrivalDate,
    toISO: latest.dateISO,
    basis: "arrival_anchor",
    caveats,
  };
}

// Uniformity = CV of the latest sample. Under 8% reads as tight.
export function uniformity(samples) {
  const sums = summarizeSamples(samples);
  if (sums.length === 0) {
    return { value: null, caveats: ["No weigh-ins recorded yet."] };
  }
  const latest = sums[sums.length - 1];
  if (latest.n < 5) {
    return {
      value: latest.cv,
      dateISO: latest.dateISO,
      n: latest.n,
      caveats: [
        `Latest sample is only ${latest.n} bird${latest.n === 1 ? "" : "s"}` +
        " — uniformity wants 10–20 for a meaningful spread.",
      ],
    };
  }
  return { value: latest.cv, dateISO: latest.dateISO, n: latest.n, caveats: [] };
}

// ── mortality ─────────────────────────────────────────────────────────

// mortalityEvents: [{ occurredAt, count }] from activity_log
// mortality_observed rows for this group.
export function mortalityStats(group, mortalityEvents) {
  const lost = (mortalityEvents ?? [])
    .reduce((a, e) => a + (Number(e.count) || 0), 0);
  const placed = Number.isFinite(group?.placedCount)
    ? group.placedCount
    : Number.isFinite(group?.count) ? group.count + lost : null;
  const caveats = [];
  if (!Number.isFinite(group?.placedCount)) {
    caveats.push(
      "No placed count recorded — using live count + logged losses.");
  }
  return {
    placed,
    lost,
    ratePct: placed > 0 ? (lost / placed) * 100 : null,
    caveats,
  };
}

// ── feed consumed (projected from the schedule) ───────────────────────

// Total feed a single group is projected to have eaten between two
// dates (inclusive start, exclusive end), summed across every metered
// stage of every schedule it's assigned to. Mirrors the per-day walk in
// lib/feedConsumption.js but scoped to one group and integrated over a
// window in closed form (days-in-stage × daily amount) instead of a
// day loop.
//
// Returns { totalLb, totalCost, byFeed: Map<feedTypeId, lb>, caveats }.
export function feedConsumedForGroup(group, fromISO, toISO, ctx) {
  const { feedSchedules = [], feeds = [] } = ctx ?? {};
  const caveats = [];
  const byFeed = new Map();
  let totalLb = 0;

  const from = atNoon(fromISO);
  const to = atNoon(toISO);
  if (!from || !to || to <= from) {
    return { totalLb: 0, totalCost: null, byFeed, caveats };
  }
  const windowDays = Math.round((to - from) / 86400000);

  const feedsById = new Map(feeds.map(f => [f.id, f]));

  for (const schedule of feedSchedules) {
    if (!(schedule.assignedGroupIds ?? []).includes(group.id)) continue;

    for (const stage of schedule.stages ?? []) {
      const c = stage.consumption;
      const ongoing = (stage.startDay ?? 0) === 0 && stage.endDay == null;

      // Which slice of the window does this stage cover?
      let stageDays;
      if (ongoing) {
        stageDays = windowDays;
      } else if (!group.arrivalDate) {
        caveats.push(
          `${stage.name}: ${group.label} has no arrival date to anchor ` +
          "day-ranged stages.");
        continue;
      } else {
        // Stage covers [arrival + startDay, arrival + endDay). Clip to
        // the requested window.
        const arrival = atNoon(group.arrivalDate);
        const stageStart = new Date(
          arrival.getTime() + (stage.startDay ?? 0) * 86400000);
        const stageEnd = stage.endDay == null
          ? to
          : new Date(arrival.getTime() + stage.endDay * 86400000);
        const overlapStart = Math.max(stageStart.getTime(), from.getTime());
        const overlapEnd = Math.min(stageEnd.getTime(), to.getTime());
        stageDays = Math.max(
          0, Math.round((overlapEnd - overlapStart) / 86400000));
      }
      if (stageDays === 0) continue;

      if (!c || c.type === "tbd") {
        caveats.push(`${stage.name}: amounts aren't captured yet.`);
        continue;
      }
      if (c.type === "free_choice") {
        caveats.push(
          `${stage.name}: free-choice — no daily amount to project from.`);
        continue;
      }
      if (c.type !== "metered") continue;

      const perAnimal = c.basis === "bird" || c.basis === "head";
      const daily = perAnimal
        ? (c.amount ?? 0) * (group.count ?? 0)
        : (c.amount ?? 0);
      const lb = daily * stageDays;
      totalLb += lb;
      if (stage.feedTypeId) {
        byFeed.set(stage.feedTypeId, (byFeed.get(stage.feedTypeId) ?? 0) + lb);
      }
    }
  }

  // Cost: per-feed pounds × that feed's cost_per_unit. Only priced when
  // every consumed feed has a cost; otherwise cost is null + caveat.
  let totalCost = 0;
  let costComplete = byFeed.size > 0;
  for (const [feedId, lb] of byFeed) {
    const feed = feedsById.get(feedId);
    const per = Number(feed?.costPerUnit?.amount);
    if (!Number.isFinite(per)) {
      costComplete = false;
      caveats.push(
        `${feed?.name ?? feedId}: no cost per unit — feed cost is partial.`);
      continue;
    }
    totalCost += lb * per;
  }

  return {
    totalLb,
    totalCost: costComplete ? totalCost : null,
    byFeed,
    caveats,
  };
}

// ── broiler metrics ───────────────────────────────────────────────────

// Feed Conversion Ratio = lb feed eaten ÷ lb liveweight gained.
// Gain = live count × (latest sample avg − chick weight). Feed eaten by
// birds that died stays in the numerator — that's the honest number.
export function feedConversionRatio(group, samples, ctx, asOfISO) {
  const sums = summarizeSamples(samples);
  const caveats = [];
  if (sums.length === 0) {
    return { value: null, caveats: ["No weigh-ins recorded yet."] };
  }
  if (!group.arrivalDate) {
    return { value: null, caveats: ["No arrival date on the batch."] };
  }
  const latest = sums[sums.length - 1];
  const upTo = asOfISO ?? latest.dateISO;
  const feed = feedConsumedForGroup(group, group.arrivalDate, upTo, ctx);
  caveats.push(...feed.caveats);
  if (feed.totalLb <= 0) {
    caveats.push("No metered feed consumption to project from.");
    return { value: null, feedLb: 0, caveats };
  }
  const liveCount = Number.isFinite(group.count) ? group.count : null;
  if (!liveCount) {
    caveats.push("No live count on the batch.");
    return { value: null, feedLb: feed.totalLb, caveats };
  }
  const gain = liveCount * (latest.avg - CHICK_WEIGHT_LB);
  if (gain <= 0) {
    caveats.push("Latest sample average is at or below chick weight.");
    return { value: null, feedLb: feed.totalLb, caveats };
  }
  return {
    value: feed.totalLb / gain,
    feedLb: feed.totalLb,
    feedCost: feed.totalCost,
    gainLb: gain,
    asOfISO: upTo,
    caveats,
  };
}

// Weeks-on-farm / weeks-remaining.
//   processingISO (a scheduled processing event date) wins when set;
//   otherwise arrival + species.targetProcessWeeks.
export function weeksTimeline(group, species, processingISO) {
  const caveats = [];
  if (!group?.arrivalDate) {
    return { weeksOnFarm: null, weeksRemaining: null,
      caveats: ["No arrival date on the batch."] };
  }
  const daysOnFarm = daysBetweenISO(group.arrivalDate, todayISO());
  const weeksOnFarm = daysOnFarm == null ? null : daysOnFarm / 7;

  let endISO = processingISO ?? null;
  let basis = "processing_event";
  if (!endISO) {
    const target = Number(species?.targetProcessWeeks);
    if (Number.isFinite(target)) {
      const arrival = atNoon(group.arrivalDate);
      const end = new Date(arrival.getTime() + target * 7 * 86400000);
      const m = String(end.getMonth() + 1).padStart(2, "0");
      const d = String(end.getDate()).padStart(2, "0");
      endISO = `${end.getFullYear()}-${m}-${d}`;
      basis = "species_target";
    } else {
      caveats.push(
        "No processing event scheduled and no species target weeks.");
      return { weeksOnFarm, weeksRemaining: null, caveats };
    }
  }
  const daysRemaining = daysBetweenISO(todayISO(), endISO);
  return {
    weeksOnFarm,
    weeksRemaining: daysRemaining == null ? null : daysRemaining / 7,
    endISO,
    basis,
    caveats,
  };
}

// ── layer metrics ─────────────────────────────────────────────────────

// Total eggs across collections, optionally clipped to a window.
function totalEggs(collections, fromISO, toISO) {
  let total = 0;
  for (const c of collections ?? []) {
    if (fromISO && c.collectedOn < fromISO) continue;
    if (toISO && c.collectedOn > toISO) continue;
    total += Number(c.count) || 0;
  }
  return total;
}

// Hen-housed production = cumulative eggs ÷ hens originally placed.
export function henHousedProduction(group, collections) {
  const caveats = [];
  const eggs = totalEggs(collections);
  if (!collections?.length) {
    caveats.push("No egg collections logged yet.");
    return { value: null, eggs: 0, caveats };
  }
  const placed = Number.isFinite(group?.placedCount)
    ? group.placedCount
    : Number.isFinite(group?.count) ? group.count : null;
  if (!placed) {
    caveats.push("No placed count (or live count) on the flock.");
    return { value: null, eggs, caveats };
  }
  if (!Number.isFinite(group?.placedCount)) {
    caveats.push("No placed count recorded — using the live count, which " +
      "understates the denominator if hens have died.");
  }
  return { value: eggs / placed, eggs, placed, caveats };
}

// Feed per dozen + feed per lb of egg mass over the collection window
// (first collection date → last collection date).
export function layerFeedEfficiency(group, collections, ctx) {
  const caveats = [];
  const sorted = [...(collections ?? [])]
    .sort((a, b) => (a.collectedOn < b.collectedOn ? -1 : 1));
  if (sorted.length === 0) {
    return { perDozen: null, perLbEggMass: null,
      caveats: ["No egg collections logged yet."] };
  }
  const fromISO = sorted[0].collectedOn;
  const toISO = sorted[sorted.length - 1].collectedOn;
  if (fromISO === toISO) {
    return { perDozen: null, perLbEggMass: null,
      caveats: ["All collections are on one day — need a longer window."] };
  }

  const feed = feedConsumedForGroup(group, fromISO, toISO, ctx);
  caveats.push(...feed.caveats);
  if (feed.totalLb <= 0) {
    caveats.push("Flock's feed schedule has no metered amounts — set " +
      "one in Manage feed to compute feed efficiency.");
    return { perDozen: null, perLbEggMass: null, caveats };
  }

  const eggs = totalEggs(sorted, fromISO, toISO);
  if (eggs === 0) {
    return { perDozen: null, perLbEggMass: null, feedLb: feed.totalLb,
      caveats: [...caveats, "Zero eggs in the window."] };
  }

  // Egg mass in lb: per-collection avg weight (oz) falls back to the
  // USDA-large 2.0 oz default.
  let eggMassOz = 0;
  for (const c of sorted) {
    const per = Number(c.avgEggWeightOz) || DEFAULT_EGG_WEIGHT_OZ;
    eggMassOz += (Number(c.count) || 0) * per;
  }

  return {
    perDozen: feed.totalLb / (eggs / 12),
    perLbEggMass: feed.totalLb / (eggMassOz / 16),
    feedLb: feed.totalLb,
    eggs,
    fromISO,
    toISO,
    caveats,
  };
}

// Recent laying rate: eggs per hen per day over the trailing window.
export function layingRate(group, collections, windowDays = 14) {
  const caveats = [];
  if (!collections?.length) {
    return { value: null, caveats: ["No egg collections logged yet."] };
  }
  const hens = Number.isFinite(group?.count) ? group.count : null;
  if (!hens) {
    return { value: null, caveats: ["No live count on the flock."] };
  }
  const today = todayISO();
  const from = atNoon(today);
  from.setDate(from.getDate() - windowDays);
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  const fromISO = `${from.getFullYear()}-${m}-${d}`;
  const eggs = totalEggs(collections, fromISO, today);
  if (eggs === 0) {
    caveats.push(`No eggs logged in the last ${windowDays} days.`);
    return { value: null, caveats };
  }
  return { value: eggs / hens / windowDays, windowDays, eggs, caveats };
}

// Body weight trend with condition flags.
//   Compares the latest sample average to the previous one:
//     losing > 2%  → "burning_reserves" (will crash)
//     gaining > 5% → "getting_fat" (production drop / fatty liver risk)
export function bodyWeightTrend(samples) {
  const sums = summarizeSamples(samples);
  if (sums.length === 0) {
    return { trend: null, flag: null, caveats: ["No weigh-ins recorded yet."] };
  }
  if (sums.length === 1) {
    return {
      trend: "baseline",
      flag: null,
      latestAvg: sums[0].avg,
      caveats: ["Only one weigh-in — log another to see the trend."],
    };
  }
  const prev = sums[sums.length - 2];
  const latest = sums[sums.length - 1];
  const pctChange = ((latest.avg - prev.avg) / prev.avg) * 100;
  let trend = "stable";
  let flag = null;
  if (pctChange <= -2) { trend = "losing"; flag = "burning_reserves"; }
  else if (pctChange >= 5) { trend = "gaining"; flag = "getting_fat"; }
  else if (pctChange > 0) trend = "gaining";
  else if (pctChange < 0) trend = "losing";
  return {
    trend,
    flag,
    pctChange,
    latestAvg: latest.avg,
    prevAvg: prev.avg,
    fromISO: prev.dateISO,
    toISO: latest.dateISO,
    caveats: [],
  };
}

// ── display helpers ───────────────────────────────────────────────────

// "2.41", "6.3%", "0.14 lb/day" — consistent rounding for metric values.
export function fmtMetric(value, { digits = 2, suffix = "" } = {}) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = value.toFixed(digits);
  return suffix ? `${rounded}${suffix}` : rounded;
}

// Whether a species' purpose marks it as a layer flock vs meat batch.
export function isLayerSpecies(species) {
  return /egg/i.test(species?.purpose ?? "");
}

export function isMeatSpecies(species) {
  return /meat/i.test(species?.purpose ?? "");
}
