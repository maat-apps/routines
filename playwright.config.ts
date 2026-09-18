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
  // "github" annotates the PR inline; no CI artifact upload, so no reason
  // to also generate the HTML report there. It's still one command away
  // locally when actually debugging a failure: `npm run test:e2e:report`
  // (traces are captured either way via `trace: "on-first-retry"` below).
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173/routines/",
    trace: "on-first-retry",
    // Pinned rather than left to whatever the runner's Chromium defaults
    // to — the app detects its language from navigator.language on first
    // launch (src/lib/locale-store.ts), and specs assert against en.json's
    // actual strings (see e2e/fixtures.ts), so this has to be deterministic
    // across every environment the suite runs in, not just "whatever this
    // machine happens to resolve."
    locale: "en-US",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-samsung",
      use: { ...devices["Galaxy S24"] },
    },
    {
      // The one project running a genuinely different engine (WebKit, same
      // as real iOS Safari) rather than another Chromium profile — the
      // whole point of testing "iPhone" specifically. That means
      // Playwright's CDP session API (Chromium-only) isn't available here,
      // so the two specs built on it are excluded on this project alone:
      // drawer-dismissal.spec.ts (raw CDP touch events for the swipe
      // gesture) and app-lock.spec.ts (a CDP virtual WebAuthn
      // authenticator). Everything else — routing, forms, backup,
      // settings, daily reset — still runs for real on WebKit.
      name: "mobile-iphone",
      testIgnore: [/drawer-dismissal\.spec\.ts$/, /app-lock\.spec\.ts$/],
      use: { ...devices["iPhone 17"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
