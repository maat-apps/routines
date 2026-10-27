import type { SharedBackupOptions } from "@maat-apps/core/share-target";

// Web Share Target (@maat-apps/core/share-target): an installed Routines
// shows up in Android's share sheet (public/manifest.json's
// `share_target`), so a backup can be sent straight from a cloud drive app
// the file picker can't reach (e.g. Proton Drive). The service worker
// (src/sw.ts) parks the file in this cache — which its activation keeps —
// and redirects home with `?shared-backup`, where the app takes it and asks
// before importing.
export const SHARED_BACKUP: SharedBackupOptions = {
  baseUrl: import.meta.env.BASE_URL,
  cacheName: "routines-shared-backup",
};
