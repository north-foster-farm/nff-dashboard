// Public API for the versioned-capture substrate.
//   recordCapture(schemaId, doc, opts) — validate (ajv) then enqueue
//     through the outbox (offline-safe; server re-validates via
//     pg_jsonschema in the record_capture RPC). Returns the client id.
//   readCaptures(schemaId, filter) — fetch + upcast each doc to the
//     latest shape, so callers only handle the current version.
import { supabase } from "../supabase.js";
import { enqueueOp } from "../outbox.js";
import { latestVersion } from "./registry.js";
import { assertValid } from "./validate.js";
import { applyUpcasters } from "./upcast.js";

const CAPTURE_COLS =
  "id, schema_id, schema_version, subject_type, subject_id, " +
  "captured_on, captured_at, actor_email, doc, supersedes";

export function recordCapture(schemaId, doc, opts = {}) {
  const {
    capturedOn,
    subjectType = null,
    subjectId = null,
    supersedes = null,
  } = opts;
  if (!capturedOn) {
    throw new Error("recordCapture requires capturedOn (YYYY-MM-DD)");
  }
  const schemaVersion = latestVersion(schemaId);
  assertValid(schemaId, schemaVersion, doc); // throws on invalid
  const id = crypto.randomUUID();
  enqueueOp("capture_insert", {
    id,
    schemaId,
    schemaVersion,
    capturedOn,
    subjectType,
    subjectId,
    doc,
    supersedes,
  });
  return id;
}

export async function readCaptures(schemaId, filter = {}) {
  const { subjectType, subjectId, fromDate, toDate } = filter;
  let q = supabase
    .from("captures")
    .select(CAPTURE_COLS)
    .eq("schema_id", schemaId);
  if (subjectType) q = q.eq("subject_type", subjectType);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (fromDate) q = q.gte("captured_on", fromDate);
  if (toDate) q = q.lte("captured_on", toDate);
  q = q.order("captured_on", { ascending: false });

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    doc: applyUpcasters(schemaId, r.doc, r.schema_version),
  }));
}
