import { beforeEach, describe, expect, it, vi } from "vitest";

import { PREFERENCE_KEYS, SETTINGS_KEY } from "@/lib/storage-keys";

// read()'s `typeof window === "undefined"` guard is tested in
// ssr-guards.test.ts, not here — see storage.test.ts's equivalent comment
// for why it needs its own file (a Node environment, not jsdom).
//
// settings.ts caches its snapshot in module-level state, so each test needs a
// fresh module instance.
async function freshSettings() {
  vi.resetModules();
  return import("@/lib/settings");
}

beforeEach(() => {
  localStorage.clear();
});

describe("getSettingsSnapshot", () => {
  it("defaults to no lock when nothing is stored", async () => {
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null });
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
    });
  });

  it("falls back to defaults for malformed JSON", async () => {
    localStorage.setItem(SETTINGS_KEY, "{not json");
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null });
  });

  it("drops a lock missing required fields instead of returning it half-formed", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ lock: { credentialId: "c1" } }),
    );
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null });
  });

  it("drops a lock that isn't an object at all", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lock: "oops" }));
    const { getSettingsSnapshot } = await freshSettings();
    expect(getSettingsSnapshot()).toEqual({ lock: null });
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
  it("returns the defaults (no lock)", async () => {
    const { getServerSettingsSnapshot } = await freshSettings();
    expect(getServerSettingsSnapshot()).toEqual({ lock: null });
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
    expect(getSettingsSnapshot()).toEqual({ lock: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("resetPreferences", () => {
  it("clears every preference key, resets the snapshot, and notifies listeners", async () => {
    const {
      setLockEnrolment,
      resetPreferences,
      getSettingsSnapshot,
      subscribeToSettings,
    } = await freshSettings();
    setLockEnrolment({ credentialId: "c1", userId: "u1", createdAt: "now" });
    localStorage.setItem("routines-locale", "pl");

    const listener = vi.fn();
    subscribeToSettings(listener);

    resetPreferences();

    for (const key of PREFERENCE_KEYS) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(getSettingsSnapshot()).toEqual({ lock: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("leaves routine data untouched", async () => {
    const { resetPreferences } = await freshSettings();
    localStorage.setItem("routines-data", JSON.stringify({ keep: true }));
    resetPreferences();
    expect(localStorage.getItem("routines-data")).toBe(
      JSON.stringify({ keep: true }),
    );
  });
});
