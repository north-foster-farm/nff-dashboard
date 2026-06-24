// Lift a stored capture doc to the latest schema shape on read, so
// consumer code (dashboards, KPI math) only ever handles the current
// version. Upcasters are pure (n) -> (n+1) functions; the backward-compat
// lives here, in one tested chain, not scattered through the UI.
import { schemaEntry, latestVersion } from "./registry.js";

export function applyUpcasters(schemaId, doc, fromVersion, toVersion) {
  const target = toVersion ?? latestVersion(schemaId);
  if (fromVersion === target) return doc;
  const { upcasters } = schemaEntry(schemaId);
  let out = doc;
  for (let v = fromVersion; v < target; v++) {
    const up = upcasters[v];
    if (!up) {
      throw new Error(`Missing upcaster ${schemaId} v${v} -> v${v + 1}`);
    }
    out = up(out);
  }
  return out;
}
