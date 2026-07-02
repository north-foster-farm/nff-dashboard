// Schedule instance overrides (S6 3/3 — S63/S64/S71/S73/S74) + the
// protection double-confirm heuristic (S65/S66/S70, BD19/BD27/BD28).
// Global chore/block definitions must NEVER be touched by any of this —
// every effect here is schedule-local (BD19), which the tests assert by
// construction (the override objects never mutate anything but the
// returned row copies).
import { describe, it, expect } from "vitest";
import { targetKey, applyOverrides, assessEdit } from "./overrides.js";

function choreRow(over = {}) {
  return {
    kind: "chore",
    chore: { id: "c1", title: "Fill waterer" },
    placeId: "coop1",
    assignee: null,
    ...over,
  };
}

function blockRowsWith(rows, bucket = "morning") {
  return [{ bucket, rows }];
}

const isRealBlock = (id) => ["morning", "evening"].includes(id);

describe("targetKey", () => {
  it("combines choreId + placeId with a separator", () => {
    expect(targetKey("c1", "coop1")).toBe("c1|coop1");
  });

  it("treats a missing/null placeId as an empty segment (whole-farm chores)", () => {
    expect(targetKey("c1", null)).toBe("c1|");
    expect(targetKey("c1", undefined)).toBe("c1|");
  });
});

describe("applyOverrides — derived chore rows", () => {
  it("an unedited row keeps its original bucket, derived order, and carries no edit", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out[0]).toMatchObject({ bucket: "morning", order: 0 });
    expect(out[0].row.edit).toBeUndefined();
  });

  it("a matching override relocates the row to its destination block", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "evening" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].bucket).toBe("evening");
  });

  it("relocating to a block that no longer exists falls back to 'anytime' (orphan-tolerant)", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "deleted-block" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].bucket).toBe("anytime");
  });

  it("a relocated row with no explicit order sorts to the END of its new block (RELOCATED_BIAS)", () => {
    const rows = blockRowsWith([choreRow(), choreRow({ chore: { id: "c2" } })], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "evening" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    const moved = out.find((r) => r.row.chore.id === "c1");
    expect(moved.order).toBeGreaterThanOrEqual(1000);
  });

  it("an explicit overrides.order value wins over the relocation bias", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "evening" },
      overrides: { order: 5 },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].order).toBe(5);
  });

  it("a same-block reorder (S71) keeps the given order without the relocation bias", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "morning" },
      overrides: { order: 2 },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].bucket).toBe("morning");
    expect(out[0].order).toBe(2);
  });

  it("an override with an assignee reassigns the row (S89-adjacent, but schedule-local)", () => {
    const rows = blockRowsWith([choreRow({ assignee: "James" })], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" } },
      assignee: "Jim",
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].row.assignee).toBe("Jim");
  });

  it("carries the edit object (overrideId, clockTime, history, cover) for S74's viewable history", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" } },
      clock_time: "14:00",
      history: [{ at: "2026-06-01T10:00:00Z", summary: "Rescheduled from Morning to 2:00 PM" }],
      overrides: { cover: { by: "Jim" } },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].row.edit).toEqual({
      overrideId: "ov1", clockTime: "14:00",
      history: [{ at: "2026-06-01T10:00:00Z", summary: "Rescheduled from Morning to 2:00 PM" }],
      cover: { by: "Jim" },
    });
  });

  it("an override targeting a (choreId, placeId) not present today matches nothing (orphan-tolerant)", () => {
    const rows = blockRowsWith([choreRow()], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "nonexistent", place_id: "coop1" } },
    }];
    expect(() => applyOverrides(rows, overrides, isRealBlock)).not.toThrow();
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].row.edit).toBeUndefined();
  });

  it("place-scoped disambiguation: an override for one place doesn't affect the same chore at a different place", () => {
    const rows = blockRowsWith([
      choreRow({ placeId: "coop1" }),
      choreRow({ placeId: "coop2" }),
    ], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "evening" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    const coop1Row = out.find((r) => r.row.placeId === "coop1");
    const coop2Row = out.find((r) => r.row.placeId === "coop2");
    expect(coop1Row.bucket).toBe("evening");
    expect(coop2Row.bucket).toBe("morning");
  });

  it("does not match an override on a chore row that already has a deltaId (it's commitment-backed, handled separately)", () => {
    const rows = blockRowsWith([choreRow({ deltaId: "delta-1" })], "morning");
    const overrides = [{
      id: "ov1",
      source_ref: { target: { chore_id: "c1", place_id: "coop1" }, block_id: "evening" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    // The override targets a chore-with-deltaId row, which takes the
    // commitment-backed branch and never looks at byTarget — bucket
    // stays put.
    expect(out[0].bucket).toBe("morning");
  });
});

describe("applyOverrides — commitment-backed rows (ad_hoc / project_node / note)", () => {
  function commitmentRow(commitment) {
    return { kind: "ad_hoc", commitment };
  }

  it("reads order/assignee/history straight off the commitment's own overrides", () => {
    const rows = blockRowsWith([
      commitmentRow({ id: "d1", overrides: { order: 3 }, assignee: "Jim", history: [{ summary: "moved" }] }),
    ], "morning");
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out[0].order).toBe(3);
    expect(out[0].row.assignee).toBe("Jim");
    expect(out[0].row.edit.history).toEqual([{ summary: "moved" }]);
  });

  it("a commitment with a clock_time carries an edit object even with no history", () => {
    const rows = blockRowsWith([commitmentRow({ id: "d1", clock_time: "09:30" })], "morning");
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out[0].row.edit.clockTime).toBe("09:30");
  });

  it("a plain commitment-backed row with nothing edited carries no edit object", () => {
    const rows = blockRowsWith([commitmentRow({ id: "d1" })], "morning");
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out[0].row.edit).toBeUndefined();
  });

  it("falls back to row.delta when row.commitment is absent (project_node delta shape)", () => {
    const rows = blockRowsWith([{ kind: "ad_hoc", delta: { id: "d1", clock_time: "09:30" } }], "morning");
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out[0].row.edit.clockTime).toBe("09:30");
  });

  it("commitment-backed rows never consult the override-by-target map (their placement is their own field)", () => {
    const rows = blockRowsWith([commitmentRow({ id: "d1" })], "morning");
    // An override that happens to target chore_id 'd1' should have zero
    // effect on a commitment-backed row (different resolution path).
    const overrides = [{
      id: "ov1", source_ref: { target: { chore_id: "d1" }, block_id: "evening" },
    }];
    const out = applyOverrides(rows, overrides, isRealBlock);
    expect(out[0].bucket).toBe("morning");
  });
});

