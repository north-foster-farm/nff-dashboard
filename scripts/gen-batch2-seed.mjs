// Generates the chore_definitions seed block for migration 0004 by reading
// the canonical CHORE_SEEDS list from src/data/choreSeeds.js. Re-run this
// anytime the seed list changes and the migration needs to be re-applied
// to a fresh DB.
//
// Usage:
//   node scripts/gen-batch2-seed.mjs > /tmp/chore-seed-block.sql
//
// The output is a single SQL `insert ... select ... from jsonb_to_recordset`
// statement that upserts all seeds. Paste into the migration wherever the
// chore_definitions seed block belongs.
import { CHORE_SEEDS } from "../src/data/choreSeeds.js";

// The in-code shape is camelCase (`startTime`), but DB columns are snake_case
// to match the rest of the schema. `jsonb_to_recordset` matches keys against
// the record-type column names verbatim, so we rewrite the seed keys before
// embedding. Only `startTime` actually differs today; everything else is
// already single-word. Keeping this as a list so adding future camelCase
// columns is a one-line change.
const KEY_REMAP = { startTime: "start_time" };
const reshape = (c) =>
  Object.fromEntries(Object.entries(c).map(([k, v]) => [KEY_REMAP[k] ?? k, v]));

const json = JSON.stringify(CHORE_SEEDS.map(reshape), null, 2);

// The SQL uses dollar-quoted strings ($seed$...$seed$) so the JSON content
// never needs escaping. If a future seed contains the literal "$seed$" we'd
// have to pick a different tag, but that's exceedingly unlikely.
process.stdout.write(`insert into public.chore_definitions (
  id, title, category, description, frequency, period, start_time, deadline, assignment, tags
)
select id, title, category, description, frequency, period, start_time, deadline, assignment, tags
from jsonb_to_recordset($seed$
${json}
$seed$::jsonb) as x(
  id text, title text, category text, description text,
  frequency jsonb, period text, start_time text,
  deadline jsonb, assignment jsonb, tags jsonb
)
on conflict (id) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  frequency = excluded.frequency,
  period = excluded.period,
  start_time = excluded.start_time,
  deadline = excluded.deadline,
  assignment = excluded.assignment,
  tags = excluded.tags;
`);
