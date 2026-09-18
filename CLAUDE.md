# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design principles

This stack (and every app built on it) is guided by a few core goals. Keep
them in mind when writing or reviewing code:

- **Minimalism.** Prefer the simplest solution; avoid unnecessary
  abstractions, UI complexity, or dependencies.
- **Independence.** Avoid vendor/cloud lock-in — don't reach for a backend or
  third-party service where a local-first approach works.
- **Smallest possible runtime footprint.** Keep bundle sizes and components
  lightweight to reduce battery/resource usage on the user's device — e.g.
  prefer true black (`#000000`) backgrounds, which save power on OLED screens.
  This is about the shipped app's runtime behavior, not the footprint of
  building it — the project is developed with Claude Code, which has its own
  energy cost (see README's "Built with Claude"). The build/verify side of
  that cost is why CI runs each check exactly once instead of locally too
  — see the Automation section below.
- **Ease of use.** Favor solutions that keep the app simple and predictable
  for the user.
- **Accessibility.** Keep components accessible — semantic markup,
  keyboard/screen-reader support, sufficient contrast.

## Commands

- `npm run dev` — local dev server (Vite, serves under `/routines/`, see below).
- `npm run build` — `tsc -b && vite build`, output to `dist/`. This is also the
  deploy build.
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint.config.mjs`).
- `npm run format:check` / `npm run format` — Prettier. Prettier also runs _as an
  ESLint rule_ (`prettier/prettier: error`), so a formatting slip fails lint too.
- `npm run typecheck` — `tsc -b` (project references: `tsconfig.app.json` for
  `src/`, `tsconfig.node.json` for `vite.config.ts`, `tsconfig.e2e.json` for
  `e2e/` and `playwright.config.ts`).
- `npm run test:unit` / `npm run test:unit:watch` — Vitest, covering
  `src/lib/`, `src/hooks/`, and `src/i18n/`. `npm run test:coverage` runs
  the same suite with a coverage report and enforces the threshold in
  `vitest.config.ts`. See Architecture below.
- `npm run test:e2e` — Playwright, `e2e/`, against the real production
  build (`npm run build` + `vite preview`) rather than the dev server. See
  Architecture below.
- `npm run validate` — lint + format:check + typecheck + test:coverage +
  test:e2e + build + `npm audit`; the same gates CI runs. `npm run
validate:fix` applies the autofixable ones.
- `npm run build:analyze` — same production build, plus `dist/stats.html`, a
  `rollup-plugin-visualizer` treemap of what's inside each chunk (opens
  automatically). Wraps `npm run build` in `cross-env ANALYZE=1` so it works
  the same in PowerShell and bash; opt-in only — plain `npm run build` never
  runs it.

## Architecture

A private, phone-first PWA for daily checklists. No accounts and no backend —
everything lives in the browser, and nothing about the user leaves the device.
The only network traffic is the service worker fetching the app's own files.

- **Vite + base path, no server.** `vite.config.ts` sets `base` from
  `DEPLOY_BASE_PATH` (defaulting to `/routines/`, deployed to GitHub Pages
  under `/routines`) and builds a plain static SPA — no server at runtime.
  A PR preview build (the `preview`/`deploy` jobs in `validate.yml`, gated on
  `validate` itself passing) overrides it to `/routines/pr-<n>/` so an open PR
  can be checked on a phone under its own subpath alongside `main`'s
  deployment — see that workflow and `deploy.yml` for how both share one
  GitHub Pages site via a `pages-content` storage branch that isn't itself
  the Pages source. GitHub Pages has no server-side
  rewrites, so a hard refresh or deep link into a client-routed path would
  404; a `closeBundle` plugin in `vite.config.ts` copies the built
  `index.html` to `dist/404.html` after every build so Pages' 404 fallback
  boots the app instead (this 404 fallback is untested under a PR preview's
  subpath — GitHub Pages' behavior for a nested `404.html` isn't guaranteed
  the same way as one at the site root). Every absolute in-app URL (service
  worker registration in `mobile-gate.tsx`, the router's `basename`,
  `sw.ts`'s own precache/fallback paths) reads `import.meta.env.BASE_URL`
  rather than hardcoding `/routines/`, so both the real deploy and a preview
  resolve correctly. `public/manifest.json` is the one exception — its
  `start_url`/`scope`/icon paths stay hardcoded to `/routines/`, since it's a
  static file Vite copies as-is rather than rewriting; a PR preview is not
  expected to be independently installable as a scoped PWA, only viewable.

- **State = localStorage only.** `src/lib/storage.ts` is the single source of
  truth, persisting one JSON blob under the `routines-data` key. All reads go
  through `normalizeState`, which **resets each routine's checked steps when its
  `lastResetDate` is not today** — the daily-reset behavior is a side effect of
  reading, not a scheduled job. Every accessor is guarded for a non-browser
  environment (`typeof window === "undefined"` returns empty data), so first
  render is empty and real data appears after mount. Types in `src/types.ts`
  are inferred from the Valibot schemas in `src/lib/schemas.ts` (`v.InferOutput`)
  rather than hand-written in parallel, so the type and the runtime validator
  can't drift out of sync. Every localStorage key the app owns is declared in `src/lib/storage-keys.ts`
  — add new ones there so backup and reset stay in step. `lib/` never imports
  from `react`/`react-dom`; React hooks that wrap this state live in `src/hooks/`
  (`use-store.ts`, `use-install-prompt.ts`) instead.

- **Routing pattern.** `src/views/<name>/` holds one folder per screen;
  `src/app/router.tsx` maps them to routes with React Router
  (`<BrowserRouter basename="/routines">`), and each view is `lazy()`-loaded as
  its own chunk. Views read the target id from the `?id=` search param via
  `useSearchParams`. Drilling deeper (`/` → `/routine?id=` → `/routine/edit?id=`,
  and `/` → `/new`) is a plain forward `navigate(...)`. Returning is
  `src/hooks/use-smart-back.ts`'s `useSmartBack(fallback)`: every route here is
  also a valid deep link (hard refresh, PWA relaunch, a bookmark), so a "Back"
  action can't assume a real entry sits behind it — the hook pops real history
  (`navigate(-1)`) when this location was actually pushed (React Router's
  `location.key !== "default"`) and replaces to `fallback` otherwise, so
  repeated edit/confirm round trips don't grow the stack and native back keeps
  landing where the AppBar arrow would. `new-routine-view.tsx`'s onComplete is
  the one exception — creating a routine is a forward transition to a
  different screen, not a "back," so it just replaces the disposable `/new`
  draft entry directly. Settings is a drawer opened from the home view's
  state, not a route — `src/views/home/settings-panel.tsx`.
  A component used by 2+ views lives in `src/components/` instead of a view
  folder (e.g. `app-bar.tsx`, `routine-edit-form.tsx`, `missing-routine.tsx`).

- **i18n is a small custom hook, not a library.** `src/i18n/use-translation.ts`
  is a `useSyncExternalStore`-backed locale store — detects the device language
  on first launch (`navigator.language`), then remembers the choice in
  `localStorage` under `routines-locale` — plus a `t(key, params?)` function
  doing `{placeholder}` substitution. No provider is needed; the store is a
  module-level singleton. Message catalogs are `src/i18n/en.json` and
  `src/i18n/pl.json` — keep both in sync when adding keys. Dates are formatted
  with native `Intl.DateTimeFormat`.

- **Mobile gate + app lock.** `src/components/mobile-gate.tsx` renders the app
  for mobile viewports and a "desktop not supported" message otherwise, and
  registers the service worker (production builds only — see the
  `import.meta.env.PROD` guard; there's no `sw.js` in dev, and running a
  caching worker during development would fight Vite's HMR anyway). Inside it,
  `src/components/app-lock-gate.tsx` hides the app behind a WebAuthn
  platform-authenticator prompt when the lock is on. Being unlocked is
  per-session memory state in `src/lib/app-lock.ts`; enrolling counts as
  unlocked, or turning the switch on would lock the user out on the spot. The
  lock is a gate, **not** encryption — there is no backend to verify the
  assertion and `routines-data` stays readable — so the lock screen always
  keeps an escape hatch once the authenticator fails or goes missing.

- **Service worker (`src/sw.ts`, built by vite-plugin-pwa).** The
  `injectManifest` strategy compiles this file and substitutes
  `self.__WB_MANIFEST` with the list of content-hashed build assets, which the
  worker precaches itself at install time — everything past that point
  (network-first for navigations and `manifest.json`, so a deploy or a
  manifest edit lands on the next launch; cache-first for everything else)
  is the same hand-written logic the old Next.js `public/sw.js` had. Bump
  `CACHE_NAME` when the shell changes.
  Settings' "Update app" (`src/lib/app-update.ts`) takes a backup, drops every
  cache, tells a waiting worker to activate, then reloads.

- **Backup + settings.** `src/lib/backup.ts` serialises routines, progress and
  the language to a versioned JSON file and validates anything imported through
  the same schemas `storage.ts`'s `readData` uses (the file is user-supplied —
  unrecognised entries are dropped, not trusted). `parseRoutines`/`parseState`
  in `schemas.ts` validate each routine/step/progress entry independently
  rather than handing a whole array/record to `v.array()`/`v.record()` — one
  malformed entry is dropped without taking an otherwise-valid import or
  stored blob down with it. `src/lib/settings.ts` holds preferences (currently the lock enrolment) in
  the same external-store shape as `use-store.ts`; `resetPreferences` clears
  preferences only and callers must reload, since other stores cache their own
  snapshots.

- **UI stack.** shadcn (`base-nova` style, see `components.json`, `rsc: false`)
  built on `@base-ui/react` — primitives live in `src/components/ui`, generated
  and not hand-edited. Always import through the aliases `components.json`
  declares (`utils`, `ui`, `components`, `lib`, `hooks`) rather than straight
  from the underlying package — e.g. `cn` from `@/lib/utils`, not directly
  from the `cn` package — so a future `npx shadcn add` or hand-adjustment
  doesn't quietly bypass the alias the way the generated components once did.
  Tailwind v4 (via `@tailwindcss/postcss`) with design
  tokens in `src/app/globals.css`; icons from `lucide-react`. The font is
  self-hosted via `@fontsource-variable/outfit` (imported in `src/main.tsx`,
  used for both `--font-sans` and `--font-heading`) rather than fetched from
  Google Fonts at runtime — same "nothing leaves the device" invariant the
  old `next/font` setup gave for free. Step reordering uses `@dnd-kit`.
  Every bottom sheet is `src/components/ui/drawer.tsx` (Base UI `Drawer`) with
  `showSwipeHandle`, so each one has a grab pill and can be swiped down to
  dismiss. Base UI stacks nested drawers — opening a confirmation from the
  settings drawer shrinks and scales the parent behind it, which is intended.
  The drawer reacts to touch gestures, so e2e swipes need CDP
  `Input.dispatchTouchEvent`; synthetic mouse drags do not dismiss it.
  Every drawer also closes on the phone's native back button/gesture, the
  same as its swipe handle or close control. On Android/Chromium this is
  Base UI's own doing (`CloseWatcher`, gated to the topmost open drawer —
  see `DrawerRoot.js`); `drawer.tsx` adds a `useHistoryBackDismiss` fallback
  on top (one `pushState` per open drawer, closed via `popstate`, marker-
  tagged so nested drawers only close the topmost) to cover iOS and any
  browser without `CloseWatcher`. Routed screens (routine view/edit, `/new`)
  need no equivalent — `navigate(...)` already gives them a real history
  entry, so native back lands wherever the `AppBar` arrow would.

- **Unit tests (Vitest).** Test files live under `tests/unit/`, mirroring
  `src/`'s structure (`tests/unit/lib/storage.test.ts` for
  `src/lib/storage.ts`, etc.) rather than co-located with the source —
  `vitest.config.ts`'s `test.include` is scoped to `tests/unit/**/*.test.ts`
  explicitly, so a stray test file dropped elsewhere is never picked up.
  `vitest.config.ts` is deliberately separate from
  `vite.config.ts` so the PWA/build plugins never run during tests; `jsdom`
  environment for the functions that touch `localStorage`/`navigator`/
  WebAuthn directly. `coverage.include` (what gets _measured_, independent
  of where the tests themselves live) is split by what it actually
  exercises, not by file location alone: `src/lib/**` (pure logic —
  schemas, storage, backup, locale-store, settings, app-lock, app-update,
  routine-utils),
  `src/hooks/**` and `src/i18n/**` (the `useSyncExternalStore` store/hook
  bridge, via `@testing-library/react`'s `renderHook` — no JSX/`.tsx`
  needed, so this still stays out of component-rendering territory).
  Views/components are **not** covered here on purpose — that's e2e's job
  (see `.claude/tasks/features/e2e-user-flow-tests.md`); including them in
  `vitest.config.ts`'s `coverage.include` would just show a permanently low
  number for code this suite was never meant to exercise. `coverage.include`
  enforces a 95% threshold (lines/statements/functions/branches) via
  `@vitest/coverage-v8`, scoped to exactly the dirs above — deliberately not
  100% even though the suite currently clears 100%, since a literal 100%
  gate has zero slack for any future line landing in these dirs without a
  test in the same change.
  `storage.ts`/`settings.ts`/`locale-store.ts` cache state in module-level
  singletons, so their tests use `vi.resetModules()` + a dynamic `import()`
  per test rather than exporting internal reset hooks just for testing.
  This landed in two branches, not one — `feature/unit-tests-ts` (lib/
  only, zero React-testing dependencies) merged first, then
  `feature/unit-tests-react` (hooks/i18n, needs `@testing-library/react`)
  as a deliberately separate follow-up.
  Missing browser globals (`navigator.serviceWorker`, `caches`,
  `URL.createObjectURL`/`revokeObjectURL`, `matchMedia`) are not a reason
  to skip coverage on the code that uses them — stub/mock them with
  `vi.stubGlobal`/`vi.spyOn` (see `app-update.test.ts`'s service-worker/
  cache-clearing tests, `backup.test.ts`'s `downloadBackup` tests, and
  `use-install-prompt.test.ts`'s hand-rolled `matchMedia` fake) rather than
  leaving that code untested by default. Do this even at medium effort —
  only skip a gap after actually weighing it against a specific reason not
  to, not by default because mocking looks like more setup than a plain
  assertion. Even a `typeof window === "undefined"` SSR guard — which
  jsdom (every other test file's environment) can never produce — turned
  out testable: `ssr-guards.test.ts` uses Vitest's per-file
  `// @vitest-environment node` docblock override to exercise those
  branches for real, rather than leaving them permanently uncovered as a
  default "not worth it."
  `vitest.config.ts` also sets `isolate: false`, reusing one plain jsdom
  environment across every test file instead of a fresh one per file
  (cut CI time — jsdom setup was ~85% of the run). The real consequence:
  globals like `document`/`window`/`Storage.prototype` are the _same
  object_ shared across the whole run, not per-file. Every test that
  mutates or spies on one must restore it in its own `afterEach`
  (`vi.stubGlobal` values via `vi.unstubAllGlobals()`, `vi.spyOn` mocks via
  `vi.restoreAllMocks()` — the two are not interchangeable, and a missed
  restore fails a _different_, unrelated test rather than the one that
  leaked it). This already caused one real bug: an un-restored
  `vi.spyOn(Storage.prototype, ...)` in `app-update.test.ts` broke a
  different test in the same file until the missing `restoreAllMocks()`
  was added.

- **E2E tests (Playwright).** `e2e/*.spec.ts` + `playwright.config.ts` — its
  own `tsconfig.e2e.json` project reference, since neither
  `tsconfig.app.json` nor `tsconfig.node.json` covers it. Runs against the
  real production build (`webServer` does `npm run build` + `vite preview`,
  not the dev server), same phone-sized-viewport constraint as the Mobile
  gate bullet above. Two projects, two OSes, deliberately not a third (a
  Playwright device preset only changes viewport/UA, never the engine, so
  another Android profile would be redundant with `mobile-chromium`):
  `mobile-chromium` (`devices["Galaxy A55"]`) and `mobile-iphone`
  (`devices["iPhone 13"]`, real **WebKit** — the reasoning behind both
  specific models is in git history, not reproduced here since it'll only
  go stale). `test:e2e` runs both, no `--project` filter; CI installs both
  `chromium` and `webkit` binaries. WebKit has no CDP session API, so
  `mobile-iphone` excludes `drawer-dismissal.spec.ts` (raw CDP touch
  events, no native Playwright touch-drag primitive exists yet) via its
  own `testIgnore` rather than that one hard-failing there; **remember to
  add the same exclusion if a future spec needs raw CDP too.**
  `app-lock.spec.ts` used to need the same exclusion (a CDP virtual
  WebAuthn authenticator) but moved to `context.credentials` (Playwright
  1.61+, cross-browser unlike `newCDPSession`), so it now runs on both
  projects. `e2e/utils.ts` holds reusable helpers — `seedData` (seeds
  `localStorage` via `page.addInitScript`, skipping the create/edit UI)
  and `swipeDown` (the one still-CDP-based helper, raw Playwright APIs
  don't cover touch drag). One easy trap: `page.goto("/new")` against this
  `baseURL` (already ending in
  `/routines/`) resolves to the _origin_ root
  (`http://localhost:4173/new`), not `/routines/new` — a leading `/` in a
  relative navigation replaces the whole path. Always navigate with no
  leading slash (`page.goto("new")`, `page.goto("")` for home). Debugging a
  failure locally: `npm run test:e2e:report`.

## Product context

See `PRODUCT.md` for the design intent: a calm, quiet checklist — no history,
gamification, or notifications. Keep the UI restrained: the accent is a neutral
**white** on dark surfaces. The earlier coral accent was removed deliberately —
do not reintroduce it.

## Automation

| Purpose          | npm script              | Runs automatically via                                                      |
| ---------------- | ----------------------- | --------------------------------------------------------------------------- |
| Format           | `npm run format`        | PostToolUse hook, per edited file                                           |
| Lint (fix)       | `npm run lint:fix`      | PostToolUse hook, per edited file                                           |
| Typecheck        | `npm run typecheck`     | Stop hook, every turn, summary only                                         |
| Tests + coverage | `npm run test:coverage` | Stop hook, only when `src/`/`tests/` have uncommitted changes, summary only |

`.claude/hooks/session-validate.sh` runs both on `Stop`. Typecheck runs on
every turn (cheap enough to tolerate constantly); the test suite only runs
when this turn actually touched `src/`/`tests/` — most turns (planning,
docs, git operations, pure Q&A) don't, and skipping them avoids paying the
~10-15s test cost for nothing to check. Neither blocks the turn — both are
summary-only warnings. `test:e2e`/`build`/`npm audit` aren't tied to any
hook (e2e needs a real browser + a built app, too slow/heavy for a
per-turn hook), but `validate.yml` covers all three in CI on every PR. For
a full manual check (all seven steps at once), run `npm run validate`
directly.

## Conventions

- Filenames: kebab-case everywhere, including components (not PascalCase);
  component names inside a file are still PascalCase (`routine-view.tsx`
  exports `RoutineView`).
- Named exports throughout; no framework forces a default export here.
- Hooks (`use*`) live in `src/hooks/`, not in `src/lib` — `lib/` must stay
  free of `react`/`react-dom` imports.
- View-level UI lives in `src/views/<name>/`; `src/components/` is for UI
  shared by 2+ views only (gates, `app-bar.tsx`, `ui/` primitives).
- Playwright test helpers live in `e2e/utils.ts`, not `fixtures.ts` —
  a cross-project convention (all maat-apps projects, not just this one),
  chosen because these are plain reusable functions the specs call
  directly, not Playwright's own `test.extend()` fixture-injection system;
  naming the file "fixtures" would suggest the latter.
- Validate anything crossing a trust boundary (backup imports, localStorage
  read-back) with Valibot schemas (`src/lib/schemas.ts`), not hand-rolled
  `typeof`/`isRecord` checks — see the State bullet above for why schemas are
  the single source of truth here. Also the standard validation library
  across the maat-apps ecosystem, not just this repo (see
  `.claude/tasks/ecosystem/adopt-valibot-for-validation.md`). Validate
  array/record entries independently rather than handing a whole
  array/record to `v.array()`/`v.record()` in one call, so one malformed
  entry doesn't take an otherwise-valid whole down with it.
- Full pattern log: `.claude/docs/patterns.md` — read by `/find-antipatterns`
  and `/learn-patterns`, not loaded every session.

## Workflow Rules

- Don't manually re-run format/lint/typecheck/build/test:coverage/test:e2e
  (individually or via `npm run validate`) to double-check a change before
  committing or pushing, or narrate that you're about to — see the
  Automation table above for what already runs per-edit/per-turn, and
  `validate.yml` for what CI covers on every PR. Running any of it again
  locally is redundant work against what's already covered, not extra
  safety.
- Prefer `Grep`/`Glob` over reading whole files; read only what a task needs.
- For broad codebase audits, use `/find-antipatterns` instead of reading many
  files inline.
- After a non-trivial session, run `/learn-patterns` to record what recurred.
- Check the current branch before editing or committing anything — never
  edit or commit directly on `main`, including doc-only changes. Branch
  first, always.
- Delete local branches once their PR is confirmed merged on GitHub —
  `git branch -d`, or `-D` when a squash-merge or an already-deleted
  remote branch blocks the safe check (git's ancestry check doesn't
  understand squash merges). Don't wait to be asked; verify via GitHub
  first (`gh pr view`/`gh api`), not just local heuristics.
- Commit automatically once a task's changes are complete, then use
  `/open-pr` to push and open the PR — see that command for the full
  flow (no local re-verification, no confirmation pause, merge is the
  human checkpoint).
- When a change touches something CLAUDE.md or README.md describes
  (architecture, stack, file locations), update those docs in the same
  session rather than leaving them to drift until a later cleanup pass finds
  them stale.
- If the dev server throws stale-module/HMR errors (e.g. "does not provide
  an export named ...") — especially right after a branch switch — restart
  it before assuming there's a real regression; Vite's module graph can go
  stale across branch changes and the error is almost always the restart,
  not the code.
- Add a new import in the same `Edit` call as its first usage, not as a
  separate edit beforehand — the PostToolUse format/lint hook runs
  `eslint --fix` after every edit, and it will strip an import that's
  unused at that intermediate moment, before the usage lands in a later
  edit. Hit repeatedly across sessions; always costs an extra edit to fix.
