const CACHE_NAME = "inventario-pro-v1";
const urlsToCache = [
  "/",
  "/dashboard",
  "/products",
  "/movements",
  "/analytics",
  "/export",
  "/warehouses",
  "/suppliers",
  "/categories",
  "/stock",
  "/kardex",
  "/customers"
];

// Instalar el service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Interceptar requests
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - devolver respuesta
      if (response) {
        return response;
      }

      return fetch(event.request).then((response) => {
        // Verificar si recibimos una respuesta válida
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clonar la respuesta
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});