import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// app-lock.ts caches session-unlock state in module-level singletons, so each
// test needs a fresh module instance.
async function freshAppLock() {
  vi.resetModules();
  return import("@/lib/app-lock");
}

/**
 * A fake `PublicKeyCredential`/assertion. `extensionResults` defaults to
 * empty, i.e. a device that doesn't support the PRF extension — pass
 * `{ prf: { enabled: true } }` (create) or `{ prf: { results: { first } } }`
 * (get) to simulate one that does.
 */
function fakeCredential(
  rawId: ArrayBuffer,
  extensionResults: AuthenticationExtensionsClientOutputs = {},
): PublicKeyCredential {
  return {
    rawId,
    getClientExtensionResults: () => extensionResults,
  } as unknown as PublicKeyCredential;
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSessionUnlocked", () => {
  it("starts false", async () => {
    const { isSessionUnlocked } = await freshAppLock();
    expect(isSessionUnlocked()).toBe(false);
  });
});

describe("isLockedOnServer", () => {
  it("is always false", async () => {
    const { isLockedOnServer } = await freshAppLock();
    expect(isLockedOnServer()).toBe(false);
  });
});

describe("subscribeToUnlock", () => {
  it("notifies a subscribed listener when the session unlocks", async () => {
    vi.stubGlobal("navigator", {
      credentials: {
        create: vi
          .fn()
          .mockResolvedValue(fakeCredential(new Uint8Array([1]).buffer)),
      },
    });
    const { enrolAppLock, subscribeToUnlock } = await freshAppLock();
    const listener = vi.fn();
    subscribeToUnlock(listener);

    await enrolAppLock();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribing", async () => {
    const { disableAppLock, subscribeToUnlock } = await freshAppLock();
    const listener = vi.fn();
    const unsubscribe = subscribeToUnlock(listener);
    unsubscribe();

    disableAppLock();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("isAppLockSupported", () => {
  it("is false without a secure context", async () => {
    vi.stubGlobal("isSecureContext", false);
    const { isAppLockSupported } = await freshAppLock();
    await expect(isAppLockSupported()).resolves.toBe(false);
  });

  it("is false when PublicKeyCredential is unavailable", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("PublicKeyCredential", undefined);
    const { isAppLockSupported } = await freshAppLock();
    await expect(isAppLockSupported()).resolves.toBe(false);
  });

  it("reflects the platform authenticator check", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("PublicKeyCredential", {
      isUserVerifyingPlatformAuthenticatorAvailable: vi
        .fn()
        .mockResolvedValue(true),
    });
    const { isAppLockSupported } = await freshAppLock();
    await expect(isAppLockSupported()).resolves.toBe(true);
  });

  it("is false if the platform check throws", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("PublicKeyCredential", {
      isUserVerifyingPlatformAuthenticatorAvailable: vi
        .fn()
        .mockRejectedValue(new Error("nope")),
    });
    const { isAppLockSupported } = await freshAppLock();
    await expect(isAppLockSupported()).resolves.toBe(false);
  });
});

describe("enrolAppLock", () => {
  it("stores the credential, marks the session unlocked, and returns the enrolment", async () => {
    const rawId = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue(fakeCredential(rawId)) },
    });
    const { enrolAppLock, isSessionUnlocked } = await freshAppLock();
    const { getSettingsSnapshot } = await import("@/lib/settings");

    const enrolment = await enrolAppLock();

    expect(enrolment.credentialId).toBeTypeOf("string");
    expect(enrolment.userId).toBeTypeOf("string");
    expect(getSettingsSnapshot().lock?.credentialId).toBe(
      enrolment.credentialId,
    );
    expect(isSessionUnlocked()).toBe(true);
  });

  it("throws when the platform returns no credential", async () => {
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue(null) },
    });
    const { enrolAppLock } = await freshAppLock();
    await expect(enrolAppLock()).rejects.toThrow(
      "The device did not return a credential.",
    );
  });

  it("falls back to lock-only when the device doesn't support PRF", async () => {
    const rawId = new Uint8Array([1, 2, 3]).buffer;
    const create = vi.fn().mockResolvedValue(fakeCredential(rawId));
    const get = vi.fn();
    vi.stubGlobal("navigator", { credentials: { create, get } });

    const { enrolAppLock } = await freshAppLock();
    const enrolment = await enrolAppLock();

    expect(enrolment.encryptionSupported).toBe(false);
    expect(enrolment.prfSalt).toBeUndefined();
    // No PRF support means no reason to ask for the secret at all.
    expect(get).not.toHaveBeenCalled();
  });

  it("derives and applies an encryption key when the device supports PRF", async () => {
    const rawId = new Uint8Array([1, 2, 3]).buffer;
    const prfSecret = new Uint8Array(32).fill(7).buffer;
    const create = vi
      .fn()
      .mockResolvedValue(fakeCredential(rawId, { prf: { enabled: true } }));
    const get = vi
      .fn()
      .mockResolvedValue(
        fakeCredential(rawId, { prf: { results: { first: prfSecret } } }),
      );
    vi.stubGlobal("navigator", { credentials: { create, get } });

    const { enrolAppLock } = await freshAppLock();
    const { getSettingsSnapshot } = await import("@/lib/settings");

    const enrolment = await enrolAppLock();

    expect(enrolment.encryptionSupported).toBe(true);
    expect(enrolment.prfSalt).toBeTypeOf("string");
    expect(getSettingsSnapshot().lock?.encryptionSupported).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("stays lock-only when PRF is enabled but returns no secret", async () => {
    const rawId = new Uint8Array([1, 2, 3]).buffer;
    const create = vi
      .fn()
      .mockResolvedValue(fakeCredential(rawId, { prf: { enabled: true } }));
    const get = vi.fn().mockResolvedValue(fakeCredential(rawId));
    vi.stubGlobal("navigator", { credentials: { create, get } });

    const { enrolAppLock } = await freshAppLock();
    const enrolment = await enrolAppLock();

    expect(enrolment.encryptionSupported).toBe(false);
    expect(enrolment.prfSalt).toBeUndefined();
  });
});

