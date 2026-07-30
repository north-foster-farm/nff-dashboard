// Ramp-name parity between the token layer and the design system's two
// faces (H3 enforcement, F2 findings 27/28). The style guide's standing
// rule says both faces update with every token change — this is the
// check that rule never had. It caught, in both directions: three
// documented ramps that had no tokens (teal / mulberry / terracotta)
// and one real ramp documented nowhere (emerald, the brand green).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const cssSource = readFileSync("src/styles.css", "utf8");
const machineFace = readFileSync(
  "public/style-guide/DESIGN-SYSTEM.md", "utf8");
const visualFace = readFileSync(
  "public/style-guide/foundations.html", "utf8");

// A ramp exists iff its 500 stop is a real token in the @theme map.
const tokenRamps = [...cssSource.matchAll(/--color-([a-z-]+)-500:/g)]
  .map((m) => m[1]);

// Every swatch row in foundations.html's RAMPS array, by leading name.
const rampsArray = visualFace.slice(
  visualFace.indexOf("var RAMPS = ["), visualFace.indexOf("];",
    visualFace.indexOf("var RAMPS = [")));
const swatchNames = [...rampsArray.matchAll(/\["([a-z-]+)[" (→]/g)]
  .map((m) => m[1]);

// Colors the guide documents deliberately WITHOUT a 50-950 scale:
// single-alias palette additions, and the chore teal (a hardcoded
// --c-chore hex). Their swatch labels must say so, and styles.css must
// NOT quietly grow a scale for them without the docs noticing.
const documentedNoRampColors = ["teal", "mulberry", "terracotta"];

describe("style-guide ramp parity", () => {
  it("documents every token ramp in the machine face", () => {
    for (const ramp of tokenRamps) {
      expect(machineFace, `DESIGN-SYSTEM.md never names the` +
        ` --color-${ramp}-* ramp`).toContain(ramp);
    }
  });

  it("documents every token ramp in the visual face", () => {
    for (const ramp of tokenRamps) {
      expect(visualFace, `foundations.html never names the` +
        ` --color-${ramp}-* ramp`).toContain(ramp);
    }
  });

  it("backs every swatch row with a token ramp or a no-ramp note", () => {
    for (const name of swatchNames) {
      if (documentedNoRampColors.includes(name)) continue;
      expect(tokenRamps, `foundations.html swatches "${name}" but` +
        ` styles.css has no --color-${name}-500 token`).toContain(name);
    }
  });

  it("keeps the no-ramp allow-list honest", () => {
    for (const name of documentedNoRampColors) {
      expect(tokenRamps, `"${name}" is allow-listed as having no ramp,` +
        ` but styles.css now defines --color-${name}-500 — move it to` +
        ` the documented ramps`).not.toContain(name);
    }
  });
});
