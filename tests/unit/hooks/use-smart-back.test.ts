import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { useSmartBack } from "@/hooks/use-smart-back";

function useSmartBackWithLocation(fallback: string) {
  return { back: useSmartBack(fallback), location: useLocation() };
}

// No JSX/.tsx here (see CLAUDE.md's Unit tests note) — vitest.config.ts
// deliberately has no React plugin to transform it, so the router wrapper
// is built with createElement directly instead.
function renderAt(
  initialEntries: string[],
  initialIndex: number,
  fallback: string,
) {
  return renderHook(() => useSmartBackWithLocation(fallback), {
    wrapper: ({ children }) =>
      createElement(MemoryRouter, { initialEntries, initialIndex }, children),
  });
}

describe("useSmartBack", () => {
  it('replaces to the fallback on a fresh/deep-linked load (location.key is "default")', () => {
    const { result } = renderAt(["/routine/edit?id=r1"], 0, "/routine?id=r1");
    expect(result.current.location.key).toBe("default");

    act(() => result.current.back());

    expect(result.current.location.pathname).toBe("/routine");
    expect(result.current.location.search).toBe("?id=r1");
  });

  it("pops real history when the current location was pushed within the app", () => {
    const { result } = renderAt(
      ["/routine?id=r1", "/routine/edit?id=r1"],
      1,
      "/routine?id=r1",
    );
    expect(result.current.location.key).not.toBe("default");

    act(() => result.current.back());

    expect(result.current.location.pathname).toBe("/routine");
  });
});
