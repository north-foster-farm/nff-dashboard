#!/usr/bin/env node
// Clean every tracked SVG with SVGO and the settings in
// svgo.config.mjs (north-foster-farm#295), or check that each
// already is.
//
//   node scripts/svg/clean.mjs [files...]           npm run svg:clean
//   node scripts/svg/clean.mjs --check [files...]   npm run check:svg
//
// With no files it takes every tracked .svg outside EXCLUDE. The
// check fails when a file differs from what the clean-up would write;
// `npm run check` runs it, so the pre-commit hook and CI do too.
//
// Before it drops a class or an id, it looks for that name in the
// app's stylesheets, scripts, pages and tests. A name in use stops the
// run and says where: add the class to KEEP in scripts/svg/strip.mjs
// with the reason, or point the reference at something SVGO keeps.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { optimize } from "svgo";

import config from "../../svgo.config.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

// Not cleaned. The farm map's ids are its layer names: MapPage binds
// each layer to a place by place_geometry.svg_layer_id rows in the
// database, or by the layer id matching a place's name
// (src/lib/farmMap.js). SVGO's cleanupIds would drop them all and turn
// every place into background art, and the guard below cannot see a
// name that lives in a database row.
export const EXCLUDE = ["public/farm-map_v1.svg"];

// Where a class or id the app uses would be named. SVGs and this
// tool's own files are left out, and so is the static style guide:
// it loads none of the app's SVGs, and its token names ("bg") read as
// ids.
const CORPUS = /\.(css|m?jsx?|html|json|webmanifest)$/;
const NOT_CORPUS = [
  /\.svg$/,
  /^public\/style-guide\//,
  /^scripts\/svg\//,
  /^svgo\.config\.mjs$/,
  /^docs\//,
  /^package(-lock)?\.json$/,
];

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter(Boolean);

export const trackedSvgs = () => git("ls-files", "*.svg")
  .filter((file) => !EXCLUDE.includes(file));

export const corpus = () => git("ls-files")
  .filter((file) => CORPUS.test(file))
  .filter((file) => !NOT_CORPUS.some((re) => re.test(file)))
  .map((file) => ({ file, text: readFileSync(join(ROOT, file), "utf8") }));

export const clean = (markup, path) =>
  optimize(markup, { ...config, path }).data;

const names = (markup, attr) => new Set([...markup.matchAll(
  new RegExp(`\\s${attr}="([^"]*)"`, "g"))]
  .flatMap((m) => m[1].split(/\s+/)).filter(Boolean));

const lost = (before, after, attr) => {
  const kept = names(after, attr);

  return [...names(before, attr)].filter((name) => !kept.has(name));
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The ways a stylesheet, script or page names a class or an id: a
// selector (.name, #name, [class~=name]) or the name as a whole
// quoted string (classList, getElementById, className). A dot after a
// word is a property (still.ring), not a selector.
export const namingPattern = (name) => {
  const n = escape(name);

  return new RegExp(
    `(?<![\\w$)\\]])[.#]${n}(?![\\w-])` +
    `|\\[(?:class|id)[~*^$|]?=["']?${n}(?![\\w-])` +
    `|["'\`]${n}["'\`]|class(?:Name)?="(?:[^"]*\\s)?${n}(?:\\s[^"]*)?"`);
};

const namedIn = (name, files) => {
  const re = namingPattern(name);

  return files.filter(({ text }) => re.test(text)).map(({ file }) => file);
};

// The classes and ids the clean-up drops that something still names.
export const guard = (before, after, files) => [
  ...lost(before, after, "class").map((name) => ({ kind: "class", name })),
  ...lost(before, after, "id").map((name) => ({ kind: "id", name })),
].map((hit) => ({ ...hit, files: namedIn(hit.name, files) }))
  .filter((hit) => hit.files.length);

// Each file's verdict: { file, changed, blocked }.
export const run = (files, { check = false } = {}) => {
  const appFiles = corpus();

  return files.map((file) => {
    const before = readFileSync(join(ROOT, file), "utf8");
    const after = clean(before, file);
    const blocked = guard(before, after, appFiles);
    const changed = after !== before;

    if (!check && changed && !blocked.length) {
      writeFileSync(join(ROOT, file), after);
    }

    return { file, changed, blocked };
  });
};

const report = ({ file, changed, blocked }, check) => {
  for (const { kind, name, files: where } of blocked) {
    console.error(`${file}: SVGO would drop the ${kind} "${name}", ` +
      `which ${where.join(", ")} uses. Keep it (scripts/svg/strip.mjs, ` +
      "KEEP) or stop naming it.");
  }
  if (check && changed) {
    console.error(`${file}: not cleaned. Run npm run svg:clean.`);
  } else if (changed && !blocked.length) {
    console.log(`cleaned ${file}`);
  }

  return blocked.length > 0 || (check && changed);
};

const main = (args) => {
  const check = args.includes("--check");
  const given = args.filter((arg) => arg !== "--check")
    .map((file) => relative(ROOT, resolve(file)))
    .filter((file) => !EXCLUDE.includes(file));
  const results = run(given.length ? given : trackedSvgs(), { check });
  const failed = results.map((r) => report(r, check)).some(Boolean);
  const changed = results.filter((r) => r.changed).length;

  console.log(check
    ? `check:svg: ${results.length} SVG(s), ${changed} not cleaned.`
    : `svg:clean: ${results.length} SVG(s), ${changed} changed.`);
  if (failed) process.exit(1);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2));
}
