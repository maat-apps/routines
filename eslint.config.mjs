// Extends the shared base from @maat-apps/config. Add repo-specific
// overrides after baseConfig.
import { baseConfig } from "@maat-apps/config/eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  ...baseConfig,
  {
    files: ["src/sw.ts"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Generated shadcn primitives intentionally co-export variant helpers
    // (e.g. buttonVariants) alongside the component — not a fast-refresh
    // concern for files that are never edited by hand.
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // Claude Code worktrees each carry their own tsconfig, which makes
  // typescript-eslint fail every file with "multiple candidate TSConfigRootDirs".
  globalIgnores([".claude/worktrees/**"]),
]);
