import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_KEY } from "@/lib/storage-keys";

// readStoredLocale's `typeof window === "undefined"` guard is tested in
// ssr-guards.test.ts, not here — see storage.test.ts's equivalent comment
// for why it needs its own file (a Node environment, not jsdom — and this
// file in particular relies on window.navigator, which Node doesn't have).
//
// getLocaleSnapshot caches into a module-level singleton on first read, so
// each test needs a fresh module instance to control what it reads.
async function freshLocaleStore() {
  vi.resetModules();
  return import("@/lib/locale-store");
}

function setNavigatorLanguage(language: string) {
  Object.defineProperty(window.navigator, "language", {
    value: language,
    configurable: true,
  });
}

const originalLanguage = window.navigator.language;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  setNavigatorLanguage(originalLanguage);
});

describe("isLocale", () => {
  it("narrows pl/en, rejects anything else", async () => {
    const { isLocale } = await freshLocaleStore();
    expect(isLocale("pl")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("first launch (nothing stored)", () => {
  it("detects pl from a pl-prefixed navigator.language", async () => {
    setNavigatorLanguage("pl-PL");
    const { getLocaleSnapshot } = await freshLocaleStore();
    expect(getLocaleSnapshot()).toBe("pl");
  });

  it("falls back to the default locale for anything else", async () => {
    setNavigatorLanguage("de-DE");
    const { getLocaleSnapshot, DEFAULT_LOCALE } = await freshLocaleStore();
    expect(getLocaleSnapshot()).toBe(DEFAULT_LOCALE);
  });

  it("falls back to the default locale when navigator.language is unset", async () => {
    Object.defineProperty(window.navigator, "language", {
      value: undefined,
      configurable: true,
    });
    const { getLocaleSnapshot, DEFAULT_LOCALE } = await freshLocaleStore();
    expect(getLocaleSnapshot()).toBe(DEFAULT_LOCALE);
  });

  it("persists the detected value, not just returns it", async () => {
    setNavigatorLanguage("pl-PL");
    const { getLocaleSnapshot } = await freshLocaleStore();
    getLocaleSnapshot();
    expect(localStorage.getItem(LOCALE_KEY)).toBe("pl");
  });
});

describe("a stored value always wins over navigator.language", () => {
  it("ignores navigator.language once a value is stored", async () => {
    localStorage.setItem(LOCALE_KEY, "en");
    setNavigatorLanguage("pl-PL");
    const { getLocaleSnapshot } = await freshLocaleStore();
    expect(getLocaleSnapshot()).toBe("en");
  });
});

describe("when localStorage is unavailable (e.g. private mode)", () => {
  it("falls back to the default locale instead of throwing", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });
    const { getLocaleSnapshot, DEFAULT_LOCALE } = await freshLocaleStore();
    expect(getLocaleSnapshot()).toBe(DEFAULT_LOCALE);
    getItem.mockRestore();
  });
});

describe("setStoredLocale", () => {
  it("updates the snapshot, persists it, and notifies listeners", async () => {
    const { setStoredLocale, getLocaleSnapshot, subscribeToLocale } =
      await freshLocaleStore();
    const listener = vi.fn();
    subscribeToLocale(listener);
    setStoredLocale("pl");
    expect(getLocaleSnapshot()).toBe("pl");
    expect(localStorage.getItem(LOCALE_KEY)).toBe("pl");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribing", async () => {
    const { setStoredLocale, subscribeToLocale } = await freshLocaleStore();
    const listener = vi.fn();
    const unsubscribe = subscribeToLocale(listener);
    unsubscribe();
    setStoredLocale("pl");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("getServerLocaleSnapshot", () => {
  it("returns the default locale", async () => {
    const { getServerLocaleSnapshot, DEFAULT_LOCALE } =
      await freshLocaleStore();
    expect(getServerLocaleSnapshot()).toBe(DEFAULT_LOCALE);
  });
});
