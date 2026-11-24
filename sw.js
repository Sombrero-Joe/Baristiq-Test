// Cache names are isolated by the registered app scope. The same worker file
// can therefore be deployed to Laboratory and Test without sharing caches.
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const SCOPE_KEY = (SCOPE_PATH.split('/').filter(Boolean).pop() || 'root').toLowerCase();
const CACHE_PREFIX = `baristiq-${SCOPE_KEY}-`;
const LEGACY_CACHE_PREFIX =
  SCOPE_KEY === 'baristiq-laboratory' ? 'baristiq-lab-' :
  SCOPE_KEY === 'baristiq' ? 'baristiq-live-' :
  CACHE_PREFIX;
const CACHE_NAME = `${CACHE_PREFIX}v167`;
const APP_FILES = ['./', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key =>
          (key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX)) &&
          key !== CACHE_NAME
        ).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy))
            );
          }
          return response;
        })
        .catch(() => caches.match('./index.html').then(cached => cached || caches.match('./')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          );
        }
        return response;
      });
    })
  );
});
