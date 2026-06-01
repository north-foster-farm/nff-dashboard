// restore-db.mjs — reimport a backup (from backup-db.mjs) after a reset.
//
// Pre-production workflow (until v1.0 rollout): migrations are amended
// in place, so applying a change means `supabase db reset`, which wipes
// runtime data and re-seeds baseline rows with FRESH uuids. This script
// puts your data back.
//
//   node scripts/backup-db.mjs                       # before reset
//   supabase db reset --linked                       # apply migrations
//   node scripts/restore-db.mjs <backupDir> --yes    # put data back
//
// Strategy — REPLACE mode (the backup is authoritative):
//   For each table present in the backup (and in the live DB), delete
//   the just-seeded rows then re-insert the backup rows VERBATIM,
//   preserving primary keys / uuids so foreign-key references between
//   restored tables stay internally consistent. Tables are processed in
//   FK-safe dependency order (parents before children on insert; the
//   reverse on delete).
//
//   Per-table tolerant: if a table can't be restored (e.g. a column was
//   renamed/dropped by a schema change, like chore_definitions
//   site_id/location_id -> place_id), it's logged and skipped so the
//   rest still restores. Those are the "handle case-by-case" cases —
//   usually fine because the migration re-seeds that table anyway.
//
// Credentials come from .env.local (SUPABASE_URL + SUPABASE_SECRET_KEY).
// DESTRUCTIVE: deletes existing rows in the restored tables. Requires
// an explicit `--yes` flag and a backup directory argument.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// ── args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const yes = args.includes("--yes");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",")) : null;
let backupDir = args.find((a) => !a.startsWith("--"));

function loadEnv(path) {
  const out = {};
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, eq).trim()] = v;
  }
  return out;
}

const env = loadEnv(join(repoRoot, ".env.local"));
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}

// Default to the most recent backup folder when none is given.
if (!backupDir) {
  const root = join(repoRoot, ".backups");
  let dirs = [];
  try {
    dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch { /* no .backups */ }
  if (dirs.length) backupDir = join(root, dirs[dirs.length - 1]);
}
if (!backupDir) {
  console.error("No backup directory given and none found under .backups/.");
  process.exit(1);
}

if (!yes) {
  console.error(
    "Refusing to run without --yes.\n" +
    `This DELETES + replaces rows in the live DB (${SUPABASE_URL})\n` +
    `from backup: ${backupDir}\n\n` +
    `Re-run: node scripts/restore-db.mjs ${basename(backupDir)} --yes`
  );
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  "Content-Type": "application/json",
};

// FK-safe insert order (parents first). Tables not listed are processed
// after these, in backup-file order. Covers both the pre- and
// post-Batch-15 schemas so the same script works across the boundary.
const INSERT_ORDER = [
  "admins", "suppliers", "feed_types", "machines", "trailers",
  "product_kinds", "event_kinds",
  "livestock_species", "livestock_groups",
  "feed_schedules", "feed_schedule_stages",
  // place model (post-Batch-15) …
  "places", "placements", "place_geometry",
  // … and the legacy place model (pre-Batch-15) for old backups
  "sites", "site_locations", "site_residents", "space_kinds", "space_items",
  "chore_blocks", "chore_definitions", "chore_modifiers", "chore_runs",
  "chore_assignment_rules", "chore_messages", "chore_completions",
  "chore_groups", "chore_group_members",
  "event_series", "event_occurrences", "event_links", "event_instances",
  "automations", "gcal_pushes",
  "activity_log", "activity_log_condition_states",
  "projects", "orders", "threads", "updates",
  "egg_lots", "chicken_lots", "batch_assignments",
  "user_preferences", "push_subscriptions",
];

// Primary key per table for the "delete all rows" filter. Default 'id'.
const PK = { place_geometry: "place_id" };

const CHUNK = 500;

function readBackupTables() {
  const files = readdirSync(backupDir).filter(
    (f) => f.endsWith(".json") && f !== "_manifest.json"
  );
  const byName = new Map();
  for (const f of files) {
    const name = f.replace(/\.json$/, "");
    if (only && !only.has(name)) continue;
    try {
      const rows = JSON.parse(readFileSync(join(backupDir, f), "utf8"));
      if (Array.isArray(rows)) byName.set(name, rows);
    } catch (e) {
      console.error(`  ! couldn't parse ${f}: ${e.message}`);
    }
  }
  return byName;
}

// Topologically sort `places` so each parent precedes its children
// (self-referential FK is checked per-row on insert).
function orderPlacesParentFirst(rows) {
  const byParent = new Map();
  for (const r of rows) {
    const k = r.parent_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(r);
  }
  const out = [];
  const walk = (parentId) => {
    for (const r of byParent.get(parentId) ?? []) {
      out.push(r);
      walk(r.id);
    }
  };
  walk(null);
  // Any rows whose parent wasn't found (shouldn't happen) — append.
  if (out.length !== rows.length) {
    const seen = new Set(out.map((r) => r.id));
    for (const r of rows) if (!seen.has(r.id)) out.push(r);
  }
  return out;
}

async function deleteAll(table) {
  const pk = PK[table] ?? "id";
  const res = await fetch(
    `${REST}/${encodeURIComponent(table)}?${pk}=not.is.null`,
    { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`delete ${table}: ${res.status} ${body}`);
  }
}

async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await fetch(`${REST}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`insert ${table}: ${res.status} ${body}`);
    }
  }
}

async function main() {
  const tables = readBackupTables();
  // Order: known tables first (FK order), then the rest in name order.
  const known = INSERT_ORDER.filter((t) => tables.has(t));
  const extra = [...tables.keys()].filter((t) => !INSERT_ORDER.includes(t)).sort();
  const insertSeq = [...known, ...extra];

  console.log(
    `Restoring from ${backupDir}\n` +
    `  -> ${SUPABASE_URL}\n` +
    `  ${insertSeq.length} table(s) with data\n`
  );

  // Delete in reverse dependency order so children go before parents.
  const deleteSeq = [...insertSeq].reverse();
  const restored = [];
  const skipped = [];

  for (const table of deleteSeq) {
    if ((tables.get(table) ?? []).length === 0) continue;
    try {
      await deleteAll(table);
    } catch (e) {
      // A delete failure (e.g. table doesn't exist in this schema) means
      // we also can't insert — record and move on.
      skipped.push(`${table}: ${e.message}`);
    }
  }

  for (const table of insertSeq) {
    let rows = tables.get(table) ?? [];
    if (rows.length === 0) continue;
    if (skipped.some((s) => s.startsWith(`${table}:`))) continue;
    if (table === "places") rows = orderPlacesParentFirst(rows);
    try {
      await insertRows(table, rows);
      restored.push(`${table}: ${rows.length}`);
    } catch (e) {
      skipped.push(`${table}: ${e.message}`);
    }
  }

  console.log("Restored:");
  for (const r of restored) console.log(`  ✓ ${r}`);
  if (skipped.length) {
    console.log("\nSkipped (handle case-by-case — usually re-seeded by migrations):");
    for (const s of skipped) console.log(`  – ${s}`);
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("Restore failed:", e); process.exit(1); });
