// feedConsumption — feed metering + reorder projection (Batch 25.1).
// Pure math over the app-wide data ctx ({ feedSchedules, livestock },
// mirroring exactly how Feeds.jsx assembles it): per-day consumption
// summed across schedule stages and assigned groups, the day-by-day
// walk to the reorder point with its business-day order date, the
// consolidation panel's sort/window logic, and the display formatters.
// Time-anchored paths (todayISO drives projectReorder + formatOrderDate)
// run under fake timers pinned to Wednesday 2026-06-03.
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from "vitest";
import {
  todayISO, businessDayOnOrBefore, dailyConsumptionForFeed,
  projectReorder, consolidationSummary, formatAmount,
  describeConsumption, formatOrderDate,
} from "./feedConsumption.js";

// A Wednesday. Every projection walk in this file starts here.
const TODAY = "2026-06-03";

const noon = (iso) => new Date(iso + "T12:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(noon(TODAY));
});

afterEach(() => {
  vi.useRealTimers();
});

// ── fixtures (shapes lifted from nff-data.json / Feeds.jsx) ──────────

function group(id, over = {}) {
  return { id, label: id, count: 10, arrivalDate: null, ...over };
}

function metered(amount, over = {}) {
  return { type: "metered", amount, unit: "lb", basis: "batch", ...over };
}

// Ongoing by default (startDay 0, endDay null) — applies to a group
// even when it has no arrival date to anchor to.
function stageFx(over = {}) {
  return {
    id: "st1", name: "Stage 1", feedTypeId: "grower",
    startDay: 0, endDay: null, consumption: metered(10),
    ...over,
  };
}

function ctxFx(stages, groups, assignedGroupIds) {
  return {
    feedSchedules: [{
      id: "sched1", name: "Test schedule", stages,
      assignedGroupIds: assignedGroupIds ?? groups.map((g) => g.id),
    }],
    livestock: { species: [{ id: "sp1", groups }] },
  };
}

function feedFx(over = {}) {
  return {
    id: "grower", name: "Grower", unit: "lb",
    onHand: { amount: 100, unit: "lb" },
    reorderPoint: { amount: 20, unit: "lb" },
    ...over,
  };
}

// ── todayISO ─────────────────────────────────────────────────────────

describe("todayISO", () => {
  it("returns the local calendar date of the (mocked) clock", () => {
    expect(todayISO()).toBe("2026-06-03");
  });

  it("uses local time, not UTC — late evening stays the same day", () => {
    vi.setSystemTime(new Date("2026-06-03T23:30:00"));
    expect(todayISO()).toBe("2026-06-03");
  });
});

// ── businessDayOnOrBefore ────────────────────────────────────────────

describe("businessDayOnOrBefore", () => {
  it("rolls a Saturday back to the preceding Friday", () => {
    const out = businessDayOnOrBefore(noon("2026-06-06"));
    expect(out.toDateString()).toBe(noon("2026-06-05").toDateString());
  });

  it("rolls a Sunday back two days to the same Friday", () => {
    const out = businessDayOnOrBefore(noon("2026-06-07"));
    expect(out.toDateString()).toBe(noon("2026-06-05").toDateString());
  });

  it("leaves a weekday where it is", () => {
    const out = businessDayOnOrBefore(noon("2026-06-03"));
    expect(out.toDateString()).toBe(noon("2026-06-03").toDateString());
  });

  it("does not mutate the Date it was given", () => {
    const sat = noon("2026-06-06");
    businessDayOnOrBefore(sat);
    expect(sat.toDateString()).toBe(noon("2026-06-06").toDateString());
  });
});

// ── dailyConsumptionForFeed ──────────────────────────────────────────

