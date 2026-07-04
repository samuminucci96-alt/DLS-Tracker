const CACHE  = 'dls-tracker-v32';
const STATIC = ['./index.html', './pokemon-sets.js', './onepiece-sets.js', './riftbound-sets.js', './logo.png', './pikachu-tab.png', './manifest.json', './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png', './apple-touch-icon.png'];

// Logo e icone: sempre rete prima (evita PWA con icona/logo vecchi in cache)
const NETWORK_FIRST = ['logo.png', 'icon-192.png', 'icon-512.png', 'icon-192-maskable.png', 'icon-512-maskable.png', 'apple-touch-icon.png'];

function isNetworkFirst(url) {
  return NETWORK_FIRST.some(name => url.pathname.endsWith(name));
}

// ── Install: cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls (PokéTCG, CardTrader, Netlify Functions) → Network only, no cache
  if (url.hostname.includes('pokemontcg.io') ||
      url.hostname.includes('cardtrader.com') ||
      url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell / HTML → Network first, then cache.
  if (e.request.mode === 'navigate' ||
      e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Logo e icone → Network first
  if (isNetworkFirst(url)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Altri static assets → Cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
