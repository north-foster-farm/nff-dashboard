// What every unit test runs inside (ported from the site's
// test/setup.mjs; wired in by src/test/setup.js). A leaked
// .env.local points this app at production Supabase, so nothing under
// test may reach a real service. Two rules hold for every run, local
// or in CI:
//
// - The environment is an allowlist. Every variable not named below
//   is dropped before a module can read it, so a key added tomorrow
//   is stripped without anyone remembering to list it.
// - The network is closed. fetch, net, tls and DNS lookups throw for
//   any host but this machine, and a file in which anything was
//   blocked fails, so a test that would reach a service never passes.

import dns from "node:dns";
import net from "node:net";
import tls from "node:tls";

const KEEP = new Set([
  "PATH", "HOME", "TMPDIR", "TZ", "LANG", "TERM", "CI", "NO_COLOR",
  "FORCE_COLOR",
]);

// Vitest and Vite talk to their workers and fill import.meta.env
// through these. VITE_* is deliberately absent: it is where the
// Supabase URL and key live.
const RUNNER_OWN =
  /^(VITEST(_.*)?|NODE_ENV|MODE|DEV|PROD|SSR|TEST|BASE_URL)$/;

export function isKept(name) {
  return KEEP.has(name) || RUNNER_OWN.test(name);
}

// Delete every variable that is not allowlisted; returns the names
// it dropped.
export function scrubEnv(env) {
  const dropped = Object.keys(env).filter((name) => !isKept(name));
  for (const name of dropped) delete env[name];
  return dropped;
}

const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);

export const BLOCKED = Symbol.for("nff.test.blocked");

export class NetworkBlocked extends Error {
  constructor(host) {
    super(`A test reached the network: ${host}`);
    this.name = "NetworkBlocked";
  }
}

// Every blocked call, by host. Code that swallows its errors would
// hide a block from the test that caused it, so the file fails at the
// end instead. A test that blocks on purpose takes its own entries
// back out.
export function blockedHosts() {
  globalThis[BLOCKED] ??= [];
  return globalThis[BLOCKED];
}

function guard(host) {
  const name = String(host ?? "").toLowerCase();
  if (!LOCAL.has(name)) {
    blockedHosts().push(name);
    throw new NetworkBlocked(name);
  }
}

// Socket#connect takes (options), (port, host) or (path), and net
// itself passes an already-normalized [options, callback] array.
function hostOf(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first && typeof first === "object") {
    return first.path ? "localhost" : (first.host ?? "localhost");
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) {
    return "localhost";
  }
  return typeof args[1] === "string" ? args[1] : "localhost";
}

export function closeNetwork() {
  if (globalThis.fetch.closedByIsolation) return;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    guard(url.hostname);
    return realFetch(input, init);
  };
  globalThis.fetch.closedByIsolation = true;

  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    guard(hostOf(args));
    return connect.apply(this, args);
  };

  const tlsConnect = tls.connect;
  tls.connect = (...args) => {
    const options = args.find((arg) => arg && typeof arg === "object");
    if (!options?.socket) guard(hostOf(args));
    return tlsConnect(...args);
  };

  const lookup = dns.lookup;
  dns.lookup = (host, ...rest) => {
    guard(host);
    return lookup(host, ...rest);
  };

  const lookupPromise = dns.promises.lookup;
  dns.promises.lookup = (host, ...rest) => {
    guard(host);
    return lookupPromise(host, ...rest);
  };
}
