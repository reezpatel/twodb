// TwoPin service worker. Present so the app is installable and the share
// target works offline-first; push notifications can be layered on later
// (see twochat's sw.js for the Web Push pattern).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch — no caching yet. Keeping a fetch handler is what makes
// Chrome treat the app as an installable, offline-capable PWA.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

