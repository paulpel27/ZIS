/**
 * MedCore ZIS - PWA Service Worker
 * Handles offline assets caching and request interception.
 */

const CACHE_NAME = 'medcore-zis-v1';
const PRECACHE_ASSETS = [
  'index.html',
  'styles.css',
  'db.js',
  'app.js',
  'manifest.json',
  'logo.png',
  // Critical CDNs
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js'
];

// Install: Cache static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Static assets precaching...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Intercept requests & cache resources dynamically
self.addEventListener('fetch', event => {
  // Only handle HTTP/HTTPS (skip chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return from cache if found
        if (cachedResponse) {
          // Fetch updated version in the background (stale-while-revalidate)
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {/* Ignore background sync failures */});
            
          return cachedResponse;
        }

        // Otherwise fetch from network and cache dynamically
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Cache only valid GET requests
          if (event.request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }

          return response;
        });
      })
      .catch(() => {
        // Offline Fallback for Page routing
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      })
  );
});
