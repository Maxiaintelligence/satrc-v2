/**
 * SatRC V2.0 - Service Worker: Red Permanente (Network-Only)
 * Excluye explícitamente /api/ para garantizar nombres satelitales vivos.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Si es la llamada a la API que averigua el último GIF, va DIRECTO a la red viva
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Todo lo demás sigue política Network-Only
  event.respondWith(fetch(event.request));
});