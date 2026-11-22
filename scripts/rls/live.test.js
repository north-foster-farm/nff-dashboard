import { describe, expect, it } from "vitest";

import { probe, run } from "./live.mjs";

const ENV = { SUPABASE_URL: "https://p.example.co/", SUPABASE_ANON_KEY: "anon" };

const reply = (status, body) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe("probe", () => {
  const ask = (fetchImpl) => probe("customers", {
    url: "https://p.example.co", key: "anon", fetchImpl,
  });

  it("calls a refusal, an empty answer and a row by name", async () => {
    expect(await ask(reply(401, { code: "42501" }))).toBe("refused");
    expect(await ask(reply(200, []))).toBe("empty");
    expect(await ask(reply(200, [{ id: 1 }]))).toBe("readable");
  });

  it("sends only the anon key, to the table's REST path", async () => {
    let seen;

    await ask(async (url, init) => {
      seen = { url, init };

      return { ok: true, json: async () => [] };
    });

    expect(seen.url).toBe(
      "https://p.example.co/rest/v1/customers?select=*&limit=1");
    expect(seen.init.headers).toEqual({
      apikey: "anon", authorization: "Bearer anon",
    });
  });
});

describe("run", () => {
  const go = async (fetchImpl, options = {}) => {
    const lines = [];
    const code = await run({
      env: ENV, fetchImpl, tables: ["a", "b", "c"], out: (l) => lines.push(l),
      ...options,
    });

    return { code, lines };
  };

  it("passes when every table refuses or shows nothing", async () => {
    let n = 0;
    const { code, lines } = await go(async () => (n++ ? reply(200, [])()
      : reply(403, {})()));

    expect(code).toBe(0);
    expect(lines).toContain("refused: 1, no rows visible: 2");
    expect(lines.at(-1)).toBe("PASS");
  });

  it("fails on a table that hands anon a row, naming it only off Actions", async () => {
    const leak = async (url) => (url.includes("/b?")
      ? reply(200, [{ id: 1 }])() : reply(200, [])());
    const local = await go(leak, { details: true });
    const actions = await go(leak, { details: false });

    expect(local.code).toBe(1);
    expect(local.lines).toContain("readable: b");
    expect(actions.code).toBe(1);
    expect(actions.lines.join("\n")).not.toMatch(/readable: b/);
    expect(actions.lines).toContain("readable by anon: 1");
  });

  it("fails, saying why, without the URL and key", async () => {
    const { code, lines } = await go(reply(200, []), { env: {} });

    expect(code).toBe(1);
    expect(lines[0]).toMatch(/not set/);
  });
});
