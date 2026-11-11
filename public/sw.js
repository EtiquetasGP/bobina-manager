self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Browser Print y las demás conexiones externas van directo desde la página.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(fetch(event.request));
});
