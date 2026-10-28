import { appViteConfig } from "@maat-apps/config/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";

// React, the PWA (src/sw.ts), the GitHub Pages 404 fallback, the base path
// (DEPLOY_BASE_PATH — a PR preview builds under /routines/pr-<n>/ — else
// /routines/) and the @ alias are @maat-apps/config's. Tailwind runs from
// postcss.config.mjs here.
export default defineConfig(
  appViteConfig({
    name: "routines",
    root: import.meta.dirname,
    tailwind: false,
    plugins: [
      // Opt-in bundle breakdown: `npm run build:analyze` opens a treemap of
      // dist/assets after the build finishes.
      !!process.env.ANALYZE &&
        visualizer({
          filename: "dist/stats.html",
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
    ],
  }),
);
