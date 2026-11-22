// A throwaway copy of the dashboard's Supabase scripts, for driving
// their environment flag (#74, F1.2) without reaching any real
// service. Production and staging are two local sinks on 127.0.0.1:
// each records the method and path of every request and answers 503
// with no body. They pretend to be nothing, so there is no response to
// record from a real one. The copy gets fake .env.local and
// .env.staging.local files pointing at the sinks, and nothing else of
// this machine's: no .git, no real .env file, no Supabase or git
// variable, and HOME is the copy itself. No git runs.

import { spawn } from "node:child_process";
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync,
  realpathSync, rmSync, writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const repoRoot = join(import.meta.dirname, "..", "..");
const terminal = join(import.meta.dirname, "terminal.py");
// The terminal wrapper's interpreter, by absolute path where one is
// known, so a shim under the fake HOME never runs.
const PYTHON = ["/opt/homebrew/bin/python3", "/usr/bin/python3"]
  .find((path) => existsSync(path)) ?? "python3";

const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d+$/;
const FAKE_ENV_FILES = [".env.local", ".env.staging.local"];

export async function startSink() {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    request.resume();
    response.writeHead(503).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    writes: () => requests.filter((r) => r.method !== "GET"),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function envFileFor(url, key) {
  return [
    `SUPABASE_URL=${url}`,
    `VITE_SUPABASE_URL=${url}`,
    `SUPABASE_SECRET_KEY=${key}`,
    "",
  ].join("\n");
}

function envFilesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return envFilesIn(path);
    return entry.name.startsWith(".env") ? [path] : [];
  });
}

// Before anything runs: the copy's only .env files are the two fakes,
// and each points at a loopback sink.
function refuseRealEnvFiles(root) {
  const found = envFilesIn(root).map((path) => path.slice(root.length + 1));
  const onlyFakes = found.length === FAKE_ENV_FILES.length &&
    FAKE_ENV_FILES.every((name) => found.includes(name));
  const urls = FAKE_ENV_FILES.flatMap((name) =>
    readFileSync(join(root, name), "utf8").split("\n")
      .filter((line) => /URL=/.test(line))
      .map((line) => line.split("=")[1]));
  if (!onlyFakes || !urls.every((url) => LOOPBACK.test(url))) {
    throw new Error(`refusing to run: the copy holds ${found} with ` +
      `URLs ${urls}; only the two loopback fakes may be there`);
  }
}

// The scripts read their env files from the repository root: the .mjs
// ones from their own folder's parent, prod-read.sh from where it runs.
// In the copy, both must be the copy's root and hold the fakes.
const SCRIPT_FOLDER_PARENT = /\.mjs$/;

function envPathsOf(root, script) {
  const base = SCRIPT_FOLDER_PARENT.test(script)
    ? resolve(root, "scripts", "..")
    : root;
  return FAKE_ENV_FILES.map((name) => resolve(base, name));
}

function symlinksIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) return [path];
    return entry.isDirectory() ? symlinksIn(path) : [];
  });
}

function envFilesAbove(root) {
  const found = [];
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    found.push(...readdirSync(dir)
      .filter((name) => name.startsWith(".env"))
      .map((name) => join(dir, name)));
    if (dirname(dir) === dir) return found;
  }
}

// Before anything runs: no link out of the copy, no .env file in any
// folder above it for a parent-directory lookup to find, and every
// script's env paths printed. The printed paths are computed from how
// the scripts resolve them today, not read from the scripts, so that
// part cannot fail on its own: the symlink and parent-folder refusals,
// the .env-file listing, and the test's own staging-only and refusal
// checks are the real guards.
function refuseAnEscape(root) {
  const links = symlinksIn(root);
  const above = envFilesAbove(root);
  const scripts = readdirSync(join(root, "scripts"))
    .filter((name) => /\.(mjs|sh)$/.test(name))
    .filter((name) =>
      readFileSync(join(root, "scripts", name), "utf8").includes(".env"));
  const strays = scripts.flatMap((script) => {
    const paths = envPathsOf(root, script);
    console.log(`${script} reads ${paths.join(" and ")}`);
    return paths.filter((path) => realpathSync(path) !== path ||
      !FAKE_ENV_FILES.some((name) => path === join(root, name)));
  });
  if (links.length || above.length || strays.length) {
    throw new Error("refusing to run: " +
      `symlinks ${links}; .env files above the copy ${above}; ` +
      `env paths outside it ${strays}`);
  }
}

// A made-up backup for restore-db.mjs: one table, one invented row.
const MADE_UP_BACKUP = {
  "chore_blocks.json": [
    { id: "00000000-0000-4000-8000-000000000001", name: "Made-up block" },
  ],
};

export function makeScriptCopy({ production, staging }) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "nff-env-flag-")));
  for (const dir of ["scripts", "src"]) {
    cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
  }
  mkdirSync(join(root, "public"));
  cpSync(join(repoRoot, "public", "farm-map_v1.svg"),
    join(root, "public", "farm-map_v1.svg"));
  writeFileSync(join(root, ".env.local"),
    envFileFor(production.url, "placeholder-production-key"));
  writeFileSync(join(root, ".env.staging.local"),
    envFileFor(staging.url, "placeholder-staging-key"));
  const backupDir = join(root, ".backups", "made-up");
  mkdirSync(backupDir, { recursive: true });
  for (const [file, rows] of Object.entries(MADE_UP_BACKUP)) {
    writeFileSync(join(backupDir, file), JSON.stringify(rows));
  }
  refuseRealEnvFiles(root);
  refuseAnEscape(root);
  return {
    root,
    backupDir,
    remove: () => rmSync(root, { recursive: true, force: true }),
  };
}

// An allowlist, not a denylist: nothing else of this machine's env
// reaches a script (no NODE_OPTIONS, PG*, DATABASE_URL, NETLIFY_*,
// AWS_*, CURL_HOME, npm_config_* or proxy setting), and NO_PROXY keeps
// the loopback sinks direct.
const PASSED_THROUGH = ["PATH", "TMPDIR", "LANG", "TERM"];
function scriptEnv(root) {
  const kept = PASSED_THROUGH
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [name, process.env[name]]);
  return { ...Object.fromEntries(kept), HOME: root, NO_PROXY: "*" };
}

// Run a script from the copy's root. With `typed`, on a terminal with
// that line typed into it; without, with no terminal at all.
export function runScript(copy, [command, ...args], { typed } = {}) {
  const argv = typed === undefined
    ? [command, args]
    : [PYTHON, ["-I", terminal, typed, command, ...args]];
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv[1], {
      cwd: copy.root,
      env: scriptEnv(copy.root),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, output });
    });
  });
}
