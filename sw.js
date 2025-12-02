
const CACHE_NAME = 'invest-portfolio-cache-v1.7.1';
const RUNTIME_CACHE = 'runtime-cache-v1.7.1';

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
        // Cache files individually so one failure doesn't break the whole SW
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) {
      return; 
  }

  // API calls shouldn't be cached by SW
  if (url.pathname.startsWith('/api') || url.pathname.includes('brapi') || url.pathname.includes('generativelanguage')) {
      return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache JS, CSS, JSON and Images dynamically
        if (
            url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|json)$/) || 
            url.pathname.includes('/assets/')
        ) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      }).catch(err => {
          // If offline and no cache, just return nothing or a fallback if implemented
          console.debug('Fetch failed:', err);
      });
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim());
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
