// Shared helpers for Storage-backed file attachments (the project-files
// bucket). The metadata lives in per-domain tables (project_attachments,
// event_attachments), but the object key is built the same way
// everywhere: <prefix>/<timestamp>-<sanitized filename>.

// Build a Storage object key. The filename is sanitized so an odd name
// can't break out of its prefix — every run of characters outside
// [A-Za-z0-9_.-] collapses to a single underscore, which in particular
// strips the slashes a "../" traversal would rely on. Dots and dashes
// are kept (harmless, and they preserve the file extension).
export function attachmentStoragePath({ prefix, fileName, timestamp }) {
  const safeName = String(fileName).replace(/[^\w.\-]+/g, "_");
  return `${prefix}/${timestamp}-${safeName}`;
}
