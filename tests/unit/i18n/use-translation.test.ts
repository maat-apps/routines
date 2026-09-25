import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// locale-store.ts caches the locale in a module-level singleton, so each
// test needs a fresh module instance to control what it detects/reads.
// idb-store's kvGet is re-imported alongside it (not statically at the top
// of this file) since a static binding wouldn't follow `vi.resetModules()`
// and would end up pointed at a closed connection from a previous test.
async function freshUseTranslation() {
  vi.resetModules();
  const useTranslation = await import("@/i18n/use-translation");
  const { kvGet } = await import("@/lib/idb-store");
  return { ...useTranslation, kvGet };
}

function setNavigatorLanguage(language: string) {
  Object.defineProperty(window.navigator, "language", {
    value: language,
    configurable: true,
  });
}

const originalLanguage = window.navigator.language;

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

afterEach(() => {
  setNavigatorLanguage(originalLanguage);
});

describe("useTranslation", () => {
  it("detects the locale from navigator.language on first launch", async () => {
    setNavigatorLanguage("pl-PL");
    const { useTranslation } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe("pl");
    expect(result.current.t("appName")).toBe("Rutyny");
  });

  it("falls back to the default locale for an unsupported language", async () => {
    setNavigatorLanguage("de-DE");
    const { useTranslation, DEFAULT_LOCALE } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());
    expect(result.current.locale).toBe(DEFAULT_LOCALE);
  });

  it("updates every subscribed hook instance in the same tick on locale switch", async () => {
    const { useTranslation, kvGet } = await freshUseTranslation();
    const first = renderHook(() => useTranslation());
    const second = renderHook(() => useTranslation());

    act(() => {
      first.result.current.setLocale("pl");
    });

    expect(first.result.current.locale).toBe("pl");
    expect(second.result.current.locale).toBe("pl");
    await expect(kvGet(LOCALE_KEY)).resolves.toBe("pl");
  });

  it("substitutes {placeholder} params in a message", async () => {
    const { useTranslation } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t("stepNumber", { number: 3 })).toBe("Step 3");
  });

  it("leaves an unmatched placeholder token as-is", async () => {
    const { useTranslation } = await freshUseTranslation();
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t("stepNumber", {})).toBe("Step {number}");
  });
});
