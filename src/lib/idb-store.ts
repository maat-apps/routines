import { ALL_STORAGE_KEYS, LOCALE_KEY } from "@/lib/storage-keys";

// A tiny hand-rolled promise wrapper around raw IndexedDB, in the same spirit
// as src/i18n/use-translation.ts being a custom hook instead of a library —
// the surface area needed here (get/set/delete on one key-value store) is too
// small to justify a dependency.

const DB_NAME = "routines";
const DB_VERSION = 1;
const STORE_NAME = "kv";

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function whenComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// Only the very first time this database is created: carry over whatever the
// old localStorage-based storage already had, so upgrading doesn't lose data.
// A corrupt legacy value is skipped, not fatal — the rest of the migration
// (and the app) still needs to work.
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

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let migratedKeys: string[] = [];

    request.onupgradeneeded = () => {
      // Every caller (storage.ts, locale-store.ts, settings.ts, app-update.ts)
      // already guards `typeof window === "undefined"` before ever reaching
      // here, so `window` is guaranteed present.
      const store = request.result.createObjectStore(STORE_NAME);
      migratedKeys = migrateFromLocalStorage(store);
    };
    request.onsuccess = () => {
      if (migratedKeys.length > 0) {
        try {
          for (const key of migratedKeys) {
            window.localStorage.removeItem(key);
          }
        } catch {
          // Nothing to undo — the migrated copy in IndexedDB is what matters.
        }
      }
      // Without this, another tab (or a version bump) trying to open a newer
      // version — or delete the database outright — would hang forever
      // waiting for this connection to close.
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  return promisifyRequest(
    transaction.objectStore(STORE_NAME).get(key) as IDBRequest<T | undefined>,
  );
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(value, key);
  await whenComplete(transaction);
}

export async function kvDelete(key: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(key);
  await whenComplete(transaction);
}
