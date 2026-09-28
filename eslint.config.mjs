import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "prettier/prettier": "error",
    },
  },
  {
    files: ["src/sw.ts"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Node-run scripts: root config files and the Claude Code hook scripts.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
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
  globalIgnores(["dist/**", "build/**", ".claude/worktrees/**"]),
]);

export default eslintConfig;
