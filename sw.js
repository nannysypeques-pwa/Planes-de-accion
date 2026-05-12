const CACHE_NAME = 'sistema-interno-v2';
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

// --- FIREBASE MESSAGING ---
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBUJPgPxWrAp5oBtQJagfwIfvswxgAIxcI",
  authDomain: "gestor-de-actividades-3dae9.firebaseapp.com",
  projectId: "gestor-de-actividades-3dae9",
  storageBucket: "gestor-de-actividades-3dae9.firebasestorage.app",
  messagingSenderId: "796190828670",
  appId: "1:796190828670:web:8c6a1ce546c64cc437102f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Mensaje en segundo plano recibido:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: './logo-sin-fondo.png',
    badge: './logo-sin-fondo.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data ? event.notification.data.url : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
