// ===========================================================
// 🧱 Fouquet’s Joy Suite — Service Worker v15.4
// Caching + Offline Mode + Safe Fetch (CORS-friendly)
// ===========================================================

const CACHE_NAME = "fouquets-suite-v15.4";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// === INSTALLATION : Préchargement du cache ===================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// === ACTIVATION : Nettoyage anciens caches ===================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// === FETCH : Gestion réseau + cache + CORS sécurisée =========
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // On ignore les requêtes de navigateur internes
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  // Pour les appels vers Google Apps Script (API externe)
  if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) {
    // CORS-safe: on ne met pas en cache les requêtes dynamiques
    event.respondWith(
      fetch(request).catch(() => {
        // Si échec réseau, réponse générique
        return new Response(JSON.stringify({
          status: "error",
          message: "Connexion à Google Apps Script impossible (hors ligne)"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // Pour les fichiers statiques de la PWA
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        // On met en cache les fichiers statiques
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }).catch(() => {
      // Fallback si aucune connexion et pas de cache
      if (request.destination === "document") {
        return caches.match("./index.html");
      }
      return new Response("⚠️ Mode hors-ligne : ressource non disponible", {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      });
    })
  );
});
