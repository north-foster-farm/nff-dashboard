// supa.mjs — minimal Supabase REST client for the MCP server.
//
// Reads SUPABASE_URL + SUPABASE_SECRET_KEY from the repo's .env.local
// (the same source scripts/backup-db.mjs uses) and talks to PostgREST
// with the service key, which bypasses RLS. Plain fetch, no supabase-js
// — one fewer dependency, and it sidesteps the supabase-js hang noted in
// scripts/prod-read.sh.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

// Parse .env.local without a dotenv dependency (mirrors backup-db.mjs).
function loadEnv(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnv(join(repoRoot, ".env.local"));
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SECRET) {
  throw new Error(
    "nff-dashboard-mcp: missing SUPABASE_URL / SUPABASE_SECRET_KEY in " +
      ".env.local (repo root). The MCP server can't reach the database."
  );
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const baseHeaders = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

// GET a PostgREST query, e.g. "projects?select=title&order=sort_order".
export async function restGet(query) {
  const res = await fetch(`${REST}/${query}`, { headers: baseHeaders });
  if (!res.ok) {
    throw new Error(`GET ${query} -> ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Insert one row and return it.
export async function restInsert(table, row) {
  const res = await fetch(`${REST}/${table}`, {
    method: "POST",
    headers: { ...baseHeaders, Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`POST ${table} -> ${res.status} ${await res.text()}`);
  }
  const [data] = await res.json();
  return data;
}
