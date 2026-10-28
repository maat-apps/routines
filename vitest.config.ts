import { appVitestConfig } from "@maat-apps/config/vitest";
import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts so no build/PWA-style plugin
// ever runs during tests. @maat-apps/config's preset: jsdom, tests/unit/,
// one jsdom for every file (isolate: false — each file restores the
// globals it stubs and clears localStorage in beforeEach), the shared setup
// (fake IndexedDB, Testing Library cleanup) and 95% coverage of lib/,
// hooks/ and i18n/ — views are e2e's.
export default defineConfig(appVitestConfig({ root: import.meta.dirname }));
