import net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { blockedHosts, NetworkBlocked, scrubEnv } from "./isolation.js";

const REAL_SERVICE = "supabase.example.test";

// These tests block on purpose, so each takes its own entries back
// out; the file-level check in setup.js fails on any that remain.
afterEach(() => {
  blockedHosts().length = 0;
});

describe("the environment is an allowlist", () => {
  it("drops a leaked production key and keeps the runner's own", () => {
    const env = {
      PATH: "/usr/bin",
      VITEST: "true",
      NODE_ENV: "test",
      VITE_SUPABASE_URL: "https://prod.example.test",
      SUPABASE_SECRET_KEY: "secret",
    };

    const dropped = scrubEnv(env);

    expect(dropped.sort()).toEqual([
      "SUPABASE_SECRET_KEY",
      "VITE_SUPABASE_URL",
    ]);
    expect(Object.keys(env).sort()).toEqual(["NODE_ENV", "PATH", "VITEST"]);
  });

  it("has already run on this process", () => {
    const leaked = Object.keys(process.env).filter(
      (name) => /SUPABASE|^VITE_|TOKEN|SECRET|KEY/.test(name),
    );
    expect(leaked).toEqual([]);
  });
});

describe("the network is closed", () => {
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

  it("lets this machine through", async () => {
    // Nothing listens on port 1, so this fails; what matters is that
    // the guard did not do it.
    await fetch("http://localhost:1/").catch(() => {});
    expect(blockedHosts()).toEqual([]);
  });
});
