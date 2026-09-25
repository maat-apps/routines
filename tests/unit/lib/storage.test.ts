import { beforeEach, describe, expect, it, vi } from "vitest";

import { DATA_KEY } from "@/lib/storage-keys";
import { resetIndexedDb } from "../reset-indexeddb";

// getRawData's `typeof window === "undefined"` guard is tested in
// ssr-guards.test.ts, not here — it needs a Node environment (no window at
// all), which this file can't switch to without breaking every other test
// below that relies on jsdom.
//
// storage.ts caches its data in module-level state, so each test needs a
// fresh module instance — otherwise one test's cached data would bleed into
// the next. Data now loads from IndexedDB in the background on first access,
// so this also awaits `whenLoaded()` before handing the module back — tests
// seed via `localStorage.setItem` exactly as before, and idb-store.ts's
// one-time migration (triggered because resetIndexedDb() below leaves no
// database for the next freshStorage() to find) picks it up from there.
async function freshStorage() {
  vi.resetModules();
  const storage = await import("@/lib/storage");
  await storage.whenLoaded();
  return storage;
}

function todayStr(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

beforeEach(async () => {
  localStorage.clear();
  await resetIndexedDb();
});

describe("readData / getRawData", () => {
  it("returns empty data when nothing is stored", async () => {
    const { getRawData } = await freshStorage();
    expect(getRawData()).toEqual({ routines: [], state: {} });
  });

  it("returns empty data for malformed JSON instead of throwing", async () => {
    localStorage.setItem(DATA_KEY, "{not json");
    const { getRawData } = await freshStorage();
    expect(getRawData()).toEqual({ routines: [], state: {} });
  });

  it("round-trips valid data", async () => {
    const { saveRoutine, getRawData } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(getRawData().routines).toEqual([
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

describe("normalizeState (daily reset, via getStateSnapshot)", () => {
  it("initializes state for a routine with no existing entry", async () => {
    const { saveRoutine, getStateSnapshot } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(getStateSnapshot()).toEqual({
      r1: { checkedStepIds: [], lastResetDate: todayStr() },
    });
  });

  it("resets a routine whose lastResetDate is not today, and persists it", async () => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        routines: [
          {
            id: "r1",
            name: "Morning",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [],
          },
        ],
        state: {
          r1: { checkedStepIds: ["s1"], lastResetDate: "2000-01-01" },
        },
      }),
    );
    const { getStateSnapshot, getRawData } = await freshStorage();
    expect(getStateSnapshot()).toEqual({
      r1: { checkedStepIds: [], lastResetDate: todayStr() },
    });
    expect(getRawData().state.r1.lastResetDate).toBe(todayStr());
  });

  it("leaves a routine whose lastResetDate is already today untouched", async () => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        routines: [
          {
            id: "r1",
            name: "Morning",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [],
          },
        ],
        state: {
          r1: { checkedStepIds: ["s1"], lastResetDate: todayStr() },
        },
      }),
    );
    const { getStateSnapshot } = await freshStorage();
    expect(getStateSnapshot()).toEqual({
      r1: { checkedStepIds: ["s1"], lastResetDate: todayStr() },
    });
  });
});

describe("saveRoutine", () => {
  it("appends a new routine with the next order", async () => {
    const { saveRoutine, getRoutinesSnapshot } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(getRoutinesSnapshot().map((r) => [r.id, r.order])).toEqual([
      ["r1", 0],
      ["r2", 1],
    ]);
  });

  it("replaces an existing routine in place without reordering others", async () => {
    const { saveRoutine, getRoutinesSnapshot } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    saveRoutine({
      id: "r1",
      name: "A renamed",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(getRoutinesSnapshot().map((r) => [r.id, r.name])).toEqual([
      ["r1", "A renamed"],
      ["r2", "B"],
    ]);
  });
});

describe("toggleStep", () => {
  it("checks an unchecked step and unchecks a checked one", async () => {
    const { saveRoutine, toggleStep } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "Morning",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "Drink water", order: 0 }],
    });
    const checked = toggleStep("r1", "s1");
    expect(checked.r1.checkedStepIds).toEqual(["s1"]);
    const unchecked = toggleStep("r1", "s1");
    expect(unchecked.r1.checkedStepIds).toEqual([]);
  });

  it("resets a stale lastResetDate before applying the toggle", async () => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        routines: [
          {
            id: "r1",
            name: "Morning",
            order: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            steps: [{ id: "s1", text: "Drink water", order: 0 }],
          },
        ],
        state: {
          r1: { checkedStepIds: ["s1"], lastResetDate: "2000-01-01" },
        },
      }),
    );
    const { toggleStep } = await freshStorage();
    // Checked "yesterday" (a stale lastResetDate) — today's normalizeState
    // reset fires inside this same call, so this toggle should read as
    // unchecked-then-checked, not toggle off. This is the exact bug
    // useRevalidateOnVisibility guards against at the UI layer.
    const result = toggleStep("r1", "s1");
    expect(result.r1.checkedStepIds).toEqual(["s1"]);
    expect(result.r1.lastResetDate).toBe(todayStr());
  });

  it("initializes fresh state instead of throwing for a routine with no existing entry", async () => {
    // normalizeState always seeds state for every real routine, so this only
    // happens for an id that doesn't match any routine at all — a defensive
    // path, same spirit as deleteRoutine's no-op-for-unknown-id case.
    const { toggleStep } = await freshStorage();
    const result = toggleStep("ghost", "s1");
    expect(result.ghost).toEqual({
      checkedStepIds: ["s1"],
      lastResetDate: todayStr(),
    });
  });
});

