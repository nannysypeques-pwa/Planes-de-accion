const CACHE_NAME = 'sistema-interno-v1';
const ASSETS = [
  './',
  './index.html',
  './css/index.css',
  './js/app.js',
  './js/config.js',
  './js/utils.js',
  './js/services/FirebaseService.js',
  './manifest.json',
  './logo-sin-fondo.png'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache abierto exitosamente');
      return cache.addAll(ASSETS);
    })
  );
});

// Activar y limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Estrategia de Cache: Stale-while-revalidate para el Shell
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones de Firebase/Externos
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchedResponse = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });

      return cachedResponse || fetchedResponse;
    })
  );
});
