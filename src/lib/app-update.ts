import {
  applyBackup,
  createBackup,
  parseBackupValue,
  type Backup,
} from "@/lib/backup";
import { kvDelete, kvGet, kvSet } from "@/lib/idb-store";
import { SNAPSHOT_KEY } from "@/lib/storage-keys";
import {
  decryptJson,
  encryptJson,
  isEncryptedBlob,
} from "@/lib/webauthn-crypto";

// Whether a snapshot exists is browser state the settings screen renders, so
// it is exposed as a store rather than synced into React state in an effect.
// Unlike storage.ts/settings.ts, this doesn't sit on a per-render hot path —
// it's a handful of explicit, user-triggered actions — so the functions below
// are genuinely `async` (and awaited by their callers) rather than
// fire-and-forget. That matters most for `saveUpdateSnapshot`: it runs right
// before `window.location.reload()`, so the write must be durable before the
// reload can tear the page down.
const listeners = new Set<() => void>();
let snapshotExists = false;
let loaded: Promise<void> | null = null;

// Set by app-lock.ts, same as storage.ts's own encryption key — every call
// site here only ever runs from an already-unlocked screen (Settings, or
// updateApp() triggered from Settings), so unlike storage.ts there's no
// background load to gate on it; it just needs to be present by the time
// save/read actually happen.
let encryptionKey: CryptoKey | null = null;

export function setEncryptionKey(key: CryptoKey | null): void {
  encryptionKey = key;
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function ensureLoaded(): void {
  if (loaded) return;
  if (typeof window === "undefined") return;
  loaded = kvGet<unknown>(SNAPSHOT_KEY)
    .then((stored) => {
      snapshotExists = stored != null;
    })
    .catch(() => {
      // Keep the "no snapshot" default.
    })
    .finally(() => {
      notify();
    });
}

/**
 * Resolves once the initial background read from IndexedDB has finished —
 * test-only, mirrors storage.ts's/locale-store.ts's/settings.ts's own
 * `whenLoaded()`.
 */
export function whenLoaded(): Promise<void> {
  ensureLoaded();
  return loaded ?? Promise.resolve();
}

export function subscribeToUpdateSnapshot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Cheap existence check — does not read (or decrypt) the stored backup itself. */
export function hasUpdateSnapshot(): boolean {
  ensureLoaded();
  return snapshotExists;
}

export function hasNoUpdateSnapshotOnServer(): boolean {
  return false;
}

/**
 * Updating cannot lose data on its own — IndexedDB outlives a service-worker
 * swap. The snapshot is cheap insurance against the update itself going wrong,
 * and gives a one-tap way back.
 */
export async function saveUpdateSnapshot(): Promise<Backup | null> {
  try {
    const backup = createBackup();
    const toStore = encryptionKey
      ? await encryptJson(encryptionKey, backup)
      : backup;
    await kvSet(SNAPSHOT_KEY, toStore);
    snapshotExists = true;
    notify();
    return backup;
  } catch {
    return null;
  }
}

export async function readUpdateSnapshot(): Promise<Backup | null> {
  try {
    const stored = await kvGet<unknown>(SNAPSHOT_KEY);
    if (!stored) return null;
    const raw =
      encryptionKey && isEncryptedBlob(stored)
        ? await decryptJson<unknown>(encryptionKey, stored)
        : stored;
    return parseBackupValue(raw);
  } catch {
    return null;
  }
}

export async function restoreUpdateSnapshot(): Promise<boolean> {
  const snapshot = await readUpdateSnapshot();
  if (!snapshot) return false;
  applyBackup(snapshot);
  return true;
}

export async function discardUpdateSnapshot(): Promise<void> {
  try {
    await kvDelete(SNAPSHOT_KEY);
    snapshotExists = false;
    notify();
  } catch {
    // Nothing to do — the snapshot is only ever a convenience.
  }
}

/**
 * Takes a snapshot, drops every cache, lets a waiting worker take over and
 * reloads. Cached responses are what make an installed PWA go stale, so
 * clearing them is the part that actually does the work.
 */
export async function updateApp(): Promise<void> {
  await saveUpdateSnapshot();

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // An unregistrable worker should not block the reload below.
    }
  }

  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // Same again: fall through to the reload.
    }
  }

  window.location.reload();
}
