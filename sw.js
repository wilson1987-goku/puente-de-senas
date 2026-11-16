// Guarda la app y el reconocimiento de manos en el dispositivo para que funcione sin conexion.
const CACHE = 'puente-senas-v4';
const FILES = ['./', 'index.html', 'reco.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png', 'fonts/bricolage.woff2', 'fonts/figtree.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const keep = r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; };
  // Los archivos pesados del detector no cambian: primero la copia guardada. Lo demas, primero la red.
  if (u.pathname.includes('/lib/') || u.pathname.endsWith('.mp4')) e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(keep)));
  else e.respondWith(fetch(e.request).then(keep).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
