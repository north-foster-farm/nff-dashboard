// Criteria tests for #60 (Isolated unit environment), one describe per
// "Done when" box, written by a test agent from the boxes alone
// (2026-11-23), adopting the implementer's in-process network checks.
//
// Box 1: "A test that reads a non-allowlisted variable or opens a
// socket fails." Decided on #60, 2026-11-11: a dropped variable reads
// as undefined. A variable is only proven dropped if it was there to
// drop, and a test that hides its error is only proven failed by a
// run of its own, so both are run as probes in a vitest of their own
// (src/test/probes/), through the suite's real config.
// Box 2: "The existing test files pass unchanged or with fakes." That
// is the suite's own green run; checked here is that every one of
// them runs under the isolation.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { join, matchesGlob, relative } from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import config from "../../vitest.config.js";
import { blockedHosts, NetworkBlocked } from "./isolation.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REAL_SERVICE = "supabase.example.test";
const PLANTED = "planted";
const PROBE_TIMEOUT_MS = 60_000;

// These tests block on purpose, so each takes its own entries back
// out; the file-level check in setup.js fails on any that remain.
afterEach(() => {
  blockedHosts().length = 0;
});

// Runs one probe in a vitest of its own, with `planted` added to the
// environment it starts with. -> vitest's JSON report of the run.
const runProbe = (probe, planted = {}) => {
  const run = spawnSync(process.execPath, [
    join(ROOT, "node_modules/vitest/vitest.mjs"), "run",
    "--config", "src/test/probes/vitest.probe.config.js",
    "--reporter=json", `src/test/probes/${probe}`,
  ], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...planted },
  });
  const json = run.stdout.slice(run.stdout.indexOf("{"));

  return { ...JSON.parse(json), exitCode: run.status };
};

// -> the error an attempt to connect ends in, thrown or emitted.
const failureOf = (connect) => new Promise((resolve) => {
  try {
    connect().on("error", resolve);
  } catch (error) {
    resolve(error);
  }
});

describe("box 1: a test that reads a non-allowlisted variable fails", () => {
  it("reads a variable the run started with, or a leaked .env.local's, "
    + "as undefined, through process.env and import.meta.env", () => {
    const envDir = mkdtempSync(join(tmpdir(), "nff-isolation-"));

    writeFileSync(join(envDir, ".env.local"),
      `VITE_ENV_FILE_PROBE=${PLANTED}
`);

    let report;

    try {
      report = runProbe("env.probe.js", {
        NFF_ISOLATION_PROBE: PLANTED,
        SUPABASE_SECRET_KEY: PLANTED,
        VITE_ISOLATION_PROBE: PLANTED,
        NFF_PROBE_ENV_DIR: envDir,
      });
    } finally {
      rmSync(envDir, { recursive: true, force: true });
    }
    const passed = report.numPassedTests;

    expect(passed, "the probe ran and found nothing planted").toBe(1);
    expect(report.exitCode).toBe(0);
  }, PROBE_TIMEOUT_MS);
});

describe("box 1: a test that opens a socket fails", () => {
  it("refuses fetch to a real host and records it", async () => {
    await expect(fetch(`https://${REAL_SERVICE}/rest/v1/`)).rejects.toThrow(
      NetworkBlocked,
    );
    expect(blockedHosts()).toEqual([REAL_SERVICE]);
  });

  it("refuses a socket to a real host", () => {
    expect(() => net.connect({ host: REAL_SERVICE, port: 443 })).toThrow(
      NetworkBlocked,
    );
  });

  it("refuses http, https and tls to a real host", async () => {
    const ways = {
      http: () => http.get(`http://${REAL_SERVICE}/`),
      https: () => https.get(`https://${REAL_SERVICE}/`),
      tls: () => tls.connect({ host: REAL_SERVICE, port: 443 }),
    };
    const errors = {};

    for (const [way, connect] of Object.entries(ways)) {
      errors[way] = (await failureOf(connect))?.name;
    }

    expect(errors).toEqual({
      http: "NetworkBlocked", https: "NetworkBlocked", tls: "NetworkBlocked",
    });
  });

  it("fails a file whose test hides the error", () => {
    const report = runProbe("swallowed.probe.js");
    const [file] = report.testResults;

    expect(file.status, "the file fails though its test passed")
      .toBe("failed");
    expect(file.message).toMatch(/reached the network/);
    expect(report.exitCode).not.toBe(0);
  }, PROBE_TIMEOUT_MS);

  it("lets this machine through", async () => {
    // Nothing listens on port 1, so this fails; what matters is that
    // the guard did not do it.
    await fetch("http://localhost:1/").catch(() => {});
    expect(blockedHosts()).toEqual([]);
  });
});

describe("box 2: every test file runs under the isolation", () => {
  it("loads the setup for every file the suite runs", () => {
    const testFiles = (dir) => readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) {
          return entry.name === "node_modules" ? [] : testFiles(path);
        }

        return entry.name.endsWith(".test.js") ? [relative(ROOT, path)] : [];
      });
    const outside = testFiles(join(ROOT, "src")).filter((file) =>
      !config.test.include.some((glob) => matchesGlob(file, glob)));

    expect(config.test.setupFiles).toContain("src/test/setup.js");
    expect(outside, "test files the suite would not run").toEqual([]);
  });
});
