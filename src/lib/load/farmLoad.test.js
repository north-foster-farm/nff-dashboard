// farmLoad — the one day-load model (round 3 harvest-remix; round 5
// needs-cover units; round 6/batch 42.5 This Week identity bars). Freshly
// touched in batch 42.5 (weekRes/weekTimed args + week.days[].bars) —
// highest regression risk of anything in this session's work. This suite
// intentionally does NOT re-verify projectGaps' own invariants (covered
// by scripts/test-schedule-partition.mjs's 4,000-run property test) or
// chore recurrence (chores.test.js) — it tests farmLoad's OWN composition
// logic: block state derivation, the binary warming fold, needs-cover
// UNIT counting, and the This Week bar assembly.
import { describe, it, expect } from "vitest";
import { farmLoad, dayWarming, dayConflictCount, dayCoveredUnits } from "./farmLoad.js";

const d = (y, m, day, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

function fixedBlock(id, name, startMinutes, durationMinutes = 60) {
  return { id, name, startKind: "fixed", startMinutes, durationMinutes, isActive: true };
}
const MORNING = fixedBlock("morning", "Morning", 360); // 6:00-7:00
const EVENING = fixedBlock("evening", "Evening", 1080); // 18:00-19:00
const BLOCKS = [MORNING, EVENING];

function dailyChore(id, over = {}) {
  return {
    id, title: id, blockId: "morning",
    frequency: { type: "daily" }, deadline: { kind: "midnight" },
    ...over,
  };
}

const noCompletions = { isDone: () => false };
const emptyChoreCtx = {}; // obligationPlaceIds defaults 'none' -> [null]

// "No chores due" default. definitions must be NON-empty — an empty
// array triggers getAllChoreDefinitions' CHORE_SEEDS fallback and the
// day fills with the 67 built-in seeds. Event-triggered chores never
// self-fire, so this one contributes zero instances on every day.
const NO_CHORES = {
  definitions: [dailyChore("never", { frequency: { type: "event" } })],
};

function baseArgs(over = {}) {
  return {
    data: { chores: NO_CHORES, events: { kinds: [] }, projects: [] },
    date: d(2026, 6, 3), // a Wednesday
    ruleOpts: { blocks: BLOCKS },
    choreCtx: emptyChoreCtx,
    completions: noCompletions,
    deltas: [],
    ...over,
  };
}

describe("farmLoad — block state derivation", () => {
  it("a block with everything done reads state:'done'", () => {
    const defs = [dailyChore("c1")];
    const completions = { isDone: () => true };
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      completions,
    }));
    const morning = out.blocks.find((b) => b.blockId === "morning");
    expect(morning.state).toBe("done");
    expect(morning.total).toBe(1);
    expect(morning.done).toBe(1);
  });

  it("nowMin inside the block's window reads state:'now'", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      nowMin: 380, // 6:20, inside 360-420
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).toBe("now");
  });

  it("nowMin past the block's end reads state:'over'", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      nowMin: 500,
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).toBe("over");
  });

  it("nowMin before the block's start reads state:'future'", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      nowMin: 100,
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).toBe("future");
  });

  it("with no nowMin (a non-today view) an incomplete block reads 'committed'", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      nowMin: null,
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).toBe("committed");
  });

  it("a block overlapped by an UNCOVERED time-off reads state:'hole', overriding done/now (round 5, block-level)", () => {
    const defs = [dailyChore("c1")];
    const completions = { isDone: () => true }; // even fully done...
    const deltas = [{
      id: "r1", source_type: "reservation", assignee: "James",
      clock_time: "06:00", source_ref: { kind: "off_site", end: "08:00" },
    }];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      completions, deltas,
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).toBe("hole");
  });

  it("a COVERED time-off (source_ref.cover set) no longer marks the block a hole", () => {
    const defs = [dailyChore("c1")];
    const deltas = [{
      id: "r1", source_type: "reservation", assignee: "James",
      clock_time: "06:00", source_ref: { kind: "off_site", end: "08:00", cover: { by: "Jim", at: "x" } },
    }];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      deltas,
    }));
    expect(out.blocks.find((b) => b.blockId === "morning").state).not.toBe("hole");
  });
});

