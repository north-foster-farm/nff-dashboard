// Processes (Batch 23) — "turns an event on the schedule into the work
// around it." Templates tied to event kinds expand into one-time chores
// (chore-kind steps) + chore_modifiers (modifier-kind steps) per upcoming
// occurrence. See nff-chores-spec.md §2.7 (event-triggered chores) and
// CH-Processing in the QA test plan (offsets -1/0/+1, Sparkles glyph).
import { describe, it, expect } from "vitest";
import {
  planExpansions, expansionKey, expansionSummary, stepDateFor, splitSteps,
  describeOffset, expansionProjectTitle, processChoreId, resolveChoreAnchor,
  processChoreRow, occurrenceIsCurrent, classifyProcessWork,
} from "./processes.js";

function process(over = {}) {
  return { id: "proc1", title: "Processing day prep", isActive: true, lookaheadDays: 60, ...over };
}
function eventsData(occursOn, over = {}) {
  return {
    kinds: [{
      id: "processing", label: "Processing days",
      instances: [{
        id: "s1", label: "Batch 1 processing",
        rrule: null, dtstart: null,
        occurrences: [{ id: "o1", occursOn, startTime: null, endTime: null }],
      }],
    }],
    ...over,
  };
}

describe("planExpansions", () => {
  it("expands an active process linked to the occurring event's kind", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [],
      events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].occursOn).toBe("2026-06-10");
    expect(plans[0].process.id).toBe("proc1");
  });

  it("skips an INACTIVE process entirely", () => {
    const plans = planExpansions({
      processes: [process({ isActive: false })],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [],
      events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("a process with ZERO linked kinds never expands (F-behavior: a process needs a trigger)", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [],
      expansions: [],
      events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("a process with ZERO steps never expands (nothing to create)", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [],
      events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("excludes an occurrence outside the lookahead window", () => {
    const plans = planExpansions({
      processes: [process({ lookaheadDays: 5 })],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [],
      events: eventsData("2026-07-01"), // 30 days out, beyond a 5-day lookahead
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("excludes an occurrence that already happened (no prep for the past)", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [],
      events: eventsData("2026-05-01"), // before `today`
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("excludes an occurrence already recorded in `expansions` (dedupe)", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [{ processId: "proc1", seriesId: "s1", occursOn: "2026-06-10" }],
      events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("does NOT expand for a DIFFERENT event kind, even if linked kinds exist for other processes", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "market" }], // proc1 wants "market", not "processing"
      expansions: [],
      events: eventsData("2026-06-10"), // an occurrence of kind "processing"
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans).toEqual([]);
  });

  it("returns [] when events data has no kinds at all", () => {
    const plans = planExpansions({
      processes: [process()], steps: [{ id: "step1", processId: "proc1" }],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [], events: {}, today: new Date(),
    });
    expect(plans).toEqual([]);
  });

  it("each plan carries the process's OWN steps (not another process's)", () => {
    const plans = planExpansions({
      processes: [process()],
      steps: [
        { id: "own1", processId: "proc1" },
        { id: "other", processId: "proc2" },
      ],
      kindLinks: [{ processId: "proc1", eventKindId: "processing" }],
      expansions: [], events: eventsData("2026-06-10"),
      today: new Date(Date.UTC(2026, 5, 1)),
    });
    expect(plans[0].steps.map((s) => s.id)).toEqual(["own1"]);
  });
});

describe("expansionKey / expansionSummary", () => {
  it("builds a stable composite key", () => {
    expect(expansionKey("proc1", "series1", "2026-06-10")).toBe("proc1:series1:2026-06-10");
  });

  it("summarizes the expansion in one readable line", () => {
    const summary = expansionSummary(
      { title: "Processing day prep" },
      { instanceLabel: "Batch 1 processing", date: "2026-06-10" });
    expect(summary).toContain("Processing day prep");
    expect(summary).toContain("Batch 1 processing");
  });
});

describe("stepDateFor", () => {
  it("applies the step's offsetDays to the event's date", () => {
    expect(stepDateFor({ offsetDays: -1 }, "2026-06-10")).toBe("2026-06-09");
    expect(stepDateFor({ offsetDays: 0 }, "2026-06-10")).toBe("2026-06-10");
    expect(stepDateFor({ offsetDays: 1 }, "2026-06-10")).toBe("2026-06-11");
  });

  it("defaults to offset 0 (day of) when offsetDays is missing", () => {
    expect(stepDateFor({}, "2026-06-10")).toBe("2026-06-10");
  });
});

describe("splitSteps — chore-kind vs chore_modifier-kind", () => {
  it("separates chore-kind steps from chore_modifier-kind steps", () => {
    const steps = [
      { id: "s1", kind: "chore", title: "Stage crates", sortOrder: 0, offsetDays: -1 },
      { id: "s2", kind: "chore_modifier", targetChoreId: "c1", modifierAction: "suppress", sortOrder: 1, offsetDays: -1 },
    ];
    const { chores, modifiers } = splitSteps(steps, "2026-06-10");
    expect(chores).toHaveLength(1);
    expect(chores[0].title).toBe("Stage crates");
    expect(modifiers).toHaveLength(1);
    expect(modifiers[0].targetChoreId).toBe("c1");
  });

  it("a chore-kind step's targetDate is the event date + its own offset", () => {
    const steps = [{ id: "s1", kind: "chore", title: "Pickup", sortOrder: 0, offsetDays: 1 }];
    const { chores } = splitSteps(steps, "2026-06-10");
    expect(chores[0].targetDate).toBe("2026-06-11");
  });

  it("a modifier step with NO targetChoreId is dropped (inert — the target chore was deleted)", () => {
    const steps = [{ id: "s1", kind: "chore_modifier", targetChoreId: null, sortOrder: 0, offsetDays: 0 }];
    const { modifiers } = splitSteps(steps, "2026-06-10");
    expect(modifiers).toEqual([]);
  });

  it("a modifier step defaults priority to 10 when unset", () => {
    const steps = [{ id: "s1", kind: "chore_modifier", targetChoreId: "c1", sortOrder: 0, offsetDays: 0 }];
    const { modifiers } = splitSteps(steps, "2026-06-10");
    expect(modifiers[0].priority).toBe(10);
  });

  it("sorts steps by sortOrder, then offsetDays, then createdAt", () => {
    const steps = [
      { id: "b", kind: "chore", sortOrder: 1, offsetDays: 0, createdAt: "2026-01-01" },
      { id: "a", kind: "chore", sortOrder: 0, offsetDays: 0, createdAt: "2026-01-01" },
    ];
    const { chores } = splitSteps(steps, "2026-06-10");
    expect(chores.map((c) => c.stepId)).toEqual(["a", "b"]);
  });

  it("a chore-kind step carries its full template through verbatim, with sane defaults for the unset fields", () => {
    const steps = [{
      id: "s1", kind: "chore", title: "Stage crates", sortOrder: 0, offsetDays: -1,
      blockId: "late_afternoon", anchorType: "place",
    }];
    const { chores } = splitSteps(steps, "2026-06-10");
    expect(chores[0]).toMatchObject({
      stepId: "s1", title: "Stage crates", blockId: "late_afternoon",
      anchorType: "place", anchorKindTag: null, placeId: null,
    });
  });

  it("an unauthored chore-kind step's anchorType defaults to 'none'", () => {
    const steps = [{ id: "s1", kind: "chore", sortOrder: 0, offsetDays: 0 }];
    const { chores } = splitSteps(steps, "2026-06-10");
    expect(chores[0].anchorType).toBe("none");
  });
});

describe("describeOffset", () => {
  it("reads 'day of' for offset 0", () => {
    expect(describeOffset(0)).toBe("day of");
    expect(describeOffset(null)).toBe("day of"); // defaults to 0
  });

  it("reads 'N days before' for a negative offset", () => {
    expect(describeOffset(-7)).toBe("7 days before");
  });

  it("reads 'N days after' for a positive offset", () => {
    expect(describeOffset(1)).toBe("1 day after");
    expect(describeOffset(3)).toBe("3 days after");
  });

  it("uses the singular 'day' only for exactly ±1", () => {
    expect(describeOffset(-1)).toBe("1 day before");
    expect(describeOffset(-2)).toBe("2 days before");
  });
});

describe("expansionProjectTitle (legacy — pre-0025 expansions only)", () => {
  it("composes '<process> — <event> (<date>)'", () => {
    const title = expansionProjectTitle(
      { title: "Processing day prep" },
      { instanceLabel: "Batch 1 processing", date: "2026-06-10" });
    expect(title).toContain("Processing day prep");
    expect(title).toContain("Batch 1 processing");
  });
});

describe("processChoreId", () => {
  it("is deterministic per (expansion, step) so a re-run conflicts instead of duplicating", () => {
    const chore = { stepId: "step1" };
    const id1 = processChoreId("exp1", chore, 0);
    const id2 = processChoreId("exp1", chore, 0);
    expect(id1).toBe(id2);
    expect(id1).toBe("process_exp1_step1");
  });

  it("falls back to the index when the chore has no stepId", () => {
    expect(processChoreId("exp1", {}, 2)).toBe("process_exp1_2");
  });
});

describe("resolveChoreAnchor", () => {
  it("an UNAUTHORED step (no anchorType, or 'none') inherits the event's batch when present", () => {
    const out = resolveChoreAnchor({ anchorType: "none" }, { batchLink: { targetId: "batch1" } });
    expect(out).toEqual({ anchor_type: "batch", anchor_batch_id: "batch1" });
  });

  it("an unauthored step with NO batch link on the event resolves to anchor_type:'none'", () => {
    expect(resolveChoreAnchor({}, {})).toEqual({ anchor_type: "none" });
  });

  it("an authored 'place' anchor passes its own place fields through untouched", () => {
    const out = resolveChoreAnchor({
      anchorType: "place", placeId: "house", anchorKindTag: null, atPlaceId: null,
    }, { batchLink: { targetId: "batch1" } }); // batch link present but irrelevant to 'place'
    expect(out).toEqual({
      anchor_type: "place", anchor_kind_tag: null, place_id: "house", at_place_id: null,
    });
    expect(out.anchor_batch_id).toBeUndefined();
  });

  it("an authored 'batch' anchor ALSO takes the event's concrete batch id", () => {
    const out = resolveChoreAnchor(
      { anchorType: "batch" }, { batchLink: { targetId: "batch1" } });
    expect(out.anchor_batch_id).toBe("batch1");
  });

  it("an authored 'former_occupancy' anchor resolves like 'batch' (takes the event's batch id)", () => {
    const out = resolveChoreAnchor(
      { anchorType: "former_occupancy" }, { batchLink: { targetId: "batch1" } });
    expect(out.anchor_batch_id).toBe("batch1");
  });

  it("an authored 'species' anchor takes the resolved speciesId", () => {
    const out = resolveChoreAnchor({ anchorType: "species" }, { speciesId: "broiler" });
    expect(out.anchor_species_id).toBe("broiler");
  });

  it("an authored anchor WITHOUT a matching link (batch anchor, no batchLink) omits the concrete id gracefully", () => {
    const out = resolveChoreAnchor({ anchorType: "batch" }, {});
    expect(out.anchor_batch_id).toBeUndefined();
    expect(out.anchor_type).toBe("batch");
  });
});

describe("processChoreRow", () => {
  const process1 = { title: "Processing day prep" };
  const occurrence = { instanceLabel: "Batch 1 processing", date: "2026-06-10" };

  it("assembles a full one-time chore row from a chore-kind step", () => {
    const chore = { stepId: "s1", title: "Stage crates", targetDate: "2026-06-09", blockId: "late_afternoon" };
    const row = processChoreRow({
      expansionId: "exp1", chore, index: 0, process: process1, occurrence,
      batchLink: { targetId: "batch1" }, morningBlockId: "morning",
    });
    expect(row.id).toBe("process_exp1_s1");
    expect(row.category).toBe("one_time");
    expect(row.frequency).toEqual({ type: "once", date: "2026-06-09" });
    expect(row.block_id).toBe("late_afternoon");
    expect(row.process_expansion_id).toBe("exp1");
    expect(row.description).toContain("Processing day prep");
  });

  it("falls back to morningBlockId when the step authored no block (never emits block_id:null)", () => {
    const chore = { stepId: "s1", title: "Untimed step", targetDate: "2026-06-09", blockId: null };
    const row = processChoreRow({
      expansionId: "exp1", chore, index: 0, process: process1, occurrence,
      morningBlockId: "morning",
    });
    expect(row.block_id).toBe("morning");
  });

  it("with NO morningBlockId fallback available, block_id is explicitly null (not undefined)", () => {
    const chore = { stepId: "s1", title: "Untimed step", targetDate: "2026-06-09", blockId: null };
    const row = processChoreRow({
      expansionId: "exp1", chore, index: 0, process: process1, occurrence,
    });
    expect(row.block_id).toBeNull();
  });

  it("prepends the step's own bodyMd before the auto-generated process/event description line", () => {
    const chore = { stepId: "s1", title: "Stage crates", targetDate: "2026-06-09", bodyMd: "Check tire pressure first." };
    const row = processChoreRow({
      expansionId: "exp1", chore, index: 0, process: process1, occurrence,
    });
    expect(row.description.startsWith("Check tire pressure first.")).toBe(true);
    expect(row.description).toContain("Processing day prep");
  });
});

describe("classifyProcessWork", () => {
  // The event-side badge (EventEditor's ProcessWorkNote) once counted
  // every target_type:'chore' link as a "chore change". But a process
  // expansion emits two kinds of chore link: role 'process' (one-time
  // prep chores it *adds*) and role 'process_modifier' (edits to an
  // existing chore). Only the latter are chore *changes* — the badge
  // must not conflate them. (Real prod expansion: 6 prep + 1 modifier.)
  const prepChoreLink = { target_type: "chore", role: "process" };
  const modifierLink = { target_type: "chore", role: "process_modifier" };
  const legacyProjectLink = { id: "p1", target_type: "project", role: "process" };

  it("counts prep chores and modifier chores separately", () => {
    const links = [
      prepChoreLink, prepChoreLink, prepChoreLink,
      prepChoreLink, prepChoreLink, prepChoreLink,
      modifierLink,
    ];
    const { prepChoreCount, modifierCount } = classifyProcessWork(links);
    expect(prepChoreCount).toBe(6);
    expect(modifierCount).toBe(1);
  });

  it("keeps legacy project links out of the chore counts", () => {
    const { projectLinks, prepChoreCount, modifierCount } =
      classifyProcessWork([legacyProjectLink]);
    expect(projectLinks).toEqual([legacyProjectLink]);
    expect(prepChoreCount).toBe(0);
    expect(modifierCount).toBe(0);
  });

  it("treats missing/empty input as no process work", () => {
    expect(classifyProcessWork(null)).toEqual({
      projectLinks: [], prepChoreCount: 0, modifierCount: 0,
    });
  });
});

describe("occurrenceIsCurrent", () => {
  it("is true for today and any future date", () => {
    const today = new Date(2026, 5, 10);
    expect(occurrenceIsCurrent("2026-06-10", today)).toBe(true);
    expect(occurrenceIsCurrent("2026-06-11", today)).toBe(true);
  });

  it("is false for a date already in the past", () => {
    const today = new Date(2026, 5, 10);
    expect(occurrenceIsCurrent("2026-06-09", today)).toBe(false);
  });
});
