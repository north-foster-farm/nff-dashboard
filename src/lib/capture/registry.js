// The capture-schema registry. The in-repo JSON Schema files are the
// source of truth; the DB `capture_schemas` table is a published mirror
// (for server-side pg_jsonschema validation + historical self-description).
//
// Adding a schema version: drop a vN.schema.json next to the others, add
// its upcaster (n-1 -> n) to that schema's upcasters.js, register the
// version below, and publish it with a migration. See
// docs/specs/versioned-capture-substrate.md.
import confirmedDayV1 from "./schemas/schedule.confirmed_day/v1.schema.json";
import confirmedDayUpcasters from "./schemas/schedule.confirmed_day/upcasters.js";

export const REGISTRY = {
  "schedule.confirmed_day": {
    latestVersion: 1,
    schemas: { 1: confirmedDayV1 },
    upcasters: confirmedDayUpcasters, // { n: (vN) => vN+1 }
  },
};

export function schemaEntry(schemaId) {
  const entry = REGISTRY[schemaId];
  if (!entry) throw new Error(`Unknown capture schema_id: ${schemaId}`);
  return entry;
}

export function latestVersion(schemaId) {
  return schemaEntry(schemaId).latestVersion;
}

export function schemaFor(schemaId, version) {
  const schema = schemaEntry(schemaId).schemas[version];
  if (!schema) throw new Error(`No in-repo schema for ${schemaId}/v${version}`);
  return schema;
}
