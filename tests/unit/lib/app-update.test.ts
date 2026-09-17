import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  discardUpdateSnapshot,
  hasNoUpdateSnapshotOnServer,
  hasUpdateSnapshot,
  readUpdateSnapshot,
  restoreUpdateSnapshot,
  saveUpdateSnapshot,
  subscribeToUpdateSnapshot,
  updateApp,
} from "@/lib/app-update";
import { getRawData, saveRoutine } from "@/lib/storage";
import { SNAPSHOT_KEY } from "@/lib/storage-keys";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hasUpdateSnapshot / hasNoUpdateSnapshotOnServer", () => {
  it("is false when nothing is stored", () => {
    expect(hasUpdateSnapshot()).toBe(false);
  });

  it("is true once a snapshot exists", () => {
    localStorage.setItem(SNAPSHOT_KEY, "{}");
    expect(hasUpdateSnapshot()).toBe(true);
  });

  it("the server snapshot is always false", () => {
    expect(hasNoUpdateSnapshotOnServer()).toBe(false);
  });
});

describe("saveUpdateSnapshot / readUpdateSnapshot", () => {
  it("saves the current data as a backup and notifies listeners", () => {
    saveRoutine({ id: "r1", name: "Morning", order: 0, steps: [] });
    const listener = vi.fn();
    subscribeToUpdateSnapshot(listener);

    const backup = saveUpdateSnapshot();

    expect(backup?.data.routines).toEqual([
      { id: "r1", name: "Morning", order: 0, steps: [] },
    ]);
    expect(hasUpdateSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reads back what was saved", () => {
    saveRoutine({ id: "r1", name: "Morning", order: 0, steps: [] });
    saveUpdateSnapshot();
    expect(readUpdateSnapshot()?.data.routines).toEqual([
      { id: "r1", name: "Morning", order: 0, steps: [] },
    ]);
  });

  it("returns null when nothing is stored", () => {
    expect(readUpdateSnapshot()).toBeNull();
  });

  it("returns null instead of throwing for a corrupted snapshot", () => {
    localStorage.setItem(SNAPSHOT_KEY, "{not json");
    expect(readUpdateSnapshot()).toBeNull();
  });
});

describe("restoreUpdateSnapshot", () => {
  it("returns false when there is nothing to restore", () => {
    expect(restoreUpdateSnapshot()).toBe(false);
  });

  it("restores the snapshot's data", () => {
    saveRoutine({ id: "r1", name: "Morning", order: 0, steps: [] });
    saveUpdateSnapshot();
    saveRoutine({ id: "r2", name: "Evening", order: 1, steps: [] });

    expect(restoreUpdateSnapshot()).toBe(true);
    expect(getRawData().routines.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("discardUpdateSnapshot", () => {
  it("removes the snapshot and notifies listeners", () => {
    localStorage.setItem(SNAPSHOT_KEY, "{}");
    const listener = vi.fn();
    subscribeToUpdateSnapshot(listener);

    discardUpdateSnapshot();

    expect(hasUpdateSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("updateApp", () => {
  it("saves a snapshot and reloads the page", async () => {
    saveRoutine({ id: "r1", name: "Morning", order: 0, steps: [] });
    // jsdom's window.location.reload isn't configurable, so it can't be
    // spied on directly — vi.stubGlobal replaces the whole object instead,
    // and (unlike a raw Object.defineProperty) restores it safely even when
    // the environment is reused across files (isolate: false).
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(hasUpdateSnapshot()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("updates a waiting service worker registration", async () => {
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

    await updateApp();

    expect(update).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("still reloads if the service worker check throws", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: vi.fn().mockRejectedValue(new Error("nope")),
      },
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("clears every cache", async () => {
    // jsdom has no Cache Storage API either, so "caches" in window is
    // normally false — same reasoning as the service worker case above.
    const deleteCache = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["cache-a", "cache-b"]),
      delete: deleteCache,
    });
    vi.stubGlobal("location", { reload: vi.fn() });

    await updateApp();

    expect(deleteCache).toHaveBeenCalledWith("cache-a");
    expect(deleteCache).toHaveBeenCalledWith("cache-b");
    expect(deleteCache).toHaveBeenCalledTimes(2);
  });

  it("still reloads if clearing caches throws", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn().mockRejectedValue(new Error("nope")),
    });
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });

    await updateApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
