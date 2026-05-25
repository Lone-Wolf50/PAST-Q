self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only handle standard HTTP/HTTPS GET requests.
  // This completely avoids errors with chrome-extension://, data:, blob:, and ws:// protocols.
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Simple pass-through fetch. The browser handles the request via the standard network.
  // This satisfies PWA installability requirements without interfering with client-side routing.
  event.respondWith(fetch(event.request));
});
