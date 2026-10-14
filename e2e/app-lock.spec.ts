import { expect, test } from "@playwright/test";

import { en, openSettings, seedData, waitForStoredLock } from "./utils";

// Wiring only: the app's enrolment persists and its gate renders. The lock
// screen's own behavior (escape hatch, erase warning) is tested in
// @maat-apps/ui, the lock logic in @maat-apps/core.
test.describe("app lock", () => {
  test("enrolling turns the lock on and unlocking with the same authenticator works", async ({
    page,
  }) => {
    // Native virtual WebAuthn authenticator (Playwright 1.61+), cross-browser
    // unlike the CDP WebAuthn domain — install() before navigation so the
    // app's own real navigator.credentials.create()/.get() calls (enrolling,
    // then unlocking) succeed against it. No credential is pre-seeded: the
    // app's real enrol ceremony is what should create one.
    await page.context().credentials.install();
    await seedData(page, []);
    await page.goto("");

    await openSettings(page);
    const lockSwitch = page.getByRole("switch", { name: en.appLock });
    await expect(lockSwitch).toBeEnabled();
    await lockSwitch.click();
    await expect(lockSwitch).toBeChecked();
    await expect(page.getByText(en.appLockDescription)).toBeVisible();

    await expect(page.getByText(en.relockAfterDescription)).toBeVisible();

    // Enrolling counts as unlocked (per CLAUDE.md's app-lock notes) — a
    // reload locks again, since being unlocked is per-session memory state,
    // and the lock screen prompts the authenticator by itself.
    await waitForStoredLock(page);
    await page.reload();
    await expect(page.getByRole("button", { name: en.unlock })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });
});
