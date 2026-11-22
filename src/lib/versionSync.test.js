// The app version lives in two files that must stay in lockstep —
// package.json `.version` and src/data/nff-data.json `.meta.version`
// (the string TopBar renders). They have drifted before: TopBar sat
// at v0.10.1-alpha while package.json had run ahead to v0.10.9-alpha.
//
// scripts/check-version-sync.sh guards both commit paths. It began as
// a Claude Code PreToolUse hook, which meant a commit typed by a
// human in a terminal sailed straight past it (Roadmap 0.4). It now
// has a second entry path, `--check`, that the git pre-commit hook
// calls — one comparison behind two doors, so the two callers cannot
// drift apart.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync,
  readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GUARD_SCRIPT = "scripts/check-version-sync.sh";
const PRE_COMMIT_HOOK = ".githooks/pre-commit";
const BLOCKED = 2;
const ALLOWED = 0;

// The guard resolves the repo root from its own location, so a copy
// of it inside a throwaway tree guards that tree's version files.
// That lets the drift case be tested for real, without ever putting
// this repo's own two files out of sync.
function fixtureRepo({ packageVersion, dashboardVersion }) {
  const root = mkdtempSync(join(tmpdir(), "version-sync-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "src", "data"), { recursive: true });
  copyFileSync(GUARD_SCRIPT, join(root, GUARD_SCRIPT));
  writeFileSync(join(root, "package.json"),
    JSON.stringify({ version: packageVersion }));
  writeFileSync(join(root, "src/data/nff-data.json"),
    JSON.stringify({ meta: { version: dashboardVersion } }));
  return root;
}

const runGuard = (root, args, stdin = "") =>
  spawnSync("bash", [join(root, GUARD_SCRIPT), ...args],
    { input: stdin, encoding: "utf8" });

const IN_SYNC = { packageVersion: "0.11.0-alpha",
  dashboardVersion: "0.11.0-alpha" };
const DRIFTED = { packageVersion: "0.11.0-alpha",
  dashboardVersion: "0.10.1-alpha" };

describe("the version-sync guard on a human git commit", () => {
  it("blocks the commit when the two versions disagree", () => {
    const drifted = runGuard(fixtureRepo(DRIFTED), ["--check"]);

    expect(drifted.status,
      "a drifted tree must fail the pre-commit hook").toBe(BLOCKED);
    expect(drifted.stderr,
      "the failure has to name both versions to be actionable")
      .toContain("0.10.1-alpha");
  });

  it("lets the commit through when they agree", () => {
    const inSync = runGuard(fixtureRepo(IN_SYNC), ["--check"]);

    expect(inSync.status, inSync.stderr).toBe(ALLOWED);
  });

  it("is wired into the pre-commit hook", () => {
    const hook = readFileSync(PRE_COMMIT_HOOK, "utf8");

    expect(hook,
      `${PRE_COMMIT_HOOK} must call the guard, or a human commit`
      + " never reaches it").toContain("check-version-sync.sh");
  });
});

describe("the version-sync guard on a Claude Code tool call", () => {
  const payloadFor = (command) =>
    JSON.stringify({ tool_input: { command } });

  it("still blocks a drifted `git commit` from the model", () => {
    const drifted = runGuard(fixtureRepo(DRIFTED), [],
      payloadFor("git commit -m 'feat: something'"));

    expect(drifted.status).toBe(BLOCKED);
  });

  it("lets every non-commit Bash command past untouched", () => {
    const drifted = runGuard(fixtureRepo(DRIFTED), [],
      payloadFor("npm run check"));

    expect(drifted.status,
      "the guard polices commits only — a drifted tree must not"
      + " block unrelated commands").toBe(ALLOWED);
  });
});
