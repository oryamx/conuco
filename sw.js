// Service worker: guarda la app en el teléfono para que abra sin internet.
// Los modelos de IA los guarda transformers.js en su propia caché ("transformers-cache").
const VERSION = 'conuco-v9';
const CDN = 'conuco-cdn';
const ARCHIVOS = [
  './', 'index.html', 'cooperativa.html', 'estilo.css', 'manifest.webmanifest', 'conuco.svg',
  'app.js', 'extract.js', 'clasificador.js', 'modelo_conuco.json', 'modelo_maiz.json', 'lexicon.js', 'store.js', 'asr-worker.js', 'cooperativa.js', 'seguridad.js', 'llamada.html', 'llamada.js',
  'transformers.min.js',
  'leaflet.js', 'leaflet.css', 'reportes_sinteticos.json',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('conuco-v') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Motor de IA desde el CDN: caché primero (así funciona en modo avión después de la primera vez).
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(CDN).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Red primero (para tener lo más nuevo), caché si no hay señal.
  e.respondWith(
    fetch(e.request).then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
