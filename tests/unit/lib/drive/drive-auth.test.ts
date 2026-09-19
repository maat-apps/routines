import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DriveAuthError,
  requestDriveAccessToken,
} from "@/lib/drive/drive-auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestDriveAccessToken", () => {
  it("rejects without asking Google when no client id is configured", async () => {
    await expect(requestDriveAccessToken("")).rejects.toThrow(DriveAuthError);
  });

  it("resolves with the access token on a successful sign-in", async () => {
    const requestAccessToken = vi.fn();
    const initTokenClient = vi.fn((config) => {
      queueMicrotask(() => config.callback({ access_token: "the-token" }));
      return { requestAccessToken };
    });
    vi.stubGlobal("google", { accounts: { oauth2: { initTokenClient } } });

    const token = await requestDriveAccessToken("client-id");

    expect(token).toBe("the-token");
    expect(initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "client-id",
        scope: expect.stringContaining("drive.file"),
      }),
    );
    expect(requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it("rejects when Google reports an error instead of a token", async () => {
    const initTokenClient = vi.fn((config) => {
      queueMicrotask(() => config.callback({ error: "access_denied" }));
      return { requestAccessToken: vi.fn() };
    });
    vi.stubGlobal("google", { accounts: { oauth2: { initTokenClient } } });

    await expect(requestDriveAccessToken("client-id")).rejects.toThrow(
      DriveAuthError,
    );
  });

  it("rejects when the sign-in is cancelled (error_callback)", async () => {
    const initTokenClient = vi.fn((config) => {
      queueMicrotask(() =>
        config.error_callback({ type: "popup_closed", message: "closed" }),
      );
      return { requestAccessToken: vi.fn() };
    });
    vi.stubGlobal("google", { accounts: { oauth2: { initTokenClient } } });

    await expect(requestDriveAccessToken("client-id")).rejects.toThrow(
      "closed",
    );
  });

  it("rejects when the script fails to load (network error)", async () => {
    vi.stubGlobal("google", undefined);
    // No <script> will actually load in this environment; loadGoogleIdentityServices
    // appends a tag and waits for onload/onerror, which jsdom never fires for a
    // src it can't fetch — simulate that failure directly instead of waiting on it.
    const appendChild = vi.spyOn(document.head, "append");

    const pending = requestDriveAccessToken("client-id");
    // Fire the script's onerror the way a real network failure would.
    const script = appendChild.mock.calls[0]?.[0] as HTMLScriptElement;
    script.onerror?.(new Event("error"));

    await expect(pending).rejects.toThrow(DriveAuthError);
    appendChild.mockRestore();
  });

  it("rejects when the script loads but never defines google.accounts.oauth2", async () => {
    vi.stubGlobal("google", undefined);
    const appendChild = vi.spyOn(document.head, "append");

    const pending = requestDriveAccessToken("client-id");
    // The script tag reports success, but (unlike every other test here) no
    // stub ever sets window.google — simulating a response that loaded fine
    // over the network but wasn't actually the GIS client library.
    const script = appendChild.mock.calls[0]?.[0] as HTMLScriptElement;
    script.onload?.(new Event("load"));

    await expect(pending).rejects.toThrow(
      "Google Identity Services failed to load.",
    );
    appendChild.mockRestore();
  });
});
