const CACHE_VERSION = 'pastq-cache-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches from previous versions and refresh open clients if stale caches existed
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      const oldCaches = cacheNames.filter((name) => name !== CACHE_VERSION);
      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
      if (oldCaches.length > 0) {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(
          windowClients.map((client) => {
            if ('navigate' in client && client.url) {
              return client.navigate(client.url).catch(() => undefined);
            }
            return Promise.resolve();
          })
        );
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS GET requests.
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Bypass service worker for localhost/dev servers, Vite module paths, /sw.js, and API calls.
  const url = new URL(event.request.url);
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first with cache fallback so updated app bundles are always served when online.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cachedResponse) =>
            cachedResponse ||
            new Response('', {
              status: 503,
              statusText: 'Service Unavailable',
            })
        )
      )
  );
});
