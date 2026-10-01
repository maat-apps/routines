import { fromBase64Url } from "@maat-apps/core/crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// The lock's own behavior (enrol/verify/disable, PRF, the session state) is
// tested in @maat-apps/core/lock. These tests cover routines' wiring: the
// enrolment lives in settings, the key derives from routines' HKDF info, and
// rewrite/erase reach routines' data and update snapshot.

const RAW_ID = new Uint8Array([1, 2, 3]).buffer;
const PRF_SECRET = new Uint8Array(32).fill(7).buffer;

function fakeCredential(
  extensionResults: AuthenticationExtensionsClientOutputs = {},
): PublicKeyCredential {
  return {
    rawId: RAW_ID,
    getClientExtensionResults: () => extensionResults,
  } as unknown as PublicKeyCredential;
}

function stubPrfDevice() {
  vi.stubGlobal("navigator", {
    credentials: {
      create: vi
        .fn()
        .mockResolvedValue(fakeCredential({ prf: { enabled: true } })),
      get: vi
        .fn()
        .mockResolvedValue(
          fakeCredential({ prf: { results: { first: PRF_SECRET } } }),
        ),
    },
  });
}

const routine = {
  id: "r1",
  name: "A",
  order: 0,
  activeDays: [0, 1, 2, 3, 4, 5, 6],
  steps: [],
};

// Module-level state (session unlock, key, loaded data) — a fresh module
// graph per test.
async function freshModules() {
  vi.resetModules();
  const settings = await import("@/lib/settings");
  await settings.whenLoaded();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  const { appLock } = await import("@/lib/app-lock");
  const { kvGet } = await import("@/lib/idb-store");
  const crypto = await import("@/lib/webauthn-crypto");
  return { settings, storage, appLock, kvGet, crypto };
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appLock", () => {
  it("stores the enrolment in settings", async () => {
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue(fakeCredential()) },
    });
    const { settings, appLock } = await freshModules();

    const enrolment = await appLock.enrol();

    expect(settings.getSettingsSnapshot().lock).toEqual(enrolment);
  });

  it("re-saves existing routines encrypted with routines' key on enrolment", async () => {
    stubPrfDevice();
    const { storage, appLock, kvGet, crypto } = await freshModules();
    storage.saveRoutine(routine);

    const { prfSalt } = await appLock.enrol();

    const key = await crypto.deriveKey(PRF_SECRET, fromBase64Url(prfSalt!));
    await vi.waitFor(async () => {
      const stored = await kvGet(DATA_KEY);
      expect(crypto.isEncryptedBlob(stored)).toBe(true);
      const data = await crypto.decryptJson<{ routines: unknown[] }>(
        key,
        stored as Parameters<typeof crypto.decryptJson>[1],
      );
      expect(data.routines).toHaveLength(1);
    });
  });

  it("clears the enrolment and writes routines back unencrypted on disable", async () => {
    stubPrfDevice();
    const { settings, storage, appLock, kvGet, crypto } = await freshModules();
    storage.saveRoutine(routine);
    await appLock.enrol();

    appLock.disable();

    expect(settings.getSettingsSnapshot().lock).toBeNull();
    await vi.waitFor(async () => {
      const stored = await kvGet(DATA_KEY);
      expect(crypto.isEncryptedBlob(stored)).toBe(false);
    });
  });

  it("wipes routines and the update snapshot on disableAndErase", async () => {
    const { settings, storage, appLock } = await freshModules();
    const appUpdate = await import("@/lib/app-update");
    storage.saveRoutine(routine);
    await appUpdate.saveUpdateSnapshot();

    await appLock.disableAndErase();

    expect(settings.getSettingsSnapshot().lock).toBeNull();
    expect(storage.getRawData()).toEqual({ routines: [], state: {} });
    expect(appUpdate.hasUpdateSnapshot()).toBe(false);
  });
});
