// Criteria test for nff-dashboard#74 (F1.2), criterion 2, word for
// word: "The scripts take `--staging` and refuse production without
// typed confirmation. Checked by test."
//
// Written by the test agent from the criterion and the decisions on
// #74 (2026-11-22, for James to confirm): every Supabase script takes
// --staging; the ones that write to production ask, and only typing
// "production" goes ahead; no flag (restore-db's --yes, cutover's
// --apply) replaces the typing. Reads are not held either way on
// production. Held out of `npm test` until the implementation lands;
// run it with `npm run test:criteria`.
//
// Security condition (nff-dashboard#74, 2026-11-22): the first time this
// test meets the implementer's changed scripts, their diff passes the
// security lane's review before the test runs against them.
//
// Everything runs in ./scriptSandbox.js: a temporary copy of the
// scripts whose production and staging are two local sinks. Nothing
// reaches Supabase, and no git runs.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeScriptCopy, runScript, startSink } from "./scriptSandbox.js";

// Node by absolute path: `node` on PATH may be a version-manager shim,
// which under the sandbox's fake HOME fails or fetches a Node.
const NODE = process.execPath;
const PHRASE = "production";
const WRONG_ANSWER = "no";

const READS = {
  "backup-db": [NODE, "scripts/backup-db.mjs"],
  "check-consistency": [NODE, "scripts/check-consistency.mjs"],
  "prod-read": ["bash", "scripts/prod-read.sh", "chore_blocks?select=id"],
};
// chores-cutover.mjs is left out: it cannot load today (it imports
// CHORE_BLOCK_IDS, which src/data/choreSeeds.js no longer exports), so
// it can reach nothing. It joins WRITES if it is ever made to run.
const WRITES = {
  "restore-db": (copy) =>
    [NODE, "scripts/restore-db.mjs", copy.backupDir, "--yes"],
};

describe("F1.2 the scripts' environment flag (#74)", () => {
  let production;
  let staging;
  let copy;
  beforeEach(async () => {
    production = await startSink();
    staging = await startSink();
    copy = makeScriptCopy({ production, staging });
  });
  afterEach(async () => {
    copy.remove();
    await production.close();
    await staging.close();
  });

  const reset = () => {
    production.requests.length = 0;
    staging.requests.length = 0;
  };

  it("criterion 2: the scripts take --staging and refuse production " +
    "without typed confirmation", async () => {
    const commands = {
      ...READS,
      ...Object.fromEntries(Object.entries(WRITES)
        .map(([name, build]) => [name, build(copy)])),
    };

    for (const [name, command] of Object.entries(commands)) {
      reset();
      const run = await runScript(copy, [...command, "--staging"]);
      expect(staging.requests.length, `${name} --staging should reach ` +
        `staging; it said: ${run.output}`).toBeGreaterThan(0);
      expect(production.requests, `${name} --staging should never ` +
        "reach production").toEqual([]);
    }

    for (const [name, build] of Object.entries(WRITES)) {
      const command = build(copy);
      const refusals = [
        ["with no terminal to type at", {}],
        [`when "${WRONG_ANSWER}" is typed`, { typed: WRONG_ANSWER }],
      ];
      for (const [how, options] of refusals) {
        reset();
        const run = await runScript(copy, command, options);
        expect(run.exitCode, `${name} on production should refuse ` +
          `${how}; it said: ${run.output}`).not.toBe(0);
        expect(production.writes(), `${name} should write nothing to ` +
          `production ${how}`).toEqual([]);
        expect(staging.requests, `${name} on production should never ` +
          "reach staging").toEqual([]);
      }

      reset();
      const confirmed = await runScript(copy, command, { typed: PHRASE });
      expect(production.requests.length, `${name} should go ahead on ` +
        `production once "${PHRASE}" is typed; it said: ` +
        confirmed.output).toBeGreaterThan(0);
      expect(staging.requests, `${name} on production should never ` +
        "reach staging").toEqual([]);
    }
  }, 600_000);
});
