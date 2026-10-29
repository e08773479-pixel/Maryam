"use strict";

const MEKA_CACHE_NAME = "meka-static-v1";

const MEKA_STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./logo.svg",
  "./icon.svg"
];

/* Install: cache the application shell */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(MEKA_CACHE_NAME)
      .then(cache => cache.addAll(MEKA_STATIC_FILES))
      .catch(error => {
        console.warn(
          "[MEKA SW] Some files could not be cached:",
          error
        );
      })
  );

  self.skipWaiting();
});

/* Activate: remove outdated MEKA caches */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("meka-static-") &&
            key !== MEKA_CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

/* Fetch: use cached static files, network for everything else */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache authentication, API, database, or realtime requests.
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("/rest/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("/storage/") ||
    url.pathname.includes("/realtime/")
  ) {
    return;
  }

  // Only handle requests within the application directory.
  if (!url.pathname.startsWith(
    new URL("./", self.location.href).pathname
  )) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (
          response &&
          response.ok &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          caches.open(MEKA_CACHE_NAME).then(cache => {
            cache.put(request, copy).catch(() => {});
          });
        }

        return response;
      });
    }).catch(async () => {
      if (request.mode === "navigate") {
        return (
          await caches.match("./index.html") ||
          Response.error()
        );
      }

      return Response.error();
    })
  );
});
