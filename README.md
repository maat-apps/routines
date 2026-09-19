# Routines

A private, phone-first PWA for daily routines. It is a quiet checklist for the
small gaps of a real day — before leaving home, after the gym, in the morning, or
before bed. No accounts, no history, no gamification, no notifications. Just the
steps you want to keep close, and a checkmark next to each one.

Everything lives in your browser. There is no backend and no account, nothing
about you is sent anywhere, and the app works offline — the only requests it
makes are for its own files.

## Design principles

This project — and this stack in general — is guided by a few core goals:

- **Minimalism.** No more than the checklist needs; a calm, uncluttered UI.
- **Independence.** No accounts, no cloud, no vendor lock-in — your data stays
  yours and stays on your device.
- **Smallest possible runtime footprint.** Lightweight and easy on the battery
  once it's on your device, e.g. true black (`#000000`) backgrounds to save
  power on OLED screens. This is about how the app behaves after it's built —
  not a claim about the footprint of building it, which uses Claude Code like
  the rest of the project (see "Built with Claude" below).
- **Ease of use.** Simple enough to use without thinking about it.
- **Accessibility.** Usable by as many people as possible.

## Features

- **Daily checklists.** Create routines, each a short ordered list of steps.
- **Automatic daily reset.** Checkmarks clear on their own at the start of a new
  day; your steps stay exactly as you left them.
- **Reorder by dragging.** Steps move with a drag handle (touch-friendly).
- **Progress at a glance.** A small ring shows how many steps are done.
- **Installable.** Add it to your home screen and launch it like a native app.
- **English and Polish.** A built-in language toggle (English by default); your
  choice is remembered on the device via `localStorage`.
- **Reorder routines.** Drag routines on the main list into the order you want.
- **Export and import.** Save every routine to a JSON file and restore it
  later — the way to move your data to another device or browser.
- **Install and update from Settings.** An install button (where the browser
  offers one) and an update button that clears caches, takes an automatic
  backup first, and reloads.
- **App lock.** An optional fingerprint/face prompt before the app opens,
  using the device's WebAuthn platform authenticator. It is a convenience
  gate, not encryption — see the note below.
- **Reset settings.** Puts language and app lock back to their defaults and
  leaves your routines alone.

### About the app lock

The lock registers a WebAuthn platform credential and asks for it before
showing your routines. Because there is no backend, nothing verifies the
assertion and your routines stay readable in `localStorage` — it keeps a
passer-by out of an unlocked phone, it does not protect the data itself. If
the authenticator ever stops working (a new phone, cleared browser data,
re-enrolled biometrics), the lock screen offers a way to turn the lock off so
you are never shut out of your own checklist.

## Tech stack

- **Vite** and **React 19** with **TypeScript**, built as a fully static single-page
  app — no server at runtime.
- **React Router** (declarative mode) for client-side routing.
- **Tailwind CSS v4** with design tokens; **shadcn** (`base-nova`) components on
  **@base-ui/react** primitives; icons from **lucide-react**.
- **@dnd-kit** for step and routine reordering.
- A small custom `useTranslation()` hook (see below) for translations, plus
  native `Intl` for date formatting.
- **vite-plugin-pwa** (`injectManifest` strategy) builds the service worker.
- State persisted to **`localStorage`** (no database, no API), validated with
  **Valibot** schemas that double as the source of the app's TypeScript types.

## Local development

```bash
npm install
npm run dev      # dev server (note the /routines base path, see below)
```

Other useful scripts:

```bash
npm run build          # production build to dist/ (also the deploy build)
npm run lint           # ESLint (Prettier runs as a lint rule, so format slips fail lint)
npm run format         # Prettier --write
npm run format:check   # Prettier --check
npm run typecheck      # tsc -b (project references, no emit)
npm run test:unit      # Vitest — pure logic + hook/i18n store bridge, no browser
npm run test:coverage  # same suite, with a coverage report and enforced threshold
npm run test:e2e       # Playwright, against the real production build (incl. axe-core a11y checks)
npm run test:lighthouse # Lighthouse score audit — separate, not in validate (manual/workflow_dispatch only)
npm run validate       # lint + format:check + typecheck + test:coverage + test:e2e + build + npm audit
npm run build:analyze  # production build + a dist/stats.html bundle treemap
```

Unit tests (Vitest, `jsdom`) cover `src/lib/`'s pure logic and the
`src/hooks/`/`src/i18n/` store bridge — no served build, no real browser.
UI/navigation flows are covered separately by a Playwright e2e suite
(`e2e/`), run against the built app (`npm run build` + `vite preview`)
rather than the dev server; `vitest.config.ts` enforces a 95% coverage
threshold on the dirs it actually targets.

