// Criteria test for nff-dashboard#99's third box, word for word: "The
// pre-commit hook cannot hand its git environment to the test suite
// (test)". Written by the test agent ahead of the hook change, which is
// the implementer's.
//
// It runs the real .githooks/pre-commit with the variables git sets for
// a hook (pointed at paths that do not exist) and a fake `npm` first on
// PATH, which records the environment the hook hands it and succeeds.
// No git command runs, so there is nothing a leak could reach.

import { spawnSync } from "node:child_process";
import {
  chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const preCommit = join(repoRoot, ".githooks", "pre-commit");

// What git exports to a pre-commit hook in a worktree, pointed nowhere.
const HOOK_ENVIRONMENT = {
  GIT_DIR: "/nonexistent/nff-decoy/.git/worktrees/lane",
  GIT_INDEX_FILE: "/nonexistent/nff-decoy/.git/worktrees/lane/index",
  GIT_WORK_TREE: "/nonexistent/nff-decoy",
  GIT_PREFIX: "",
  GIT_EDITOR: ":",
};

function fakeNpmIn(dir, recordFile) {
  const npm = join(dir, "npm");
  writeFileSync(npm, `#!/bin/sh\nenv > '${recordFile}'\nexit 0\n`);
  chmodSync(npm, 0o755);
}

function variablesIn(recordFile) {
  return readFileSync(recordFile, "utf8").split("\n")
    .map((line) => line.split("=")[0])
    .filter(Boolean);
}

describe("the pre-commit hook's environment (#99)", () => {
  const folders = [];
  afterEach(() => folders.splice(0).forEach((dir) =>
    rmSync(dir, { recursive: true, force: true })));

  it("#99 box 3: the pre-commit hook cannot hand its git environment " +
    "to the test suite", () => {
    const bin = mkdtempSync(join(tmpdir(), "nff-hook-env-"));
    folders.push(bin);
    const recordFile = join(bin, "npm-saw.env");
    fakeNpmIn(bin, recordFile);

    const hook = spawnSync("sh", [preCommit], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...HOOK_ENVIRONMENT,
        PATH: `${bin}${delimiter}${process.env.PATH}`,
      },
      stdio: "pipe",
      timeout: 30_000,
    });
    expect(hook.status, `the hook should pass when npm does; it said: ` +
      `${hook.stdout}${hook.stderr}`).toBe(0);

    const handedToTheSuite = variablesIn(recordFile)
      .filter((name) => name.startsWith("GIT_"));
    expect(handedToTheSuite, "GIT_* variables the hook handed to " +
      "`npm run check`").toEqual([]);
  });
});
