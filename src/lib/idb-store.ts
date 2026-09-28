import { createKeyValueStore } from "@maat-apps/core/storage";

import { ALL_STORAGE_KEYS, LOCALE_KEY } from "@/lib/storage-keys";

// The key-value store every storage module builds on (@maat-apps/core's
// IndexedDB wrapper), plus the one thing specific to routines: carrying over
// the old localStorage-based storage the first time the database is created.

// A corrupt legacy value is skipped, not fatal — the rest of the migration
// (and the app) still needs to work. Returns the keys that were copied.
function migrateFromLocalStorage(store: IDBObjectStore): string[] {
  const migrated: string[] = [];
  for (const key of ALL_STORAGE_KEYS) {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      continue; // localStorage blocked (e.g. private mode) — nothing to migrate.
    }
    if (raw == null) continue;
    try {
      // LOCALE_KEY stored a bare string ("pl"/"en"), not JSON — every other
      // key stored a JSON.stringify'd object.
      const value = key === LOCALE_KEY ? raw : JSON.parse(raw);
      store.put(value, key);
      migrated.push(key);
    } catch {
      // Corrupt legacy value — skip it, same as storage.ts's own JSON.parse
      // guard would have treated it as absent.
    }
  }
  return migrated;
}

function clearMigratedKeys(keys: string[]): void {
  try {
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Nothing to undo — the migrated copy in IndexedDB is what matters.
  }
}

const store = createKeyValueStore({
  name: "routines",
  // Every caller (storage.ts, locale-store.ts, settings.ts, app-update.ts)
  // guards `typeof window === "undefined"` before reaching here.
  onCreate: (objectStore) => {
    const migrated = migrateFromLocalStorage(objectStore);
    return () => clearMigratedKeys(migrated);
  },
});

export const kvGet = store.get;
export const kvSet = store.set;
export const kvDelete = store.delete;

export { store as keyValueStore };
