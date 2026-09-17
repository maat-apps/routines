import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPrompt } from "@/hooks/use-install-prompt";

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

beforeEach(() => {
  mql = createMatchMediaMock(false);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInstallPrompt", () => {
  it("starts unavailable when not standalone and no prompt yet", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("unavailable");
  });

  it("reports installed immediately when already running standalone", () => {
    mql.set(true);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("installed");
  });

  it("becomes available after beforeinstallprompt, then installed on acceptance", async () => {
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

  it("switches to installed on the appinstalled event", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.state).toBe("installed");
  });
});
