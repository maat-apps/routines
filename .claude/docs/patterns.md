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
- **Duplicated date formatting:** `storage.ts`'s unexported `today()` and `backup.ts`'s
  `backupFileName()` each hand-build a zero-padded `YYYY-MM-DD` string from `Date` getters —
  same `padStart(2, "0")` logic, no shared helper:
  [src/lib/storage.ts:160](../../src/lib/storage.ts#L160),
  [src/lib/backup.ts:104](../../src/lib/backup.ts#L104). Small (3 lines), only 2 occurrences —
  worth a shared `formatDateStamp` if a third shows up, not urgent on its own.
- **e2e helper not in `e2e/utils.ts`:** `backup.spec.ts`'s local `openSettings(page)` wraps the
  settings-button click, but 7 other spec files inline that exact click instead of importing it:
  [e2e/backup.spec.ts:5](../../e2e/backup.spec.ts#L5),
  [e2e/settings.spec.ts:9](../../e2e/settings.spec.ts#L9),
  [e2e/a11y.spec.ts:80](../../e2e/a11y.spec.ts#L80),
  [e2e/all-routines.spec.ts:27](../../e2e/all-routines.spec.ts#L27),
  [e2e/app-lock.spec.ts:18](../../e2e/app-lock.spec.ts#L18),
  [e2e/drawer-dismissal.spec.ts:11](../../e2e/drawer-dismissal.spec.ts#L11). Should move to
  `e2e/utils.ts` per the Playwright-helpers convention below.
- **Hand-rolled trust-boundary validation instead of a Valibot schema:** two places validate
  external/storage-read-back data with hand-written `isRecord`/`typeof` checks rather than a
  schema in `src/lib/schemas.ts`, unlike `parseRoutines`/`parseState` right next to them:
  [src/lib/backup.ts:25](../../src/lib/backup.ts#L25) (the backup envelope's `app`/`version`/
  `exportedAt`/`locale` fields — has a comment explaining this split is deliberate, so may be
  intentional rather than a miss) and
  [src/lib/settings.ts:46](../../src/lib/settings.ts#L46) (`LockEnrolment` read back from
  IndexedDB via `parseLock` — no Valibot schema exists for it at all currently).

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
