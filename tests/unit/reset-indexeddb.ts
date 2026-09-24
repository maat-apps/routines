// vitest.config.ts's isolate: false shares one fake-indexeddb global across
// the whole run (same reasoning as sharing one jsdom instance), so every test
// touching the storage layer needs to delete the database itself, the same
// way each file already clears localStorage in its own beforeEach.
export function resetIndexedDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("routines");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
