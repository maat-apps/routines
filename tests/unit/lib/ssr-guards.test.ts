// @vitest-environment node
//
// storage.ts/settings.ts/locale-store.ts each guard their localStorage
// access with `typeof window === "undefined"`, for a build-time/SSR
// context that never happens in this app at runtime (it's a plain SPA —
// see CLAUDE.md) but is cheap insurance against a future static-render
// step. jsdom can never produce a real "no window" — every other test
// file runs under it — so this is the one file in the suite that opts
// into Vitest's node environment instead, specifically to exercise that
// branch for real rather than leaving it permanently uncovered.
import { describe, expect, it } from "vitest";

describe('typeof window === "undefined" guards', () => {
  it("storage.ts's getRawData returns empty data", async () => {
    const { getRawData } = await import("@/lib/storage");
    expect(getRawData()).toEqual({ routines: [], state: {} });
  });

  it("settings.ts's getSettingsSnapshot returns the defaults", async () => {
    const { getSettingsSnapshot } = await import("@/lib/settings");
    expect(getSettingsSnapshot()).toEqual({ lock: null });
  });

  it("locale-store.ts's getLocaleSnapshot returns the default locale", async () => {
    const { getLocaleSnapshot, DEFAULT_LOCALE } =
      await import("@/lib/locale-store");
    expect(getLocaleSnapshot()).toBe(DEFAULT_LOCALE);
  });

  it("drive-auth.ts's requestDriveAccessToken rejects instead of touching `window`", async () => {
    const { requestDriveAccessToken, DriveAuthError } =
      await import("@/lib/drive/drive-auth");
    await expect(requestDriveAccessToken("client-id")).rejects.toThrow(
      DriveAuthError,
    );
  });

  it("drive-sync.ts's getDriveSyncMeta returns the defaults", async () => {
    const { getDriveSyncMeta } = await import("@/lib/drive/drive-sync");
    expect(getDriveSyncMeta()).toEqual({ fileId: null, lastSyncedAt: null });
  });
});
