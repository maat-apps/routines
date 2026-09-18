import { defineConfig, devices } from "@playwright/test";

// Runs against the static production build (npm run build), served by
// `vite preview` under the app's real base path — the same GitHub Pages
// layout the app assumes at runtime, unlike the dev server. Phone-sized
// viewport throughout: the mobile gate (src/components/mobile-gate.tsx)
// hides the app entirely at widths >=481px.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // No CI artifact upload; "html" (npm run test:e2e:report) is local-only.
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173/routines/",
    trace: "on-first-retry",
    // Pinned, not left to the runner's default — locale-store.ts detects
    // language from navigator.language, and specs assert en.json's strings.
    locale: "en-US",
  },
  // Two devices, each the best available representation of one of the two
  // most popular mobile operating systems.
  projects: [
    {
      // Functional flows + the axe-core accessibility checks — both cheap
      // and deterministic enough to gate every PR (npm run test:e2e, wired
      // into validate/CI). Lighthouse is scored, slower, and can be flaky
      // on shared runners, so it stays out of this project entirely — see
      // the "lighthouse" project below and npm run test:lighthouse.
      name: "mobile-chromium",
      testIgnore: /lighthouse\.spec\.ts$/,
      use: { ...devices["Galaxy A55"] },
    },
    {
      // drawer-dismissal.spec.ts is the one spec still on the CDP-only
      // touch-event path (no native replacement exists yet). a11y.spec.ts
      // runs its axe-core checks against the DOM/ARIA tree, which doesn't
      // meaningfully differ by rendering engine, so running it on both
      // devices would just be redundant (same reasoning CLAUDE.md gives for
      // not adding a third device). lighthouse.spec.ts has its own
      // dedicated project below — package.json's test:e2e selects
      // mobile-chromium/mobile-iphone explicitly rather than running
      // `playwright test` bare, but this project's own file matching would
      // otherwise still pick lighthouse.spec.ts up on its own.
      // app-lock.spec.ts moved to context.credentials, which is
      // cross-browser (unlike newCDPSession), so it runs here too.
      name: "mobile-iphone",
      testIgnore: [
        /drawer-dismissal\.spec\.ts$/,
        /a11y\.spec\.ts$/,
        /lighthouse\.spec\.ts$/,
      ],
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "lighthouse",
      testMatch: /lighthouse\.spec\.ts$/,
      use: { ...devices["Galaxy A55"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
