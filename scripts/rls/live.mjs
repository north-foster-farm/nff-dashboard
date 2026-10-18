#!/usr/bin/env node
// Signed out, with only the public anon key, try to read every table
// the migrations create. A table must refuse (an HTTP error) or show no
// rows; one that hands back a row is open to the world. Read-only: a
// write cannot be tried safely against live data, so the policies that
// guard writes are held by scripts/rls/rls.test.js instead.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/rls/live.mjs
//
// The anon key is public by design (the app ships it), so it can sit in
// a GitHub Actions variable. In Actions the log holds counts only; a
// table's name is detail an attacker could use. Run elsewhere, or with
// --details, it names the tables that leak.

import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { liveTables, readMigrations } from "./migrations.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// -> "refused", "empty" or "readable" for one table.
export const probe = async (table, { url, key, fetchImpl = fetch }) => {
  const res = await fetchImpl(
    `${url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );

  if (!res.ok) return "refused";

  const rows = await res.json().catch(() => null);

  return Array.isArray(rows) && rows.length === 0 ? "empty" : "readable";
};

const tallyOf = async (names, options) => {
  const tally = { refused: 0, empty: 0, readable: [] };

  for (const table of names) {
    const verdict = await probe(table, options);

    if (verdict === "readable") tally.readable.push(table);
    else tally[verdict] += 1;
  }

  return tally;
};

export const run = async ({
  env = process.env, fetchImpl = fetch, tables,
  details = !env.GITHUB_ACTIONS, out = console.log,
} = {}) => {
  const url = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    out("SUPABASE_URL and SUPABASE_ANON_KEY are not set; nothing checked.");

    return 1;
  }

  const names = tables
    || liveTables(readMigrations(join(ROOT, "supabase/migrations")));
  const tally = await tallyOf(names, { url, key, fetchImpl });
  const leaks = tally.readable;

  out(`tables checked: ${names.length}`);
  out(`refused: ${tally.refused}, no rows visible: ${tally.empty}`);
  out(`readable by anon: ${leaks.length}`);
  if (details) for (const t of leaks) out(`readable: ${t}`);
  out(leaks.length ? "FAIL" : "PASS");

  return leaks.length ? 1 : 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  process.exitCode = await run({ details: process.argv.includes("--details")
    || !process.env.GITHUB_ACTIONS });
}
