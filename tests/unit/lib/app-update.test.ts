import { beforeEach, describe, expect, it, vi } from "vitest";

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
    // spied on directly — replace the whole location object with a minimal
    // stub instead. Nothing else in updateApp touches other location fields.
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload },
      configurable: true,
    });

    await updateApp();

    expect(hasUpdateSnapshot()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
