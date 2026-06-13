const CACHE_VERSION = 'pastq-cache-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches from previous versions
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS GET requests.
  // This completely avoids errors with chrome-extension://, data:, blob:, and ws:// protocols.
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Cache-first with network fallback — never lets the promise reject.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // Only cache successful, same-origin responses
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
        .catch(() => {
          // Network failed and nothing in cache — return a minimal offline response
          // instead of letting the promise reject (which causes blank screens).
          return new Response('', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
    }).catch(() => {
      // Cache API itself failed — fall back to plain network fetch
      return fetch(event.request).catch(() =>
        new Response('', {
          status: 503,
          statusText: 'Service Unavailable',
        })
      );
    })
  );
});
