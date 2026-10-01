import {
  createUpdateSnapshot,
  updateApp as updateAppWith,
} from "@maat-apps/core/update";

import {
  applyBackup,
  createBackup,
  parseBackupValue,
  type Backup,
} from "@/lib/backup";
import { encryptionKey } from "@/lib/encryption-key";
import { keyValueStore } from "@/lib/idb-store";
import { SNAPSHOT_KEY } from "@/lib/storage-keys";

// Settings' "Update app" and its pre-update snapshot (@maat-apps/core/update),
// with routines' own backup format as the snapshot and the lock's key
// encrypting it like the rest of routines' data. Every caller only runs from
// an already-unlocked screen, so unlike storage.ts there's no background
// load to gate on the key.

const snapshot = createUpdateSnapshot<Backup>({
  storage: keyValueStore,
  key: SNAPSHOT_KEY,
  backup: {
    create: createBackup,
    parse: parseBackupValue,
    apply: applyBackup,
  },
  encryption: { getKey: encryptionKey.get },
});

/** Test-only: resolves once the initial existence check has finished. */
export const whenLoaded = snapshot.whenLoaded;
export const subscribeToUpdateSnapshot = snapshot.subscribe;
/** Cheap existence check — doesn't read (or decrypt) the stored backup. */
export const hasUpdateSnapshot = snapshot.has;
export const hasNoUpdateSnapshotOnServer = snapshot.hasOnServer;
export const saveUpdateSnapshot = snapshot.save;
export const readUpdateSnapshot = snapshot.read;
export const restoreUpdateSnapshot = snapshot.restore;
export const discardUpdateSnapshot = snapshot.discard;

/** Snapshot, activate the waiting worker, drop every cache, reload. */
export function updateApp(): Promise<void> {
  return updateAppWith(snapshot);
}
