// URL slugs for projects (the "/projects/farm-stand-rebuild" ask).
// A slug is derived from the title once, at create/backfill time, and
// then STICKS — retitling never rewrites it, so links keep working.
// These tests pin the derivation rules: web-conventional dashes,
// bounded length, and collision suffixes against the taken set.
import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("lowercases and dashes a plain title", () => {
    expect(slugify("Farm Stand Rebuild")).toBe("farm-stand-rebuild");
  });

  it("collapses punctuation runs into single dashes", () => {
    expect(slugify("Coop #2 — roof & door")).toBe("coop-2-roof-door");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("  (Winter) water plan!  ")).toBe("winter-water-plan");
  });

  it("caps at 60 chars without ending on a dash", () => {
    const longTitle =
      "A very long project title that keeps going and going and going on";
    const slug = slugify(longTitle);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("returns null when nothing slug-worthy survives", () => {
    expect(slugify("——!!——")).toBeNull();
    expect(slugify("")).toBeNull();
    expect(slugify(null)).toBeNull();
  });

  it("suffixes -2, -3… against the taken set", () => {
    const taken = new Set(["barn-paint", "barn-paint-2"]);
    expect(slugify("Barn paint", taken)).toBe("barn-paint-3");
  });

  it("a unique title needs no suffix even with a taken set", () => {
    const taken = new Set(["barn-paint"]);
    expect(slugify("Fence line", taken)).toBe("fence-line");
  });
});
