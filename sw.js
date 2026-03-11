const CACHE = 'pantry-v4';
const SHELL = [
  '/pantry/',
  '/pantry/index.html',
  '/pantry/app.js',
  '/pantry/db.js',
  '/pantry/realtime.js',
  '/pantry/style.css',
  '/pantry/config.js',
  '/pantry/views/list.js',
  '/pantry/views/pantry.js',
  '/pantry/views/meals.js',
  '/pantry/views/settings.js'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing Pantry service worker');
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating Pantry service worker');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-first for Supabase API calls — never cache these
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Stale-while-revalidate for shell files
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => null);
          return cached || fetchPromise;
        })
      )
    );
  }
});
