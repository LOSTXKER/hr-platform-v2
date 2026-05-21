// HR Platform v2 — Service Worker (Sprint 1.5 minimal)
// - Precaches app shell
// - Network-first for API + HTML, falls back to cache when offline
// - Handles Web Push notifications + click → open URL
// - No IndexedDB offline queue yet (Sprint 1.6 follow-up)

const CACHE_NAME = "hr2-v1";
const APP_SHELL = ["/", "/dashboard", "/login", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first, fall back to cache when offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache successful navigation/static responses
        if (res.ok && (req.mode === "navigate" || url.pathname.startsWith("/_next/static"))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});

// Web Push
self.addEventListener("push", (event) => {
  let data = { title: "HR Platform v2", body: "", url: "/dashboard" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url },
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus().then((c) => c.navigate(url));
      }
      return self.clients.openWindow(url);
    })
  );
});
