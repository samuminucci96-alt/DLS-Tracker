const CACHE  = 'dls-tracker-v11';
const STATIC = ['./index.html', './pokemon-sets.js', './logo.png', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

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
  // Evita che PC e telefoni restino bloccati su una vecchia index.html.
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

  // Static assets → Cache first, then network
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