describe("reorderRoutines", () => {
  it("applies order from the given id list", async () => {
    const { saveRoutine, reorderRoutines, getRoutinesSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    reorderRoutines(["r2", "r1"]);
    expect(getRoutinesSnapshot().map((r) => r.id)).toEqual(["r2", "r1"]);
  });

  it("ignores an id in orderedIds that no longer exists", async () => {
    const { saveRoutine, reorderRoutines, getRoutinesSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    reorderRoutines(["ghost", "r1"]);
    expect(getRoutinesSnapshot().map((r) => r.id)).toEqual(["r1"]);
  });

  it("preserves a routine missing from orderedIds instead of dropping it", async () => {
    const { saveRoutine, reorderRoutines, getRoutinesSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    reorderRoutines(["r2"]);
    expect(getRoutinesSnapshot().map((r) => r.id)).toEqual(["r2", "r1"]);
  });
});

describe("deleteRoutine", () => {
  it("removes the routine and its state entry", async () => {
    const {
      saveRoutine,
      toggleStep,
      deleteRoutine,
      getRoutinesSnapshot,
      getStateSnapshot,
    } = await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "x", order: 0 }],
    });
    toggleStep("r1", "s1");
    deleteRoutine("r1");
    expect(getRoutinesSnapshot()).toEqual([]);
    expect(getStateSnapshot()).toEqual({});
  });

  it("is a no-op for a non-existent id", async () => {
    const { saveRoutine, deleteRoutine, getRoutinesSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(() => deleteRoutine("ghost")).not.toThrow();
    expect(getRoutinesSnapshot().map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("resetRoutine / resetAll", () => {
  it("resetRoutine clears only the given routine's checked steps", async () => {
    const { saveRoutine, toggleStep, resetRoutine, getStateSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "x", order: 0 }],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 1,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s2", text: "y", order: 0 }],
    });
    toggleStep("r1", "s1");
    toggleStep("r2", "s2");
    resetRoutine("r1");
    const state = getStateSnapshot();
    expect(state.r1.checkedStepIds).toEqual([]);
    expect(state.r2.checkedStepIds).toEqual(["s2"]);
  });

  it("resetAll clears every routine's checked steps", async () => {
    const { saveRoutine, toggleStep, resetAll, getStateSnapshot } =
      await freshStorage();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s1", text: "x", order: 0 }],
    });
    saveRoutine({
      id: "r2",
      name: "B",
      order: 1,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [{ id: "s2", text: "y", order: 0 }],
    });
    toggleStep("r1", "s1");
    toggleStep("r2", "s2");
    resetAll();
    const state = getStateSnapshot();
    expect(state.r1.checkedStepIds).toEqual([]);
    expect(state.r2.checkedStepIds).toEqual([]);
  });
});

