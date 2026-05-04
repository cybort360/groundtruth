/**
 * GroundTruth Service Worker
 *
 * Caches two things:
 *   1. App shell (HTML, JS, CSS) — stale-while-revalidate
 *   2. OSM map tiles — cache-first with 30-day TTL
 *
 * After the user opens the app and browses the map area once, all
 * tiles are stored locally. Subsequent visits — including in Airplane
 * Mode — serve from the cache with no network needed.
 */

const APP_CACHE = "groundtruth-app-v1";
const TILE_CACHE = "groundtruth-tiles-v1";
const TILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TILE_HOSTS = ["tile.openstreetmap.org", "a.tile.openstreetmap.org", "b.tile.openstreetmap.org", "c.tile.openstreetmap.org"];

// App shell assets to precache on install
const APP_SHELL = ["/", "/report"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== TILE_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ── OSM tile requests → cache-first ──────────────────────────────────────
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(handleTile(event.request));
    return;
  }

  // ── Local tile serving (offline mode) ────────────────────────────────────
  if (url.pathname.startsWith("/tiles/")) {
    event.respondWith(handleTile(event.request));
    return;
  }

  // ── API calls → network-only (never serve stale data) ────────────────────
  if (url.pathname.startsWith("/api/")) {
    return; // let the browser handle normally
  }

  // ── App shell → stale-while-revalidate ───────────────────────────────────
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(APP_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return res;
      });
      return cached ?? network;
    })
  );
});

async function handleTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Check TTL stored in a custom header we add on write
    const cachedAt = cached.headers.get("x-cached-at");
    if (cachedAt && Date.now() - Number(cachedAt) < TILE_MAX_AGE_MS) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone and add our TTL header
      const headers = new Headers(response.headers);
      headers.set("x-cached-at", String(Date.now()));
      const tileWithTimestamp = new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await cache.put(request, tileWithTimestamp);
      // Return a fresh clone from the cache (the original body was consumed)
      return (await cache.match(request)) ?? response;
    }
    return response;
  } catch {
    // Network failed — serve stale cached tile if we have one
    if (cached) return cached;
    // Return a transparent 1x1 PNG as placeholder
    return new Response(
      Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), c => c.charCodeAt(0)),
      { headers: { "Content-Type": "image/png" } }
    );
  }
}
