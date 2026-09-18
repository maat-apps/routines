/// <reference lib="webworker" />

// Source for the built service worker (public/sw.js under Next.js). vite-plugin-pwa's
// injectManifest strategy compiles this file and substitutes `self.__WB_MANIFEST`
// with the list of content-hashed build assets, which we then precache ourselves —
// everything past that point is unchanged from the previous hand-written worker.

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

const CACHE_NAME = "routines-v7";
// BASE_URL (not a hardcoded "/routines/") so a PR preview built under
// "/routines/pr-<n>/" (see vite.config.ts) precaches and falls back to its
// own shell instead of main's.
const BASE_URL = import.meta.env.BASE_URL;
const APP_SHELL = [BASE_URL];
const PRECACHE_URLS = self.__WB_MANIFEST.map((entry) =>
  typeof entry === "string" ? entry : entry.url,
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([...APP_SHELL, ...PRECACHE_URLS])),
  );
  // Deliberately no self.skipWaiting() here: a new worker installed while the
  // app is open in a tab must stay in the "waiting" state so that tab keeps
  // using its own already-loaded chunks. It only takes over once the app
  // sends SKIP_WAITING below, which Settings' "Update app" does after
  // warning the user and taking a backup — see src/lib/app-update.ts.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  // Safe now that skipWaiting is gated above: activate only runs once this
  // worker has actually won (the user triggered SKIP_WAITING, or no tab was
  // still using the previous worker), so claiming clients here doesn't yank
  // control out from under a tab that's mid-session on old chunks.
  self.clients.claim();
});

// Navigations go to the network first so a fresh deploy is picked up on the next
// launch; the cache is only the offline fallback. Everything else (Vite emits
// content-hashed asset URLs) can safely be served cache-first.
function networkFirst(request: Request): Promise<Response> {
  return fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .catch(() => undefined);
      }
      return response;
    })
    .catch(
      () =>
        caches
          .match(request)
          .then(
            (cached) => cached || caches.match(BASE_URL),
          ) as Promise<Response>,
    );
}

function cacheFirst(request: Request): Promise<Response> {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        if (!response.ok) return response;
        const copy = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, copy))
          .catch(() => undefined);
        return response;
      }),
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:")
    return;

  // Navigations, and manifest.json, go network-first: manifest.json is small
  // and — unlike Vite's content-hashed assets — never changes URL when its
  // content does, so cache-first would serve a stale icon/name/theme-color
  // indefinitely until an unrelated shell change happened to bump CACHE_NAME.
  event.respondWith(
    event.request.mode === "navigate" ||
      requestUrl.pathname === `${BASE_URL}manifest.json`
      ? networkFirst(event.request)
      : cacheFirst(event.request),
  );
});

// The settings screen asks the waiting worker to take over immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
