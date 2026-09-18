import { expect, test } from "@playwright/test";

import { en, seedData } from "./utils";

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

    await page.getByRole("button", { name: en.settings }).click();
    const lockSwitch = page.getByRole("switch", { name: en.appLock });
    await expect(lockSwitch).toBeEnabled();
    await lockSwitch.click();
    await expect(lockSwitch).toBeChecked();
    await expect(page.getByText(en.appLockDescription)).toBeVisible();

    // Enrolling counts as unlocked (per CLAUDE.md's app-lock notes) — a
    // reload should still show the locked screen, since being unlocked is
    // per-session memory state, not persisted.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: en.lockedTitle }),
    ).toBeVisible();

    await page.getByRole("button", { name: en.unlock }).click();
    await expect(
      page.getByRole("heading", { name: en.lockedTitle }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });

  test("the escape hatch turns the lock off when no authenticator is available", async ({
    page,
  }) => {
    // Force "no platform authenticator" deterministically: the real host
    // machine running this test may (or may not) have one configured (e.g.
    // Windows Hello), which isAppLockSupported() would otherwise honestly
    // report — that's environment-dependent, not what this test wants to
    // exercise.
    await page.addInitScript(() => {
      window.PublicKeyCredential = window.PublicKeyCredential ?? ({} as never);
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
        () => Promise.resolve(false);
      window.localStorage.setItem(
        "routines-settings",
        JSON.stringify({
          lock: {
            credentialId: "fake",
            userId: "fake-user",
            createdAt: new Date().toISOString(),
          },
        }),
      );
    });
    await seedData(page, [], {});
    await page.goto("");

    await expect(
      page.getByRole("heading", { name: en.lockedTitle }),
    ).toBeVisible();

    // isAppLockSupported() resolving false shows the escape hatch on mount
    // (app-lock-gate.tsx), without needing a failed unlock attempt first.
    const escapeHatch = page.getByRole("button", { name: en.turnOffLock });
    await expect(escapeHatch).toBeVisible();
    await escapeHatch.click();
    await expect(page.getByRole("heading", { name: en.appName })).toBeVisible();
  });
});
