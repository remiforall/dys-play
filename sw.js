/**
 * Dys-Play - Service Worker vanilla
 * Mode offline complet, zéro dépendance CDN
 */

const CACHE_VERSION = 3;
const STATIC_CACHE = `dys-play-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dys-play-dynamic-v${CACHE_VERSION}`;

// Shell applicatif (~50 Ko gzip) — pré-caché à l'installation
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Polices locales
  "./fonts/fonts.css",
  "./fonts/OpenDyslexic-Regular.woff2",
  "./fonts/OpenDyslexic-Bold.woff2",
  "./fonts/ComicNeue-Regular.woff2",
  "./fonts/ComicNeue-Bold.woff2",
  // Modules OCR (légers)
  "./ocr-config.js",
  "./ocr-zone-selector.js",
  "./ocr-preprocessor.js",
  "./ocr-validator.js",
  // Note : libs/ (~5.5 Mo) cachées on-demand au premier usage
];

// Installation : pré-cache des fichiers statiques
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE_URLS).catch((err) => {
          console.error("Échec pré-cache, tentative individuelle:", err);
          return Promise.allSettled(
            PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})),
          );
        }),
      )
      .then(() => self.skipWaiting()),
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith("dys-play-") &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE,
            )
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch : stale-while-revalidate pour les fichiers locaux
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Uniquement les requêtes de même origine (zéro CDN)
  if (url.origin !== location.origin) return;

  // Fichiers statiques (.css, .js, .woff2, .svg, .png) : cache-first
  const isStatic = /\.(css|js|woff2?|svg|png|jpg|ico)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    );
    return;
  }

  // HTML et autres : network-first avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match("./index.html");
        });
      }),
  );
});

// Messages depuis l'application
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => {
          if (event.ports[0]) event.ports[0].postMessage({ success: true });
        }),
    );
  }
});
