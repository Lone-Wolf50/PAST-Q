self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  // Skip cross-origin requests and API calls
  if (event.request.url.includes('/api/')) {
    return;
  }
  if (event.request.mode == 'navigate') {
    return;
  }
  // For other requests, use a simple network-first or pass-through strategy
  // but avoid the redundant catch-retry which can cause double-failure logs
  event.respondWith(
    fetch(event.request).catch((err) => {
      // Only log if it's not a standard network failure
      console.warn('[SW] Fetch failed for:', event.request.url, err);
      throw err;
    })
  );
});
