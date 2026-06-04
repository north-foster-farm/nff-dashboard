// chores-cutover.mjs — Phase C of the chores rebuild.
//
// Maps the spec seed (src/data/choreSeeds.js + processSeeds.js) onto the
// LIVE chore_definitions / processes tables. Soft, reversible cutover:
// retires the current definitions (retired_at = now) and inserts the new
// block/owner/deadline-model definitions + the two event processes.
//
// SAFETY (see CLAUDE.md → Data safety):
//   * DRY-RUN BY DEFAULT. Writes nothing unless --apply is passed.
//   * Run `node scripts/backup-db.mjs` FIRST and confirm row counts.
//   * Discrete steps so each prod write is run + reviewed on its own:
//       --step=cold-storage     create the Cold storage place (under House)
//       --step=renumber-blocks  set chore_blocks.sort_order chronological
//       --step=retire-old       retired_at = now() on all current defs
//       --step=insert-defs      insert the new chore_definitions
//       --step=insert-processes insert the 2 event processes + steps
//       --step=all              all of the above, in order
//   * retire-old is reversible (clear retired_at). insert-* conflict-skip
//     by id/title so a re-run is safe.
//
// Usage:
//   node scripts/chores-cutover.mjs --step=all              # dry run
//   node scripts/chores-cutover.mjs --step=retire-old --apply
//
// Credentials: SUPABASE_URL + SUPABASE_SECRET_KEY from .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CHORE_SEEDS, CHORE_BLOCK_IDS,
} from "../src/data/choreSeeds.js";
import { PROCESS_SEEDS } from "../src/data/processSeeds.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

// ── env + REST helpers ───────────────────────────────────────────────
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
const URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL || !SECRET) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}
const REST = `${URL}/rest/v1`;
const H = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const STEP = (args.find(a => a.startsWith("--step=")) || "--step=all").slice(7);

