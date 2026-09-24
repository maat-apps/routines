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
      // views/components: those are e2e's territory (see
      // .claude/tasks/features/e2e-user-flow-tests.md) and would need
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
