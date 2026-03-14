// StreamFlex Service Worker v2.0
const CACHE_NAME = 'streamflex-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/script.js',
  '/style.css',
  '/firebase.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+JP:wght@300;400;700&family=Noto+Serif+JP:wght@400;700&display=swap'
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;
  if (event.request.url.includes('firestore.googleapis.com')) return;
  if (event.request.url.includes('themoviedb.org')) return;
  if (event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Background Sync ──────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'streamflex-sync') {
    event.waitUntil(
      // Retry any pending operations when back online
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
      })
    );
  }
});

// ── Periodic Background Sync ─────────────────────────────────
self.addEventListener('periodicsync', event => {
  if (event.tag === 'streamflex-periodic') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'PERIODIC_SYNC' }));
      })
    );
  }
});

// ── Push Notifications ───────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'StreamFlex';
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});