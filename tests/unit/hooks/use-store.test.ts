import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIndexedDb } from "../reset-indexeddb";

// storage.ts/settings.ts cache their data in module-level state (loaded from
// IndexedDB in the background), so each test needs a fresh module graph — the
// hooks module is re-imported alongside them so both resolve to the same
// instances.
async function freshUseStore() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  const settings = await import("@/lib/settings");
  await settings.whenLoaded();
  const hooks = await import("@/hooks/use-store");
  return { ...hooks, storage, settings };
}

function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
  setDocumentVisibility("visible");
});

afterEach(() => {
  // With isolate: false, document is shared across every test file in the
  // run — leaving this at "hidden" (the last test below sets it) would
  // otherwise bleed into whichever file runs next.
  setDocumentVisibility("visible");
  // Same reasoning for the vi.spyOn(document/window, "removeEventListener")
  // calls below — not undone automatically once the environment is shared.
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useRoutines", () => {
  it("returns the current routines and updates after a mutation", async () => {
    const { useRoutines, storage } = await freshUseStore();
    const { result } = renderHook(() => useRoutines());
    expect(result.current).toEqual([]);

    act(() => {
      storage.saveRoutine({
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      });
    });

    expect(result.current).toEqual([
      {
        id: "r1",
        name: "Morning",
        order: 0,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
        steps: [],
      },
    ]);
  });
});

describe("useRoutineState", () => {
  it("returns the current state and updates after a toggle", async () => {
    const { useRoutineState, storage } = await freshUseStore();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "Drink water", order: 0 }],
    });

    const { result } = renderHook(() => useRoutineState());
    expect(result.current.r1.checkedStepIds).toEqual([]);

    act(() => {
      storage.toggleStep("r1", "s1");
    });

    expect(result.current.r1.checkedStepIds).toEqual(["s1"]);
  });
});

describe("useAppSettings", () => {
  it("returns the current settings and updates after a lock change", async () => {
    const { useAppSettings, settings } = await freshUseStore();
    const { result } = renderHook(() => useAppSettings());
    expect(result.current).toEqual({ lock: null, installed: false });

    act(() => {
      settings.setLockEnrolment({
        credentialId: "c1",
        userId: "u1",
        createdAt: "now",
      });
    });

    expect(result.current.lock?.credentialId).toBe("c1");
  });
});

describe("useRevalidateOnVisibility", () => {
  it("re-checks the daily reset when the tab becomes visible again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));
    const { useRevalidateOnVisibility, useRoutineState, storage } =
      await freshUseStore();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "Drink water", order: 0 }],
    });
    storage.toggleStep("r1", "s1");

    const { result } = renderHook(() => {
      useRevalidateOnVisibility();
      return useRoutineState();
    });
    expect(result.current.r1.checkedStepIds).toEqual(["s1"]);

    // Simulate midnight passing while the tab stayed open — real time moves
    // forward, but nothing in the app is told directly; only the visibility
    // listener re-checks.
    vi.setSystemTime(new Date(2000, 0, 2));

    setDocumentVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.r1.checkedStepIds).toEqual([]);
  });

  it("does not revalidate while the document is hidden", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2000, 0, 1));
    const { useRevalidateOnVisibility, useRoutineState, storage } =
      await freshUseStore();
    storage.saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "Drink water", order: 0 }],
    });
    storage.toggleStep("r1", "s1");

    const { result } = renderHook(() => {
      useRevalidateOnVisibility();
      return useRoutineState();
    });

    vi.setSystemTime(new Date(2000, 0, 2));

    setDocumentVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Still stale — nothing forced a recompute.
    expect(result.current.r1.checkedStepIds).toEqual(["s1"]);
  });

  it("removes its event listeners on unmount", async () => {
    const { useRevalidateOnVisibility } = await freshUseStore();
    const removeDocListener = vi.spyOn(document, "removeEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useRevalidateOnVisibility());
    unmount();

    expect(removeDocListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      "focus",
      expect.any(Function),
    );
  });
});