## Deployment (static build + `/routines` base path)

The app is deployed to **GitHub Pages** as a static site.

- `vite.config.ts` sets `base: "/routines/"` because the site is served from a
  project Pages URL (`https://<user>.github.io/routines/`). Every absolute
  in-app URL (service worker, manifest, icons) is written root-relative in
  `index.html`/`public/`, and Vite rewrites it with that prefix at build time;
  the dev server serves the app under `/routines/` too.
- GitHub Pages has no server-side rewrites, so a hard refresh or deep link into
  a client-routed path (e.g. `/routines/routine`) would 404 with only a plain
  SPA. `vite.config.ts` copies the built `index.html` to `dist/404.html` after
  every build — GitHub Pages falls back to that for any unresolved path, which
  boots the app and lets React Router take it from there.
- Deployment is automated in `.github/workflows/deploy.yml`: on push to `main` it
  builds the static site, uploads it as a Pages artifact, and deploys it. Every
  PR instead runs `.github/workflows/ci.yml` — lint, format check, typecheck,
  unit tests, e2e tests, a build, and an audit, gating a PR preview deploy under
  its own `/routines/pr-<n>/` subpath once all of that passes. Closing a PR
  cleans that subdirectory back up via `.github/workflows/pr-preview-cleanup.yml`.

> **One-time repo setting:** in **Settings → Pages**, the build and deployment
> **Source** must be set to **"GitHub Actions"** for the deploy workflow to
> publish. The workflow also calls `actions/configure-pages` with
> `enablement: true` to enable Pages programmatically.

## Architecture

- **State is `localStorage` only.** `src/lib/storage.ts` is the single source of
  truth, persisting one JSON blob under the `routines-data` key. Reads go through
  `normalizeState`, which resets a routine's checked steps whenever its
  `lastResetDate` is not today — the daily reset is a side effect of reading, not
  a scheduled job. Accessors are guarded for a non-browser environment, so first
  render is empty and real data appears after mount. Types in `src/types.ts` are
  inferred from Valibot schemas (`src/lib/schemas.ts`), the single source of
  truth for both validation and the TS types.
- **Routing.** `src/views/**` holds one folder per screen; `src/app/router.tsx`
  maps them to routes with React Router, each view lazy-loaded as its own chunk.
  Views read the target id from the `?id=` search param via `useSearchParams`.
  Navigation is plain `navigate(...)` between `/`, `/routine?id=`,
  `/routine/edit?id=`, and `/new`; Settings is a drawer opened from the home
  view, not a separate route.
- **i18n.** A small custom hook, `src/i18n/use-translation.ts` — a
  `useSyncExternalStore`-backed locale store (detects the device language on
  first launch, then remembers the choice in `localStorage` under
  `routines-locale`) plus a `t()` function doing `{placeholder}` substitution
  against the message catalogs. Catalogs are `src/i18n/en.json` and
  `src/i18n/pl.json` — keep both in sync when adding keys. Dates are formatted
  with native `Intl.DateTimeFormat`.
- **Mobile gate + app lock.** `src/components/mobile-gate.tsx` renders the app
  for mobile viewports (and a short "desktop not supported" message otherwise)
  and registers the service worker in production builds. Inside it,
  `src/components/app-lock-gate.tsx` holds the app behind the WebAuthn prompt
  while the lock is on; being unlocked is per-session state in
  `src/lib/app-lock.ts`.
- **Service worker (`src/sw.ts`, built by vite-plugin-pwa).** Navigations and
  `manifest.json` are network-first, so a new deploy or a manifest edit is
  picked up on the next launch and the cache is the offline fallback;
  content-hashed assets stay cache-first, precached at install time from the
  manifest vite-plugin-pwa injects. Settings' "Update app"
  (`src/lib/app-update.ts`) snapshots your routines, clears every cache and
  reloads.
- **Backup + preferences.** `src/lib/backup.ts` writes and validates (via the
  same Valibot schemas `storage.ts` uses) the versioned export/import file;
  `src/lib/settings.ts` stores preferences (the lock enrolment). Every
  `localStorage` key the app owns is declared in `src/lib/storage-keys.ts`,
  so backup and reset stay in step.

## Product

See [`PRODUCT.md`](PRODUCT.md) for the design intent: a calm, quiet checklist.
Keep the UI minimalistic — the accent is a clean, neutral white on dark surfaces.

## Built with Claude

This project is developed with [Claude Code](https://claude.com/claude-code),
Anthropic's agentic coding tool. Features and refactors are implemented in
pair-programming sessions with Claude, then reviewed and committed by a human.
The runtime footprint goal above is about the shipped app, not this process —
building with Claude has its own energy cost, separate from the app's.