describe("dailyConsumptionForFeed", () => {
  it("with no schedules returns zero, unmetered, no caveats", () => {
    const out = dailyConsumptionForFeed(feedFx(), TODAY, {
      feedSchedules: [], livestock: { species: [] },
    });
    expect(out).toEqual({
      amount: 0, unit: "lb", metered: false, caveats: [],
    });
  });

  it("tolerates a missing ctx entirely (defaults to empty)", () => {
    const out = dailyConsumptionForFeed(feedFx(), TODAY, undefined);
    expect(out.amount).toBe(0);
    expect(out.metered).toBe(false);
  });

  it("meters an ongoing batch-basis stage with no arrival date", () => {
    const ctx = ctxFx([stageFx()], [group("layers")]);
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(10);
    expect(out.metered).toBe(true);
    expect(out.caveats).toEqual([]);
  });

  it("scales a per-bird stage by the group's head count", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: metered(0.25, { basis: "bird" }) })],
      [group("layers", { count: 40 })]
    );
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(10); // 0.25 lb x 40 birds
  });

  it("treats basis 'head' as per-animal too", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: metered(2, { basis: "head" }) })],
      [group("sheep", { count: 3 })]
    );
    expect(dailyConsumptionForFeed(feedFx(), TODAY, ctx).amount).toBe(6);
  });

  it("sums across every group assigned to the schedule", () => {
    const ctx = ctxFx([stageFx()], [group("g1"), group("g2")]);
    expect(dailyConsumptionForFeed(feedFx(), TODAY, ctx).amount).toBe(20);
  });

  it("silently skips assigned group ids with no matching group", () => {
    const ctx = ctxFx([stageFx()], [group("g1")], ["g1", "ghost"]);
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(10);
    expect(out.caveats).toEqual([]);
  });

  it("day-ranged stages are [startDay, endDay): age 14 is in a 14-21 " +
     "stage, ages 13 and 21 are not", () => {
    const stages = [stageFx({ startDay: 14, endDay: 21 })];
    const grp = group("batch1", { arrivalDate: "2026-05-20" });
    const ctx = ctxFx(stages, [grp]);
    const feed = feedFx();
    // 2026-06-03 is exactly 14 days after arrival.
    expect(dailyConsumptionForFeed(feed, "2026-06-03", ctx).amount)
      .toBe(10);
    expect(dailyConsumptionForFeed(feed, "2026-06-02", ctx).amount)
      .toBe(0);
    expect(dailyConsumptionForFeed(feed, "2026-06-10", ctx).amount)
      .toBe(0);
  });

  it("a day-ranged stage with no arrival date yields a no_anchor " +
     "caveat instead of a silent zero", () => {
    const ctx = ctxFx(
      [stageFx({ startDay: 14, endDay: 21 })],
      [group("batch1")] // arrivalDate null
    );
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(0);
    expect(out.caveats).toHaveLength(1);
    expect(out.caveats[0]).toMatchObject({
      kind: "no_anchor",
      scheduleName: "Test schedule",
      stageName: "Stage 1",
      groupLabel: "batch1",
    });
  });

  it("a TBD stage (or one missing consumption) yields a tbd caveat", () => {
    const ctx = ctxFx([
      stageFx({ id: "a", consumption: { type: "tbd" } }),
      stageFx({ id: "b", name: "Stage 2", consumption: null }),
    ], [group("layers")]);
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(0);
    expect(out.caveats.map((c) => c.kind)).toEqual(["tbd", "tbd"]);
  });

  it("a free-choice stage yields a free_choice caveat", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: { type: "free_choice" } })],
      [group("chicks")]
    );
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(0);
    expect(out.caveats[0].kind).toBe("free_choice");
  });

  it("a stage metered in a different unit than the stock yields a " +
     "unit_mismatch caveat and contributes nothing", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: metered(2, { unit: "bale" }) })],
      [group("sheep")]
    );
    const out = dailyConsumptionForFeed(feedFx(), TODAY, ctx);
    expect(out.amount).toBe(0);
    expect(out.caveats[0].kind).toBe("unit_mismatch");
    expect(out.caveats[0].detail).toContain("bale");
    expect(out.caveats[0].detail).toContain("lb");
  });

  it("falls back to feed.unit for the stock unit when onHand is " +
     "missing", () => {
    const feed = feedFx({ unit: "bale", onHand: null });
    const ctx = ctxFx(
      [stageFx({ consumption: metered(1, { unit: "bale" }) })],
      [group("sheep")]
    );
    const out = dailyConsumptionForFeed(feed, TODAY, ctx);
    expect(out.unit).toBe("bale");
    expect(out.amount).toBe(1);
  });

  it("with no stock unit at all, the unit check is skipped and the " +
     "amount still counts (unit reads null)", () => {
    const feed = feedFx({ unit: null, onHand: null });
    const ctx = ctxFx([stageFx()], [group("layers")]);
    const out = dailyConsumptionForFeed(feed, TODAY, ctx);
    expect(out.unit).toBeNull();
    expect(out.amount).toBe(10);
    expect(out.caveats).toEqual([]);
  });
});

// ── projectReorder ───────────────────────────────────────────────────

