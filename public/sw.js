// Helm service worker.
//
// PR A scope (this file): minimal install/activate lifecycle so the app
// qualifies as a PWA (the browser will offer "Add to Home Screen" / "Install").
// No caching strategy is registered — Next.js + Vercel already handle
// static caching, and an opinionated cache here would mask deploys.
//
// PR B will extend this file with:
//   - self.addEventListener("push", ...)            // show notification
//   - self.addEventListener("notificationclick", ...) // deep-link on tap
//
// Keep this file tiny. Anything we cache wrong here, users have to
// reload twice to escape.

const SW_VERSION = "helm-sw-v1";

self.addEventListener("install", (event) => {
  // Activate this SW immediately on first install instead of waiting for
  // all open tabs to close. Safe because we don't pre-cache anything.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of any already-open pages so the SW is the network
  // intermediary right away (needed later for push events).
  event.waitUntil(self.clients.claim());
});

// No 'fetch' handler on purpose — passthrough to network is the default
// when no handler is registered. Some browsers require *a* fetch handler
// for installability; if Chrome ever complains, add a no-op handler:
//   self.addEventListener("fetch", () => {});
// Current Chrome/Safari does not require it.
