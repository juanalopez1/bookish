/* Bookish · service worker
   Para publicar una versión nueva: node subir-version.js  (sube VERSION acá y en app.js / index.html) */
const VERSION = "12";
const CACHE = "bookish-" + VERSION;
const SHELL = ["/", "/manifest.webmanifest", "/style.css?v=" + VERSION, "/app.js?v=" + VERSION, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  // No se activa sola: espera a que la persona toque "Actualizar".
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bookish-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Primero la red (así siempre llega lo último); si no hay conexión, lo guardado.
// La API nunca se guarda: los datos siempre vienen del servidor.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("/") : Response.error())),
      ),
  );
});
