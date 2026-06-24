// Client-side capture validation (ajv, JSON Schema draft 2020-12). The
// fast/offline first line; the record_capture RPC re-validates server-side
// with pg_jsonschema so a stale client can't write a malformed record.
import Ajv2020 from "ajv/dist/2020";
import { schemaFor } from "./registry.js";

// strict:false — our schemas use draft-2020 keywords ajv's strict mode
// would warn on (and we don't want a warning to break a field write).
const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new Map(); // `${schemaId}/${version}` -> validate fn

function validator(schemaId, version) {
  const key = `${schemaId}/${version}`;
  let v = compiled.get(key);
  if (!v) {
    v = ajv.compile(schemaFor(schemaId, version));
    compiled.set(key, v);
  }
  return v;
}

export function isValid(schemaId, version, doc) {
  return validator(schemaId, version)(doc);
}

// Throws a descriptive error if `doc` is invalid against (schemaId, version).
export function assertValid(schemaId, version, doc) {
  const v = validator(schemaId, version);
  if (!v(doc)) {
    const detail = (v.errors || [])
      .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
      .join("; ");
    throw new Error(`capture doc fails ${schemaId}/v${version}: ${detail}`);
  }
}
