import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_KEY } from "@/lib/storage-keys";

// storage.ts/settings.ts cache their snapshots in module-level state, so each
// test needs a fresh module graph — the hooks module is re-imported alongside
// them so both resolve to the same instances.
async function freshUseStore() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  const settings = await import("@/lib/settings");
  const hooks = await import("@/hooks/use-store");
  return { ...hooks, storage, settings };
}

function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
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
    expect(result.current).toEqual({ lock: null });

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

    // Simulate midnight passing while the tab stayed open: only the stored
    // lastResetDate moves backward, exactly as a real date rollover would —
    // the app itself is never told directly.
    const raw = JSON.parse(localStorage.getItem(DATA_KEY)!);
    raw.state.r1.lastResetDate = "2000-01-01";
    localStorage.setItem(DATA_KEY, JSON.stringify(raw));

    setDocumentVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.r1.checkedStepIds).toEqual([]);
  });

  it("does not revalidate while the document is hidden", async () => {
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

    const raw = JSON.parse(localStorage.getItem(DATA_KEY)!);
    raw.state.r1.lastResetDate = "2000-01-01";
    localStorage.setItem(DATA_KEY, JSON.stringify(raw));

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
