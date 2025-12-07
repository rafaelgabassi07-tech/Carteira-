
const CACHE_NAME = 'invest-portfolio-cache-v1.9.0'; // Bumped Version
const RUNTIME_CACHE = 'runtime-cache-v1.9.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('Opened cache');
        for (const url of urlsToCache) {
            try {
                await cache.add(url);
            } catch (error) {
                console.warn(`Failed to cache ${url}:`, error);
            }
        }
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
});

const API_HOSTS = ['brapi.dev', 'generativelanguage.googleapis.com'];

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. API calls are network-only and not handled by the SW.
    if (API_HOSTS.some(host => url.hostname.includes(host))) {
        return; // Let the browser handle the request.
    }

    // 2. App Navigation: Network-first, fallback to cache for offline SPA support.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    console.log('Fetch failed; returning offline page from cache.', error);
                    const cachedResponse = await caches.match('/index.html');
                    return cachedResponse;
                }
            })()
        );
        return;
    }

    // 3. Static Assets: Cache-first, fallback to network.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});


self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
