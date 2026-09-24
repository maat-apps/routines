import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SNAPSHOT_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// app-update.ts's existence flag and storage.ts's data both cache in
// module-level state, so each test needs fresh instances — otherwise one
// test's snapshot/routine data would bleed into the next.
async function freshAppUpdate() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  const appUpdate = await import("@/lib/app-update");
  await appUpdate.whenLoaded();
  const idbStore = await import("@/lib/idb-store");
  return { storage, appUpdate, idbStore };
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // vi.spyOn(Storage.prototype, ...) isn't undone by unstubAllGlobals — with
  // isolate: false, Storage.prototype is the same real object shared across
  // every test file in the run, so an un-restored spy here would otherwise
  // leak into whatever runs next.
  vi.restoreAllMocks();
});

describe("hasUpdateSnapshot / hasNoUpdateSnapshotOnServer", () => {
  it("is false when nothing is stored", async () => {
    const { appUpdate } = await freshAppUpdate();
    expect(appUpdate.hasUpdateSnapshot()).toBe(false);
  });

  it("is true once a snapshot exists", async () => {
    localStorage.setItem(SNAPSHOT_KEY, "{}");
    const { appUpdate } = await freshAppUpdate();
    expect(appUpdate.hasUpdateSnapshot()).toBe(true);
  });

  it("is false instead of throwing when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const { appUpdate } = await freshAppUpdate();
    expect(appUpdate.hasUpdateSnapshot()).toBe(false);
  });

  it("the server snapshot is always false", async () => {
    const { appUpdate } = await freshAppUpdate();
    expect(appUpdate.hasNoUpdateSnapshotOnServer()).toBe(false);
  });
});