describe("projectReorder", () => {
  const NO_CONSUMERS = { feedSchedules: [], livestock: { species: [] } };

  it("reads 'untracked' when no on-hand amount is recorded", () => {
    const out = projectReorder(feedFx({ onHand: null }), NO_CONSUMERS);
    expect(out.kind).toBe("untracked");
  });

  it("reads 'no_reorder_point' when none is defined", () => {
    const out = projectReorder(
      feedFx({ reorderPoint: null }), NO_CONSUMERS);
    expect(out.kind).toBe("no_reorder_point");
  });

  it("reads 'order_now' when stock is already AT the point (<=)", () => {
    const out = projectReorder(
      feedFx({ onHand: { amount: 20, unit: "lb" } }), NO_CONSUMERS);
    expect(out.kind).toBe("order_now");
  });

  it("carries today's caveats on the early-exit shapes too", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: { type: "free_choice" } })],
      [group("chicks")]
    );
    const out = projectReorder(
      feedFx({ onHand: { amount: 5, unit: "lb" } }), ctx);
    expect(out.kind).toBe("order_now");
    expect(out.caveats).toHaveLength(1);
    expect(out.caveats[0].kind).toBe("free_choice");
  });

  it("projects a weekday crossing: 100 lb at 10 lb/day crosses 20 lb " +
     "on day 7 (Wed 6/10), order-by same day", () => {
    const ctx = ctxFx([stageFx()], [group("layers")]); // 10/day
    const out = projectReorder(feedFx(), ctx);
    expect(out).toMatchObject({
      kind: "projected",
      triggerDateISO: "2026-06-10",
      orderByDateISO: "2026-06-10",
      daysUntil: 7,
      dailyRateToday: 10,
    });
  });

  it("a Saturday trigger rolls the order-by date back to Friday and " +
     "daysUntil counts to the ORDER date", () => {
    // 20 lb/day: 100 -> 80, 60, 40, 20 (<= 20) on Sat 6/6.
    const ctx = ctxFx(
      [stageFx({ consumption: metered(20) })], [group("layers")]);
    const out = projectReorder(feedFx(), ctx);
    expect(out).toMatchObject({
      kind: "projected",
      triggerDateISO: "2026-06-06",
      orderByDateISO: "2026-06-05",
      daysUntil: 2,
    });
  });

  it("a Sunday trigger also lands the order on that Friday", () => {
    // 16 lb/day: crosses on day 4 = Sun 6/7.
    const ctx = ctxFx(
      [stageFx({ consumption: metered(16) })], [group("layers")]);
    const out = projectReorder(feedFx(), ctx);
    expect(out).toMatchObject({
      kind: "projected",
      triggerDateISO: "2026-06-07",
      orderByDateISO: "2026-06-05",
      daysUntil: 2,
    });
  });

  it("stock that crosses on day 0 projects trigger=order=today with " +
     "daysUntil 0 (not order_now — it starts above the point)", () => {
    const ctx = ctxFx([stageFx()], [group("layers")]); // 10/day
    const out = projectReorder(
      feedFx({ onHand: { amount: 25, unit: "lb" } }), ctx);
    expect(out).toMatchObject({
      kind: "projected",
      triggerDateISO: "2026-06-03",
      orderByDateISO: "2026-06-03",
      daysUntil: 0,
    });
  });

  it("the walk re-meters each day, so the rate steps up as a batch " +
     "ages into a hungrier stage", () => {
    // Arrival 6/1 (age 2 today). 5 lb/day through day 7, then 20.
    // 100 -> five 5s (days 0-4), then 20s: crosses 10 on day 8 (Thu
    // 6/11). A flat 5/day would have taken 18 days.
    const grp = group("batch1", { arrivalDate: "2026-06-01" });
    const ctx = ctxFx([
      stageFx({ id: "a", name: "Starter", startDay: 0, endDay: 7,
        consumption: metered(5) }),
      stageFx({ id: "b", name: "Grower", startDay: 7, endDay: 14,
        consumption: metered(20) }),
    ], [grp]);
    const out = projectReorder(
      feedFx({ reorderPoint: { amount: 10, unit: "lb" } }), ctx);
    expect(out).toMatchObject({
      kind: "projected",
      triggerDateISO: "2026-06-11",
      daysUntil: 8,
      dailyRateToday: 5,
    });
  });

  it("reads 'beyond_horizon' when metered consumption exists but " +
     "won't reach the point within a year", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: metered(0.1) })], [group("layers")]);
    expect(projectReorder(feedFx(), ctx).kind).toBe("beyond_horizon");
  });

  it("reads 'beyond_horizon' when the only consuming batch ages out " +
     "of its stage before stock crosses the point", () => {
    // 5 days left in the stage x 5 lb = 25 lb eaten, then nothing.
    const grp = group("batch1", { arrivalDate: "2026-06-01" });
    const ctx = ctxFx(
      [stageFx({ startDay: 0, endDay: 7, consumption: metered(5) })],
      [grp]);
    expect(projectReorder(feedFx(), ctx).kind).toBe("beyond_horizon");
  });

  it("reads 'no_consumption' (with caveats) when nothing meterable " +
     "eats this feed at all", () => {
    const ctx = ctxFx(
      [stageFx({ consumption: { type: "free_choice" } })],
      [group("chicks")]);
    const out = projectReorder(feedFx(), ctx);
    expect(out.kind).toBe("no_consumption");
    expect(out.caveats[0].kind).toBe("free_choice");
  });
});

