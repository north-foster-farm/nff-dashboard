// Calls one Netlify function once, in a process of its own, with every
// way out to the network shut first (nff-dashboard#57). Usage:
//
//   node callerRunner.mjs FUNCTION_FILE AUTHORIZATION_HEADER|-
//
// Before the function is even loaded, fetch is replaced and every
// socket connect is refused; each attempt is recorded. The function's
// env comes from the caller (placeholders only). It prints one JSON
// line: the response status, and every outbound attempt it made. A
// function that tries to reach Supabase or a push service reaches
// nothing, and the attempt shows.

import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import tls from "node:tls";
import { pathToFileURL } from "node:url";
import workerThreads from "node:worker_threads";

const outbound = [];
const refuse = (what, target) => {
  outbound.push({ what, target: String(target) });
  throw new Error(`network is shut in this test (${what} ${target})`);
};

globalThis.fetch = async (input) =>
  refuse("fetch", input?.url ?? input);
net.Socket.prototype.connect = function connect(...args) {
  const [options] = args;
  const target = typeof options === "object"
    ? `${options.host ?? ""}:${options.port ?? options.path ?? ""}`
    : options;
  return refuse("socket", target);
};
tls.connect = (...args) => refuse("tls", JSON.stringify(args[0] ?? ""));
// Every other way out, for whatever the function grows into: another
// process, a worker, a datagram, a name lookup.
const CHILD_PROCESS_CALLS = ["spawn", "spawnSync", "exec", "execSync",
  "execFile", "execFileSync", "fork"];
for (const call of CHILD_PROCESS_CALLS) {
  childProcess[call] = (command) => refuse(`child_process.${call}`, command);
}
workerThreads.Worker = function Worker(file) {
  return refuse("worker", file);
};
dgram.createSocket = (type) => refuse("dgram", JSON.stringify(type));
dns.lookup = (host) => refuse("dns.lookup", host);
dns.promises.lookup = async (host) => refuse("dns.lookup", host);
// Named imports of these modules see the replacements too.
syncBuiltinESMExports();

const [file, authorization] = process.argv.slice(2);
const headers = { "content-type": "application/json" };
if (authorization !== "-") headers.authorization = authorization;

let status = null;
let error = null;
try {
  const { default: handler } = await import(pathToFileURL(file).href);
  const request = new Request("https://example.invalid/.netlify/functions", {
    method: "POST",
    headers,
    body: JSON.stringify({ made_up: true }),
  });
  const response = await handler(request, {});
  status = response?.status ?? null;
} catch (thrown) {
  error = String(thrown?.message ?? thrown);
}
// Exit at once: nothing the function left pending runs on afterwards.
process.stdout.write(`${JSON.stringify({ status, error, outbound })}\n`,
  () => process.exit(0));
