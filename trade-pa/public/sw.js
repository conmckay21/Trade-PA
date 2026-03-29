const CACHE = "trade-pa-v1";

// Core files to cache for offline shell
const PRECACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API calls, cache-first for assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always go network for Supabase, Anthropic, OpenAI
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("anthropic") ||
    url.hostname.includes("openai") ||
    url.hostname.includes("googleapis")
  ) {
    return;
  }

  // Cache-first for static assets
  if (
    e.request.destination === "image" ||
    e.request.destination === "font" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        return cached || fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Network-first for everything else (JS, HTML, API)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
