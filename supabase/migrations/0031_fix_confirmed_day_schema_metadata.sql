-- 0031_fix_confirmed_day_schema_metadata.sql
-- Schedule feature — S5 hotfix.
--
-- record_capture validates each capture against the stored JSON Schema
-- with pg_jsonschema. That validator errors internally (XX000) on the
-- schedule.confirmed_day v1 schema's draft-2020-12 metadata ($schema +
-- $id) — the S2 in-migration sanity check passed only because it used a
-- trivial schema without them. The schema uses only draft-agnostic
-- keywords, so stripping $schema/$id leaves the validation semantics
-- unchanged. The in-repo source of truth
-- (src/lib/capture/schemas/schedule.confirmed_day/v1.schema.json) is
-- updated to match.
--
-- First applied as a surgical hotfix to unblock Confirm; this migration
-- records it for reproducibility (a fresh rebuild gets the stripped
-- schema). A single-row UPDATE of a schema that had never successfully
-- validated a doc; idempotent.

update public.capture_schemas
set json_schema = '{
  "title": "Confirmed day (v1)",
  "type": "object",
  "additionalProperties": false,
  "required": ["date", "confirmed_by", "confirmed_at", "blocks"],
  "properties": {
    "date": { "type": "string" },
    "confirmed_by": { "type": "string" },
    "confirmed_at": { "type": "string" },
    "people": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["name"],
        "properties": {
          "name": { "type": "string" },
          "planned_start": { "type": ["string", "null"] },
          "actual_start": { "type": ["string", "null"] }
        }
      }
    },
    "blocks": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["block_id", "label"],
        "properties": {
          "block_id": { "type": "string" },
          "label": { "type": "string" },
          "planned_start": { "type": ["string", "null"] },
          "planned_end": { "type": ["string", "null"] }
        }
      }
    },
    "shoulds": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["ref", "label", "outcome"],
        "properties": {
          "ref": { "type": "string" },
          "label": { "type": "string" },
          "outcome": { "type": "string", "enum": ["pulled", "deferred"] },
          "reason": { "type": ["string", "null"] },
          "hard_deadline": { "type": ["string", "null"] }
        }
      }
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["source_type", "label"],
        "properties": {
          "source_type": { "type": "string" },
          "source_ref": {},
          "label": { "type": "string" },
          "block_id": { "type": ["string", "null"] },
          "clock_time": { "type": ["string", "null"] },
          "assignee": { "type": ["string", "null"] }
        }
      }
    }
  }
}'::jsonb
where schema_id = 'schedule.confirmed_day' and version = 1;
