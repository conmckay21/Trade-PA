const CACHE = "trade-pa-v3";

const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  // Take control immediately — don't wait for old SW to finish
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Delete ALL old caches
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always network for API calls — never cache these
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("anthropic") ||
    url.hostname.includes("openai") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("fonts")
  ) {
    return;
  }

  // NEVER cache HTML — always get fresh from network
  if (e.request.destination === "document" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for icons only
  if (url.pathname.endsWith(".png") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".ico")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        return cached || fetch(e.request).then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Network-first for JS, CSS — get fresh, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
