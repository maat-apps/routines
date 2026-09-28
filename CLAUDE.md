# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Generic, ecosystem-wide rules live in maat-core and are not repeated here:

- [`STRUCTURE.md`](https://github.com/maat-apps/maat-core/blob/main/STRUCTURE.md)
  — design principles, folder layout, routing, i18n, conventions, branch
  naming, testing split, task tracking.
- [`docs/storage.md`](https://github.com/maat-apps/maat-core/blob/main/docs/storage.md)
  — the IndexedDB write-through pattern and WebAuthn PRF encryption this
  app implements.
- [`docs/testing-unit.md`](https://github.com/maat-apps/maat-core/blob/main/docs/testing-unit.md)
  and [`docs/testing-e2e.md`](https://github.com/maat-apps/maat-core/blob/main/docs/testing-e2e.md)
  — Vitest/Playwright conventions and traps. **Read these before touching
  tests.**
- [`VERIFICATION.md`](https://github.com/maat-apps/maat-core/blob/main/VERIFICATION.md)
  — why every check runs exactly once (CI), not locally too.

What follows is what's specific to routines.

## Commands

- `npm run dev` — Vite dev server, under `/routines/`.
- `npm run build` — `tsc -b && vite build` to `dist/`; also the deploy build.
  `npm run build:analyze` adds a `dist/stats.html` bundle treemap.
- `npm run lint` / `lint:fix` — ESLint (flat config). Prettier runs as an
  ESLint rule, so a formatting slip fails lint too.
- `npm run format:check` / `format` — Prettier.
- `npm run typecheck` — `tsc -b` (project references: `tsconfig.app.json`,
  `tsconfig.node.json`, `tsconfig.e2e.json`).
- `npm run test:unit` / `test:unit:watch` / `test:coverage` — Vitest; the
  coverage threshold is in `vitest.config.ts`.
- `npm run test:e2e` — Playwright against the production build;
  `test:a11y` runs only `e2e/a11y.spec.ts`; `test:e2e:report` opens the
  last report.
- `npm run test:lighthouse` — Lighthouse audit, separate project, never part
  of `test:e2e`/`validate`.
- `npm run validate` / `validate:fix` — lint + format:check + typecheck +
  test:coverage + test:e2e + build + `npm audit`; the same gates CI runs.

## Architecture

A private, phone-first PWA for daily checklists. No accounts, no backend —
everything lives in the browser and nothing about the user leaves the
device. The only network traffic is the service worker fetching the app's
own files. Product intent: `PRODUCT.md`.

- **Deploy and base path.** Static SPA on GitHub Pages. `vite.config.ts`
  takes `base` from `DEPLOY_BASE_PATH` (default `/routines/`). Every
  absolute in-app URL (SW registration, router `basename`, `sw.ts`'s
  precache/fallback paths) reads `import.meta.env.BASE_URL` — never
  hardcode `/routines/`. Exception: `public/manifest.json` (copied as-is),
  so a PR preview is viewable but not installable as its own PWA.
  - Pages has no rewrites: a `closeBundle` plugin copies `index.html` to
    `dist/404.html` so deep links boot the app (untested under a preview
    subpath).
  - PR previews: `deploy-preview.yml`, dispatched manually with the PR
    number, builds to `/routines/pr-<n>/`; `pr-preview-cleanup.yml` removes
    it on PR close. Both share one Pages site with `cd.yml` via the
    `pages-content` storage branch (not itself the Pages source).

- **Storage** (pattern: maat-core `docs/storage.md`). The plumbing comes
  from [`@maat-apps/core`](https://github.com/maat-apps/maat-core/tree/main/packages/core);
  routines' `src/lib/` modules are thin wrappers that keep their own
  exports (tests import those, not core): `idb-store.ts` (`/storage`, the
  `"routines"` database) under `storage.ts` (routines/progress),
  `locale-store.ts` (`/locale`), `settings.ts` (`/persisted`: lock
  enrolment, installed flag) and `app-update.ts` (`/update`: pre-update
  snapshot, the one async API). Tests that need a failing read/write spy
  on `keyValueStore`'s `get`/`set`, which is what the wrappers call.
  Routines-specific:
  - **Daily reset is a side effect of reading**: `storage.ts`'s
    `normalizeState` clears a routine's checked steps when its
    `lastResetDate` isn't today. There's no scheduled job.
  - `AppLockGate` gates on `useSettingsReady()` (`src/hooks/use-store.ts`)
    and renders nothing until settings have loaded.
  - Every storage key is in `src/lib/storage-keys.ts`; types come from
    `src/lib/schemas.ts`.
  - `storage.ts` depends on `settings.ts` in one place: when the enrolled
    lock encrypts, its background load waits for the key.
  - `src/app/app.tsx` calls `navigator.storage.persist()` once.

- **Legacy localStorage migration.** `idb-store.ts` passes it to core's
  store as `onCreate` (first database creation only): copies the four
  `storage-keys.ts` keys from `localStorage` into IndexedDB, then clears
  them once the database has opened. A corrupt value is skipped, not
  fatal. Every key was `JSON.stringify`'d except `LOCALE_KEY`, a bare
  string (`"pl"`/`"en"`), which the migration special-cases. Routines-only
  — new apps have nothing to migrate.

- **App lock + encryption.** `@maat-apps/ui`'s `MobileGate` wraps the app;
  inside it `src/components/app-lock-gate.tsx` requires a WebAuthn
  platform-authenticator prompt when the lock is on. Unlocked state is
  per-session memory in `src/lib/app-lock.ts`; enrolling counts as
  unlocked.
  - `LockEnrolment.encryptionSupported` decides the mode, set at enrolment
    from PRF support (`src/lib/webauthn-crypto.ts`). With PRF, an AES-GCM
    key is handed to `storage.ts`/`app-update.ts` via `setEncryptionKey`
    and `routines-data` is encrypted. Without PRF the lock is a UI gate
    only, and Settings says so (`appLockNotice` vs.
    `appLockEncryptedNotice`). This split is intentional — don't change it
    without the owner's decision.
  - **Never change `HKDF_INFO` (`"routines-data-v1"`)** in
    `webauthn-crypto.ts` — the one routines-specific input to core's
    `deriveKey`; changing it makes all existing encrypted data unreadable.
  - The lock itself (`app-lock.ts`, `app-lock-gate.tsx`) is still
    routines-only, not in core — see maat-core#61.
  - Escape hatch when the authenticator fails: `disableAppLock()` (nothing
    encrypted, or key still in memory) vs. `disableAppLockAndEraseData()`
    (ciphertext is unrecoverable, so it warns then wipes — the
    `confirmErase` step).
  - `enrolAppLock()` runs a second WebAuthn ceremony right after creating
    the credential, to obtain the PRF secret.

- **Service worker.** `src/sw.ts` is the vite-plugin-pwa `injectManifest`
  entry calling core's `registerAppWorker` (`/sw`): precache, network-first
  navigations and `manifest.json`, cache-first assets. Bump its `cacheName`
  when the shell changes. Registered in `app.tsx`, production builds only.
  Settings' "Update app" (`src/lib/app-update.ts`, core's `updateApp`)
  backs up, drops every cache, activates the waiting worker, reloads.

- **Backup + settings.** `src/lib/backup.ts` writes routines, progress and
  language to versioned JSON and validates imports through the same
  schemas as storage read-back (`parseRoutines`/`parseState`, per entry).
  `src/lib/settings.ts` also holds an `installed` flag, set once
  `useInstallPrompt` sees standalone mode or `appinstalled` — Chrome stops
  firing `beforeinstallprompt` after install, so this is how a browser tab
  can still say "Already installed". `resetPreferences` clears preferences
  only; callers must reload.

- **Routing.** `<BrowserRouter basename="/routines">`: `/` → `/:id` →
  `/:id/edit`, `/` → `/new`, plus `/all-routines` (reached from a Settings
  row; home only lists routines active today, `isRoutineActiveToday`).
  `new-routine-view.tsx`'s onComplete replaces the `/new` entry instead of
  `useSmartBack` — creating is a forward transition. Settings is a drawer,
  not a route: `src/views/home/settings-panel.tsx` composes one
  `settings-<name>-section.tsx` per card.

- **i18n.** `src/i18n/use-translation.ts` (core's `createTranslation` over
  `locale-store.ts`); choice remembered under `routines-locale`. Catalogs
  `src/i18n/en.json` and `pl.json` — `t()` only accepts keys present in
  both, so keep them in sync. Dates via `Intl.DateTimeFormat`.

- **UI.** shadcn `base-nova` (`rsc: false`) on `@base-ui/react`; every
  shared component — Button, Input, Switch, Textarea, Drawer,
  ConfirmDrawer, AppBar, MobileGate, … — comes from `@maat-apps/ui`, with no
  local `src/components/ui/` copies. `src/app/globals.css`'s `@source` must
  cover the package's compiled output, or its classes get purged.
  Drag-to-reorder lists (routines on home, steps in the edit form) use the
  package's `SortableList`: routines as `SortableListRow`s,
  steps as `SortableStepRow` built on `useSortableItem`; "all routines" uses
  `ListRow`. Row content (`RoutineRowContent`) stays here. Tailwind v4,
  tokens in `globals.css`, Phosphor icons, self-hosted
  `@fontsource-variable/outfit`. Accent is neutral **white** on dark
  surfaces; the old coral accent was removed on purpose — don't
  reintroduce it.

- **Tests** (conventions: maat-core `docs/testing-*.md`). Unit coverage
  covers `src/lib/**`, `src/hooks/**`, `src/i18n/**` at 95%; the test
  database is `"routines"`. E2E: `mobile-chromium` + `mobile-iphone`;
  `drawer-dismissal.spec.ts` (raw CDP) is excluded from `mobile-iphone`,
  `a11y.spec.ts` runs on chromium only. Lighthouse baseline: performance
  96, others 100; thresholds 85 / 100.

## Automation

| Purpose          | npm script              | Runs automatically via                                                      |
| ---------------- | ----------------------- | --------------------------------------------------------------------------- |
| Format           | `npm run format`        | PostToolUse hook, per edited file                                           |
| Lint (fix)       | `npm run lint:fix`      | PostToolUse hook, per edited file                                           |
| Typecheck        | `npm run typecheck`     | Stop hook, every turn, summary only                                         |
| Tests + coverage | `npm run test:coverage` | Stop hook, only when `src/`/`tests/` have uncommitted changes, summary only |

`.claude/hooks/session-validate.sh` runs both Stop checks; neither blocks
the turn. `test:e2e`, `build` and `npm audit` run in `ci.yml` on every PR.

## Workflow rules

- **Don't re-run checks locally** before committing or pushing — no
  format/lint/typecheck/build/test, via npm scripts or `tsc`/`eslint`/
  `vitest`/`playwright` directly, not even after a trivial fix. Hooks and
  CI cover it.
- **Never edit or commit on `main`**, not even docs. Branch
  `<type>/<slug>` with a Conventional Commits type (STRUCTURE.md's Branch
  naming), fresh per PR.
- Commit automatically when a task is done, then `/open-pr` (no local
  re-verification, no confirmation pause), and merge once CI is green —
  auto-merge is enabled here (maat-core `STRUCTURE.md`'s Claude Code
  workflow). `.claude/commands/{open-pr,pr-description}.md` and
  `.claude/skills/` are copies of maat-core's `configs/claude` standard:
  change them there first, then sync.
- Delete local branches once their PR is merged on GitHub (verify with
  `gh pr view`; use `-D` for squash merges).
- Add a new import in the same `Edit` as its first use — the
  PostToolUse `eslint --fix` strips an import that's unused in between.
- When a change touches what this file or README.md describes, update them
  in the same session.
- Stale-module/HMR errors after a branch switch: restart the dev server
  before assuming a regression.
- Work items are GitHub Issues (routines' own on this repo, ecosystem-wide
  on maat-core) — see STRUCTURE.md's Task tracking.
- Prefer `Grep`/`Glob` over reading whole files. For broad audits use
  `/find-antipatterns`; after a non-trivial session run `/learn-patterns`.
  Pattern log: `.claude/docs/patterns.md`.
