/* Drop service worker — app-shell cache, relative scope for GitHub Pages subpaths. */
const CACHE = 'drop-v8';
const SHELL = ['./', './index.html', './scan.html', './manifest.webmanifest'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(()=>self.skipWaiting()).catch(()=>{}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only handle same-origin; let CDN + Nostr relays pass through.
  if (url.origin !== self.location.origin) return;
  // JS is network-first, never cached: stale app.js is the #1 cause of
  // "share doesn't work" after a deploy. Shell HTML stays cache-first.
  if (url.pathname.endsWith('.js')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  e.respondWith(
    caches.match(request, { ignoreSearch: false }).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(()=>{});
          }
          return res;
        }).catch(() => caches.match('./index.html'))
    )
  );
});
