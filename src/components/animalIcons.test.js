// Species→icon resolution (F27 — "sheep shows a bird icon; paw is wrong
// for sheep"). One central map so the sidebar, the command palette, and
// any future animal surface all draw the SAME glyph for a species —
// layers an egg, broilers a bird, sheep the sheep glyph — instead of
// every call site hardcoding its own (which is how a sheep batch ended
// up wearing a Bird in the command palette).
import { describe, it, expect } from "vitest";
import { Egg, Bird, PawPrint } from "lucide-react";
import { Sheep, Chicken, iconForSpecies } from "./animalIcons.jsx";

describe("iconForSpecies", () => {
  it("gives layers an egg", () => {
    expect(iconForSpecies("layers")).toBe(Egg);
  });

  it("gives broilers the chicken glyph, freeing Bird for other uses", () => {
    expect(iconForSpecies("broilers")).toBe(Chicken);
    expect(iconForSpecies("broilers")).not.toBe(Bird);
  });

  it("gives sheep the sheep glyph, not a bird or a paw", () => {
    const icon = iconForSpecies("sheep");
    expect(icon).toBe(Sheep);
    expect(icon).not.toBe(Bird);
    expect(icon).not.toBe(PawPrint);
  });

  it("falls back to a generic animal glyph for an unknown species", () => {
    expect(iconForSpecies("goats")).toBe(PawPrint);
    expect(iconForSpecies(undefined)).toBe(PawPrint);
  });
});
