// Criteria test for nff-dashboard#57 (C3, verify callers of the push
// functions), criterion 1, word for word: "A request without a valid
// token gets 401 and does nothing. Checked by test."
//
// Written by the test agent from the criterion and the spec, ahead of
// the implementation. Held out of `npm test` until it lands; run it with
// `npm run test:criteria`.
//
// Security condition (nff-dashboard#57, 2026-11-22): when the
// implementer changes these functions, the security lane reads that
// diff before this test first runs against it.
//
// The token is the site's back-office form, `Authorization: Bearer`,
// checked against PUSH_CALLER_SECRET (the name #68's secrets page gives
// it, provisionally). Each call runs in its own process
// (./callerRunner.mjs) with fetch replaced and every socket connect
// refused before the function loads, and an env of placeholders only,
// so "does nothing" is measured as "tried to reach nothing", and a
// wrong implementation still reaches no live service. No git runs.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const runner = join(import.meta.dirname, "callerRunner.mjs");
const FUNCTIONS = ["notify-run-done", "schedule-reminder"];

const SECRET_NAME = "PUSH_CALLER_SECRET";
const SECRET = "placeholder-caller-secret-0123456789";
const UNAUTHORIZED = 401;

const home = mkdtempSync(join(tmpdir(), "nff-callers-"));
const PLACEHOLDER_ENV = {
  PATH: process.env.PATH,
  HOME: home,
  TZ: "America/New_York",
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SECRET_KEY: "placeholder-supabase-secret",
  VAPID_PUBLIC_KEY: "placeholder-vapid-public",
  VAPID_PRIVATE_KEY: "placeholder-vapid-private",
  VAPID_SUBJECT: "mailto:nobody@example.invalid",
};

const WITHOUT_A_VALID_TOKEN = [
  ["no Authorization header", "-"],
  ["a wrong token", "Bearer wrong-token"],
  ["an empty token", "Bearer "],
  ["the token with a character added", `Bearer ${SECRET}x`],
  ["the token cut short", `Bearer ${SECRET.slice(0, -1)}`],
  ["the token under another scheme", `Basic ${SECRET}`],
];
// With no secret configured, nothing is a valid token: not even the
// words a missing value turns into.
const WITH_NO_SECRET_SET = [
  ["Bearer undefined", "Bearer undefined"],
  ["an empty token", "Bearer "],
];

function call(name, authorization, env) {
  const run = spawnSync(process.execPath,
    [runner, join(repoRoot, "netlify", "functions", `${name}.mjs`),
      authorization],
    { cwd: home, env, stdio: "pipe", timeout: 60_000 });
  const lines = `${run.stdout}`.trim().split("\n");
  try {
    return JSON.parse(lines.at(-1));
  } catch {
    return { status: null, error: `${run.stdout}${run.stderr}`,
      outbound: [] };
  }
}

const withSecret = { ...PLACEHOLDER_ENV, [SECRET_NAME]: SECRET };

describe("C3 caller verification (#57)", () => {
  afterAll(() => rmSync(home, { recursive: true, force: true }));

  it("criterion 1: a request without a valid token gets 401 and does " +
    "nothing", () => {
    const cases = [
      ...WITHOUT_A_VALID_TOKEN.map(([how, header]) =>
        [how, header, withSecret]),
      ...WITH_NO_SECRET_SET.map(([how, header]) =>
        [`${how}, with no ${SECRET_NAME} set`, header, PLACEHOLDER_ENV]),
    ];
    for (const name of FUNCTIONS) {
      for (const [how, header, env] of cases) {
        const result = call(name, header, env);
        expect(result.status, `${name} with ${how} should answer ` +
          `${UNAUTHORIZED}; got ${JSON.stringify(result)}`)
          .toBe(UNAUTHORIZED);
        expect(result.outbound, `${name} with ${how} should try to ` +
          "reach nothing").toEqual([]);
      }

      // The other side of "valid": the right token gets past the check.
      const authorized = call(name, `Bearer ${SECRET}`, withSecret);
      expect(authorized.status, `${name} with the right token should ` +
        `get past the check; got ${JSON.stringify(authorized)}`)
        .not.toBe(UNAUTHORIZED);
    }
  }, 300_000);
});
