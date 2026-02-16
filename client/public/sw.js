const SHELL_CACHE_NAME = 'agenda-shell-v1';
const OFFLINE_FALLBACK_URLS = ['/', '/index.html', '/esg.webp'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_FALLBACK_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('agenda-shell-') && cacheName !== SHELL_CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiRequest = url.pathname.startsWith('/api/');
  const isHealthRequest = url.pathname === '/health';

  if (!isSameOrigin || isApiRequest || isHealthRequest) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE_NAME);
      const cachedResponse = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      if (cachedResponse) {
        networkFetch.catch(() => null);
        return cachedResponse;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) {
        return networkResponse;
      }

      if (request.mode === 'navigate') {
        const offlineIndex = await cache.match('/index.html');
        if (offlineIndex) {
          return offlineIndex;
        }
      }

      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })()
  );
});
