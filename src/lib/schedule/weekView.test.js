// Week/month fullness silhouettes (S9 tail). Both are deliberately CHEAP,
// count-only projections — no duration data, no commitment-delta reads —
// so a week costs 7 rollups and a month costs ~35-42 (ROADMAP 41.16/
// 41.35-36: "the silhouette zooms are deliberately delta-free"; folding
// ad-hoc/project deltas into them would be an architecture change, noted
// as a deferred O-B7 follow-up, not a bug).
import { describe, it, expect } from "vitest";
import { weekDays, blockFullness, weekFullness } from "./weekView.js";
import { monthFullness } from "./monthView.js";

const d = (y, m, day) => new Date(y, m - 1, day);

function fixedBlock(id, name, startMinutes) {
  return { id, name, startKind: "fixed", startMinutes, durationMinutes: 60, isActive: true };
}
const MORNING = fixedBlock("morning", "Morning", 360);
const EVENING = fixedBlock("evening", "Evening", 1080);
const BLOCKS = [MORNING, EVENING];

function dailyChore(id, over = {}) {
  return {
    id, title: id,
    frequency: { type: "daily" }, deadline: { kind: "midnight" },
    ...over,
  };
}

// "Nothing due" data. definitions must be NON-empty — an empty array
// triggers getAllChoreDefinitions' CHORE_SEEDS fallback and the day
// fills with the 67 built-in seeds. Event-triggered chores never
// self-fire, so this one contributes zero instances on every day.
const EMPTY_DATA = {
  chores: {
    definitions: [dailyChore("never", { frequency: { type: "event" } })],
  },
};

describe("weekDays", () => {
  it("returns exactly 7 dates spanning Sunday through Saturday", () => {
    // 2026-06-03 is a Wednesday.
    const days = weekDays(d(2026, 6, 3));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0); // Sunday
    expect(days[6].getDay()).toBe(6); // Saturday
  });

  it("the week containing a Sunday starts on that Sunday itself", () => {
    const sunday = d(2026, 5, 31); // a Sunday
    const days = weekDays(sunday);
    expect(days[0].getDate()).toBe(31);
    expect(days[0].getMonth()).toBe(4); // May (0-indexed)
  });

  it("the week correctly spans a month boundary", () => {
    // 2026-06-03 (Wed) -> week is May 31 - Jun 6.
    const days = weekDays(d(2026, 6, 3));
    expect(days[0].getMonth()).toBe(4); // May
    expect(days[6].getMonth()).toBe(5); // June
  });

  it("returns midnight local dates (no time-of-day bleed from the input)", () => {
    const withTime = new Date(2026, 5, 3, 15, 45, 30);
    const days = weekDays(withTime);
    expect(days[0].getHours()).toBe(0);
    expect(days[0].getMinutes()).toBe(0);
  });
});

