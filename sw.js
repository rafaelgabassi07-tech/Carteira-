const CACHE_NAME = 'invest-portfolio-cache-v2.0.2'; // Bumped Version for update
const RUNTIME_CACHE = 'runtime-cache-v2.0.2';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg'
];

self.addEventListener('install', event => {
  // Activate the new service worker immediately for seamless automatic updates.
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip external requests not related to our assets
  if (!url.origin.includes(self.location.origin)) {
      return; 
  }

  // API calls shouldn't be cached by SW
  if (url.pathname.startsWith('/api') || url.pathname.includes('brapi') || url.pathname.includes('generativelanguage')) {
      return;
  }

  // Navigation Fallback (SPA Support for Offline)
  // If requesting a page (HTML), try network, then cache, then fallback to index.html
  if (event.request.mode === 'navigate') {
      event.respondWith(
          fetch(event.request)
              .catch(() => {
                  return caches.match(event.request)
                      .then(cachedResponse => {
                          if (cachedResponse) return cachedResponse;
                          // If not in cache, serve index.html (SPA Entry point)
                          return caches.match('./index.html');
                      });
              })
      );
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

// Listener to activate the new service worker was removed to restore automatic updates.