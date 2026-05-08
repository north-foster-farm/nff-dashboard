// Service worker for North Foster Farm Admin.
//
// Scope:
// - PWA installability (manifest is referenced from index.html).
// - Push notifications for chore-run completions (Batch 11.3).
//
// We deliberately do NOT cache app shell here yet — that's the
// offline-tolerance work in Batch 33. This file owns push only.

self.addEventListener("install", (event) => {
  // Activate on first install without waiting for old SW pages to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push handler. Payload is a JSON string of:
//   { title, body, runId, blockName, kind: 'on_time' | 'overran' }
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "NFF", body: event.data?.text?.() ?? "" };
  }
  const title = payload.title || "NFF Admin";
  const opts = {
    body: payload.body || "",
    icon: "/logo.svg",
    badge: "/logo.svg",
    tag: payload.runId ? `run:${payload.runId}` : "run",
    renotify: false,
    data: payload,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

// Click handler: focus an open tab, otherwise open the dashboard.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/chores";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({
      type: "window", includeUncontrolled: true,
    });
    for (const client of all) {
      if (client.url.includes("/chores") && "focus" in client) {
        return client.focus();
      }
    }
    if (all[0] && "navigate" in all[0]) {
      try { await all[0].navigate(url); return all[0].focus(); }
      catch { /* fall through to openWindow */ }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(url);
    }
  })());
});
