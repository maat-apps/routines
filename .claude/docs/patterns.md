# Pattern Log

Maintained by `/find-antipatterns` and `/learn-patterns`. Not auto-loaded every session —
only those two commands read and update it. Items that recur 3+ times get promoted to a
one-line summary in `CLAUDE.md`'s Conventions section and removed from here.

## Good Patterns

- External-store modules (`storage.ts`, `settings.ts`, `locale-store.ts`) all share the same
  shape — a module-level `listeners` `Set` + lazy cached snapshot + an SSR-safe
  `typeof window === "undefined"` guard on every accessor:
  [src/lib/storage.ts:73](../../src/lib/storage.ts#L73),
  [src/lib/settings.ts](../../src/lib/settings.ts),
  [src/lib/locale-store.ts](../../src/lib/locale-store.ts). Confirmed 3+ times; already
  documented in CLAUDE.md's Architecture section.
- Daily reset is folded into the read path (`normalizeState`) rather than a scheduled job —
  every mutator calls it before touching state: [src/lib/storage.ts:97](../../src/lib/storage.ts#L97).
- shadcn UI primitives consistently use `cva` for variants + `data-slot` attributes:
  [src/components/ui/button.tsx:5](../../src/components/ui/button.tsx#L5).
- Tests for a module with module-level singleton state use `vi.resetModules()` + a dynamic
  `import()` per test, rather than exporting an internal reset hook just for testing — confirmed
  5 times: [tests/unit/lib/storage.test.ts](../../tests/unit/lib/storage.test.ts),
  `settings.test.ts`, `locale-store.test.ts`, `app-lock.test.ts`,
  [tests/unit/hooks/use-store.test.ts](../../tests/unit/hooks/use-store.test.ts). Already
  documented in CLAUDE.md's Architecture section.
- Every test that stubs/spies a global that's shared across the whole run (`vitest.config.ts`
  sets `isolate: false`) restores it in its own `afterEach` — `vi.stubGlobal` via
  `vi.unstubAllGlobals()`, `vi.spyOn` via `vi.restoreAllMocks()`, and the two are not
  interchangeable. Confirmed across 8 call sites in `tests/unit/`. Already documented in
  CLAUDE.md's Architecture section, including the one real bug this caused when a restore was
  missed.

## Anti-Patterns

- **Fixed, recurring workflow mistake (not app code):** adding an import and its first usage as
  two separate `Edit` calls lets the PostToolUse format/lint hook run `eslint --fix` in between,
  which strips the import as unused before the usage lands — causing a typecheck failure that
  then needs a third edit to fix. Hit 5+ times this session (`KeyboardSensor`,
  `restrictToParentElement`, `afterEach` in three different test files, `getServerStandaloneSnapshot`).
  Promoted to CLAUDE.md's Workflow Rules — always add a new import in the same `Edit` call as its
  first usage.
- Dead re-export: [src/lib/utils.ts](../../src/lib/utils.ts) is `export { cn } from "cn";`, but
  every actual usage (`src/components/ui/*.tsx`, 6 files) imports `cn` directly from the `cn`
  package instead of through this file — confirmed via repo-wide grep, the only reference to
  `@/lib/utils` anywhere is `components.json`'s `aliases.utils` field. 0% coverage because it's
  never executed, not undertested. Tracked as
  [.claude/tasks/features/align-cn-imports-with-utils.md](../tasks/features/align-cn-imports-with-utils.md)
  (gitignored, local only).
- Borderline size: [src/views/home/settings-panel.tsx](../../src/views/home/settings-panel.tsx)
  is 408 lines — worth a look next time it grows, not yet a real problem.

## Naming Conventions

- Filenames: kebab-case for everything (`.ts`/`.tsx` alike), including components — not
  PascalCase. Component names inside a file are still PascalCase
  (`routine-view.tsx` exports `RoutineView`).
- Named exports throughout; no framework here forces a default export (this is a Vite SPA, not
  Next.js — no `page.tsx`/`layout.tsx` special cases).
- Hooks (`use*`) live in `src/hooks/`, not colocated in `src/lib/` — `lib/` must stay free of
  `react`/`react-dom` imports: [src/hooks/use-store.ts](../../src/hooks/use-store.ts),
  [src/hooks/use-install-prompt.ts](../../src/hooks/use-install-prompt.ts).
- View-level UI lives in `src/views/<name>/`; `src/components/` is reserved for UI shared by 2+
  views (gates, `app-bar.tsx`, `ui/` primitives) — not a route-scoped `_components/` pattern
  (that was the pre-migration Next.js structure).
- Unit test files live under `tests/unit/`, mirroring `src/`'s structure
  (`tests/unit/lib/storage.test.ts` for `src/lib/storage.ts`), not co-located with source.
