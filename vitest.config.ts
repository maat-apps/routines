import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    // jsdom setup dominated CI time (11 files -> 11 fresh environments,
    // ~85% of the run). Tried pool: "vmThreads" first (Vitest's other
    // suggestion) but it runs jsdom inside a Node vm context, where
    // window.location is permanently non-configurable — breaks the
    // legitimate need to stub it in app-update.test.ts (any technique,
    // including vi.stubGlobal, hits the same "Cannot redefine property").
    // isolate: false reuses one plain jsdom instance across every file
    // instead (no vm wrapping), so location stays configurable. The
    // cross-file leakage that would otherwise risk (globals mutated in one
    // file bleeding into another) is already covered: every file that
    // stubs a global restores it in its own afterEach
    // (locale-store.test.ts, use-translation.test.ts, app-lock.test.ts,
    // use-install-prompt.test.ts, app-update.test.ts), and every file
    // clears localStorage in beforeEach.
    isolate: false,
    // fake-indexeddb (jsdom has no real IndexedDB) — installed once globally,
    // same reasoning as isolate: false above: it needs explicit per-test
    // cleanup (deleting the database), not per-file isolation.
    setupFiles: ["tests/unit/setup.ts"],
    // Several storage modules write to IndexedDB fire-and-forget, by design,
    // for UI responsiveness (see storage.ts/settings.ts/locale-store.ts).
    // Deleting the "routines" database between every test (needed so each
    // test's fresh module instance re-triggers idb-store.ts's one-time
    // localStorage migration, the same way a real first-ever launch would)
    // closes any connection still mid-write via its onversionchange handler.
    // A write that loses that race throws asynchronously, after its own test
    // already finished — this doesn't reflect a real bug (a real browser tab
    // never deletes-and-recreates its own database while it's using it), and
    // every test's actual assertions already pass regardless (198/198).
    // Chased this for several rounds (fixed-delay flushes, then polling for
    // the observable write) without eliminating it outright under isolate:
    // false's shared environment, where a stray rejection from any test can
    // surface at an unrelated later point — this is Vitest's own documented
    // escape hatch for exactly that class of noise, not a way to hide a
    // failing assertion.
    dangerouslyIgnoreUnhandledErrors: true,
    // Test files live under tests/unit/, mirroring src/'s structure, not
    // co-located with source — kept explicit rather than relying on
    // Vitest's default project-wide glob, so a stray *.test.ts dropped
    // somewhere else in src/ is simply never picked up.
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Scoped to pure-logic lib/ plus the hook/store-bridge and i18n
      // layers — restricted to these on purpose, not extended to
      // views/components: those are e2e's territory, and would need
      // @vitejs/plugin-react + .tsx test files, a separate, undecided step.
      include: ["src/lib/**/*.ts", "src/hooks/**/*.ts", "src/i18n/**/*.ts"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