describe("blockFullness", () => {
  it("sorts blocks by resolved startMin ascending", () => {
    const defs = [
      dailyChore("e1", { blockId: "evening" }),
      dailyChore("m1", { blockId: "morning" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = blockFullness(data, d(2026, 6, 1), { blocks: BLOCKS });
    expect(out.map((b) => b.bucket)).toEqual(["morning", "evening"]);
  });

  it("an 'anytime' bucket (startMin null) sorts LAST regardless of insertion order", () => {
    const defs = [
      dailyChore("free", { blockId: undefined }),
      dailyChore("e1", { blockId: "evening" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = blockFullness(data, d(2026, 6, 1), { blocks: BLOCKS });
    expect(out[out.length - 1].bucket).toBe("anytime");
  });

  it("each entry's count is the number of chore instances in that block", () => {
    const defs = [
      dailyChore("m1", { blockId: "morning" }),
      dailyChore("m2", { blockId: "morning" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = blockFullness(data, d(2026, 6, 1), { blocks: BLOCKS });
    expect(out.find((b) => b.bucket === "morning").count).toBe(2);
  });

  it("names an orphaned bucket (no real block found) 'Anytime' as the display fallback", () => {
    const defs = [dailyChore("orphan", { blockId: "deleted" })];
    const data = { chores: { definitions: defs } };
    const out = blockFullness(data, d(2026, 6, 1), { blocks: BLOCKS });
    expect(out[0].name).toBe("Anytime");
    expect(out[0].block).toBeNull();
  });

  it("a day with nothing due returns an empty array", () => {
    const data = EMPTY_DATA;
    expect(blockFullness(data, d(2026, 6, 1), { blocks: BLOCKS })).toEqual([]);
  });
});

describe("weekFullness", () => {
  it("max is never below 1, even on an all-empty week (guards bar-height division by zero)", () => {
    const data = EMPTY_DATA;
    const out = weekFullness(data, d(2026, 6, 3), { blocks: BLOCKS });
    expect(out.max).toBe(1);
  });

  it("max reflects the single heaviest block-count across the whole week", () => {
    const defs = [
      dailyChore("a", { blockId: "morning" }),
      dailyChore("b", { blockId: "morning" }),
      dailyChore("c", { blockId: "morning" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = weekFullness(data, d(2026, 6, 3), { blocks: BLOCKS });
    expect(out.max).toBe(3); // 3 daily chores in one block, every day
  });

  it("each day's total is the sum of that day's block counts", () => {
    const defs = [
      dailyChore("m1", { blockId: "morning" }),
      dailyChore("e1", { blockId: "evening" }),
    ];
    const data = { chores: { definitions: defs } };
    const out = weekFullness(data, d(2026, 6, 3), { blocks: BLOCKS });
    expect(out.days.every((day) => day.total === 2)).toBe(true);
  });

  it("returns exactly 7 days, each carrying its own blocks array", () => {
    const data = EMPTY_DATA;
    const out = weekFullness(data, d(2026, 6, 3), { blocks: BLOCKS });
    expect(out.days).toHaveLength(7);
    expect(out.days.every((day) => Array.isArray(day.blocks))).toBe(true);
  });

  it("a weekday-only chore contributes to SOME days and not others (no duration/schedule leakage)", () => {
    const defs = [dailyChore("mon", { blockId: "morning", frequency: { type: "weekly", days: [1] } })];
    const data = { chores: { definitions: defs } };
    const out = weekFullness(data, d(2026, 6, 3), { blocks: BLOCKS }); // week of Jun 3 (Wed)
    const monday = out.days.find((day) => day.date.getDay() === 1);
    const tuesday = out.days.find((day) => day.date.getDay() === 2);
    expect(monday.total).toBe(1);
    expect(tuesday.total).toBe(0);
  });
});

describe("monthFullness", () => {
  it("the grid is padded to full Sunday-Saturday weeks (cell count is a multiple of 7)", () => {
    const data = EMPTY_DATA;
    const out = monthFullness(data, d(2026, 6, 15), { blocks: BLOCKS });
    const totalCells = out.weeks.reduce((s, w) => s + w.length, 0);
    expect(totalCells % 7).toBe(0);
    expect(out.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("flags padding days from the neighboring month with inMonth:false", () => {
    const data = EMPTY_DATA;
    const out = monthFullness(data, d(2026, 6, 15), { blocks: BLOCKS });
    const allCells = out.weeks.flat();
    const juneCells = allCells.filter((c) => c.inMonth);
    const paddingCells = allCells.filter((c) => !c.inMonth);
    // June 2026 has 30 days.
    expect(juneCells).toHaveLength(30);
    expect(paddingCells.length).toBeGreaterThan(0);
    expect(paddingCells.every((c) => c.date.getMonth() !== 5)).toBe(true);
  });

  it("every week row starts on a Sunday and ends on a Saturday", () => {
    const data = EMPTY_DATA;
    const out = monthFullness(data, d(2026, 6, 15), { blocks: BLOCKS });
    for (const week of out.weeks) {
      expect(week[0].date.getDay()).toBe(0);
      expect(week[6].date.getDay()).toBe(6);
    }
  });

  it("max clamps to at least 1 on an empty month", () => {
    const data = EMPTY_DATA;
    const out = monthFullness(data, d(2026, 6, 15), { blocks: BLOCKS });
    expect(out.max).toBe(1);
  });

  it("monthDate is the 1st of the requested month, regardless of which day was passed in", () => {
    const data = EMPTY_DATA;
    const out = monthFullness(data, d(2026, 6, 27), { blocks: BLOCKS });
    expect(out.monthDate.getDate()).toBe(1);
    expect(out.monthDate.getMonth()).toBe(5);
  });

  it("a daily chore contributes its count to every in-month cell", () => {
    const defs = [dailyChore("daily1", { blockId: "morning" })];
    const data = { chores: { definitions: defs } };
    const out = monthFullness(data, d(2026, 6, 15), { blocks: BLOCKS });
    const juneCells = out.weeks.flat().filter((c) => c.inMonth);
    expect(juneCells.every((c) => c.total === 1)).toBe(true);
  });

  it("handles February (28 days, no padding-heavy edge cases) without throwing", () => {
    const data = EMPTY_DATA;
    expect(() => monthFullness(data, d(2026, 2, 10), { blocks: BLOCKS })).not.toThrow();
  });
});
