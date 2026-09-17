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
      // Scoped to what unit tests are meant to cover — views/components are
      // e2e's territory (see .claude/tasks/features/e2e-user-flow-tests.md),
      // so including them here would just show a permanently low number for
      // code this suite was never meant to exercise.
      include: ["src/lib/**", "src/hooks/**"],
    },
  },
});
