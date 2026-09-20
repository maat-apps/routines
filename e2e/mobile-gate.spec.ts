import { expect, test } from "@playwright/test";

import { en, seedData } from "./utils";

test.describe("mobile gate", () => {
  test("a landscape phone shows the app, not the desktop message", async ({
    page,
  }) => {
    // Width and height swap on rotation — an iPhone 13 is 390x844 in
    // portrait (this suite's own default device viewport) and 844x390
    // rotated. The gate must key off the narrow dimension, not width
    // alone, or a rotated phone reads the same as a desktop window.
    await page.setViewportSize({ width: 844, height: 390 });
    await seedData(page, []);
    await page.goto("");

    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
    // Both <main> and <section> in mobile-gate.tsx always mount — it's a
    // pure CSS display toggle, not conditional rendering — so the
    // "desktop" text still exists in the DOM here, just hidden. Assert
    // visibility, not (non-)existence.
    await expect(page.getByText(en.mobileOnly)).not.toBeVisible();
  });

  test("a real desktop window shows the desktop message, not the app", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedData(page, []);
    await page.goto("");

    await expect(page.getByText(en.mobileOnly)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: en.appName }),
    ).not.toBeVisible();
  });
});
