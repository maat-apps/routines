import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// app-lock.ts caches session-unlock state in module-level singletons, so each
// test needs a fresh module instance.
async function freshAppLock() {
  vi.resetModules();
  return import("@/lib/app-lock");
}

function fakeCredential(rawId: ArrayBuffer): PublicKeyCredential {
  return { rawId } as PublicKeyCredential;
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
});

describe("verifyAppLock", () => {
  const enrolment = { credentialId: "AQID", userId: "u1", createdAt: "now" };

  it("unlocks the session when the assertion succeeds", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockResolvedValue({}) },
    });
    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(enrolment)).resolves.toBe(true);
    expect(isSessionUnlocked()).toBe(true);
  });

  it("does not unlock when the assertion is null", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockResolvedValue(null) },
    });
    const { verifyAppLock, isSessionUnlocked } = await freshAppLock();
    await expect(verifyAppLock(enrolment)).resolves.toBe(false);
    expect(isSessionUnlocked()).toBe(false);
  });

  it("resolves false instead of throwing when the platform rejects", async () => {
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockRejectedValue(new Error("cancelled")) },
    });
    const { verifyAppLock } = await freshAppLock();
    await expect(verifyAppLock(enrolment)).resolves.toBe(false);
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
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });

    disableAppLock();

    expect(getSettingsSnapshot().lock).toBeNull();
    expect(isSessionUnlocked()).toBe(true);
  });
});
