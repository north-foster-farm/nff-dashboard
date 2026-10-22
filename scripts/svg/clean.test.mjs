// The SVG clean-up (north-foster-farm#295): James's SVGOMG settings,
// an unused-class strip, and a check that fails on an uncleaned SVG.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { optimize } from "svgo";

import config, {
  configFor, FEATURES, OVERRIDES, plugins,
} from "../../svgo.config.mjs";
import { clean, guard, trackedSvgs } from "./clean.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const cleanScript = join(repoRoot, "scripts/svg/clean.mjs");

// James's ~/.bin/svgomg, its FEATURES as of 2026-10-21: [name, on,
// params]. When he changes his settings, change this list and
// svgo.config.mjs together.
const P = { floatPrecision: 10 };
const T = { ...P, transformPrecision: 10 };
const SVGOMG_FEATURES = [
  ["removeDoctype", true], ["removeXMLProcInst", true],
  ["removeComments", true], ["removeMetadata", true],
  ["removeXMLNS", false], ["removeEditorsNSData", true],
  ["cleanupAttrs", true], ["mergeStyles", true], ["inlineStyles", true],
  ["minifyStyles", true], ["convertStyleToAttrs", false],
  ["cleanupIds", true], ["removeRasterImages", true],
  ["removeUselessDefs", true], ["cleanupNumericValues", true, P],
  ["cleanupListOfValues", true, P], ["convertColors", true],
  ["removeUnknownsAndDefaults", true],
  ["removeNonInheritableGroupAttrs", true],
  ["removeUselessStrokeAndFill", true], ["removeViewBox", false],
  ["cleanupEnableBackground", true], ["removeHiddenElems", true],
  ["removeEmptyText", true], ["convertShapeToPath", true, P],
  ["moveElemsAttrsToGroup", true], ["moveGroupAttrsToElems", true],
  ["collapseGroups", true], ["convertPathData", true, P],
  ["convertEllipseToCircle", true], ["convertTransform", true, T],
  ["removeEmptyAttrs", true], ["removeEmptyContainers", true],
  ["mergePaths", true, P], ["removeUnusedNS", true], ["reusePaths", true],
  ["sortAttrs", true], ["sortDefsChildren", true], ["removeTitle", true],
  ["removeDesc", true], ["removeDimensions", true],
  ["removeStyleElement", true], ["removeScripts", true],
  ["removeOffCanvasPaths", true], ["convertOneStopGradients", true],
  ["removeDeprecatedAttrs", true], ["removeXlink", false],
];

const uncleanedIcon = '<svg xmlns="http://www.w3.org/2000/svg" ' +
  'class="lucide lucide-x" viewBox="0 0 24 24" width="24" height="24">' +
  '<title>x</title><path d="M18 6 6 18"/></svg>';

const runCheck = (file) => spawnSync(process.execPath,
  [cleanScript, "--check", file], { encoding: "utf8" });

const writeScratchSvg = (name, markup) => {
  const file = join(mkdtempSync(join(tmpdir(), "svg-")), name);
  writeFileSync(file, markup);
  return file;
};

describe("svgo.config.mjs matches ~/.bin/svgomg", () => {
  it("lists SVGOMG's features in its order, the same four off", () => {
    expect(FEATURES).toEqual(SVGOMG_FEATURES);
  });

  it("sets SVGOMG's global options", () => {
    expect(config.multipass).toBe(true);
    expect(config.floatPrecision).toBe(10);
    expect(config.js2svg)
      .toEqual({ pretty: true, indent: 2, eol: "lf", finalNewline: true });
  });

  it("runs the features that are on, then the class strip", () => {
    const pluginNames = config.plugins.map((plugin) => plugin.name ?? plugin);
    const enabledFeatures = SVGOMG_FEATURES
      .filter(([, on]) => on).map(([name]) => name);

    expect(pluginNames).toEqual([...enabledFeatures, "stripUnusedClasses"]);
  });
});

describe("the class strip", () => {
  it("drops Lucide's classes", () => {
    expect(clean(uncleanedIcon, "x.svg")).not.toMatch(/class=/);
  });

  it("stops before dropping a class or id the app names", () => {
    const before = '<svg viewBox="0 0 4 4"><path id="dot" ' +
      'class="pin" d="M0 0h4v4H0z"/></svg>';
    const after = '<svg viewBox="0 0 4 4"><path d="M0 0h4v4H0z"/></svg>';
    const appFiles = [
      { file: "src/a.css", text: ".pin { fill: red; }" },
      { file: "src/b.jsx", text: 'getElementById("dot")' },
    ];

    expect(guard(before, after, appFiles)).toEqual([
      { kind: "class", name: "pin", files: ["src/a.css"] },
      { kind: "id", name: "dot", files: ["src/b.jsx"] },
    ]);
  });
});

describe("check:svg", () => {
  it("fails on an SVG the clean-up would change, and writes nothing", () => {
    const file = writeScratchSvg("uncleaned.svg", uncleanedIcon);
    const result = runCheck(file);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/not cleaned\. Run npm run svg:clean/);
    expect(readFileSync(file, "utf8")).toBe(uncleanedIcon);
  });

  it("passes the same SVG once cleaned", () => {
    const cleanedIcon = clean(uncleanedIcon, "x.svg");
    const file = writeScratchSvg("cleaned.svg", cleanedIcon);

    expect(runCheck(file).status).toBe(0);
  });

  it("runs inside npm run check, so the pre-commit hook and CI run it", () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json")));

    expect(pkg.scripts.check).toMatch(/npm run check:svg/);
  });

  it("checks the farm map too, with its override", () => {
    expect(trackedSvgs()).toContain("public/farm-map_v1.svg");
    expect(runCheck(join(repoRoot, "public/farm-map_v1.svg")).status)
      .toBe(0);
  });
});

describe("per-file overrides", () => {
  const tracked = new Set(trackedSvgs());
  const featuresOn = new Set(
    FEATURES.filter(([, on]) => on).map(([name]) => name),
  );
  const readRepoFile = (file) => readFileSync(join(repoRoot, file), "utf8");

  it("keep the farm map's layer ids, which bind it to places", () => {
    const map = "public/farm-map_v1.svg";

    expect(Object.keys(OVERRIDES[map].off)).toEqual(["cleanupIds"]);
    expect(clean(readRepoFile(map), map)).toMatch(/id="Pasture-A"/);
  });

  it("name tracked files and SVGOMG features, each with a reason", () => {
    for (const [file, { off = {}, classes = {} }] of
      Object.entries(OVERRIDES)) {
      expect(tracked.has(file), file).toBe(true);
      for (const feature of Object.keys(off)) {
        expect(featuresOn.has(feature), feature).toBe(true);
      }
      for (const reason of [...Object.values(off), ...Object.values(classes)]) {
        expect(reason.length, file).toBeGreaterThan(20);
      }
    }
  });

  it("turn off only what the file needs", () => {
    for (const [file, override] of Object.entries(OVERRIDES)) {
      for (const feature of Object.keys(override.off ?? {})) {
        const rest = Object.fromEntries(Object.entries(override.off)
          .filter(([name]) => name !== feature));
        const withFeatureOn = optimize(readRepoFile(file), {
          ...configFor(file), path: file,
          plugins: plugins({ ...override, off: rest }),
        }).data;

        expect(withFeatureOn, `${file}: ${feature}`)
          .not.toBe(readRepoFile(file));
      }
    }
  });
});
