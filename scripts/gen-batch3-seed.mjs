// Generator for the event + product seed blocks in migration 0005. Reads
// src/data/nff-data.json and emits three upsert SQL blocks:
//   - event_kinds
//   - event_instances (flattened from the nested kind.instances arrays)
//   - product_kinds
//
// Same pattern as gen-batch2-seed.mjs: stdout → paste into migration, or
// pipe directly into the migration file at generation time.
import data from "../src/data/nff-data.json" with { type: "json" };

// ── event_kinds ────────────────────────────────────────────────────────────
const eventKinds = data.events.kinds.map((k, i) => ({
  id: k.id,
  label: k.label,
  description: k.description ?? null,
  ordinal: i + 1
}));

// ── event_instances ────────────────────────────────────────────────────────
// Flatten the kind.instances nesting. UI shape keys (startTime, endTime)
// become snake_case (start_time, end_time). `processing`, `location`, and
// `recurrence` stay as jsonb blobs because they're polymorphic.
const eventInstances = data.events.kinds.flatMap(k =>
  (k.instances ?? []).map(inst => ({
    id: inst.id,
    kind_id: k.id,
    label: inst.label,
    subtitle: inst.subtitle ?? null,
    recurrence: inst.recurrence ?? null,
    date: inst.date ?? null,
    start_time: inst.startTime ?? null,
    end_time: inst.endTime ?? null,
    location: inst.location ?? null,
    processing: inst.processing ?? null,
    notes: inst.notes ?? null
  }))
);

// ── product_kinds ─────────────────────────────────────────────────────────
const productKinds = data.productKinds.map((p, i) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  sale_unit: p.saleUnit ?? null,
  source_species_id: p.sourceSpeciesId ?? null,
  source_material: p.sourceMaterial ?? null,
  yield_share_of_dressed_weight: p.yieldShareOfDressedWeight ?? null,
  size_brackets: p.sizeBrackets ?? [],
  ordinal: i + 1
}));

const emit = (table, cols, rows, typeDecl) => `
insert into public.${table} (${cols.join(", ")})
select ${cols.join(", ")}
from jsonb_to_recordset($seed$
${JSON.stringify(rows, null, 2)}
$seed$::jsonb) as x(${typeDecl})
on conflict (id) do update set
${cols.filter(c => c !== "id").map(c => `  ${c} = excluded.${c}`).join(",\n")};
`;

process.stdout.write(
  emit(
    "event_kinds",
    ["id", "label", "description", "ordinal"],
    eventKinds,
    "id text, label text, description text, ordinal integer"
  )
);

process.stdout.write(
  emit(
    "event_instances",
    [
      "id", "kind_id", "label", "subtitle", "recurrence",
      "date", "start_time", "end_time", "location", "processing", "notes"
    ],
    eventInstances,
    "id text, kind_id text, label text, subtitle text, recurrence jsonb, " +
      "date date, start_time text, end_time text, location jsonb, processing jsonb, notes text"
  )
);

process.stdout.write(
  emit(
    "product_kinds",
    [
      "id", "name", "category", "sale_unit", "source_species_id",
      "source_material", "yield_share_of_dressed_weight", "size_brackets", "ordinal"
    ],
    productKinds,
    "id text, name text, category text, sale_unit text, source_species_id text, " +
      "source_material text, yield_share_of_dressed_weight numeric, size_brackets jsonb, ordinal integer"
  )
);
