/* Service worker : rend l'app installable et utilisable hors-ligne.
   Bump CACHE à chaque mise à jour pour rafraîchir. */
const CACHE = 'seche-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './data/foods.js', './data/mealplan.js',
  './manifest.json', './icon.svg', './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // laisse passer les appels API (analyse photo)
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
