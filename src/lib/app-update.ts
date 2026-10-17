import { backups } from "@/lib/backup";

// Settings' "Update app" and its pre-update snapshot (@maat-apps/core/local's
// backup kit): the routines backup, encrypted with the lock's key like the
// routines themselves.

const { snapshot } = backups;

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
export const updateApp = backups.updateApp;
