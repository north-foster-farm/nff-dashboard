// Criteria tests for nff-dashboard#65 (D6, env checks per
// environment), one per criterion, each named for its criterion word
// for word. This is the half not blocked by F2.1: "until then, a check
// against the one sample".
//
// Written by the test agent from the criteria alone, before the
// implementation. Held out of `npm test` (its include is src/**) until
// the implementation lands; run them with `npm run test:criteria`.
//
// Criterion 1 runs netlify.toml's build command as Netlify would, in a
// temporary copy of the app (no .git, and no .env file but the sample,
// so no real secret is read), with an environment holding only PATH,
// HOME, Netlify's own variables and placeholder values for the sample's
// keys. No git runs.

import { spawnSync } from "node:child_process";
import {
  cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const SAMPLE = join(repoRoot, ".env.example");

// The code that runs on Netlify: the app bundle and the functions.
const CODE_FOLDERS = ["src", "netlify"];
const CODE_FILES = /\.(js|jsx|mjs|cjs|ts|tsx)$/;
// Set by the platform, never by the farm, so never in the sample.
const PLATFORM_VARIABLES = new Set([
  "MODE", "DEV", "PROD", "SSR", "BASE_URL", "NODE_ENV", "TZ",
  "CONTEXT", "NETLIFY", "URL", "DEPLOY_URL", "DEPLOY_PRIME_URL",
  "SITE_ID", "SITE_NAME", "BRANCH", "HEAD", "COMMIT_REF",
]);

const NAMED_READS = [
  /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /process\.env\[\s*["'`]([A-Z_][A-Z0-9_]*)["'`]\s*\]/g,
  /Netlify\.env\.get\(\s*["'`]([A-Z_][A-Z0-9_]*)["'`]\s*\)/g,
];
const DESTRUCTURED_READ =
  /\{([^{}]*)\}\s*=\s*(?:process\.env|import\.meta\.env)\b/g;
// A read whose name the test cannot see; it fails closed on these.
const DYNAMIC_READ =
  /(process\.env|import\.meta\.env)\[\s*(?!["'`][A-Z_][A-Z0-9_]*["'`]\s*\])/;

function sampleKeys() {
  return readFileSync(SAMPLE, "utf8").split("\n")
    .map((line) => /^([A-Z_][A-Z0-9_]*)=/.exec(line.trim()))
    .filter(Boolean)
    .map(([, name]) => name);
}

function codeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(path);
    const isTest = /\.test\.[a-z]+$/.test(entry.name);
    return CODE_FILES.test(extname(path)) && !isTest ? [path] : [];
  });
}

function readsIn(source) {
  const named = NAMED_READS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map(([, name]) => name));
  const destructured = [...source.matchAll(DESTRUCTURED_READ)]
    .flatMap(([, list]) => list.split(","))
    .map((part) => part.trim().split(/[:=\s]/)[0])
    .filter((name) => /^[A-Z_][A-Z0-9_]*$/.test(name));
  return [...named, ...destructured];
}

// A copy of the app as Netlify checks it out: tracked folders only, no
// .git, and of the .env files only the sample.
const LEFT_OUT = new Set([
  ".git", "node_modules", "dist", ".ignored", ".backups", ".netlify",
  "test", "docs", "audits",
]);
function copyOfTheApp(folders) {
  const root = mkdtempSync(join(tmpdir(), "nff-netlify-build-"));
  folders.push(root);
  cpSync(repoRoot, root, {
    recursive: true,
    filter: (source) => {
      const name = basename(source);
      if (source === repoRoot) return true;
      if (LEFT_OUT.has(name)) return false;
      return !name.startsWith(".env") || name === ".env.example";
    },
  });
  symlinkSync(join(repoRoot, "node_modules"), join(root, "node_modules"));
  refuseRealEnvFiles(root);
  return root;
}

// Before any build runs: list every .env file the copy holds, and stop
// unless the sample is the only one, so no real secret can be read.
function envFilesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return envFilesIn(path);
    return entry.name.startsWith(".env") ? [path] : [];
  });
}
function refuseRealEnvFiles(root) {
  const envFiles = envFilesIn(root).map((path) =>
    path.slice(root.length + 1));
  console.log(`build copy ${root}: .env files ${envFiles.join(", ")}`);
  if (envFiles.length !== 1 || envFiles[0] !== ".env.example") {
    throw new Error(`refusing to build: the copy holds ${envFiles} ` +
      "where only .env.example may be");
  }
}

function netlifyBuildCommand() {
  const toml = readFileSync(join(repoRoot, "netlify.toml"), "utf8");
  const build = toml.split(/^\[/m).find((part) => part.startsWith("build]"));
  const command = /^\s*command\s*=\s*"([^"]*)"/m.exec(build ?? "");
  return command?.[1];
}

// Netlify's environment: its own variables, and the farm's keys with
// placeholder values. Nothing else from this machine.
function netlifyEnv(keys) {
  const placeholders = Object.fromEntries(
    keys.map((key) => [key, `placeholder-${key.toLowerCase()}`]));
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NETLIFY: "true",
    CONTEXT: "production",
    ...placeholders,
  };
}

function runBuild(root, command, env) {
  const build = spawnSync("sh", ["-c", command], {
    cwd: root, env, stdio: "pipe", timeout: 180_000,
  });
  return { exitCode: build.status, output: `${build.stdout}${build.stderr}` };
}

describe("D6 env checks (#65)", () => {
  const folders = [];
  afterEach(() => folders.splice(0).forEach((dir) =>
    rmSync(dir, { recursive: true, force: true })));

  it("criterion 1: a Netlify build with a missing listed key fails", () => {
    const command = netlifyBuildCommand();
    expect(command, "netlify.toml has a [build] command").toBeTruthy();
    const keys = sampleKeys();
    expect(keys.length, "keys listed in .env.example").toBeGreaterThan(0);

    for (const missing of keys) {
      const root = copyOfTheApp(folders);
      const env = netlifyEnv(keys.filter((key) => key !== missing));
      const build = runBuild(root, command, env);
      expect(build.exitCode, `the Netlify build should fail without ` +
        `${missing}; it said: ${build.output.slice(-2000)}`).not.toBe(0);
      expect(build.output, `the failure should name ${missing}`)
        .toContain(missing);
    }

    const complete = copyOfTheApp(folders);
    const build = runBuild(complete, command, netlifyEnv(keys));
    expect(build.exitCode, "the Netlify build should pass with every " +
      `listed key; it said: ${build.output.slice(-2000)}`).toBe(0);
  }, 600_000);

  it("criterion 2: the sample lists every variable the code reads", () => {
    const listed = new Set(sampleKeys());
    const files = CODE_FOLDERS.flatMap((dir) =>
      codeFiles(join(repoRoot, dir)));
    const dynamic = files.filter((file) =>
      DYNAMIC_READ.test(readFileSync(file, "utf8")));
    expect(dynamic, "files reading the environment by a computed name, " +
      "which no check can hold to the sample").toEqual([]);

    const unlisted = files.flatMap((file) =>
      readsIn(readFileSync(file, "utf8"))
        .filter((name) => !listed.has(name) && !PLATFORM_VARIABLES.has(name))
        .map((name) => `${name} (${file.slice(repoRoot.length + 1)})`));
    expect([...new Set(unlisted)], "variables the code reads that " +
      ".env.example does not list").toEqual([]);
  });
});
