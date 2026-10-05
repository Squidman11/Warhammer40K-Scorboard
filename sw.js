self.addEventListener('fetch', (event) => {
    // This can be empty for now just to pass installation requirements
    event.respondWith(fetch(event.request));
});
const CACHE_NAME = 'wh40k-tracker-v2';
const ASSETS_TO_CACHE = [
  'index.html',
  'script.js', // Make sure this matches your actual JS file name
  'style.css',  // Make sure this matches your actual CSS file name
  'manifest.json'
];

// 1. Install Event: Cache all essential layout and design assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching combat telemetry assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clear out older caching loops if you update your app
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Serve cached assets immediately when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cache match first, otherwise try standard network fetch
      return cachedResponse || fetch(event.request);
    })
  );
});
