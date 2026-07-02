// liveDoc — pure logic for live HTML doc attachments (batch 42.8).
//
// An attached .html file opens inside the app in a SANDBOXED iframe
// (allow-scripts only — no same-origin, so the page can't reach the
// app's session or real storage). Before the page's own scripts run,
// an injected inline script swaps window.localStorage for the shim
// below, pre-seeded from attachment_doc_data rows; writes bridge out
// to the host via postMessage, and the host persists them per key.
// Per-KEY rows mean two people editing different keys never clobber
// each other; the advisory lock (lockState) covers the same-key case.

// A heartbeat older than this is an abandoned lock (closed lid, dead
// tab) and may be claimed by the other editor.
export const LOCK_STALE_MS = 90 * 1000;

// Who may write the doc right now. `lock` is the shaped
// attachment_doc_locks row (lockedBy, heartbeatAt) or null.
//   unlocked — no lock row; claimable.
//   mine     — I hold it (stale or not: my own lagging tab may resume).
//   theirs   — the other editor holds it, heartbeat fresh.
//   stale    — the other editor's heartbeat lapsed; claimable.
export function lockState(lock, { me, now = new Date() }) {
  if (!lock) return "unlocked";
  if (lock.lockedBy === me) return "mine";
  const beat = new Date(lock.heartbeatAt).getTime();
  return now.getTime() - beat > LOCK_STALE_MS ? "stale" : "theirs";
}

// A localStorage-shaped store over a plain object. This exact
// function is also serialized (Function.prototype.toString) into the
// injected script, so it must stay self-contained: no imports, no
// closure over module scope.
export function createStorageShim(seed, opts) {
  var data = {};
  for (var k in seed) if (seed[k] != null) data[k] = String(seed[k]);
  var onWrite = (opts && opts.onWrite) || null;
  var readOnly = !!(opts && opts.readOnly);
  return {
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key)
        ? data[key] : null;
    },
    setItem: function (key, value) {
      if (readOnly) return;
      data[key] = String(value);
      if (onWrite) onWrite(String(key), String(value));
    },
    removeItem: function (key) {
      if (readOnly) return;
      delete data[key];
      if (onWrite) onWrite(String(key), null);
    },
    clear: function () {
      if (readOnly) return;
      var keys = Object.keys(data);
      data = {};
      if (onWrite) keys.forEach(function (key) { onWrite(key, null); });
    },
    key: function (i) { return Object.keys(data)[i] ?? null; },
    get length() { return Object.keys(data).length; },
    // Host-pushed change (the other editor saved): update without
    // echoing a write back, then let the page notice via the event
    // the runtime dispatches.
    acceptExternal: function (key, value) {
      if (value == null) delete data[key];
      else data[key] = String(value);
    },
  };
}

// JSON that is safe INSIDE a <script> tag: "<" is escaped so no value
// can smuggle in a "</script>".
function scriptSafeJSON(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

// The injected runtime: installs the shim over window.localStorage,
// bridges writes out via postMessage ("nff-doc-write"), and accepts
// host pushes ("nff-doc-update") from the other editor's realtime
// saves — re-dispatched to the page as a "storage"-like event.
function shimRuntime(seedJSON, optsJSON) {
  return (
    "/* nff-live-doc-shim */\n" +
    "(function () {\n" +
    "var CFG = " + optsJSON + ";\n" +
    "var factory = " + createStorageShim.toString() + ";\n" +
    "var shim = factory(" + seedJSON + ", {\n" +
    "  readOnly: CFG.readOnly,\n" +
    "  onWrite: function (key, value) {\n" +
    "    parent.postMessage(\n" +
    "      { type: 'nff-doc-write', key: key, value: value }, '*');\n" +
    "  },\n" +
    "});\n" +
    "try {\n" +
    "  Object.defineProperty(window, 'localStorage', {\n" +
    "    value: shim, configurable: false, writable: false,\n" +
    "  });\n" +
    "} catch (e) { window.localStorage = shim; }\n" +
    "window.addEventListener('message', function (ev) {\n" +
    "  var m = ev.data;\n" +
    "  if (!m || m.type !== 'nff-doc-update') return;\n" +
    "  shim.acceptExternal(m.key, m.value);\n" +
    "  try {\n" +
    "    window.dispatchEvent(new StorageEvent('storage', {\n" +
    "      key: m.key, newValue: m.value,\n" +
    "    }));\n" +
    "  } catch (e) {}\n" +
    "});\n" +
    "parent.postMessage({ type: 'nff-doc-ready' }, '*');\n" +
    "})();\n"
  );
}

// Build the srcdoc: the shim script goes IMMEDIATELY after <head> (or
// at the very top of a headless fragment) so it runs before any page
// script can touch localStorage.
export function injectShim(html, seed, { readOnly = false } = {}) {
  const script =
    "<script>" +
    shimRuntime(
      scriptSafeJSON(seed ?? {}),
      scriptSafeJSON({ readOnly })
    ) +
    "</scr" + "ipt>";
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const at = headMatch.index + headMatch[0].length;
    return html.slice(0, at) + script + html.slice(at);
  }
  return script + html;
}
