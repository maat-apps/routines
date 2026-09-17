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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Scoped to pure-logic lib/ code — no React involved on this branch.
      // src/hooks/ needs @testing-library/react (a separate branch/track),
      // and views/components are e2e's territory (see
      // .claude/tasks/features/e2e-user-flow-tests.md) — including either
      // here would just show a permanently low number for code this suite
      // was never meant to exercise.
      include: ["src/lib/**/*.ts"],
      thresholds: {
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 75,
      },
    },
  },
});
