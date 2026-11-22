// A throwaway origin with the three stages, for driving bin/promote the
// way it runs for real: from a clone, against a remote called origin.
// Everything lives in a temporary folder and talks to no service. Git
// runs without the machine's global or system config, so a signing key
// or hook path on the Mac (or its absence in CI) changes nothing.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const STAGES = ["next", "staging", "main"];

export const hermeticEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Criteria Test",
  GIT_AUTHOR_EMAIL: "criteria@example.invalid",
  GIT_COMMITTER_NAME: "Criteria Test",
  GIT_COMMITTER_EMAIL: "criteria@example.invalid",
};

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env: hermeticEnv, stdio: "pipe" })
    .toString()
    .trim();
}

// origin.git holds next, staging and main, all at one first commit.
// `farm` is the clone bin/promote runs in; `elsewhere` is a second
// clone, standing in for anyone else who pushes to origin.
export function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), "nff-branch-flow-"));
  const origin = join(root, "origin.git");
  git(root, "init", "--bare", "--initial-branch=main", origin);
  const farm = cloneOf(root, origin, "farm");
  commitIn(farm, "first");
  for (const stage of STAGES) git(farm, "push", "origin", `HEAD:${stage}`);
  const elsewhere = cloneOf(root, origin, "elsewhere");
  return {
    root,
    origin,
    farm,
    elsewhere,
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

function cloneOf(root, origin, name) {
  const dir = join(root, name);
  git(root, "clone", "--quiet", origin, dir);
  return dir;
}

function commitIn(clone, label) {
  writeFileSync(join(clone, `${label}.txt`), `${label}\n`);
  git(clone, "add", `${label}.txt`);
  git(clone, "commit", "--quiet", "--no-verify", "-m", label);
  return git(clone, "rev-parse", "HEAD");
}

// Add a commit on top of what origin's `stage` holds now, push it there
// from `clone`, and return its SHA.
export function pushNewCommit(clone, stage, label) {
  git(clone, "fetch", "--quiet", "origin");
  git(clone, "checkout", "--quiet", "--detach", `origin/${stage}`);
  const sha = commitIn(clone, label);
  git(clone, "push", "--quiet", "origin", `HEAD:${stage}`);
  return sha;
}

export function headOf(sandbox, stage) {
  return git(sandbox.origin, "rev-parse", `refs/heads/${stage}`);
}
