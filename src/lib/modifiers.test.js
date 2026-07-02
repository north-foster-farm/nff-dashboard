// Chore modifiers (Batch 23) — date-bound overrides (skip/replace/prepend/
// restrict_until) with deterministic priority-based conflict resolution.
// See nff-chores-spec.md §2.8 and CH-Modifier/CH-Modifier2 in the QA test
// plan: "a suppressed chore must NOT appear in the schedule at all (not
// shown-as-skipped)" and "winner solid, losers ghosted... highest priority
// wins, newest breaks ties."
import { describe, it, expect } from "vitest";
import {
  MODIFIER_ACTION_LABEL, modifiersFor, resolveModifiers, applyModifier,
  describeModifierSource, countModified,
} from "./modifiers.js";

function modifier(over = {}) {
  return {
    id: "m1",
    targetChoreId: "c1",
    occursOn: "2026-06-01",
    targetPlaceId: null,
    priority: 1,
    createdAt: "2026-05-01T00:00:00Z",
    action: "skip",
    replacementText: null,
    expiresAt: null,
    ...over,
  };
}

describe("MODIFIER_ACTION_LABEL", () => {
  it("labels every action kind", () => {
    expect(MODIFIER_ACTION_LABEL.skip).toBe("Skip today");
    expect(MODIFIER_ACTION_LABEL.replace).toBe("Do instead");
    expect(MODIFIER_ACTION_LABEL.prepend).toBe("Extra step");
    expect(MODIFIER_ACTION_LABEL.restrict_until).toBe("Earlier deadline");
  });
});

describe("modifiersFor — filtering", () => {
  it("matches on both choreId and the exact date", () => {
    const mods = [
      modifier({ id: "a", targetChoreId: "c1", occursOn: "2026-06-01" }),
      modifier({ id: "b", targetChoreId: "c2", occursOn: "2026-06-01" }), // wrong chore
      modifier({ id: "c", targetChoreId: "c1", occursOn: "2026-06-02" }), // wrong date
    ];
    expect(modifiersFor(mods, "c1", "2026-06-01").map((m) => m.id)).toEqual(["a"]);
  });

  it("excludes an EXPIRED modifier (expiresAt in the past)", () => {
    const mods = [modifier({ id: "a", expiresAt: "2020-01-01T00:00:00Z" })];
    expect(modifiersFor(mods, "c1", "2026-06-01")).toEqual([]);
  });

  it("includes a modifier expiring in the FUTURE", () => {
    const far = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const mods = [modifier({ id: "a", expiresAt: far })];
    expect(modifiersFor(mods, "c1", "2026-06-01").map((m) => m.id)).toEqual(["a"]);
  });

  it("includes a modifier with no expiresAt at all (never expires)", () => {
    const mods = [modifier({ id: "a", expiresAt: null })];
    expect(modifiersFor(mods, "c1", "2026-06-01")).toHaveLength(1);
  });

  it("a place-less modifier (targetPlaceId: null) applies everywhere, place or no place asked", () => {
    const mods = [modifier({ id: "a", targetPlaceId: null })];
    expect(modifiersFor(mods, "c1", "2026-06-01", "coop1")).toHaveLength(1);
    expect(modifiersFor(mods, "c1", "2026-06-01", null)).toHaveLength(1);
  });

  it("a place-scoped modifier applies when the caller's placeId matches", () => {
    const mods = [modifier({ id: "a", targetPlaceId: "coop1" })];
    expect(modifiersFor(mods, "c1", "2026-06-01", "coop1")).toHaveLength(1);
  });

  it("a place-scoped modifier is excluded when the caller asks for a DIFFERENT place", () => {
    const mods = [modifier({ id: "a", targetPlaceId: "coop1" })];
    expect(modifiersFor(mods, "c1", "2026-06-01", "coop2")).toEqual([]);
  });

  it("a place-scoped modifier is included when the caller doesn't specify a place at all (unscoped query)", () => {
    const mods = [modifier({ id: "a", targetPlaceId: "coop1" })];
    expect(modifiersFor(mods, "c1", "2026-06-01", null)).toHaveLength(1);
  });

  it("handles a null/empty modifiers list", () => {
    expect(modifiersFor(null, "c1", "2026-06-01")).toEqual([]);
    expect(modifiersFor([], "c1", "2026-06-01")).toEqual([]);
  });
});

