#!/usr/bin/env node
// Fails `npm run check` when a secret has no line in
// docs/rotation-log.md (E2, #68). The yearly rotation works from the
// log, so a secret missing from it would silently never rotate.
//
// The secrets are every name in .env.example ending in SECRET, TOKEN,
// PASSWORD or _KEY, and every row of docs/secrets.md's table whose
// Kind starts with "secret" or holds "URL". A row marked "old" or
// "optional" is left out. A `planned` line in the log counts.
//
//   node scripts/check-rotation-log.mjs

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SECRETISH = /(?:SECRET|TOKEN|PASSWORD|_KEY)$/;
const SECRET_KIND = /^secret|URL/;
const LEFT_OUT = /\b(?:old|optional)\b/;

// The names a sample file declares, with or without a value.
export const sampleNames = (text) =>
  String(text)
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line))
    .filter(Boolean)
    .map((m) => m[1]);

// The rows of the secrets page's table: { names, kind }. Each cell's
// backticked text is a name.
const secretRows = (text) => {
  const rows = [];
  let inTable = false;
  for (const line of String(text).split("\n")) {
    if (/^\|\s*Name\s*\|\s*Kind\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith("|")) break;
    if (/^\|\s*-/.test(line)) continue;
    const [first, kind = ""] = line
      .split("|")
      .slice(1)
      .map((c) => c.trim());
    const names = [...first.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    rows.push({ names, kind });
  }
  return rows;
};

// Every name the log must carry, sorted.
export const requiredNames = (secretsText, sampleText) => {
  const names = new Set(
    sampleNames(sampleText).filter((n) => SECRETISH.test(n)),
  );
  for (const { names: rowNames, kind } of secretRows(secretsText)) {
    if (!SECRET_KIND.test(kind) || LEFT_OUT.test(kind)) continue;
    for (const name of rowNames) names.add(name);
  }
  return [...names].sort();
};

// The names the log has a line for, lowercased, dated or planned.
export const loggedNames = (logText) =>
  String(logText)
    .split("\n")
    .map((line) => line.split("|").map((f) => f.trim()))
    .filter((f) => f.length >= 5 && !/^(name|-+)$/i.test(f[0]))
    .map((f) => f[0].toLowerCase());

// -> the required names with no line in the log.
export const missingFromLog = (required, logText) => {
  const logged = new Set(loggedNames(logText));
  return required.filter((name) => !logged.has(name.toLowerCase()));
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const read = (path) => readFileSync(path, "utf8");
  const required = requiredNames(
    read("docs/secrets.md"),
    read(".env.example"),
  );
  const missing = missingFromLog(required, read("docs/rotation-log.md"));
  if (missing.length) {
    console.error(
      `Rotation log: ${missing.length} secret(s) have no line in ` +
        "docs/rotation-log.md, so the yearly rotation would skip them:",
    );
    for (const name of missing) console.error(`  ${name}`);
    console.error("Add a dated line, or a `planned` line if not set up yet.");
    process.exit(1);
  }
  console.log(`Rotation log: all ${required.length} secrets have a line.`);
}
