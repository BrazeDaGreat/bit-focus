/**
 * BIT Focus Service Worker
 *
 * Lets the installed app open and move between pages without a connection.
 * All data already lives in IndexedDB and localStorage, so the worker only
 * has to keep the app's own files available:
 *
 * - Pages: network first, falling back to the cached copy (then to Home).
 * - Hashed build assets (/_next/static): cache first — they never change.
 * - Other same-origin files: network first, cached copy when offline.
 * - API routes and other origins: never touched.
 *
 * On install every main page is fetched along with the build assets it
 * references, so pages you have not opened yet still work offline.
 */

const CACHE = "bitfocus-v2";

const PAGES = [
  "/",
  "/focus",
  "/focus-table",
  "/calendar",
  "/projects",
  "/rewards",
  "/changelog",
  "/excalidraw",
  "/account",
  "/ai",
  "/settings",
];

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
  "/bit_focus.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Build asset paths referenced by a page's HTML. */
function assetsIn(html) {
  const found = new Set();
  const re = /\/_next\/static\/[^"'\s)\\]+/g;
  let match;
  while ((match = re.exec(html))) found.add(match[0]);
  return [...found];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));

      const assets = new Set();
      await Promise.allSettled(
        PAGES.map(async (url) => {
          const response = await fetch(url, { credentials: "same-origin" });
          if (!response.ok) return;
          await cache.put(url, response.clone());
          for (const asset of assetsIn(await response.text())) assets.add(asset);
        })
      );
      await Promise.allSettled([...assets].map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/** Network first; store good responses; fall back to the cache. */
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (fallbackUrl && (await cache.match(fallbackUrl)));
    if (cached) return cached;
    throw error;
  }
}

/** Cache first for immutable build assets. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // React Server Component payloads for client-side navigation. When they
  // fail offline, Next.js falls back to a full navigation, which is served
  // from the page cache above.
  if (url.searchParams.has("_rsc")) return;

  event.respondWith(networkFirst(request));
});
