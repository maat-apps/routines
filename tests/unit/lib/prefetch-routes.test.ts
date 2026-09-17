import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetchRouteChunks } from "@/lib/prefetch-routes";

// Without these, prefetch()'s real dynamic import()s pull in the actual
// view components (and their whole React/JSX chain), which don't resolve
// before the test's jsdom environment tears down — Vitest logs that as an
// unhandled rejection even though the test itself passes.
vi.mock("@/views/new/new-routine-view", () => ({}));
vi.mock("@/views/routine/routine-view", () => ({}));
vi.mock("@/views/routine-edit/routine-edit-view", () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("prefetchRouteChunks", () => {
  it("schedules via requestIdleCallback when available, and cancels it on cleanup", () => {
    const requestIdleCallback = vi.fn().mockReturnValue(42);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

    const cancel = prefetchRouteChunks();

    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function));

    cancel();
    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
  });

  it("does not throw when the idle callback actually fires", () => {
    let idleCallback: (() => void) | undefined;
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((cb: () => void) => {
        idleCallback = cb;
        return 1;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    prefetchRouteChunks();
    expect(() => idleCallback?.()).not.toThrow();
  });

  it("falls back to setTimeout when requestIdleCallback is unavailable, and clears it on cleanup", () => {
    // jsdom has no requestIdleCallback at all by default — stubbing it away
    // explicitly anyway so this test doesn't depend on that being true.
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();

    const cancel = prefetchRouteChunks();
    expect(vi.getTimerCount()).toBe(1);

    cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});
