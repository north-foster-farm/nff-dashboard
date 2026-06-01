// backup-db.mjs — read-only full export of the hosted Supabase DB.
//
// Dumps every table the REST API exposes to a timestamped JSON folder
// under .backups/ (gitignored). Run this BEFORE any destructive DB
// operation — a `supabase db reset`, or applying amended-in-place
// migrations to the linked project. See CLAUDE.md → "Data safety".
//
//   node scripts/backup-db.mjs
//
// Credentials come from .env.local at runtime (never hardcoded):
//   SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SECRET_KEY
// The secret key bypasses RLS so the dump is complete.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// ── parse .env.local (no dependency on dotenv) ───────────────────────
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
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local — cannot back up."
  );
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

// Tables we most care about not losing, surfaced first in the summary.
const PRIORITY = new Set([
  "event_series", "event_occurrences", "event_links", "event_instances",
  "automations", "gcal_pushes",
  "chore_definitions", "chore_blocks", "chore_modifiers", "chore_runs",
  "chore_completions", "chore_assignment_rules", "chore_messages",
  "activity_log", "activity_log_condition_states",
]);

// ── enumerate tables from the OpenAPI spec ───────────────────────────
async function listTables() {
  const res = await fetch(`${REST}/`, { headers });
  if (!res.ok) {
    throw new Error(`OpenAPI fetch failed: ${res.status} ${res.statusText}`);
  }
  const spec = await res.json();
  // Swagger 2.0 → `definitions`; OpenAPI 3 → `components.schemas`.
  const defs = spec.definitions || spec.components?.schemas || {};
  return Object.keys(defs).sort();
}

// ── paginate a table to completion ───────────────────────────────────
async function dumpTable(name) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const url = `${REST}/${encodeURIComponent(name)}?select=*`;
    const res = await fetch(url, {
      headers: { ...headers, Range: `${from}-${from + pageSize - 1}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${name}: ${res.status} ${res.statusText} — ${body}`);
    }
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(repoRoot, ".backups", stamp);
  mkdirSync(outDir, { recursive: true });

  const tables = await listTables();
  console.log(`Backing up ${tables.length} tables → .backups/${stamp}/`);

  const manifest = { takenAt: new Date().toISOString(), url: SUPABASE_URL, tables: {} };
  const failures = [];

  for (const name of tables) {
    try {
      const rows = await dumpTable(name);
      writeFileSync(
        join(outDir, `${name}.json`),
        JSON.stringify(rows, null, 2)
      );
      manifest.tables[name] = rows.length;
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      manifest.tables[name] = `ERROR: ${err.message}`;
    }
  }

  writeFileSync(
    join(outDir, "_manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  // Summary — priority tables first, then the rest.
  const names = Object.keys(manifest.tables);
  const order = [
    ...names.filter((n) => PRIORITY.has(n)),
    ...names.filter((n) => !PRIORITY.has(n)),
  ];
  console.log("\nRow counts:");
  for (const n of order) {
    const tag = PRIORITY.has(n) ? "*" : " ";
    console.log(`  ${tag} ${n}: ${manifest.tables[n]}`);
  }
  console.log(`\n(* = events/chores priority tables)`);
  console.log(`\nBackup written to .backups/${stamp}/`);
  if (failures.length) {
    console.error(`\n${failures.length} table(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