describe("verifyAppLock", () => {
  const lockOnlyEnrolment = {
    credentialId: "AQID",
    userId: "u1",
    createdAt: "now",
    encryptionSupported: false,
  };
  const encryptedEnrolment = {
    credentialId: "AQID",
    userId: "u1",
    createdAt: "now",
    encryptionSupported: true,
    prfSalt: "c2FsdA",
  };

  it("unlocks the session when the assertion succeeds (lock-only)", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockResolvedValue({}) },
    });
    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(lockOnlyEnrolment)).resolves.toBe(true);
    expect(isSessionUnlocked()).toBe(true);
  });

  it("does not unlock when the assertion is null", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockResolvedValue(null) },
    });
    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(lockOnlyEnrolment)).resolves.toBe(false);
    expect(isSessionUnlocked()).toBe(false);
  });

  it("resolves false instead of throwing when the platform rejects", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockRejectedValue(new Error("cancelled")) },
    });
    const { verifyAppLock } = await freshAppLock();
    await expect(verifyAppLock(lockOnlyEnrolment)).resolves.toBe(false);
  });

  it("derives the key and unlocks in one prompt when PRF eval succeeds", async () => {
    const prfSecret = new Uint8Array(32).fill(9).buffer;
    const get = vi.fn().mockResolvedValue(
      fakeCredential(new Uint8Array([1]).buffer, {
        prf: { results: { first: prfSecret } },
      }),
    );
    vi.stubGlobal("navigator", { credentials: { get } });

    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(encryptedEnrolment)).resolves.toBe(true);
    expect(isSessionUnlocked()).toBe(true);
    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: expect.objectContaining({
          extensions: { prf: { eval: { first: expect.any(Uint8Array) } } },
        }),
      }),
    );
  });

  it("fails verification when PRF was expected but not returned", async () => {
    // Without the key the data can never be decrypted — a "pass" with no
    // key would just strand the user, so this must fail closed.
    vi.stubGlobal("navigator", {
      credentials: {
        get: vi
          .fn()
          .mockResolvedValue(fakeCredential(new Uint8Array([1]).buffer)),
      },
    });
    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(encryptedEnrolment)).resolves.toBe(false);
    expect(isSessionUnlocked()).toBe(false);
  });
});

describe("disableAppLock", () => {
  it("clears the stored lock and marks the session unlocked", async () => {
    // Kept to one module generation throughout (rather than setting the lock
    // via one settings.ts instance and clearing it via another): settings.ts
    // now persists to IndexedDB in the background, so bridging a lock across
    // a `vi.resetModules()` gap can't be relied on to be durable by the time
    // the next instance reads it back.
    const { disableAppLock, isSessionUnlocked } = await freshAppLock();
    const { setLockEnrolment, getSettingsSnapshot } =
      await import("@/lib/settings");
    setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: false,
    });

    disableAppLock();

    expect(getSettingsSnapshot().lock).toBeNull();
    expect(isSessionUnlocked()).toBe(true);
  });
});

describe("disableAppLockAndEraseData", () => {
  it("clears the lock, wipes routine data, and marks the session unlocked", async () => {
    const { disableAppLockAndEraseData, isSessionUnlocked } =
      await freshAppLock();
    const { setLockEnrolment, getSettingsSnapshot } =
      await import("@/lib/settings");
    const { saveRoutine, getRawData } = await import("@/lib/storage");
    setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });

    disableAppLockAndEraseData();

    expect(getSettingsSnapshot().lock).toBeNull();
    expect(getRawData()).toEqual({ routines: [], state: {} });
    expect(isSessionUnlocked()).toBe(true);
  });
});
