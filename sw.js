const CACHE = 'dls-tracker-v43';

// Solo asset statici per installabilità PWA.
// NESSUN fetch handler: API/login/ricerca/HTML passano dal browser
// (un fetch handler ha già bloccato i tap/ricerca nella PWA installata).
const PRECACHE = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './logo.png',
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch((err) => {
        console.warn('[SW] Precache parziale:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
