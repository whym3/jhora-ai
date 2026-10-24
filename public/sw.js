// Offline support: every same-origin GET (app shell, scripts, ephemeris files)
// is served from the cache when present and refreshed in the background; on a
// cache miss it is fetched and stored. The atlas is cached separately.
const CACHE = 'jhora-web-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // the atlas has its own cache (PlaceSearch); keep one copy of its 64 MB
  if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range') || url.pathname.includes('/atlas/')) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    if (hit) { refresh.catch(() => {}); return hit; }
    return refresh;
  }));
});