describe("applyOverrides — multiple blocks + preserves relative order for unedited rows", () => {
  it("processes every block in blockRows and concatenates results in block order", () => {
    const rows = [
      { bucket: "morning", rows: [choreRow({ chore: { id: "m1" } })] },
      { bucket: "evening", rows: [choreRow({ chore: { id: "e1" } })] },
    ];
    const out = applyOverrides(rows, [], isRealBlock);
    expect(out.map((r) => r.row.chore.id)).toEqual(["m1", "e1"]);
  });

  it("an empty blockRows list returns an empty array", () => {
    expect(applyOverrides([], [], isRealBlock)).toEqual([]);
  });
});

describe("assessEdit — the protection double-confirm heuristic (S65/S66/S70)", () => {
  it("no day move + no block move -> never protected (a retime or reorder within the block is silent, S71)", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", toBlockId: "morning",
      toDate: null, committed: true,
    });
    expect(r).toEqual({ protected: false, why: null });
  });

  it("moving to another day on an UNCONFIRMED draft is free — no protection (F62)", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", toBlockId: "morning",
      toDate: "2026-06-05", committed: false,
    });
    expect(r.protected).toBe(false);
  });

  it("moving to another day on a CONFIRMED day IS protected, explaining it changes the agreed plan", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", toBlockId: "morning",
      toDate: "2026-06-05", committed: true,
    });
    expect(r.protected).toBe(true);
    expect(r.why).toContain("Fill waterer");
    expect(r.why).toContain("committed");
  });

  it("moving to a DIFFERENT block is protected, naming the source block", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", fromBlockName: "Morning",
      toBlockId: "evening", toDate: null, committed: false,
    });
    expect(r.protected).toBe(true);
    expect(r.why).toContain("from the Morning block");
  });

  it("moving the FIRST item of a block adds the animals-may-depend-on-it warning (S70 — explains why)", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", fromBlockName: "Morning",
      isFirstInBlock: true, toBlockId: "evening", toDate: null, committed: false,
    });
    expect(r.why).toContain("first task");
    expect(r.why).toContain("animals may depend");
  });

  it("moving a non-first item omits the animals-may-depend-on-it clause", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", fromBlockName: "Morning",
      isFirstInBlock: false, toBlockId: "evening", toDate: null, committed: false,
    });
    expect(r.why).not.toContain("animals may depend");
  });

  it("toBlockId equal to fromBucket is NOT a block move (same-block retime, never protected on its own)", () => {
    const r = assessEdit({
      label: "Fill waterer", fromBucket: "morning", toBlockId: "morning",
      toDate: null, committed: true,
    });
    expect(r.protected).toBe(false);
  });

  it("BD28 pinned: protection is a warning, never a block — the function only ever informs, it has no 'forbid' outcome", () => {
    // There is no third state; the shape is always { protected, why }.
    const r = assessEdit({
      label: "x", fromBucket: "a", toBlockId: "b", toDate: null, committed: false,
    });
    expect(Object.keys(r).sort()).toEqual(["protected", "why"]);
  });
});
