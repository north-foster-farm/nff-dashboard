// Criteria tests for #56's first half (log without customer data or
// secrets), one describe per "Done when" box it takes on, written by a
// test agent from the boxes alone (2026-11-23). Box 2, the write log,
// is deferred with the orders-from-site work.
//
// Box 1: "No function logs a raw error body or endpoint; a test feeds
// a secret-bearing error and checks the output." Each of the three
// functions is driven down its own failure path, with Supabase and
// web-push faked, by an error whose message, body, endpoint and
// headers carry a push endpoint, an email address, a Supabase secret
// key and a JWT; nothing any console method prints may hold one.
// Box 3: "Masking keeps the first three and last three characters of
// each part (#496)." What lies between is hidden; how is the
// helper's to choose. Every value here is made up. log.test.js beside
// this is the implementer's own test of the helper.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

import heartbeat from "../heartbeat.mjs";
import notifyRunDone from "../notify-run-done.mjs";
import scheduleReminder from "../schedule-reminder.mjs";
import { mask, scrub } from "./log.mjs";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

const ENDPOINT = "https://push.example.test/send/ENDPOINTTOKEN0123456789";
const EMAIL = "pat.example@example.test";
const SUPABASE_KEY = "sb_secret_FAKEKEYFAKEKEYFAKEKEY0000";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.ZmFrZXNpZ25hdHVyZQ";

// What none of the lines may carry, by name for the failure message.
const SECRETS = {
  endpoint: "ENDPOINTTOKEN",
  "endpoint path": "/send/",
  email: "pat.example",
  "Supabase key": "FAKEKEYFAKEKEY",
  JWT: "ZmFrZXNpZ25hdHVyZQ",
};

const secretBearingError = () => Object.assign(
  new Error(`push to ${ENDPOINT} for ${EMAIL} failed: ${SUPABASE_KEY}`),
  {
    statusCode: 500,
    endpoint: ENDPOINT,
    body: JSON.stringify({ to: EMAIL, key: SUPABASE_KEY, token: JWT }),
    headers: { authorization: `Bearer ${JWT}`, apikey: SUPABASE_KEY },
  },
);

// A Supabase client whose every query on `table` resolves to
// results[table], however it is chained.
const chain = (result) => new Proxy({}, {
  get: (_, prop) => (prop === "then"
    ? (resolve) => resolve(result)
    : () => chain(result)),
});
const fakeSupabase = (results) => ({
  from: (table) => chain(results[table] ?? { data: [] }),
});

const SUBSCRIPTION = {
  id: "sub-1", endpoint: ENDPOINT, p256dh: "p256dh", auth: "auth",
  user_email: EMAIL,
};

let printed;

beforeEach(() => {
  printed = [];
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    vi.spyOn(console, level).mockImplementation((...args) => {
      printed.push(args.map((arg) => (typeof arg === "string"
        ? arg : JSON.stringify(arg) ?? String(arg))).join(" "));
    });
  }
  vi.stubEnv("SUPABASE_URL", "https://project.example.test");
  vi.stubEnv("SUPABASE_SECRET_KEY", SUPABASE_KEY);
  vi.stubEnv("VAPID_PUBLIC_KEY", "vapid-public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "vapid-private");
  vi.stubEnv("VAPID_SUBJECT", "mailto:farm@example.test");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// -> the names of the secrets the printed lines hold.
const leaked = () => Object.entries(SECRETS)
  .filter(([, secret]) => printed.some((line) => line.includes(secret)))
  .map(([name]) => name);

describe("box 1: no function logs a raw error body or endpoint", () => {
  it("heartbeat, when the upsert fails", async () => {
    createClient.mockReturnValue(fakeSupabase({
      heartbeat: { error: secretBearingError() },
    }));

    await heartbeat();

    expect(printed.length, "it logged the failure").toBeGreaterThan(0);
    expect(leaked(), "secrets in heartbeat's log").toEqual([]);
  });

  it("notify-run-done, when a push fails", async () => {
    createClient.mockReturnValue(fakeSupabase({
      commitments: { data: { id: "run-1", block_id: "block-1" } },
      chore_blocks: { data: { id: "block-1", name: "Rounds" } },
      push_subscriptions: { data: [SUBSCRIPTION] },
    }));
    webpush.sendNotification.mockRejectedValue(secretBearingError());

    await notifyRunDone(new Request("https://x.example.test/", {
      method: "POST", body: JSON.stringify({ runId: "run-1" }),
    }));

    expect(printed.length, "it logged the failure").toBeGreaterThan(0);
    expect(leaked(), "secrets in notify-run-done's log").toEqual([]);
  });

  it("schedule-reminder, when a push fails", async () => {
    createClient.mockReturnValue(fakeSupabase({
      captures: { data: [] },
      push_subscriptions: { data: [SUBSCRIPTION] },
      user_preferences: { data: [] },
    }));
    webpush.sendNotification.mockRejectedValue(secretBearingError());

    await scheduleReminder();

    expect(printed.length, "it logged the failure").toBeGreaterThan(0);
    expect(leaked(), "secrets in schedule-reminder's log").toEqual([]);
  });
});

describe("box 3: masking keeps three and three of each part", () => {
  it("keeps a part's first and last three and hides the rest", () => {
    const part = "abcdefghij";
    const masked = mask(part);

    expect(masked.slice(0, 3), "its first three").toBe("abc");
    expect(masked.slice(-3), "its last three").toBe("hij");
    expect(masked, "nothing between shows").not.toMatch(/[d-g]/);
  });

  it("shows nothing of a part too short to keep six", () => {
    expect(mask("abcdef"), "no letter of it shows").not.toMatch(/[a-f]/);
  });

  it("masks each part of an email address apart", () => {
    const masked = scrub(`mail ${EMAIL} now`);

    expect(masked, "the local part and the domain, three and three")
      .toMatch(/^mail pat[^a-z\s]+ple@exa[^a-z\s]+est now$/);
  });
});
