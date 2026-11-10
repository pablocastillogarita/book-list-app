// Service worker: permite abrir la app instalada sin conexión.
// Primero intenta la red (así un cambio nuevo se ve enseguida) y si no hay conexión usa la copia guardada.
// Los EPUB se guardan solo después de descargarlos una vez.
const CACHE = "mis-libros-v2";
const FILES = ["./", "index.html", "libros.js", "palabras.js", "pwa.js", "manifest.webmanifest",
  "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const key = req.mode === "navigate" ? "./" : req;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(key, copy));
    }
    return res;
  }).catch(() => caches.match(key, {ignoreSearch: true}).then(hit => hit || Response.error())));
});
