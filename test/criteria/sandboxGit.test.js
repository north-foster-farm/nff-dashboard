// The decoy self-test for ./sandboxGit.js, for nff-dashboard#99's
// second box: "Every test sandbox that shells out to git drops all
// GIT_* variables, uses empty global and system config, and refuses to
// push unless the remote is a temporary path (test)".
//
// It recreates the incident on purpose, against a decoy: GIT_DIR,
// GIT_WORK_TREE and GIT_INDEX_FILE point at a throwaway repository with
// its own throwaway origin, as a hook would point them at the real one,
// and both sandboxes then run their full setup and a push. The decoy
// must come out byte for byte as it went in.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import * as branchFlow from "./gitSandbox.js";
import * as migrations from "./migrationSandbox.js";
import { makeSandboxRoot, strayGitVariables } from "./sandboxGit.js";

const HOOK_VARIABLES = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"];
// Every GIT_* variable a sandbox env may hold: the ones sandboxGit.js
// sets itself. Anything else came from the process around it.
const SET_BY_THE_SANDBOX = new RegExp("^GIT_(CONFIG_NOSYSTEM|CONFIG_GLOBAL|" +
  "TERMINAL_PROMPT|CEILING_DIRECTORIES|(AUTHOR|COMMITTER)_(NAME|EMAIL)|" +
  "CONFIG_COUNT|CONFIG_(KEY|VALUE)_[0-9]+)$");
const UNREACHABLE_REMOTES = [
  "https://example.invalid/nff-dashboard.git",
  "ssh://git@example.invalid/nff-dashboard.git",
];

function makeDecoy() {
  const box = makeSandboxRoot("nff-decoy-");
  const origin = join(box.root, "decoy-origin.git");
  const work = join(box.root, "decoy");
  box.git(box.root, "init", "--quiet", "--bare", "--initial-branch=main",
    origin);
  box.git(box.root, "clone", "--quiet", origin, work);
  writeFileSync(join(work, "decoy.txt"), "decoy\n");
  box.git(work, "add", "decoy.txt");
  box.git(work, "commit", "--quiet", "-m", "decoy");
  box.git(work, "push", "--quiet", "origin", "HEAD:main");
  return { ...box, origin, work, gitDir: join(work, ".git") };
}

function snapshot(decoy) {
  const digest = (file) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  return {
    workRefs: decoy.git(decoy.work, "for-each-ref"),
    originRefs: decoy.git(decoy.origin, "for-each-ref"),
    index: digest(join(decoy.gitDir, "index")),
    config: readFileSync(join(decoy.gitDir, "config"), "utf8"),
    status: decoy.git(decoy.work, "--no-optional-locks", "status",
      "--porcelain"),
  };
}

// Point the hook variables at the decoy for the length of `run`, as a
// pre-commit hook would point them at the real repository.
function asIfInsideAHookOn(decoy, run) {
  const saved = Object.fromEntries(
    HOOK_VARIABLES.map((name) => [name, process.env[name]]));
  process.env.GIT_DIR = decoy.gitDir;
  process.env.GIT_WORK_TREE = decoy.work;
  process.env.GIT_INDEX_FILE = join(decoy.gitDir, "index");
  try {
    run();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

describe("criteria sandboxes stay off the real repository (#99)", () => {
  const cleanups = [];
  const keep = (box) => {
    cleanups.push(box);
    return box;
  };
  afterEach(() => cleanups.splice(0).forEach((box) => box.remove()));

  it("#99 box 2: every test sandbox that shells out to git drops all " +
    "GIT_* variables, uses empty global and system config, and refuses " +
    "to push unless the remote is a temporary path", () => {
    const decoy = keep(makeDecoy());
    const before = snapshot(decoy);

    asIfInsideAHookOn(decoy, () => {
      const flow = keep(branchFlow.makeSandbox());
      branchFlow.pushNewCommit(flow, flow.elsewhere, "staging", "decoy-run");
      const migration = keep(migrations.makeSandbox());
      migrations.commitChange(migration, "add a migration",
        migrations.edits.writeMigration("0003_decoy.sql", "select 1;\n"));
      migrations.pushBranch(migration);
      for (const box of [flow, migration]) {
        const unexpected = strayGitVariables(box.env)
          .filter((name) => !SET_BY_THE_SANDBOX.test(name));
        expect(unexpected, "GIT_* variables the sandbox did not set " +
          "itself, inherited from the hook").toEqual([]);
        expect(box.env.GIT_CONFIG_GLOBAL, "global config").toBe("/dev/null");
        expect(box.env.GIT_CONFIG_NOSYSTEM, "system config").toBe("1");
      }
    });

    expect(snapshot(decoy), "the decoy repository and its origin are " +
      "exactly as they were").toEqual(before);

    const box = keep(branchFlow.makeSandbox());
    for (const url of UNREACHABLE_REMOTES) {
      box.git(box.farm, "remote", "set-url", "origin", url);
      expect(() => box.assertContained(box.farm),
        `the containment check refuses an origin of ${url}`).toThrow();
      const push = box.spawn("git", ["push", "origin", "HEAD:main"],
        box.farm, 30_000);
      expect(push.exitCode, `git itself refuses a push to ${url}`)
        .not.toBe(0);
      expect(push.output, `refused by transport policy, not by the ` +
        `network: ${push.output}`).toMatch(/not allowed/);
    }
    box.git(box.farm, "remote", "set-url", "origin", decoy.origin);
    expect(() => box.assertContained(box.farm),
      "the containment check refuses an origin in another temp folder")
      .toThrow(/outside its root/);
  }, 120_000);

  it("refuses to load inside a git process", () => {
    const loader = spawnSync(process.execPath,
      ["--input-type=module", "-e", "await import('./sandboxGit.js')"],
      {
        cwd: import.meta.dirname,
        env: { ...process.env, GIT_DIR: "/nonexistent/decoy/.git" },
        stdio: "pipe",
      });
    expect(loader.status, "sandboxGit.js should refuse to load with " +
      "GIT_DIR set").not.toBe(0);
    expect(`${loader.stderr}`).toMatch(/refuses to run with GIT_DIR/);
  });
});
