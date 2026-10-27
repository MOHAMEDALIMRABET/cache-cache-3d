// Service worker : rend le jeu installable et jouable en solo sans connexion.
// Réseau d'abord (toujours la dernière version), copie en cache si hors ligne.
const CACHE = 'cache-cache-3d-v1';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest', 'firebase-config.js', 'vendor/three.module.js',
  'js/main.js', 'js/characters.js', 'js/world.js', 'js/net-room.js', 'js/net-firebase.js', 'shared/core.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Firebase, polices : pas de cache
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