describe("modifiersFor — winner ordering (priority desc, then createdAt desc, then id asc)", () => {
  it("higher priority sorts first regardless of creation order", () => {
    const mods = [
      modifier({ id: "low", priority: 1, createdAt: "2026-05-10T00:00:00Z" }),
      modifier({ id: "high", priority: 10, createdAt: "2026-05-01T00:00:00Z" }),
    ];
    expect(modifiersFor(mods, "c1", "2026-06-01").map((m) => m.id)).toEqual(["high", "low"]);
  });

  it("equal priority breaks ties to the NEWEST createdAt", () => {
    const mods = [
      modifier({ id: "older", priority: 5, createdAt: "2026-05-01T00:00:00Z" }),
      modifier({ id: "newer", priority: 5, createdAt: "2026-05-10T00:00:00Z" }),
    ];
    expect(modifiersFor(mods, "c1", "2026-06-01").map((m) => m.id)).toEqual(["newer", "older"]);
  });

  it("equal priority AND equal createdAt breaks ties to id (full determinism, never arbitrary)", () => {
    const mods = [
      modifier({ id: "b", priority: 5, createdAt: "2026-05-01T00:00:00Z" }),
      modifier({ id: "a", priority: 5, createdAt: "2026-05-01T00:00:00Z" }),
    ];
    expect(modifiersFor(mods, "c1", "2026-06-01").map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("resolveModifiers", () => {
  it("returns null when nothing applies (no modifier this day)", () => {
    expect(resolveModifiers([], "c1", "2026-06-01")).toBeNull();
  });

  it("returns {winner, losers, all} with the winner FIRST, losers in the same rank order", () => {
    const mods = [
      modifier({ id: "high", priority: 10 }),
      modifier({ id: "mid", priority: 5 }),
      modifier({ id: "low", priority: 1 }),
    ];
    const r = resolveModifiers(mods, "c1", "2026-06-01");
    expect(r.winner.id).toBe("high");
    expect(r.losers.map((m) => m.id)).toEqual(["mid", "low"]);
    expect(r.all.map((m) => m.id)).toEqual(["high", "mid", "low"]);
  });

  it("a single applicable modifier has an empty losers array (nothing silently disappears, but nothing to ghost)", () => {
    const r = resolveModifiers([modifier()], "c1", "2026-06-01");
    expect(r.losers).toEqual([]);
  });
});

describe("applyModifier — display effects of the WINNING modifier", () => {
  it("returns all-false/null when nothing resolved (no modifier applies)", () => {
    expect(applyModifier(null)).toEqual({
      skipped: false, replaceText: null, prependText: null, deadlineText: null,
    });
  });

  it("'skip' sets skipped:true and nothing else — the chore must not appear at all, per CH-Modifier2", () => {
    const r = resolveModifiers([modifier({ action: "skip" })], "c1", "2026-06-01");
    expect(applyModifier(r)).toEqual({
      skipped: true, replaceText: null, prependText: null, deadlineText: null,
    });
  });

  it("'replace' sets replaceText from replacementText", () => {
    const r = resolveModifiers(
      [modifier({ action: "replace", replacementText: "Wash brooder instead" })],
      "c1", "2026-06-01");
    expect(applyModifier(r).replaceText).toBe("Wash brooder instead");
    expect(applyModifier(r).skipped).toBe(false);
  });

  it("'prepend' sets prependText from replacementText", () => {
    const r = resolveModifiers(
      [modifier({ action: "prepend", replacementText: "Check for mites first" })],
      "c1", "2026-06-01");
    expect(applyModifier(r).prependText).toBe("Check for mites first");
  });

  it("'restrict_until' sets deadlineText from replacementText", () => {
    const r = resolveModifiers(
      [modifier({ action: "restrict_until", replacementText: "by 2 PM" })],
      "c1", "2026-06-01");
    expect(applyModifier(r).deadlineText).toBe("by 2 PM");
  });

  it("only reads the WINNER — a losing modifier's action has zero display effect", () => {
    const mods = [
      modifier({ id: "winner", priority: 10, action: "skip" }),
      modifier({ id: "loser", priority: 1, action: "replace", replacementText: "should not show" }),
    ];
    const r = resolveModifiers(mods, "c1", "2026-06-01");
    const applied = applyModifier(r);
    expect(applied.skipped).toBe(true);
    expect(applied.replaceText).toBeNull();
  });
});

describe("describeModifierSource", () => {
  it("names the process when a title is resolvable", () => {
    const processTitleById = new Map([["exp1", "Processing day prep"]]);
    const src = describeModifierSource(
      { source: "process", processExpansionId: "exp1" }, processTitleById);
    expect(src).toBe("Process: Processing day prep");
  });

  it("falls back to 'A process' when the title can't be resolved", () => {
    expect(describeModifierSource({ source: "process", processExpansionId: "gone" }, new Map()))
      .toBe("A process");
    expect(describeModifierSource({ source: "process", processExpansionId: null }, new Map()))
      .toBe("A process");
  });

  it("labels an automation-sourced modifier plainly", () => {
    expect(describeModifierSource({ source: "automation" })).toBe("An automation");
  });

  it("labels a hand-added modifier with the creator's local-part email", () => {
    expect(describeModifierSource({ source: "manual", createdByEmail: "james@northfosterfarm.com" }))
      .toBe("Added by james");
  });

  it("falls back to 'Added by hand' with no email on record", () => {
    expect(describeModifierSource({ source: "manual", createdByEmail: null })).toBe("Added by hand");
  });
});

describe("countModified", () => {
  it("counts DISTINCT chores (in the given set) with at least one modifier that day", () => {
    const modifiers = [
      { targetChoreId: "c1", occursOn: "2026-06-01" },
      { targetChoreId: "c1", occursOn: "2026-06-01" }, // second modifier, same chore -> counts once
      { targetChoreId: "c2", occursOn: "2026-06-01" },
    ];
    expect(countModified(modifiers, ["c1", "c2", "c3"], "2026-06-01")).toBe(2);
  });

  it("ignores modifiers on a different date", () => {
    const modifiers = [{ targetChoreId: "c1", occursOn: "2026-06-02" }];
    expect(countModified(modifiers, ["c1"], "2026-06-01")).toBe(0);
  });

  it("ignores modifiers targeting a chore NOT in the given choreIds set", () => {
    const modifiers = [{ targetChoreId: "not-in-set", occursOn: "2026-06-01" }];
    expect(countModified(modifiers, ["c1", "c2"], "2026-06-01")).toBe(0);
  });

  it("returns 0 for an empty/missing modifiers list", () => {
    expect(countModified([], ["c1"], "2026-06-01")).toBe(0);
    expect(countModified(null, ["c1"], "2026-06-01")).toBe(0);
  });
});