// ── consolidationSummary ─────────────────────────────────────────────

describe("consolidationSummary", () => {
  it("sorts order_now first, then projected by daysUntil, then the " +
     "unmeterable shapes", () => {
    const feedNow = feedFx({
      id: "now", onHand: { amount: 5, unit: "lb" } });
    const feedSoon = feedFx({ id: "soon" }); // 10/day -> 7 days out
    const feedNever = feedFx({ id: "never", onHand: null });
    const ctx = ctxFx(
      [stageFx({ feedTypeId: "soon" })], [group("layers")]);
    const { rows, anyDue } = consolidationSummary(
      [feedNever, feedSoon, feedNow], ctx);
    expect(rows.map((r) => r.feed.id)).toEqual(["now", "soon", "never"]);
    expect(rows.map((r) => r.projection.kind)).toEqual(
      ["order_now", "projected", "untracked"]);
    expect(anyDue).toBe(true);
  });

  it("a projection landing exactly ON the window edge counts as due; " +
     "one day outside does not", () => {
    // 40 lb/day: 100 -> 60, 20 (<= 20) on day 1 (Thu) -> daysUntil 1.
    const ctx = ctxFx(
      [stageFx({ consumption: metered(40) })], [group("layers")]);
    const feeds = [feedFx()];
    expect(consolidationSummary(feeds, ctx, { windowDays: 1 }).anyDue)
      .toBe(true);
    expect(consolidationSummary(feeds, ctx, { windowDays: 0 }).anyDue)
      .toBe(false);
  });

  it("null/empty feeds produce an empty, not-due summary", () => {
    expect(consolidationSummary(null, {})).toEqual(
      { rows: [], anyDue: false });
  });
});

// ── formatAmount ─────────────────────────────────────────────────────

describe("formatAmount", () => {
  it("returns null for a missing jsonb or a missing amount", () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount({ unit: "lb" })).toBeNull();
    expect(formatAmount({ amount: null, unit: "lb" })).toBeNull();
  });

  it("formats an integer amount with its unit", () => {
    expect(formatAmount({ amount: 5, unit: "lb" })).toBe("5 lb");
  });

  it("adds thousands separators to large integers", () => {
    expect(formatAmount({ amount: 1500, unit: "lb" })).toBe("1,500 lb");
  });

  it("rounds fractional amounts to one decimal place", () => {
    expect(formatAmount({ amount: 2.567, unit: "lb" })).toBe("2.6 lb");
  });

  it("trims cleanly when the unit is missing", () => {
    expect(formatAmount({ amount: 5 })).toBe("5");
  });
});

// ── describeConsumption ──────────────────────────────────────────────

describe("describeConsumption", () => {
  it("reads 'TBD' for null or type:'tbd'", () => {
    expect(describeConsumption(null)).toBe("TBD");
    expect(describeConsumption({ type: "tbd" })).toBe("TBD");
  });

  it("reads 'Free choice' for a free-choice stage", () => {
    expect(describeConsumption({ type: "free_choice" }))
      .toBe("Free choice");
  });

  it("describes a metered batch-basis stage per batch", () => {
    expect(describeConsumption(metered(100)))
      .toBe("100 lb/day per batch");
  });

  it("describes bird/head bases per bird", () => {
    expect(describeConsumption(metered(0.25, { basis: "bird" })))
      .toBe("0.25 lb/day per bird");
    expect(describeConsumption(metered(0.25, { basis: "head" })))
      .toBe("0.25 lb/day per bird");
  });

  it("reads 'Unknown' for an unrecognized type", () => {
    expect(describeConsumption({ type: "psychic" })).toBe("Unknown");
  });
});

// ── formatOrderDate ──────────────────────────────────────────────────

describe("formatOrderDate", () => {
  it("returns null for a missing date", () => {
    expect(formatOrderDate(null)).toBeNull();
  });

  it("reads 'today' for today's date", () => {
    expect(formatOrderDate("2026-06-03")).toBe("today");
  });

  it("clamps PAST dates to 'today' too (diff <= 0)", () => {
    expect(formatOrderDate("2026-06-01")).toBe("today");
  });

  it("reads 'tomorrow' for one day out", () => {
    expect(formatOrderDate("2026-06-04")).toBe("tomorrow");
  });

  it("formats anything further as weekday + month + day", () => {
    expect(formatOrderDate("2026-06-05")).toBe("Fri, Jun 5");
  });
});