async function get(q) {
  const r = await fetch(`${REST}/${q}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${q}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function send(method, path, body, extraHeaders = {}) {
  if (!APPLY) { console.log(`   [dry-run] ${method} ${path}`); return null; }
  const r = await fetch(`${REST}/${path}`, {
    method,
    headers: { ...H, "Content-Type": "application/json", ...extraHeaders },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

// ── live place ids (verified read-only 2026-06-04) ───────────────────
const PLACE = {
  brooders: "91e940b3-6345-4ffc-9d42-40c91efa98f2", // "Brooders" parent
  house: "363828ad-b1c9-452b-aef3-4d594ffa8dbf",
  barn: "00cbbaef-4019-474a-9786-22dd32d50679",
};

// owner (+ place for the place-scoped "none") → live anchor columns,
// mirroring how the existing verified chores are anchored.
function anchorFor(owner, place, coldStorageId) {
  switch (owner) {
    case "brooder":
      return { anchor_type: "occupied_place", place_id: PLACE.brooders };
    case "chicken_tractor":
      return { anchor_type: "species", anchor_kind_tag: "tractor",
        anchor_species_id: "broilers" };
    case "mobile_coop":
      return { anchor_type: "species", anchor_kind_tag: "coop",
        anchor_species_id: "layers" };
    case "sheep":
      return { anchor_type: "species", anchor_species_id: "sheep" };
    case "none":
      if (place === "house") return { anchor_type: "place", place_id: PLACE.house };
      if (place === "barn") return { anchor_type: "place", place_id: PLACE.barn };
      if (place === "cold_storage") {
        return { anchor_type: "place", place_id: coldStorageId };
      }
      return { anchor_type: "none" };
    default:
      return { anchor_type: "none" };
  }
}

function defRow(c, idx, coldStorageId) {
  const a = anchorFor(c.owner, c.place, coldStorageId);
  return {
    id: c.id,
    title: c.title,
    category: c.owner,            // NOT NULL; owner slug (display uses anchor)
    description: c.description ?? null,
    frequency: c.frequency,
    deadline: c.deadline,
    period: null,
    start_time: null,
    assignment: null,
    tags: c.tags ?? [],
    block_id: CHORE_BLOCK_IDS[c.block] ?? null,
    last_chance_block_id: null,
    sort_order: idx,
    anchor_type: a.anchor_type,
    anchor_kind_tag: a.anchor_kind_tag ?? null,
    anchor_species_id: a.anchor_species_id ?? null,
    anchor_batch_id: null,
    at_place_id: a.at_place_id ?? null,
    place_id: a.place_id ?? null,
  };
}

// ── lookups ──────────────────────────────────────────────────────────
async function findColdStorage() {
  const rows = await get(
    "places?select=id,name&name=eq.Cold%20storage&parent_id=eq." + PLACE.house
  );
  return rows[0]?.id ?? null;
}

// ── steps ────────────────────────────────────────────────────────────
async function stepColdStorage() {
  console.log("\n## cold-storage — create the Cold storage place under House");
  const existing = await findColdStorage();
  if (existing) { console.log(`   exists: ${existing} — skipping`); return existing; }
  const maxSort = (await get("places?select=sort_order&order=sort_order.desc&limit=1"))[0]?.sort_order ?? 0;
  const row = {
    name: "Cold storage", kind: "structure", kind_tag: "container",
    parent_id: PLACE.house, is_active: true, mobile: false,
    sort_order: maxSort + 1,
  };
  console.log("   insert:", JSON.stringify(row));
  const created = await send("POST", "places", row, { Prefer: "return=representation" });
  return created?.[0]?.id ?? null;
}

async function stepRenumberBlocks() {
  console.log("\n## renumber-blocks — chronological sort_order (1..5)");
  const order = ["morning", "midmorning", "early_afternoon",
    "late_afternoon", "end_of_day"];
  for (let i = 0; i < order.length; i++) {
    const id = CHORE_BLOCK_IDS[order[i]];
    console.log(`   ${order[i].padEnd(16)} -> sort_order ${i + 1}`);
    await send("PATCH", `chore_blocks?id=eq.${id}`, { sort_order: i + 1 });
  }
}

async function stepRetireOld() {
  console.log("\n## retire-old — retired_at = now() on all current defs");
  const live = await get("chore_definitions?select=id&retired_at=is.null");
  console.log(`   ${live.length} live definitions -> retired (reversible)`);
  await send("PATCH", "chore_definitions?retired_at=is.null",
    { retired_at: new Date().toISOString() });
}

async function stepInsertDefs() {
  console.log(`\n## insert-defs — insert ${CHORE_SEEDS.length} new chore_definitions`);
  const cs = await findColdStorage();
  if (!cs) console.log("   ⚠ Cold storage place missing — run --step=cold-storage first");
  const rows = CHORE_SEEDS.map((c, i) => defRow(c, i, cs));
  console.log(`   ${rows.length} rows. sample:`,
    JSON.stringify({ id: rows[0].id, block_id: rows[0].block_id,
      anchor_type: rows[0].anchor_type, place_id: rows[0].place_id }));
  // Upsert by id so a re-run is safe.
  await send("POST", "chore_definitions", rows,
    { Prefer: "resolution=merge-duplicates,return=minimal" });
  // Report anchor distribution for review.
  const dist = {};
  for (const r of rows) dist[r.anchor_type] = (dist[r.anchor_type] || 0) + 1;
  console.log("   anchor_type distribution:", JSON.stringify(dist));
}

async function stepInsertProcesses() {
  console.log("\n## insert-processes — 2 event processes + steps + links");
  const existing = await get("processes?select=id,title");
  const byTitle = new Map(existing.map(p => [p.title, p.id]));
  for (const proc of PROCESS_SEEDS) {
    if (byTitle.has(proc.title)) {
      console.log(`   "${proc.title}" exists — skipping`);
      continue;
    }
    console.log(`   insert process "${proc.title}" (active=${proc.isActive})`);
    const created = await send("POST", "processes", {
      title: proc.title, description: proc.description,
      is_active: proc.isActive, lookahead_days: proc.lookaheadDays,
      created_by: "seed",
    }, { Prefer: "return=representation" });
    const pid = created?.[0]?.id ?? "(dry-run-id)";
    for (const kindId of proc.eventKindIds) {
      console.log(`     link kind ${kindId}`);
      await send("POST", "process_event_kind_links",
        { process_id: pid, event_kind_id: kindId });
    }
    for (const s of proc.steps) {
      const row = {
        process_id: pid, title: s.title, body_md: s.bodyMd ?? null,
        offset_days: s.offsetDays ?? 0, kind: s.kind, sort_order: s.sortOrder ?? 0,
      };
      if (s.kind === "chore_modifier") {
        row.target_chore_id = s.targetChoreId;
        row.modifier_action = s.modifierAction;
        row.modifier_text = s.modifierText ?? null;
        row.modifier_priority = s.modifierPriority ?? 10;
      }
      console.log(`     step [${row.offset_days}] ${row.kind} ${s.title}`);
      await send("POST", "process_steps", row);
    }
  }
  console.log("   NOTE: leave legacy \"Processing day prep\" active until you");
  console.log("   review the new process, then disable it + enable the new one.");
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(APPLY
    ? "▶ APPLY mode — writing to the LIVE database."
    : "▶ DRY-RUN — no writes. Pass --apply to execute.");
  console.log(`  step: ${STEP}\n`);
  if (APPLY) {
    console.log("  (Confirm you ran scripts/backup-db.mjs first.)\n");
  }
  const run = {
    "cold-storage": stepColdStorage,
    "renumber-blocks": stepRenumberBlocks,
    "retire-old": stepRetireOld,
    "insert-defs": stepInsertDefs,
    "insert-processes": stepInsertProcesses,
  };
  if (STEP === "all") {
    await stepColdStorage();
    await stepRenumberBlocks();
    await stepRetireOld();
    await stepInsertDefs();
    await stepInsertProcesses();
  } else if (run[STEP]) {
    await run[STEP]();
  } else {
    console.error(`Unknown step "${STEP}".`);
    process.exit(1);
  }
  console.log("\nDone.");
}

main().catch((e) => { console.error("\n✗", e.message); process.exit(1); });
