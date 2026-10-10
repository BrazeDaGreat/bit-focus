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
 * On install every main page is fetched, plus every build asset listed in
 * `/sw-precache.js` (written by `scripts/generate-sw-precache.mjs` after
 * `next build`). Pages only reference their first-paint chunks, so without
 * that list anything loaded through `next/dynamic` or `import()` is missing
 * offline and the page crashes. Each build gets its own cache.
 */

try {
  importScripts("/sw-precache.js");
} catch {
  // No list (e.g. build ran without the script): fall back to scanning pages.
}

const PRECACHE = self.__BITFOCUS_PRECACHE || { version: "dev", assets: [] };
const CACHE = `bitfocus-${PRECACHE.version}`;

const PAGES = [
  "/",
  "/focus",
  "/focus-table",
  "/calendar",
  "/projects",
  "/notes",
  "/rewards",
  "/changelog",
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

/**
 * Store hashed build assets, a batch at a time. Files kept from an earlier
 * build are copied across instead of downloaded again — their names change
 * whenever their contents do.
 */
async function precacheAssets(cache, urls) {
  const BATCH = 24;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.allSettled(
      urls.slice(i, i + BATCH).map(async (url) => {
        const previous = await caches.match(url);
        if (previous) await cache.put(url, previous);
        else await cache.add(url);
      })
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)));

      const assets = new Set(PRECACHE.assets);
      await Promise.allSettled(
        PAGES.map(async (url) => {
          const response = await fetch(url, { credentials: "same-origin" });
          if (!response.ok) return;
          await cache.put(url, response.clone());
          for (const asset of assetsIn(await response.text())) assets.add(asset);
        })
      );
      await precacheAssets(cache, [...assets]);
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

  if (request.mode === "navigate" && url.pathname === "/account") {
    event.respondWith(Response.redirect(new URL("/settings#account", self.location.origin), 307));
    return;
  }

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
