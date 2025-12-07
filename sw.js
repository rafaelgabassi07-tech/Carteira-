
const CACHE_NAME = 'invest-portfolio-cache-v3.0.0'; // Updated version bumped to v3 to force clean update
const RUNTIME_CACHE = 'runtime-cache-v3.0.0';

// Remove index.html from pre-cache to allow Network-First strategy to take precedence for the entry point
// This ensures that when the user opens the app, it checks the server for a new index.html (which contains new JS hashes)
const urlsToCache = [
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force activation immediately
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
        return; 
    }

    // 2. App Navigation & HTML: Network-first, fallback to cache for offline SPA support.
    // This is the CRITICAL fix for the "GitHub updates not showing" issue.
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            (async () => {
                try {
                    // Network First: Try to get the latest index.html from the server
                    const networkResponse = await fetch(event.request);
                    
                    // Update cache only if successful and valid
                    if (networkResponse && networkResponse.status === 200) {
                         const cache = await caches.open(CACHE_NAME);
                         cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    console.log('Fetch failed; returning offline page from cache.', error);
                    // Fallback to cache if offline
                    const cachedResponse = await caches.match(event.request); 
                    return cachedResponse || caches.match('/index.html') || caches.match('/');
                }
            })()
        );
        return;
    }

    // 3. Static Assets (JS, CSS, Images): Cache-first, fallback to network.
    // Since index.html is Network-First, it will request new JS filenames (hashes) when updated.
    // These new files won't be in cache, so they will be fetched from network and then cached.
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
