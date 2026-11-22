// A throwaway copy of the dashboard's migration setup, for driving the
// migration discipline check (#63, D4) the way it runs for real: in a
// clone whose origin/main holds the applied migrations. The clone gets
// this repo's scripts/ and .githooks/ as committed files, and a link to
// its node_modules, so the check and the hooks run as they would here.
// Every git command, the check and the hooks run through
// ./sandboxGit.js, which keeps them off the real repository (#99).

import {
  cpSync, mkdirSync, renameSync, symlinkSync, unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { makeSandboxRoot } from "./sandboxGit.js";

export const repoRoot = join(import.meta.dirname, "..", "..");
export const MIGRATIONS = join("supabase", "migrations");

// What main holds, so what production has applied.
export const APPLIED = {
  "0001_first_table.sql": "create table first_table (id uuid);\n",
  "0002_second_table.sql": "create table second_table (id uuid);\n",
};

export function makeSandbox() {
  const box = makeSandboxRoot("nff-migrations-");
  const origin = join(box.root, "origin.git");
  box.git(box.root, "init", "--quiet", "--bare", "--initial-branch=main",
    origin);
  const clone = join(box.root, "clone");
  box.git(box.root, "clone", "--quiet", origin, clone);
  box.announce(clone);
  seedMain(box, clone);
  box.git(clone, "checkout", "--quiet", "-b", "lane/change");
  return { ...box, origin, clone };
}

function seedMain(box, clone) {
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
  box.git(clone, "add", "--all");
  box.git(clone, "commit", "--quiet", "-m", "applied migrations");
  box.assertContained(clone);
  box.git(clone, "push", "--quiet", "origin", "HEAD:main");
}

// Each change is committed on the clone's branch, as a pull request's
// commits would be.
export function commitChange(sandbox, message, change) {
  change(join(sandbox.clone, MIGRATIONS));
  sandbox.git(sandbox.clone, "add", "--all");
  sandbox.git(sandbox.clone, "commit", "--quiet", "-m", message);
}

export const edits = {
  writeMigration: (name, sql) => (dir) => writeFileSync(join(dir, name), sql),
  deleteMigration: (name) => (dir) => unlinkSync(join(dir, name)),
  renameMigration: (from, to) => (dir) =>
    renameSync(join(dir, from), join(dir, to)),
};

// The check as CI and the hook run it: from the clone's root.
export function runCheck(sandbox) {
  sandbox.assertContained(sandbox.clone);
  return sandbox.spawn("node", ["scripts/check-migrations.mjs"],
    sandbox.clone, 30_000);
}

// A push through the clone's own hooks, installed the way `npm install`
// installs them here (core.hooksPath .githooks).
export function pushBranch(sandbox) {
  sandbox.git(sandbox.clone, "config", "core.hooksPath", ".githooks");
  sandbox.assertContained(sandbox.clone);
  return sandbox.spawn("git",
    ["push", "--quiet", "origin", "HEAD:refs/heads/lane/change"],
    sandbox.clone);
}

export function originHas(sandbox, branch) {
  const lookup = sandbox.spawn("git",
    ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`],
    sandbox.origin);
  return lookup.exitCode === 0;
}