describe("subscribe / emitChange", () => {
  it("notifies a subscribed listener on mutation", async () => {
    const { subscribe, saveRoutine } = await freshStorage();
    const listener = vi.fn();
    subscribe(listener);
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribing", async () => {
    const { subscribe, saveRoutine } = await freshStorage();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("server snapshots (useSyncExternalStore's SSR fallback)", () => {
  it("getServerRoutinesSnapshot/getServerStateSnapshot return empty data", async () => {
    const { getServerRoutinesSnapshot, getServerStateSnapshot } =
      await freshStorage();
    expect(getServerRoutinesSnapshot()).toEqual([]);
    expect(getServerStateSnapshot()).toEqual({});
  });
});

describe("setEncryptionKey", () => {
  it("persists writes as an encrypted blob once a key is set", async () => {
    const { saveRoutine, setEncryptionKey } = await freshStorage();
    const { deriveKey, isEncryptedBlob, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const { kvGet } = await import("@/lib/idb-store");
    setEncryptionKey(await deriveKey(randomBytes(32), randomBytes(16)));

    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });

    // The write (encrypt + kvSet) is fire-and-forget — poll instead of
    // guessing a fixed delay, since real crypto.subtle + IndexedDB timing
    // varies with the runner's load.
    await vi.waitFor(async () => {
      expect(isEncryptedBlob(await kvGet(DATA_KEY))).toBe(true);
    });
  });

  it("decrypts an existing encrypted blob on load once the key is set", async () => {
    vi.resetModules();
    const storage = await import("@/lib/storage");
    const { deriveKey, encryptJson, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const { kvSet } = await import("@/lib/idb-store");
    const key = await deriveKey(randomBytes(32), randomBytes(16));
    const data = {
      routines: [
        {
          id: "r1",
          name: "Secret",
          order: 0,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          steps: [],
        },
      ],
      state: {},
    };
    await kvSet(DATA_KEY, await encryptJson(key, data));

    storage.setEncryptionKey(key);
    await storage.whenLoaded();

    expect(storage.getRawData().routines).toEqual(data.routines);
  });

  it("does not reveal encrypted data until a key is provided, when the enrolled lock requires one", async () => {
    vi.resetModules();
    const settings = await import("@/lib/settings");
    await settings.whenLoaded();
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });

    const { deriveKey, encryptJson, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const { kvSet } = await import("@/lib/idb-store");
    const key = await deriveKey(randomBytes(32), randomBytes(16));
    const data = {
      routines: [
        {
          id: "r1",
          name: "Secret",
          order: 0,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          steps: [],
        },
      ],
      state: {},
    };
    await kvSet(DATA_KEY, await encryptJson(key, data));

    const storage = await import("@/lib/storage");
    // Kick off the background load but never await it directly here — if
    // it were wrongly not gated, this delay would be enough for it to have
    // already decrypted and populated the real data.
    void storage.whenLoaded();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(storage.getRawData()).toEqual({ routines: [], state: {} });

    storage.setEncryptionKey(key);
    await storage.whenLoaded();
    expect(storage.getRawData().routines).toEqual(data.routines);
  });

  it("decrypts data when the key was set before the first load — AppLockGate's real ordering", async () => {
    vi.resetModules();
    const settings = await import("@/lib/settings");
    await settings.whenLoaded();
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: true,
      prfSalt: "c2FsdA",
    });

    const { deriveKey, encryptJson, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const { kvSet } = await import("@/lib/idb-store");
    const key = await deriveKey(randomBytes(32), randomBytes(16));
    const data = {
      routines: [
        {
          id: "r1",
          name: "Secret",
          order: 0,
          activeDays: [0, 1, 2, 3, 4, 5, 6],
          steps: [],
        },
      ],
      state: {},
    };
    await kvSet(DATA_KEY, await encryptJson(key, data));

    // AppLockGate calls setEncryptionKey() as soon as verifyAppLock()
    // resolves, and only mounts children — the first code to ever touch
    // this module — afterwards. So the key can already be set before
    // whenLoaded() (and the whenUnlocked() it awaits internally) ever runs.
    const storage = await import("@/lib/storage");
    storage.setEncryptionKey(key);
    await storage.whenLoaded();

    expect(storage.getRawData().routines).toEqual(data.routines);
  });

  it("does not hold the load when the enrolled lock is lock-only (no PRF support)", async () => {
    vi.resetModules();
    const settings = await import("@/lib/settings");
    await settings.whenLoaded();
    settings.setLockEnrolment({
      credentialId: "c1",
      userId: "u1",
      createdAt: "now",
      encryptionSupported: false,
    });

    const storage = await import("@/lib/storage");
    // If this were incorrectly gated on a key that's never provided, this
    // await would hang until the test times out rather than resolving.
    await storage.whenLoaded();
    expect(storage.getRawData()).toEqual({ routines: [], state: {} });
  });

  it("stops encrypting once the key is cleared", async () => {
    const { saveRoutine, setEncryptionKey } = await freshStorage();
    const { deriveKey, isEncryptedBlob, randomBytes } =
      await import("@/lib/webauthn-crypto");
    const { kvGet } = await import("@/lib/idb-store");
    setEncryptionKey(await deriveKey(randomBytes(32), randomBytes(16)));
    setEncryptionKey(null);

    saveRoutine({
      id: "r1",
      name: "A",
      order: 0,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      steps: [],
    });

    await vi.waitFor(async () => {
      const stored = await kvGet(DATA_KEY);
      expect(stored).not.toBeUndefined();
    });
    expect(isEncryptedBlob(await kvGet(DATA_KEY))).toBe(false);
  });
});
