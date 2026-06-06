const CACHE_NAME = "fantachat-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Lasciamo che Next/Vercel gestiscano normalmente le richieste.
  // Questo SW serve soprattutto a rendere installabile la PWA.
  event.respondWith(fetch(event.request));
});
