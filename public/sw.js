/**
 * SatRC V2.0 - Service Worker: Red Permanente (Network-Only)
 * Garantiza la instalación como PWA sin almacenar pronósticos caducos en caché.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Estrategia estricta: todo va directo a la red viva
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});