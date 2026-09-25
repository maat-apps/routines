import { beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_KEY, LOCALE_KEY, SETTINGS_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// idb-store.ts caches its open connection in module-level state (dbPromise),
// so each test needs a fresh module instance — otherwise one test's open
// connection (and the "routines" database it already migrated) would bleed
// into the next.
async function freshIdbStore() {
  vi.resetModules();
  return import("@/lib/idb-store");
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

describe("kvGet / kvSet / kvDelete", () => {
  it("returns undefined for a key that was never set", async () => {
    const { kvGet } = await freshIdbStore();
    await expect(kvGet("missing")).resolves.toBeUndefined();
  });

  it("round-trips a value", async () => {
    const { kvGet, kvSet } = await freshIdbStore();
    await kvSet("k", { a: 1 });
    await expect(kvGet("k")).resolves.toEqual({ a: 1 });
  });

  it("overwrites an existing value", async () => {
    const { kvGet, kvSet } = await freshIdbStore();
    await kvSet("k", "first");
    await kvSet("k", "second");
    await expect(kvGet("k")).resolves.toBe("second");
  });

  it("deletes a value", async () => {
    const { kvGet, kvSet, kvDelete } = await freshIdbStore();
    await kvSet("k", "v");
    await kvDelete("k");
    await expect(kvGet("k")).resolves.toBeUndefined();
  });

  it("deleting a key that was never set is a no-op", async () => {
    const { kvDelete } = await freshIdbStore();
    await expect(kvDelete("missing")).resolves.toBeUndefined();
  });
});

describe("one-time migration from localStorage", () => {
  it("migrates all legacy keys and clears them", async () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ routines: [], state: {} }));
    // A bare string, not JSON — locale-store.ts wrote it directly, unlike
    // every other key, which stored a JSON.stringify'd object.
    localStorage.setItem(LOCALE_KEY, "pl");
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ lock: null, installed: true }),
    );

    const { kvGet } = await freshIdbStore();
    await expect(kvGet(DATA_KEY)).resolves.toEqual({
      routines: [],
      state: {},
    });
    await expect(kvGet(LOCALE_KEY)).resolves.toBe("pl");
    await expect(kvGet(SETTINGS_KEY)).resolves.toEqual({
      lock: null,
      installed: true,
    });

    for (const key of [DATA_KEY, LOCALE_KEY, SETTINGS_KEY]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
  });

  it("skips a corrupt legacy value instead of failing the whole migration", async () => {
    localStorage.setItem(DATA_KEY, "{not json");
    localStorage.setItem(LOCALE_KEY, "en");

    const { kvGet } = await freshIdbStore();
    await expect(kvGet(DATA_KEY)).resolves.toBeUndefined();
    await expect(kvGet(LOCALE_KEY)).resolves.toBe("en");
    // Never migrated, so left in place rather than silently dropped.
    expect(localStorage.getItem(DATA_KEY)).toBe("{not json");
  });

  it("tolerates localStorage being unavailable during migration", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const { kvGet } = await freshIdbStore();
    await expect(kvGet(DATA_KEY)).resolves.toBeUndefined();
    getItem.mockRestore();
  });

  it("tolerates localStorage being unavailable when clearing migrated keys", async () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ routines: [], state: {} }));
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const { kvGet } = await freshIdbStore();
    await expect(kvGet(DATA_KEY)).resolves.toEqual({
      routines: [],
      state: {},
    });
    removeItem.mockRestore();
  });

  it("does nothing when no legacy keys exist", async () => {
    const { kvGet } = await freshIdbStore();
    await expect(kvGet(DATA_KEY)).resolves.toBeUndefined();
  });

  it("only runs once — a second connection sees the migrated data without re-reading localStorage", async () => {
    localStorage.setItem(LOCALE_KEY, "pl");
    const { kvGet: firstGet } = await freshIdbStore();
    await firstGet(LOCALE_KEY);

    // localStorage was already cleared by the first migration; a second
    // fresh module instance opening the same (now-existing) database must
    // not need it again.
    const { kvGet: secondGet } = await freshIdbStore();
    await expect(secondGet(LOCALE_KEY)).resolves.toBe("pl");
  });
});
