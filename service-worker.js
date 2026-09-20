const cacheName = "stmarys-ondo-v1";
const appFiles = ["index.html", "account.html", "admin.html", "manifest.webmanifest", "image.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(appFiles)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== cacheName).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(cacheName).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
