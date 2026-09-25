/* StudyForge service worker — safe read-only offline mode.
   - Navigations: network-first, fall back to cached shell, then offline fallback.
   - _next/static + icons/manifest: cache-first.
   - /api/*: network-only (never serve or cache mutations/reads that must be fresh).
*/
const VERSION = "sf-v3-2";
const SHELL = ["/today", "/offline-fallback"];
const STATIC_CACHE = `sf-static-${VERSION}`;
const SHELL_CACHE = `sf-shell-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith("sf-") && k !== STATIC_CACHE && k !== SHELL_CACHE)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: always network (data trust first).
  if (url.pathname.startsWith("/api/")) return;

  // Static assets + icons: cache-first.
  if (url.pathname.startsWith("/_next/static") || /\.(png|ico|webmanifest|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((hit) => {
          const miss = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => hit);
          return hit || miss;
        })
      )
    );
    return;
  }

  // Navigations: network-first with cached-shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/offline-fallback"))
        )
    );
  }
});
