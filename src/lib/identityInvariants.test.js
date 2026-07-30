// F5 step 6 (H5 enforcement): rows the user can rename — chore
// blocks, places, projects — must be identified in code by their
// primary key, never by display name or slug. The F5 inventory
// (2026-07-30) found three currencies in use for block identity;
// every non-uuid one had already broken silently in production
// (the Overview "Tomorrow" section never rendered in the app's
// life). The remedy landed in 83ec7e0 + 940c4cc; this test keeps
// the pattern from growing back.
//
// Two shapes are banned in shipped src/ code:
//   1. `.name.toLowerCase() ===` — normalizing a display name for
//      comparison is identity-by-name whatever it compares to.
//   2. `.name === "…"` / `.slug === "…"` — a string literal names
//      a specific row the user can rename or recreate.
// Still legitimate, deliberately not matched: `typeof x.name ===
// "string"` guards (filtered), schema enums (`startKind ===
// "sunrise"`), the `"anytime"` sentinel, and slug-vs-VARIABLE
// resolution at URL boundaries (`r.slug === projectKey`).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const NORMALIZED_NAME_COMPARISON = /\.name\??\.toLowerCase\(\)\s*===/;
const ROW_NAMED_BY_LITERAL = /\.(name|slug)\s*===\s*["']/;

const isTypeofGuard = (line) => /typeof\s/.test(line);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.jsx?$/.test(name) && !name.endsWith(".test.js"))
      out.push(path);
  }
  return out;
}

function offendersIn(files, pattern) {
  const offenders = [];
  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (pattern.test(line) && !isTypeofGuard(line))
        offenders.push(`${file}:${i + 1} ${line.trim()}`);
    });
  }
  return offenders;
}

const shippedFiles = walk("src");

describe("identity comparison invariants (F5)", () => {
  // The three sites the F5 inventory found broken, verbatim — the
  // regexes must recognize each, or the sweep below proves nothing.
  const historicalOffenders = [
    'blocks?.find((b) => b.isActive && b.name.toLowerCase() === p)',
    'r.block?.name?.toLowerCase() === "morning"',
    'const morningBlockId = blocks.find(b => b.slug === "morning")?.id;',
  ];

  it("recognizes each historical offender", () => {
    for (const line of historicalOffenders) {
      const caught = NORMALIZED_NAME_COMPARISON.test(line) ||
        ROW_NAMED_BY_LITERAL.test(line);
      expect(caught, `regexes must match: ${line}`).toBe(true);
    }
  });

  it("ignores the sanctioned comparison shapes", () => {
    const sanctioned = [
      'if (typeof patch.name === "string") dbPatch.name = x;',
      'block.startKind === "sunrise"',
      "r.id === projectKey || r.slug === projectKey",
    ];
    for (const line of sanctioned) {
      const caught = (NORMALIZED_NAME_COMPARISON.test(line) ||
        ROW_NAMED_BY_LITERAL.test(line)) && !isTypeofGuard(line);
      expect(caught, `regexes must NOT match: ${line}`).toBe(false);
    }
  });

  it("finds no normalized-name identity comparison in src/", () => {
    expect(offendersIn(shippedFiles, NORMALIZED_NAME_COMPARISON),
      "identity-by-display-name — resolve the row by id instead")
      .toEqual([]);
  });

  it("finds no row named by a name/slug literal in src/", () => {
    expect(offendersIn(shippedFiles, ROW_NAMED_BY_LITERAL),
      "a literal names a user-renameable row — store and compare" +
      " the row id, or derive from schema-level fields")
      .toEqual([]);
  });
});
