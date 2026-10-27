import { expect, test, type Page } from "@playwright/test";

import { en, openSettings, seedData } from "./utils";

test.describe("backup export / import", () => {
  test("exporting downloads a JSON file shaped like a routines backup", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Morning", order: 0, steps: [] }]);
    await page.goto("");
    await openSettings(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: en.exportAction }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(
      /^routines-backup-\d{4}-\d{2}-\d{2}\.txt$/,
    );
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const backup = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    expect(backup.app).toBe("routines");
    expect(backup.version).toBe(1);
    expect(backup.data.routines).toHaveLength(1);
    expect(backup.data.routines[0].name).toBe("Morning");

    // Headless Chromium has no share targets, so this always falls back to
    // downloadBackup — the "shared" status is covered at the unit level
    // (backup.test.ts), since there's no real share sheet to drive here.
    await expect(page.getByText(en.exportDone)).toBeVisible();
  });

  test("importing a valid backup adds its routines to the current ones after confirmation", async ({
    page,
  }) => {
    await seedData(page, [
      { id: "r1", name: "Old routine", order: 0, steps: [] },
    ]);
    await page.goto("");
    await openSettings(page);

    const validBackup = {
      app: "routines",
      version: 1,
      exportedAt: new Date().toISOString(),
      locale: null,
      data: {
        routines: [
          {
            id: "imported-1",
            name: "Imported routine",
            order: 0,
            steps: [{ id: "s1", text: "Do the thing", order: 0 }],
          },
        ],
        state: {},
      },
    };
    await page.getByLabel(en.importData).setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(validBackup)),
    });

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.importTitle }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: en.importConfirm }).click();

    await expect(page.getByText(en.importDone)).toBeVisible();
    // Close the settings drawer via the phone back gesture (see
    // @maat-apps/ui's drawer tests) and check the list underneath — not
    // Escape, which has no equivalent on a phone with no hardware keyboard.
    await page.goBack();
    await expect(
      page.getByRole("button", { name: /Imported routine/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Old routine/ }),
    ).toBeVisible();
  });

  test("importing a malformed file is rejected without touching existing data", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Keep me", order: 0, steps: [] }]);
    await page.goto("");
    await openSettings(page);

    await page.getByLabel(en.importData).setInputFiles({
      name: "not-a-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from("this is not json"),
    });

    await expect(page.getByText(en.importFailed)).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();
  });
});

// A backup shared from another app (manifest.json's share_target): the
// service worker parks the file in a cache and redirects to
// `?shared-backup`. Headless Chromium has no share sheet, so these park the
// file themselves — cache name and key hand-duplicated from
// src/lib/shared-backup.ts, same reasoning as seedData — and cover the app
// side; the worker's half is unit-tested in @maat-apps/core.
async function parkSharedBackup(page: Page, text: string) {
  await page.evaluate(async (body) => {
    // Let a worker still activating settle before parking the file, so it
    // doesn't race the write.
    if ("serviceWorker" in navigator) {
      const worker = (await navigator.serviceWorker.ready).active;
      if (worker && worker.state !== "activated") {
        await new Promise<void>((resolve) => {
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") resolve();
          });
        });
      }
    }
    const cache = await caches.open("routines-shared-backup");
    await cache.put(
      new URL("shared-backup", document.baseURI).href,
      new Response(body),
    );
  }, text);
}

test.describe("backup shared from another app", () => {
  test("adds its routines after confirmation", async ({ page }) => {
    await seedData(page, [
      { id: "r1", name: "Old routine", order: 0, steps: [] },
    ]);
    await page.goto("");
    await parkSharedBackup(
      page,
      JSON.stringify({
        app: "routines",
        version: 1,
        exportedAt: new Date().toISOString(),
        locale: null,
        data: {
          routines: [
            { id: "shared-1", name: "Shared routine", order: 0, steps: [] },
          ],
          state: {},
        },
      }),
    );
    await page.goto("?shared-backup");

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.importTitle }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/shared-backup/);
    await dialog.getByRole("button", { name: en.importConfirm }).click();

    await expect(
      page.getByRole("button", { name: /Shared routine/ }),
    ).toBeVisible();
    // An import merges: what was there stays.
    await expect(
      page.getByRole("button", { name: /Old routine/ }),
    ).toBeVisible();
  });

  test("a file that isn't a backup is rejected without touching data", async ({
    page,
  }) => {
    await seedData(page, [{ id: "r1", name: "Keep me", order: 0, steps: [] }]);
    await page.goto("");
    await parkSharedBackup(page, "this is not json");
    await page.goto("?shared-backup");

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: en.importFailed }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: en.done }).click();
    await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();
  });
});
