// Feed consumption + reorder projection (Batch 25.1).
//
// Every batch of animals is on a feed program: feed_schedules describe
// exactly how much of which feed each assigned group eats over time
// (feed_schedule_stages, anchored to the group's arrival date). Daily
// consumption for a feed type is therefore fully derivable — sum the
// metered stages covering each assigned group's age on a given day.
//
// The reorder projection walks forward day by day (consumption changes
// as batches age through stages), subtracting from on-hand stock until
// it crosses the user-defined reorder point. That crossing is the
// trigger date; the suggested order date is the closest business day
// ON OR BEFORE the trigger (no weekend orders).
//
// Anything the schedules can't meter (free-choice stages, TBD stages,
// unit mismatches, groups with no arrival date for day-ranged stages)
// is reported as a caveat instead of being silently treated as zero.

// ── date helpers ──────────────────────────────────────────────────────

// Local-noon Date for an ISO day — dodges DST edges when adding days.
function atNoon(iso) {
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISO(new Date());
}

function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function daysBetween(fromNoon, toNoon) {
  return Math.round((toNoon.getTime() - fromNoon.getTime()) / 86400000);
}

// Closest business day on or before `date` (a local-noon Date):
// Saturday → Friday, Sunday → Friday, weekdays unchanged.
export function businessDayOnOrBefore(date) {
  const d = new Date(date.getTime());
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// ── per-day consumption ───────────────────────────────────────────────

// How much of `feed` gets eaten on `dateISO`, summed across every
// schedule stage that targets it and every group assigned to that
// schedule.
//
// Returns { amount, unit, caveats } where caveats is a list of
// { kind, scheduleName, stageName, groupLabel?, detail } explaining
// every consumer that could NOT be metered:
//   "free_choice"   — stage is free-choice (no number to use)
//   "tbd"           — stage amounts not captured yet
//   "no_anchor"     — day-ranged stage but the group has no arrival
//                     date to anchor it to
//   "unit_mismatch" — stage unit differs from the feed's stock unit
export function dailyConsumptionForFeed(feed, dateISO, ctx) {
  const { feedSchedules = [], livestock = { species: [] } } = ctx ?? {};
  const date = atNoon(dateISO);
  const stockUnit = feed.onHand?.unit ?? feed.unit ?? null;

  const groupsById = new Map();
  for (const sp of livestock.species ?? []) {
    for (const g of sp.groups ?? []) groupsById.set(g.id, g);
  }

  let amount = 0;
  let metered = false;
  const caveats = [];

  for (const schedule of feedSchedules) {
    const stages = (schedule.stages ?? [])
      .filter(st => st.feedTypeId === feed.id);
    if (stages.length === 0) continue;

    for (const groupId of schedule.assignedGroupIds ?? []) {
      const group = groupsById.get(groupId);
      if (!group) continue;

      for (const stage of stages) {
        const c = stage.consumption;
        // Which day of the program is this group on?
        const ongoing = (stage.startDay ?? 0) === 0 && stage.endDay == null;
        let inStage;
        if (ongoing) {
          // Ongoing stages (layers, sheep) apply regardless of anchor.
          inStage = true;
        } else if (!group.arrivalDate) {
          // Day-ranged stage with nothing to anchor it to.
          caveats.push({
            kind: "no_anchor",
            scheduleName: schedule.name,
            stageName: stage.name,
            groupLabel: group.label,
            detail: `${group.label} has no arrival date — can't tell ` +
              `which stage it's on.`,
          });
          continue;
        } else {
          const arrival = atNoon(group.arrivalDate);
          if (!arrival) continue;
          const age = daysBetween(arrival, date);
          inStage = age >= (stage.startDay ?? 0) &&
            (stage.endDay == null || age < stage.endDay);
        }
        if (!inStage) continue;

        if (!c || c.type === "tbd") {
          caveats.push({
            kind: "tbd",
            scheduleName: schedule.name,
            stageName: stage.name,
            groupLabel: group.label,
            detail: `${stage.name} amounts aren't captured yet.`,
          });
          continue;
        }
        if (c.type === "free_choice") {
          caveats.push({
            kind: "free_choice",
            scheduleName: schedule.name,
            stageName: stage.name,
            groupLabel: group.label,
            detail: `${stage.name} is free-choice — no daily amount ` +
              `to project from.`,
          });
          continue;
        }
        if (c.type !== "metered") continue;

        // Unit check: consumption must be in the same unit the stock
        // is tracked in, or the math is meaningless.
        if (stockUnit && c.unit && c.unit !== stockUnit) {
          caveats.push({
            kind: "unit_mismatch",
            scheduleName: schedule.name,
            stageName: stage.name,
            groupLabel: group.label,
            detail: `${stage.name} is metered in ${c.unit} but stock ` +
              `is tracked in ${stockUnit}.`,
          });
          continue;
        }

        // basis "batch"/"group" → flat amount; "bird"/"head" → per
        // animal, scaled by the group count.
        const perAnimal = c.basis === "bird" || c.basis === "head";
        const qty = perAnimal
          ? (c.amount ?? 0) * (group.count ?? 0)
          : (c.amount ?? 0);
        amount += qty;
        metered = true;
      }
    }
  }

  return { amount, unit: stockUnit, metered, caveats };
}

// ── reorder projection ────────────────────────────────────────────────

const PROJECTION_HORIZON_DAYS = 365;

// Project when `feed` will hit its reorder point.
//
// Returns one of:
//   { kind: "untracked" }           — no on-hand amount recorded
//   { kind: "no_reorder_point" }    — no reorder point defined
//   { kind: "order_now" }           — already at/below the point
//   { kind: "projected", triggerDateISO, orderByDateISO, daysUntil,
//     dailyRateToday, caveats }     — the projection
//   { kind: "beyond_horizon", caveats } — metered consumption exists
//     but stock won't reach the point within a year
//   { kind: "no_consumption", caveats } — nothing metered eats this
//     feed inside the horizon, so stock never reaches the point.
// Every shape carries `caveats` (possibly empty) listing the
// consumers the schedules couldn't meter.
export function projectReorder(feed, ctx) {
  const onHand = Number(feed.onHand?.amount);
  const reorderAt = Number(feed.reorderPoint?.amount);

  // Collect today's caveats up front — they apply to every shape.
  const today = todayISO();
  const todayResult = dailyConsumptionForFeed(feed, today, ctx);
  const caveats = todayResult.caveats;

  if (!Number.isFinite(onHand)) return { kind: "untracked", caveats };
  if (!Number.isFinite(reorderAt)) {
    return { kind: "no_reorder_point", caveats };
  }
  if (onHand <= reorderAt) return { kind: "order_now", caveats };

  let remaining = onHand;
  const start = atNoon(today);
  let consumedAnything = false;

  for (let i = 0; i < PROJECTION_HORIZON_DAYS; i++) {
    const day = addDays(start, i);
    const { amount } = dailyConsumptionForFeed(feed, toISO(day), ctx);
    if (amount > 0) consumedAnything = true;
    remaining -= amount;
    if (remaining <= reorderAt) {
      const trigger = day;
      const orderBy = businessDayOnOrBefore(trigger);
      return {
        kind: "projected",
        triggerDateISO: toISO(trigger),
        orderByDateISO: toISO(orderBy),
        daysUntil: daysBetween(start, orderBy),
        dailyRateToday: todayResult.amount,
        caveats,
      };
    }
  }

  return consumedAnything
    ? { kind: "beyond_horizon", caveats }
    : { kind: "no_consumption", caveats };
}

// ── consolidation summary ─────────────────────────────────────────────

// One row per feed, sorted most-urgent first — the "what else should
// ride on this delivery?" panel. `windowDays` controls what counts as
// "coming up" (default: within 2 weeks).
export function consolidationSummary(feeds, ctx, { windowDays = 14 } = {}) {
  const rows = (feeds ?? []).map(feed => {
    const projection = projectReorder(feed, ctx);
    const urgency =
      projection.kind === "order_now" ? 0
        : projection.kind === "projected" ? projection.daysUntil
          : Infinity;
    return { feed, projection, urgency };
  });
  rows.sort((a, b) => a.urgency - b.urgency);
  const anyDue = rows.some(r =>
    r.projection.kind === "order_now" ||
    (r.projection.kind === "projected" &&
      r.projection.daysUntil <= windowDays)
  );
  return { rows, anyDue };
}

// ── display helpers ───────────────────────────────────────────────────

export function formatAmount(jsonAmount) {
  if (!jsonAmount || jsonAmount.amount == null) return null;
  const n = Number(jsonAmount.amount);
  const formatted = Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${formatted} ${jsonAmount.unit ?? ""}`.trim();
}

// "Fri, Jun 5" / "today" / "tomorrow" for projection dates.
export function formatOrderDate(iso) {
  if (!iso) return null;
  const target = atNoon(iso);
  const today = atNoon(todayISO());
  const diff = daysBetween(today, target);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  return target.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