describe("farmLoad — totals", () => {
  it("'chores' counts only real chore obligations, not ad-hoc/project extras", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
    }));
    expect(out.totals.chores).toBe(1);
  });

  it("'uncovered' counts UNITS (one per uncovered time-off touching any block), not per-block hits", () => {
    const defs = [dailyChore("c1", { blockId: "morning" }), dailyChore("c2", { blockId: "evening" })];
    // A single day-off reservation overlaps BOTH blocks -> still ONE unit.
    const deltas = [{
      id: "r1", source_type: "reservation", assignee: "James",
      source_ref: { kind: "day_off" },
    }];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      deltas,
    }));
    expect(out.totals.uncovered).toBe(1);
    expect(out.blocks.every((b) => b.state === "hole")).toBe(true);
  });

  it("'projectsDistinct' counts DISTINCT projects worked, not the number of project_node deltas", () => {
    const deltas = [
      { id: "d1", source_type: "project_node", clock_time: "10:00", source_ref: { project_id: "p1" } },
      { id: "d2", source_type: "project_node", clock_time: "11:00", source_ref: { project_id: "p1" } },
      { id: "d3", source_type: "project_node", clock_time: "12:00", source_ref: { project_id: "p2" } },
    ];
    const out = farmLoad(baseArgs({ deltas }));
    expect(out.totals.projectsDistinct).toBe(2);
  });

  it("'blocksAll' sums chore blocks WITH items plus project gaps", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
    }));
    // 1 chore block with items + however many project gaps the day yields
    // (before/between the two BLOCKS within the 8a-6p band).
    expect(out.totals.blocksAll).toBe(
      out.blocks.filter((b) => b.total > 0).length + out.projects.length);
  });
});

describe("farmLoad — project bars (planned vs free)", () => {
  it("a gap with a placed project_node reads planned:true", () => {
    // The gap before 'morning' can't host it (band starts 8a, morning is
    // 6a) — use the gap AFTER morning, before evening (7a-6p band-clamped).
    const deltas = [
      { id: "d1", source_type: "project_node", clock_time: "10:00", source_ref: { project_id: "p1" } },
    ];
    const out = farmLoad(baseArgs({ deltas }));
    const gap = out.projects.find((p) => p.startMin <= 600 && p.endMin > 600);
    expect(gap.planned).toBe(true);
    expect(gap.title).toContain("Project");
  });

  it("a gap with nothing placed reads planned:false, titled 'Free project block'", () => {
    const out = farmLoad(baseArgs());
    expect(out.projects.length).toBeGreaterThan(0);
    expect(out.projects.every((p) => p.planned === false)).toBe(true);
    expect(out.projects[0].title).toContain("Free project block");
  });
});

