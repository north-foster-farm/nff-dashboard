// A throwaway copy of the dashboard's migration setup, for driving the
// migration discipline check (#63, D4) the way it runs for real: in a
// clone whose origin/main holds the applied migrations. The clone gets
// this repo's scripts/ and .githooks/ as committed files, and a link to
// its node_modules, so the check and the hooks run as they would here.
// Everything lives in a temporary folder and talks to no service. Git
// runs without the machine's global or system config.

import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const repoRoot = join(import.meta.dirname, "..", "..");
export const MIGRATIONS = join("supabase", "migrations");

// What main holds, so what production has applied.
export const APPLIED = {
  "0001_first_table.sql": "create table first_table (id uuid);\n",
  "0002_second_table.sql": "create table second_table (id uuid);\n",
};

export const hermeticEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Criteria Test",
  GIT_AUTHOR_EMAIL: "criteria@example.invalid",
  GIT_COMMITTER_NAME: "Criteria Test",
  GIT_COMMITTER_EMAIL: "criteria@example.invalid",
};

export function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env: hermeticEnv, stdio: "pipe" })
    .toString()
    .trim();
}

export function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), "nff-migrations-"));
  const origin = join(root, "origin.git");
  git(root, "init", "--bare", "--initial-branch=main", origin);
  const clone = join(root, "clone");
  git(root, "clone", "--quiet", origin, clone);
  seedMain(clone);
  git(clone, "checkout", "--quiet", "-b", "lane/change");
  return {
    root,
    origin,
    clone,
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

function seedMain(clone) {
  cpSync(join(repoRoot, "scripts"), join(clone, "scripts"),
    { recursive: true });
  cpSync(join(repoRoot, ".githooks"), join(clone, ".githooks"),
    { recursive: true });
  symlinkSync(join(repoRoot, "node_modules"), join(clone, "node_modules"));
  writeFileSync(join(clone, ".gitignore"), "node_modules\n");
  mkdirSync(join(clone, MIGRATIONS), { recursive: true });
  for (const [name, sql] of Object.entries(APPLIED)) {
    writeFileSync(join(clone, MIGRATIONS, name), sql);
  }
  git(clone, "add", "--all");
  git(clone, "commit", "--quiet", "-m", "applied migrations");
  git(clone, "push", "--quiet", "origin", "HEAD:main");
}

// Each change is committed on the clone's branch, as a pull request's
// commits would be.
export function commitChange(clone, message, change) {
  change(join(clone, MIGRATIONS));
  git(clone, "add", "--all");
  git(clone, "commit", "--quiet", "-m", message);
}

export const edits = {
  writeMigration: (name, sql) => (dir) => writeFileSync(join(dir, name), sql),
  deleteMigration: (name) => (dir) => unlinkSync(join(dir, name)),
  renameMigration: (from, to) => (dir) =>
    execFileSync("git", ["mv", join(dir, from), join(dir, to)],
      { cwd: dir, env: hermeticEnv }),
};

// The check as CI and the hook run it: from the clone's root.
export function runCheck(clone) {
  const result = spawnSync("node", ["scripts/check-migrations.mjs"], {
    cwd: clone,
    env: hermeticEnv,
    stdio: "pipe",
    timeout: 30_000,
  });
  const output = `${result.stdout}${result.stderr}`;
  return { exitCode: result.status, output };
}

// A push through the clone's own hooks, installed the way `npm install`
// installs them here (core.hooksPath .githooks).
export function pushBranch(clone) {
  git(clone, "config", "core.hooksPath", ".githooks");
  const result = spawnSync(
    "git", ["push", "--quiet", "origin", "HEAD:refs/heads/lane/change"],
    { cwd: clone, env: hermeticEnv, stdio: "pipe", timeout: 60_000 });
  const output = `${result.stdout}${result.stderr}`;
  return { exitCode: result.status, output };
}

export function originHas(sandbox, branch) {
  const result = spawnSync("git",
    ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
    { cwd: sandbox.origin, env: hermeticEnv, stdio: "pipe" });
  return result.status === 0;
}
