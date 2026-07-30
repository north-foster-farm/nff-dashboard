// Repo-path citations in the code-adjacent layer must resolve (H3
// enforcement, F2 findings 9-23). H1's promotion moved a lot of
// material; sixteen tracked files were left citing paths that no
// longer existed, including a documented runnable command.
//
// Scope is deliberately `src/` + `public/style-guide/`: the layer an
// agent reads while editing code, where a dead path misleads directly.
// `docs/history/`, `audits/` and the workshop examples are frozen
// narrative — they legitimately name deleted files ("StyleGuide.jsx
// was removed in 42.5"), so a resolver over them can only produce
// noise or a giant allow-list. Drift there is handled editorially.
// `supabase/migrations/` is record-only by policy and never edited.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const CODE_ADJACENT_TREES = ["src", "public/style-guide"];
const PROSE_FILE = /\.(md|js|jsx|html|mjs)$/;

// Files allowed to NAME the gitignored scratch root: this test (which
// is about it) and the style-guide README, which points at the QA
// screenshot drivers kept out of the deploy on purpose.
const scratchConfigFiles = [
  "src/lib/pathCitations.test.js",
  "public/style-guide/README.md",
];

// A citation is a backticked repo-relative path with a directory part
// and a known extension. Bare filenames (`findings.md`) are ambient
// prose; URLs and absolute paths start with characters the leading
// class rejects.
const CITATION = /`([a-z.][\w./-]*\/[\w./-]+\.(?:md|js|jsx|sql|html|mjs))`/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (PROSE_FILE.test(name)) out.push(path);
  }
  return out;
}

const proseFiles = CODE_ADJACENT_TREES.flatMap((tree) => walk(tree));

describe("code-adjacent path citations", () => {
  it("never cites gitignored .ignored/ scratch", () => {
    const offenders = proseFiles
      .filter((file) => !scratchConfigFiles.includes(file))
      .filter((file) => readFileSync(file, "utf8").includes(".ignored/"));
    expect(offenders, "code-adjacent files may not cite gitignored" +
      " .ignored/ paths — promote the target or drop the citation")
      .toEqual([]);
  });

  it("resolves every backticked repo-path citation", () => {
    const dead = [];
    for (const file of proseFiles) {
      const text = readFileSync(file, "utf8");
      for (const [, cited] of text.matchAll(CITATION)) {
        const resolves = existsSync(resolve(cited)) ||
          existsSync(resolve(dirname(file), cited));
        if (!resolves) dead.push(`${file} -> ${cited}`);
      }
    }
    expect(dead, "citations that resolve neither from the repo root" +
      " nor from the citing file").toEqual([]);
  });
});
