import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves no server-side rewrites, so a hard refresh or deep link
// to a client-routed path (e.g. /routines/routine) 404s unless something
// static exists there. Pages falls back to /404.html for any unresolved
// path, so shipping a copy of the SPA shell under that name lets React
// Router pick up the real route once the app boots.
function spaFallback(): Plugin {
  return {
    name: "spa-fallback-404",
    apply: "build",
    closeBundle() {
      const outDir = resolve(import.meta.dirname, "dist");
      writeFileSync(
        resolve(outDir, "404.html"),
        readFileSync(resolve(outDir, "index.html")),
      );
    },
  };
}

// Base path is normally the site root ("/routines/"), but a PR preview
// build (see .github/workflows/deploy-preview.yml) publishes under its own
// subpath ("/routines/pr-<n>/") so it can live alongside main's deployment
// on the same GitHub Pages site instead of overwriting it.
const base = process.env.DEPLOY_BASE_PATH ?? "/routines/";

export default defineConfig({
  base,
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // The app registers the worker itself (see src/components/mobile-gate.tsx),
      // mirroring the previous hand-written public/sw.js setup.
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
      // sw.js only exists after `vite build`; mobile-gate.tsx only registers it
      // in production builds (see the import.meta.env.PROD guard there), so no
      // dev-mode worker is needed here.
      devOptions: {
        enabled: false,
      },
    }),
    spaFallback(),
    // Opt-in bundle breakdown, same "not always on" shape as the old
    // @next/bundle-analyzer setup: `npm run build:analyze` opens a treemap
    // of dist/assets after the build finishes.
    !!process.env.ANALYZE &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ],
});
