const CACHE_NAME = 'inventario-pro-v1';
const urlsToCache = [
  '/',
  '/dashboard',
  '/products',
  '/movements',
  '/analytics',
  '/export',
  '/warehouses',
  '/suppliers',
  '/categories',
  '/stock',
  '/kardex',
  '/customers',
  '/manifest.json'
];

// Instalar el service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - devolver respuesta
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Verificar si recibimos una respuesta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // IMPORTANTE: Clonar la respuesta. Una respuesta es un stream
            // y porque queremos que el navegador consuma la respuesta
            // así como el cache la consuma, necesitamos clonarla
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// Actualizar el service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Manejar notificaciones push (opcional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación del sistema de inventario',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver detalles',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/icon-192x192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Sistema de Inventario', options)
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // Abrir la aplicación
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});
