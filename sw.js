// Cache-first offline shell. Bump CACHE whenever any file below changes.
var CACHE = 'stock-v9';
var FILES = ['./', 'index.html', 'style.css', 'app.js', 'logic.js', 'store.js', 'export.js',
  'gate.js', 'data.enc.json', 'vendor/xlsx-js-style.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  // cache:'reload' bypasses the HTTP cache so a new version never stores stale files.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error(f + ' ' + r.status);
        return c.put(f, r);
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('stock-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
