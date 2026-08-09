// Service worker Star YeUv — stratégie "network first"
// L'app se met à jour automatiquement : le réseau est toujours prioritaire,
// le cache ne sert que de secours hors ligne.

const CACHE = 'staryeuv-v1';
const OFFLINE_FALLBACK = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/', OFFLINE_FALLBACK]))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ne jamais intercepter : requêtes non-GET, API externes (Firebase, Gemini, Giphy, Discord)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (chargement de page) : réseau d'abord
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(OFFLINE_FALLBACK, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(OFFLINE_FALLBACK))
    );
    return;
  }

  // Assets : réseau d'abord, cache en secours
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
