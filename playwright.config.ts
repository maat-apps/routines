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
  // Two projects, two OSes — not three. A Playwright "device" preset only
  // ever changes viewport/UA, never the rendering engine: every "iPhone *"
  // preset drives the same bundled WebKit, every Android preset drives the
  // same bundled Chromium. So a second Android profile alongside Samsung
  // (e.g. Pixel) would only add a different viewport width, not real
  // engine/behavior coverage — redundant given WebKit is the one project
  // here actually exercising a different engine. Model choice below is
  // picked for real-world representativeness (installed base, not just
  // newest/flagship), not "authenticity" — see the task's own PR notes for
  // the actual usage-share reasoning.
  projects: [
    {
      // Galaxy A55: Samsung's own data shows the A-series, not the S-series
      // flagship, dominates real shipment volume — a mid-range phone
      // represents more actual users than a flagship does.
      name: "mobile-chromium",
      use: { ...devices["Galaxy A55"] },
    },
    {
      // iPhone 13: essentially tied for the single most-used iPhone model
      // by installed base, and representative of the "standard," not
      // Pro/Max, size tier most iPhones in current use actually are. The
      // one project running a genuinely different engine (WebKit, same as
      // real iOS Safari) rather than another Chromium profile — the whole
      // point of testing "iPhone" specifically. That means Playwright's
      // CDP session API (Chromium-only) isn't available here, so the two
      // specs built on it are excluded on this project alone:
      // drawer-dismissal.spec.ts (raw CDP touch events for the swipe
      // gesture) and app-lock.spec.ts (a CDP virtual WebAuthn
      // authenticator). Everything else — routing, forms, backup,
      // settings, daily reset — still runs for real on WebKit.
      name: "mobile-iphone",
      testIgnore: [/drawer-dismissal\.spec\.ts$/, /app-lock\.spec\.ts$/],
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
