// src/lib is the pure-logic layer — the code the unit suite can
// exercise without a browser or a network (H5 enforcement, audit
// item 14). Impurity is quarantined in two sanctioned zones:
//   lib/data/    — supabase client, outbox, capture I/O, use* hooks
//   lib/browser/ — React + browser-API modules (router, weather)
// Everything else under src/lib must stay pure: no React, no
// supabase, and no reaching into the sanctioned zones (a pure module
// that imports the impure layer is impure by transitivity).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const LIB_ROOT = "src/lib";
const SANCTIONED_ZONES = ["data", "browser"];

// Import specifiers, both forms: `import x from "spec"` and the
// side-effect `import "spec"`.
const IMPORT_SPEC = /import[^"']*["']([^"']+)["']/g;

const IMPURE_PACKAGES = ["react", "@supabase/supabase-js"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".js")) out.push(path);
  }
  return out;
}

const zoneOf = (file) => {
  const rel = relative(resolve(LIB_ROOT), resolve(file));
  if (rel.startsWith("..")) return null;
  const [first] = rel.split(sep);
  return SANCTIONED_ZONES.includes(first) ? first : null;
};

// The suite itself is node-side and free to import anything; the
// purity rule governs shipped modules only.
const pureLibFiles = walk(LIB_ROOT)
  .filter((file) => !file.endsWith(".test.js"))
  .filter((file) => zoneOf(file) === null);

function importsOf(file) {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(IMPORT_SPEC)].map(([, spec]) => spec);
}

describe("lib purity boundary", () => {
  it("keeps React and supabase out of the pure lib layer", () => {
    const offenders = pureLibFiles.flatMap((file) =>
      importsOf(file)
        .filter((spec) => IMPURE_PACKAGES.includes(spec))
        .map((spec) => `${file} imports ${spec}`),
    );
    expect(offenders, "pure src/lib modules importing an impure" +
      " package — move the module into lib/data/ or lib/browser/")
      .toEqual([]);
  });

  it("never reaches into the sanctioned impure zones", () => {
    const offenders = pureLibFiles.flatMap((file) =>
      importsOf(file)
        .filter((spec) => spec.startsWith("."))
        .filter((spec) =>
          zoneOf(resolve(dirname(file), spec)) !== null)
        .map((spec) => `${file} imports ${spec}`),
    );
    expect(offenders, "pure src/lib modules importing from lib/data" +
      " or lib/browser — purity is transitive; invert the dependency" +
      " or move the module").toEqual([]);
  });
});
