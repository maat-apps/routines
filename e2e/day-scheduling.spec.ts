import { expect, test } from "@playwright/test";

import { en, seedData } from "./utils";

test("a routine not scheduled for today is hidden from the home list", async ({
  page,
}) => {
  const today = new Date().getDay();
  const notToday = (today + 1) % 7;
  await seedData(page, [
    { id: "r1", name: "Today", order: 0, activeDays: [today], steps: [] },
    {
      id: "r2",
      name: "Not today",
      order: 1,
      activeDays: [notToday],
      steps: [],
    },
  ]);
  await page.goto("");

  await expect(page.getByRole("button", { name: /Today/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Not today/ })).toHaveCount(0);
});

test("shows a distinct message when routines exist but none are scheduled today", async ({
  page,
}) => {
  const notToday = (new Date().getDay() + 1) % 7;
  await seedData(page, [
    { id: "r1", name: "Someday", order: 0, activeDays: [notToday], steps: [] },
  ]);
  await page.goto("");

  await expect(page.getByText(en.noRoutinesTodayTitle)).toBeVisible();
  await expect(page.getByText(en.emptyTitle)).toHaveCount(0);
});
