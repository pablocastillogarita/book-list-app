// Service worker: permite abrir la app instalada sin conexión.
// Primero intenta la red (así un cambio nuevo se ve enseguida) y si no hay conexión usa la copia guardada.
// Los EPUB se guardan solo después de descargarlos una vez.
// Las librerías de Firebase (para entrar con Google) se guardan la primera vez y después se usan
// desde la copia: así la sesión se reconoce aunque abras la app sin conexión.
const CACHE = "mis-libros-v4";
const FILES = ["./", "index.html", "libros.js", "palabras.js", "nube.js", "nube-config.js", "pwa.js", "manifest.webmanifest",
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
  if (req.method === "GET" && url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
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
