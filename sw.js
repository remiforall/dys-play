/**
 * Dys-Play - Service Worker vanilla
 * Mode offline complet, zéro dépendance CDN
 */

const CACHE_VERSION = 34;
const STATIC_CACHE = `dys-play-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dys-play-dynamic-v${CACHE_VERSION}`;

// Shell applicatif (~50 Ko gzip) — pré-caché à l'installation
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./accessibilite.html",
  "./aide.html",
  "./a-propos.html",
  "./theme-init.js",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./img/icon.svg",
  "./img/icon-192.png",
  "./img/icon-512.png",
  // Polices locales
  "./fonts/fonts.css",
  "./fonts/Luciole-Regular.woff2",
  "./fonts/Luciole-Bold.woff2",
  "./fonts/AtkinsonHyperlegible-Regular.woff2",
  "./fonts/AtkinsonHyperlegible-Bold.woff2",
  "./fonts/OpenDyslexic-Regular.woff2",
  "./fonts/OpenDyslexic-Bold.woff2",
  "./fonts/ComicNeue-Regular.woff2",
  "./fonts/ComicNeue-Bold.woff2",
  // Modules OCR (légers)
  "./ocr-config.js",
  "./ocr-zone-selector.js",
  "./ocr-validator.js",
  // Modules ESM OCR v2 (Sauvola + deskew, orchestration Tesseract v7)
  "./modules/image-preprocessor.js",
  "./modules/ocr-engine.js",
  // Note : libs/tesseract/ (~15 Mo : core WASM + traineddata) cachées on-demand
  // au premier usage, ou via le bouton « Scan hors-ligne » des réglages (OCR_OFFLINE_URLS)
];

// Scan hors-ligne opt-in (réglages) : moteur OCR + français (~9 Mo).
// EN/AR restent on-demand au premier usage.
const OCR_OFFLINE_URLS = [
  "./libs/tesseract/tesseract.esm.min.js",
  "./libs/tesseract/worker.min.js",
  "./libs/tesseract/tesseract-core-simd.wasm.js",
  "./libs/tesseract/tesseract-core-simd.wasm",
  "./libs/tesseract/langs/fra.traineddata",
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

  // Fichiers statiques (.css, .js, .woff2, .svg, .png, .wasm, .traineddata) : cache-first
  const isStatic = /\.(css|js|woff2?|svg|png|jpg|ico|wasm|traineddata)$/.test(
    url.pathname,
  );

  if (isStatic) {
    event.respondWith(
      // ignoreSearch : les assets sont demandés avec ?v=N (cache-busting) mais
      // pré-cachés sans query — le bump de CACHE_VERSION purge les anciens caches,
      // et stale-while-revalidate rafraîchit en arrière-plan
      caches.match(request, { ignoreSearch: true }).then((cached) => {
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

  // Mise en cache du moteur OCR pour le scan hors-ligne (opt-in réglages).
  // Progression envoyée fichier par fichier sur le port fourni.
  if (event.data && event.data.type === "CACHE_OCR") {
    const port = event.ports[0];
    event.waitUntil(
      caches.open(STATIC_CACHE).then(async (cache) => {
        try {
          for (let i = 0; i < OCR_OFFLINE_URLS.length; i++) {
            const url = OCR_OFFLINE_URLS[i];
            const already = await cache.match(url, { ignoreSearch: true });
            if (!already) await cache.add(url);
            if (port) {
              port.postMessage({
                type: "progress",
                done: i + 1,
                total: OCR_OFFLINE_URLS.length,
              });
            }
          }
          if (port) port.postMessage({ type: "done", success: true });
        } catch (err) {
          if (port) {
            port.postMessage({
              type: "done",
              success: false,
              error: String(err),
            });
          }
        }
      }),
    );
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