describe("subscribeToUpdateSnapshot", () => {
  it("stops notifying after unsubscribing", async () => {
    const { appUpdate } = await freshAppUpdate();
    const listener = vi.fn();
    const unsubscribe = appUpdate.subscribeToUpdateSnapshot(listener);
    unsubscribe();
    await appUpdate.saveUpdateSnapshot();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("saveUpdateSnapshot / readUpdateSnapshot", () => {
  it("saves the current data as a backup and notifies listeners", async () => {
    const { appUpdate, storage } = await freshAppUpdate();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    const listener = vi.fn();
    appUpdate.subscribeToUpdateSnapshot(listener);

    const backup = await appUpdate.saveUpdateSnapshot();

    expect(backup?.data.routines).toEqual([
      {
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
    ]);
    expect(appUpdate.hasUpdateSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns null instead of throwing when the write fails", async () => {
    const { appUpdate, idbStore } = await freshAppUpdate();
    vi.spyOn(idbStore, "kvSet").mockRejectedValue(new Error("blocked"));
    await expect(appUpdate.saveUpdateSnapshot()).resolves.toBeNull();
  });

  it("reads back what was saved", async () => {
    const { appUpdate, storage } = await freshAppUpdate();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    await appUpdate.saveUpdateSnapshot();
    const snapshot = await appUpdate.readUpdateSnapshot();
    expect(snapshot?.data.routines).toEqual([
      {
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
    ]);
  });

  it("returns null when nothing is stored", async () => {
    const { appUpdate } = await freshAppUpdate();
    await expect(appUpdate.readUpdateSnapshot()).resolves.toBeNull();
  });

  it("returns null instead of throwing for a corrupted snapshot", async () => {
    localStorage.setItem(SNAPSHOT_KEY, "{not json");
    const { appUpdate } = await freshAppUpdate();
    await expect(appUpdate.readUpdateSnapshot()).resolves.toBeNull();
  });
});

describe("restoreUpdateSnapshot", () => {
  it("returns false when there is nothing to restore", async () => {
    const { appUpdate } = await freshAppUpdate();
    await expect(appUpdate.restoreUpdateSnapshot()).resolves.toBe(false);
  });

  it("restores the snapshot's data", async () => {
    const { appUpdate, storage } = await freshAppUpdate();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    await appUpdate.saveUpdateSnapshot();
    storage.saveRoutine({
      id: "r2",
      name: "Evening",
      order: 1,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });

    await expect(appUpdate.restoreUpdateSnapshot()).resolves.toBe(true);
    expect(storage.getRawData().routines.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("discardUpdateSnapshot", () => {
  it("removes the snapshot and notifies listeners", async () => {
    localStorage.setItem(SNAPSHOT_KEY, "{}");
    const { appUpdate } = await freshAppUpdate();
    const listener = vi.fn();
    appUpdate.subscribeToUpdateSnapshot(listener);

    await appUpdate.discardUpdateSnapshot();

    expect(appUpdate.hasUpdateSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("updateApp", () => {
  it("saves a snapshot and reloads the page", async () => {
    const { appUpdate, storage } = await freshAppUpdate();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    // jsdom's window.location.reload isn't configurable, so it can't be
    // spied on directly — vi.stubGlobal replaces the whole object instead,
    // and (unlike a raw Object.defineProperty) restores it safely even when
    // the environment is reused across files (isolate: false).
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await appUpdate.updateApp();

    expect(appUpdate.hasUpdateSnapshot()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("updates a waiting service worker registration", async () => {
    const { appUpdate } = await freshAppUpdate();
    // jsdom has no ServiceWorkerContainer at all, so "serviceWorker" in
    // navigator is normally false and this branch is never exercised —
    // stub navigator wholesale (as app-lock.test.ts already does) rather
    // than trying to patch a container that doesn't exist.
    const update = vi.fn().mockResolvedValue(undefined);
    const postMessage = vi.fn();
    const getRegistration = vi.fn().mockResolvedValue({
      update,
      waiting: { postMessage },
    });
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
    vi.stubGlobal("location", { reload: vi.fn() });

    await appUpdate.updateApp();

    expect(update).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("still reloads if the service worker check throws", async () => {
    const { appUpdate } = await freshAppUpdate();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn().mockRejectedValue(new Error("nope")),
      },
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await appUpdate.updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears every cache", async () => {
    const { appUpdate } = await freshAppUpdate();
    // jsdom has no Cache Storage API either, so "caches" in window is
    // normally false — same reasoning as the service worker case above.
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["cache-a", "cache-b"]),
      delete: deleteCache,
    });
    vi.stubGlobal("location", { reload: vi.fn() });

    await appUpdate.updateApp();

    expect(deleteCache).toHaveBeenCalledWith("cache-a");
    expect(deleteCache).toHaveBeenCalledWith("cache-b");
    expect(deleteCache).toHaveBeenCalledTimes(2);
  });

  it("still reloads if clearing caches throws", async () => {
    const { appUpdate } = await freshAppUpdate();
    vi.stubGlobal("caches", {
      keys: vi.fn().mockRejectedValue(new Error("nope")),
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await appUpdate.updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("setEncryptionKey", () => {
  it("saves and reads back an encrypted snapshot", async () => {
    const { appUpdate, storage, idbStore } = await freshAppUpdate();
    const { deriveKey, isEncryptedBlob, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const key = await deriveKey(randomBytes(32), randomBytes(16));
    appUpdate.setEncryptionKey(key);

    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    await appUpdate.saveUpdateSnapshot();

    const stored = await idbStore.kvGet(SNAPSHOT_KEY);
    expect(isEncryptedBlob(stored)).toBe(true);

    const snapshot = await appUpdate.readUpdateSnapshot();
    expect(snapshot?.data.routines.map((r) => r.id)).toEqual(["r1"]);
  });

  it("fails to read back an encrypted snapshot with the wrong key", async () => {
    const { appUpdate, storage } = await freshAppUpdate();
    const { deriveKey, randomBytes } = await import("@/lib/webauthn-crypto");
    appUpdate.setEncryptionKey(
      await deriveKey(randomBytes(32), randomBytes(16)),
    );
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    await appUpdate.saveUpdateSnapshot();

    appUpdate.setEncryptionKey(
      await deriveKey(randomBytes(32), randomBytes(16)),
    );
    await expect(appUpdate.readUpdateSnapshot()).resolves.toBeNull();
  });
});
