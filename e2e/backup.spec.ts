import { expect, test } from "@playwright/test";

import { en, seedData } from "./utils";

async function openSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: en.settings }).click();
}

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
      /^routines-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const backup = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

    expect(backup.app).toBe("routines");
    expect(backup.version).toBe(1);
    expect(backup.data.routines).toHaveLength(1);
    expect(backup.data.routines[0].name).toBe("Morning");
  });

  test("importing a valid backup replaces the current routines after confirmation", async ({
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
    // drawer-dismissal.spec.ts) and check the list underneath — not
    // Escape, which has no equivalent on a phone with no hardware keyboard.
    await page.goBack();
    await expect(
      page.getByRole("button", { name: /Imported routine/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Old routine/ })).toHaveCount(
      0,
    );
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
