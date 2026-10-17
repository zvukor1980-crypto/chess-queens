// Cache names include the worker scope so other games on the same origin stay intact.
const PREFIX = 'cq-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + 'v5';
const ASSETS = ['./', './index.html', './style.css', './pieces.js', './chess.js', './engine.js', './engine-worker.js', './audio.js', './app.js',
  './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/favicon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, {ignoreSearch: true});
    const network = fetch(e.request).then(async response => {
      if (response.ok && response.type !== 'opaque' && !response.redirected) {
        await cache.put(e.request, response.clone());
      }
      return response;
    }).catch(() => hit || Response.error());
    e.waitUntil(network.then(() => undefined));
    return hit || network;
  })());
});
