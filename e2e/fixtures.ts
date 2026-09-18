import { type Page } from "@playwright/test";

const DATA_KEY = "routines-data";

export interface SeedStep {
  id: string;
  text: string;
  order: number;
}

export interface SeedRoutine {
  id: string;
  name: string;
  order: number;
  steps: SeedStep[];
}

export interface SeedProgress {
  checkedStepIds: string[];
  lastResetDate: string;
}

/**
 * Writes routines/progress straight into localStorage before the app boots,
 * bypassing the create/edit UI for tests that aren't exercising that flow.
 * Must run before the first `page.goto` (uses addInitScript) since
 * localStorage isn't reachable before a page has loaded some origin.
 */
export async function seedData(
  page: Page,
  routines: SeedRoutine[],
  state: Record<string, SeedProgress> = {},
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key as string, value as string);
    },
    [DATA_KEY, JSON.stringify({ routines, state })],
  );
}

export function todayIso(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Base UI's drawer swipe-to-dismiss reacts to real touch events, not
 * synthetic mouse drags (see CLAUDE.md's Drawer notes) — Playwright has no
 * high-level touch-drag API, so this drives the CDP Input domain directly.
 */
export async function swipeDown(
  page: Page,
  x: number,
  startY: number,
  endY: number,
  steps = 8,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  const point = (y: number) => [{ x, y, id: 1 }];

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: point(startY),
  });

  for (let i = 1; i <= steps; i++) {
    const y = startY + ((endY - startY) * i) / steps;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(y),
    });
  }

  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

/**
 * Registers a CDP virtual WebAuthn platform authenticator so app-lock's
 * navigator.credentials.create/get calls (src/lib/app-lock.ts) succeed
 * without a real device authenticator.
 */
export async function addVirtualAuthenticator(page: Page): Promise<{
  authenticatorId: string;
  remove: () => Promise<void>;
}> {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    },
  );
  return {
    authenticatorId,
    remove: async () => {
      await client.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    },
  };
}
