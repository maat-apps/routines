import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// use-install-prompt.ts reads/writes the persisted "installed" flag through
// settings.ts, which caches its data in a module-level singleton loaded from
// IndexedDB in the background (same reasoning as settings.test.ts) — without
// a fresh module instance per test, one test's markInstalled() would leak
// into every test after it, and without awaiting settings' own
// `whenLoaded()`, the hook would mount before a seeded "installed" flag has
// finished loading.
async function freshInstallPrompt() {
  vi.resetModules();
  const settings = await import("@/lib/settings");
  await settings.whenLoaded();
  return import("@/hooks/use-install-prompt");
}

// jsdom doesn't implement matchMedia at all, so a controllable fake stands in
// for the real MediaQueryList — one shared instance per test so subscribe()
// and the snapshot getter both observe the same "matches" state.
function createMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: { matches: boolean }) => void>();
  return {
    get matches() {
      return matches;
    },
    media: "(display-mode: standalone)",
    addEventListener: (
      type: string,
      listener: (event: { matches: boolean }) => void,
    ) => {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener: (
      type: string,
      listener: (event: { matches: boolean }) => void,
    ) => {
      if (type === "change") listeners.delete(listener);
    },
    set(next: boolean) {
      matches = next;
    },
  };
}

let mql: ReturnType<typeof createMatchMediaMock>;

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
  mql = createMatchMediaMock(false);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  // vi.spyOn(window, "removeEventListener") below isn't undone by
  // unstubAllGlobals — with isolate: false, window is the same real object
  // shared across every test file in the run.
  vi.restoreAllMocks();
});

describe("useInstallPrompt", () => {
  it("starts unavailable when not standalone and no prompt yet", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("unavailable");
  });

  it("install() is a no-op when there is no pending prompt", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      await result.current.install();
    });
    expect(result.current.state).toBe("unavailable");
  });

  it("reports installed immediately when already running standalone", async () => {
    mql.set(true);
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("falls back to navigator.standalone for iOS Safari", async () => {
    // matchMedia's display-mode query predates iOS Safari, which sets its
    // own navigator.standalone flag instead — isStandalone() checks both.
    vi.stubGlobal("navigator", { standalone: true });
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("reports installed from a previously persisted flag alone", async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ installed: true }));
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("becomes available after beforeinstallprompt, then installed on acceptance", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: promptFn,
        userChoice: Promise.resolve({ outcome: "accepted" as const }),
      },
    );
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.state).toBe("available");

    await act(async () => {
      await result.current.install();
    });

    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("installed");
  });

  it("stays unavailable after a dismissed prompt", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: Promise.resolve({ outcome: "dismissed" as const }),
      },
    );
    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await result.current.install();
    });

    expect(result.current.state).toBe("unavailable");
  });

  it("switches to installed on the appinstalled event", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.state).toBe("installed");
  });

  it("persists installed on appinstalled, surviving a later fresh load", async () => {
    const { useInstallPrompt } = await freshInstallPrompt();
    renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    // Simulates a later page load: a fresh module instance, still not
    // standalone, with no beforeinstallprompt offered this time either.
    const { useInstallPrompt: useInstallPromptAgain } =
      await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPromptAgain());
    expect(result.current.state).toBe("installed");
  });

  it("persists installed once standalone, surviving a later non-standalone load", async () => {
    mql.set(true);
    const { useInstallPrompt } = await freshInstallPrompt();
    renderHook(() => useInstallPrompt());

    // Simulates opening the same app later from a plain browser tab, where
    // Chrome no longer offers beforeinstallprompt for an already-installed app.
    mql.set(false);
    const { useInstallPrompt: useInstallPromptAgain } =
      await freshInstallPrompt();
    const { result } = renderHook(() => useInstallPromptAgain());
    expect(result.current.state).toBe("installed");
  });

  it("removes its event listeners on unmount", async () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { useInstallPrompt } = await freshInstallPrompt();
    const { unmount } = renderHook(() => useInstallPrompt());
    unmount();

    expect(removeListener).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function),
    );
    expect(removeListener).toHaveBeenCalledWith(
      "appinstalled",
      expect.any(Function),
    );
  });
});

describe("getServerStandaloneSnapshot", () => {
  it("is always false", async () => {
    const { getServerStandaloneSnapshot } = await freshInstallPrompt();
    expect(getServerStandaloneSnapshot()).toBe(false);
  });
});
