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
      name: "mobile-chromium",
      use: { ...devices["Galaxy A55"] },
    },
    {
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
