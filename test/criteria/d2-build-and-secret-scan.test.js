// Criteria tests for nff-dashboard#61 (D2, build and secret scan in
// CI), one per criterion, each named for its criterion word for word.
//
// Written by the test agent from the criteria alone, before the
// implementation. Held out of `npm test` (its include is src/**) until
// the implementation lands; run them with `npm run test:criteria`.
//
// Criterion 1 reads check.yml and package.json: a pull request runs the
// check workflow, the workflow runs the build, and nothing lets a step
// fail quietly. The criterion also names a throwaway branch; that run
// is evidence on GitHub, made once the implementation exists, and this
// test is what holds the workflow to it afterwards.
//
// Criterion 2 runs the scan, `node scripts/check-dist-secrets.mjs`
// from the repository root over `dist/`, in a temporary copy of
// scripts/ and .env.example with a made-up dist/. No git runs, and the
// scan gets no GIT_* variable.

import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  allowsFailure, runCommands, triggerEvents,
} from "./workflowSteps.js";

const repoRoot = join(import.meta.dirname, "..", "..");
const checkWorkflow = join(repoRoot, ".github", "workflows", "check.yml");
const SCAN = join("scripts", "check-dist-secrets.mjs");

const BUILDS_THE_APP = /(^|[\s;&|])(npm run build|(npx )?vite build)\b/;
const NPM_SCRIPT = /\bnpm run ([\w:.-]+)/g;

// The sample's own split: these never reach a bundle (.env.example says
// so for both), and PUSH_CALLER_SECRET is the caller secret #57 plans,
// not yet in the sample, so the scan must go by name, not by a list.
const SECRET_NAMED = [
  "SUPABASE_SECRET_KEY", "VAPID_PRIVATE_KEY", "PUSH_CALLER_SECRET",
];
// What a bundle may name: the sample's public, VITE_-prefixed keys.
const PUBLIC_NAMES = [
  "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_VAPID_PUBLIC_KEY",
];

// A command builds the app when it runs the build itself, or an npm
// script that does, followed a few scripts deep.
function buildsTheApp(command, scripts, depth = 3) {
  if (BUILDS_THE_APP.test(command)) return true;
  if (depth === 0) return false;
  return [...command.matchAll(NPM_SCRIPT)].some(([, name]) =>
    scripts[name] !== undefined &&
    buildsTheApp(scripts[name], scripts, depth - 1));
}

const withoutGitVariables = (env) => Object.fromEntries(
  Object.entries(env).filter(([name]) => !name.startsWith("GIT_")));

function makeBuildFolder(folders) {
  const root = mkdtempSync(join(tmpdir(), "nff-dist-scan-"));
  folders.push(root);
  cpSync(join(repoRoot, "scripts"), join(root, "scripts"),
    { recursive: true });
  cpSync(join(repoRoot, ".env.example"), join(root, ".env.example"));
  mkdirSync(join(root, "dist", "assets"), { recursive: true });
  writeFileSync(join(root, "dist", "index.html"),
    "<!doctype html><script src=\"/assets/index-a1b2c3.js\"></script>\n");
  return root;
}

function bundleNaming(root, names) {
  const code = names.map((name, i) => `const k${i}="${name}";`).join("");
  writeFileSync(join(root, "dist", "assets", "index-a1b2c3.js"),
    `${code}export{};\n`);
}

function runScan(root) {
  const scan = spawnSync("node", [SCAN], {
    cwd: root,
    env: withoutGitVariables(process.env),
    stdio: "pipe",
    timeout: 30_000,
  });
  return { exitCode: scan.status, output: `${scan.stdout}${scan.stderr}` };
}

describe("D2 build and secret scan in CI (#61)", () => {
  const folders = [];
  afterEach(() => folders.splice(0).forEach((dir) =>
    rmSync(dir, { recursive: true, force: true })));

  it("criterion 1: a PR that breaks vite build fails check", () => {
    const workflow = readFileSync(checkWorkflow, "utf8");
    const { scripts } = JSON.parse(
      readFileSync(join(repoRoot, "package.json"), "utf8"));

    expect(scripts.build, "the build script is vite's")
      .toMatch(/\bvite build\b/);
    expect(triggerEvents(workflow), "a pull request starts check.yml")
      .toContain("pull_request");
    const buildSteps = runCommands(workflow)
      .filter((command) => buildsTheApp(command, scripts));
    expect(buildSteps, "a check.yml step that runs `vite build` " +
      "(directly or through an npm script)").not.toEqual([]);
    expect(allowsFailure(workflow),
      "no step or job in check.yml may continue on error").toBe(false);
  });

  it("criterion 2: the scan fails when a secret-named variable " +
    "appears in dist/", () => {
    expect(existsSync(join(repoRoot, SCAN)), `${SCAN} exists`).toBe(true);

    const clean = makeBuildFolder(folders);
    bundleNaming(clean, PUBLIC_NAMES);
    const cleanScan = runScan(clean);
    expect(cleanScan.exitCode, "the scan should pass a dist/ that names " +
      `only public keys; it said: ${cleanScan.output}`).toBe(0);

    for (const secretName of SECRET_NAMED) {
      const leaky = makeBuildFolder(folders);
      bundleNaming(leaky, [...PUBLIC_NAMES, secretName]);
      const scan = runScan(leaky);
      expect(scan.exitCode, `the scan should fail a dist/ that names ` +
        `${secretName}; it said: ${scan.output}`).not.toBe(0);
    }
  });
});
