const CACHE_NAME = "usconstitution-v1";
const APP_SHELL = ["/", "/index.html", "/about.html", "/favicon.svg"];
const STATIC_DESTINATIONS = new Set(["script", "style", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  const isStaticAsset =
    STATIC_DESTINATIONS.has(request.destination) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".json") ||
    url.pathname === "/favicon.svg";

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cache.match("/index.html");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
