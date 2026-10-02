/// <reference lib="webworker" />

// Entry for the built service worker. vite-plugin-pwa's injectManifest
// strategy compiles this file and substitutes `self.__WB_MANIFEST` with the
// content-hashed build assets; the worker itself (precache, network-first
// navigations, cache-first assets, gated skip-waiting) is
// @maat-apps/core/sw's registerAppWorker.

import { registerAppWorker } from "@maat-apps/core/sw";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

registerAppWorker(self, {
  // Bump whenever the app shell changes — activation deletes every other cache.
  cacheName: "routines-v8",
  manifest: self.__WB_MANIFEST,
  // Not a hardcoded "/routines/": a PR preview under "/routines/pr-<n>/"
  // precaches and falls back to its own shell.
  baseUrl: import.meta.env.BASE_URL,
});
