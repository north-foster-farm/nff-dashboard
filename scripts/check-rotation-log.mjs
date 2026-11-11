#!/usr/bin/env node
// Fails `npm run check` when a secret has no line in
// docs/rotation-log.md (E2, #68). The yearly rotation works from the
// log, so a secret missing from it would silently never rotate.
//
// The secrets are every name ending in SECRET, TOKEN, PASSWORD or _KEY
// in .env.example or in the code under netlify/, scripts/, mcp/ and
// src/ (tests excluded), and every row of docs/secrets.md's table
// whose Kind starts with "secret" or holds "URL" (any case). A row
// marked "old" or "optional" is left out. A `planned` line in the
// log counts. A secrets page with no table fails the check too, so a
// renamed header cannot drop the table-only secrets in silence.
//
//   node scripts/check-rotation-log.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SECRETISH = /(?:SECRET|TOKEN|PASSWORD|_KEY)$/;
const SECRET_KIND = /^secret|url/i;
const LEFT_OUT = /\b(?:old|optional)\b/i;
const CODE_DIRS = ["netlify", "scripts", "mcp", "src"];
const CODE_FILE = /\.(?:m?js|jsx|sh)$/;
const TEST_FILE = /\.test\.[mc]?jsx?$/;
const ENV_NAME =
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:SECRET|KEY|TOKEN|PASSWORD)\b/g;

// The names a sample file declares, with or without a value.
export const sampleNames = (text) =>
  String(text)
    .split("\n")
    .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line))
    .filter(Boolean)
    .map((m) => m[1]);

// The secret-looking names in one source file's text.
export const envNamesIn = (text, onlyFromEnv = false) => {
  const names = [...String(text).matchAll(ENV_NAME)];
  return names
    .filter((m) => !onlyFromEnv || /env\.$/.test(text.slice(0, m.index)))
    .map((m) => m[0]);
};

// The rows of the secrets page's table: { names, kind }. Each cell's
// backticked text is a name.
const secretRows = (text) => {
  const rows = [];
  let inTable = false;
  for (const line of String(text).split("\n")) {
    if (/^\|\s*Name\s*\|\s*Kind\s*\|/i.test(line)) {
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

// Whether the page has a secrets table with any rows.
export const hasSecretsTable = (text) => secretRows(text).length > 0;

// Every name the log must carry, sorted. `codeNames` are the names
// found in source code.
export const requiredNames = (secretsText, sampleText, codeNames = []) => {
  const names = new Set([
    ...sampleNames(sampleText).filter((n) => SECRETISH.test(n)),
    ...codeNames,
  ]);
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

// The secret-looking names in the tracked code, tests excluded.
export const namesInTrackedCode = (read) => {
  const files = execFileSync("git", ["ls-files", "-z", ...CODE_DIRS], {
    encoding: "utf8",
  })
    .split("\0")
    .filter((f) => CODE_FILE.test(f) && !TEST_FILE.test(f));
  // The app's own code (src/) also names localStorage keys ending in
  // _KEY, so there only a name read from `env.` counts.
  return files.flatMap((f) =>
    envNamesIn(read(f), f.startsWith("src/")),
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const read = (path) => readFileSync(path, "utf8");
  const page = read("docs/secrets.md");
  if (!hasSecretsTable(page)) {
    console.error(
      "Rotation log: docs/secrets.md has no table headed Name | Kind, " +
        "so its table-only secrets cannot be checked.",
    );
    process.exit(1);
  }
  const required = requiredNames(
    page,
    read(".env.example"),
    namesInTrackedCode(read),
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
