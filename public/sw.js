/**
 * GroundTruth Service Worker
 *
 * Caches three things:
 *   1. GET /api/events — network-first, with cache fallback for offline use
 *   2. App shell (HTML, JS, CSS) — stale-while-revalidate
 *   3. OSM map tiles — cache-first with 30-day TTL
 *
 * After the user opens the app once while online, the last known event state
 * is stored locally. Subsequent visits in Airplane Mode serve that cached
 * snapshot with a "last synced" timestamp shown in the UI.
 */

const APP_CACHE  = "groundtruth-app-v2";
const API_CACHE  = "groundtruth-api-v1";
const TILE_CACHE = "groundtruth-tiles-v1";

const TILE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
];

const APP_SHELL = ["/", "/report"];

// ── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([APP_CACHE, API_CACHE, TILE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ── Fetch routing ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // OSM tile requests → cache-first with TTL
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(handleTile(event.request));
    return;
  }

  // Local tile serving (offline map mode)
  if (url.pathname.startsWith("/tiles/")) {
    event.respondWith(handleTile(event.request));
    return;
  }

  // GET /api/events → network-first, serve cached snapshot when offline
  if (event.request.method === "GET" && url.pathname === "/api/events") {
    event.respondWith(handleEventsApi(event.request));
    return;
  }

  // All other API routes (POST /api/reports, /api/reasoning, etc.) → network only.
  // We don't cache these — mutations must reach the server.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // App shell (HTML, JS, CSS) → stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        if (res.ok) {
          caches
            .open(APP_CACHE)
            .then((cache) => cache.put(event.request, res.clone()));
        }
        return res;
      });
      return cached ?? network;
    })
  );
});

// ── /api/events handler ──────────────────────────────────────────────────────

async function handleEventsApi(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      // Save a timestamped copy so we can tell the UI how stale the data is
      const body = await response.clone().text();
      const toCache = new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-cached-at": String(Date.now()),
        },
      });
      await cache.put(request, toCache);
    }

    return response;
  } catch {
    // Network failed — try returning the last cached snapshot
    const cached = await cache.match(request);

    if (cached) {
      const body = await cached.text();
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-sw-cache": "true",
          "x-cached-at": cached.headers.get("x-cached-at") ?? String(Date.now()),
        },
      });
    }

    // Offline with no cache yet — return an empty but valid payload.
    // The UI will show a "connect once to cache" message instead of crashing.
    return new Response(
      JSON.stringify({
        events: [],
        lastUpdated: null,
        unanalyzedCount: 0,
        offline: true,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-sw-cache": "true",
          "x-sw-no-data": "true",
        },
      }
    );
  }
}

// ── OSM tile handler ─────────────────────────────────────────────────────────

async function handleTile(request) {
  const cache  = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    const cachedAt = cached.headers.get("x-cached-at");
    if (cachedAt && Date.now() - Number(cachedAt) < TILE_MAX_AGE_MS) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set("x-cached-at", String(Date.now()));
      const withTimestamp = new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      await cache.put(request, withTimestamp);
      return (await cache.match(request)) ?? response;
    }
    return response;
  } catch {
    // Network failed — serve stale tile if we have one
    if (cached) return cached;
    // Transparent 1×1 PNG placeholder so the map doesn't break
    return new Response(
      Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        ),
        (c) => c.charCodeAt(0)
      ),
      { headers: { "Content-Type": "image/png" } }
    );
  }
}
