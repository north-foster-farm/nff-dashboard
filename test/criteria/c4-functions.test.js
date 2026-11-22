// Criteria test for nff-dashboard#58 (C4, test the Netlify functions),
// criterion 1, word for word: "Each function has a test of its success,
// failure and rejected-caller paths. Checked by test."
//
// Written by the test agent from the criterion and the spec, ahead of
// the implementation. Held out of `npm test` until it lands; run it with
// `npm run test:criteria`.
//
// UNRUN (2026-11-22): committed as written, never executed, because
// its recordings do not exist yet. Security conditions: the security
// lane reads ./functionRunner.mjs before this test's first run, and
// when the implementer changes these functions, it reads that diff
// before this test first runs against it.
//
// Handler in, response out. Each call runs in ./functionRunner.mjs, its
// own process, where Supabase and web push are answered only from
// recorded exchanges under test/fixtures/functions/ (workspace rule: no
// hand-written fake), the clock is frozen at the recording, and every
// other way out is shut. The recordings do not exist yet: they need the
// fixtures tool of #62 (D3) and are made by the coordinator, so this
// test fails, naming each missing one, until they are recorded.
// The rejected-caller path is C3's (#57) rule: `Authorization: Bearer`
// with PUSH_CALLER_SECRET. No git runs; nothing reaches a live service.

import { spawnSync } from "node:child_process";
import {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import webpush from "web-push";
import { afterAll, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..", "..");
const runner = join(import.meta.dirname, "functionRunner.mjs");
const FIXTURES = join(repoRoot, "test", "fixtures", "functions");

const SECRET_NAME = "PUSH_CALLER_SECRET";
const SECRET = "placeholder-caller-secret-0123456789";
const AUTHORIZED = { authorization: `Bearer ${SECRET}` };
// A made-up run, which the recording creates on staging and removes.
const MADE_UP_RUN_ID = "00000000-0000-4000-8000-00000000c4d1";

// Each path, and the recorded exchanges it replays, in order. These are
// also the recordings the coordinator makes (service/name.json).
const PATHS = {
  heartbeat: {
    success: { exchanges: ["supabase/heartbeat-upsert"] },
    failure: { exchanges: ["supabase/heartbeat-upsert-unauthorized"] },
  },
  "notify-run-done": {
    success: {
      body: { run_id: MADE_UP_RUN_ID },
      exchanges: [
        "supabase/commitments-mark-notified",
        "supabase/chore-blocks-one",
        "supabase/push-subscriptions-one",
        "webpush/send-created",
      ],
    },
    failure: {
      body: { run_id: MADE_UP_RUN_ID },
      exchanges: ["supabase/commitments-mark-notified-unauthorized"],
    },
  },
  "schedule-reminder": {
    success: {
      exchanges: [
        "supabase/captures-none-today",
        "supabase/push-subscriptions-one",
        "supabase/user-preferences-enabled",
        "webpush/send-created",
      ],
    },
    failure: { exchanges: ["supabase/captures-unauthorized"] },
  },
};

const home = mkdtempSync(join(tmpdir(), "nff-functions-"));
const vapid = webpush.generateVAPIDKeys();
const ENV = {
  PATH: process.env.PATH,
  HOME: home,
  TZ: "America/New_York",
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_SECRET_KEY: "placeholder-supabase-secret",
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: "mailto:nobody@example.invalid",
  [SECRET_NAME]: SECRET,
};

const fixturePath = (name) => join(FIXTURES, `${name}.json`);

function loadExchange(name) {
  const [service] = name.split("/");
  return { service, name, ...JSON.parse(readFileSync(fixturePath(name),
    "utf8")) };
}

function call(name, { headers = {}, body, exchanges = [] }) {
  const loaded = exchanges.map(loadExchange);
  const spec = {
    file: join(repoRoot, "netlify", "functions", `${name}.mjs`),
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    now: loaded[0]?.recorded ?? null,
    exchanges: loaded,
  };
  const specFile = join(home, `${name}-${Date.now()}.json`);
  writeFileSync(specFile, JSON.stringify(spec));
  const run = spawnSync(process.execPath, [runner, specFile],
    { cwd: home, env: ENV, stdio: "pipe", timeout: 60_000 });
  try {
    return JSON.parse(`${run.stdout}`.trim().split("\n").at(-1));
  } catch {
    return { status: null, error: `${run.stdout}${run.stderr}`,
      used: [], unused: loaded.length, outbound: [] };
  }
}

describe("C4 the Netlify functions (#58)", () => {
  afterAll(() => rmSync(home, { recursive: true, force: true }));

  it("criterion 1: each function has a test of its success, failure " +
    "and rejected-caller paths", () => {
    const missing = Object.values(PATHS)
      .flatMap((paths) => Object.values(paths))
      .flatMap((path) => path.exchanges)
      .filter((name) => !existsSync(fixturePath(name)));
    expect([...new Set(missing)], "recorded exchanges still to make " +
      "under test/fixtures/functions/ (D3's tool, by the coordinator)")
      .toEqual([]);

    for (const [name, paths] of Object.entries(PATHS)) {
      const rejected = call(name, { body: paths.success.body });
      expect(rejected.status, `${name} without a token: 401; got ` +
        JSON.stringify(rejected)).toBe(401);
      expect(rejected.outbound, `${name} without a token reaches ` +
        "nothing").toEqual([]);

      const success = call(name, { ...paths.success, headers: AUTHORIZED });
      expect(success.status, `${name} succeeds; got ` +
        JSON.stringify(success)).toBe(200);
      expect(success.outbound, `${name}'s success makes only recorded ` +
        "calls").toEqual([]);
      expect(success.unused, `${name}'s success makes every recorded ` +
        "call it is given").toBe(0);

      const failure = call(name, { ...paths.failure, headers: AUTHORIZED });
      expect(failure.status, `${name} reports the failure of a call it ` +
        `depends on as a server error; got ${JSON.stringify(failure)}`)
        .toBeGreaterThanOrEqual(500);
      expect(failure.outbound, `${name}'s failure makes only recorded ` +
        "calls").toEqual([]);
    }
  }, 300_000);
});
