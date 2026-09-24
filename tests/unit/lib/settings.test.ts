import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERENCE_KEYS, SETTINGS_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// read()'s `typeof window === "undefined"` guard is tested in
// ssr-guards.test.ts, not here — see storage.test.ts's equivalent comment
// for why it needs its own file (a Node environment, not jsdom).
//
// settings.ts caches its data in module-level state, so each test needs a
// fresh module instance. Data now loads from IndexedDB in the background, so
// this also awaits `whenLoaded()` before handing the module back — tests
// seed via `localStorage.setItem` exactly as before, and idb-store.ts's
// one-time migration (triggered because resetIndexedDb() below leaves no
// database for the next freshSettings() to find) picks it up from there.
// idb-store's kvGet is re-imported alongside it (not statically at the top
// of this file) since a static binding wouldn't follow `vi.resetModules()`
// and would end up pointed at a closed connection from a previous test.
async function freshSettings() {
  vi.resetModules();
  const settings = await import("@/lib/settings");
  await settings.whenLoaded();
  const { kvGet } = await import("@/lib/idb-store");
  return { ...settings, kvGet };
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

describe("getSettingsSnapshot", () => {
  it("defaults to no lock and not installed when nothing is stored", async () => {
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
  });

  it("parses a validly stored lock", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        lock: { credentialId: "c1", userId: "u1", createdAt: "2026-09-17" },
      }),
    );
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({
      lock: { credentialId: "c1", userId: "u1", createdAt: "2026-09-17" },
      installed: false,
    });
  });

  it("parses a stored installed flag", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ installed: true }));
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: true });
  });

  it("falls back to defaults for malformed JSON", async () => {
    localStorage.setItem(SETTINGS_KEY, "{not json");
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
  });

  it("drops a lock missing required fields instead of returning it half-formed", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ lock: { credentialId: "c1" } }),
    );
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
  });

  it("drops a lock that isn't an object at all", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lock: "oops" }));
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
  });

  it("generates a createdAt when the stored lock is missing one", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ lock: { credentialId: "c1", userId: "u1" } }),
    );
    const { getSettingsSnapshot } = await freshSettings();
    const { createdAt } = getSettingsSnapshot().lock!;
    expect(typeof createdAt).toBe("string");
    expect(() => new Date(createdAt).toISOString()).not.toThrow();
  });
});

describe("getServerSettingsSnapshot", () => {
  it("returns the defaults (no lock, not installed)", async () => {
    const { getServerSettingsSnapshot } = await freshSettings();
    expect(getServerSettingsSnapshot()).toEqual({
      lock: null,
      installed: false,
    });
  });
});

describe("isSettingsReady / isSettingsReadyOnServer", () => {
  it("becomes true once the initial load has resolved", async () => {
    const { isSettingsReady, whenLoaded } = await freshSettings();
    await whenLoaded();
    expect(isSettingsReady()).toBe(true);
  });

  it("isSettingsReadyOnServer always reports not ready", async () => {
    const { isSettingsReadyOnServer } = await freshSettings();
    expect(isSettingsReadyOnServer()).toBe(false);
  });
});

describe("setLockEnrolment / clearLockEnrolment", () => {
  it("persists a lock, updates the snapshot, and notifies listeners", async () => {
    const { setLockEnrolment, getSettingsSnapshot, subscribeToSettings } =
      await freshSettings();
    const listener = vi.fn();
    subscribeToSettings(listener);
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });
    expect(getSettingsSnapshot()).toEqual({
      lock: { credentialId: "c1", userId: "u1", createdAt: "now" },
      installed: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribing", async () => {
    const { setLockEnrolment, subscribeToSettings } = await freshSettings();
    const listener = vi.fn();
    const unsubscribe = subscribeToSettings(listener);
    unsubscribe();
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("clears the lock and notifies listeners", async () => {
    const {
      setLockEnrolment,
      clearLockEnrolment,
      getSettingsSnapshot,
      subscribeToSettings,
    } = await freshSettings();
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });
    const listener = vi.fn();
    subscribeToSettings(listener);
    clearLockEnrolment();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("markInstalled", () => {
  it("persists installed, updates the snapshot, and notifies listeners", async () => {
    const { markInstalled, getSettingsSnapshot, subscribeToSettings } =
      await freshSettings();
    const listener = vi.fn();
    subscribeToSettings(listener);
    markInstalled();
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is a no-op once already installed", async () => {
    const { markInstalled, subscribeToSettings } = await freshSettings();
    markInstalled();
    const listener = vi.fn();
    subscribeToSettings(listener);
    markInstalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("resetPreferences", () => {
  it("clears every preference key from IndexedDB, resets the snapshot, and notifies listeners", async () => {
    const {
      setLockEnrolment,
      markInstalled,
      resetPreferences,
      getSettingsSnapshot,
      subscribeToSettings,
      kvGet,
    } = await freshSettings();
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });
    markInstalled();

    const listener = vi.fn();
    subscribeToSettings(listener);

    await resetPreferences();

    for (const key of PREFERENCE_KEYS) {
      await expect(kvGet(key)).resolves.toBeUndefined();
    }
    expect(getSettingsSnapshot()).toEqual({ lock: null, installed: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves routine data untouched", async () => {
    const { resetPreferences } = await freshSettings();
    localStorage.setItem("routines-data", JSON.stringify({ keep: true }));
    await resetPreferences();
    expect(localStorage.getItem("routines-data")).toBe(
      JSON.stringify({ keep: true }),
    );
  });
});
