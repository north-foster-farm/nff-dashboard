// A throwaway origin with the three stages, for driving bin/promote the
// way it runs for real: from a clone, against a remote called origin.
// Every git command, and bin/promote itself, runs through
// ./sandboxGit.js, which keeps them off the real repository (#99).

import { cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { makeSandboxRoot } from "./sandboxGit.js";

export const STAGES = ["next", "staging", "main"];

const repoBin = join(import.meta.dirname, "..", "..", "bin");

// origin.git holds next, staging and main, all at one first commit.
// `farm` is the clone bin/promote runs in; `elsewhere` is a second
// clone, standing in for anyone else who pushes to origin.
export function makeSandbox() {
  const box = makeSandboxRoot("nff-branch-flow-");
  const origin = join(box.root, "origin.git");
  box.git(box.root, "init", "--quiet", "--bare", "--initial-branch=main",
    origin);
  const farm = cloneOf(box, origin, "farm");
  box.announce(farm);
  copyBinInto(box, farm);
  commitIn(box, farm, "first");
  for (const stage of STAGES) pushTo(box, farm, stage);
  const elsewhere = cloneOf(box, origin, "elsewhere");
  return { ...box, origin, farm, elsewhere };
}

function cloneOf(box, origin, name) {
  const dir = join(box.root, name);
  box.git(box.root, "clone", "--quiet", origin, dir);
  return dir;
}

// The sandbox runs its own copy of bin/, committed as the real one is,
// never the real file: a script that moves to its own folder would
// otherwise run git in the real worktree (#99).
function copyBinInto(box, farm) {
  if (!existsSync(repoBin)) return;
  cpSync(repoBin, join(farm, "bin"), { recursive: true });
  box.git(farm, "add", "bin");
}

function commitIn(box, clone, label) {
  writeFileSync(join(clone, `${label}.txt`), `${label}\n`);
  box.git(clone, "add", `${label}.txt`);
  box.git(clone, "commit", "--quiet", "-m", label);
  return box.git(clone, "rev-parse", "HEAD");
}

function pushTo(box, clone, stage) {
  box.assertContained(clone);
  box.git(clone, "push", "--quiet", "origin", `HEAD:${stage}`);
}

// Add a commit on top of what origin's `stage` holds now, push it there
// from `clone`, and return its SHA.
export function pushNewCommit(sandbox, clone, stage, label) {
  sandbox.git(clone, "fetch", "--quiet", "origin");
  sandbox.git(clone, "checkout", "--quiet", "--detach", `origin/${stage}`);
  const sha = commitIn(sandbox, clone, label);
  pushTo(sandbox, clone, stage);
  return sha;
}

export function headOf(sandbox, stage) {
  return sandbox.git(sandbox.origin, "rev-parse", `refs/heads/${stage}`);
}

// bin/promote as it runs for real: the farm clone's own copy, run from
// the farm clone with the sandbox's env, so any git it starts is held
// to the same rules.
export function runPromote(sandbox, stage) {
  sandbox.assertContained(sandbox.farm);
  return sandbox.spawn(join(sandbox.farm, "bin", "promote"), [stage],
    sandbox.farm, 30_000);
}
