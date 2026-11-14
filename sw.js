/* IronStorm offline shell.
   Precache the static game, then serve assets cache-first and the shell
   network-first with a cache fallback. Supabase traffic is never cached. */

const CACHE = 'ironstorm-v9';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/menu.css',
  './styles/game.css',
  './styles/landing.css',
  './vendor/supabase.js',
  './js/app.js',
  './js/assets.js',
  './js/audio.js',
  './js/community.js',
  './js/config.js',
  './js/gamepad.js',
  './js/i18n.js',
  './js/ranked.js',
  './js/theater.js',
  './js/cosmetics.js',
  './js/game.js',
  './js/landing.js',
  './js/maps.js',
  './js/medals.js',
  './js/menu.js',
  './js/modes.js',
  './js/net.js',
  './js/progress.js',
  './js/rooms.js',
  './js/season.js',
  './js/social.js',
  './js/store.js',
  './js/tanks.js',
  './js/touch.js',
  './js/util.js',
  './assets/ui/favicon.svg',
  './assets/ui/icon-192.png',
  './assets/ui/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  // Sprites and icons never change: cache first.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Styles: stale-while-revalidate so a new build is picked up next visit.
  if (url.pathname.includes('/styles/')) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    );
    return;
  }

  // App shell: network first so updates land, cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
