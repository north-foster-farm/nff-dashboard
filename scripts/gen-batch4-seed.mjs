// Generator for the threads seed block in migration 0006. Reads
// src/data/nff-data.json and emits a single upsert SQL block. Same
// dollar-quoted jsonb_to_recordset pattern as gen-batch2/3.
//
// Orders, updates, and projects have no data in the JSON — they're
// schema-only at launch — so this generator only handles threads.
import data from "../src/data/nff-data.json" with { type: "json" };

const threads = (data.threads ?? []).map((t, i) => ({
  id: t.id,
  title: t.title,
  question: t.question ?? null,
  status: t.status,
  resolution: t.resolution ?? null,
  notes: t.notes ?? null,
  ordinal: i + 1
}));

process.stdout.write(`insert into public.threads (
  id, title, question, status, resolution, notes, ordinal
)
select id, title, question, status, resolution, notes, ordinal
from jsonb_to_recordset($seed$
${JSON.stringify(threads, null, 2)}
$seed$::jsonb) as x(
  id text, title text, question text, status text,
  resolution text, notes text, ordinal integer
)
on conflict (id) do update set
  title = excluded.title,
  question = excluded.question,
  status = excluded.status,
  resolution = excluded.resolution,
  notes = excluded.notes,
  ordinal = excluded.ordinal;
`);
