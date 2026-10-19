// Cache names include the worker scope so other games on the same origin stay intact.
const PREFIX = 'cq-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + 'v6-fairy';
const ASSETS = ['./', './index.html', './style.css', './v2.css', './pieces.js', './chess.js', './engine.js', './engine-worker.js', './audio.js', './app.js',
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
  // HTML/JS/CSS: сначала сеть (чтобы обновления приходили сразу), офлайн — из кэша
  const fresh = e.request.mode === 'navigate' || /\.(?:html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, {ignoreSearch: true});
    if (hit && !fresh) return hit;
    try {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 4500);
      const response = await fetch(e.request, {cache: 'no-cache', signal: ctrl.signal}); clearTimeout(timer);
      if (response.ok && response.type !== 'opaque' && !response.redirected) await cache.put(e.request, response.clone());
      return response;
    } catch (err) {
      if (hit) return hit;
      if (e.request.mode === 'navigate') { const shell = await cache.match('./index.html'); if (shell) return shell; }
      return Response.error();
    }
  })());
});
