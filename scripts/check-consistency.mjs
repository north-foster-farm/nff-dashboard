// check-consistency.mjs — READ-ONLY referential-integrity check for
// the identity bindings code depends on but the schema can't enforce
// (F5 step 6 / H5). GET-only against the Supabase REST endpoint; safe
// to run any time:
//
//   node scripts/check-consistency.mjs
//
// Checks:
//   1. chore block references — every chore_definitions block ref
//      (deadline jsonb `block`, block_id, last_chance_block_id)
//      resolves to a chore_blocks row. Unresolved = FAIL (the UI
//      renders it loudly as "a deleted block"); a ref to a
//      soft-deleted (is_active=false) block = WARN.
//   2. farm-map bindings — every place_geometry row's place_id
//      resolves to a places row (FAIL), and its svg_layer_id names a
//      layer that exists in public/farm-map_v1.svg (WARN — asset
//      drift; an unbound layer silently degrades to background art).
//
// Exit code: 1 if any FAIL, else 0 (warnings don't fail the run).
// Credentials from .env.local: SUPABASE_URL + SUPABASE_SECRET_KEY.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

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
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = val;
  }
  return out;
}

const env = loadEnv(join(repoRoot, ".env.local"));
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local.",
  );
  process.exit(1);
}

const REST = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1`;
const headers = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

async function get(query) {
  const res = await fetch(`${REST}/${query}`, { headers });
  if (!res.ok) {
    throw new Error(`GET ${query} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const failures = [];
const warnings = [];

// ── 1. chore block references ────────────────────────────────────────
const blocks = await get("chore_blocks?select=id,name,is_active");
const blockById = new Map(blocks.map((b) => [b.id, b]));

const defs = await get(
  "chore_definitions?select=id,title,deadline,block_id," +
    "last_chance_block_id",
);

function checkBlockRef(def, field, ref) {
  if (!ref) return;
  const block = blockById.get(ref);
  const site = `chore "${def.title}" (${def.id}) ${field}`;
  if (!block) failures.push(`${site} -> no chore_blocks row ${ref}`);
  else if (block.is_active === false) {
    warnings.push(`${site} -> soft-deleted block "${block.name}"`);
  }
}

let refCount = 0;
for (const def of defs) {
  const refs = [
    ["deadline.block", def.deadline?.block],
    ["block_id", def.block_id],
    ["last_chance_block_id", def.last_chance_block_id],
  ];
  for (const [field, ref] of refs) {
    if (ref) refCount += 1;
    checkBlockRef(def, field, ref);
  }
}
console.log(
  `block refs: ${refCount} across ${defs.length} chores, ` +
    `${blocks.length} blocks`,
);

// ── 2. farm-map bindings ─────────────────────────────────────────────
const places = await get("places?select=id,name");
const placeById = new Map(places.map((p) => [p.id, p]));
const geometry = await get(
  "place_geometry?select=svg_layer_id,place_id",
);

const svg = readFileSync(join(repoRoot, "public/farm-map_v1.svg"),
  "utf8");
// Layer ids sit on whatever element the art tool exported (<path>
// today, <g> historically) — collect every id in the document.
const layerIds = new Set(
  [...svg.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id),
);

for (const row of geometry) {
  const site = `place_geometry layer "${row.svg_layer_id}"`;
  if (!placeById.has(row.place_id)) {
    failures.push(`${site} -> no places row ${row.place_id}`);
  }
  if (row.svg_layer_id && !layerIds.has(row.svg_layer_id)) {
    warnings.push(
      `${site} -> no such layer in public/farm-map_v1.svg`,
    );
  }
}
console.log(
  `map bindings: ${geometry.length} geometry rows, ` +
    `${places.length} places, ${layerIds.size} svg layers`,
);

// ── report ───────────────────────────────────────────────────────────
for (const w of warnings) console.log(`WARN  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
if (failures.length === 0 && warnings.length === 0) {
  console.log("consistency: all references resolve.");
}
process.exit(failures.length ? 1 : 0);
