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
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 75,
      },
    },
  },
});
