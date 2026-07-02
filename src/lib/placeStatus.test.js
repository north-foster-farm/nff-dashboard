// The derived place_status projection (Batch 17/18) — the shared-status
// math behind Now's overdue list, the Farm map's zone tint, and a
// place page's "Chores here today" pill. Per the QA test plan's
// wrap-up: "an overdue chore should appear in Now's overdue list, tint
// its zone on the Farm map with a matching count, and show in that
// place's 'Chores here today'" — these tests pin the ONE computation
// all three surfaces read, so they can't drift from each other.
import { describe, it, expect } from "vitest";
import { obligationStatus, computePlaceStatus } from "./placeStatus.js";
import { buildPlaceTree } from "./places.js";

const d = (y, m, day, h = 12, min = 0) => new Date(y, m - 1, day, h, min);

function fixedBlock(id, startMinutes, durationMinutes = 60) {
  return { id, startKind: "fixed", startMinutes, durationMinutes, isActive: true };
}
const MORNING = fixedBlock("morning", 360, 60); // 6:00-7:00
const BLOCKS = [MORNING];

function dailyChore(id, over = {}) {
  return {
    id, title: id, blockId: "morning",
    frequency: { type: "daily" }, deadline: { kind: "midnight" },
    ...over,
  };
}

describe("obligationStatus", () => {
  it("a done obligation always reads 'done', regardless of deadline state", () => {
    const chore = dailyChore("c1", { deadline: { kind: "block_on_weekday", block: "morning", weekday: 3 } });
    expect(obligationStatus(chore, true, d(2026, 6, 5, 22), BLOCKS)).toBe("done");
  });

  it("a windowy chore with future runway reads 'due'", () => {
    const chore = dailyChore("c1", {
      deadline: {}, frequency: { type: "weekly_window", preferredDay: 1, latestDay: 5 },
    });
    expect(obligationStatus(chore, false, d(2026, 6, 1, 9), [])).toBe("due"); // Monday, latest Friday
  });

  it("a windowy chore whose deadline has passed reads 'overdue'", () => {
    const chore = dailyChore("c1", {
      deadline: {}, frequency: { type: "once", date: "2026-06-01" },
    });
    expect(obligationStatus(chore, false, d(2026, 6, 5, 9), [])).toBe("overdue");
  });

  it("a plain daily block chore reads 'due' WHILE its block window is still open", () => {
    const chore = dailyChore("c1", { blockId: "morning" });
    expect(obligationStatus(chore, false, d(2026, 6, 1, 6, 30), BLOCKS)).toBe("due");
  });

  it("a plain daily block chore flips to 'overdue' once its block window has fully passed", () => {
    const chore = dailyChore("c1", { blockId: "morning" });
    expect(obligationStatus(chore, false, d(2026, 6, 1, 8, 0), BLOCKS)).toBe("overdue");
  });

  it("an anytime chore (no matching block) defaults to 'due' — never silently overdue", () => {
    const chore = dailyChore("c1", { blockId: "nonexistent-block" });
    expect(obligationStatus(chore, false, d(2026, 6, 1, 23, 0), BLOCKS)).toBe("due");
  });
});

describe("computePlaceStatus", () => {
  const places = [
    { id: "farm", parentId: null, name: "Farm", isActive: true },
    { id: "pastureA", parentId: "farm", name: "Pasture A", isActive: true },
    { id: "coop1", parentId: "pastureA", name: "Mobile Coop 1", isActive: true },
  ];
  const tree = buildPlaceTree(places);
  const choreCtx = { placesById: tree.byId };

  it("skips a chore that doesn't fire today (isChoreActiveOn gate)", () => {
    const defs = [dailyChore("c1", { frequency: { type: "weekly", days: [1] }, anchorType: "none" })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx, isDone: () => false,
      now: d(2026, 6, 2, 9), // a Tuesday
    });
    expect(out.obligations).toEqual([]);
  });

  it("a placeless chore (anchorType:'none') bumps only the null key", () => {
    const defs = [dailyChore("c1", { anchorType: "none" })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx, isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.byPlace.get(null).total).toBe(1);
    expect(out.byPlace.has("farm")).toBe(false);
  });

  it("a place-anchored obligation propagates UP the tree to every ancestor", () => {
    const defs = [dailyChore("c1", { anchorType: "place", placeId: "coop1" })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx, isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.byPlace.get("coop1").total).toBe(1);
    expect(out.byPlace.get("pastureA").total).toBe(1); // propagated up
    expect(out.byPlace.get("farm").total).toBe(1);      // propagated to the root
  });

  it("flagOf reads 'overdue' when ANY obligation under that place is overdue, even if others are done", () => {
    const defs = [
      dailyChore("done1", { anchorType: "place", placeId: "coop1" }),
      dailyChore("overdue1", { anchorType: "place", placeId: "coop1" }),
    ];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx,
      isDone: (choreId) => choreId === "done1",
      now: d(2026, 6, 1, 8, 0), // past the morning block -> overdue1 is overdue
    });
    expect(out.flagOf("coop1")).toBe("overdue");
    expect(out.flagOf("pastureA")).toBe("overdue"); // propagates
  });

  it("flagOf reads 'due' when nothing is overdue but something is still outstanding", () => {
    const defs = [dailyChore("c1", { anchorType: "place", placeId: "coop1" })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx, isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.flagOf("coop1")).toBe("due");
  });

  it("flagOf reads 'done' when every obligation under that place is complete", () => {
    const defs = [dailyChore("c1", { anchorType: "place", placeId: "coop1" })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS, choreCtx, isDone: () => true, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.flagOf("coop1")).toBe("done");
  });

  it("flagOf reads 'idle' for a place with no obligations at all today (never 'due' by default)", () => {
    const out = computePlaceStatus({
      definitions: [], blocks: BLOCKS, choreCtx, isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.flagOf("coop1")).toBe("idle");
  });

  it("a chore anchored to a place with NO active animals (dormant) contributes zero obligations there", () => {
    const defs = [dailyChore("c1", {
      anchorType: "species", anchorSpeciesId: "layer",
    })];
    const out = computePlaceStatus({
      definitions: defs, blocks: BLOCKS,
      choreCtx: { placesById: tree.byId, placementsByPlaceId: new Map(), groupsById: new Map() },
      isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.obligations).toEqual([]);
  });

  it("handles an empty definitions list without throwing (no obligations anywhere)", () => {
    const out = computePlaceStatus({
      definitions: [], blocks: BLOCKS, choreCtx, isDone: () => false, now: d(2026, 6, 1, 6, 30),
    });
    expect(out.obligations).toEqual([]);
    expect(out.flagOf("anything")).toBe("idle");
  });
});
