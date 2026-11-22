// Calls one Netlify function once, in a process of its own, answering
// its outside calls from recorded exchanges only (nff-dashboard#58).
//
//   node functionRunner.mjs SPEC_FILE
//
// SPEC_FILE is JSON: { file, method, headers, body, now, exchanges },
// where each exchange is a recorded fixture ({ service, status,
// request: { method, path }, response, responseHeaders? }) from
// test/fixtures/functions/. Supabase calls (fetch) are answered by the
// first unused exchange with the same method and path and query; web
// push (https.request) by the first unused webpush exchange. Every
// other way out is shut as in ./callerRunner.mjs: refused, recorded.
// The clock is frozen at `now`, the moment the exchanges were recorded,
// so a request keyed on today's date matches its recording. It prints
// one JSON line (status, body, error, used, outbound) and exits.

import childProcess from "node:child_process";
import dgram from "node:dgram";
import dns from "node:dns";
import { readFileSync } from "node:fs";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { PassThrough, Readable } from "node:stream";
import tls from "node:tls";
import { pathToFileURL } from "node:url";
import workerThreads from "node:worker_threads";

const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const pending = [...spec.exchanges];
const used = [];
const outbound = [];
const refuse = (what, target) => {
  outbound.push({ what, target: String(target) });
  throw new Error(`no recorded answer for ${what} ${target}`);
};
const take = (matches) => {
  const index = pending.findIndex(matches);
  if (index === -1) return null;
  const [exchange] = pending.splice(index, 1);
  used.push(exchange.name);
  return exchange;
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const method = (init.method ?? input.method ?? "GET").toUpperCase();
  const path = `${url.pathname}${url.search}`;
  const exchange = take((x) => x.service === "supabase" &&
    x.request.method === method && x.request.path === path);
  if (!exchange) return refuse("fetch", `${method} ${path}`);
  const body = exchange.response === null || exchange.response === undefined
    ? null
    : JSON.stringify(exchange.response);
  return new Response(body, {
    status: exchange.status,
    headers: exchange.responseHeaders ??
      { "content-type": "application/json" },
  });
};

https.request = (options, onResponse) => {
  const method = (options.method ?? "GET").toUpperCase();
  const exchange = take((x) => x.service === "webpush" &&
    x.request.method === method);
  if (!exchange) {
    return refuse("https", `${method} ${options.hostname ?? options.host}`);
  }
  const request = new PassThrough();
  request.setTimeout = () => request;
  const end = request.end.bind(request);
  request.end = (...args) => {
    end(...args);
    setImmediate(() => {
      const text = exchange.response === null ? "" :
        JSON.stringify(exchange.response ?? "");
      const response = Readable.from([Buffer.from(text)]);
      response.statusCode = exchange.status;
      response.headers = exchange.responseHeaders ?? {};
      onResponse?.(response);
      request.emit("response", response);
    });
    return request;
  };
  return request;
};

net.Socket.prototype.connect = function connect(options) {
  const target = typeof options === "object"
    ? `${options.host ?? ""}:${options.port ?? options.path ?? ""}`
    : options;
  return refuse("socket", target);
};
tls.connect = (...args) => refuse("tls", JSON.stringify(args[0] ?? ""));
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
syncBuiltinESMExports();

if (spec.now) {
  const frozen = new Date(spec.now).getTime();
  const RealDate = Date;
  globalThis.Date = class FrozenDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [frozen]));
    }
    static now() {
      return frozen;
    }
  };
}

let status = null;
let body = null;
let error = null;
try {
  const { default: handler } = await import(pathToFileURL(spec.file).href);
  const request = new Request("https://example.invalid/.netlify/functions", {
    method: spec.method ?? "POST",
    headers: spec.headers ?? {},
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const response = await handler(request, {});
  status = response?.status ?? null;
  body = response ? await response.text() : null;
} catch (thrown) {
  error = String(thrown?.message ?? thrown);
}
const result = { status, body, error, used, unused: pending.length,
  outbound };
process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(0));
