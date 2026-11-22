// The one SVG clean-up every tracked .svg goes through
// (north-foster-farm#295): `npm run svg:clean` writes it, and
// `npm run check:svg` fails on a file that differs from it. See
// public/README.md.
//
// Source: James's ~/.bin/svgomg, which holds his SVGOMG settings and
// how each maps to SVGO 4. FEATURES below is its FEATURES list, in
// its order (the run order), with the same four off. Keep the two in
// step: scripts/svg/clean.test.mjs holds a copy of the reference list
// and fails when this one drifts from it. The site's svgo.config.mjs
// is the same file.

import { relative, resolve, sep } from "node:path";

import { stripUnusedClasses } from "./scripts/svg/strip.mjs";

export const PRETTIFY = true;
export const MULTIPASS = true;
export const FLOAT_PRECISION = 10;
export const TRANSFORM_PRECISION = 10;

const P = { floatPrecision: FLOAT_PRECISION };

// [name, on, params?], as in ~/.bin/svgomg.
export const FEATURES = [
  ["removeDoctype", true],
  ["removeXMLProcInst", true],
  ["removeComments", true],
  ["removeMetadata", true],
  ["removeXMLNS", false],
  ["removeEditorsNSData", true],
  ["cleanupAttrs", true],
  ["mergeStyles", true],
  ["inlineStyles", true],
  ["minifyStyles", true],
  ["convertStyleToAttrs", false],
  ["cleanupIds", true],
  ["removeRasterImages", true],
  ["removeUselessDefs", true],
  ["cleanupNumericValues", true, P],
  ["cleanupListOfValues", true, P],
  ["convertColors", true],
  ["removeUnknownsAndDefaults", true],
  ["removeNonInheritableGroupAttrs", true],
  ["removeUselessStrokeAndFill", true],
  ["removeViewBox", false],
  ["cleanupEnableBackground", true],
  ["removeHiddenElems", true],
  ["removeEmptyText", true],
  ["convertShapeToPath", true, P],
  ["moveElemsAttrsToGroup", true],
  ["moveGroupAttrsToElems", true],
  ["collapseGroups", true],
  ["convertPathData", true, P],
  ["convertEllipseToCircle", true],
  ["convertTransform", true,
    { ...P, transformPrecision: TRANSFORM_PRECISION }],
  ["removeEmptyAttrs", true],
  ["removeEmptyContainers", true],
  ["mergePaths", true, P],
  ["removeUnusedNS", true],
  ["reusePaths", true],
  ["sortAttrs", true],
  ["sortDefsChildren", true],
  ["removeTitle", true],
  ["removeDesc", true],
  ["removeDimensions", true],
  ["removeStyleElement", true],
  ["removeScripts", true],
  ["removeOffCanvasPaths", true],
  ["convertOneStopGradients", true],
  ["removeDeprecatedAttrs", true],
  ["removeXlink", false],
];

// The files that differ from the settings above, each for a reason.
// `off` turns features off for that file; `classes` names the classes
// the strip keeps there. check:svg cleans and checks these files with
// their overrides, like any other, and scripts/svg/clean.test.mjs
// fails on an override nothing needs any longer.
export const OVERRIDES = {
  "public/farm-map_v1.svg": {
    off: {
      cleanupIds: "the ids are the layer names that bind the map to " +
        "places: place_geometry.svg_layer_id rows in the database, or " +
        "a layer id matching a place's name (src/lib/farmMap.js). The " +
        "guard cannot see a name that lives in a database row",
    },
  },
};

const ROOT = import.meta.dirname;

// A file's override, by its path from the repo root.
export const overrideFor = (file = "") =>
  OVERRIDES[relative(ROOT, resolve(ROOT, file)).split(sep).join("/")]
  ?? {};

export const plugins = (override = {}) => [
  ...FEATURES
    .filter(([name, on]) => on && !Object.hasOwn(override.off ?? {}, name))
    .map(([name, , params]) => params ? { name, params } : name),
  // Not in SVGOMG: the class names no stylesheet, script, template or
  // test uses. scripts/svg/strip.mjs says how.
  stripUnusedClasses(Object.keys(override.classes ?? {})),
];

export const configFor = (file) => ({
  multipass: MULTIPASS,
  floatPrecision: FLOAT_PRECISION,
  js2svg: { pretty: PRETTIFY, indent: 2, eol: "lf", finalNewline: true },
  plugins: plugins(overrideFor(file)),
});

export default configFor();
