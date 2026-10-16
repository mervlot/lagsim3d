/* Lagos Sim 3D service worker — versioned cache-first offline shell. */
const CACHE_PREFIX = 'lagos-sim-3d-';
const RUNTIME_SUFFIX = 'runtime';

function cacheNames(version) {
  return {
    shell: CACHE_PREFIX + version,
    runtime: CACHE_PREFIX + version + '-' + RUNTIME_SUFFIX,
  };
}

async function precache() {
  const response = await fetch('./sw-manifest.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('sw-manifest.json unavailable: ' + response.status);
  const manifest = await response.json();
  const names = cacheNames(manifest.version);
  const cache = await caches.open(names.shell);
  const urls = ['./', './index.html', ...manifest.files.filter((f) => !f.endsWith('.json'))];
  await cache.addAll([...new Set(urls)]);
  // Drop caches from older versions.
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith(CACHE_PREFIX) && !Object.values(names).includes(k))
      .map((k) => caches.delete(k))
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches
      .open(CACHE_PREFIX + 'active-runtime')
      .then((cache) =>
        cache.match(request, { ignoreSearch: true }).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              cache.put(request, copy);
            }
            return response;
          });
        })
      )
      .catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('./index.html').then((page) => page || Response.error());
        }
        return Response.error();
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