describe("farmLoad — This Week identity bars (F40, batch 42.5)", () => {
  it("the focal day's bars include a chore block bar with the real item count", () => {
    const defs = [dailyChore("c1"), dailyChore("c2")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
    }));
    const focalDay = out.week.days.find((day) =>
      day.date.toDateString() === d(2026, 6, 3).toDateString());
    const choreBar = focalDay.bars.find((b) => b.kind === "chore");
    expect(choreBar.count).toBe(2);
    expect(choreBar.name).toBe("Morning");
  });

  it("a block with zero items draws NO bar (empty blocks never show as stubs)", () => {
    const out = farmLoad(baseArgs()); // no chores fire on this day
    const focalDay = out.week.days.find((day) =>
      day.date.toDateString() === d(2026, 6, 3).toDateString());
    expect(focalDay.bars.some((b) => b.kind === "chore")).toBe(false);
  });

  it("bars are time-ordered (chores + project gaps + events interleaved by startMin)", () => {
    const defs = [dailyChore("c1", { blockId: "evening" })]; // 18:00
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
    }));
    const focalDay = out.week.days.find((day) =>
      day.date.toDateString() === d(2026, 6, 3).toDateString());
    const starts = focalDay.bars.map((b) => b.startMin ?? -1);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });

  it("every bar carries a preformatted windowLabel (so WeekStrip stays free of the time utils)", () => {
    const defs = [dailyChore("c1")];
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
    }));
    const focalDay = out.week.days.find((day) =>
      day.date.toDateString() === d(2026, 6, 3).toDateString());
    const choreBar = focalDay.bars.find((b) => b.kind === "chore");
    expect(typeof choreBar.windowLabel).toBe("string");
    expect(choreBar.windowLabel.length).toBeGreaterThan(0);
  });

  it("a non-focal day with a passed weekRes/weekTimed still splits gaps + tests planned (not just unsplit/unplanned)", () => {
    const defs = [dailyChore("c1", { blockId: "morning" })];
    // A reservation on Thursday (the day after the focal Wednesday) that
    // would trim that day's project gap, plus a timed delta marking a
    // project as planned that day.
    const thursdayISO = "2026-06-04";
    const weekRes = new Map([
      [thursdayISO, [{
        id: "r1", source_type: "reservation", assignee: "James",
        clock_time: "10:00", source_ref: { kind: "off_site", end: "11:00" },
      }]],
    ]);
    const weekTimed = new Map([
      [thursdayISO, [{ source_type: "project_node", clock_time: "10:30" }]],
    ]);
    const out = farmLoad(baseArgs({
      data: { chores: { definitions: defs }, events: { kinds: [] }, projects: [] },
      weekRes, weekTimed,
    }));
    const thursday = out.week.days.find((day) => day.date.toDateString() === d(2026, 6, 4).toDateString());
    const projectBar = thursday.bars.find((b) => b.kind === "project" && b.startMin <= 630 && (b.startMin + b.durationMin) > 630);
    expect(projectBar).toBeDefined();
    expect(projectBar.planned).toBe(true);
  });

  it("a non-focal day with NO weekRes/weekTimed entries still renders bars (gaps just read unsplit/unplanned)", () => {
    const out = farmLoad(baseArgs()); // weekRes/weekTimed both default null
    const otherDay = out.week.days.find((day) => day.date.toDateString() !== d(2026, 6, 3).toDateString());
    expect(() => otherDay.bars).not.toThrow();
    expect(Array.isArray(otherDay.bars)).toBe(true);
  });

  it("an event on the day produces an event-kind bar carrying its label", () => {
    const data = {
      chores: { definitions: [] },
      events: {
        kinds: [{
          id: "market", label: "Markets",
          instances: [{
            id: "s1", label: "Scituate Rotary Farmers Market",
            rrule: null, dtstart: null,
            occurrences: [{ id: "o1", occursOn: "2026-06-03", startTime: "13:15", endTime: "16:15" }],
          }],
        }],
      },
      projects: [],
    };
    const out = farmLoad(baseArgs({ data }));
    const focalDay = out.week.days.find((day) => day.date.toDateString() === d(2026, 6, 3).toDateString());
    const eventBar = focalDay.bars.find((b) => b.kind === "event");
    expect(eventBar).toBeDefined();
    expect(eventBar.name).toBe("Scituate Rotary Farmers Market");
  });

  it("a Saturday event still gets its bar (round-5 week-range regression pin, at the farmLoad level)", () => {
    const data = {
      chores: { definitions: [] },
      events: {
        kinds: [{
          id: "market", label: "Markets",
          instances: [{
            id: "s1", label: "Saturday Market",
            rrule: null, dtstart: null,
            occurrences: [{ id: "o1", occursOn: "2026-06-06", startTime: "13:15", endTime: "16:15" }],
          }],
        }],
      },
      projects: [],
    };
    // 2026-06-06 is the Saturday of the week containing 2026-06-03.
    const out = farmLoad(baseArgs({ data }));
    const saturday = out.week.days.find((day) => day.date.getDay() === 6);
    expect(saturday.eventList.some((e) => e.label === "Saturday Market")).toBe(true);
    expect(saturday.bars.some((b) => b.kind === "event")).toBe(true);
  });
});

