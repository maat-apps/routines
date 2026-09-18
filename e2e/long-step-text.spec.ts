import { expect, test } from "@playwright/test";

import { seedData } from "./utils";

test("a long step wraps instead of being truncated", async ({ page }) => {
  const longText = "A".repeat(150) + " " + "b".repeat(150);
  await seedData(page, [
    {
      id: "r1",
      name: "Evening",
      order: 0,
      steps: [{ id: "s1", text: longText, order: 0 }],
    },
  ]);
  await page.goto("routine?id=r1");

  const step = page.getByRole("checkbox", { name: longText });
  await expect(step).toContainText(longText);
  // Not just .locator("span") — Base UI's own <Checkbox> renders its
  // visual indicator as a nested <span role="checkbox">, a second span
  // inside this row alongside the step text's own; filter to the one that
  // actually holds the text.
  const whiteSpace = await step
    .locator("span")
    .filter({ hasText: longText })
    .evaluate((el) => getComputedStyle(el).whiteSpace);
  expect(whiteSpace).not.toBe("nowrap");
  const box = await step.boundingBox();
  // A single line at this viewport width couldn't fit 300 chars — a tall
  // box is the only way to tell wrapping actually happened, since CSS
  // truncation never touches textContent.
  expect(box?.height ?? 0).toBeGreaterThan(80);
});
