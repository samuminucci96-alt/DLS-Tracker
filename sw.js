const CACHE = 'dls-tracker-v35';

const PRECACHE = [
  './pokemon-sets.js',
  './onepiece-sets.js',
  './riftbound-sets.js',
  './logo.png',
  './pikachu-tab.png',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

// Se l'URL contiene uno di questi segmenti, il SW non interviene (return immediato).
const BYPASS_URL_HINTS = [
  '/api/',
  '/.netlify/functions/',
  'pokemontcg.io',
  'cardtrader.com',
];

const NETWORK_FIRST_FILES = [
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
  'apple-touch-icon.png',
  'pokemon-sets.js',
  'onepiece-sets.js',
  'riftbound-sets.js',
];

function shouldBypassServiceWorker(request) {
  if (request.method !== 'GET') return true;

  const href = request.url;
  if (BYPASS_URL_HINTS.some((hint) => href.includes(hint))) return true;

  const url = new URL(href);
  if (url.origin !== self.location.origin) return true;

  return false;
}

function isHtmlRequest(request, url) {
  return request.mode === 'navigate'
    || request.headers.get('accept')?.includes('text/html')
    || url.pathname === '/'
    || url.pathname.endsWith('.html');
}

function isNetworkFirstFile(url) {
  return NETWORK_FIRST_FILES.some((name) => url.pathname.endsWith(name));
}

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res.ok && request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
      }
      return res;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
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

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // API, auth, proxy giochi, host esterni → il browser gestisce la rete da solo
  if (shouldBypassServiceWorker(request)) return;

  const url = new URL(request.url);

  // HTML / navigazione → network first (fallback offline)
  if (isHtmlRequest(request, url)) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match('./index.html'))
      )
    );
    return;
  }

  // Logo, icone, liste set → network first con fallback cache
  if (isNetworkFirstFile(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Altri asset statici same-origin → cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return res;
      });
    })
  );
});