describe("dayWarming — the binary warn/due signal (F24/F25)", () => {
  it("a chore due TODAY (block_on_weekday landing today) classifies as 'due'", () => {
    const chore = dailyChore("c1", {
      deadline: { kind: "block_on_weekday", block: "evening", weekday: 3 }, // Wed = today
    });
    const out = dayWarming({
      data: { chores: { definitions: [chore] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
    });
    expect(out.due).toHaveLength(1);
    expect(out.due[0].choreId).toBe("c1");
    expect(out.warn).toHaveLength(0);
  });

  it("a chore due LATER THIS WEEK classifies as 'warn' with the correct daysLeft", () => {
    const chore = dailyChore("c1", {
      deadline: { kind: "block_on_weekday", block: "evening", weekday: 5 }, // Fri, 2 days from Wed
    });
    const out = dayWarming({
      data: { chores: { definitions: [chore] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
    });
    expect(out.warn).toHaveLength(1);
    expect(out.warn[0].daysLeft).toBe(2);
  });

  it("a chore whose every obligation is already done drops out entirely", () => {
    const chore = dailyChore("c1", {
      deadline: { kind: "block_on_weekday", block: "evening", weekday: 3 },
    });
    const out = dayWarming({
      data: { chores: { definitions: [chore] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx,
      completions: { isDone: () => true },
    });
    expect(out.due).toEqual([]);
    expect(out.warn).toEqual([]);
  });

  it("byBucket groups entries by the rollup bucket the chore belongs to", () => {
    const chore = dailyChore("c1", {
      blockId: "morning",
      deadline: { kind: "block_on_weekday", block: "evening", weekday: 3 },
    });
    const out = dayWarming({
      data: { chores: { definitions: [chore] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
    });
    expect(out.byBucket.get("morning").due).toHaveLength(1);
  });

  it("a non-windowy chore (no countdown at all) contributes nothing", () => {
    const chore = dailyChore("c1"); // deadline: midnight, frequency: daily, blockId set -> no pill
    const out = dayWarming({
      data: { chores: { definitions: [chore] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
    });
    expect(out.due).toEqual([]);
    expect(out.warn).toEqual([]);
  });
});

describe("dayConflictCount — block-level units, not per-person/per-chore", () => {
  it("an uncovered reservation overlapping a block counts as ONE unit, however many blocks it crosses", () => {
    const out = dayConflictCount({
      data: { chores: { definitions: [] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [{ id: "r1", assignee: "James", source_ref: { kind: "day_off" } }],
    });
    expect(out).toBe(1); // one day-off, overlapping BOTH morning+evening -> still 1 unit
  });

  it("a COVERED reservation contributes zero units", () => {
    const out = dayConflictCount({
      data: { chores: { definitions: [] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [{
        id: "r1", assignee: "James",
        source_ref: { kind: "day_off", cover: { by: "Jim" } },
      }],
    });
    expect(out).toBe(0);
  });

  it("a reservation that doesn't overlap ANY occurring block contributes zero units", () => {
    const nightOwlBlock = [fixedBlock("night", "Night", 60, 30)]; // 1:00-1:30 AM
    const out = dayConflictCount({
      data: { chores: { definitions: [] } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: nightOwlBlock }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [{
        id: "r1", assignee: "James", clock_time: "14:00", source_ref: { kind: "off_site", end: "15:00" },
      }],
    });
    expect(out).toBe(0);
  });

  // These two were BUG PINS while the suite was authored: dayConflictCount's
  // flat rows carried no `.bucket`, so doubleBookConflicts' same-bucket skip
  // (`a.bucket === b.bucket` with both undefined) always fired and the
  // double-book term was dead code — the week pane under-counted what the
  // focal day showed (walkthrough 2026-07-02, F5). Now asserted as intended.
  it("a same-block-free double-booking adds one conflict (F5 — was a dead term)", () => {
    const overlappingBlocks = [fixedBlock("morning", "Morning", 360, 120), fixedBlock("market", "Market", 420, 60)];
    const defs = [
      dailyChore("c1", { blockId: "morning", assignment: { default: "James" } }),
      dailyChore("c2", { blockId: "market", assignment: { default: "James" } }),
    ];
    const out = dayConflictCount({
      data: { chores: { definitions: defs } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: overlappingBlocks }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [],
    });
    expect(out).toBe(1); // James in two overlapping blocks
  });

  it("an override-relocated chore that now overlaps another assignment adds one conflict (F5)", () => {
    const overlappingBlocks = [fixedBlock("morning", "Morning", 360, 120), fixedBlock("market", "Market", 420, 60)];
    const defs = [
      dailyChore("c1", { blockId: "morning", assignment: { default: "James" } }),
      dailyChore("c2", { blockId: "morning", assignment: { default: "James" } }),
    ];
    const overrides = [{
      source_ref: { target: { chore_id: "c2", place_id: "" }, block_id: "market" },
    }];
    const out = dayConflictCount({
      data: { chores: { definitions: defs } }, date: d(2026, 6, 3),
      ruleOpts: { blocks: overlappingBlocks }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [], overrides,
    });
    expect(out).toBe(1); // the override relocated c2 into an overlap with c1
  });

  // F5 (walkthrough 2026-07-02) — the focal day counts an uncovered EVENT
  // overlapping the day's blocks as a needs-cover unit, but the week scan
  // didn't, so the This Week triangle only appeared once the day was
  // clicked. dayConflictCount must count event units the same way.
  const marketOn = (occursOn, times = {}) => ({
    kinds: [{
      id: "market", label: "Farmers markets",
      instances: [{
        id: "s1", label: "Scituate Market", subtitle: null, location: null,
        rrule: null, dtstart: null, durationMinutes: null,
        occurrences: [{
          id: "occ1", occursOn,
          startTime: "06:30", endTime: "07:30", ...times,
        }],
        automationEmissionId: null,
      }],
    }],
  });

  it("an uncovered event overlapping a block counts as one unit (F5)", () => {
    const out = dayConflictCount({
      data: { chores: NO_CHORES, events: marketOn("2026-06-03") },
      date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [],
    });
    expect(out).toBe(1); // 6:30-7:30 market overlaps the 6:00-7:00 block
  });

  it("an event with an accepted cover override contributes zero units", () => {
    const coverAccepted = [{
      source_ref: {
        target: { kind: "event", instance_id: "s1", date: "2026-06-03" },
        cover: { by: "Jim" },
      },
    }];
    const out = dayConflictCount({
      data: { chores: NO_CHORES, events: marketOn("2026-06-03") },
      date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [], overrides: coverAccepted,
    });
    expect(out).toBe(0);
  });

  it("an event that overlaps no occurring block contributes zero units", () => {
    const middayMarket = marketOn(
      "2026-06-03", { startTime: "12:00", endTime: "13:00" });
    const out = dayConflictCount({
      data: { chores: NO_CHORES, events: middayMarket }, date: d(2026, 6, 3),
      ruleOpts: { blocks: BLOCKS }, choreCtx: emptyChoreCtx, completions: noCompletions,
      reservations: [],
    });
    expect(out).toBe(0); // midday market misses the 6-7 AM / 6-7 PM blocks
  });
});

describe("dayCoveredUnits", () => {
  it("includes a reservation whose cover overlaps an occurring block", () => {
    const out = dayCoveredUnits({
      date: d(2026, 6, 3), blocks: BLOCKS,
      reservations: [{
        id: "r1", assignee: "James",
        source_ref: { kind: "day_off", cover: { by: "Jim", at: "2026-06-03T10:00:00Z" } },
      }],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "r1", by: "Jim", at: "2026-06-03T10:00:00Z" });
    expect(out[0].label).toContain("all day");
  });

  it("excludes a reservation with no cover at all", () => {
    const out = dayCoveredUnits({
      date: d(2026, 6, 3), blocks: BLOCKS,
      reservations: [{ id: "r1", assignee: "James", source_ref: { kind: "day_off" } }],
    });
    expect(out).toEqual([]);
  });

  it("excludes a covered reservation that doesn't overlap any occurring block", () => {
    const nightOwlBlock = [fixedBlock("night", "Night", 60, 30)];
    const out = dayCoveredUnits({
      date: d(2026, 6, 3), blocks: nightOwlBlock,
      reservations: [{
        id: "r1", assignee: "James", clock_time: "14:00",
        source_ref: { kind: "off_site", end: "15:00", cover: { by: "Jim" } },
      }],
    });
    expect(out).toEqual([]);
  });

  it("carries the ack flag through for a 'Nobody at the farm' acknowledgement (round 6)", () => {
    const out = dayCoveredUnits({
      date: d(2026, 6, 3), blocks: BLOCKS,
      reservations: [{
        id: "r1", assignee: "James",
        source_ref: { kind: "day_off", cover: { ack: true, at: "x" } },
      }],
    });
    expect(out[0].ack).toBe(true);
    expect(out[0].by).toBeNull();
  });

  it("a timed (non-day-off) cover labels with the concrete window, not 'all day'", () => {
    const out = dayCoveredUnits({
      date: d(2026, 6, 3), blocks: BLOCKS,
      reservations: [{
        id: "r1", assignee: "James", clock_time: "06:00",
        source_ref: { kind: "off_site", end: "07:00", cover: { by: "Jim" } },
      }],
    });
    expect(out[0].label).not.toContain("all day");
    expect(out[0].label).toContain("James");
  });
});

describe("farmLoad — availability threading (batch 42 slice 6)", () => {
  it("nobody scheduled to work yields zero project gaps for the day",
    () => {
      const nobodyWorks = {
        hours: [
          { id: "x1", person: "James", weekday: null,
            onDate: "2026-06-03", startMin: null, endMin: null },
          { id: "x2", person: "Jim", weekday: null,
            onDate: "2026-06-03", startMin: null, endMin: null },
        ],
        timeOff: [], breaks: [],
      };
      const out = farmLoad(baseArgs({
        ruleOpts: { blocks: BLOCKS, availability: nobodyWorks },
      }));
      expect(out.projects).toEqual([]);
    });
});
